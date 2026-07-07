import { describe, it, expect, afterEach } from "vitest";
import { requiresMfaForRole, ROLE_AUTH_POLICIES } from "@/lib/roleAuthPolicy";

const originalLocation = window.location;

const setHostname = (hostname: string) => {
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, hostname },
    writable: true,
    configurable: true,
  });
};

afterEach(() => {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

describe("requiresMfaForRole", () => {
  it("enforces MFA for police and admin on deployed hostnames", () => {
    setHostname("aegis-ai.example.org");
    expect(requiresMfaForRole("police")).toBe(true);
    expect(requiresMfaForRole("admin")).toBe(true);
  });

  it("does not require MFA for roles whose policy disables it", () => {
    setHostname("aegis-ai.example.org");
    expect(requiresMfaForRole("survivor")).toBe(false);
    expect(requiresMfaForRole("counselor")).toBe(false);
  });

  it("exempts localhost so development sign-ins are not blocked", () => {
    setHostname("localhost");
    expect(requiresMfaForRole("police")).toBe(false);
    expect(requiresMfaForRole("admin")).toBe(false);
  });

  it("keeps the police policy marked as MFA-required", () => {
    expect(ROLE_AUTH_POLICIES.police.requiresMFA).toBe(true);
  });
});
