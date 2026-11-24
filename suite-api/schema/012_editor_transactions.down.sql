-- Secure application rollback: retain schema, receipts and server audit; disable editor writes.
-- Older clients remain readable but cannot regain unsafe direct writes.
-- Resume only by explicitly reapplying the reviewed 012 migration and matching API/client.
BEGIN;
REVOKE INSERT,UPDATE,DELETE ON public.songs,public.song_suggestions,public.personal_songs,public.editor_audit_log FROM PUBLIC,lvm_anon,lvm_user;
REVOKE EXECUTE ON FUNCTION public.mutate_editor_song(uuid,text,uuid,uuid,jsonb,timestamptz) FROM PUBLIC,lvm_anon,lvm_user;
REVOKE EXECUTE ON FUNCTION public.review_song_suggestion(uuid,text,text) FROM PUBLIC,lvm_anon,lvm_user;
REVOKE EXECUTE ON FUNCTION public.rebase_song_suggestion(uuid,timestamptz) FROM PUBLIC,lvm_anon,lvm_user;
COMMIT;
