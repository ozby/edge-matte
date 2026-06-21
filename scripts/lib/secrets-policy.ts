export const SECRETS_CONFIG_PATH = ".webpresso/secrets.config.json";

export const SECRET_VALUE_PATTERN =
  /(?:^|[\s"'`=:])(?:(?:sk|pk)(?=[-_0-9])|ghp|gho|ghu|ghs|ghr|dp\.st|napi_|pplx-|ctx7sk-)[-_a-zA-Z0-9./+=]{8,}/u;

const V1_ALLOWED_CONFIG_KEYS = new Set([
  "schemaVersion",
  "providers",
  "profiles",
  "sinks",
  "projectLabel",
]);
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
  profiles?: Record<string, { environment: string }>;
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

export function parseSecretsConfigMetadata(
  raw: string,
  sourceLabel: string,
): SecretsConfigMetadata {
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
  if (obj.schemaVersion === 1) {
    for (const key of Object.keys(obj)) {
      if (!V1_ALLOWED_CONFIG_KEYS.has(key)) {
        throw new Error(`${sourceLabel}: unexpected key "${key}"`);
      }
      if (FORBIDDEN_CONFIG_KEY.test(key)) {
        throw new Error(`${sourceLabel}: key "${key}" looks like a secret name`);
      }
    }
    const providers = obj.providers;
    if (typeof providers !== "object" || providers === null || Array.isArray(providers)) {
      throw new Error(`${sourceLabel}: "providers" must be an object`);
    }
    const defaultProvider = (providers as Record<string, unknown>).default;
    if (
      typeof defaultProvider !== "object" ||
      defaultProvider === null ||
      Array.isArray(defaultProvider)
    ) {
      throw new Error(`${sourceLabel}: "providers.default" must be an object`);
    }
    const provider = defaultProvider as Record<string, unknown>;
    if (provider.type !== "doppler" && provider.type !== "infisical") {
      throw new Error(`${sourceLabel}: "providers.default.type" must be "doppler" or "infisical"`);
    }
    if (typeof provider.project !== "string" || provider.project.length === 0) {
      throw new Error(`${sourceLabel}: "providers.default.project" must be a non-empty string`);
    }
    if (!PROJECT_ID_PATTERN.test(provider.project)) {
      throw new Error(
        `${sourceLabel}: "providers.default.project" must be a valid secret-provider project slug`,
      );
    }

    const config: SecretsConfigMetadata = { manager: provider.type, projectId: provider.project };
    if (obj.projectLabel !== undefined) {
      if (typeof obj.projectLabel !== "string" || obj.projectLabel.length === 0) {
        throw new Error(`${sourceLabel}: "projectLabel" must be a non-empty string when set`);
      }
      if (SECRET_VALUE_PATTERN.test(obj.projectLabel)) {
        throw new Error(`${sourceLabel} projectLabel must not contain secret values`);
      }
      config.projectLabel = obj.projectLabel;
    }
    if (obj.profiles !== undefined) {
      if (
        typeof obj.profiles !== "object" ||
        obj.profiles === null ||
        Array.isArray(obj.profiles)
      ) {
        throw new Error(`${sourceLabel}: "profiles" must be an object when set`);
      }
      const profiles: Record<string, { environment: string }> = {};
      for (const [profileName, profileValue] of Object.entries(
        obj.profiles as Record<string, unknown>,
      )) {
        if (FORBIDDEN_CONFIG_KEY.test(profileName)) {
          throw new Error(`${sourceLabel}: profile name "${profileName}" looks like a secret name`);
        }
        if (
          typeof profileValue !== "object" ||
          profileValue === null ||
          Array.isArray(profileValue)
        ) {
          throw new Error(`${sourceLabel}: profile "${profileName}" must be an object`);
        }
        const environment = (profileValue as Record<string, unknown>).environment;
        if (typeof environment !== "string" || environment.length === 0) {
          throw new Error(
            `${sourceLabel}: profile "${profileName}" must set a non-empty environment`,
          );
        }
        if (SECRET_VALUE_PATTERN.test(environment)) {
          throw new Error(
            `${sourceLabel}: profile "${profileName}" environment must not contain secret values`,
          );
        }
        profiles[profileName] = { environment };
      }
      config.profiles = profiles;
    }
    return config;
  }

  throw new Error(`${sourceLabel}: "schemaVersion" must be 1`);
}
