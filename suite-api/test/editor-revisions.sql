-- Ordinary regression suite for the isolated CI database. Fixtures roll back.
BEGIN;
INSERT INTO public.users(id,role) VALUES
 ('00000000-0000-4000-9700-000000000001','editor'),
 ('00000000-0000-4000-9700-000000000002','admin');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9700-000000000001"}',true);
SET LOCAL ROLE lvm_user;
DO $$ BEGIN
  BEGIN INSERT INTO public.songs(title,slug) VALUES('Denied direct write','denied_direct'); RAISE EXCEPTION 'Direct song insert remains open'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.songs SET title='Denied' WHERE false; RAISE EXCEPTION 'Direct song update remains open'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.song_suggestions(suggested_by,type,payload) VALUES(public.current_uid(),'addition','{}'); RAISE EXCEPTION 'Direct proposal insert remains open'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.personal_songs(owner_id,title) VALUES(public.current_uid(),'Denied'); RAISE EXCEPTION 'Direct draft insert remains open'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ DECLARE saved jsonb; first_revision timestamptz; next_revision timestamptz; proposal jsonb; pending uuid; draft jsonb; body jsonb := '{"title":"Revision QA","default_key":"G","tags":["QA"],"chordpro_content":"[G]Original"}'; BEGIN
  IF has_table_privilege('lvm_user','public.songs','INSERT') OR has_table_privilege('lvm_user','public.songs','UPDATE')
    OR has_table_privilege('lvm_user','public.song_suggestions','INSERT') OR has_table_privilege('lvm_user','public.personal_songs','UPDATE')
    OR has_table_privilege('lvm_user','public.editor_audit_log','INSERT') THEN RAISE EXCEPTION 'Protected direct write grant remains'; END IF;
  saved:=public.mutate_editor_song(gen_random_uuid(),'save_published',NULL,NULL,body);
  first_revision:=(saved->'row'->>'updated_at')::timestamptz;
  INSERT INTO public.user_starred_songs(user_id,song_id) VALUES(public.current_uid(),(saved->'row'->>'id')::uuid);
  IF (SELECT updated_at FROM public.songs WHERE id=(saved->'row'->>'id')::uuid) IS DISTINCT FROM first_revision THEN RAISE EXCEPTION 'Favorite counter invalidated an unchanged musical revision'; END IF;
  BEGIN
    PERFORM public.mutate_editor_song(gen_random_uuid(),'save_published',(saved->'row'->>'id')::uuid,NULL,body,NULL);
    RAISE EXCEPTION 'Existing song accepted missing revision';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN
    PERFORM public.mutate_editor_song(gen_random_uuid(),'delete',(saved->'row'->>'id')::uuid,NULL,'{}',NULL);
    RAISE EXCEPTION 'Deletion accepted missing revision';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN
    PERFORM public.mutate_editor_song(gen_random_uuid(),'suggest',(saved->'row'->>'id')::uuid,NULL,body,NULL);
    RAISE EXCEPTION 'Edit proposal accepted missing revision';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  proposal:=public.mutate_editor_song(gen_random_uuid(),'suggest',(saved->'row'->>'id')::uuid,NULL,body,first_revision);
  pending:=(proposal->>'suggestionId')::uuid;
  saved:=public.mutate_editor_song(gen_random_uuid(),'save_published',(saved->'row'->>'id')::uuid,NULL,jsonb_set(body,'{chordpro_content}','"[D]Newer version"'),first_revision);
  next_revision:=(saved->'row'->>'updated_at')::timestamptz;
  IF next_revision<=first_revision THEN RAISE EXCEPTION 'Revision did not advance inside the same transaction'; END IF;
  BEGIN
    PERFORM public.review_song_suggestion(pending,'approve');
    RAISE EXCEPTION 'Old proposal replaced a newer song';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  IF (SELECT chordpro_content FROM public.songs WHERE id=(saved->'row'->>'id')::uuid)<>'[D]Newer version' THEN RAISE EXCEPTION 'Conflict changed published content'; END IF;
  IF (SELECT status FROM public.song_suggestions WHERE id=pending)<>'pending' THEN RAISE EXCEPTION 'Conflict consumed proposal'; END IF;
  BEGIN
    PERFORM public.rebase_song_suggestion(pending,first_revision);
    RAISE EXCEPTION 'Rebase accepted an outdated comparison';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  PERFORM public.rebase_song_suggestion(pending,next_revision);
  PERFORM public.rebase_song_suggestion(pending,next_revision);
  IF (SELECT count(*) FROM public.editor_audit_log WHERE action='proposal_rebased' AND payload_snapshot->>'suggestion_id'=pending::text)<>1 THEN RAISE EXCEPTION 'Rebase audit missing or duplicated'; END IF;
  PERFORM public.review_song_suggestion(pending,'approve');
  SELECT updated_at INTO next_revision FROM public.songs WHERE id=(saved->'row'->>'id')::uuid;

  -- An older pending proposal is preserved but cannot silently acquire a current base.
  INSERT INTO public.song_suggestions(song_id,suggested_by,type,payload)
    VALUES((saved->'row'->>'id')::uuid,public.current_uid(),'edit',body) RETURNING id INTO pending;
  BEGIN
    PERFORM public.review_song_suggestion(pending,'approve');
    RAISE EXCEPTION 'Legacy proposal without base was approved';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  PERFORM public.rebase_song_suggestion(pending,next_revision);
  PERFORM public.review_song_suggestion(pending,'reject','Retained for revision');

  draft:=public.mutate_editor_song(gen_random_uuid(),'create_draft',NULL,NULL,body);
  BEGIN
    PERFORM public.mutate_editor_song(gen_random_uuid(),'save_draft',NULL,(draft->'row'->>'id')::uuid,body,NULL);
    RAISE EXCEPTION 'Draft accepted missing revision';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN
    PERFORM public.mutate_editor_song(gen_random_uuid(),'submit_draft',NULL,(draft->'row'->>'id')::uuid,body,NULL);
    RAISE EXCEPTION 'Draft submission accepted missing revision';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  PERFORM public.mutate_editor_song(gen_random_uuid(),'save_draft',NULL,(draft->'row'->>'id')::uuid,body,(draft->'row'->>'updated_at')::timestamptz);

  -- PPTX metadata uses the same transaction/CAS without changing the chart.
  saved:=public.mutate_editor_song(gen_random_uuid(),'update_pptx',(saved->'row'->>'id')::uuid,NULL,'{"pptx_url":"https://example.invalid/qa.pptx"}',next_revision);
  IF saved->'row'->>'chordpro_content'<>body->>'chordpro_content' OR saved->'row'->>'pptx_url'<>'https://example.invalid/qa.pptx' THEN RAISE EXCEPTION 'Presentation update changed other song data'; END IF;
  BEGIN
    PERFORM public.mutate_editor_song(gen_random_uuid(),'update_pptx',(saved->'row'->>'id')::uuid,NULL,'{"pptx_url":null}',(saved->'row'->>'updated_at')::timestamptz);
    RAISE EXCEPTION 'Editor removed a presentation without administrator rights';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9700-000000000002"}',true);
DO $$ DECLARE song public.songs%ROWTYPE; result jsonb; BEGIN
 SELECT * INTO song FROM public.songs WHERE title='Revision QA';
 result:=public.mutate_editor_song(gen_random_uuid(),'update_pptx',song.id,NULL,'{"pptx_url":null}',song.updated_at);
 IF result->'row'->>'pptx_url' IS NOT NULL OR result->'row'->>'chordpro_content'<>'[G]Original' THEN RAISE EXCEPTION 'Administrator presentation removal changed chart'; END IF;
END $$;
ROLLBACK;
