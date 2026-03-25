import { spawn } from "node:child_process";

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts,
  });
  return child;
}

function onceExit(child) {
  return new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
}

const passthroughArgs = process.argv.slice(2);

// 1) Build shared once so downstream projects can import built artifacts.
const buildShared = run("pnpm", ["-C", "packages/shared", "build"]);
const buildResult = await onceExit(buildShared);
if (buildResult.code !== 0) {
  process.exit(buildResult.code ?? 1);
}

// 2) Start dev processes in parallel.
const children = new Set();
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    try {
      child.kill("SIGINT");
    } catch {
      // ignore
    }
  }

  // Give processes a moment to flush logs.
  setTimeout(() => process.exit(exitCode), 250).unref?.();
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

const sharedDev = run("pnpm", ["-C", "packages/shared", "dev"]);
children.add(sharedDev);

const apiDev = run("pnpm", ["--filter", "@booster-vault/api", "dev"]);
children.add(apiDev);

// Start background workers (BullMQ processors). Required for exports/jobs.
const apiWorkerDev = run("pnpm", ["--filter", "@booster-vault/api", "dev:worker"]);
children.add(apiWorkerDev);

// Forward CLI args (like --host 0.0.0.0) only to the Vite dev server.
const webDev = run("pnpm", ["--filter", "@booster-vault/web", "dev", "--", ...passthroughArgs]);
children.add(webDev);

const results = await Promise.race(
  Array.from(children).map(async (child) => {
    const res = await onceExit(child);
    return { child, ...res };
  }),
);

// If any process exits early:
// - non-zero => fail fast
// - zero => still shut down others (consistent with previous pnpm -r behavior)
const exitCode = results.code ?? 0;
shutdown(exitCode);
