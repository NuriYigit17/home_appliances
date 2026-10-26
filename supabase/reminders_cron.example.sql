-- Replace both values before running this after deployment.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select vault.create_secret('https://YOUR-APP-DOMAIN', 'home_appliances_app_url');
select vault.create_secret('YOUR-LONG-CRON-SECRET', 'home_appliances_cron_secret');

select cron.schedule(
  'home-appliances-daily-reminders',
  '0 6 * * *', -- 09:00 Europe/Istanbul, which is UTC+3 year-round.
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'home_appliances_app_url') || '/api/cron/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'home_appliances_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $job$
);
