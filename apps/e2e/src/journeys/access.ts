export const ACCESS_CLIENT_ID_HEADER = "CF-Access-Client-Id";
export const ACCESS_CLIENT_SECRET_HEADER = "CF-Access-Client-Secret";

export interface ProductionAccessCredentials {
  clientId: string;
  clientSecret: string;
}

const readTrimmed = (value: string | undefined): string => value?.trim() ?? "";

export const readProductionAccessCredentials = (
  env: NodeJS.ProcessEnv = process.env,
): ProductionAccessCredentials | null => {
  const clientId = readTrimmed(env.CF_ACCESS_CLIENT_ID);
  const clientSecret = readTrimmed(env.CF_ACCESS_CLIENT_SECRET);

  if (!clientId && !clientSecret) {
    return null;
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      "Production Access automation requires both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET when either one is set.",
    );
  }

  return { clientId, clientSecret };
};

export const buildProductionAccessHeaders = (env: NodeJS.ProcessEnv = process.env): Headers => {
  const headers = new Headers();
  const credentials = readProductionAccessCredentials(env);
  if (!credentials) {
    return headers;
  }

  headers.set(ACCESS_CLIENT_ID_HEADER, credentials.clientId);
  headers.set(ACCESS_CLIENT_SECRET_HEADER, credentials.clientSecret);
  return headers;
};

export const withProductionAccess = (
  init: RequestInit = {},
  env: NodeJS.ProcessEnv = process.env,
): RequestInit => {
  const accessHeaders = buildProductionAccessHeaders(env);
  if (Array.from(accessHeaders.keys()).length === 0) {
    return init;
  }

  const headers = new Headers(init.headers ?? undefined);
  accessHeaders.forEach((value, key) => headers.set(key, value));
  return { ...init, headers };
};

export const fetchWithProductionAccess = (
  input: URL | RequestInfo,
  init?: RequestInit,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Response> => fetch(input, withProductionAccess(init, env));
