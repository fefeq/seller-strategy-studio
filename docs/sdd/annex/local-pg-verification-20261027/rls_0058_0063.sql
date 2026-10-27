\set ON_ERROR_STOP 0
\pset tuples_only on
-- datos ficticios
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000a1','owner-a@example.test'),('00000000-0000-0000-0000-0000000000a2','ae-a@example.test'),('00000000-0000-0000-0000-0000000000b1','owner-b@example.test');
insert into organizations(id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','Empresa A'),('bbbbbbbb-0000-0000-0000-000000000001','Empresa B');
insert into profiles(id,current_org_id) values ('00000000-0000-0000-0000-0000000000a1',null) on conflict (id) do nothing;
set session_replication_role = replica;
update profiles set current_org_id='aaaaaaaa-0000-0000-0000-000000000001' where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2');
update profiles set current_org_id='bbbbbbbb-0000-0000-0000-000000000001' where id='00000000-0000-0000-0000-0000000000b1';
insert into org_members(org_id,user_id,role) values ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','owner'),('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','ae'),('bbbbbbbb-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','owner');
set session_replication_role = origin;
\echo == T1 crear segmento como owner A y como owner B
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
insert into segments(name) values ('Seg A') returning org_id;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
insert into segments(name) values ('Seg B') returning org_id;
\echo == T2 aislamiento: owner B ve solo 1 segmento (esperado: 1 / Seg B)
select count(*), min(name) from segments;
\echo == T3 AE de A edita name y luego notes; deshace la edicion de name (esperado: name vuelve, mark de notes se conserva)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
update segments set name='Seg A2' where name='Seg A';
update segments set notes='nota' where name='Seg A2';
select id as log_name from field_edit_log where table_name='segments' order by changed_at limit 1 \gset
\echo -- intento de deshacer la primera edicion cuando hubo otra despues (esperado: error "cambio despues")
select undo_field_edit(:'log_name'::uuid);
\echo == T4 deshacer la ULTIMA edicion (notes): esperado ok y mark de name se conserva
select id as log_notes from field_edit_log where table_name='segments' order by changed_at desc limit 1 \gset
select undo_field_edit(:'log_notes'::uuid);
select name, notes, field_sources ? 'name' as mark_name_kept, field_sources ? 'notes' as mark_notes_gone from segments where name='Seg A2';
\echo == T5 owner B no puede deshacer cambios de A (esperado: No encuentro ese cambio)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
select undo_field_edit(:'log_name'::uuid);
\echo == T6 owner B no ve el log de A (esperado 0)
select count(*) from field_edit_log where org_id='aaaaaaaa-0000-0000-0000-000000000001';
\echo == T7 anon no ejecuta undo (esperado: permission denied)
reset role; set role anon; select undo_field_edit(:'log_name'::uuid);
reset role;
