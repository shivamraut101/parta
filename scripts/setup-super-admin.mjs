import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const email = process.argv[2];
const password = process.argv[3];
const setupToken = process.argv[4] || process.env.ADMIN_SETUP_TOKEN;

if (!email || !password) {
  console.error("Usage: node scripts/setup-super-admin.mjs <email> <password> [setupToken]");
  process.exit(1);
}

if (!setupToken) {
  console.error("Missing setup token. Provide ADMIN_SETUP_TOKEN or pass token as third argument.");
  process.exit(1);
}

process.env.SUPER_ADMIN_EMAIL = email;
process.env.SUPER_ADMIN_PASSWORD = password;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

try {
  const res = await fetch(`${baseUrl}/api/admin/auth/setup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-setup-token": setupToken,
    },
    body: JSON.stringify({ email, password, setupToken }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("Failed:", json?.error || json);
    process.exit(1);
  }
  console.log(json?.message || "Super admin setup completed.");
} catch (error) {
  console.error("Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
