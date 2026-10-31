# Scripts de la migración de Lovable (SDD A)

Los ejecuta **Fede en su terminal** (decisión 10 del SDD A): necesitan la URL de la base, con contraseña. El agente no la ve; solo lee los informes. Los informes llevan nombres de tabla, recuentos y hashes; nunca filas, emails ni valores. Guárdalos en `.factory/evidence/lovable-exit/` (ignorada por git).

Requisitos: `npm install` (usa el paquete `postgres`). No hace falta `pg_dump` para estos scripts.

## Variables (solo en tu terminal, nunca en el repo ni en `.env`)
```bash
export NOKKO_SOURCE_DB_URL='postgresql://…'   # origen (Lovable Cloud)
export NOKKO_TARGET_DB_URL='postgresql://…'   # destino (tu Supabase)
```

## 1. Antes de restaurar (CA-26, datos)
```bash
node scripts/migration/check-preprod-safe.mjs --env NOKKO_TARGET_DB_URL
```

## 2. Foto del origen, en la misma instantánea del volcado (CA-5, CA-6, CA-27)
```bash
node scripts/migration/verify-data.mjs snapshot --env NOKKO_SOURCE_DB_URL \
  --out .factory/evidence/lovable-exit/source.json \
  --cipher public.posthog_connections.<columna_cifrada>
```
`<columna_cifrada>` es la columna que guarda la clave de PostHog sellada con `INTEGRATION_KEYS_SECRET` (mírala en `src/lib/posthog-sync.server.ts`). Se puede repetir `--cipher a,b`.

## 3. Tras restaurar
```bash
node scripts/migration/verify-data.mjs snapshot --env NOKKO_TARGET_DB_URL \
  --out .factory/evidence/lovable-exit/target.json \
  --cipher public.posthog_connections.<columna_cifrada>
node scripts/migration/verify-data.mjs diff .factory/evidence/lovable-exit/source.json .factory/evidence/lovable-exit/target.json
```
Falla (exit 1) si falta una tabla, cambia un recuento o un hash, se altera una columna cifrada, o falta en el destino un disparador, política, GRANT, publicación de tiempo real o extensión del origen. Lo que solo existe en el destino no cuenta.

## 4. Claves de Stripe del Vault (CA-28)
```bash
node scripts/migration/verify-vault.mjs snapshot --env NOKKO_SOURCE_DB_URL --out .factory/evidence/lovable-exit/vault-source.json
node scripts/migration/verify-vault.mjs snapshot --env NOKKO_TARGET_DB_URL --out .factory/evidence/lovable-exit/vault-target.json
node scripts/migration/verify-vault.mjs diff .factory/evidence/lovable-exit/vault-source.json .factory/evidence/lovable-exit/vault-target.json
```
La clave nunca sale de la base: se pregunta `stripe_key_for(org) is not null` y se guarda solo el sha256 del id de empresa. **Sin verificar:** si `stripe_key_for` exige un rol concreto, ejecútalo como el propietario de la base.

## 5. Copias cifradas del volcado (CA-7)
```bash
node scripts/migration/verify-data.mjs files manifest --out manifiesto-volcado.json /ruta/copia1.enc /ruta/copia2.enc
node scripts/migration/verify-data.mjs files verify manifiesto-volcado.json
```
Calcula el hash de los archivos **cifrados**, así que no necesita la clave. Que la copia se descifra lo compruebas tú con tu clave.

## Pruebas
`npx vitest run src/test/migration-scripts.test.ts` (sin base de datos: cubre la comparación, los manifiestos y el manejo de secretos). La parte que consulta la base (`snapshot`) **no está probada contra una base real**.
