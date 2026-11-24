BEGIN;
-- Account email addresses stay private; only global administration may list them.
CREATE FUNCTION public.list_suite_accounts()
RETURNS TABLE(id uuid,display_name text,email text,role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.has_min_role('admin') THEN RAISE insufficient_privilege; END IF;
  RETURN QUERY SELECT u.id,u.display_name,c.email,u.role FROM public.users u
    JOIN private.credentials c ON c.user_id=u.id ORDER BY u.account_created_at DESC,u.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.list_suite_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_suite_accounts() TO lvm_user;
INSERT INTO private.migrations(version) VALUES('009_account_directory');
NOTIFY pgrst,'reload schema';
COMMIT;
