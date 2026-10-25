import { describe, expect, it } from "vitest";
import { normalizeKitchenDirectory } from "@irbis/domain";
import { applyKitchenOrgDisplay } from "./kitchen-org-display";
describe("requested kitchen org presentation", () => {
  it("adds the requested professional contacts without inventing employment dates or reporting relationships", () => {
    const source = normalizeKitchenDirectory([], [], []);
    const board = applyKitchenOrgDisplay(source);
    expect(board.employees.map((p) => [p.name, p.orgDepartmentLabel])).toEqual([
      ["Emil Sultanaliev", "Marketing"],
      ["Adele Aldyrakhmanova", "Customer Service"],
    ]);
    expect(
      board.employees.every(
        (p) =>
          p.birthday === null &&
          p.originalHireDate === null &&
          p.managerId === null &&
          p.orgStandalone,
      ),
    ).toBe(true);
    expect(source.employees).toHaveLength(0);
  });
  it("applies the meeting’s Sales Manager label to Raymond without changing his HR snapshot or duplicating later Rippling contacts", () => {
    const source = normalizeKitchenDirectory(
      [
        {
          id: "6a9596324383c635ed43ff91",
          user_id: "r",
          title: "Comfort Advisor",
          status: "ACTIVE",
        },
        {
          id: "emil",
          user_id: "e",
          title: "Marketing Director",
          status: "ACTIVE",
        },
      ],
      [
        { id: "r", display_name: "Raymond Porras" },
        { id: "e", display_name: "Emil Sultanaliev" },
      ],
      [],
    );
    const board = applyKitchenOrgDisplay(source);
    expect(
      board.employees.find((p) => p.name === "Raymond Porras")?.title,
    ).toBe("Sales Manager");
    expect(
      source.employees.find((p) => p.name === "Raymond Porras")?.title,
    ).toBe("Comfort Advisor");
    expect(
      board.employees.filter((p) => p.name === "Emil Sultanaliev"),
    ).toHaveLength(1);
  });
});
