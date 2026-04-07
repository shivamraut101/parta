import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

function loadEnvFile(fileName: string) {
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

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const { getAllShopsWithStats } = await import("../src/lib/admin/adminQueries");

  const iterations = 5;
  const samples: number[] = [];

  // Warm-up to stabilize startup overhead.
  const warmupRows = await getAllShopsWithStats();

  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    const rows = await getAllShopsWithStats();
    const end = performance.now();

    const elapsed = end - start;
    samples.push(elapsed);
    console.log(
      `Run ${i + 1}/${iterations}: ${elapsed.toFixed(2)} ms for ${rows.length} shops`,
    );
  }

  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const min = Math.min(...samples);
  const max = Math.max(...samples);

  console.log("\nAdmin Shops Query Benchmark");
  console.log(`Shops scanned: ${warmupRows.length}`);
  console.log(`Average: ${avg.toFixed(2)} ms`);
  console.log(`Min: ${min.toFixed(2)} ms`);
  console.log(`Max: ${max.toFixed(2)} ms`);

  if (warmupRows.length >= 500 && avg > 2500) {
    console.error(
      "\nBenchmark assertion failed: average query time exceeds 2500ms for 500+ shops.",
    );
    process.exitCode = 1;
  } else if (warmupRows.length < 500) {
    console.warn(
      "\nDataset has fewer than 500 shops. Benchmark numbers are informative but not the 500+ target assertion.",
    );
  }
}

main()
  .catch((error) => {
    console.error("Benchmark failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
