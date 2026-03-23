import { spawn } from "node:child_process";

const steps = [
  { label: "Starting local infra", command: "pnpm", args: ["db:up"] },
  { label: "Generating Prisma client", command: "pnpm", args: ["db:generate"] },
  { label: "Applying Prisma schema", command: "pnpm", args: ["db:push"] },
  { label: "Running refresh pipeline", command: "pnpm", args: ["sync:remote"] }
];

function runStep(step) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n==> ${step.label}\n`);

    const child = spawn(step.command, step.args, {
      stdio: "inherit",
      env: {
        ...process.env,
        ...(step.env ?? {})
      }
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${step.label} exited with signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${step.label} failed with exit code ${code ?? 1}`));
        return;
      }

      resolve(undefined);
    });
  });
}

async function main() {
  for (const step of steps) {
    try {
      await runStep(step);
    } catch (error) {
      if (!step.optional) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `\nWarning: ${message}. Continuing local sync without Retool parity import.\n`,
      );
    }
  }

  process.stdout.write("\nLocal sync completed successfully.\n");
  process.stdout.write("Next step: run `pnpm dev` to start the app.\n");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\nLocal sync failed: ${message}\n`);
  process.exit(1);
});
