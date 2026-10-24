---
name: b2b-saas-ux-expert
description: Senior UX/UI expert for B2B SaaS apps. Audits the whole app (signed-in walkthrough with desktop and mobile screenshots, code, accessibility, usage analytics), writes an SDD of prioritized improvements benchmarked against Clay, Notion, Linear, Attio, Maze, Stripe and Figma, then builds the approved ones. Use for "audita la UX/UI", "revisa el diseño", "mejora la experiencia", "la app es confusa", "fricción", "onboarding", "rediseño", "SDD de mejoras", usability or accessibility review.
---

# B2B SaaS UX/UI expert

Audit like a senior product designer who has shipped B2B tools: judge every screen by whether a busy professional finishes their job faster and trusts the result. Work with the project's own design system: read its tokens, rules and saved memories first. Never impose a house style, because a foreign style breaks consistency and the user's brand decisions.

## Workflow

1. **Context.** Read project memory and AGENTS files, the design system (`src/styles.css` or equivalent, `components/ui`), the route list, the roles and permissions, and the UI language. Write down the 3–5 jobs the product exists for and who does each one (buyer, admin, daily user).
2. **Walkthrough.** Sign in to the preview with the platform's browser-auth flow. For each job, run the real flow: first use, daily task, create, edit, delete or undo, error, empty, and no permission. Capture at 1280px and at 390px. Screenshot every finding and keep the path, because the SDD cites evidence and not opinion.
3. **Code pass.** Look for missing states (loading, empty, error, forbidden), inconsistent components for the same job, hardcoded colors or styles outside the tokens, raw error messages, copy that differs between screens, and dead ends with no next step.
4. **Accessibility.** Check contrast in both themes, keyboard-only completion of the main flows, a visible focus ring, accessible names on icon buttons, tap targets of at least 44px, one `<main>` element and labelled inputs.
5. **Usage data.** If project analytics exist, use them to rank the findings: top pages, drop-offs, device mix. If they don't exist, say so and rank by job frequency × severity.
6. **Benchmark.** For each problem, pick the pattern from `references/b2b-patterns.md` that best solves it and name the product it comes from. Adapt the principle, not the visual look.
7. **SDD.** Write the SDD with `references/sdd-template.md` into `.lovable/plan.md`, in the user's language, and present it for approval. Mark anything that changes business rules, permissions, pricing or data as a decision for the user.
8. **Build.** After approval, implement P0 first, then P1, then P2. Keep each change within the design system. Take before and after screenshots for each item, keep the tests green, and add a test when a rule changes. Report what you verified and what you did not.

## Severity

- **P0 — blocks:** the user cannot finish a core job, loses data, or is misled about state or permissions.
- **P1 — slows:** extra steps, hunting for things, unclear next action, inconsistency that forces relearning.
- **P2 — polish:** visual rhythm, microcopy, delight.

Rank inside each level by frequency × number of roles affected ÷ effort.

## B2B lens (what generic reviews miss)

- Time to first value, per role. An empty workspace must teach the next step and offer sample data or an import.
- Density over decoration in tables: saved views, filters, bulk actions, inline edit, keyboard shortcuts, a command palette.
- Permissions shown, not hidden: explain why an action is unavailable and who can do it.
- Multi-tenant clarity: the current workspace is always visible, and switching never mixes data.
- Trust: undo instead of confirm for reversible actions, confirmations proportional to risk, history, the source of each AI or enriched value, and a visible cost before spending credits.
- Long work runs in the background, with progress and a notification. The interface never freezes.
- Navigation grouped by job, not by feature. On mobile, the app is for checking and deciding, not for heavy editing.
