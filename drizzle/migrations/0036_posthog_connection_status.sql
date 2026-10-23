-- Connection status for the PostHog panel; the browser never reads the encrypted key (column grants only).
alter table public.posthog_connections add column if not exists status text not null default 'pending' check (status in ('pending', 'ok', 'error'));
revoke all on public.posthog_connections from anon, authenticated;
grant select (org_id, host, project_id, key_hint, signup_event, activation_event, paid_event, domain_property, status, last_synced_at, last_error, created_at, updated_at) on public.posthog_connections to authenticated;
grant all on public.posthog_connections to service_role;
revoke all on public.product_usage from anon;