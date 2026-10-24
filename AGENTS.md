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
- Strict TS extras (exactOptionalPropertyTypes, noUncheckedIndexedAccess, etc.) are off: Supabase row/form code was too noisy.
- Data access goes through the browser client with RLS; only AI calls run in server functions (src/lib/ai.functions.ts).
- Multitenant: every tenant table has org_id defaulting to public.current_org() (profiles.current_org_id); RLS filters to the current org + membership, so client queries never pass org_id except in upsert conflict targets.
- Roles are per organization in org_members (user_roles is deprecated); only an org's owner may delete, manage members and invites.
- New orgs are created via the create_organization RPC, which also seeds default segments, integrations, positioning and docs.
- Money uses the org currency via useCurrency(); never hardcode symbols; currency change relabels, never converts.
- Design system (Nokko Edición) lives in src/styles.css (tokens, typography utilities, unlayered global rules: radius 0, card blocks become top rules, a.text-signal is underlined ink); shadcn primitives in src/components/ui are restyled to match, so screens keep semantic classes. Fonts: Jost 500 for headlines/figures and Spline Sans Mono for notes/evidence are the design system binaries in src/fonts (@font-face in styles.css); Schibsted Grotesk via @fontsource. Light theme paper is an off-white (#fafaf7) by product decision; dark theme = .dark on <html>, chosen with ThemeToggle (src/components/theme-toggle.tsx: saved in localStorage "nokko-theme", else system preference; THEME_BOOT inline script in __root avoids a flash). Brand marks in src/components/brand.tsx are copied from the design system SVGs (Brace = line mark ≥32px, Lockup ≥140px wide, Isotipo = solid mark for small sizes and app icons); never redraw them.
- src/lib/ has its own AGENTS.md (domain modules, agent, MCP, metrics); read it before changing files there.
- App shell (src/routes/_authenticated/route.tsx): mobile top bar with ☰/✕ toggle and a left drawer under it (closes on navigation, tap outside, Esc or swipe left), plus a bottom bar (Inicio, Sugerencias, Leads, Pipeline, Agente) below md; the floating agent button is desktop-only. From md the sidebar can be collapsed to a rail (button or ⌘/Ctrl+B, remembered in localStorage). Pages keep pb-28 so content clears the bottom bar; sticky bottom bars sit at bottom-[calc(3.75rem+env(safe-area-inset-bottom))] on mobile. PWA manifest and icons live in public/.
- .env is generated and committed by Lovable Cloud and holds only public values (Supabase URL, project id and the sb_publishable_ key, which ships in the browser bundle anyway; RLS protects the data). Keep it in the repo (Lovable builds from it). Never add secret keys (service_role, sb_secret_, API tokens) to it or to any VITE_ variable: secrets go in Lovable Cloud secrets and are read only in server functions.
- User-facing errors go through errorText() (src/lib/errors.ts, tested): Postgres/PostgREST/auth/network errors → Spanish «qué pasó + qué hacer»; our own Spanish messages pass through. Never toast a raw error.message. Forms that copy a server record merge background refreshes with mergeServerEdits (src/lib/merge-edits.ts) so unsaved edits survive. MCP tool titles live in TITLES (src/lib/mcp/tools/agent-tools.ts) and mirrored in .lovable/mcp/manifest.json.
- Screen headlines (Inicio, Métricas, Pipeline, Leads, Cuentas, Sugerencias) are conclusions computed by pure functions in src/lib/headlines.ts (tested) from data the screen already loads; the section name goes in the eyebrow and the fallback is the section name, never an invented number. Glossary: features in Spanish (Planificador de reuniones, Preparación de llamada, Clínica de casos, Investigación de stakeholders, Brief GTM, Modelos de venta); roles and industry acronyms stay in English.
- Fields that name an existing record (company/account, person, partner, product) use EntityCombobox (src/components/entity-combobox.tsx) and duplicate rules in src/lib/match.ts (tested): link by id, warn before creating a near-duplicate, never merge.
- Big screens keep only route config and layout in the route file; each tab or panel is its own module under src/components/<screen>/ (strategy, account, setup, orchestrator), so files stay reviewable.
- No `as any`: use the generated types (Tables/TablesUpdate), `as unknown as Json` for jsonb writes, and jsonObject/actionTool (src/lib/json.ts, tested) to read jsonb; a casting gap is a narrow typed cast with a reason.
- Confirmations and one-line text prompts use askConfirm/askText (src/components/confirm-dialog.tsx, host mounted in __root), never window.confirm/prompt, so they follow the design system.
- Main screens (Inicio, Cuentas, Pipeline, Leads) read queryOptions from src/hooks/screen-queries.ts (plus meQuery/leadsQuery); their route loaders prepare that cache and the router preloads on intent, so screens open filled.
- GTM diagnosis (archetype + stage filter) is a pure rule in src/lib/gtm-diagnosis.ts (tested); onboarding stores it per user in onboarding_sessions and reuses setup/ai-fill for extraction.
