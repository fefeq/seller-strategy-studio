<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Strict TS extras (exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature, noUncheckedIndexedAccess, noImplicitReturns) are off: Supabase row/form code was too noisy under them.
- Data access goes through the browser client with RLS; only AI calls run in server functions (src/lib/ai.functions.ts).
- Multitenant: every tenant table has org_id defaulting to public.current_org() (profiles.current_org_id); RLS filters to the current org + membership, so client queries never pass org_id except in upsert conflict targets.
- Roles are per organization in org_members (user_roles is deprecated); only an org's owner may delete, manage members and invites.
- New orgs are created via the create_organization RPC, which also seeds default segments, integrations, positioning and docs.
- Theory U: route src/routes/_authenticated/theory-u.tsx, one tab per file in src/components/theory-u/, shared pure rules in src/lib/theory-u.ts (tested).
- Self-service funnel: trials table (manual/CSV), cohort maths by signup date in src/lib/self-service.ts (tested).
- Money uses the org currency via useCurrency() (src/hooks/use-me.ts); never hardcode symbols; changing currency relabels, never converts.
- GTM Advisor: the server fn re-checks the caller's org role and the gtm_advisories RLS limits read/insert to owner and sales_leader; the data snapshot sent to the AI is built by pure code in src/lib/advisor.ts (tested) and the model must answer with its strict JSON schema.
- Onboarding data is defined once in src/lib/setup-schema.ts (items, weights, unlocks, completeness); the AI fill, wizard, interview, sidebar meter and proactive detector all read it, so new required data = one new item there.
- The agent's capabilities live in one registry (src/lib/agent/tools.ts): read tools run immediately, write tools only create agent_pending_actions executed after explicit confirmation; every handler scopes by org_id explicitly because Telegram/cron run it with the privileged client.
- Agent turns run server-side via AI SDK Responses (src/lib/agent/agent.server.ts) and return final text; transcripts store only plain user/assistant text so channels (app, Telegram, future WhatsApp) share one core.
- Proactive rules are pure detectors, one file each in src/lib/proactive/detectors/ (tested in src/lib/proactive.test.ts); suggestions dedupe on (org_id, dedupe_key) so dismissed items never return, and actions reuse agent tools.
- Suggestions: members see own + unassigned, owner/sales_leader see and reassign all (RLS); team panel rules pure in src/lib/suggestion-board.ts (tested); "Para mí" filters own/unassigned explicitly.
- The hourly/daily proactive job is /api/public/jobs/proactive (managed cron auth + job_locks lease); Telegram enters through /api/public/telegram/webhook (secret-token check, idempotent on update_id) and users link via one-time codes in channel_links.

- GTM cycle (BMAD analogy): personas, workflows, phases/next-steps, debate levels and ACV tracks are declarative registries in src/lib/bmad/ (pure, tested in src/lib/bmad.test.ts); artifacts live in gtm_artifacts (versioned, only owner/sales_leader approve, approved ones form the company context every agent loads) and drafting is shared by the server fn and the agent tool via src/lib/bmad/drafting.ts.
- Segment coverage: targets in segment_targets, acquisition costs in cac_costs (channel × segment|shared × quarter); coverage/payback maths in src/lib/segment-coverage.ts and real CAC (shared split by deals won) in src/lib/cac.ts, both pure and tested; payback uses real CAC (quarter in Métricas, last 4 quarters via trailingCac in the calculator), falling back to cac_target.
- Lead intake: external tools post to /api/public/leads with a per-company key (only its SHA-256 lives in lead_sources); CSV goes through importLeads. Both share the pure normalizer in src/lib/leads.ts (tested) and the writer src/lib/leads-ingest.ts (account by domain/name → person by email → lead; a sales stage also writes the deal by external_id/open deal), so every entry path dedupes the same way.
- Leads live in the leads table (Nuevo→Contactado→MQL→SQL→Oportunidad/Descartado); a DB trigger stamps first-reached times per stage and creates the Discovery deal when a lead reaches Oportunidad, so UI, intake, agent and MCP convert identically. Delay limits per company in lead_settings; delay rules and the Lead→Ganado funnel are pure in src/lib/lead-funnel.ts (tested) and shared by the Leads screen, Métricas, agent tools and the late_lead detector.
- Real ACV/win rate/cycle come from src/lib/pipeline-real.ts (pure, tested); useLivePipeline in the app shell listens to realtime deal/lead changes and invalidates every deal-based query key, so new reads of deals must use a key listed there.
- External assistants (Claude, ChatGPT, Codex) connect via the app MCP server at /mcp (src/lib/mcp/, @lovable.dev/mcp-js, Lovable Cloud OAuth): tools are generated from the agent registry and run as the OAuth caller with RLS; MCP writes only create agent_pending_actions (source 'mcp') confirmed in Sugerencias.
