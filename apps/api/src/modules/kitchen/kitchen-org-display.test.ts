import { describe, expect, it } from "vitest";
import { normalizeKitchenDirectory } from "@irbis/domain";
import {
  applyKitchenOrgDisplay,
  kitchenPresentationDirectory,
} from "./kitchen-org-display";
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
  it("places Marketing and Customer Service under Tim, including a later Rippling contact, without changing the HR source", () => {
    const source = normalizeKitchenDirectory(
      [
        {
          id: "tim",
          user_id: "t",
          title: "Chief Operating Officer",
          status: "ACTIVE",
        },
        {
          id: "emil",
          user_id: "e",
          title: "Marketing Director",
          manager_id: "another-manager",
          status: "ACTIVE",
        },
      ],
      [
        { id: "t", display_name: "Tim Alagushov" },
        { id: "e", display_name: "Emil Sultanaliev" },
      ],
      [],
    );
    const before = structuredClone(source);
    const board = applyKitchenOrgDisplay(source);
    const contacts = board.employees.filter((person) => person.orgSecondary);
    expect(contacts.map((person) => person.name)).toEqual([
      "Emil Sultanaliev",
      "Adele Aldyrakhmanova",
    ]);
    expect(
      contacts.every(
        (person) => person.managerId === "tim" && !person.orgStandalone,
      ),
    ).toBe(true);
    expect(contacts.find((person) => person.id === "emil")?.title).toBe(
      "Marketing Director",
    );
    expect(source).toEqual(before);
    expect(applyKitchenOrgDisplay(board).employees).toHaveLength(
      board.employees.length,
    );
    const legacy = kitchenPresentationDirectory(board);
    expect(
      legacy.employees
        .filter((person) => person.orgStandalone)
        .map((person) => person.name),
    ).toEqual(["Emil Sultanaliev", "Adele Aldyrakhmanova"]);
    expect(
      legacy.employees.filter((person) => person.managerId === "tim"),
    ).toHaveLength(0);
    expect(legacy.employees).toHaveLength(board.employees.length);
    expect(
      kitchenPresentationDirectory(board, "2").employees.filter(
        (person) => person.managerId === "tim",
      ),
    ).toHaveLength(2);
    expect(
      board.employees
        .filter((person) => person.orgSecondary)
        .every((person) => person.managerId === "tim"),
    ).toBe(true);
  });
});
