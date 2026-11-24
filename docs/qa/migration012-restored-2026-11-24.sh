set -eu
release=/srv/apps/la-voz-misionera/releases/identity-20261124T191057Z
backup=/srv/backups/la-voz-misionera/lvm_worship_pre_release_20261124T191057Z.dump
test "$(sha256sum "$backup" | cut -d ' ' -f1)" = 83f907bfb232c44197864f5661b005301bf31af8a148a624ff3a95589ad491b8
name=lvm-migration012-qa-20261124
if docker container inspect "$name" >/dev/null 2>&1; then echo 'QA name already exists'; exit 1; fi
cleanup() {
 label=$(docker inspect "$name" --format '{{index .Config.Labels "lvm.qa.purpose"}}' 2>/dev/null || true)
 if test "$label" = migration012-rehearsal; then docker rm -f "$name" >/dev/null; fi
}
trap cleanup EXIT
docker run -d --name "$name" --label lvm.qa.purpose=migration012-rehearsal --network none --memory 512m --cpus 1 --pids-limit 128 --mount type=tmpfs,destination=/var/lib/postgresql/data,tmpfs-size=268435456 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
docker inspect "$name" --format 'network={{.HostConfig.NetworkMode}} ports={{json .HostConfig.PortBindings}} mounts={{json .Mounts}}'
ready=0
for i in 1 2 3 4 5 6 7 8 9 10; do
 if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
 sleep 2
done
test "$ready" = 1
docker exec "$name" psql -X -U postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE lvm_owner NOLOGIN; CREATE ROLE lvm_anon NOLOGIN; CREATE ROLE lvm_user NOLOGIN; CREATE ROLE lvm_api NOLOGIN; CREATE ROLE lvm_rest NOLOGIN;' >/dev/null
docker exec "$name" createdb -U postgres --owner=lvm_owner lvm_restore_qa
docker cp "$backup" "$name":/tmp/backup.dump
docker exec "$name" pg_restore -U postgres --exit-on-error --dbname lvm_restore_qa /tmp/backup.dump
sql_file() {
 { printf 'SET ROLE lvm_owner;\n'; cat "$1"; } | docker exec -i "$name" psql -X -U postgres -d lvm_restore_qa -v ON_ERROR_STOP=1
}
counts="SELECT jsonb_build_object('users',(select count(*) from public.users),'songs',(select count(*) from public.songs),'drafts',(select count(*) from public.personal_songs),'suggestions',(select count(*) from public.song_suggestions),'setlists',(select count(*) from public.setlists),'links',(select count(*) from public.setlist_songs))"
before=$(docker exec "$name" psql -X -U postgres -d lvm_restore_qa -Atc "$counts")
echo "QA_ONLY_RECORD_COUNTS_BEFORE=$before"
sha256sum "$release/source/suite-api/schema/012_editor_transactions.sql"
sql_file "$release/source/suite-api/schema/012_editor_transactions.sql"
for file in editor-transactions.sql editor-revisions.sql editor-draft-lifecycle.sql; do
 echo "QA_SQL=$file"
 sql_file "$release/source/suite-api/test/$file"
done
sql_file "$release/source/suite-api/schema/012_editor_transactions.down.sql" >/dev/null
echo QA_SQL=editor-rollback.sql
sql_file "$release/source/suite-api/test/editor-rollback.sql"
sql_file "$release/source/suite-api/schema/012_editor_transactions.sql" >/dev/null
echo QA_SQL=editor-revisions.sql-after-reapply
sql_file "$release/source/suite-api/test/editor-revisions.sql"
after=$(docker exec "$name" psql -X -U postgres -d lvm_restore_qa -Atc "$counts")
test "$before" = "$after"
echo QA_RESTORED_RECORD_COUNTS_PRESERVED
docker exec "$name" psql -X -U postgres -d lvm_restore_qa -v ON_ERROR_STOP=1 -c "SELECT version FROM private.migrations ORDER BY version; SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname IN ('lvm_owner','lvm_user','lvm_api'); SELECT pg_get_userbyid(proowner) AS owner,proname FROM pg_proc WHERE proname IN ('mutate_editor_song','rebase_song_suggestion','editor_revision_clock'); DO \$\$ BEGIN IF EXISTS(SELECT FROM pg_proc WHERE proname IN ('mutate_editor_song','rebase_song_suggestion','editor_revision_clock') AND pg_get_userbyid(proowner)<>'lvm_owner') THEN RAISE EXCEPTION 'Unexpected function owner'; END IF; END \$\$;"
python3 - <<'PY'
import subprocess,json,uuid,time
container='lvm-migration012-qa-20261124'
base=['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','lvm_restore_qa','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
def sql(statement):
 r=subprocess.run(base,input=statement,text=True,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
actor=str(uuid.uuid4())
body={'title':'Isolated migration concurrency QA','default_key':'G','tags':['QA'],'chordpro_content':'[G]Original'}
claims=json.dumps({'sub':actor})
prefix=f"SET ROLE lvm_owner; SET ROLE lvm_user; SELECT set_config('request.jwt.claims','{claims}',false);"
sql(f"SET ROLE lvm_owner; INSERT INTO public.users(id,role) VALUES('{actor}','editor');")
created=json.loads(sql(prefix+f"SELECT public.mutate_editor_song('{uuid.uuid4()}','save_published',NULL,NULL,'{json.dumps(body)}');").splitlines()[-1])
song=created['row']['id']; revision=created['row']['updated_at']; op=str(uuid.uuid4())
updated={**body,'chordpro_content':'[D]First committed edit'}
call=f"SELECT public.mutate_editor_song('{op}','save_published','{song}',NULL,'{json.dumps(updated)}','{revision}');"
first=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
first.stdin.write("SET application_name='lvm-qa-editor-writer1'; BEGIN;"+prefix+call+"SELECT pg_sleep(2); COMMIT;");first.stdin.close()
observed=False
for _ in range(100):
 if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='lvm-qa-editor-writer1' AND wait_event='PgSleep';")=='1': observed=True;break
 time.sleep(.02)
assert observed,'First writer did not reach held transaction'
second_body={**body,'chordpro_content':'[C]Second concurrent edit'}
second=subprocess.run(base,input=prefix+f"SELECT public.mutate_editor_song('{uuid.uuid4()}','save_published','{song}',NULL,'{json.dumps(second_body)}','{revision}');",text=True,capture_output=True)
first.wait(timeout=10);first_out=first.stdout.read();first_err=first.stderr.read()
assert first.returncode==0,first_err
assert second.returncode!=0 and 'PT409' in second.stderr,second.stderr
result=json.loads([line for line in first_out.splitlines() if line.startswith('{"kind"') or line.startswith('{"row"')][-1])
replay=json.loads(sql(prefix+call).splitlines()[-1]);assert replay==result,'Replay did not preserve operation result'
final=json.loads(sql(f"SELECT to_jsonb(s) FROM public.songs s WHERE id='{song}';"))
assert final['chordpro_content']==updated['chordpro_content'],'Late writer overwrote committed edit'
assert sql(f"SELECT count(*) FROM private.editor_operations WHERE actor_id='{actor}' AND operation_id='{op}';")=='1'
print('PASS two overlapping PostgreSQL editor writers: one commit, one PT409, same-UUID replay, one receipt, no lost update')
PY
echo MIGRATION012_BACKUP_REHEARSAL_AND_FAIL_CLOSED_ROLLBACK_PASSED
cleanup
trap - EXIT
if docker container inspect "$name" >/dev/null 2>&1; then exit 1; fi
echo QA_CONTAINER_REMOVED
sha256sum "$backup"
