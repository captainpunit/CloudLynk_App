-- Run on the target project AFTER migrations, secrets and function deployment.
-- Enable pg_cron and pg_net in the Dashboard first.
-- Required Vault entries: cron_secret, supabase_project_url (https://<ref>.supabase.co).
-- Re-running updates named jobs instead of creating duplicate schedules.
do $$
declare v_job record;
begin
  if not exists(select 1 from vault.decrypted_secrets where name='cron_secret')
    or not exists(select 1 from vault.decrypted_secrets where name='supabase_project_url') then
    raise exception 'Create cron_secret and supabase_project_url in Vault first';
  end if;
  for v_job in select * from (values
    ('drive-cleanup','*/10 * * * *'),
    ('subscription-reconcile','*/5 * * * *'),
    ('meta-capi-dispatch','* * * * *'),
    ('stream-reconcile','*/5 * * * *'),
    ('media-cleanup','*/5 * * * *'),
    ('notification-dispatch','* * * * *'),
    ('account-deletion-worker','*/5 * * * *')
  ) as jobs(name,schedule)
  loop
    perform cron.schedule(v_job.name,v_job.schedule,format($job$
      select net.http_post(
        url := (select rtrim(decrypted_secret,'/') from vault.decrypted_secrets where name='supabase_project_url') || '/functions/v1/%s',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
          (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
        body := '{}'::jsonb, timeout_milliseconds := 120000);
    $job$,v_job.name));
  end loop;
end;
$$;
