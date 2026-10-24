ALTER TABLE public.notification_prefs ADD COLUMN IF NOT EXISTS daily_email boolean NOT NULL DEFAULT true;
ALTER TABLE public.notification_prefs ADD COLUMN IF NOT EXISTS daily_email_hour smallint NOT NULL DEFAULT 8;
ALTER TABLE public.notification_prefs ADD CONSTRAINT notification_prefs_daily_email_hour_check CHECK (daily_email_hour BETWEEN 0 AND 23);
COMMENT ON COLUMN public.notification_prefs.daily_email IS 'Daily briefing email on/off for this person (default on).';
COMMENT ON COLUMN public.notification_prefs.daily_email_hour IS 'Local hour (in timezone) the daily briefing email is sent.';