import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MembershipAccounting } from "./membership-ledger";
import { MembershipSalesTable } from "./membership-controls";
import type { MembershipLedger } from "@irbis/domain";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("searches all invoice pages and keeps unknown payments distinct from zero", async () => {
  const ledger: MembershipLedger = {
    paymentsAvailable: false,
    totals: {
      billed: 100,
      subscription: 100,
      jobs: 0,
      tax: 0,
      applied: null,
      paidInPeriod: null,
      refunds: null,
      outstanding: 100,
      creditBalance: 0,
      otherCredits: null,
    },
    invoices: Array.from({ length: 26 }, (_, i) => ({
      id: String(i),
      number: `INV-${i}`,
      customer: `Customer ${i}`,
      customerId: String(i),
      membershipId: null,
      jobNumber: null,
      date: "2026-09-01",
      kind: "subscription",
      billed: 100,
      subscription: 100,
      jobRevenue: 0,
      tax: 0,
      applied: null,
      paidInPeriod: null,
      refunds: null,
      balance: 100,
      otherCredits: null,
      adjustmentToId: null,
    })),
  };
  await act(async () =>
    root.render(
      <MembershipAccounting ledger={ledger} audit={{ excluded: [] }} />,
    ),
  );
  expect(host.querySelector('[role="status"]')?.textContent).toContain(
    "Payment records are unavailable",
  );
  expect(host.querySelectorAll("tbody tr")).toHaveLength(25);
  const input = host.querySelector<HTMLInputElement>(
    'input[aria-label="Search membership invoices"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "INV-25");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.querySelectorAll("tbody tr")).toHaveLength(1);
  expect(host.querySelector("tbody")?.textContent).toContain("Customer 25");
  expect(host.querySelector("tbody tr td:nth-child(4)")?.textContent).toBe("—");
});

it("defaults to the current team and reveals historical attribution only when selected", async () => {
  const rows = [
    {
      id: "1",
      name: "Current Seller",
      department: "csr" as const,
      active: true,
      newSales: 2,
      renewals: 1,
      goal: 10,
      photoUrl: null,
    },
    {
      id: "2",
      name: "Former Seller",
      department: "csr" as const,
      active: false,
      newSales: 5,
      renewals: 0,
      goal: null,
      photoUrl: null,
    },
  ];
  await act(async () =>
    root.render(
      <MembershipSalesTable
        rows={rows}
        goals={{
          monthlyPerRep: 10,
          perRep: 10,
          representatives: 1,
          total: 10,
          achieved: 2,
        }}
        departmentLabels={{
          csr: "CSR",
          hvac: "HVAC Service",
          "hvac-maintenance": "HVAC Maintenance",
          plumbing: "Plumbing Service",
          other: "Other",
        }}
      />,
    ),
  );
  expect(host.querySelector("tbody")?.textContent).not.toContain(
    "Former Seller",
  );
  const select = host.querySelector<HTMLSelectElement>(
    '[aria-label="Leaderboard team scope"]',
  )!;
  await act(async () => {
    select.value = "all";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.querySelector("tbody")?.textContent).toContain("Former Seller");
  expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
  expect(
    host
      .querySelector(".membership-goal-summary strong")
      ?.textContent?.replace(/\s/g, ""),
  ).toBe("2/10");
});
