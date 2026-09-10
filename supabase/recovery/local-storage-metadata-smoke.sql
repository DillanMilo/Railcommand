-- Synthetic local-only test; streamed reference functions replace marker below.
\set ON_ERROR_STOP on
begin;
create schema storage;
create schema railcommand_guard;
create role rc_storage_test nologin;
create table storage.objects(bucket_id text,name text,metadata jsonb,visible boolean);
alter table storage.objects enable row level security;
create policy visible_fixture on storage.objects for select to rc_storage_test using(visible);
grant usage on schema storage,railcommand_guard to rc_storage_test;
grant select on storage.objects to rc_storage_test;
-- REFERENCE_FUNCTIONS
insert into storage.objects values
 ('project-photos','valid','{"size":70,"mimetype":"image/png"}',true),
 ('project-photos','hidden','{"size":70,"mimetype":"image/png"}',false),
 ('project-photos','malformed','{"size":"70","mimetype":"image/png"}',true);
set local role rc_storage_test;
do $$
declare failures integer:=0;
begin
 perform railcommand_guard.assert_stored_object('project-photos','valid',' IMAGE/PNG ',70);
 begin
  perform railcommand_guard.assert_stored_object('project-photos','valid','image/png',71);
 exception when sqlstate '22023' then failures:=failures+1; end;
 begin
  perform railcommand_guard.assert_stored_object('project-photos','valid','image/jpeg',70);
 exception when sqlstate '22023' then failures:=failures+1; end;
 begin
  perform railcommand_guard.assert_stored_object('project-photos','hidden','image/png',70);
 exception when sqlstate 'P0001' then failures:=failures+1; end;
 begin
  perform railcommand_guard.assert_stored_object('project-photos','missing','image/png',70);
 exception when sqlstate 'P0001' then failures:=failures+1; end;
 begin
  perform railcommand_guard.assert_stored_object('project-photos','malformed','image/png',70);
 exception when sqlstate '22023' then failures:=failures+1; end;
 begin
  perform railcommand_guard.assert_stored_object('thermal-photos','valid','image/png',70);
 exception when sqlstate 'P0001' then failures:=failures+1; end;
 begin
  perform railcommand_guard.assert_stored_object('project-photos','valid','image/png',0);
 exception when sqlstate '22023' then failures:=failures+1; end;
 if failures<>7 then raise exception 'Expected seven metadata/visibility rejections, got %',failures; end if;
 raise notice 'PASS valid metadata and seven mismatch/visibility/bucket/size rejections under non-owner RLS';
end $$;
reset role;
rollback;
