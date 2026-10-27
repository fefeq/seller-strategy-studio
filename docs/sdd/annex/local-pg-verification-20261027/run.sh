#!/usr/bin/env bash
# Postgres 16 local y aislado (no Supabase, no producción). Uso: ./run.sh <ruta-al-repo> <carpeta-de-trabajo>
# Requiere los binarios de Postgres 16 y un usuario no root llamado «postgres» (initdb no corre como root).
set -u; REPO=$1; W=$2; B=/usr/lib/postgresql/16/bin; mkdir -p "$W/pg"; chown postgres "$W/pg"
su postgres -c "$B/initdb -D $W/pg/data -A trust -U postgres >/dev/null && $B/pg_ctl -D $W/pg/data -o '-p 54329 -k $W/pg' -l $W/pg/log -w start"
P="psql -h $W/pg -p 54329 -U postgres"
$P -q -c "create database nokko_test" && $P -q -d nokko_test -f "$(dirname "$0")/stubs.sql"
for f in $(ls "$REPO"/drizzle/migrations/*.sql | sort); do
  $P -d nokko_test -v ON_ERROR_STOP=1 -q -1 -f "$f" >/dev/null 2>"$W/err" && echo "OK   $(basename "$f")" || echo "FAIL $(basename "$f") :: $(head -2 "$W/err" | tr '\n' ' ')"
done
for t in rls_0058_0063 rls_0059 rls_0062; do echo "== $t"; $P -d nokko_test -f "$(dirname "$0")/$t.sql" 2>&1; done
$B/pg_ctl -D "$W/pg/data" stop >/dev/null
