import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function rustCommand(args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  const cargoHome = env.CARGO_HOME ?? join(homedir(), ".cargo");
  const cargo =
    env.CARGO ??
    join(
      cargoHome,
      "bin",
      process.platform === "win32" ? "cargo.exe" : "cargo",
    );
  const executable = existsSync(cargo) ? cargo : "cargo";
  let toolchain = env.AXIOM_RUST_TOOLCHAIN;
  if (process.platform === "win32" && !env.LIB) {
    const vswhere = join(
      env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
      "Microsoft Visual Studio",
      "Installer",
      "vswhere.exe",
    );
    if (existsSync(vswhere)) {
      const installation = execFileSync(
        vswhere,
        ["-latest", "-products", "*", "-property", "installationPath"],
        { encoding: "utf8", windowsHide: true },
      ).trim();
      if (installation) {
        const command =
          'call "' +
          join(installation, "Common7", "Tools", "VsDevCmd.bat") +
          '" -arch=amd64 -host_arch=amd64 >nul && set';
        const output = execSync(command, {
          encoding: "utf8",
          shell: env.ComSpec ?? "cmd.exe",
          windowsHide: true,
        });
        for (const line of output.split(/\r?\n/)) {
          const match = /^(PATH|LIB|INCLUDE|LIBPATH)=(.*)$/i.exec(line);
          if (match)
            env[
              Object.keys(env).find(
                (key) => key.toUpperCase() === match[1].toUpperCase(),
              ) ?? match[1]
            ] = match[2];
        }
        // Rust's host build scripts use the installed x64 MSVC libraries on Windows ARM.
        if (process.arch === "arm64")
          toolchain ??= "stable-x86_64-pc-windows-msvc";
      }
    }
  }
  const prefix = toolchain ? ["+" + toolchain] : [];
  execFileSync(executable, [...prefix, ...args], {
    stdio: "inherit",
    env,
    windowsHide: true,
  });
}
