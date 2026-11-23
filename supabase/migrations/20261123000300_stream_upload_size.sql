-- Video uploads: resume only the same file, allow replacing an unfinished upload.
-- 1. The size of each allocated upload is kept. Picking a different file while an upload
--    is unfinished reused the first upload, sized for the first file, and corrupted it;
--    that now answers 'different_file' and the creator can replace the upload.
-- 2. A creator can replace an upload that is still running, instead of waiting for it to
--    expire.
alter table public.stream_assets add column upload_length bigint check (upload_length>0);

drop function public.reserve_stream_upload(uuid,uuid);
create function public.reserve_stream_upload(p_user_id uuid,p_title_id uuid,p_size_bytes bigint default null) returns public.stream_assets
language plpgsql security definer set search_path='' as $$
declare v_title public.titles; v_asset public.stream_assets;
begin
  select * into v_title from public.titles where id=p_title_id for update;
  if not found or v_title.kind='series' then raise exception 'title_unavailable'; end if;
  if not public.publisher_allowed(p_user_id,v_title.channel_id) then raise exception 'publisher_required' using errcode='42501'; end if;
  if v_title.status not in ('draft','rejected') then raise exception 'title_not_editable'; end if;
  select * into v_asset from public.stream_assets where title_id=p_title_id for update;
  if found then
    if v_asset.upload_url is not null and v_asset.upload_expires_at>now() and v_asset.state='uploading' then
      -- Resume only the same file; a different one would corrupt the upload sized for the first.
      if p_size_bytes is not null and v_asset.upload_length is not null and v_asset.upload_length<>p_size_bytes then
        raise exception 'different_file';
      end if;
      return v_asset;
    end if;
    if v_asset.lease_until>now() then raise exception 'upload_busy'; end if;
    if v_asset.stream_uid is not null then raise exception 'upload_already_allocated'; end if;
  end if;
  insert into public.stream_assets(title_id,lease_id,lease_until)
    values(p_title_id,gen_random_uuid(),now()+interval '3 minutes')
    on conflict(title_id) do update set lease_id=excluded.lease_id,lease_until=excluded.lease_until,state='allocating'
    returning * into v_asset;
  return v_asset;
end; $$;

drop function public.bind_stream_upload(uuid,uuid,text,text,timestamptz);
create function public.bind_stream_upload(p_asset_id uuid,p_lease uuid,p_uid text,p_upload_url text,p_expires_at timestamptz,p_length bigint default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.stream_assets set stream_uid=p_uid,upload_url=p_upload_url,upload_expires_at=p_expires_at,upload_length=p_length,
    state='uploading',lease_id=null,lease_until=null,next_check_at=now()+interval '10 minutes'
    where id=p_asset_id and lease_id=p_lease and lease_until>now();
  if not found then raise exception 'upload_lease_lost'; end if;
end; $$;

create or replace function public.reset_stream_upload(p_title_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_title public.titles; v_asset public.stream_assets;
begin
  select * into v_title from public.titles where id=p_title_id for update;
  if not found or not public.publisher_allowed(auth.uid(),v_title.channel_id) then raise exception 'publisher_required' using errcode='42501'; end if;
  if v_title.status not in ('draft','rejected') then raise exception 'title_not_editable'; end if;
  select * into v_asset from public.stream_assets where title_id=p_title_id for update;
  -- An unfinished upload can be replaced too (the creator picked the wrong file); its
  -- provider video is queued for deletion by the stream_asset_erasure trigger.
  if found and v_asset.state='allocating' and v_asset.lease_until>now() then raise exception 'upload_busy'; end if;
  delete from public.stream_assets where title_id=p_title_id;
  update public.titles set status='draft' where id=p_title_id;
end; $$;

revoke all on function public.reserve_stream_upload(uuid,uuid,bigint),
  public.bind_stream_upload(uuid,uuid,text,text,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.reserve_stream_upload(uuid,uuid,bigint),
  public.bind_stream_upload(uuid,uuid,text,text,timestamptz,bigint) to service_role;
