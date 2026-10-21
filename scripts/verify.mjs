import { spawn } from "node:child_process";
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this script with npm run verify.");
async function run(script, extraEnv = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npm, "run", script], {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${script} exited with ${code}`)),
    );
  });
}
for (const script of ["typecheck", "lint", "test", "build"]) await run(script);
// A free port prevents accidentally testing a development server as production.
await run("test:e2e", { AXIOM_PRODUCTION: "1", CI: "1" });
