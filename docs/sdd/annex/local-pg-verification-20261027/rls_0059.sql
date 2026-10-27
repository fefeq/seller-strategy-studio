\pset tuples_only on
\set ON_ERROR_STOP 0
insert into drive_connections(org_id,google_email,refresh_token_enc) values ('aaaaaaaa-0000-0000-0000-000000000001','a@example.test','SEALED-FAKE');
insert into connection_events(org_id,provider,action,detail) values ('aaaaaaaa-0000-0000-0000-000000000001','google_drive','connected','x');
\echo == U1 owner B ve 0 conexiones y 0 eventos de A
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
select (select count(*) from drive_connections), (select count(*) from connection_events);
\echo == U2 AE de A (no Owner) ve el estado pero NO el token (esperado: 1 fila; error permission denied al pedir refresh_token_enc)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select org_id is not null, google_email, status from drive_connections;
select refresh_token_enc from drive_connections;
\echo == U3 el navegador no puede escribir (esperado: permission denied x3)
insert into drive_connections(google_email,refresh_token_enc) values ('b@example.test','x');
update drive_connections set status='error';
delete from connection_events;
reset role;
