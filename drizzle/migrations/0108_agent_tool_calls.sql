-- Tool trace: which tool the agent (or an assistant through MCP) called in a turn, how it ended and how long it took.
-- Diagnosis only. No arguments, no results and no error text are stored, so no customer text lands here.
CREATE TABLE public.agent_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'agent' CHECK (source IN ('agent', 'mcp')),
  provider text,
  tool text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('read', 'write')),
  outcome text NOT NULL CHECK (outcome IN ('ok', 'error', 'pending')),
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_tool_calls_org_idx ON public.agent_tool_calls (org_id, created_at DESC);
CREATE INDEX agent_tool_calls_conversation_idx ON public.agent_tool_calls (conversation_id);
GRANT SELECT, INSERT ON public.agent_tool_calls TO authenticated;
GRANT ALL ON public.agent_tool_calls TO service_role;
ALTER TABLE public.agent_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tool calls read" ON public.agent_tool_calls FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY "own tool calls insert" ON public.agent_tool_calls FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));
