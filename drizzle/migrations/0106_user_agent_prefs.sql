-- E1: each person's agent level (Guiado / Copiloto / Autopilot). Personal, reversible, default Copiloto.
-- No level lets Nokko send anything on the user's behalf or skip confirmations: enforced in code, not here.
CREATE TABLE public.user_agent_prefs (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  autonomy text NOT NULL DEFAULT 'copilot' CHECK (autonomy IN ('guided', 'copilot', 'autopilot')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_agent_prefs TO authenticated;
GRANT ALL ON public.user_agent_prefs TO service_role;
ALTER TABLE public.user_agent_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent prefs read" ON public.user_agent_prefs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own agent prefs insert" ON public.user_agent_prefs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own agent prefs update" ON public.user_agent_prefs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
