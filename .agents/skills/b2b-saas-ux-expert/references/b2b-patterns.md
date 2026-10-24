# Proven B2B SaaS patterns

Cite the source product in the SDD. Copy the principle, not the visuals.

## Clay: data work that feels like a spreadsheet
- A table is the workspace: each column is an enrichment step, and a cell shows its status (queued, running, found, empty, error) and its source.
- Waterfall enrichment: try provider A, then B, then C. The user states the goal ("get email") and the tool picks the provider.
- Cost shown per column or run before running. A run can be limited to N rows to test first.
- Templates and recipes for common jobs, so the user does not start from a blank table.

## Notion: blocks and progressive disclosure
- Start with a blank page that suggests options ("Start writing, or pick a template"). Power features appear on `/` and on hover.
- The same data has many views (table, board, calendar, list), and saved views are per user.
- Inline editing everywhere. Changes save automatically with a quiet indicator, and there is no Save button for low-risk fields.
- Sidebar structure set by the user, with favourites and a recent list.

## Linear: speed and keyboard
- Command palette (⌘K) that reaches every action. Each shortcut appears next to its menu item, so the user learns it while working.
- Optimistic UI: actions apply instantly and sync in the background.
- Opinionated defaults (cycles, triage) instead of endless configuration. Lists stay dense and readable.
- An inbox or triage step for incoming work, separate from the backlog.

## Attio: a CRM built from the relationship
- Records are built automatically from email and calendar; the user curates instead of typing.
- Each attribute shows where its value came from and when, and values written by the user win over enriched ones.
- Lists with a pipeline view on top of the same records, with no duplicated objects.

## Maze: research and insight delivery
- From question to answer in minutes, with templates matched to the research goal.
- Results arrive as a ready-made report: the key finding first, then the evidence (clips, quotes, percentages).
- Recruitment, testing and analysis in one flow, with clear progress through each stage.

## Stripe: trust and clarity
- Test mode and live mode are clearly separated, so you can try things without risk.
- Each object page has a timeline of events and logs.
- Error messages say what happened, why, and what to do, with a link to the relevant setting.
- Documentation and examples sit inside the product, next to the action.

## Figma, Slack and others
- Multiplayer presence: who is viewing or editing, and comments anchored on the object (Figma).
- Notifications grouped by priority, with per-channel control and quiet hours (Slack).
- Checklist onboarding that disappears once completed (Intercom, Loom).
- An empty state with a single primary action and a small sample (Airtable, HubSpot).

## Anti-patterns to flag
- Modal chains for simple edits; Save buttons on autosave-able fields.
- Dashboards full of vanity charts with no "so what" or next action.
- Settings scattered across several pages for one object.
- Spinners that block the whole screen for work that could run in the background.
- Icon-only actions without labels in dense tables.
- AI output with no source, no edit option and no undo.
