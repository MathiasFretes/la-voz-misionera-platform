#!/bin/sh
# Disposable planning environment. Never points the new API or PostgREST at production data.
set -eu
umask 077
cd /srv/apps/la-voz-misionera
qa_database=lvm_planning_qa_20261121
if docker inspect lvm-planning-qa-api >/dev/null 2>&1 || docker inspect lvm-planning-qa-rest >/dev/null 2>&1; then
  echo 'QA containers already exist; inspect their current state instead of restarting this setup.'
  exit 1
fi
if docker compose exec -T postgres psql -U lvm_owner -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='$qa_database'" | grep -q 1; then
  echo 'QA database already exists; refusing to overwrite it.'
  exit 1
fi
mkdir -p planning-qa
chmod 700 planning-qa
docker compose exec -T postgres createdb -U lvm_owner "$qa_database"
for migration in planning-preflight/schema/*.sql; do
  case "$migration" in *.down.sql) continue ;; esac
  docker compose exec -T postgres psql -U lvm_owner -d "$qa_database" -v ON_ERROR_STOP=1 < "$migration" > /dev/null
done
printf 'postgres://lvm_rest:%s@postgres:5432/%s' "$(cat secrets/rest_password)" "$qa_database" > planning-qa/rest_uri
chown 1000:1000 planning-qa/rest_uri
chmod 400 planning-qa/rest_uri
docker build -t lvm-planning-qa:20261121 planning-preflight
docker run -d --name lvm-planning-qa-rest --network lvm-worship_database --read-only \
  --mount type=bind,src=/srv/apps/la-voz-misionera/planning-qa/rest_uri,dst=/run/secrets/rest_uri,readonly \
  --mount type=bind,src=/srv/apps/la-voz-misionera/secrets/jwt_secret,dst=/run/secrets/jwt_secret,readonly \
  -e PGRST_DB_URI=@/run/secrets/rest_uri -e PGRST_JWT_SECRET=@/run/secrets/jwt_secret \
  -e PGRST_DB_ANON_ROLE=lvm_anon -e PGRST_DB_SCHEMAS=public -e PGRST_DB_MAX_ROWS=10000 -e PGRST_OPENAPI_MODE=disabled -e PGRST_LOG_LEVEL=error \
  postgrest/postgrest:v16.0@sha256:45674266ef004bc6676f98b12132f1da042de8b5237eff4e7af3c7bf6c510bfb > /dev/null
docker network create --label lvm.qa=planning lvm-planning-qa-front > /dev/null
docker run -d --name lvm-planning-qa-api --network lvm-planning-qa-front --read-only --tmpfs /tmp \
  --mount type=bind,src=/srv/apps/la-voz-misionera/secrets/api_password,dst=/run/secrets/api_password,readonly \
  --mount type=bind,src=/srv/apps/la-voz-misionera/secrets/jwt_secret,dst=/run/secrets/jwt_secret,readonly \
  -e LVM_DATABASE="$qa_database" -e LVM_REST_URL=http://lvm-planning-qa-rest:3000 \
  -e LVM_ORIGIN=https://srv2137598.hstgr.cloud -p 127.0.0.1:4319:4318 lvm-planning-qa:20261121 > /dev/null
docker network connect lvm-worship_database lvm-planning-qa-api
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent http://127.0.0.1:4319/api/health; then
    printf '\nQA ready: isolated database, internal-only API and PostgREST.\n'
    exit 0
  fi
  sleep 1
done
echo 'QA startup did not become healthy. Inspect these exact containers before retrying.'
exit 1
