BEGIN;
-- Organization data is private. Clients only receive explicitly scoped RPC results.
CREATE TABLE private.churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.church_memberships (
  church_id uuid NOT NULL REFERENCES private.churches ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('admin','leader','member','viewer')),
  status text NOT NULL CHECK(status IN ('active','suspended')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(church_id,user_id)
);
CREATE INDEX memberships_by_user ON private.church_memberships(user_id);
CREATE TABLE private.identity_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES public.users ON DELETE SET NULL,
  church_id uuid NOT NULL REFERENCES private.churches ON DELETE CASCADE,
  user_id uuid REFERENCES public.users ON DELETE SET NULL,
  action text NOT NULL, before_data jsonb, after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.churches,private.church_memberships,private.identity_audit FROM PUBLIC,lvm_anon,lvm_user,lvm_api;

CREATE FUNCTION private.church_capabilities(member_role text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE member_role
    WHEN 'admin' THEN ARRAY['church:read','members:read','members:manage','planning:read','planning:write','worship:prepare']
    WHEN 'leader' THEN ARRAY['church:read','members:read','planning:read','planning:write','worship:prepare']
    WHEN 'member' THEN ARRAY['church:read','planning:read','worship:prepare']
    WHEN 'viewer' THEN ARRAY['church:read','planning:read']
    ELSE ARRAY[]::text[] END
$$;
REVOKE ALL ON FUNCTION private.church_capabilities(text) FROM PUBLIC;

CREATE FUNCTION private.identity_memberships(target_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'church_id',c.id,'church_name',c.name,'church_status',c.status,
    'role',m.role,'status',m.status,'revision',m.revision,
    'capabilities',CASE WHEN c.status='active' AND m.status='active'
      THEN private.church_capabilities(m.role) ELSE ARRAY[]::text[] END
  ) ORDER BY c.name,c.id),'[]'::jsonb)
  FROM private.church_memberships m JOIN private.churches c ON c.id=m.church_id
  WHERE m.user_id=target_user
$$;
REVOKE ALL ON FUNCTION private.identity_memberships(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.identity_memberships(uuid) TO lvm_api;

CREATE FUNCTION public.my_church_memberships() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF public.current_uid() IS NULL THEN RAISE insufficient_privilege; END IF;
  RETURN private.identity_memberships(public.current_uid());
END $$;

CREATE FUNCTION public.list_churches()
RETURNS SETOF private.churches LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF public.current_uid() IS NULL THEN RAISE insufficient_privilege; END IF;
  RETURN QUERY SELECT c.* FROM private.churches c WHERE public.has_min_role('admin')
    OR (c.status='active' AND EXISTS(SELECT FROM private.church_memberships m
      WHERE m.church_id=c.id AND m.user_id=public.current_uid() AND m.status='active'))
    ORDER BY c.name,c.id;
END $$;

CREATE FUNCTION public.save_church(p_id uuid,p_name text,p_status text,p_expected_revision integer)
RETURNS SETOF private.churches LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row private.churches; saved private.churches;
BEGIN
  IF NOT public.has_min_role('admin') THEN RAISE insufficient_privilege; END IF;
  IF p_id IS NULL OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 160
    OR p_status IS NULL OR p_status NOT IN ('active','suspended')
    OR p_expected_revision IS NULL OR p_expected_revision<0 THEN
    RAISE EXCEPTION 'Datos de iglesia inválidos' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('church:'||p_id::text,0));
  SELECT * INTO old_row FROM private.churches WHERE id=p_id FOR UPDATE;
  IF coalesce(old_row.revision,0)<>p_expected_revision THEN
    RAISE EXCEPTION 'La iglesia cambió en otra sesión. Actualizá antes de guardar.' USING ERRCODE='PT409';
  END IF;
  INSERT INTO private.churches(id,name,status) VALUES(p_id,btrim(p_name),p_status)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,
      revision=private.churches.revision+1,updated_at=now() RETURNING * INTO saved;
  INSERT INTO private.identity_audit(actor_id,church_id,action,before_data,after_data)
    VALUES(public.current_uid(),p_id,'church.save',to_jsonb(old_row),to_jsonb(saved));
  RETURN NEXT saved;
END $$;

CREATE FUNCTION public.list_church_memberships(p_church_id uuid)
RETURNS TABLE(user_id uuid,display_name text,role text,status text,revision integer,updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.has_min_role('admin') AND NOT EXISTS(
    SELECT FROM private.church_memberships m JOIN private.churches c ON c.id=m.church_id
    WHERE c.id=p_church_id AND c.status='active' AND m.user_id=public.current_uid()
      AND m.status='active' AND m.role IN ('admin','leader')
  ) THEN RAISE insufficient_privilege; END IF;
  RETURN QUERY SELECT m.user_id,u.display_name,m.role,m.status,m.revision,m.updated_at
    FROM private.church_memberships m JOIN public.users u ON u.id=m.user_id
    WHERE m.church_id=p_church_id ORDER BY u.display_name,m.user_id;
END $$;

CREATE FUNCTION public.save_church_membership(p_church_id uuid,p_user_id uuid,p_role text,p_status text,p_expected_revision integer)
RETURNS SETOF private.church_memberships LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE church private.churches; old_row private.church_memberships; saved private.church_memberships; global_admin boolean;
BEGIN
  -- A shared church lock serializes assignment, revocation and church suspension.
  SELECT * INTO church FROM private.churches WHERE id=p_church_id FOR UPDATE;
  global_admin:=public.has_min_role('admin');
  IF church.id IS NULL OR (NOT global_admin AND NOT EXISTS(
    SELECT FROM private.church_memberships m WHERE m.church_id=p_church_id
      AND m.user_id=public.current_uid() AND m.status='active' AND m.role='admin' AND church.status='active'
  )) THEN RAISE insufficient_privilege; END IF;
  SELECT * INTO old_row FROM private.church_memberships WHERE church_id=p_church_id AND user_id=p_user_id;
  -- Only global administration may appoint or change church administrators.
  IF NOT global_admin AND (p_role='admin' OR old_row.role='admin') THEN RAISE insufficient_privilege; END IF;
  IF p_user_id IS NULL OR p_role IS NULL OR p_role NOT IN ('admin','leader','member','viewer')
    OR p_status IS NULL OR p_status NOT IN ('active','suspended')
    OR p_expected_revision IS NULL OR p_expected_revision<0 THEN
    RAISE EXCEPTION 'Datos de membresía inválidos' USING ERRCODE='22023';
  END IF;
  IF coalesce(old_row.revision,0)<>p_expected_revision THEN
    RAISE EXCEPTION 'La membresía cambió en otra sesión. Actualizá antes de guardar.' USING ERRCODE='PT409';
  END IF;
  IF old_row.role='admin' AND old_row.status='active' AND (p_role<>'admin' OR p_status<>'active')
    AND NOT EXISTS(SELECT FROM private.church_memberships m WHERE m.church_id=p_church_id
      AND m.role='admin' AND m.status='active' AND m.user_id<>p_user_id) THEN
    RAISE EXCEPTION 'Asigná otro administrador antes de quitar al último.' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.church_memberships(church_id,user_id,role,status) VALUES(p_church_id,p_user_id,p_role,p_status)
    ON CONFLICT(church_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status,
      revision=private.church_memberships.revision+1,updated_at=now() RETURNING * INTO saved;
  INSERT INTO private.identity_audit(actor_id,church_id,user_id,action,before_data,after_data)
    VALUES(public.current_uid(),p_church_id,p_user_id,'membership.save',to_jsonb(old_row),to_jsonb(saved));
  RETURN NEXT saved;
END $$;

REVOKE EXECUTE ON FUNCTION public.my_church_memberships(),public.list_churches(),public.save_church(uuid,text,text,integer),
  public.list_church_memberships(uuid),public.save_church_membership(uuid,uuid,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_church_memberships(),public.list_churches(),public.save_church(uuid,text,text,integer),
  public.list_church_memberships(uuid),public.save_church_membership(uuid,uuid,text,text,integer) TO lvm_user;
INSERT INTO private.migrations(version) VALUES('008_church_identity');
NOTIFY pgrst,'reload schema';
COMMIT;
