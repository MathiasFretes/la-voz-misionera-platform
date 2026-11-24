-- Isolated PostgreSQL acceptance; all fixtures and injected errors roll back.
BEGIN;
INSERT INTO public.users(id,display_name,role) VALUES
 ('00000000-0000-4000-9000-000000000001','Editor QA user','user'),
 ('00000000-0000-4000-9000-000000000002','Editor QA reviewer','editor'),
 ('00000000-0000-4000-9000-000000000003','Editor QA other','user');
CREATE TEMP TABLE editor_fixture(payload jsonb, draft_id uuid, song_id uuid, suggestion_id uuid, draft_revision timestamptz);
INSERT INTO editor_fixture VALUES ('{"title":"QA original","artist":"QA","default_key":"G","tags":["QA"],"chordpro_content":"{start_of_verse: Estrofa}\n[G]Prueba original [D]con acordes\n{end_of_verse}"}',NULL,NULL,NULL,NULL);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000001"}',true);
SET LOCAL ROLE lvm_user;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.editor_audit_log(actor_id,action) VALUES(public.current_uid(),'forged');
    RAISE EXCEPTION 'Audit must be server-only';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.mutate_editor_song(gen_random_uuid(),'save_published',NULL,NULL,'{"title":"Forged","default_key":"G","tags":["QA"]}');
    RAISE EXCEPTION 'Client publication action bypassed role';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ DECLARE first jsonb; again jsonb; BEGIN
  first:=public.mutate_editor_song('00000000-0000-4000-9000-000000000011','suggest',NULL,NULL,(SELECT payload FROM editor_fixture));
  again:=public.mutate_editor_song('00000000-0000-4000-9000-000000000011','suggest',NULL,NULL,(SELECT payload FROM editor_fixture));
  IF first IS DISTINCT FROM again THEN RAISE EXCEPTION 'Replay did not return the same proposal'; END IF;
  UPDATE editor_fixture SET suggestion_id=(first->>'suggestionId')::uuid;
  IF (SELECT count(*) FROM public.song_suggestions WHERE suggested_by=public.current_uid())<>1 THEN RAISE EXCEPTION 'Duplicate proposal'; END IF;
  BEGIN
    PERFORM public.mutate_editor_song('00000000-0000-4000-9000-000000000011','suggest',NULL,NULL,'{"title":"Changed","default_key":"G","tags":["QA"]}');
    RAISE EXCEPTION 'Changed replay must conflict';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN
    PERFORM public.review_song_suggestion((SELECT suggestion_id FROM editor_fixture),'approve');
    RAISE EXCEPTION 'Ordinary user reviewed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000002"}',true);
DO $$ DECLARE first jsonb; again jsonb; BEGIN
  first:=public.review_song_suggestion((SELECT suggestion_id FROM editor_fixture),'approve');
  again:=public.review_song_suggestion((SELECT suggestion_id FROM editor_fixture),'approve');
  IF first IS DISTINCT FROM again THEN RAISE EXCEPTION 'Approval replay duplicated publication'; END IF;
  UPDATE editor_fixture SET song_id=(first->>'song_id')::uuid;
  IF (SELECT chordpro_content FROM public.songs WHERE id=(SELECT song_id FROM editor_fixture)) IS DISTINCT FROM
    (SELECT payload->>'chordpro_content' FROM editor_fixture) THEN RAISE EXCEPTION 'Published ChordPro changed'; END IF;
  BEGIN
    PERFORM public.review_song_suggestion((SELECT suggestion_id FROM editor_fixture),'reject','different');
    RAISE EXCEPTION 'Opposite review did not conflict';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN
    PERFORM public.mutate_editor_song(gen_random_uuid(),'save_published',(SELECT song_id FROM editor_fixture),NULL,(SELECT payload FROM editor_fixture),'2000-01-01');
    RAISE EXCEPTION 'Stale revision overwrote song';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
END $$;

-- Force the audit INSERT to fail, then assert that the enclosing save did not persist.
CREATE FUNCTION private.qa_editor_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_AUDIT_FAULT'; END $$;
CREATE TRIGGER qa_editor_audit_fault BEFORE INSERT ON public.editor_audit_log FOR EACH ROW EXECUTE FUNCTION private.qa_editor_audit_fault();
DO $$ DECLARE before_count int; BEGIN
  SELECT count(*) INTO before_count FROM public.songs;
  BEGIN
    PERFORM public.mutate_editor_song('00000000-0000-4000-9000-000000000012','save_published',NULL,NULL,(SELECT payload FROM editor_fixture));
    RAISE EXCEPTION 'Audit failure did not abort save';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'QA_AUDIT_FAULT' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.songs)<>before_count THEN RAISE EXCEPTION 'Partial publication'; END IF;
  IF EXISTS(SELECT FROM private.editor_operations WHERE operation_id='00000000-0000-4000-9000-000000000012') THEN RAISE EXCEPTION 'Failed transaction retained receipt'; END IF;
END $$;
DROP TRIGGER qa_editor_audit_fault ON public.editor_audit_log;
DROP FUNCTION private.qa_editor_audit_fault();
DO $$ DECLARE first jsonb; again jsonb; BEGIN
  first:=public.mutate_editor_song('00000000-0000-4000-9000-000000000012','save_published',NULL,NULL,(SELECT payload FROM editor_fixture));
  again:=public.mutate_editor_song('00000000-0000-4000-9000-000000000012','save_published',NULL,NULL,(SELECT payload FROM editor_fixture));
  IF first IS DISTINCT FROM again THEN RAISE EXCEPTION 'Save retry duplicated'; END IF;
END $$;
INSERT INTO public.personal_songs(owner_id,title,default_key,tags,chordpro_content)
  VALUES('00000000-0000-4000-9000-000000000001','QA private draft','G',ARRAY['QA'],'[G]Private');
UPDATE editor_fixture SET draft_id=(SELECT id FROM public.personal_songs WHERE owner_id='00000000-0000-4000-9000-000000000001' AND title='QA private draft');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000003"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.mutate_editor_song(gen_random_uuid(),'save_draft',NULL,(SELECT draft_id FROM editor_fixture),(SELECT payload FROM editor_fixture),(SELECT updated_at FROM public.personal_songs WHERE id=(SELECT draft_id FROM editor_fixture)));
    RAISE EXCEPTION 'Cross-account draft overwritten';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE editor_fixture SET draft_revision=(SELECT updated_at FROM public.personal_songs WHERE id=(SELECT draft_id FROM editor_fixture));
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000001"}',true);
DO $$ DECLARE first jsonb; again jsonb; BEGIN
  first:=public.mutate_editor_song('00000000-0000-4000-9000-000000000013','submit_draft',NULL,(SELECT draft_id FROM editor_fixture),(SELECT payload FROM editor_fixture),(SELECT draft_revision FROM editor_fixture));
  again:=public.mutate_editor_song('00000000-0000-4000-9000-000000000013','submit_draft',NULL,(SELECT draft_id FROM editor_fixture),(SELECT payload FROM editor_fixture),(SELECT draft_revision FROM editor_fixture));
  IF first IS DISTINCT FROM again THEN RAISE EXCEPTION 'Draft submission duplicated'; END IF;
  IF (SELECT status FROM public.personal_songs WHERE id=(SELECT draft_id FROM editor_fixture))<>'submitted' THEN RAISE EXCEPTION 'Draft status missing'; END IF;
  UPDATE editor_fixture SET suggestion_id=(first->>'suggestionId')::uuid;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000002"}',true);
SELECT public.review_song_suggestion((SELECT suggestion_id FROM editor_fixture),'reject','QA rejection');
DO $$ BEGIN
  IF (SELECT status FROM public.personal_songs WHERE id=(SELECT draft_id FROM editor_fixture))<>'draft' THEN RAISE EXCEPTION 'Rejected draft not restored'; END IF;
END $$;
UPDATE public.users SET role='user' WHERE id='00000000-0000-4000-9000-000000000002';
DO $$ BEGIN
  BEGIN
    PERFORM public.mutate_editor_song('00000000-0000-4000-9000-000000000012','save_published',NULL,NULL,(SELECT payload FROM editor_fixture));
    RAISE EXCEPTION 'Revoked editor replayed publication';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
