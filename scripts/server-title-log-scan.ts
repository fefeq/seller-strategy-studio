// Local audit only. Never import this TypeScript compiler dependency into served code.
import ts from "typescript";

export function titleLogViolations(source: string): number[] {
  const file = ts.createSourceFile("audit.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const carriers = new Set<string>();
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(file);
  const key = (node: ts.Node): string | undefined => {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node)) {
      const parent = key(node.expression);
      return parent ? `${parent}.${node.name.text}` : undefined;
    }
    if (ts.isElementAccessExpression(node)) return key(node.expression);
    return undefined;
  };
  const privateValue = (node: ts.Node): boolean => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === "length") return false;
    const path = key(node);
    if (path && carriers.has(path)) return true;
    if (ts.isPropertyAccessExpression(node) && ["title", "name"].includes(node.name.text)) {
      // Error classification is allowed; customer entities are not error objects.
      const base = key(node.expression) ?? "";
      if (!/^(?:e\d*|err\d*|error\d*|\w*Error)$/.test(base)) return true;
    }
    let found = false;
    ts.forEachChild(node, (child) => { if (privateValue(child)) found = true; });
    return found;
  };
  const mark = (node: ts.Node) => {
    const path = key(node);
    if (!path) return;
    carriers.add(path);
    // Logging the containing object also exposes the assigned member.
    const root = path.split(".")[0];
    if (root) carriers.add(root);
  };
  // Fixed point follows aliases declared before or after the collection mutation.
  let previous = -1;
  while (previous !== carriers.size) {
    previous = carriers.size;
    for (const node of nodes) {
      if (ts.isVariableDeclaration(node) && node.initializer && privateValue(node.initializer)) mark(node.name);
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && privateValue(node.right)) mark(node.left);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          ["push", "unshift", "set", "add"].includes(node.expression.name.text) && node.arguments.some(privateValue)) {
        mark(node.expression.expression);
      }
    }
  }
  return nodes.filter((node): node is ts.CallExpression => ts.isCallExpression(node))
    .filter((node) => ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "console" &&
      ["log", "warn", "error", "info", "debug", "trace"].includes(node.expression.name.text) &&
      node.arguments.some(privateValue))
    .map((node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
}