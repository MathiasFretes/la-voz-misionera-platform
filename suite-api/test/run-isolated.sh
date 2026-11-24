#!/bin/sh
# Always creates its own project/cluster. Never accepts a database or API override.
set -eu
cd "$(dirname "$0")/../.."
LVM_QA_SECRET_DIR=$(mktemp -d /tmp/lvm-suite-integration.XXXXXX)
export LVM_QA_SECRET_DIR
project="lvm-suite-$(basename "$LVM_QA_SECRET_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')"
export LVM_QA_IMAGE="$project-api"
compose() { docker compose --project-name "$project" -f suite-api/test/compose.integration.yaml "$@"; }
cleanup() {
  result=$?
  trap - EXIT HUP INT TERM
  if [ "$result" -ne 0 ]; then compose logs --tail 40 api-off api-on api-disabled rest || true; fi
  compose down --remove-orphans >/dev/null 2>&1 || true
  rm -f "$LVM_QA_SECRET_DIR/postgres_password" "$LVM_QA_SECRET_DIR/api_password" "$LVM_QA_SECRET_DIR/rest_password" "$LVM_QA_SECRET_DIR/jwt_secret" "$LVM_QA_SECRET_DIR/rest_uri"
  rmdir "$LVM_QA_SECRET_DIR"
  exit "$result"
}
trap cleanup EXIT HUP INT TERM
umask 077
for key in postgres_password api_password rest_password jwt_secret; do openssl rand -hex 32 > "$LVM_QA_SECRET_DIR/$key"; done
printf 'postgres://lvm_rest:%s@postgres:5432/lvm_worship' "$(cat "$LVM_QA_SECRET_DIR/rest_password")" > "$LVM_QA_SECRET_DIR/rest_uri"
# The containing host directory stays 700; bind-mounted secrets are readable by UID 1000.
chmod 644 "$LVM_QA_SECRET_DIR/"*
compose up -d --wait postgres
for migration in suite-api/schema/*.sql; do
  case "$migration" in *.down.sql) continue ;; esac
  compose exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 < "$migration" >/dev/null
done
{ printf "ALTER ROLE lvm_api PASSWORD '%s';\n" "$(cat "$LVM_QA_SECRET_DIR/api_password")"; printf "ALTER ROLE lvm_rest PASSWORD '%s';\n" "$(cat "$LVM_QA_SECRET_DIR/rest_password")"; } | compose exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 >/dev/null
compose build api-off
compose up -d --wait rest api-off api-disabled api-on
for target in api-off api-disabled api-on; do
  echo "RUN official integration: $target"
  compose run --rm -e "LVM_TEST_URL=http://$target:4318" check test/integration.mjs
done
compose run --rm check test/church-identity.mjs
compose run --rm check test/native-mode.integration.mjs
echo 'PASS isolated official integration in all modes, church identity, native flag and web compatibility'
