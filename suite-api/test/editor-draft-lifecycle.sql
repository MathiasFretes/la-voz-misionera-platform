-- Isolated PostgreSQL lifecycle regression. All fixtures roll back.
BEGIN;
INSERT INTO public.users(id,role) VALUES
 ('00000000-0000-4000-9800-000000000001','user'),
 ('00000000-0000-4000-9800-000000000002','editor');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9800-000000000001"}',true);
SET LOCAL ROLE lvm_user;
DO $$ DECLARE
 draft jsonb; result jsonb; proposal uuid; second_proposal uuid; draft_id uuid;
 revision timestamptz; op uuid; list_id uuid; fresh uuid; command_result jsonb;
 body jsonb := '{"title":"Lifecycle QA","default_key":"G","tags":["QA"],"chordpro_content":"[G]Original"}';
 snapshot jsonb; action text;
BEGIN
 draft:=public.mutate_editor_song(gen_random_uuid(),'create_draft',NULL,NULL,body);
 draft_id:=(draft->'row'->>'id')::uuid;
 revision:=(draft->'row'->>'updated_at')::timestamptz;
 op:=gen_random_uuid();
 result:=public.mutate_editor_song(op,'submit_draft',NULL,draft_id,body,revision);
 proposal:=(result->>'suggestionId')::uuid;
 IF public.mutate_editor_song(op,'submit_draft',NULL,draft_id,body,revision) IS DISTINCT FROM result THEN RAISE EXCEPTION 'Submitted acknowledgement not replayable'; END IF;
 SELECT to_jsonb(p) INTO snapshot FROM public.personal_songs p WHERE id=draft_id;
 FOREACH action IN ARRAY ARRAY['save_draft','submit_draft','delete_draft'] LOOP
   BEGIN
     PERFORM public.mutate_editor_song(gen_random_uuid(),action,NULL,draft_id,jsonb_set(body,'{chordpro_content}','"[D]Forbidden"'),(snapshot->>'updated_at')::timestamptz);
     RAISE EXCEPTION 'Submitted draft accepted %',action;
   EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 END LOOP;
 IF (SELECT to_jsonb(p) FROM public.personal_songs p WHERE id=draft_id) IS DISTINCT FROM snapshot
   OR (SELECT payload FROM public.song_suggestions WHERE id=proposal) IS DISTINCT FROM body THEN RAISE EXCEPTION 'Submitted content changed'; END IF;
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9800-000000000002"}',true);
 PERFORM public.review_song_suggestion(proposal,'reject','Revise arrangement');
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9800-000000000001"}',true);
 SELECT to_jsonb(p) INTO snapshot FROM public.personal_songs p WHERE id=draft_id;
 IF snapshot->>'status'<>'draft' THEN RAISE EXCEPTION 'Rejection did not unlock draft'; END IF;
 BEGIN
   PERFORM public.mutate_editor_song(gen_random_uuid(),'delete_draft',NULL,draft_id,'{}',(snapshot->>'updated_at')::timestamptz);
   RAISE EXCEPTION 'Rejected history was deleted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 draft:=public.mutate_editor_song(gen_random_uuid(),'save_draft',NULL,draft_id,jsonb_set(body,'{chordpro_content}','"[C]Revised"'),(snapshot->>'updated_at')::timestamptz);
 IF (SELECT payload FROM public.song_suggestions WHERE id=proposal) IS DISTINCT FROM body THEN RAISE EXCEPTION 'Editing rejected draft rewrote historical proposal'; END IF;
 result:=public.mutate_editor_song(gen_random_uuid(),'submit_draft',NULL,draft_id,jsonb_set(body,'{chordpro_content}','"[C]Revised"'),(draft->'row'->>'updated_at')::timestamptz);
 second_proposal:=(result->>'suggestionId')::uuid;
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9800-000000000002"}',true);
 PERFORM public.review_song_suggestion(second_proposal,'approve');
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9800-000000000001"}',true);
 SELECT to_jsonb(p) INTO snapshot FROM public.personal_songs p WHERE id=draft_id;
 IF snapshot->>'status'<>'published' OR snapshot->>'published_song_id' IS NULL THEN RAISE EXCEPTION 'Approval did not link publication'; END IF;
 FOREACH action IN ARRAY ARRAY['save_draft','submit_draft','delete_draft'] LOOP
   BEGIN
     PERFORM public.mutate_editor_song(gen_random_uuid(),action,NULL,draft_id,body,(snapshot->>'updated_at')::timestamptz);
     RAISE EXCEPTION 'Published draft accepted %',action;
   EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 END LOOP;
 IF (SELECT count(*) FROM public.song_suggestions WHERE personal_song_id=draft_id)<>2
   OR (SELECT status FROM public.song_suggestions WHERE id=proposal)<>'rejected'
   OR (SELECT status FROM public.song_suggestions WHERE id=second_proposal)<>'approved'
   OR (SELECT to_jsonb(p) FROM public.personal_songs p WHERE id=draft_id) IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'Published lifecycle history changed'; END IF;

 -- A never-submitted draft with a repertoire link also cannot be deleted.
 draft:=public.mutate_editor_song(gen_random_uuid(),'create_draft',NULL,NULL,body);
 fresh:=(draft->'row'->>'id')::uuid;
 INSERT INTO public.setlists(owner_id,name) VALUES(public.current_uid(),'Lifecycle repertoire') RETURNING id INTO list_id;
 INSERT INTO public.setlist_songs(setlist_id,personal_song_id) VALUES(list_id,fresh);
 BEGIN
   PERFORM public.mutate_editor_song(gen_random_uuid(),'delete_draft',NULL,fresh,'{}',(draft->'row'->>'updated_at')::timestamptz);
   RAISE EXCEPTION 'Repertoire-linked draft was deleted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 IF (SELECT count(*) FROM public.setlist_songs WHERE personal_song_id=fresh)<>1 THEN RAISE EXCEPTION 'Repertoire link disappeared'; END IF;
 DELETE FROM public.setlist_songs WHERE setlist_id=list_id;
 op:=gen_random_uuid();
 command_result:=public.mutate_editor_song(op,'delete_draft',NULL,fresh,'{}',(draft->'row'->>'updated_at')::timestamptz);
 IF command_result->>'kind'<>'deleted' OR public.mutate_editor_song(op,'delete_draft',NULL,fresh,'{}',(draft->'row'->>'updated_at')::timestamptz) IS DISTINCT FROM command_result THEN RAISE EXCEPTION 'Fresh deletion not idempotent'; END IF;
 IF EXISTS(SELECT FROM public.personal_songs WHERE id=fresh) THEN RAISE EXCEPTION 'Unused draft remains'; END IF;
END $$;
RESET ROLE;
-- Retired/archived fixtures have no normal editing transition.
INSERT INTO public.personal_songs(owner_id,title,status) VALUES('00000000-0000-4000-9800-000000000001','Archived lifecycle QA','archived');
SET LOCAL ROLE lvm_user;
DO $$ DECLARE d public.personal_songs%ROWTYPE; action text; BEGIN
 SELECT * INTO d FROM public.personal_songs WHERE title='Archived lifecycle QA';
 FOREACH action IN ARRAY ARRAY['save_draft','submit_draft','delete_draft'] LOOP
   BEGIN
     PERFORM public.mutate_editor_song(gen_random_uuid(),action,NULL,d.id,'{"title":"Denied","default_key":"G","tags":["QA"]}',d.updated_at);
     RAISE EXCEPTION 'Archived draft accepted %',action;
   EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 END LOOP;
END $$;
RESET ROLE;
-- Constraint protection remains effective independently of RPC role checks.
DO $$ DECLARE d uuid; BEGIN
 SELECT personal_song_id INTO d FROM public.song_suggestions WHERE payload->>'title'='Lifecycle QA' LIMIT 1;
 BEGIN DELETE FROM public.personal_songs WHERE id=d; RAISE EXCEPTION 'History FK still cascades'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF EXISTS(SELECT FROM pg_constraint WHERE conrelid IN ('public.song_suggestions'::regclass,'public.setlist_songs'::regclass) AND confrelid='public.personal_songs'::regclass AND confdeltype<>'a') THEN RAISE EXCEPTION 'Personal draft dependency FK still cascades'; END IF;
END $$;
ROLLBACK;
