---
title: Spec - Auditoria Técnica
status: draft
updated: 2025-05-22
---

# Requirements: Technical Audit (Auditoria Técnica)

This initiative enforces the architectural invariants defined in the Architecture Spine across the codebase. The goal is to ensure security (RLS), performance (React Query), and maintainability (Tailwind, Server-side AI).

## Capabilities

### CAP-1: Enforce RLS Multi-tenancy (AD-2)
**Given** the multi-tenant nature of the application,
**When** a user queries data from the client,
**Then** the database must automatically filter records by `org_id` using Row Level Security (RLS) and `public.current_org()`, without relying on client-side `.eq('org_id', orgId)` filters.
- **Target Files**: `drizzle/migrations/*.sql`, `src/hooks/*.ts` (e.g., `src/hooks/use-leads.ts`).

### CAP-2: Enforce React Query for Server State (AD-3)
**Given** the requirement to manage server state efficiently,
**When** a component needs to fetch or mutate data from Supabase,
**Then** it must use `@tanstack/react-query` hooks (`useQuery`, `useMutation`) instead of raw `useEffect` blocks.
- **Target Files**: `src/components/**/*.tsx`, `src/hooks/*.ts`.

### CAP-3: Enforce Server-side AI Execution (AD-4)
**Given** the security risks of client-side AI execution,
**When** the application interacts with LLMs or executes agent tools,
**Then** all logic must run securely on the server (e.g., `src/lib/agent/agent.server.ts`), and no API keys or sensitive tool executions should occur on the client.
- **Target Files**: `src/components/agent.tsx`, `src/lib/agent/*.ts`.

### CAP-4: Enforce Utility-First Styling (AD-5)
**Given** the adoption of Tailwind CSS and shadcn/ui,
**When** styling UI components,
**Then** developers must use Tailwind utility classes and shadcn primitives, avoiding custom `.css` files or complex inline styles.
- **Target Files**: `src/components/**/*.tsx`.

## Out of Scope
- Feature development or UI redesigns.
- Database schema changes unrelated to RLS.
