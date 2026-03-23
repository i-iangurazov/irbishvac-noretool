import { execFileSync } from "node:child_process";

const [portArg] = process.argv.slice(2);

if (!portArg) {
  console.error("Usage: node scripts/kill-port.mjs <port>");
  process.exit(1);
}

const port = Number(portArg);
if (!Number.isInteger(port) || port <= 0) {
  console.error(`Invalid port: ${portArg}`);
  process.exit(1);
}

let output = "";

try {
  output = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8"
  }).trim();
} catch {
  console.log(`No listener found on port ${port}`);
  process.exit(0);
}

const pids = [...new Set(output.split(/\s+/u).filter(Boolean))];

if (pids.length === 0) {
  console.log(`No listener found on port ${port}`);
  process.exit(0);
}

try {
  execFileSync("kill", pids, { stdio: "inherit" });
  console.log(`Stopped listener(s) on port ${port}: ${pids.join(", ")}`);
} catch {
  console.error(
    `Found listener(s) on port ${port} (${pids.join(", ")}), but could not stop them automatically. Run "kill ${pids.join(" ")}" in your shell.`,
  );
  process.exit(1);
}
