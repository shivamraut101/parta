import { strict as assert } from "node:assert";
import test from "node:test";

import {
  evaluateAdminApiAccess,
  evaluateAdminSetupAccess,
} from "../../src/lib/admin/securityGuards";

test("setup guard rejects missing token", () => {
  const result = evaluateAdminSetupAccess({
    expectedToken: "this-is-a-long-setup-token",
    providedToken: undefined,
    setupAlreadyCompleted: false,
    nodeEnv: "development",
    allowSetupInProduction: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, 401);
});

test("setup guard rejects invalid token", () => {
  const result = evaluateAdminSetupAccess({
    expectedToken: "this-is-a-long-setup-token",
    providedToken: "wrong-token",
    setupAlreadyCompleted: false,
    nodeEnv: "development",
    allowSetupInProduction: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test("setup guard blocks production setup unless explicitly allowed", () => {
  const result = evaluateAdminSetupAccess({
    expectedToken: "this-is-a-long-setup-token",
    providedToken: "this-is-a-long-setup-token",
    setupAlreadyCompleted: false,
    nodeEnv: "production",
    allowSetupInProduction: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test("setup guard blocks once setup is completed", () => {
  const result = evaluateAdminSetupAccess({
    expectedToken: "this-is-a-long-setup-token",
    providedToken: "this-is-a-long-setup-token",
    setupAlreadyCompleted: true,
    nodeEnv: "development",
    allowSetupInProduction: true,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, 409);
});

test("setup guard allows valid token under allowed environment", () => {
  const result = evaluateAdminSetupAccess({
    expectedToken: "this-is-a-long-setup-token",
    providedToken: "this-is-a-long-setup-token",
    setupAlreadyCompleted: false,
    nodeEnv: "development",
    allowSetupInProduction: false,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.status, 200);
});

test("admin API guard returns unauthorized when admin context is missing", () => {
  const result = evaluateAdminApiAccess(null);
  assert.equal(result.allowed, false);
  assert.equal(result.status, 401);
});

test("admin API guard allows authorized admin context", () => {
  const result = evaluateAdminApiAccess({
    adminId: "admin-id",
    email: "admin@example.com",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.status, 200);
});
