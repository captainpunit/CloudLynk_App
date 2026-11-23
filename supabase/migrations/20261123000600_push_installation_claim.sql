-- Push registrations follow the account that is signed in on a phone.
-- 1. When an account loads on a phone (claim_installation) or registers for pushes there,
--    registrations of other accounts on that phone are removed with their queued pushes.
--    A failed unregister at sign-out left the phone receiving the previous account's
--    notifications.
-- 2. The 10-device limit counts devices with notifications on, and registrations unused
--    for 60 days are cleared first; reinstalls used to lock the member out for good.
create function public.release_installation_for(p_user_id uuid,p_installation_id uuid) returns void
language sql security definer set search_path='' as $$
  delete from public.push_deliveries where token_id in (
    select id from public.push_tokens where installation_id=p_installation_id and user_id<>p_user_id);
  delete from public.push_tokens where installation_id=p_installation_id and user_id<>p_user_id;
$$;
revoke all on function public.release_installation_for(uuid,uuid) from public,anon,authenticated;

create function public.claim_installation(p_installation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if p_installation_id is null then raise exception 'invalid_push_token'; end if;
  perform public.release_installation_for(auth.uid(),p_installation_id);
end; $$;
revoke all on function public.claim_installation(uuid) from public,anon;
grant execute on function public.claim_installation(uuid) to authenticated;

create or replace function public.register_push_token(p_installation_id uuid,p_token text) returns void
language plpgsql security definer set search_path='' as $$
declare v_existing public.push_tokens;
begin
  perform 1 from public.profiles where id=auth.uid() and account_status='active' for update;
  if not found then raise exception 'account_restricted' using errcode='42501'; end if;
  if p_installation_id is null or p_token is null then raise exception 'invalid_push_token'; end if;
  delete from public.push_tokens where user_id=auth.uid() and installation_id=p_installation_id and token<>p_token;
  -- This phone now belongs to this account; no other account keeps receiving on it.
  perform public.release_installation_for(auth.uid(),p_installation_id);
  -- Registrations unused for two months are from phones the member no longer has.
  delete from public.push_tokens where user_id=auth.uid() and updated_at<now()-interval '60 days' and token<>p_token;
  select * into v_existing from public.push_tokens where token=p_token for update;
  if found and v_existing.user_id<>auth.uid() then
    -- Device account switches must never deliver the previous account's inbox.
    delete from public.push_deliveries where token_id=v_existing.id;
  end if;
  if (select count(*) from public.push_tokens where user_id=auth.uid() and enabled)>=10
    and not exists(select 1 from public.push_tokens where user_id=auth.uid() and token=p_token) then raise exception 'too_many_devices'; end if;
  insert into public.push_tokens(user_id,installation_id,token) values(auth.uid(),p_installation_id,p_token)
  on conflict(token) do update set user_id=excluded.user_id,installation_id=excluded.installation_id,enabled=true,updated_at=now();
end; $$;
