import { NextResponse } from "next/server";

import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { evaluateAdminSetupAccess } from "@/lib/admin/securityGuards";
import { setupSuperAdmin } from "@/lib/admin/setupSuperAdmin";

const DEFAULT_SETUP_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const DEFAULT_SETUP_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const DEFAULT_SETUP_TOKEN = process.env.ADMIN_SETUP_TOKEN;
const ALLOW_SETUP_IN_PROD = process.env.ALLOW_ADMIN_SETUP_IN_PROD === "true";

async function runSetup({
  email,
  password,
  token,
}: {
  email?: string | null;
  password?: string | null;
  token?: string | null;
}) {
  const hasExistingAdmin =
    (await db.select({ id: adminUsers.id }).from(adminUsers).limit(1)).length > 0;

  const access = evaluateAdminSetupAccess({
    providedToken: token,
    expectedToken: DEFAULT_SETUP_TOKEN,
    setupAlreadyCompleted: hasExistingAdmin,
    nodeEnv: process.env.NODE_ENV,
    allowSetupInProduction: ALLOW_SETUP_IN_PROD,
  });

  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const resolvedEmail = (email ?? DEFAULT_SETUP_EMAIL ?? "").trim();
  const resolvedPassword = (password ?? DEFAULT_SETUP_PASSWORD ?? "").trim();

  if (!resolvedEmail || !resolvedPassword) {
    return NextResponse.json(
      {
        error:
          "Missing credentials. Provide email/password in request body OR set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD.",
      },
      { status: 400 },
    );
  }

  const result = await setupSuperAdmin(resolvedEmail, resolvedPassword);
  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: result.message });
}

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Method not allowed. Use POST with x-admin-setup-token header and setup credentials.",
    },
    { status: 405 },
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email : undefined;
    const password = typeof body?.password === "string" ? body.password : undefined;
    const tokenHeader = req.headers.get("x-admin-setup-token");
    const tokenBody = typeof body?.setupToken === "string" ? body.setupToken : undefined;

    return runSetup({
      email,
      password,
      token: tokenHeader ?? tokenBody,
    });
  } catch (error) {
    console.error("Failed to setup admin:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
