ALTER TABLE public.integration_usage ALTER COLUMN cost DROP NOT NULL;
ALTER TABLE public.integration_usage ADD COLUMN IF NOT EXISTS operation_id text;
ALTER TABLE public.integration_usage ADD COLUMN IF NOT EXISTS tool text;
ALTER TABLE public.integration_usage ADD COLUMN IF NOT EXISTS volume integer;
ALTER TABLE public.integration_usage ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';
ALTER TABLE public.integration_usage ADD COLUMN IF NOT EXISTS cost_kind text NOT NULL DEFAULT 'estimate' CHECK (cost_kind IN ('measured','estimate','unknown'));
ALTER TABLE public.integration_usage ADD COLUMN IF NOT EXISTS receipt_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS integration_usage_operation_uidx ON public.integration_usage (org_id, operation_id) WHERE operation_id IS NOT NULL;