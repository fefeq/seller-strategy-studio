-- NK-0174: disconnecting keeps the mailbox row (counters, last review) with status 'disconnected'.
ALTER TABLE public.mailbox_links DROP CONSTRAINT IF EXISTS mailbox_links_status_check;
ALTER TABLE public.mailbox_links ADD CONSTRAINT mailbox_links_status_check CHECK (status IN ('active','error','disconnected'));
