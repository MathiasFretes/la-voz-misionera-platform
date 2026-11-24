BEGIN;
ALTER TABLE public.site_documents ADD COLUMN IF NOT EXISTS draft_data jsonb;
UPDATE public.site_documents SET draft_data=data WHERE draft_data IS NULL;
ALTER TABLE public.site_documents ALTER COLUMN draft_data SET NOT NULL;
ALTER TABLE public.site_documents ALTER COLUMN draft_data SET DEFAULT '{}';
ALTER TABLE public.site_documents ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
ALTER TABLE public.site_documents ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.site_documents ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.site_documents ADD CONSTRAINT site_draft_shape CHECK(jsonb_typeof(draft_data)='object' AND octet_length(draft_data::text)<100000);
CREATE TABLE private.site_document_history (
  collection text NOT NULL, document_id text NOT NULL, revision integer NOT NULL,
  action text NOT NULL, actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  draft_data jsonb NOT NULL, published_data jsonb NOT NULL, published boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(collection,document_id,revision)
);
REVOKE INSERT,UPDATE,DELETE ON public.site_documents FROM lvm_user;
-- Published rows may have a newer private draft: RLS alone cannot hide columns.
REVOKE SELECT ON public.site_documents FROM lvm_anon,lvm_user;
GRANT SELECT(collection,id,data,published,updated_at,published_at) ON public.site_documents TO lvm_anon,lvm_user;
CREATE OR REPLACE FUNCTION public.list_site_documents(p_collection text)
RETURNS SETOF public.site_documents LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.has_min_role('admin') THEN RAISE insufficient_privilege; END IF;
  RETURN QUERY SELECT * FROM public.site_documents WHERE collection=p_collection ORDER BY updated_at DESC,id;
END $$;
REVOKE EXECUTE ON FUNCTION public.list_site_documents(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_site_documents(text) TO lvm_user;
CREATE OR REPLACE FUNCTION public.save_site_document(p_collection text,p_id text,p_data jsonb,p_expected_revision integer,p_action text)
RETURNS SETOF public.site_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE document public.site_documents; actor uuid;
BEGIN
  IF NOT public.has_min_role('admin') THEN RAISE insufficient_privilege; END IF;
  actor:=public.current_uid();
  IF p_action NOT IN ('save','publish','unpublish') OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>=100000 OR p_expected_revision<0 OR p_expected_revision IS NULL THEN
    RAISE EXCEPTION 'Invalid site document' USING ERRCODE='22023';
  END IF;
  -- The advisory lock also serializes concurrent first saves of the same ID.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_collection||':'||p_id,0));
  SELECT * INTO document FROM public.site_documents WHERE collection=p_collection AND id=p_id FOR UPDATE;
  IF FOUND THEN
    IF document.revision<>p_expected_revision THEN RAISE EXCEPTION 'El contenido cambió en otra sesión. Recargá antes de guardar.' USING ERRCODE='PT409'; END IF;
    UPDATE public.site_documents SET draft_data=p_data,revision=revision+1,updated_at=now(),updated_by=actor,
      data=CASE WHEN p_action='publish' THEN p_data ELSE data END,
      published=CASE WHEN p_action='publish' THEN true WHEN p_action='unpublish' THEN false ELSE published END,
      published_at=CASE WHEN p_action='publish' THEN now() ELSE published_at END
    WHERE collection=p_collection AND id=p_id RETURNING * INTO document;
  ELSE
    IF p_expected_revision<>0 THEN RAISE EXCEPTION 'El contenido ya no existe. Recargá antes de guardar.' USING ERRCODE='PT409'; END IF;
    INSERT INTO public.site_documents(collection,id,data,draft_data,published,updated_by,published_at)
    VALUES(p_collection,p_id,CASE WHEN p_action='publish' THEN p_data ELSE '{}' END,p_data,p_action='publish',actor,CASE WHEN p_action='publish' THEN now() ELSE NULL END)
    RETURNING * INTO document;
  END IF;
  INSERT INTO private.site_document_history(collection,document_id,revision,action,actor_id,draft_data,published_data,published)
    VALUES(document.collection,document.id,document.revision,p_action,actor,document.draft_data,document.data,document.published);
  RETURN NEXT document;
END $$;
REVOKE EXECUTE ON FUNCTION public.save_site_document(text,text,jsonb,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_site_document(text,text,jsonb,integer,text) TO lvm_user;
INSERT INTO private.migrations(version) VALUES('007_site_editor');
NOTIFY pgrst,'reload schema';
COMMIT;
