-- Cover images for channels and titles, uploaded from the phone instead of pasted URLs.
--
-- The bucket is public: anyone, guests included, can view a cover by its public URL,
-- which is what channels.cover_url and titles.cover_url store. Only active admins and
-- approved publishers (the same rule as submit_channel) can upload, and only into a
-- folder named after their own user id: '<user id>/<file name>'. Covers are never
-- overwritten; a new image is a new object. Account erasure already removes every
-- object a user owns, in any bucket, and drive cleanup only touches 'user-files'.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- True when the caller may publish and p_name is a file directly inside their own folder.
create function public.can_upload_cover(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]{1,100}$')
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and account_status = 'active'
        and (role = 'admin' or can_publish)
    );
$$;

revoke all on function public.can_upload_cover(text) from public, anon;
grant execute on function public.can_upload_cover(text) to authenticated;

create policy "publishers upload own covers" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (select public.can_upload_cover(name)));

-- Storage reads the new row back after an upload. Public URLs need no policy, and no
-- one can list other users' covers.
create policy "publishers read own covers" on storage.objects
  for select to authenticated
  using (bucket_id = 'covers' and owner_id = (select auth.uid())::text);
