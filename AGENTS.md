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
- Theory U lives in src/routes/_authenticated/theory-u.tsx with one tab component per file in src/components/theory-u/; phase/level definitions and pure rules in src/lib/theory-u.ts (tested) so UI and AI prompts share them.
- Self-service funnel data lives in the trials table (one row per signup, fed by manual entry/CSV until product/billing syncs exist); funnel maths are cohort-based by signup date in src/lib/self-service.ts (tested) so the metrics UI and future AI snapshots agree.
- Money is shown in the current org's currency (organizations.currency) via useCurrency() from src/hooks/use-me.ts; never hardcode a currency symbol. Changing currency relabels amounts, it does not convert them.
- GTM Advisor: the server fn re-checks the caller's org role and the gtm_advisories RLS limits read/insert to owner and sales_leader; the data snapshot sent to the AI is built by pure code in src/lib/advisor.ts (tested) and the model must answer with its strict JSON schema.
- Onboarding data is defined once in src/lib/setup-schema.ts (items, weights, unlocks, completeness); the AI fill, wizard, interview, sidebar meter and proactive detector all read it, so new required data = one new item there.
- The agent's capabilities live in one registry (src/lib/agent/tools.ts): read tools run immediately, write tools only create agent_pending_actions executed after explicit confirmation; every handler scopes by org_id explicitly because Telegram/cron run it with the privileged client.
- Agent turns run server-side via AI SDK Responses (src/lib/agent/agent.server.ts) and return final text; transcripts store only plain user/assistant text so channels (app, Telegram, future WhatsApp) share one core.
- Proactive rules are pure detectors, one file each in src/lib/proactive/detectors/ (tested in src/lib/proactive.test.ts); suggestions dedupe on (org_id, dedupe_key) so dismissed items never return, and actions reuse agent tools.
- The hourly/daily proactive job is /api/public/jobs/proactive (managed cron auth + job_locks lease); Telegram enters through /api/public/telegram/webhook (secret-token check, idempotent on update_id) and users link via one-time codes in channel_links.

