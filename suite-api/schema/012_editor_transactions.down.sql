-- Schema rollback only; operation receipts and audit history are retained.
-- Roll back the web client together with the API allowlist before using this.
BEGIN;
DROP FUNCTION IF EXISTS public.mutate_editor_song(uuid,text,uuid,uuid,jsonb,timestamptz);
DROP TRIGGER IF EXISTS audit_editor_song ON public.songs;
DROP TRIGGER IF EXISTS audit_editor_suggestion ON public.song_suggestions;
DROP FUNCTION IF EXISTS private.audit_editor_write();
GRANT INSERT ON public.editor_audit_log TO lvm_user;
DROP POLICY IF EXISTS audit_insert ON public.editor_audit_log;
CREATE POLICY audit_insert ON public.editor_audit_log FOR INSERT TO lvm_user WITH CHECK(actor_id=public.current_uid());
DELETE FROM private.migrations WHERE version='012_editor_transactions';
COMMIT;
