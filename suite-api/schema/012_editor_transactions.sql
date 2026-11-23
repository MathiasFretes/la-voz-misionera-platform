BEGIN;

CREATE TABLE IF NOT EXISTS private.editor_operations (
  actor_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  command jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id, operation_id)
);
REVOKE ALL ON private.editor_operations FROM PUBLIC, lvm_anon, lvm_user;

CREATE OR REPLACE FUNCTION private.audit_editor_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid := public.current_uid();
BEGIN
  IF v_actor IS NULL THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME='songs' THEN
    IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updated_at'-'updated_by') = (to_jsonb(OLD)-'updated_at'-'updated_by') THEN RETURN NULL; END IF;
    INSERT INTO public.editor_audit_log(actor_id,action,song_id,song_slug,song_title,payload_snapshot)
      VALUES(v_actor, CASE WHEN NEW.is_deleted THEN 'deleted' ELSE 'direct_save' END, NEW.id,NEW.slug,NEW.title,to_jsonb(NEW));
  ELSE
    INSERT INTO public.editor_audit_log(actor_id,action,song_id,song_title,payload_snapshot)
      VALUES(v_actor,'suggestion_submitted',NEW.song_id,NEW.payload->>'title',NEW.payload);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS audit_editor_song ON public.songs;
CREATE TRIGGER audit_editor_song AFTER INSERT OR UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION private.audit_editor_write();
DROP TRIGGER IF EXISTS audit_editor_suggestion ON public.song_suggestions;
CREATE TRIGGER audit_editor_suggestion AFTER INSERT ON public.song_suggestions
  FOR EACH ROW EXECUTE FUNCTION private.audit_editor_write();
REVOKE INSERT, UPDATE, DELETE ON public.editor_audit_log FROM PUBLIC, lvm_anon, lvm_user;
DROP POLICY IF EXISTS audit_insert ON public.editor_audit_log;

CREATE OR REPLACE FUNCTION public.mutate_editor_song(
  p_operation_id uuid, p_action text, p_song_id uuid, p_personal_song_id uuid,
  p_payload jsonb, p_expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_actor uuid := public.current_uid();
  v_command jsonb := jsonb_build_object('action',p_action,'song',p_song_id,'personal',p_personal_song_id,'payload',p_payload,'expected',p_expected_updated_at);
  v_previous private.editor_operations%ROWTYPE;
  v_song public.songs%ROWTYPE;
  v_draft public.personal_songs%ROWTYPE;
  v_suggestion uuid;
  v_tags text[];
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR NOT public.has_min_role('user') THEN RAISE insufficient_privilege USING MESSAGE='Authentication required'; END IF;
  IF p_operation_id IS NULL OR p_action IS NULL OR p_action NOT IN ('save_published','save_draft','suggest','submit_draft','delete') THEN RAISE EXCEPTION 'Invalid editor operation'; END IF;
  IF p_action='save_published' AND NOT public.has_min_role('editor') THEN RAISE insufficient_privilege USING MESSAGE='Only editors can publish songs'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text || p_operation_id::text,0));
  SELECT * INTO v_previous FROM private.editor_operations WHERE actor_id=v_actor AND operation_id=p_operation_id;
  IF FOUND THEN
    IF v_previous.command IS DISTINCT FROM v_command THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Operation ID already used for different content'; END IF;
    RETURN v_previous.result;
  END IF;

  IF p_song_id IS NOT NULL THEN
    SELECT * INTO v_song FROM public.songs WHERE id=p_song_id AND NOT is_deleted FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Song not found'; END IF;
    IF p_expected_updated_at IS NOT NULL AND v_song.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Song changed; reload before saving'; END IF;
  END IF;
  IF p_personal_song_id IS NOT NULL THEN
    SELECT * INTO v_draft FROM public.personal_songs WHERE id=p_personal_song_id AND owner_id=v_actor FOR UPDATE;
    IF NOT FOUND THEN RAISE insufficient_privilege USING MESSAGE='Private draft not found'; END IF;
    IF p_expected_updated_at IS NOT NULL AND v_draft.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Draft changed; reload before saving'; END IF;
  END IF;
  IF p_action IN ('save_draft','submit_draft') AND p_personal_song_id IS NULL THEN RAISE EXCEPTION 'A private draft is required'; END IF;

  IF p_action <> 'delete' THEN
    IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR nullif(trim(p_payload->>'title'),'') IS NULL
      OR nullif(trim(p_payload->>'default_key'),'') IS NULL OR jsonb_typeof(p_payload->'tags') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Title, key and tags are required'; END IF;
    SELECT array_agg(trim(value)) INTO v_tags FROM jsonb_array_elements_text(p_payload->'tags') WHERE trim(value)<>'';
    IF coalesce(cardinality(v_tags),0)=0 THEN RAISE EXCEPTION 'At least one tag is required'; END IF;
    IF nullif(p_payload->>'tempo','') IS NOT NULL AND (p_payload->>'tempo')::int NOT BETWEEN 20 AND 400 THEN RAISE EXCEPTION 'Invalid tempo'; END IF;
  END IF;

  IF p_action IN ('save_draft','submit_draft') THEN
    IF p_action='submit_draft' AND v_draft.status IN ('submitted','published') THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Draft already submitted or published'; END IF;
    UPDATE public.personal_songs SET title=trim(p_payload->>'title'),artist=p_payload->>'artist',default_key=p_payload->>'default_key',
      tempo=nullif(p_payload->>'tempo','')::int,time_signature=p_payload->>'time_signature',country=p_payload->>'country',
      youtube_id=p_payload->>'youtube_id',language=p_payload->>'language',pptx_url=p_payload->>'pptx_url',tags=v_tags,
      chordpro_content=coalesce(p_payload->>'chordpro_content','') WHERE id=v_draft.id RETURNING * INTO v_draft;
    IF p_action='save_draft' THEN v_result=jsonb_build_object('kind','personal','row',to_jsonb(v_draft)); END IF;
  END IF;

  IF p_action='save_published' THEN
    IF p_song_id IS NULL THEN
      INSERT INTO public.songs(title,artist,default_key,tempo,time_signature,country,youtube_id,language,pptx_url,tags,chordpro_content,slug,created_by,updated_by)
      VALUES(trim(p_payload->>'title'),p_payload->>'artist',p_payload->>'default_key',nullif(p_payload->>'tempo','')::int,p_payload->>'time_signature',
        p_payload->>'country',p_payload->>'youtube_id',p_payload->>'language',p_payload->>'pptx_url',v_tags,
        coalesce(p_payload->>'chordpro_content',''),public.gc_next_song_slug(p_payload->>'title'),v_actor,v_actor) RETURNING * INTO v_song;
    ELSE
      UPDATE public.songs SET title=trim(p_payload->>'title'),artist=p_payload->>'artist',default_key=p_payload->>'default_key',
        tempo=nullif(p_payload->>'tempo','')::int,time_signature=p_payload->>'time_signature',country=p_payload->>'country',youtube_id=p_payload->>'youtube_id',
        language=p_payload->>'language',pptx_url=p_payload->>'pptx_url',tags=v_tags,chordpro_content=coalesce(p_payload->>'chordpro_content',''),
        updated_by=v_actor WHERE id=p_song_id RETURNING * INTO v_song;
    END IF;
    v_result=jsonb_build_object('kind','published','row',to_jsonb(v_song));
  ELSIF p_action='delete' AND public.has_min_role('admin') THEN
    IF p_song_id IS NULL THEN RAISE EXCEPTION 'A song is required'; END IF;
    UPDATE public.songs SET is_deleted=true,updated_by=v_actor WHERE id=p_song_id;
    v_result=jsonb_build_object('kind','deleted');
  ELSIF p_action IN ('suggest','submit_draft','delete') THEN
    IF p_action='delete' AND p_song_id IS NULL THEN RAISE EXCEPTION 'A song is required'; END IF;
    INSERT INTO public.song_suggestions(song_id,personal_song_id,suggested_by,type,payload)
      VALUES(CASE WHEN p_action='submit_draft' THEN v_draft.source_song_id ELSE p_song_id END,
        CASE WHEN p_action='submit_draft' THEN v_draft.id ELSE NULL END,v_actor,
        CASE WHEN p_action='delete' THEN 'deletion' WHEN p_song_id IS NOT NULL OR (p_action='submit_draft' AND v_draft.source_song_id IS NOT NULL) THEN 'edit' ELSE 'addition' END,p_payload)
      RETURNING id INTO v_suggestion;
    IF p_action='submit_draft' THEN UPDATE public.personal_songs SET status='submitted' WHERE id=v_draft.id; END IF;
    v_result=jsonb_build_object('kind','suggestion','suggestionId',v_suggestion);
  END IF;
  INSERT INTO private.editor_operations(actor_id,operation_id,command,result) VALUES(v_actor,p_operation_id,v_command,v_result);
  RETURN v_result;
END $$;
REVOKE EXECUTE ON FUNCTION public.mutate_editor_song(uuid,text,uuid,uuid,jsonb,timestamptz) FROM PUBLIC,lvm_anon;
GRANT EXECUTE ON FUNCTION public.mutate_editor_song(uuid,text,uuid,uuid,jsonb,timestamptz) TO lvm_user;

DO $$ BEGIN
  IF to_regprocedure('private.review_song_suggestion_v1(uuid,text,text)') IS NULL THEN
    ALTER FUNCTION public.review_song_suggestion(uuid,text,text) SET SCHEMA private;
    ALTER FUNCTION private.review_song_suggestion(uuid,text,text) RENAME TO review_song_suggestion_v1;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION private.review_song_suggestion_v1(uuid,text,text) FROM PUBLIC,lvm_anon,lvm_user;
CREATE OR REPLACE FUNCTION public.review_song_suggestion(p_suggestion_id uuid,p_action text,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_suggestion public.song_suggestions%ROWTYPE; v_result jsonb;
BEGIN
  IF NOT public.has_min_role('editor') THEN RAISE insufficient_privilege USING MESSAGE='Only editors can review suggestions'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid review action'; END IF;
  SELECT * INTO v_suggestion FROM public.song_suggestions WHERE id=p_suggestion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suggestion not found'; END IF;
  IF v_suggestion.status='approved' AND p_action='approve' THEN
    RETURN jsonb_build_object('status','approved','song_id',v_suggestion.song_id);
  ELSIF v_suggestion.status='rejected' AND p_action='reject' AND v_suggestion.rejection_reason IS NOT DISTINCT FROM p_reason THEN
    RETURN jsonb_build_object('status','rejected');
  ELSIF v_suggestion.status<>'pending' THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='Suggestion already reviewed with a different decision';
  END IF;
  IF p_action='approve' AND v_suggestion.type IN ('edit','deletion') THEN
    PERFORM 1 FROM public.songs WHERE id=v_suggestion.song_id AND NOT is_deleted FOR UPDATE;
    IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Published song is no longer available'; END IF;
  END IF;
  v_result=private.review_song_suggestion_v1(p_suggestion_id,p_action,p_reason);
  IF p_action='approve' THEN UPDATE public.song_suggestions SET song_id=(v_result->>'song_id')::uuid WHERE id=p_suggestion_id; END IF;
  RETURN v_result;
END $$;
REVOKE EXECUTE ON FUNCTION public.review_song_suggestion(uuid,text,text) FROM PUBLIC,lvm_anon;
GRANT EXECUTE ON FUNCTION public.review_song_suggestion(uuid,text,text) TO lvm_user;
INSERT INTO private.migrations(version) VALUES('012_editor_transactions') ON CONFLICT DO NOTHING;
COMMIT;
