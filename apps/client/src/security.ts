export interface PublicSecurityConfig {
  turnstile: {
    enabled: boolean;
    siteKey: string | null;
    action: string;
  };
}

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | number;
  reset?: (widgetId?: string | number) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const DEFAULT_CONFIG: PublicSecurityConfig = {
  turnstile: {
    enabled: false,
    siteKey: null,
    action: "upload",
  },
};

const isPublicSecurityConfig = (value: unknown): value is PublicSecurityConfig => {
  if (!value || typeof value !== "object") return false;
  const turnstile = (value as { turnstile?: unknown }).turnstile;
  if (!turnstile || typeof turnstile !== "object") return false;
  const candidate = turnstile as Record<string, unknown>;
  return (
    typeof candidate.enabled === "boolean" &&
    (typeof candidate.siteKey === "string" || candidate.siteKey === null) &&
    typeof candidate.action === "string"
  );
};

export const fetchSecurityConfig = async (): Promise<PublicSecurityConfig> => {
  const response = await fetch("/api/security-config");
  if (!response.ok) {
    throw new Error("Security configuration is unavailable right now. Refresh and try again.");
  }
  const body = (await response.json()) as unknown;
  if (!isPublicSecurityConfig(body)) {
    throw new Error("Security configuration is unavailable right now. Refresh and try again.");
  }
  return body;
};

type SecurityStatus = "pending" | "disabled" | "ready" | "unavailable";

export interface SecurityController {
  ready: Promise<void>;
  getToken: () => string | null;
  requiresToken: () => boolean;
  isPending: () => boolean;
  isUnavailable: () => boolean;
  reset: () => void;
}

export const createSecurityController = (
  container: HTMLElement,
  onChange: () => void,
): SecurityController => {
  let token: string | null = null;
  let widgetId: string | number | null = null;
  let status: SecurityStatus = "pending";
  let config: PublicSecurityConfig = DEFAULT_CONFIG;

  container.hidden = true;

  const ready = fetchSecurityConfig()
    .then((nextConfig) => {
      config = nextConfig;
      if (!config.turnstile.enabled) {
        status = "disabled";
        container.hidden = true;
        return;
      }
      container.hidden = false;
      if (!config.turnstile.siteKey || !window.turnstile) {
        status = "unavailable";
        return;
      }
      widgetId = window.turnstile.render(container, {
        sitekey: config.turnstile.siteKey,
        action: config.turnstile.action,
        callback: (nextToken) => {
          token = nextToken;
          onChange();
        },
        "error-callback": () => {
          token = null;
          onChange();
        },
        "expired-callback": () => {
          token = null;
          onChange();
        },
      });
      status = "ready";
    })
    .catch(() => {
      status = "unavailable";
      container.hidden = true;
    })
    .finally(() => {
      onChange();
    });

  return {
    ready,
    getToken: () => token,
    requiresToken: () => config.turnstile.enabled,
    isPending: () => status === "pending",
    isUnavailable: () => status === "unavailable",
    reset: () => {
      token = null;
      if (widgetId != null) {
        window.turnstile?.reset?.(widgetId);
      }
      onChange();
    },
  };
};
