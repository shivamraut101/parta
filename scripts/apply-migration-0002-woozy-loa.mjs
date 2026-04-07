import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
const migrationPath = path.resolve(process.cwd(), "drizzle/0002_woozy_loa.sql");
const raw = fs.readFileSync(migrationPath, "utf8");
const statements = raw
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

const ignorableErrorCodes = new Set([
  "42710", // duplicate_object
  "42P07", // duplicate_table
  "42701", // duplicate_column
]);

try {
  for (const statement of statements) {
    try {
      await sql.unsafe(statement);
      console.log("OK:", statement.split("\n")[0].slice(0, 120));
    } catch (error) {
      if (ignorableErrorCodes.has(error?.code)) {
        console.log("SKIP", error.code + ":", statement.split("\n")[0].slice(0, 120));
        continue;
      }
      throw error;
    }
  }

  console.log("Migration drizzle/0002_woozy_loa.sql applied successfully.");
} catch (error) {
  console.error("FAILED", error?.code ?? "", error?.message ?? String(error));
  process.exitCode = 1;
} finally {
  await sql.end();
}
