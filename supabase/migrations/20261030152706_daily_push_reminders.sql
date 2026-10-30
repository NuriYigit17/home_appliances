create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'home-appliances-daily-push-reminders',
  '0 6 * * *',
  $job$
    select net.http_post(
      url := 'https://khqjabuglobpzfootmum.supabase.co/functions/v1/daily-push-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'home_appliances_cron_secret'
        )
      ),
      body := '{}'::jsonb
    );
  $job$
);
