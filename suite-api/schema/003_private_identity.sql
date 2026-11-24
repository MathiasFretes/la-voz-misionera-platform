BEGIN;
ALTER TABLE private.credentials ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE private.credentials ALTER COLUMN password_hash DROP NOT NULL;
DO $$ BEGIN
  IF EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email') THEN
    INSERT INTO private.credentials(user_id,email)
      SELECT id,email FROM public.users ON CONFLICT(user_id) DO UPDATE SET email=excluded.email;
    ALTER TABLE public.users DROP COLUMN email;
  END IF;
END $$;
ALTER TABLE private.credentials ALTER COLUMN email SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credentials_email ON private.credentials(email);
INSERT INTO private.migrations(version) VALUES('003_private_identity') ON CONFLICT DO NOTHING;
COMMIT;
