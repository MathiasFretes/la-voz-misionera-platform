BEGIN;
CREATE TABLE IF NOT EXISTS public.site_documents (
  collection text NOT NULL CHECK(collection IN ('eventos','predicas','pastores','ministerios','sedes','radios','redes','testimonios','celulas','serviceTimes','stats','contacto','heroSlides','valores','sermones','contenido')),
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  data jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<100000),
  published boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(collection,id)
);
ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_read ON public.site_documents FOR SELECT USING(published OR public.has_min_role('admin'));
CREATE POLICY site_write ON public.site_documents TO lvm_user USING(public.has_min_role('admin')) WITH CHECK(public.has_min_role('admin'));
GRANT SELECT ON public.site_documents TO lvm_anon,lvm_user;
GRANT INSERT,UPDATE,DELETE ON public.site_documents TO lvm_user;
CREATE TABLE IF NOT EXISTS private.site_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('contacto','oracion','visita','boletin')),
  payload jsonb NOT NULL CHECK(octet_length(payload::text)<12000), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON private.site_inbox TO lvm_api;
INSERT INTO private.migrations(version) VALUES('004_public_site');
COMMIT;
