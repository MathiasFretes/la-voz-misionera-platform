-- Run after the explicit 012 down script, in the disposable CI database only.
DO $$ BEGIN
  IF has_table_privilege('lvm_user','public.songs','INSERT') OR has_table_privilege('lvm_user','public.songs','UPDATE')
    OR has_table_privilege('lvm_user','public.song_suggestions','INSERT') OR has_table_privilege('lvm_user','public.editor_audit_log','INSERT')
    OR has_table_privilege('lvm_user','public.personal_songs','UPDATE') THEN RAISE EXCEPTION 'Rollback reopened protected writes'; END IF;
  IF has_function_privilege('lvm_user','public.mutate_editor_song(uuid,text,uuid,uuid,jsonb,timestamptz)','EXECUTE')
    OR has_function_privilege('lvm_user','public.review_song_suggestion(uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Read-only rollback permits mutations'; END IF;
  IF has_function_privilege('lvm_user','private.review_song_suggestion_v1(uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Legacy private review is callable'; END IF;
  IF NOT EXISTS(SELECT FROM pg_trigger WHERE tgname='audit_editor_song') OR to_regclass('private.editor_operations') IS NULL THEN RAISE EXCEPTION 'Rollback removed audit or receipts'; END IF;
END $$;
