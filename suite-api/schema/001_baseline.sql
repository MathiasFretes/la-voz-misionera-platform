-- Fresh PostgreSQL installation only. Historical Supabase migrations are not replayed.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='lvm_anon') THEN CREATE ROLE lvm_anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='lvm_user') THEN CREATE ROLE lvm_user NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='lvm_rest') THEN CREATE ROLE lvm_rest LOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='lvm_api') THEN CREATE ROLE lvm_api LOGIN; END IF;
END $$;
GRANT lvm_anon, lvm_user TO lvm_rest;
GRANT USAGE ON SCHEMA public TO lvm_anon, lvm_user;
CREATE TABLE IF NOT EXISTS private.migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL DEFAULT '', role text NOT NULL DEFAULT 'user' CHECK(role IN ('user','editor','admin','owner')),
  preferences jsonb NOT NULL DEFAULT '{}', account_created_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_one_owner ON public.users ((role)) WHERE role='owner';
CREATE TABLE IF NOT EXISTS private.credentials (
  user_id uuid PRIMARY KEY REFERENCES public.users ON DELETE CASCADE,
  email text NOT NULL UNIQUE, password_hash text
);
CREATE TABLE IF NOT EXISTS private.auth_sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_user ON private.auth_sessions(user_id);
CREATE TABLE IF NOT EXISTS private.activation_tokens (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE TABLE IF NOT EXISTS public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, title text NOT NULL,
  artist text, default_key text, tempo integer, time_signature text, tags text[] NOT NULL DEFAULT '{}',
  country text, youtube_id text, source_filename text, chordpro_content text NOT NULL DEFAULT '',
  star_count integer NOT NULL DEFAULT 0, song_group_id uuid, pptx_url text, mp3_url text,
  language text, search_titles text[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'published',
  is_deleted boolean NOT NULL DEFAULT false, created_by uuid REFERENCES public.users ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.personal_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
  slug text, title text NOT NULL, artist text, default_key text, tempo integer, time_signature text,
  tags text[] NOT NULL DEFAULT '{}', country text, youtube_id text, language text, pptx_url text, mp3_url text,
  chordpro_content text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','submitted','published','archived')),
  source_song_id uuid REFERENCES public.songs ON DELETE SET NULL,
  published_song_id uuid REFERENCES public.songs ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,slug)
);
CREATE TABLE IF NOT EXISTS public.setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
  name text NOT NULL, service_date date, team_id uuid CHECK(team_id IS NULL), edit_mode text NOT NULL DEFAULT 'suggest',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.setlist_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setlist_id uuid NOT NULL REFERENCES public.setlists ON DELETE CASCADE,
  song_id uuid REFERENCES public.songs ON DELETE CASCADE,
  personal_song_id uuid REFERENCES public.personal_songs ON DELETE CASCADE,
  verse_ref text, position integer NOT NULL DEFAULT 0, key_override text, notes text,
  CHECK(num_nonnulls(song_id,personal_song_id,verse_ref)=1)
);
CREATE TABLE IF NOT EXISTS public.user_starred_songs (
  user_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE, song_id uuid NOT NULL REFERENCES public.songs ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,song_id)
);
CREATE TABLE IF NOT EXISTS public.reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
  reflection_date date NOT NULL, content_key text, visibility text NOT NULL DEFAULT 'private' CHECK(visibility='private'),
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,reflection_date,visibility)
);
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), controller_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
  setlist_id uuid REFERENCES public.setlists ON DELETE SET NULL,
  code text NOT NULL UNIQUE, chord_code text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'live' CHECK(status IN ('live','ended')),
  items jsonb NOT NULL DEFAULT '[]', current_item_uid text, transpose integer NOT NULL DEFAULT 0, current_key text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_active_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.song_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), song_id uuid REFERENCES public.songs ON DELETE SET NULL,
  personal_song_id uuid REFERENCES public.personal_songs ON DELETE CASCADE,
  suggested_by uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
  type text NOT NULL CHECK(type IN ('addition','edit','deletion')), payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES public.users ON DELETE SET NULL, reviewed_at timestamptz, rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.editor_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES public.users ON DELETE SET NULL,
  action text NOT NULL, song_id uuid REFERENCES public.songs ON DELETE SET NULL, song_slug text, song_title text,
  payload_snapshot jsonb, note text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.current_uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid
$$;
CREATE OR REPLACE FUNCTION public.has_min_role(min_role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce((SELECT array_position(ARRAY['user','editor','admin','owner'], role) >=
    array_position(ARRAY['user','editor','admin','owner'],min_role) FROM public.users WHERE id=public.current_uid()),false)
$$;
CREATE OR REPLACE FUNCTION private.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','songs','personal_songs','setlists','reflections','sessions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON public.%I',t);
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['users','songs','personal_songs','setlists','setlist_songs','user_starred_songs','reflections','sessions','song_suggestions','editor_audit_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;
CREATE POLICY users_read ON public.users FOR SELECT TO lvm_user USING(id=public.current_uid() OR public.has_min_role('admin'));
CREATE POLICY users_update ON public.users FOR UPDATE TO lvm_user USING(id=public.current_uid()) WITH CHECK(id=public.current_uid());
GRANT SELECT ON public.users TO lvm_user;
GRANT UPDATE(display_name,preferences) ON public.users TO lvm_user;
CREATE POLICY songs_read ON public.songs FOR SELECT USING(NOT is_deleted OR public.has_min_role('editor'));
CREATE POLICY songs_insert ON public.songs FOR INSERT TO lvm_user WITH CHECK(public.has_min_role('editor'));
CREATE POLICY songs_update ON public.songs FOR UPDATE TO lvm_user USING(public.has_min_role('editor')) WITH CHECK(public.has_min_role('editor'));
GRANT SELECT ON public.songs TO lvm_anon,lvm_user;
GRANT INSERT,UPDATE ON public.songs TO lvm_user;
CREATE POLICY personal_owned ON public.personal_songs TO lvm_user USING(owner_id=public.current_uid()) WITH CHECK(owner_id=public.current_uid());
CREATE POLICY setlists_owned ON public.setlists TO lvm_user USING(owner_id=public.current_uid()) WITH CHECK(owner_id=public.current_uid());
CREATE POLICY entries_owned ON public.setlist_songs TO lvm_user
  USING(EXISTS(SELECT FROM public.setlists WHERE id=setlist_id AND owner_id=public.current_uid()))
  WITH CHECK(EXISTS(SELECT FROM public.setlists WHERE id=setlist_id AND owner_id=public.current_uid())
    AND (personal_song_id IS NULL OR EXISTS(SELECT FROM public.personal_songs WHERE id=personal_song_id AND owner_id=public.current_uid())));
CREATE POLICY stars_owned ON public.user_starred_songs TO lvm_user USING(user_id=public.current_uid()) WITH CHECK(user_id=public.current_uid());
CREATE POLICY reflections_owned ON public.reflections TO lvm_user USING(user_id=public.current_uid()) WITH CHECK(user_id=public.current_uid() AND visibility='private');
GRANT SELECT,INSERT,UPDATE,DELETE ON public.personal_songs,public.setlists,public.setlist_songs,public.reflections TO lvm_user;
GRANT SELECT,INSERT,DELETE ON public.user_starred_songs TO lvm_user;
CREATE POLICY sessions_read ON public.sessions FOR SELECT USING(controller_id=public.current_uid()
  OR code=(current_setting('request.jwt.claims',true)::jsonb->>'join_code')
  OR chord_code=(current_setting('request.jwt.claims',true)::jsonb->>'join_code'));
CREATE POLICY sessions_insert ON public.sessions FOR INSERT TO lvm_user WITH CHECK(controller_id=public.current_uid());
CREATE POLICY sessions_update ON public.sessions FOR UPDATE TO lvm_user USING(controller_id=public.current_uid()) WITH CHECK(controller_id=public.current_uid());
GRANT SELECT ON public.sessions TO lvm_anon,lvm_user;
GRANT INSERT,UPDATE ON public.sessions TO lvm_user;
CREATE POLICY suggestions_read ON public.song_suggestions FOR SELECT TO lvm_user USING(suggested_by=public.current_uid() OR public.has_min_role('editor'));
CREATE POLICY suggestions_insert ON public.song_suggestions FOR INSERT TO lvm_user WITH CHECK(suggested_by=public.current_uid() AND status='pending'
  AND (personal_song_id IS NULL OR EXISTS(SELECT FROM public.personal_songs WHERE id=personal_song_id AND owner_id=public.current_uid())));
GRANT SELECT,INSERT ON public.song_suggestions TO lvm_user;
CREATE POLICY audit_read ON public.editor_audit_log FOR SELECT TO lvm_user USING(public.has_min_role('admin'));
CREATE POLICY audit_insert ON public.editor_audit_log FOR INSERT TO lvm_user WITH CHECK(actor_id=public.current_uid());
GRANT SELECT,INSERT ON public.editor_audit_log TO lvm_user;
CREATE OR REPLACE FUNCTION private.update_star_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.songs SET star_count=(SELECT count(*) FROM public.user_starred_songs WHERE song_id=coalesce(NEW.song_id,OLD.song_id))
    WHERE id=coalesce(NEW.song_id,OLD.song_id);
  RETURN NULL;
END $$;
CREATE TRIGGER star_count AFTER INSERT OR DELETE ON public.user_starred_songs FOR EACH ROW EXECUTE FUNCTION private.update_star_count();
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid,new_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target_role text; BEGIN
  SELECT role INTO target_role FROM public.users WHERE id=target_user_id FOR UPDATE;
  IF NOT public.has_min_role('admin') OR target_user_id=public.current_uid() OR new_role NOT IN ('user','editor','admin') OR target_role='owner'
    OR (new_role='admin' AND NOT public.has_min_role('owner')) OR (target_role='admin' AND NOT public.has_min_role('owner')) THEN
    RAISE insufficient_privilege USING MESSAGE='Role change forbidden';
  END IF;
  UPDATE public.users SET role=new_role WHERE id=target_user_id;
END $$;
CREATE OR REPLACE FUNCTION public.delete_user() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF public.current_uid() IS NULL OR public.has_min_role('owner') THEN RAISE insufficient_privilege; END IF;
  DELETE FROM public.users WHERE id=public.current_uid();
END $$;
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.has_min_role('admin') OR target_user_id=public.current_uid()
    OR EXISTS(SELECT FROM public.users WHERE id=target_user_id AND (role='owner' OR (role='admin' AND NOT public.has_min_role('owner')))) THEN
    RAISE insufficient_privilege;
  END IF;
  DELETE FROM public.users WHERE id=target_user_id;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_uid(),public.has_min_role(text) TO lvm_anon,lvm_user;
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid,text),public.delete_user(),public.admin_delete_user(uuid) TO lvm_user;
GRANT USAGE ON SCHEMA private TO lvm_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.credentials,private.auth_sessions,private.activation_tokens TO lvm_api;
GRANT SELECT,INSERT ON public.users TO lvm_api;
GRANT UPDATE(display_name,preferences) ON public.users TO lvm_api;
-- API uses explicit identity-scoped SQL for authentication; data access uses RLS roles via PostgREST.
CREATE POLICY api_profiles_read ON public.users FOR SELECT TO lvm_api USING(true);
CREATE POLICY api_profiles_insert ON public.users FOR INSERT TO lvm_api WITH CHECK(role='user');
CREATE POLICY api_profiles_update ON public.users FOR UPDATE TO lvm_api USING(true) WITH CHECK(true);
INSERT INTO private.migrations(version) VALUES('001_baseline');
COMMIT;
