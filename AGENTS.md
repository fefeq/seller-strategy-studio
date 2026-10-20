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
- Design system (Nokko Edición) lives in src/styles.css (tokens, typography utilities, unlayered global rules: radius 0, card blocks become top rules, a.text-signal is underlined ink); shadcn primitives in src/components/ui are restyled to match, so screens keep semantic classes. Fonts self-hosted via @fontsource; brand mark in src/components/brand.tsx.
- src/lib/ has its own AGENTS.md (domain modules, agent, MCP, metrics); read it before changing files there.
