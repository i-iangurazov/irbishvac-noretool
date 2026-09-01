import { describe, expect, it } from "vitest";
import {
  isAllowedIrbisEmail,
  isPublicAuthPath,
  resolvePublicRequestUrl,
} from "./auth-policy";

describe("IRBIS authentication policy", () => {
  it.each([
    "employee@irbishvac.com",
    "Employee@IRBISHVAC.COM",
    " employee@irbishvac.com ",
  ])("allows a verified IRBIS email value: %s", (email) => {
    expect(isAllowedIrbisEmail(email)).toBe(true);
  });

  it.each([
    "employee@example.com",
    "employee@sub.irbishvac.com",
    "employee@irbishvac.com.example.com",
    "@irbishvac.com",
    "irbishvac.com",
    "",
    null,
    undefined,
  ])("rejects a non-IRBIS email value: %s", (email) => {
    expect(isAllowedIrbisEmail(email)).toBe(false);
  });

  it("keeps only Clerk entry and recovery routes public", () => {
    expect(isPublicAuthPath("/sign-in")).toBe(true);
    expect(isPublicAuthPath("/sign-in/factor-one")).toBe(true);
    expect(isPublicAuthPath("/sign-up")).toBe(true);
    expect(isPublicAuthPath("/access-denied")).toBe(true);
    expect(isPublicAuthPath("/campaigns")).toBe(false);
    expect(isPublicAuthPath("/api/dashboard/campaigns")).toBe(false);
  });

  it("replaces Railway's internal origin while preserving path and query", () => {
    expect(
      resolvePublicRequestUrl(
        "https://0.0.0.0:8080/campaigns?month=2026-09",
        "https://irbisweb-production.up.railway.app",
      ),
    ).toBe(
      "https://irbisweb-production.up.railway.app/campaigns?month=2026-09",
    );
  });

  it("uses the request URL when no public origin is configured", () => {
    expect(resolvePublicRequestUrl("http://localhost:3000/campaigns", undefined)).toBe(
      "http://localhost:3000/campaigns",
    );
  });

  it("rejects non-http public origins", () => {
    expect(() =>
      resolvePublicRequestUrl(
        "http://localhost:3000/campaigns",
        "javascript:alert(1)",
      ),
    ).toThrow("must use HTTP or HTTPS");
  });
});
