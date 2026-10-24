// Money-flow layout of the Finance Dashboard (src/lib/sankey-layout.ts), ported as is; only the graph is built
// from Nokko's data: revenue by plan → total → cost to serve and gross margin → costs by type → result.
import { sankey } from "d3-sankey";
import type { SankeyGraph, SankeyNode, SankeyLink } from "d3-sankey";

export type Tone = "revenue" | "gross" | "cost" | "profit" | "loss";

export interface NDef {
  id: string;
  label: string;
  tone: Tone;
  order: number;
  /** Financially correct figure to print, independent of layout geometry. */
  display: number;
}

export interface LDef {
  source: string;
  target: string;
  value: number;
  tone: Tone;
  order: number;
}

export type LayoutNode = SankeyNode<NDef, LDef>;
export type LayoutLink = SankeyLink<NDef, LDef>;

export type FlowPart = { id: string; label: string; value: number };
export type FlowInput = { revenue: FlowPart[]; costToServe: FlowPart[]; opex: FlowPart[] };

export function flowTotals(f: FlowInput) {
  const sum = (xs: FlowPart[]) => xs.reduce((s, x) => s + Math.max(0, x.value), 0);
  const totalRevenue = sum(f.revenue);
  const totalCogs = sum(f.costToServe);
  const totalOpex = sum(f.opex);
  return { totalRevenue, totalCogs, grossProfit: totalRevenue - totalCogs, totalOpex, operatingIncome: totalRevenue - totalCogs - totalOpex };
}

/** Money-flow graph: revenue merges into one trunk, then splits into costs and the result. */
export function buildFlowGraph(f: FlowInput): { nodes: NDef[]; links: LDef[] } {
  const a = flowTotals(f);
  const min = 1; // keep every ribbon renderable
  const revenueNodes: NDef[] = (f.revenue.length ? f.revenue : [{ id: "rev-none", label: "Sin ingresos", value: 0 }]).map((r, i) => ({ id: `rev-${r.id}`, label: r.label, tone: "revenue", order: i, display: r.value }));
  const cogsNodes: NDef[] = f.costToServe.map((c, i) => ({ id: `cogs-${c.id}`, label: c.label, tone: "cost", order: 20 + i, display: c.value }));
  const opexNodes: NDef[] = f.opex.map((c, i) => ({ id: `opex-${c.id}`, label: c.label, tone: "cost", order: 40 + i, display: c.value }));
  const nodes: NDef[] = [
    ...revenueNodes,
    { id: "revenue", label: "Ingresos", tone: "gross", order: 10, display: a.totalRevenue },
    { id: "cogs", label: "Coste de servir", tone: "cost", order: 11, display: a.totalCogs },
    { id: "gross", label: "Margen bruto", tone: "gross", order: 12, display: a.grossProfit },
    ...cogsNodes, ...opexNodes,
  ];
  const links: LDef[] = [
    ...revenueNodes.map((n) => ({ source: n.id, target: "revenue", value: Math.max(min, n.display), tone: "revenue" as const, order: n.order })),
    { source: "revenue", target: "cogs", value: Math.max(min, a.totalCogs), tone: "cost", order: 10 },
    { source: "revenue", target: "gross", value: Math.max(min, a.grossProfit), tone: "gross", order: 11 },
    ...cogsNodes.map((n) => ({ source: "cogs", target: n.id, value: Math.max(min, n.display), tone: "cost" as const, order: n.order })),
    ...opexNodes.map((n) => ({ source: "gross", target: n.id, value: Math.max(min, n.display), tone: "cost" as const, order: n.order })),
  ];
  if (a.operatingIncome >= 0) {
    nodes.push({ id: "income", label: "Resultado", tone: "profit", order: 60, display: a.operatingIncome });
    links.push({ source: "gross", target: "income", value: Math.max(min, a.operatingIncome), tone: "profit", order: 60 });
  } else {
    // A loss has to be funded from somewhere: it enters from cash, which also keeps the diagram in balance.
    nodes.push({ id: "drawdown", label: "Pagado con caja", tone: "loss", order: 5, display: Math.abs(a.operatingIncome) });
    links.push({ source: "drawdown", target: "gross", value: Math.max(min, Math.abs(a.operatingIncome)), tone: "loss", order: 9.5 });
  }
  return { nodes, links };
}

export interface NodeSnap {
  id: string;
  label: string;
  tone: Tone;
  depth: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  value: number;
  display: number;
}

export interface LinkSnap {
  key: string;
  source: string;
  target: string;
  tone: Tone;
  /** ribbon endpoints */
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  width: number;
  value: number;
}

export interface Snapshot {
  nodes: Record<string, NodeSnap>;
  links: Record<string, LinkSnap>;
  order: string[];
  nodeOrder: string[];
  maxDepth: number;
}

export function computeLayout(
  graph: { nodes: NDef[]; links: LDef[] },
  width: number,
  height: number,
  nodeWidth = 12,
  nodePadding = 16,
): Snapshot {
  const gen = sankey<NDef, LDef>()
    .nodeId((d) => d.id)
    .nodeWidth(nodeWidth)
    .nodePadding(nodePadding)
    .nodeSort((a, b) => (a as NDef).order - (b as NDef).order)
    .linkSort((a, b) => (a as LDef).order - (b as LDef).order)
    .extent([
      [0, 6],
      [width, height - 6],
    ]);

  const g: SankeyGraph<NDef, LDef> = gen({
    nodes: graph.nodes.map((n) => ({ ...n })),
    links: graph.links.map((l) => ({ ...l })),
  });

  const nodes: Record<string, NodeSnap> = {};
  const nodeOrder: string[] = [];
  let maxDepth = 0;
  for (const n of g.nodes as LayoutNode[]) {
    maxDepth = Math.max(maxDepth, n.depth ?? 0);
    nodes[n.id] = {
      id: n.id,
      label: n.label,
      tone: n.tone,
      depth: n.depth ?? 0,
      x0: n.x0 ?? 0,
      x1: n.x1 ?? 0,
      y0: n.y0 ?? 0,
      y1: n.y1 ?? 0,
      value: n.value ?? 0,
      display: n.display,
    };
    nodeOrder.push(n.id);
  }

  const links: Record<string, LinkSnap> = {};
  const order: string[] = [];
  for (const l of g.links as LayoutLink[]) {
    const s = l.source as LayoutNode;
    const t = l.target as LayoutNode;
    const key = `${s.id}->${t.id}`;
    links[key] = {
      key,
      source: s.id,
      target: t.id,
      tone: l.tone,
      sx: s.x1 ?? 0,
      sy: l.y0 ?? 0,
      tx: t.x0 ?? 0,
      ty: l.y1 ?? 0,
      width: l.width ?? 0,
      value: l.value as number,
    };
    order.push(key);
  }

  return { nodes, links, order, nodeOrder, maxDepth };
}

/** A layout with every ribbon collapsed to zero width — the reveal's start frame. */
export function collapse(snap: Snapshot): Snapshot {
  const links: Record<string, LinkSnap> = {};
  for (const k of snap.order) {
    links[k] = { ...snap.links[k], width: 0, value: 0 };
  }
  const nodes: Record<string, NodeSnap> = {};
  for (const k of snap.nodeOrder) {
    const n = snap.nodes[k];
    const mid = (n.y0 + n.y1) / 2;
    nodes[k] = { ...n, y0: mid, y1: mid, value: 0, display: 0 };
  }
  return { ...snap, nodes, links };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function interpolate(from: Snapshot, to: Snapshot, t: number): Snapshot {
  const nodes: Record<string, NodeSnap> = {};
  for (const id of to.nodeOrder) {
    const b = to.nodes[id];
    const a = from.nodes[id] ?? b;
    nodes[id] = {
      ...b,
      x0: lerp(a.x0, b.x0, t),
      x1: lerp(a.x1, b.x1, t),
      y0: lerp(a.y0, b.y0, t),
      y1: lerp(a.y1, b.y1, t),
      value: lerp(a.value, b.value, t),
      display: lerp(a.display, b.display, t),
    };
  }

  const links: Record<string, LinkSnap> = {};
  for (const k of to.order) {
    const b = to.links[k];
    const a = from.links[k] ?? b;
    links[k] = {
      ...b,
      sx: lerp(a.sx, b.sx, t),
      sy: lerp(a.sy, b.sy, t),
      tx: lerp(a.tx, b.tx, t),
      ty: lerp(a.ty, b.ty, t),
      width: lerp(a.width, b.width, t),
      value: lerp(a.value, b.value, t),
    };
  }

  return { ...to, nodes, links };
}

/** Variable-width horizontal ribbon between two node faces. */
export function ribbonPath(l: LinkSnap): string {
  const w = Math.max(0.4, l.width) / 2;
  const cx = (l.sx + l.tx) / 2;
  const t0 = l.sy - w;
  const t1 = l.ty - w;
  const b0 = l.sy + w;
  const b1 = l.ty + w;
  return [
    `M${l.sx},${t0}`,
    `C${cx},${t0} ${cx},${t1} ${l.tx},${t1}`,
    `L${l.tx},${b1}`,
    `C${cx},${b1} ${cx},${b0} ${l.sx},${b0}`,
    "Z",
  ].join(" ");
}

/** Centreline of a ribbon — used for the travelling highlight dash. */
export function centrePath(l: LinkSnap): string {
  const cx = (l.sx + l.tx) / 2;
  return `M${l.sx},${l.sy} C${cx},${l.sy} ${cx},${l.ty} ${l.tx},${l.ty}`;
}

/**
 * Every link on the end-to-end path through a given link: walk all the way
 * upstream from its source and all the way downstream from its target.
 */
export function tracePath(snap: Snapshot, linkKey: string): Set<string> {
  const out = new Set<string>([linkKey]);
  const inbound = new Map<string, string[]>();
  const outbound = new Map<string, string[]>();
  for (const k of snap.order) {
    const l = snap.links[k];
    if (!outbound.has(l.source)) outbound.set(l.source, []);
    outbound.get(l.source)!.push(k);
    if (!inbound.has(l.target)) inbound.set(l.target, []);
    inbound.get(l.target)!.push(k);
  }

  const up = (nodeId: string) => {
    for (const k of inbound.get(nodeId) ?? []) {
      if (out.has(k)) continue;
      out.add(k);
      up(snap.links[k].source);
    }
  };
  const down = (nodeId: string) => {
    for (const k of outbound.get(nodeId) ?? []) {
      if (out.has(k)) continue;
      out.add(k);
      down(snap.links[k].target);
    }
  };

  up(snap.links[linkKey].source);
  down(snap.links[linkKey].target);
  return out;
}

export function nodesOnPath(snap: Snapshot, keys: Set<string>): Set<string> {
  const s = new Set<string>();
  for (const k of keys) {
    s.add(snap.links[k].source);
    s.add(snap.links[k].target);
  }
  return s;
}
