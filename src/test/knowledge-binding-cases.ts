// SDD-20261109-rules-write-permissions (NK-0095), CA-7: one table of cases for «binding document» and «who may write it».
// src/lib/knowledge-rules.test.ts runs it through isBindingDoc / canWriteBinding (TypeScript) and
// src/lib/knowledge-binding.pg.test.ts through knowledge_doc_is_binding and the RLS policies (SQL), so the two never diverge.
// Fictional values only.

export type BindingCase = {
  name: string;
  section: string;
  scope: "team" | "personal";
  mandatory: boolean;
  /** Read by the agent of the whole team: only Owner or Sales Leader may write it. */
  binding: boolean;
};

export const BINDING_CASES: BindingCase[] = [
  { name: "team rule", section: "rules", scope: "team", mandatory: false, binding: true },
  { name: "team rule marked", section: "rules", scope: "team", mandatory: true, binding: true },
  {
    name: "team company doc marked mandatory",
    section: "company",
    scope: "team",
    mandatory: true,
    binding: true,
  },
  {
    name: "team playbook marked mandatory",
    section: "playbooks",
    scope: "team",
    mandatory: true,
    binding: true,
  },
  {
    name: "team company doc",
    section: "company",
    scope: "team",
    mandatory: false,
    binding: false,
  },
  {
    name: "team objections doc",
    section: "objections",
    scope: "team",
    mandatory: false,
    binding: false,
  },
  {
    name: "personal rule",
    section: "rules",
    scope: "personal",
    mandatory: false,
    binding: false,
  },
  {
    name: "personal rule marked",
    section: "rules",
    scope: "personal",
    mandatory: true,
    binding: false,
  },
  {
    name: "personal doc marked mandatory",
    section: "company",
    scope: "personal",
    mandatory: true,
    binding: false,
  },
  {
    name: "personal skill",
    section: "skills",
    scope: "personal",
    mandatory: false,
    binding: false,
  },
];

export type RoleCase = { roles: string[]; canWrite: boolean };

/** Roles of org_members (app_role). Only owner and sales_leader write binding documents. */
export const BINDING_WRITER_CASES: RoleCase[] = [
  { roles: ["owner"], canWrite: true },
  { roles: ["sales_leader"], canWrite: true },
  { roles: ["ae"], canWrite: false },
  { roles: ["sdr"], canWrite: false },
  { roles: ["se"], canWrite: false },
  { roles: ["cs"], canWrite: false },
  { roles: ["marketing"], canWrite: false },
  { roles: ["deal_desk"], canWrite: false },
  { roles: ["enablement"], canWrite: false },
  { roles: [], canWrite: false },
];
