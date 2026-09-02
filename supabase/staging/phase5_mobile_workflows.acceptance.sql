-- PROPOSAL ONLY / NOT EXECUTED. Run only after the Phase 5 staging extension
-- is explicitly approved and applied to rxuvchdqbzvovqijvfhx.
-- Run the entire file in one privileged SQL session. All fixture rows, membership
-- changes, counters and metadata are rolled back. No auth user, password, file,
-- Storage object, production record, or existing membership is changed.
-- Database checks only: endpoint replay/content comparison and real signed file
-- retrieval still need the existing API tests / staging HTTP acceptance.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$ begin
  if to_regclass('mobile_staging.fixture_manifest') is null then
    raise exception 'Missing staging marker';
  end if;
  if not exists (select 1 from mobile_staging.fixture_manifest where fixture_key = 'qa-project'
    and synthetic_name = 'Synthetic US Track Renewal') then raise exception 'Wrong staging marker'; end if;
  if not exists (select 1 from public.profiles where id = 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0'
    and email = 'app-review@railcommand.io' and role = 'manager') then
    raise exception 'Expected existing non-admin reviewer is missing; do not create/reset it';
  end if;
  if exists (select 1 from public.projects where id in
    ('f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002')) then
    raise exception 'Acceptance fixture ID collision; do not overwrite';
  end if;
end $$;

insert into public.projects(id, name, start_date, target_end_date, created_by) values
  ('f5000000-0000-4000-8000-000000000001', 'ROLLBACK ONLY Phase 5 permitted', current_date, current_date + 1, 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0'),
  ('f5000000-0000-4000-8000-000000000002', 'ROLLBACK ONLY Phase 5 forbidden', current_date, current_date + 1, 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0');
insert into public.project_members(project_id, profile_id, project_role, can_edit) values
  ('f5000000-0000-4000-8000-000000000001', 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', 'manager', true);
insert into public.milestones(id, project_id, name, target_date) values
  ('f5400000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'Permitted milestone', current_date),
  ('f5400000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000002', 'Forbidden milestone', current_date);
insert into public.daily_logs(id, project_id, log_date, created_by) values
  ('f5100000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', current_date, 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0'),
  ('f5100000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000002', current_date, 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0');
insert into public.daily_log_personnel(daily_log_id, role, headcount)
  select id, 'Test crew', 1 from public.daily_logs where id in ('f5100000-0000-4000-8000-000000000001', 'f5100000-0000-4000-8000-000000000002');
insert into public.daily_log_equipment(daily_log_id, equipment_type, count)
  select id, 'Test equipment', 1 from public.daily_logs where id in ('f5100000-0000-4000-8000-000000000001', 'f5100000-0000-4000-8000-000000000002');
insert into public.daily_log_work_items(daily_log_id, description)
  select id, 'Rollback fixture' from public.daily_logs where id in ('f5100000-0000-4000-8000-000000000001', 'f5100000-0000-4000-8000-000000000002');

select set_config('request.jwt.claim.sub', 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', true);
select set_config('request.jwt.claims', '{"sub":"ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0","role":"authenticated"}', true);
set local role authenticated;
do $$ declare v_table text; v_count integer; begin
  foreach v_table in array array['daily_log_personnel', 'daily_log_equipment', 'daily_log_work_items'] loop
    execute format('select count(*) from public.%I where daily_log_id in ($1,$2)', v_table)
      into v_count using 'f5100000-0000-4000-8000-000000000001'::uuid, 'f5100000-0000-4000-8000-000000000002'::uuid;
    if v_count <> 1 then raise exception 'Authorized parent-only child read failed: %', v_table; end if;
  end loop;
  if (select count(*) from public.project_members where project_id = 'f5000000-0000-4000-8000-000000000001') <> 1
    or not mobile_staging.can_view_shared_profile('ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0')
    or mobile_staging.can_view_shared_profile('ffffffff-ffff-4fff-8fff-ffffffffffff') then
    raise exception 'Team/self visibility failed';
  end if;
  foreach v_table in array array['milestones', 'rfi_responses', 'punch_list_items', 'earthcam_embeds', 'entity_number_sequences'] loop
    if has_table_privilege('authenticated', 'public.' || v_table, 'INSERT,UPDATE,DELETE') then
      raise exception 'Unexpected write privilege: %', v_table;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.rfis', 'UPDATE,DELETE')
    or has_column_privilege('authenticated', 'public.rfis', 'number', 'INSERT')
    or has_column_privilege('authenticated', 'public.submittals', 'reviewed_by', 'INSERT')
    or has_table_privilege('anon', 'public.rfis', 'SELECT,INSERT') then raise exception 'Unexpected record privileges'; end if;
end $$;

insert into public.rfis(id, project_id, subject, question, priority, submitted_by, assigned_to, due_date, milestone_id, status) values
  ('f5200000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'Rollback RFI', 'Preserve exact payload', 'medium',
    'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', current_date + 1, 'f5400000-0000-4000-8000-000000000001', 'open');
insert into public.submittals(id, project_id, title, description, spec_section, submitted_by, due_date, milestone_id, status) values
  ('f5300000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'Rollback submittal', 'Preserve exact payload', '01',
    'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', current_date + 1, 'f5400000-0000-4000-8000-000000000001', 'submitted');
do $$ begin
  if (select number from public.rfis where id = 'f5200000-0000-4000-8000-000000000001') <> 'RFI-001'
    or (select number from public.submittals where id = 'f5300000-0000-4000-8000-000000000001') <> 'SUB-001' then
    raise exception 'Server-assigned numbering failed';
  end if;
  begin
    insert into public.rfis(id, project_id, subject, question, submitted_by, assigned_to, due_date, status) values
      ('f5200000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'MUST NOT overwrite', 'duplicate',
       'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', current_date + 1, 'open');
    raise exception 'Duplicate UUID unexpectedly succeeded';
  exception when unique_violation then null; end;
  if (select subject from public.rfis where id = 'f5200000-0000-4000-8000-000000000001') <> 'Rollback RFI' then
    raise exception 'Duplicate delivery changed the original';
  end if;
  begin
    insert into public.submittals(project_id, title, submitted_by, due_date, status) values
      ('f5000000-0000-4000-8000-000000000002', 'Forbidden project', 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', current_date, 'submitted');
    raise exception 'Cross-project insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.submittals(project_id, title, submitted_by, due_date, milestone_id, status) values
      ('f5000000-0000-4000-8000-000000000001', 'Forbidden milestone', 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', current_date, 'f5400000-0000-4000-8000-000000000002', 'submitted');
    raise exception 'Cross-project milestone unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.rfis(project_id, subject, question, submitted_by, assigned_to, due_date, status) values
      ('f5000000-0000-4000-8000-000000000001', 'Forbidden assignee', 'No membership', 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0', 'ffffffff-ffff-4fff-8fff-ffffffffffff', current_date, 'open');
    raise exception 'Nonmember assignee unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- No Storage object/file is created: test only metadata/path authorization.
insert into public.attachments(id, project_id, entity_type, entity_id, file_name, file_url, file_type, file_size, photo_category, uploaded_by) values
  ('f5500000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'rfi', 'f5200000-0000-4000-8000-000000000001', 'fixture.pdf',
   'https://rxuvchdqbzvovqijvfhx.supabase.co/storage/v1/object/public/project-documents/f5000000-0000-4000-8000-000000000001/rfi/f5200000-0000-4000-8000-000000000001/fixture.pdf',
   'application/pdf', 1, 'document', 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0');
set local role authenticated;
do $$ declare v_path text := 'f5000000-0000-4000-8000-000000000001/rfi/f5200000-0000-4000-8000-000000000001/fixture.pdf'; begin
  if not mobile_staging.can_read_workflow_object('project-documents', v_path)
    or mobile_staging.can_read_workflow_object('project-photos', v_path)
    or mobile_staging.can_read_workflow_object('project-documents', replace(v_path, '/rfi/', '/submittal/'))
    or mobile_staging.can_read_workflow_object('project-documents', replace(v_path, 'fixture.pdf', '../fixture.pdf'))
    or mobile_staging.can_read_workflow_object('project-documents', replace(v_path, 'fixture.pdf', 'missing.pdf')) then
    raise exception 'Attachment parent/metadata/bucket/path boundary failed';
  end if;
end $$;
reset role;

-- Modify only the newly-created rollback fixture membership, never a real one.
update public.project_members set can_edit = false where project_id = 'f5000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  if mobile_staging.can_create_workflow('f5000000-0000-4000-8000-000000000001', 'rfi')
    or mobile_staging.can_create_workflow('f5000000-0000-4000-8000-000000000001', 'submittal') then
    raise exception 'Read-only membership can create';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-ffffffffffff', true);
select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.rfis where id = 'f5200000-0000-4000-8000-000000000001')
    or exists (select 1 from public.submittals where id = 'f5300000-0000-4000-8000-000000000001')
    or exists (select 1 from public.daily_log_personnel where daily_log_id = 'f5100000-0000-4000-8000-000000000001')
    or exists (select 1 from public.project_members where project_id = 'f5000000-0000-4000-8000-000000000001')
    or mobile_staging.can_view_shared_profile('ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0')
    or mobile_staging.can_read_workflow_object('project-documents', 'f5000000-0000-4000-8000-000000000001/rfi/f5200000-0000-4000-8000-000000000001/fixture.pdf') then
    raise exception 'Unknown authenticated subject gained project data';
  end if;
end $$;
reset role;

-- PASS means these SQL assertions passed; it does not claim HTTP/device parity.
select 'Phase 5 SQL acceptance passed; all fixtures are being rolled back' as result;
rollback;
