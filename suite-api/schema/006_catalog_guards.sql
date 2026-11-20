BEGIN;
ALTER POLICY users_read ON public.users USING(id=public.current_uid() OR public.has_min_role('admin'));
CREATE OR REPLACE FUNCTION private.guard_catalog_write() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF current_user='lvm_user' THEN
    IF TG_OP='INSERT' THEN
      NEW.created_by=public.current_uid(); NEW.updated_by=public.current_uid(); NEW.star_count=0;
      IF NEW.is_deleted AND NOT public.has_min_role('admin') THEN RAISE insufficient_privilege; END IF;
    ELSE
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.star_count IS DISTINCT FROM OLD.star_count THEN
        RAISE insufficient_privilege USING MESSAGE='Catalog identity and counters are managed by the server';
      END IF;
      IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted AND NOT public.has_min_role('admin') THEN
        RAISE insufficient_privilege USING MESSAGE='Only administrators can delete or restore catalog songs';
      END IF;
      NEW.updated_by=public.current_uid();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_catalog_write BEFORE INSERT OR UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION private.guard_catalog_write();
INSERT INTO private.migrations(version) VALUES('006_catalog_guards');
COMMIT;
