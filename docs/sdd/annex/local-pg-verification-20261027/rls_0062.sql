\pset tuples_only on
\set ON_ERROR_STOP 0
\echo == V1 AE de A escribe y lee sus pausas (esperado: 1 fila, org_id rellenado)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
insert into setup_step_snoozes(step_id,snoozed_until) values ('icp', now()+interval '1 day');
select step_id, org_id from setup_step_snoozes;
\echo == V3 snoozed_by distinto de quien firma (esperado: violates row-level security)
insert into setup_step_snoozes(step_id,snoozed_until,snoozed_by) values ('pos', now()+interval '1 day','00000000-0000-0000-0000-0000000000b1');
\echo == V2 owner B no ve, no cambia y no borra las de A (esperado: 0 / UPDATE 0 / DELETE 0)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
select count(*) from setup_step_snoozes;
update setup_step_snoozes set snoozed_until = now();
delete from setup_step_snoozes;
reset role;
\echo == V2b siguen existiendo (esperado: 1)
select count(*) from setup_step_snoozes;
\echo == V4 borrar la empresa A borra sus pausas y conexiones (esperado: 0 y 0)
delete from organizations where id='aaaaaaaa-0000-0000-0000-000000000001';
select (select count(*) from setup_step_snoozes), (select count(*) from drive_connections);
