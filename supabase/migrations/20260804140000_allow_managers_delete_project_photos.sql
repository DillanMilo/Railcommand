-- Allow project managers and organization admins to delete project photos
-- uploaded by another member. Uploaders retain permission to delete their own
-- attachments, and the elevated permission is limited to image attachments.

begin;

drop policy if exists "attachments_delete" on public.attachments;

create policy "attachments_delete"
  on public.attachments for delete
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = attachments.project_id
        and pm.profile_id = auth.uid()
        and (
          attachments.uploaded_by = auth.uid()
          or (
            (
              attachments.file_type like 'image/%'
              or attachments.photo_category = 'thermal'
            )
            and (
              pm.project_role = 'manager'
              or exists (
                select 1
                from public.profiles p
                where p.id = auth.uid()
                  and p.role = 'admin'
              )
            )
          )
        )
    )
  );

commit;
