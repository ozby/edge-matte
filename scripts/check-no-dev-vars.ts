import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const forbidden: string[] = [];

function walk(dir: string): void {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((entry) => entry.name);
  } catch {
    return;
  }

  for (const name of entries) {
    if (name === ".git" || name === "node_modules") {
      continue;
    }

    const fullPath = join(dir, name);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!stat.isFile()) {
      continue;
    }

    const isEnvFile = (name === ".env" || /^\.env(?:\..+)?$/.test(name)) && name !== ".env.example";
    if (name === ".dev.vars" || /^\.dev\.vars(?:\..+)?$/.test(name) || isEnvFile) {
      forbidden.push(relative(root, fullPath));
    }
  }
}

walk(root);

if (forbidden.length > 0) {
  console.error(
    "ERROR: forbidden .dev.vars or .env files detected. Secrets must be managed by secret providers, not written to disk:",
  );
  for (const file of forbidden) {
    console.log(file);
  }
  process.exit(1);
}

console.log("OK: no forbidden .dev.vars or .env files present in repo working tree");
