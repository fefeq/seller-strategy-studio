-- Simulated Supabase platform pieces (local test only)
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator noinherit login;
grant anon, authenticated, service_role to authenticator;
create schema auth; create schema extensions; create schema vault;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
grant usage on schema auth, extensions to anon, authenticated, service_role;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(s text, n text default null, d text default '') returns uuid language sql as $$ insert into vault.secrets(name,secret,description) values (n,s,d) returning id $$;
create function vault.update_secret(i uuid, s text default null, n text default null, d text default null) returns void language sql as $$ update vault.secrets set secret=coalesce(s,secret), name=coalesce(n,name) where id=i $$;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
