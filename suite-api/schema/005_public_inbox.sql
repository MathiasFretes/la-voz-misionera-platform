BEGIN;
CREATE OR REPLACE FUNCTION public.list_site_inbox() RETURNS TABLE(id uuid,kind text,payload jsonb,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.has_min_role('admin') THEN RAISE insufficient_privilege; END IF;
  RETURN QUERY SELECT i.id,i.kind,i.payload,i.created_at FROM private.site_inbox i ORDER BY i.created_at DESC LIMIT 100;
END $$;
REVOKE EXECUTE ON FUNCTION public.list_site_inbox() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_site_inbox() TO lvm_user;
INSERT INTO private.migrations(version) VALUES('005_public_inbox');
COMMIT;
