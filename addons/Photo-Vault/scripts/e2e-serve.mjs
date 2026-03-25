import { spawn } from "node:child_process";

function run(cmd, args, opts = {}) {
  return spawn(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts,
  });
}

function onceExit(child) {
  return new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function runOrExit(cmd, args, opts) {
  const child = run(cmd, args, opts);
  const res = await onceExit(child);
  if (res.code !== 0) {
    process.exit(res.code ?? 1);
  }
}

const E2E_ENV = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "test",
  // Allow both common loopback origins for local preview/dev.
  WEB_ORIGIN:
    process.env.WEB_ORIGIN ??
    "http://localhost:3000,http://127.0.0.1:3000",
  // Vite only exposes VITE_* vars to the client bundle.
  // Use IPv4 loopback explicitly to avoid localhost -> ::1 resolution issues.
  VITE_API_URL: process.env.VITE_API_URL ?? "http://127.0.0.1:4000",
};

// Build once so we can run non-watch servers (more deterministic for e2e/CI).
await runOrExit("pnpm", ["-C", "packages/shared", "build"], { env: E2E_ENV });
await runOrExit("pnpm", ["--filter", "@booster-vault/api", "build"], { env: E2E_ENV });
await runOrExit("pnpm", ["--filter", "@booster-vault/web", "build"], { env: E2E_ENV });

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

  setTimeout(() => process.exit(exitCode), 250).unref?.();
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

// API (prod build)
const api = run("pnpm", ["--filter", "@booster-vault/api", "start:prod"], {
  env: {
    ...E2E_ENV,
  },
});
children.add(api);

// Web (preview)
const web = run(
  "pnpm",
  [
    "--filter",
    "@booster-vault/web",
    "exec",
    "vite",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "3000",
    "--strictPort",
  ],
  {
    env: {
      ...E2E_ENV,
    },
  },
);
children.add(web);

const results = await Promise.race(
  Array.from(children).map(async (child) => {
    const res = await onceExit(child);
    return { child, ...res };
  }),
);

shutdown(results.code ?? 0);
