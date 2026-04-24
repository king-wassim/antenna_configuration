import fs from "node:fs";

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}

for (const fileName of ["package-lock.json", "yarn.lock"]) {
  try {
    fs.rmSync(fileName, { force: true });
  } catch {
    // Ignore cleanup failures; the install guard still applies.
  }
}