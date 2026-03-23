import { spawn } from "node:child_process";

const steps = [
  ...(process.env.RETOOL_DATABASE_URL
    ? [
        {
          label: "Importing Retool parity snapshots",
          command: "pnpm",
          args: ["retool:sync"],
          optional: true
        }
      ]
    : []),
  {
    label: "Refreshing latest ServiceTitan snapshots",
    command: "pnpm",
    args: ["refresh:latest"],
    env: {
      SKIP_UNRESOLVED_REPORTS: process.env.RETOOL_DATABASE_URL ? "true" : "false"
    }
  },
  { label: "Validating stored snapshots", command: "pnpm", args: ["snapshots:validate"] }
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
        `\nWarning: ${message}. Continuing remote sync without Retool parity import.\n`,
      );
    }
  }

  process.stdout.write("\nRemote sync completed successfully.\n");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\nRemote sync failed: ${message}\n`);
  process.exit(1);
});

