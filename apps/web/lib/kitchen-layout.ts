import {
  kitchenBusinessDate,
  kitchenCelebrations,
  type KitchenBoardData,
  type KitchenEmployee,
  type KitchenCelebration,
} from "../../../packages/domain/src/kitchen-board";

export type KitchenKind =
  | "org"
  | "crew"
  | "birthdays"
  | "anniversaries"
  | "news";
export type CrewGroup = {
  label: string;
  tone: string;
  people: KitchenEmployee[];
};
export type OrgBranch = {
  executive: KitchenEmployee;
  leader: KitchenEmployee | null;
  label: string | null;
  people: KitchenEmployee[];
  installation: boolean;
  standalone?: boolean;
  secondary?: boolean;
};
export type KitchenSlide = {
  id: string;
  kind: KitchenKind;
  page: number;
  pages: number;
  events?: KitchenCelebration[];
  columns?: CrewGroup[][];
  branches?: OrgBranch[];
};
export const KITCHEN_SCREEN_MS = 20_000;
export const KITCHEN_INSIDER_MS = 45_000;
const rank = (person: KitchenEmployee) =>
  /\bCEO\b|chief executive/i.test(person.title)
    ? 0
    : /\bCOO\b|chief operating/i.test(person.title)
      ? 1
      : /\bCFO\b|chief financial/i.test(person.title)
        ? 2
        : 3;

export function kitchenLeadership(employees: KitchenEmployee[]) {
  const reports = (id: string) =>
    employees.filter((person) => person.managerId === id);
  const roots = employees
    .filter((person) => !person.managerId && !person.orgStandalone)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const installationManager =
    employees.find((person) => /installation manager/i.test(person.title)) ??
    null;
  const branches: OrgBranch[] = [];
  for (const executive of roots) {
    const direct = reports(executive.id);
    const service = direct.filter((person) =>
      /hvac.*service|service.*hvac/i.test(person.title),
    );
    const accounting = direct.filter((person) =>
      /accounting|accountant/i.test(person.title),
    );
    const ordinary = direct.filter(
      (person) => !service.includes(person) && !accounting.includes(person),
    );
    for (const leader of ordinary) {
      branches.push({
        executive,
        leader,
        label: leader.orgDepartmentLabel ?? null,
        people: reports(leader.id),
        installation: leader.id === installationManager?.id,
        secondary: Boolean(leader.orgSecondary),
      });
    }
    if (service.length)
      branches.push({
        executive,
        leader: null,
        label: "HVAC Service",
        people: service,
        installation: false,
      });
    if (accounting.length) {
      accounting.sort(
        (a, b) =>
          Number(/manager/i.test(b.title)) - Number(/manager/i.test(a.title)),
      );
      const leader = accounting[0]!;
      branches.push({
        executive,
        leader,
        label: null,
        people: [...accounting.slice(1), ...reports(leader.id)],
        installation: false,
      });
    }
    if (!direct.length)
      branches.push({
        executive,
        leader: null,
        label: "Team",
        people: [],
        installation: false,
      });
  }
  // Keep each executive's branches together and match the leadership order.
  const branchRank = (branch: OrgBranch) =>
    branch.label === "HVAC Service"
      ? 3
      : /human resources|accounting/i.test(branch.leader?.title ?? "")
        ? 0
        : branch.installation
          ? 1
          : 2;
  branches.sort(
    (a, b) =>
      roots.indexOf(a.executive) - roots.indexOf(b.executive) ||
      branchRank(a) - branchRank(b),
  );
  for (const leader of employees.filter((person) => person.orgStandalone)) {
    branches.push({
      executive: leader,
      leader,
      label: leader.orgDepartmentLabel ?? leader.department,
      people: reports(leader.id),
      installation: false,
      standalone: true,
    });
  }
  const totalReports = (id: string) => {
    const visited = new Set([id]);
    const queue = [...reports(id)];
    for (let index = 0; index < queue.length; index++) {
      const person = queue[index]!;
      if (visited.has(person.id)) continue;
      visited.add(person.id);
      queue.push(...reports(person.id));
    }
    return visited.size - 1;
  };
  return { roots, branches, installationManager, reports, totalReports };
}

export function kitchenCrewGroups(people: KitchenEmployee[]): CrewGroup[] {
  const groups: CrewGroup[] = [
    { label: "HVAC lead installers", tone: "orange", people: [] },
    { label: "HVAC helpers", tone: "cyan", people: [] },
    { label: "Plumbing", tone: "blue", people: [] },
    { label: "Electrical", tone: "cyan", people: [] },
    { label: "Permits, inspections, warranty", tone: "orange", people: [] },
    { label: "Installation team", tone: "blue", people: [] },
  ];
  for (const person of people) {
    const title = person.title;
    const index = /permit|inspection|warranty|recalls/i.test(title)
      ? 4
      : /plumb/i.test(title)
        ? 2
        : /electri/i.test(title)
          ? 3
          : /lead.*install|install.*lead/i.test(title)
            ? 0
            : /helper/i.test(title)
              ? 1
              : 5;
    groups[index]!.people.push(person);
  }
  return groups.filter((group) => group.people.length);
}

export function kitchenCrewColumns(groups: CrewGroup[]) {
  const columns: CrewGroup[][] = [];
  for (const group of groups) {
    const size =
      group.label === "HVAC helpers"
        ? Math.min(9, Math.ceil(group.people.length / 2))
        : 9;
    const count = Math.ceil(group.people.length / size);
    for (let page = 0; page < count; page++) {
      const chunk = {
        ...group,
        label: `${group.label}${count > 1 ? ` · ${page + 1} of ${count}` : ""}`,
        people: group.people.slice(page * size, (page + 1) * size),
      };
      const previous = columns.at(-1);
      const previousRows =
        previous?.reduce((sum, section) => sum + section.people.length, 0) ?? 0;
      if (
        group.label === "Permits, inspections, warranty" &&
        previous?.[0]?.label === "Electrical" &&
        previousRows + chunk.people.length <= 8
      )
        previous.push(chunk);
      else columns.push([chunk]);
    }
  }
  return columns;
}

export function buildKitchenSlides(
  data: KitchenBoardData,
  now: Date,
  hasInsider = true,
): KitchenSlide[] {
  const { branches, installationManager, reports } = kitchenLeadership(
    data.directory.employees,
  );
  // Reserve the lower department row beneath that executive's primary team.
  // Further reports continue on another org page instead of crossing its cards.
  const secondaryExecutives = new Set(
    branches
      .filter((branch) => branch.secondary)
      .map((branch) => branch.executive.id),
  );
  const pageSize = (branch: OrgBranch) =>
    secondaryExecutives.has(branch.executive.id) && !branch.secondary ? 4 : 9;
  const orgPages = Math.max(
    1,
    ...branches.map((branch) =>
      branch.installation
        ? 1
        : Math.ceil(branch.people.length / pageSize(branch)),
    ),
  );
  const slides: KitchenSlide[] = Array.from(
    { length: orgPages },
    (_, index) => ({
      id: `org-${index}`,
      kind: "org",
      page: index + 1,
      pages: orgPages,
      branches: branches.map((branch) => ({
        ...branch,
        people: branch.installation
          ? branch.people
          : branch.people.slice(
              index * pageSize(branch),
              (index + 1) * pageSize(branch),
            ),
      })),
    }),
  );
  if (installationManager) {
    const columns = kitchenCrewColumns(
      kitchenCrewGroups(reports(installationManager.id)),
    );
    const pages = Math.max(1, Math.ceil(columns.length / 5));
    for (let index = 0; index < pages; index++)
      slides.push({
        id: `crew-${index}`,
        kind: "crew",
        page: index + 1,
        pages,
        columns: columns.slice(index * 5, (index + 1) * 5),
      });
  }
  const celebrations = kitchenCelebrations(
    data.directory.employees,
    now,
    data.timezone,
  );
  for (const kind of ["birthdays", "anniversaries"] as const) {
    const events = celebrations[kind];
    const size = kind === "birthdays" ? 8 : 4;
    const pages = Math.ceil(events.length / size);
    for (let index = 0; index < pages; index++)
      slides.push({
        id: `${kind}-${index}`,
        kind,
        page: index + 1,
        pages,
        events: events.slice(index * size, (index + 1) * size),
      });
  }
  if (hasInsider) slides.push({ id: "news", kind: "news", page: 1, pages: 1 });
  return slides;
}

export function kitchenMonthKey(now: Date, timezone: string) {
  const date = kitchenBusinessDate(now, timezone);
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}
