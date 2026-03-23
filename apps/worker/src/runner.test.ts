import { describe, expect, it } from "vitest";
import { COMPANY_REFRESH_FAMILIES, PEOPLE_REFRESH_FAMILIES } from "./runner";

describe("worker family registration", () => {
  it("keeps the people pipeline families explicit", () => {
    expect(PEOPLE_REFRESH_FAMILIES).toContain("technicians");
    expect(PEOPLE_REFRESH_FAMILIES).toContain("campaigns");
  });

  it("keeps the company pipeline families explicit", () => {
    expect(COMPANY_REFRESH_FAMILIES).toContain("marketing");
    expect(COMPANY_REFRESH_FAMILIES).toContain("bookingRate");
  });
});
