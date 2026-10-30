-- A hidden/rejected title can be revised, but must pass review again.
create function public.reopen_title(p_title_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_title public.titles;
begin
  select * into v_title from public.titles where id=p_title_id for update;
  if not found or not public.publisher_allowed(auth.uid(),v_title.channel_id) then raise exception 'publisher_required' using errcode='42501'; end if;
  if v_title.status not in ('archived','rejected') then raise exception 'title_not_editable'; end if;
  update public.titles set status='draft' where id=p_title_id;
  insert into public.audit_log(actor_id,action,target_kind,target_id) values(auth.uid(),'reopen','title',p_title_id);
end; $$;
create or replace function public.reset_stream_upload(p_title_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_title public.titles; v_asset public.stream_assets;
begin
  select * into v_title from public.titles where id=p_title_id for update;
  if not found or not public.publisher_allowed(auth.uid(),v_title.channel_id) then raise exception 'publisher_required' using errcode='42501'; end if;
  if v_title.status not in ('draft','rejected') then raise exception 'title_not_editable'; end if;
  select * into v_asset from public.stream_assets where title_id=p_title_id for update;
  if found and not (v_asset.state in ('ready','error') or (v_asset.state='uploading' and v_asset.upload_expires_at<now()) or (v_asset.state='allocating' and v_asset.lease_until<now())) then raise exception 'upload_busy'; end if;
  delete from public.stream_assets where title_id=p_title_id;
  update public.titles set status='draft' where id=p_title_id;
end; $$;
revoke all on function public.reopen_title(uuid) from public,anon,authenticated;
grant execute on function public.reopen_title(uuid) to authenticated;
