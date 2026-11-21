-- Run only in an isolated test database after schema migrations. Rolled back below.
BEGIN;
INSERT INTO public.users(id,display_name,role) VALUES
 ('00000000-0000-4000-8000-000000000001','Planning admin','admin'),
 ('00000000-0000-4000-8000-000000000002','Planning leader','user'),
 ('00000000-0000-4000-8000-000000000003','Planning viewer','user');
INSERT INTO private.churches(id,name) VALUES
 ('00000000-0000-4000-8000-000000000011','Planning A'),
 ('00000000-0000-4000-8000-000000000012','Planning B');
INSERT INTO private.church_memberships(church_id,user_id,role,status) VALUES
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000002','leader','active'),
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000003','viewer','active');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002"}',true);
DO $$
DECLARE saved jsonb; draft jsonb:='{"id":"plan-a","venue":"Central","service":{"id":"plan-a","schemaVersion":"0.1","items":[]}}';
BEGIN
  saved:=public.save_service_plan('00000000-0000-4000-8000-000000000011','plan-a',draft,0,false);
  IF saved->>'revision'<>'1' THEN RAISE EXCEPTION 'Expected revision 1'; END IF;
  BEGIN
    PERFORM public.save_service_plan('00000000-0000-4000-8000-000000000011','plan-a',draft,0,false);
    RAISE EXCEPTION 'Expected conflict';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN
    PERFORM public.list_service_plans('00000000-0000-4000-8000-000000000012');
    RAISE EXCEPTION 'Expected church isolation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_service_plan('00000000-0000-4000-8000-000000000012','plan-a',draft,0,false);
    RAISE EXCEPTION 'Expected cross-church write rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.list_service_plans('00000000-0000-4000-8000-000000000011'))<>1 THEN
    RAISE EXCEPTION 'Viewer must be able to read'; END IF;
  BEGIN
    PERFORM public.save_service_plan('00000000-0000-4000-8000-000000000011','plan-a',NULL,1,true);
    RAISE EXCEPTION 'Expected read-only membership';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE private.church_memberships SET status='suspended' WHERE user_id='00000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.list_service_plans('00000000-0000-4000-8000-000000000011');
    RAISE EXCEPTION 'Expected membership revocation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE private.church_memberships SET status='active' WHERE user_id='00000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  PERFORM public.save_service_plan('00000000-0000-4000-8000-000000000011','plan-a',NULL,1,true);
  IF EXISTS(SELECT FROM public.list_service_plans('00000000-0000-4000-8000-000000000011')) THEN
    RAISE EXCEPTION 'Deleted services must not appear in list'; END IF;
  BEGIN
    PERFORM public.save_service_plan('00000000-0000-4000-8000-000000000011','plan-a','{"id":"plan-a","service":{"id":"plan-a"}}',2,false);
    RAISE EXCEPTION 'Stale offline data must not resurrect a tombstone';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  IF (SELECT count(*) FROM private.service_plan_history WHERE service_id='plan-a')<>2 THEN
    RAISE EXCEPTION 'Expected immutable revision history'; END IF;
END $$;
UPDATE private.churches SET status='suspended' WHERE id='00000000-0000-4000-8000-000000000011';
DO $$ BEGIN
  BEGIN
    PERFORM public.list_service_plans('00000000-0000-4000-8000-000000000011');
    RAISE EXCEPTION 'Expected church revocation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
