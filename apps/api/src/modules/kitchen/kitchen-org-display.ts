import type { KitchenDirectory, KitchenEmployee } from "@irbis/domain";

/** Board presentation requested by Tim, IT meeting 2026-10-22.
 * Professional identities confirmed in ServiceTitan settings (6747096 / 62024167).
 * Tim's reporting relationship confirmed by Ilias on 2026-10-29. These are
 * board-only additions; never invent employment dates or modify HR source data.
 */
const CONTACTS = [
  { id: "emil-sultanaliev", name: "Emil Sultanaliev", department: "Marketing" },
  {
    id: "adele-aldyrakhmanova",
    name: "Adele Aldyrakhmanova",
    department: "Customer Service",
  },
];
export function applyKitchenOrgDisplay(
  directory: KitchenDirectory,
): KitchenDirectory {
  const employees: KitchenEmployee[] = directory.employees.map((person) =>
    person.id === "6a9596324383c635ed43ff91"
      ? { ...person, title: "Sales Manager", orgDepartmentLabel: "Sales" }
      : { ...person },
  );
  const tim = employees.find(
    (person) => person.name.trim().toLowerCase() === "tim alagushov",
  );
  for (const person of employees) {
    if (/plumbing.*service.*technician/i.test(person.title))
      person.orgDepartmentLabel = "Plumbing Service";
  }
  for (const contact of CONTACTS) {
    const existing = employees.find(
      (person) =>
        person.name.trim().toLowerCase() === contact.name.toLowerCase(),
    );
    if (existing) {
      existing.orgDepartmentLabel = contact.department;
      if (tim) existing.managerId = tim.id;
      existing.orgSecondary = Boolean(tim);
      existing.orgStandalone = !tim && !existing.managerId;
      continue;
    }
    employees.push({
      ...contact,
      title: contact.department,
      managerId: tim?.id ?? null,
      photoUrl: null,
      birthday: null,
      originalHireDate: null,
      orgDepartmentLabel: contact.department,
      orgStandalone: !tim,
      orgSecondary: Boolean(tim),
    });
  }
  return { ...directory, employees };
}

/** Old TV documents predate the second department row. Keep their seven-column
 * contract until they load a client that explicitly supports that presentation.
 */
export function kitchenPresentationDirectory(
  directory: KitchenDirectory,
  presentation?: string,
): KitchenDirectory {
  if (presentation === "2") return directory;
  return {
    ...directory,
    employees: directory.employees.map((person) =>
      person.orgSecondary
        ? {
            ...person,
            managerId: null,
            orgSecondary: false,
            orgStandalone: true,
          }
        : person,
    ),
  };
}
