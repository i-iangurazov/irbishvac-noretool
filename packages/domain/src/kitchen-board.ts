export type KitchenEmployee = {
  id: string;
  name: string;
  title: string;
  department: string;
  managerId: string | null;
  photoUrl: string | null;
  photoFallbackUrl?: string | null;
  photoSource?: "cloudflare" | "rippling";
  birthday: { month: number; day: number } | null;
  originalHireDate: string | null;
};

export type KitchenDirectory = {
  employees: KitchenEmployee[];
  quality: {
    missingNames: number;
    missingPhotos: number;
    missingBirthdays: number;
    missingHireDates: number;
    restrictedBirthdays: number;
    restrictedHireDates: number;
    missingDepartments: number;
    unresolvedManagers: number;
  };
};

export type KitchenNews = {
  id: string;
  title: string;
  body: string;
  startsOn: string | null;
  endsOn: string | null;
};

export type KitchenBoardData = {
  directory: KitchenDirectory;
  syncedAt: string | null;
  lastAttemptAt: string | null;
  stale: boolean;
  status: "ready" | "unavailable" | "not_configured";
  timezone: string;
  news: KitchenNews[];
};

type Row = Record<string, unknown>;
const record = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function restricted(row: Row, field: string) {
  const fields = record(row.__meta).redacted_fields;
  return (
    Array.isArray(fields) && fields.some((item) => record(item).name === field)
  );
}

export function parseCalendarDate(value: unknown) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  if (
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  )
    return null;
  return { year, month, day };
}

function photo(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const ordered = [...value].sort(
    (a, b) =>
      Number(record(b).type === "PHOTO") - Number(record(a).type === "PHOTO"),
  );
  for (const item of ordered) {
    try {
      const url = new URL(text(record(item).value));
      if (url.protocol === "https:" && !url.username && !url.password)
        return url.toString();
    } catch {
      /* Missing or invalid photos use initials. */
    }
  }
  return null;
}

/** Only the fields used by the board leave this function. Birth years are discarded. */
export function normalizeKitchenDirectory(
  workers: unknown[],
  users: unknown[],
  departments: unknown[],
): KitchenDirectory {
  const userMap = new Map(
    users.map((value) => {
      const row = record(value);
      return [text(row.id), row];
    }),
  );
  const departmentMap = new Map(
    departments.map((value) => {
      const row = record(value);
      return [text(row.id), text(row.name)];
    }),
  );
  const quality: KitchenDirectory["quality"] = {
    missingNames: 0,
    missingPhotos: 0,
    missingBirthdays: 0,
    missingHireDates: 0,
    restrictedBirthdays: 0,
    restrictedHireDates: 0,
    missingDepartments: 0,
    unresolvedManagers: 0,
  };
  const seen = new Set<string>();
  const employees: KitchenEmployee[] = [];
  for (const value of workers) {
    const worker = record(value);
    const id = text(worker.id);
    if (!id || worker.status !== "ACTIVE" || seen.has(id)) continue;
    seen.add(id);
    const user = userMap.get(text(worker.user_id)) ?? {};
    const name = text(user.display_name) || text(record(user.name).formatted);
    const department = departmentMap.get(text(worker.department_id)) ?? "";
    const photoUrl = restricted(user, "photos") ? null : photo(user.photos);
    const birthdayRestricted = restricted(worker, "date_of_birth");
    const hireDateRestricted = restricted(worker, "original_start_date");
    const birthday = birthdayRestricted
      ? null
      : parseCalendarDate(worker.date_of_birth);
    const hireDate = hireDateRestricted
      ? null
      : parseCalendarDate(worker.original_start_date);
    if (!name) quality.missingNames++;
    if (!photoUrl) quality.missingPhotos++;
    if (!birthday) quality.missingBirthdays++;
    if (!hireDate) quality.missingHireDates++;
    if (!department) quality.missingDepartments++;
    if (birthdayRestricted) quality.restrictedBirthdays++;
    if (hireDateRestricted) quality.restrictedHireDates++;
    employees.push({
      id,
      name: name || "Team member",
      title: text(worker.title) || "Team member",
      department: department || "Department not listed",
      managerId: text(worker.manager_id) || null,
      photoUrl,
      birthday: birthday ? { month: birthday.month, day: birthday.day } : null,
      originalHireDate: hireDate ? text(worker.original_start_date) : null,
    });
  }
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  for (const employee of employees) {
    if (employee.managerId && !byId.has(employee.managerId)) {
      employee.managerId = null;
      quality.unresolvedManagers++;
    }
    // Break cycles, including self-reporting, without losing anyone from the board.
    const visited = new Set([employee.id]);
    let managerId = employee.managerId;
    while (managerId) {
      if (visited.has(managerId)) {
        employee.managerId = null;
        quality.unresolvedManagers++;
        break;
      }
      visited.add(managerId);
      managerId = byId.get(managerId)?.managerId ?? null;
    }
  }
  employees.sort((a, b) => a.name.localeCompare(b.name));
  return { employees, quality };
}

export function kitchenBusinessDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function kitchenDateKey(date: {
  year: number;
  month: number;
  day: number;
}) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export type KitchenCelebration = {
  employee: KitchenEmployee;
  day: number;
  month: number;
  years: number | null;
  isToday: boolean;
};

export function kitchenCelebrations(
  employees: KitchenEmployee[],
  now: Date,
  timezone: string,
) {
  const today = kitchenBusinessDate(now, timezone);
  const birthdays: KitchenCelebration[] = [];
  const anniversaries: KitchenCelebration[] = [];
  const daysInMonth = new Date(
    Date.UTC(today.year, today.month, 0),
  ).getUTCDate();
  for (const employee of employees) {
    const birthday = employee.birthday;
    if (birthday?.month === today.month) {
      // February 29 celebrations fall on February 28 in non-leap years.
      const day = Math.min(birthday.day, daysInMonth);
      birthdays.push({
        employee,
        day,
        month: today.month,
        years: null,
        isToday: day === today.day,
      });
    }
    const hire = parseCalendarDate(employee.originalHireDate);
    if (hire?.month === today.month && hire.year < today.year) {
      const day = Math.min(hire.day, daysInMonth);
      anniversaries.push({
        employee,
        day,
        month: today.month,
        years: today.year - hire.year,
        isToday: day === today.day,
      });
    }
  }
  const order = (a: KitchenCelebration, b: KitchenCelebration) =>
    a.day - b.day || a.employee.name.localeCompare(b.employee.name);
  return {
    birthdays: birthdays.sort(order),
    anniversaries: anniversaries.sort(order),
    today,
  };
}

export type KitchenOrgPage = {
  id: string;
  manager: KitchenEmployee | null;
  employees: KitchenEmployee[];
  page: number;
  pages: number;
};

export function kitchenOrgPages(
  employees: KitchenEmployee[],
  pageSize = 6,
  rootPageSize = pageSize,
): KitchenOrgPage[] {
  const size = Math.max(1, Math.floor(pageSize));
  const pages: KitchenOrgPage[] = [];
  const add = (manager: KitchenEmployee | null, members: KitchenEmployee[]) => {
    const groupSize = manager ? size : Math.max(1, Math.floor(rootPageSize));
    for (let offset = 0; offset < members.length; offset += groupSize) {
      pages.push({
        id: `${manager?.id ?? "roots"}-${offset}`,
        manager,
        employees: members.slice(offset, offset + groupSize),
        page: offset / groupSize + 1,
        pages: Math.ceil(members.length / groupSize),
      });
    }
  };
  add(
    null,
    employees.filter((employee) => !employee.managerId),
  );
  const visit = (manager: KitchenEmployee) => {
    const members = employees.filter(
      (employee) => employee.managerId === manager.id,
    );
    add(manager, members);
    members.forEach(visit);
  };
  employees.filter((employee) => !employee.managerId).forEach(visit);
  return pages;
}

/** Optional content supplied by an agreed source; no editor or fabricated announcements. */
export function kitchenPublishedNews(
  value: unknown,
  now: Date,
  timezone: string,
): KitchenNews[] {
  if (!Array.isArray(value)) return [];
  const today = kitchenDateKey(kitchenBusinessDate(now, timezone));
  return value.slice(0, 100).flatMap((item, index) => {
    const row = record(item);
    const title = text(row.title),
      body = text(row.body);
    if (!title || !body || title.length > 120 || body.length > 1000) return [];
    const startsOn = text(row.startsOn) || null,
      endsOn = text(row.endsOn) || null;
    if (
      (startsOn && !parseCalendarDate(startsOn)) ||
      (endsOn && !parseCalendarDate(endsOn)) ||
      (startsOn && endsOn && startsOn > endsOn) ||
      (startsOn && startsOn > today) ||
      (endsOn && endsOn < today)
    )
      return [];
    return [
      { id: text(row.id) || String(index), title, body, startsOn, endsOn },
    ];
  });
}
