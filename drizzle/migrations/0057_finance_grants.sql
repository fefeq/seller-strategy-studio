GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cost_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_months TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_cost_lines, public.finance_invoices, public.finance_months, public.finance_settings TO service_role;