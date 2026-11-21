BEGIN;
INSERT INTO public.users(id,display_name,role) VALUES
 ('00000000-0000-4000-8000-000000000001','Worship planner','admin'),
 ('00000000-0000-4000-8000-000000000002','Worship musician','user'),
 ('00000000-0000-4000-8000-000000000003','Worship viewer','user');
INSERT INTO private.churches(id,name) VALUES
 ('00000000-0000-4000-8000-000000000011','Exchange A'),('00000000-0000-4000-8000-000000000012','Exchange B');
INSERT INTO private.church_memberships(church_id,user_id,role,status) VALUES
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000002','member','active'),
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000003','viewer','active');
CREATE TEMP TABLE exchange_fixture(plan jsonb);
INSERT INTO exchange_fixture VALUES ('{"schemaVersion":"0.1","serviceId":"service-a","setlistId":"set-a","name":"Adoración","songs":[{"songId":"song-a","title":"Fiel","key":"G","arrangement":[1],"sections":[{"kind":"verse","label":"Verso","lines":[{"text":"Fiel","chords":[{"symbol":"G","index":0}]}]}]},{"songId":"song-a","title":"Fiel","key":"A","arrangement":[1],"sections":[{"kind":"verse","label":"Verso","lines":[{"text":"Fiel","chords":[{"symbol":"A","index":0}]}]}]}]}');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT public.save_service_plan('00000000-0000-4000-8000-000000000011','service-a',
 '{"id":"service-a","venue":"Central","worshipAfterItemId":"welcome","service":{"schemaVersion":"0.1","id":"service-a","title":"Culto","startsAt":"2026-12-01T12:00:00Z","setlist":{"id":"set-a","name":"Adoración"},"items":[{"id":"welcome","kind":"ANNOUNCEMENT","announcement":{"title":"Bienvenida","body":"Bienvenidos"}},{"id":"sermon","kind":"SERMON","sermon":{"title":"Mensaje","body":"Texto"}}]}}',0,false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002"}',true);
DO $$ DECLARE result jsonb; again jsonb;
BEGIN
  result:=public.get_worship_exchange('00000000-0000-4000-8000-000000000011','service-a');
  IF result->'context'->>'title'<>'Culto' OR result->>'canPrepare'<>'true' OR result->>'canApply'<>'false' OR result->>'revision'<>'0' OR result ? 'record' THEN
    RAISE EXCEPTION 'Musician context or capability boundary failed'; END IF;
  BEGIN
    PERFORM public.get_worship_exchange('00000000-0000-4000-8000-000000000012','service-a');
    RAISE EXCEPTION 'Cross-church context leaked';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  result:=public.save_worship_plan('00000000-0000-4000-8000-000000000011','service-a',(SELECT plan FROM exchange_fixture),0,1,'00000000-0000-4000-8000-000000000099');
  again:=public.save_worship_plan('00000000-0000-4000-8000-000000000011','service-a',(SELECT plan FROM exchange_fixture),0,1,'00000000-0000-4000-8000-000000000099');
  IF result IS DISTINCT FROM again OR (SELECT count(*) FROM private.worship_plan_history)<>1 THEN RAISE EXCEPTION 'Submission replay duplicated the proposal'; END IF;
  BEGIN
    PERFORM public.apply_worship_plan('00000000-0000-4000-8000-000000000011','service-a',1,1,gen_random_uuid());
    RAISE EXCEPTION 'Musician changed the service order';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_worship_plan('00000000-0000-4000-8000-000000000011','service-a',(SELECT plan FROM exchange_fixture),0,1,gen_random_uuid());
    RAISE EXCEPTION 'Stale proposal overwrote newer proposal';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.save_worship_plan('00000000-0000-4000-8000-000000000011','service-a',(SELECT plan FROM exchange_fixture),1,1,gen_random_uuid());
    RAISE EXCEPTION 'Viewer submitted music';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
DO $$ DECLARE result jsonb; again jsonb; changed jsonb;
BEGIN
  result:=public.apply_worship_plan('00000000-0000-4000-8000-000000000011','service-a',1,1,'00000000-0000-4000-8000-000000000098');
  again:=public.apply_worship_plan('00000000-0000-4000-8000-000000000011','service-a',1,1,'00000000-0000-4000-8000-000000000098');
  IF result IS DISTINCT FROM again OR result->>'revision'<>'2' OR jsonb_array_length(result->'service'->'items')<>4
    OR result->'service'->'items'->0->>'id'<>'welcome' OR result->'service'->'items'->3->>'id'<>'sermon'
    OR result->'service'->'items'->1->>'id'<>'lvm-worship:service-a:1'
    OR result->'service'->'items'->2->'song'->>'key'<>'A' THEN RAISE EXCEPTION 'Musical merge or idempotency failed'; END IF;
  IF result->'service'->'items'->0 IS DISTINCT FROM '{"id":"welcome","kind":"ANNOUNCEMENT","announcement":{"title":"Bienvenida","body":"Bienvenidos"}}'::jsonb
    OR result->'service'->'items'->3 IS DISTINCT FROM '{"id":"sermon","kind":"SERMON","sermon":{"title":"Mensaje","body":"Texto"}}'::jsonb THEN RAISE EXCEPTION 'Manual items were changed'; END IF;
  IF (SELECT count(*) FROM private.service_plan_history WHERE service_id='service-a')<>2 THEN RAISE EXCEPTION 'Apply replay wrote twice'; END IF;
  BEGIN
    PERFORM public.apply_worship_plan('00000000-0000-4000-8000-000000000011','service-a',1,2,gen_random_uuid());
    RAISE EXCEPTION 'A stale context was incorporated without review';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  changed:=jsonb_set((SELECT plan FROM exchange_fixture),'{songs,0,key}','"C"');
  PERFORM public.save_worship_plan('00000000-0000-4000-8000-000000000011','service-a',changed,1,2,gen_random_uuid());
  result:=public.apply_worship_plan('00000000-0000-4000-8000-000000000011','service-a',2,2,gen_random_uuid());
  IF jsonb_array_length(result->'service'->'items')<>4 OR result->'service'->'items'->1->'song'->>'key'<>'C' THEN RAISE EXCEPTION 'Replacement duplicated managed music'; END IF;
END $$;
UPDATE private.church_memberships SET status='suspended' WHERE user_id='00000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.save_worship_plan('00000000-0000-4000-8000-000000000011','service-a',(SELECT plan FROM exchange_fixture),0,1,'00000000-0000-4000-8000-000000000099');
    RAISE EXCEPTION 'Revoked musician replayed an acknowledged submission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
