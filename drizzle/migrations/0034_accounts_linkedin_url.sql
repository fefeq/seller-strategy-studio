-- Apify: the company's LinkedIn page, used to read its recent posts (signals). Typed by people or found by search.
alter table public.accounts add column if not exists linkedin_url text
  check (linkedin_url is null or (linkedin_url ~ '^https://([a-z]+\.)?linkedin\.com/' and length(linkedin_url) <= 300));