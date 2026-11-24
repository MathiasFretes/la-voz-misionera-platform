BEGIN;
CREATE TABLE private.worship_plans (
  church_id uuid NOT NULL, service_id text NOT NULL,
  plan jsonb NOT NULL CHECK(jsonb_typeof(plan)='object' AND octet_length(plan::text)<800000),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  based_on_service_revision integer NOT NULL CHECK(based_on_service_revision>0),
  submitted_by uuid REFERENCES public.users ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  applied_plan_revision integer, applied_service_revision integer,
  PRIMARY KEY(church_id,service_id),
  FOREIGN KEY(church_id,service_id) REFERENCES private.service_plans(church_id,id) ON DELETE CASCADE
);
CREATE TABLE private.worship_plan_history (
  church_id uuid NOT NULL,service_id text NOT NULL,revision integer NOT NULL,
  plan jsonb NOT NULL,based_on_service_revision integer NOT NULL,
  actor_id uuid REFERENCES public.users ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(church_id,service_id,revision),
  FOREIGN KEY(church_id,service_id) REFERENCES private.worship_plans(church_id,service_id) ON DELETE CASCADE
);
REVOKE ALL ON private.worship_plans,private.worship_plan_history FROM PUBLIC,lvm_anon,lvm_user,lvm_api;
CREATE FUNCTION private.can_prepare_worship(target_church uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT FROM private.churches c WHERE c.id=target_church AND c.status='active'
    AND (public.has_min_role('admin') OR EXISTS(SELECT FROM private.church_memberships m
      WHERE m.church_id=c.id AND m.user_id=public.current_uid() AND m.status='active' AND m.role IN ('admin','leader','member'))))
$$;
REVOKE ALL ON FUNCTION private.can_prepare_worship(uuid) FROM PUBLIC;
CREATE FUNCTION public.get_worship_exchange(p_church_id uuid,p_service_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE service private.service_plans; proposal private.worship_plans;
BEGIN
  IF NOT private.can_plan(p_church_id,false) THEN RAISE insufficient_privilege; END IF;
  SELECT * INTO service FROM private.service_plans WHERE church_id=p_church_id AND id=p_service_id AND NOT deleted;
  IF NOT FOUND THEN RAISE EXCEPTION 'El culto no está disponible' USING ERRCODE='PT404'; END IF;
  SELECT * INTO proposal FROM private.worship_plans WHERE church_id=p_church_id AND service_id=p_service_id;
  RETURN jsonb_build_object('context',jsonb_build_object('schemaVersion','0.1','serviceId',service.id,
    'title',service.record->'service'->>'title','startsAt',service.record->'service'->>'startsAt',
    'setlistId',service.record->'service'->'setlist'->>'id','name',service.record->'service'->'setlist'->>'name'),
    'serviceRevision',service.revision,'plan',proposal.plan,'revision',coalesce(proposal.revision,0),
    'basedOnServiceRevision',proposal.based_on_service_revision,'appliedPlanRevision',proposal.applied_plan_revision,
    'appliedServiceRevision',proposal.applied_service_revision,'canPrepare',private.can_prepare_worship(p_church_id),
    'canApply',private.can_plan(p_church_id,true));
END $$;
CREATE FUNCTION public.save_worship_plan(p_church_id uuid,p_service_id text,p_plan jsonb,p_expected_revision integer,p_service_revision integer,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE service private.service_plans; proposal private.worship_plans; operation private.service_plan_operations; fingerprint jsonb; result jsonb;
BEGIN
  PERFORM 1 FROM private.churches WHERE id=p_church_id FOR UPDATE;
  IF NOT private.can_prepare_worship(p_church_id) THEN RAISE insufficient_privilege; END IF;
  IF p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 OR p_service_revision IS NULL OR p_service_revision<1
    OR p_plan IS NULL OR jsonb_typeof(p_plan)<>'object' OR p_plan->>'schemaVersion' IS DISTINCT FROM '0.1'
    OR p_plan->>'serviceId' IS DISTINCT FROM p_service_id OR jsonb_typeof(p_plan->'songs') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Propuesta musical inválida' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_plan->'songs') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Propuesta musical inválida' USING ERRCODE='22023'; END IF;
  fingerprint:=jsonb_build_object('kind','worship.submit','id',p_service_id,'plan',p_plan,'revision',p_expected_revision,'serviceRevision',p_service_revision);
  SELECT * INTO operation FROM private.service_plan_operations WHERE church_id=p_church_id AND operation_id=p_operation_id;
  IF FOUND THEN
    IF operation.actor_id IS DISTINCT FROM public.current_uid() OR operation.request IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION 'Identificador de operación reutilizado' USING ERRCODE='PT409'; END IF;
    RETURN operation.response;
  END IF;
  SELECT * INTO service FROM private.service_plans WHERE church_id=p_church_id AND id=p_service_id FOR UPDATE;
  IF NOT FOUND OR service.deleted THEN RAISE EXCEPTION 'El culto no está disponible' USING ERRCODE='PT404'; END IF;
  SELECT * INTO proposal FROM private.worship_plans WHERE church_id=p_church_id AND service_id=p_service_id FOR UPDATE;
  IF service.revision<>p_service_revision OR coalesce(proposal.revision,0)<>p_expected_revision THEN
    RAISE EXCEPTION 'El culto o repertorio cambió. Conservá tu copia y revisá la versión actual.' USING ERRCODE='PT409'; END IF;
  IF p_plan->>'setlistId' IS DISTINCT FROM service.record->'service'->'setlist'->>'id' THEN
    RAISE EXCEPTION 'El repertorio no corresponde al contexto del culto' USING ERRCODE='22023'; END IF;
  INSERT INTO private.worship_plans(church_id,service_id,plan,based_on_service_revision,submitted_by)
    VALUES(p_church_id,p_service_id,p_plan,p_service_revision,public.current_uid())
    ON CONFLICT(church_id,service_id) DO UPDATE SET plan=excluded.plan,based_on_service_revision=excluded.based_on_service_revision,
      revision=private.worship_plans.revision+1,submitted_by=excluded.submitted_by,updated_at=now() RETURNING * INTO proposal;
  INSERT INTO private.worship_plan_history(church_id,service_id,revision,plan,based_on_service_revision,actor_id)
    VALUES(p_church_id,p_service_id,proposal.revision,p_plan,p_service_revision,public.current_uid());
  result:=public.get_worship_exchange(p_church_id,p_service_id);
  INSERT INTO private.service_plan_operations(church_id,operation_id,actor_id,request,response)
    VALUES(p_church_id,p_operation_id,public.current_uid(),fingerprint,result);
  RETURN result;
END $$;
CREATE FUNCTION public.apply_worship_plan(p_church_id uuid,p_service_id text,p_plan_revision integer,p_service_revision integer,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE service private.service_plans; proposal private.worship_plans; operation private.service_plan_operations;
  fingerprint jsonb; result jsonb; songs jsonb; combined jsonb:='[]'; item jsonb; anchor text; inserted boolean:=false; prefix text; updated_record jsonb;
BEGIN
  PERFORM 1 FROM private.churches WHERE id=p_church_id FOR UPDATE;
  IF NOT private.can_plan(p_church_id,true) THEN RAISE insufficient_privilege; END IF;
  IF p_operation_id IS NULL OR p_plan_revision IS NULL OR p_plan_revision<1 OR p_service_revision IS NULL OR p_service_revision<1 THEN
    RAISE EXCEPTION 'Revisión musical inválida' USING ERRCODE='22023'; END IF;
  fingerprint:=jsonb_build_object('kind','worship.apply','id',p_service_id,'revision',p_plan_revision,'serviceRevision',p_service_revision);
  SELECT * INTO operation FROM private.service_plan_operations WHERE church_id=p_church_id AND operation_id=p_operation_id;
  IF FOUND THEN
    IF operation.actor_id IS DISTINCT FROM public.current_uid() OR operation.request IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION 'Identificador de operación reutilizado' USING ERRCODE='PT409'; END IF;
    RETURN operation.response;
  END IF;
  SELECT * INTO service FROM private.service_plans WHERE church_id=p_church_id AND id=p_service_id FOR UPDATE;
  IF NOT FOUND OR service.deleted THEN RAISE EXCEPTION 'El culto no está disponible' USING ERRCODE='PT404'; END IF;
  SELECT * INTO proposal FROM private.worship_plans WHERE church_id=p_church_id AND service_id=p_service_id FOR UPDATE;
  IF NOT FOUND OR service.revision<>p_service_revision OR proposal.revision<>p_plan_revision OR proposal.based_on_service_revision<>p_service_revision THEN
    RAISE EXCEPTION 'El culto o repertorio cambió. Revisá las versiones antes de incorporar la música.' USING ERRCODE='PT409'; END IF;
  prefix:='lvm-worship:'||p_service_id||':';
  SELECT jsonb_agg(jsonb_build_object('id',prefix||ordinal::text,'kind','SONG','song',jsonb_build_object(
    'id',song->>'songId','title',song->>'title','key',song->>'key','sections',song->'sections')) ORDER BY ordinal)
    INTO songs FROM jsonb_array_elements(proposal.plan->'songs') WITH ORDINALITY AS entries(song,ordinal);
  anchor:=nullif(service.record->>'worshipAfterItemId','');
  IF anchor IS NULL THEN combined:=songs; inserted:=true; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(service.record->'service'->'items') LOOP
    IF starts_with(item->>'id',prefix) THEN CONTINUE; END IF;
    combined:=combined||jsonb_build_array(item);
    IF item->>'id'=anchor THEN combined:=combined||songs; inserted:=true; END IF;
  END LOOP;
  IF NOT inserted THEN RAISE EXCEPTION 'El punto de inserción de la música ya no existe' USING ERRCODE='PT409'; END IF;
  updated_record:=jsonb_set(service.record,'{service,items}',combined);
  updated_record:=jsonb_set(updated_record,'{service,setlist}',jsonb_build_object('id',proposal.plan->>'setlistId','name',proposal.plan->>'name'));
  UPDATE private.service_plans SET record=updated_record,revision=revision+1,updated_by=public.current_uid(),updated_at=now()
    WHERE church_id=p_church_id AND id=p_service_id RETURNING * INTO service;
  INSERT INTO private.service_plan_history(church_id,service_id,revision,actor_id,record,deleted)
    VALUES(p_church_id,p_service_id,service.revision,public.current_uid(),service.record,false);
  UPDATE private.worship_plans SET applied_plan_revision=proposal.revision,applied_service_revision=service.revision
    WHERE church_id=p_church_id AND service_id=p_service_id;
  result:=service.record||jsonb_build_object('revision',service.revision);
  INSERT INTO private.service_plan_operations(church_id,operation_id,actor_id,request,response)
    VALUES(p_church_id,p_operation_id,public.current_uid(),fingerprint,result);
  RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_worship_exchange(uuid,text),public.save_worship_plan(uuid,text,jsonb,integer,integer,uuid),public.apply_worship_plan(uuid,text,integer,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_worship_exchange(uuid,text),public.save_worship_plan(uuid,text,jsonb,integer,integer,uuid),public.apply_worship_plan(uuid,text,integer,integer,uuid) TO lvm_user;
INSERT INTO private.migrations(version) VALUES('011_worship_exchange');
NOTIFY pgrst,'reload schema';
COMMIT;
