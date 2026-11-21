BEGIN;
CREATE TABLE private.service_plans (
  church_id uuid NOT NULL REFERENCES private.churches ON DELETE CASCADE,
  id text NOT NULL CHECK(char_length(id) BETWEEN 1 AND 200),
  record jsonb NOT NULL CHECK(jsonb_typeof(record)='object' AND octet_length(record::text)<1000000),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  deleted boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.users ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(church_id,id)
);
CREATE TABLE private.service_plan_history (
  church_id uuid NOT NULL, service_id text NOT NULL, revision integer NOT NULL,
  actor_id uuid REFERENCES public.users ON DELETE SET NULL,
  record jsonb NOT NULL, deleted boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(church_id,service_id,revision),
  FOREIGN KEY(church_id,service_id) REFERENCES private.service_plans(church_id,id) ON DELETE CASCADE
);
REVOKE ALL ON private.service_plans,private.service_plan_history FROM PUBLIC,lvm_anon,lvm_user,lvm_api;
CREATE FUNCTION private.can_plan(target_church uuid,editing boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT FROM private.churches c WHERE c.id=target_church AND c.status='active'
    AND (public.has_min_role('admin') OR EXISTS(SELECT FROM private.church_memberships m
      WHERE m.church_id=c.id AND m.user_id=public.current_uid() AND m.status='active'
        AND (NOT editing OR m.role IN ('admin','leader')))))
$$;
REVOKE ALL ON FUNCTION private.can_plan(uuid,boolean) FROM PUBLIC;
CREATE FUNCTION public.list_service_plans(p_church_id uuid) RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT private.can_plan(p_church_id,false) THEN RAISE insufficient_privilege; END IF;
  RETURN QUERY SELECT record||jsonb_build_object('revision',revision) FROM private.service_plans
    WHERE church_id=p_church_id AND NOT deleted ORDER BY updated_at DESC,id;
END $$;
CREATE FUNCTION public.save_service_plan(p_church_id uuid,p_id text,p_record jsonb,p_expected_revision integer,p_deleted boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row private.service_plans; saved private.service_plans;
BEGIN
  -- Membership changes and church suspension take this same lock.
  PERFORM 1 FROM private.churches WHERE id=p_church_id FOR UPDATE;
  IF NOT private.can_plan(p_church_id,true) THEN RAISE insufficient_privilege; END IF;
  IF p_id IS NULL OR char_length(p_id) NOT BETWEEN 1 AND 200 OR p_expected_revision IS NULL
    OR p_expected_revision<0 OR p_deleted IS NULL THEN
    RAISE EXCEPTION 'Plan inválido' USING ERRCODE='22023';
  END IF;
  SELECT * INTO old_row FROM private.service_plans WHERE church_id=p_church_id AND id=p_id FOR UPDATE;
  IF coalesce(old_row.revision,0)<>p_expected_revision OR coalesce(old_row.deleted,false) THEN
    RAISE EXCEPTION 'El servicio cambió en otra sesión. Conservá tu copia y actualizá.' USING ERRCODE='PT409';
  END IF;
  IF p_deleted THEN
    IF old_row.id IS NULL THEN RAISE EXCEPTION 'El servicio no existe' USING ERRCODE='PT404'; END IF;
    p_record:=old_row.record;
  ELSIF p_record IS NULL OR jsonb_typeof(p_record)<>'object' OR p_record->>'id' IS DISTINCT FROM p_id
    OR jsonb_typeof(p_record->'service') IS DISTINCT FROM 'object' OR p_record->'service'->>'id' IS DISTINCT FROM p_id THEN
    RAISE EXCEPTION 'Plan inválido' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.service_plans(church_id,id,record,deleted,updated_by)
    VALUES(p_church_id,p_id,p_record-'revision',p_deleted,public.current_uid())
    ON CONFLICT(church_id,id) DO UPDATE SET record=excluded.record,deleted=excluded.deleted,
      revision=private.service_plans.revision+1,updated_by=excluded.updated_by,updated_at=now()
    RETURNING * INTO saved;
  INSERT INTO private.service_plan_history(church_id,service_id,revision,actor_id,record,deleted)
    VALUES(saved.church_id,saved.id,saved.revision,public.current_uid(),saved.record,saved.deleted);
  RETURN saved.record||jsonb_build_object('revision',saved.revision);
END $$;
REVOKE EXECUTE ON FUNCTION public.list_service_plans(uuid),public.save_service_plan(uuid,text,jsonb,integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_service_plans(uuid),public.save_service_plan(uuid,text,jsonb,integer,boolean) TO lvm_user;
INSERT INTO private.migrations(version) VALUES('010_church_planning');
NOTIFY pgrst,'reload schema';
COMMIT;
