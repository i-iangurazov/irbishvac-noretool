import { describe, expect, it } from "vitest";
import {
  normalizeKitchenDirectory,
  kitchenCelebrations,
  kitchenOrgPages,
  kitchenPublishedNews,
  parseCalendarDate,
} from "./kitchen-board";

const worker = (id: string, extra = {}) => ({
  id,
  user_id: id,
  status: "ACTIVE",
  title: "Technician",
  department_id: "service",
  original_start_date: "2020-02-29",
  date_of_birth: "1992-02-29",
  ...extra,
});
const user = (id: string) => ({
  id,
  display_name: `Person ${id}`,
  photos: [{ value: "https://example.com/photo.jpg" }],
  addresses: ["PRIVATE_ADDRESS"],
  emails: ["private@example.com"],
});
const departments = [{ id: "service", name: "Service" }];

describe("kitchen employee snapshot", () => {
  it("prefers the original photo over a thumbnail regardless of API ordering", () => {
    const directory = normalizeKitchenDirectory(
      [worker("a")],
      [
        {
          ...user("a"),
          photos: [
            { type: "THUMBNAIL", value: "https://example.com/small.jpg" },
            { type: "PHOTO", value: "https://example.com/original.jpg" },
          ],
        },
      ],
      departments,
    );
    expect(directory.employees[0]?.photoUrl).toBe(
      "https://example.com/original.jpg",
    );
  });
  it("uses active employees only and discards unrelated fields and birth years", () => {
    const directory = normalizeKitchenDirectory(
      [
        worker("a"),
        worker("b", { status: "TERMINATED" }),
        worker("c", { status: "HIRED" }),
        worker("a"),
      ],
      [user("a"), user("b")],
      departments,
    );
    expect(directory.employees).toHaveLength(1);
    expect(directory.employees[0]).toMatchObject({
      name: "Person a",
      department: "Service",
      birthday: { month: 2, day: 29 },
      originalHireDate: "2020-02-29",
    });
    const stored = JSON.stringify(directory);
    for (const secret of [
      "1992",
      "PRIVATE_ADDRESS",
      "private@example.com",
      "date_of_birth",
      "emails",
    ])
      expect(stored).not.toContain(secret);
  });

  it("does not substitute a current start date when the original hire date is restricted", () => {
    const directory = normalizeKitchenDirectory(
      [
        worker("a", {
          original_start_date: null,
          start_date: "2026-09-01",
          __meta: {
            redacted_fields: [
              { name: "original_start_date" },
              { name: "date_of_birth" },
            ],
          },
        }),
      ],
      [user("a")],
      departments,
    );
    expect(directory.employees[0]).toMatchObject({
      originalHireDate: null,
      birthday: null,
    });
    expect(directory.quality).toMatchObject({
      restrictedHireDates: 1,
      restrictedBirthdays: 1,
    });
  });

  it("breaks manager cycles, excludes inactive managers and retains every active employee", () => {
    const rows = [
      worker("a", { manager_id: "b" }),
      worker("b", { manager_id: "a" }),
      worker("c", { manager_id: "terminated" }),
      worker("d", { manager_id: "d" }),
    ];
    const directory = normalizeKitchenDirectory(
      rows,
      rows.map((row) => user(row.id)),
      departments,
    );
    const pages = kitchenOrgPages(directory.employees, 2);
    const displayed = pages.flatMap((page) =>
      page.employees.map((employee) => employee.id),
    );
    expect(displayed.sort()).toEqual(["a", "b", "c", "d"]);
    expect(directory.quality.unresolvedManagers).toBe(3);
    expect(pages.every((page) => page.employees.length <= 2)).toBe(true);
  });

  it("handles missing users, departments, and unusable photos without dropping employees", () => {
    const directory = normalizeKitchenDirectory(
      [worker("a")],
      [{ id: "a", photos: [{ value: "javascript:alert(1)" }] }],
      [],
    );
    expect(directory.employees[0]).toMatchObject({
      name: "Team member",
      photoUrl: null,
    });
    expect(directory.quality).toMatchObject({
      missingNames: 1,
      missingPhotos: 1,
      missingDepartments: 1,
    });
  });
});

describe("calendar celebrations", () => {
  it("uses Los Angeles month boundaries and observes February 29 on February 28 in non-leap years", () => {
    const directory = normalizeKitchenDirectory(
      [worker("a")],
      [user("a")],
      departments,
    );
    const result = kitchenCelebrations(
      directory.employees,
      new Date("2027-03-01T00:30:00Z"),
      "America/Los_Angeles",
    );
    expect(result.today).toEqual({ year: 2027, month: 2, day: 28 });
    expect(result.birthdays[0]).toMatchObject({
      day: 28,
      isToday: true,
      years: null,
    });
    expect(result.anniversaries[0]).toMatchObject({
      day: 28,
      isToday: true,
      years: 7,
    });
    const march = kitchenCelebrations(
      directory.employees,
      new Date("2027-03-01T09:00:00Z"),
      "America/Los_Angeles",
    );
    expect(march.birthdays).toEqual([]);
    expect(march.anniversaries).toEqual([]);
  });

  it("shows the milestone reached this month, and excludes zero-year and future anniversaries", () => {
    const directory = normalizeKitchenDirectory(
      [
        worker("a", { original_start_date: "2020-09-30" }),
        worker("b", { original_start_date: "2026-09-10" }),
        worker("c", { original_start_date: "2027-09-10" }),
      ],
      [user("a"), user("b"), user("c")],
      departments,
    );
    expect(
      kitchenCelebrations(
        directory.employees,
        new Date("2026-09-01T12:00:00Z"),
        "America/Los_Angeles",
      ).anniversaries.map((event) => event.years),
    ).toEqual([6]);
  });

  it("rejects impossible calendar dates", () => {
    expect(parseCalendarDate("2025-02-29")).toBeNull();
    expect(parseCalendarDate("2026-04-31")).toBeNull();
    expect(parseCalendarDate("2024-02-29")).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
  });

  it("includes announcements only within their publication dates", () => {
    const now = new Date("2026-09-23T04:00:00Z");
    const news = kitchenPublishedNews(
      [
        {
          id: "today",
          title: "Team update",
          body: "Thanks everyone",
          startsOn: "2026-09-22",
          endsOn: "2026-09-22",
        },
        { title: "Future", body: "Future", startsOn: "2026-09-23" },
        { title: "Expired", body: "Expired", endsOn: "2026-09-21" },
        { title: "Invalid", body: "Invalid", startsOn: "2026-02-30" },
      ],
      now,
      "America/Los_Angeles",
    );
    expect(news.map((item) => item.id)).toEqual(["today"]);
  });
});
