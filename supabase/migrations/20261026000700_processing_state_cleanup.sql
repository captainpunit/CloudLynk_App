create or replace function public.apply_stream_state(p_uid text,p_state text,p_duration double precision,p_signed boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_state not in ('uploading','processing','ready','error') then raise exception 'invalid_stream_state'; end if;
  update public.stream_assets set state=case when not p_signed then 'error' else p_state end,
    signed_only=p_signed,duration_seconds=p_duration,error_code=case when not p_signed then 'unsigned_asset' else left(p_error,100) end,
    upload_url=case when p_state in ('ready','error') then null else upload_url end,next_check_at=now()+interval '10 minutes'
    where stream_uid=p_uid;
end; $$;
