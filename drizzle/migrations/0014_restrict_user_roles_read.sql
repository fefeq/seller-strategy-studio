DROP POLICY IF EXISTS "roles read" ON public.user_roles;
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);