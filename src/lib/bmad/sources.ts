// Which Conocimiento documents every Ciclo GTM draft reads, and the list of sources saved with it.
// The reader lives in src/lib/knowledge-rules.ts (SDD-20261106-agent-rules-reader, U-1), shared with the agent, so the
// rules keep a reader when Ciclo GTM is retired. Re-exported here unchanged: 12 rules, 4000 characters each.
export {
  COMPANY_LIMIT,
  MANDATORY_LIMIT,
  MANDATORY_RULE,
  isMandatory,
  knowledgeForAgents,
  type KnowledgeDoc,
} from "@/lib/knowledge-rules";
