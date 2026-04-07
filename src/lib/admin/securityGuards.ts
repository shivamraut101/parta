type SetupAccessInput = {
  providedToken?: string | null;
  expectedToken?: string | null;
  setupAlreadyCompleted?: boolean;
  nodeEnv?: string;
  allowSetupInProduction?: boolean;
};

type SetupAccessResult = {
  allowed: boolean;
  status: 200 | 400 | 401 | 403 | 409 | 500;
  reason?: string;
};

type AdminApiAccessResult = {
  allowed: boolean;
  status: 200 | 401;
  reason?: string;
};

export function evaluateAdminSetupAccess({
  providedToken,
  expectedToken,
  setupAlreadyCompleted,
  nodeEnv,
  allowSetupInProduction,
}: SetupAccessInput): SetupAccessResult {
  if (setupAlreadyCompleted) {
    return {
      allowed: false,
      status: 409,
      reason: "Admin setup is already completed.",
    };
  }

  if (!expectedToken || expectedToken.trim().length < 16) {
    return {
      allowed: false,
      status: 500,
      reason:
        "Admin setup token is not configured. Set ADMIN_SETUP_TOKEN to a long random value.",
    };
  }

  if (!providedToken) {
    return {
      allowed: false,
      status: 401,
      reason: "Missing setup token.",
    };
  }

  if (providedToken !== expectedToken) {
    return {
      allowed: false,
      status: 403,
      reason: "Invalid setup token.",
    };
  }

  if (nodeEnv === "production" && !allowSetupInProduction) {
    return {
      allowed: false,
      status: 403,
      reason:
        "Admin setup is blocked in production. Set ALLOW_ADMIN_SETUP_IN_PROD=true to temporarily allow it.",
    };
  }

  return {
    allowed: true,
    status: 200,
  };
}

export function evaluateAdminApiAccess(adminContext: unknown): AdminApiAccessResult {
  if (!adminContext) {
    return {
      allowed: false,
      status: 401,
      reason: "Unauthorized admin access.",
    };
  }

  return {
    allowed: true,
    status: 200,
  };
}
