import { parseArgs } from "node:util";
import { resolve } from "node:path";
import open from "open";
import { startServer } from "./server/index.js";

const HELP = `xdiff — real-time code diff tracker

Usage:
  xdiff [options]

Options:
  --port <n>     Port to listen on (default: 0 = random free port)
  --ref <ref>    Git ref to diff against (default: HEAD)
  --cached       Diff against the git index instead of a commit
  --no-open      Do not open the browser automatically
  -h, --help     Show this help

Run it at the root of your project. Edits are shown live in the browser.
Press Ctrl+C to stop and free all resources.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      port: { type: "string" },
      ref: { type: "string" },
      cached: { type: "boolean", default: false },
      open: { type: "boolean", default: true },
      help: { type: "boolean", short: "h", default: false },
    },
    allowNegative: true,
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  const root = resolve(process.cwd());
  const port = values.port ? Number.parseInt(values.port, 10) : 0;
  if (Number.isNaN(port)) {
    console.error(`Invalid --port: ${values.port}`);
    process.exitCode = 1;
    return;
  }

  const server = await startServer({
    root,
    port,
    ref: values.ref,
    cached: values.cached,
  });

  const url = `http://localhost:${server.port}`;
  console.log(`\n  xdiff watching ${root}`);
  console.log(`  baseline: ${server.baselineMode}${values.ref ? ` (${values.ref})` : ""}`);
  console.log(`  ➜  ${url}\n`);
  console.log("  Press Ctrl+C to stop.\n");

  if (values.open) {
    open(url).catch(() => {
      console.log("  (could not open browser automatically)");
    });
  }

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n  shutting down…");
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
