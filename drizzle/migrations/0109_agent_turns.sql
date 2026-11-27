-- Agent turns (SDD-20261121-agent-turn-metrics, NK-0191): one row per agent turn with how it ended, how long it took,
-- which provider answered and what it cost. Diagnosis only. No request, answer, argument, result or error text is
-- stored: the only text from outside is the provider's model id, cut to 200 characters. Additive.
CREATE TABLE public.agent_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('app', 'telegram')),
  mode text NOT NULL CHECK (mode IN ('chat', 'interview')),
  provider text NOT NULL CHECK (provider IN ('openrouter', 'gemini', 'lovable', 'none')),
  model text CHECK (char_length(model) <= 200),
  attempts integer NOT NULL CHECK (attempts >= 0),
  steps integer CHECK (steps >= 0),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  input_tokens integer CHECK (input_tokens >= 0),
  output_tokens integer CHECK (output_tokens >= 0),
  cost_usd numeric CHECK (cost_usd >= 0),
  -- Vocabulary of the spend ledger (0102) without 'estimate': a turn's cost is what the provider reported or nothing.
  cost_kind text NOT NULL CHECK (cost_kind IN ('measured', 'unknown')),
  outcome text NOT NULL CHECK (outcome IN ('answered', 'proposed', 'empty', 'failed', 'refused')),
  error_status integer,
  proposed_count integer NOT NULL DEFAULT 0 CHECK (proposed_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Unknown is an empty cost, never zero; a measured cost is never empty.
  CONSTRAINT agent_turns_cost_matches_kind CHECK ((cost_kind = 'measured') = (cost_usd IS NOT NULL))
);
CREATE INDEX agent_turns_org_idx ON public.agent_turns (org_id, created_at DESC);
CREATE INDEX agent_turns_conversation_idx ON public.agent_turns (conversation_id);
-- Supabase's default privileges give anon and authenticated everything on a new table: take it back first.
REVOKE ALL ON public.agent_turns FROM anon, authenticated;
GRANT SELECT, INSERT ON public.agent_turns TO authenticated;
GRANT ALL ON public.agent_turns TO service_role;
ALTER TABLE public.agent_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own turns read" ON public.agent_turns FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY "own turns insert" ON public.agent_turns FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));

-- The turn a tool call or a proposed action belongs to. No foreign key on purpose: the action is inserted during the
-- turn and the turn row at its end, so a reference would reject the insert and break every write tool. Null for
-- anything written outside a turn (autopilot, approved suggestions, MCP).
ALTER TABLE public.agent_tool_calls ADD COLUMN turn_id uuid;
CREATE INDEX agent_tool_calls_turn_idx ON public.agent_tool_calls (turn_id);
ALTER TABLE public.agent_pending_actions ADD COLUMN turn_id uuid;
CREATE INDEX agent_pending_actions_turn_idx ON public.agent_pending_actions (turn_id);
