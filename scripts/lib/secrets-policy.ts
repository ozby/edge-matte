export const SECRETS_CONFIG_PATH = ".webpresso/secrets.config.json";

export const SECRET_VALUE_PATTERN =
  /(?:^|[\s"'`=:])(?:(?:sk|pk)(?=[-_0-9])|ghp|gho|ghu|ghs|ghr|dp\.st|napi_|pplx-|ctx7sk-)[-_a-zA-Z0-9./+=]{8,}/u;

const ALLOWED_CONFIG_KEYS = new Set(["manager", "projectId", "projectLabel"]);
const FORBIDDEN_CONFIG_KEY =
  /(?:^|_)(?:token|secret|password|api[_-]?key|credential|private[_-]?key)(?:$|_)/iu;
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/u;

const FORBIDDEN_BASENAMES = new Set([
  ".dev.vars",
  ".dev.vars.example",
  "secrets.json",
  "credentials.json",
]);

const FORBIDDEN_BASENAME_PATTERNS = [
  /^\.dev\.vars(?:\..+)?$/u,
  /^\.env(?:\..+)?$/u,
  /^.*\.pem$/u,
  /^.*\.p12$/u,
  /^id_rsa(?:\.pub)?$/u,
];

export type SecretsConfigMetadata = {
  manager: "doppler" | "infisical";
  projectId: string;
  projectLabel?: string;
};

function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/gu, "/");
}

function basename(relativePath: string): string {
  const normalized = normalizePath(relativePath);
  return normalized.split("/").pop() ?? normalized;
}

export function isForbiddenSecretBasename(name: string): boolean {
  if (name === ".env.example") {
    return false;
  }
  if (FORBIDDEN_BASENAMES.has(name)) {
    return true;
  }
  return FORBIDDEN_BASENAME_PATTERNS.some((pattern) => pattern.test(name));
}

/** Secret carrier paths in the working tree (local dev artifacts like `.wrangler/` are allowed). */
export function isForbiddenWorkingTreePath(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  if (normalized === SECRETS_CONFIG_PATH) {
    return false;
  }
  if (isForbiddenSecretBasename(basename(normalized))) {
    return true;
  }
  return normalized === ".webpresso/secrets.json";
}

/** Secret carrier paths that must never be committed (includes tracked `.wrangler/`). */
export function isForbiddenGitPath(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  if (normalized === SECRETS_CONFIG_PATH) {
    return false;
  }
  if (normalized.endsWith("/.git/webpresso/secrets.json")) {
    return false;
  }
  if (isForbiddenSecretBasename(basename(normalized))) {
    return true;
  }
  if (normalized === ".webpresso/secrets.json") {
    return true;
  }
  return normalized.includes("/.wrangler/") || normalized.startsWith(".wrangler/");
}

export function shouldScanGitFileForSecretValues(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  if (normalized.startsWith("test/") || normalized.startsWith("scripts/lib/")) {
    return false;
  }
  return /\.(?:md|ts|tsx|js|mjs|cjs|json|ya?ml|toml|txt|sh)$/iu.test(normalized);
}

export function parseSecretsConfigMetadata(raw: string, sourceLabel: string): SecretsConfigMetadata {
  if (SECRET_VALUE_PATTERN.test(raw)) {
    throw new Error(`${sourceLabel} must not contain secret values`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${sourceLabel}: ${detail}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${sourceLabel} must be a JSON object`);
  }

  const obj = parsed as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      throw new Error(`${sourceLabel}: unexpected key "${key}"`);
    }
    if (FORBIDDEN_CONFIG_KEY.test(key)) {
      throw new Error(`${sourceLabel}: key "${key}" looks like a secret name`);
    }
  }

  if (obj.manager !== "doppler" && obj.manager !== "infisical") {
    throw new Error(`${sourceLabel}: "manager" must be "doppler" or "infisical"`);
  }
  if (typeof obj.projectId !== "string" || obj.projectId.length === 0) {
    throw new Error(`${sourceLabel}: "projectId" must be a non-empty string`);
  }
  if (!PROJECT_ID_PATTERN.test(obj.projectId)) {
    throw new Error(`${sourceLabel}: "projectId" must be a Doppler project slug`);
  }

  const config: SecretsConfigMetadata = { manager: obj.manager, projectId: obj.projectId };
  if (obj.projectLabel !== undefined) {
    if (typeof obj.projectLabel !== "string" || obj.projectLabel.length === 0) {
      throw new Error(`${sourceLabel}: "projectLabel" must be a non-empty string when set`);
    }
    if (SECRET_VALUE_PATTERN.test(obj.projectLabel)) {
      throw new Error(`${sourceLabel} projectLabel must not contain secret values`);
    }
    config.projectLabel = obj.projectLabel;
  }
  return config;
}
