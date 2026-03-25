import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// `yaml` is a dependency of the API package, not necessarily the repo root.
// Resolve it from apps/api to work correctly under pnpm.
const requireFromApi = createRequire(
  path.join(repoRoot, "apps", "api", "package.json"),
);
const YAML = requireFromApi("yaml");

function normalizePathPart(p) {
  if (!p) return "";
  return String(p).replace(/^\/+/, "").replace(/\/+$/, "");
}

function joinPaths(...parts) {
  const cleaned = parts
    .filter(Boolean)
    .map((p) => normalizePathPart(p))
    .filter((p) => p.length > 0);
  return "/" + cleaned.join("/");
}

function normalizeOpenApiStylePath(p) {
  return String(p)
    .replace(/\/:([A-Za-z0-9_]+)/g, "/{$1}")
    .replace(/\/+$/g, "")
    .replace(/^$/g, "/");
}

function getDecoratorName(expr) {
  if (ts.isCallExpression(expr)) {
    const callee = expr.expression;
    if (ts.isIdentifier(callee)) return callee.text;
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  }
  return null;
}

function getDecoratorArgumentString(expr) {
  if (!ts.isCallExpression(expr)) return "";
  const arg0 = expr.arguments[0];
  if (!arg0) return "";
  if (ts.isStringLiteral(arg0) || ts.isNoSubstitutionTemplateLiteral(arg0)) {
    return arg0.text;
  }
  if (ts.isObjectLiteralExpression(arg0)) {
    for (const prop of arg0.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : null;
      if (name !== "path") continue;
      const init = prop.initializer;
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
        return init.text;
      }
    }
  }
  return "";
}

function hasGuard(decorators, guardName) {
  for (const d of decorators ?? []) {
    if (!ts.isDecorator(d)) continue;
    const expr = d.expression;
    if (!ts.isCallExpression(expr)) continue;
    const name = getDecoratorName(expr);
    if (name !== "UseGuards") continue;
    for (const arg of expr.arguments) {
      if (ts.isIdentifier(arg) && arg.text === guardName) return true;
      if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
        if (arg.expression.text === guardName) return true;
      }
    }
  }
  return false;
}

function readAllControllerFiles() {
  const base = path.join(repoRoot, "apps", "api", "src");
  const results = [];
  /** @type {string[]} */
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith(".controller.ts")) {
        results.push(full);
      }
    }
  }
  return results;
}

function extractRoutesFromControllers() {
  const files = readAllControllerFiles();
  /** @type {{ method: string, path: string, auth: 'jwt'|'heir'|'public', file: string, controller: string, handler: string }[]} */
  const routes = [];

  for (const file of files) {
    const sourceText = fs.readFileSync(file, "utf8");
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);

    ts.forEachChild(source, (node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;

      const classDecorators = ts.getDecorators(node) ?? [];
      const controllerDecorator = classDecorators.find((d) => {
        const expr = d.expression;
        const name = getDecoratorName(expr);
        return name === "Controller";
      });

      if (!controllerDecorator) return;

      const controllerName = node.name.text;
      const controllerExpr = controllerDecorator.expression;
      const controllerPath = getDecoratorArgumentString(controllerExpr);

      const classUsesJwt = hasGuard(classDecorators, "JwtAuthGuard");
      const classUsesHeir = hasGuard(classDecorators, "HeirAuthGuard");

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !member.name) continue;
        const methodDecorators = ts.getDecorators(member) ?? [];

        let httpMethod = null;
        let methodPath = "";
        for (const d of methodDecorators) {
          const expr = d.expression;
          const name = getDecoratorName(expr);
          if (!name) continue;
          if (["Get", "Post", "Put", "Patch", "Delete"].includes(name)) {
            httpMethod = name.toUpperCase();
            methodPath = getDecoratorArgumentString(expr);
            break;
          }
        }

        if (!httpMethod) continue;

        const handlerName = ts.isIdentifier(member.name)
          ? member.name.text
          : member.name.getText(source);

        const methodUsesJwt = hasGuard(methodDecorators, "JwtAuthGuard");
        const methodUsesHeir = hasGuard(methodDecorators, "HeirAuthGuard");

        const auth = methodUsesHeir || classUsesHeir ? "heir" : methodUsesJwt || classUsesJwt ? "jwt" : "public";
        const fullPath = joinPaths("v1", controllerPath, methodPath);

        routes.push({
          method: httpMethod,
          path: fullPath,
          auth,
          file: path.relative(repoRoot, file),
          controller: controllerName,
          handler: handlerName,
        });
      }
    });
  }

  routes.sort((a, b) => (a.method + " " + a.path).localeCompare(b.method + " " + b.path));
  return routes;
}

function loadOpenApiRoutes() {
  const specPath = path.join(repoRoot, "api", "openapi.yaml");
  const spec = YAML.parse(fs.readFileSync(specPath, "utf8"));
  const rows = [];

  for (const [p, methods] of Object.entries(spec.paths ?? {})) {
    if (!methods || typeof methods !== "object") continue;
    for (const [m, op] of Object.entries(methods)) {
      const up = m.toUpperCase();
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(up)) continue;
      rows.push({ method: up, path: p });
    }
  }

  rows.sort((a, b) => (a.method + " " + a.path).localeCompare(b.method + " " + b.path));
  return rows;
}

function main() {
  const impl = extractRoutesFromControllers();
  const spec = loadOpenApiRoutes();

  const implSet = new Set(
    impl.map((r) => `${r.method} ${normalizeOpenApiStylePath(r.path)}`),
  );
  const specSet = new Set(
    spec.map((r) => `${r.method} ${normalizeOpenApiStylePath(r.path)}`),
  );

  const missingInSpec = [...implSet].filter((k) => !specSet.has(k));
  const extraInSpec = [...specSet].filter((k) => !implSet.has(k));

  console.log(`IMPLEMENTED_ROUTES ${impl.length}`);
  console.log(`OPENAPI_ROUTES ${spec.length}`);

  if (missingInSpec.length) {
    console.log("\nMISSING_IN_OPENAPI");
    for (const k of missingInSpec) {
      const r = impl.find(
        (x) => `${x.method} ${normalizeOpenApiStylePath(x.path)}` === k,
      );
      console.log(`${k}  (${r?.auth ?? "?"})  ${r?.file ?? ""}#${r?.controller}.${r?.handler}`);
    }
  }

  if (extraInSpec.length) {
    console.log("\nEXTRA_IN_OPENAPI");
    for (const k of extraInSpec) console.log(k);
  }

  // Exit non-zero if drift detected (useful in CI)
  if (missingInSpec.length || extraInSpec.length) process.exitCode = 2;
}

main();
