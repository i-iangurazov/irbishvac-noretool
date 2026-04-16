export type FieldStaffDepartment =
  | "hvac-service"
  | "plumbing-service"
  | "electrical-service"
  | "hvac-comfort-advisor"
  | "hvac-install"
  | "plumbing-install"
  | "electrical-install";

export type FieldStaffSourceFamily = "technicians" | "installers" | "advisors";

export type FieldStaffDepartmentInput = {
  businessUnit?: string | null;
  department?: string | null;
  position?: string | null;
  role?: string | null;
  sourceFamily?: FieldStaffSourceFamily | null;
};

export const FIELD_STAFF_DEPARTMENTS: Record<
  FieldStaffDepartment,
  {
    label: string;
    positionLabels: string[];
  }
> = {
  "hvac-service": {
    label: "HVAC Service Technicians",
    positionLabels: ["HVAC Service Technicians"]
  },
  "plumbing-service": {
    label: "Plumbing Service Technicians",
    positionLabels: ["Plumbing Service Technicians"]
  },
  "electrical-service": {
    label: "Electrical Service Technicians",
    positionLabels: ["Electrical Service Technicians", "Electrical Service Techncians"]
  },
  "hvac-comfort-advisor": {
    label: "HVAC Comfort Advisors",
    positionLabels: ["HVAC Comfort Advisors"]
  },
  "hvac-install": {
    label: "HVAC Installation Technicians",
    positionLabels: ["HVAC Installation Technicians"]
  },
  "plumbing-install": {
    label: "Plumbing Installation Technicians",
    positionLabels: ["Plumbing Installation Technicians", "Plumbing Install Technicians"]
  },
  "electrical-install": {
    label: "Electrical Installation Technicians",
    positionLabels: ["Electrical Installation Technicians", "Electrical Install Technicians"]
  }
};

export const POSITION_FIELD_KEYS = [
  "Position",
  "TechnicianPosition",
  "Technician Position",
  "STPosition",
  "ServiceTitanPosition",
  "JobTitle",
  "Job Title",
  "Title",
  "Role"
];

export const BUSINESS_UNIT_FIELD_KEYS = [
  "TechnicianBusinessUnit",
  "BusinessUnit",
  "Business Unit",
  "Department",
  "Team"
];

export const TECHNICIAN_ID_FIELD_KEYS = [
  "TechnicianId",
  "TechnicianID",
  "Technician ID",
  "TechId",
  "Tech ID",
  "EmployeeId",
  "EmployeeID",
  "Employee ID"
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

type FieldStaffRole = "service" | "install" | "advisor";
type FieldStaffTrade = "hvac" | "plumbing" | "electrical";

function defaultRoleForSource(sourceFamily: FieldStaffSourceFamily | null | undefined): FieldStaffRole | null {
  switch (sourceFamily) {
    case "technicians":
      return "service";
    case "installers":
      return "install";
    case "advisors":
      return "advisor";
    default:
      return null;
  }
}

function departmentForTradeRole(trade: FieldStaffTrade, role: FieldStaffRole): FieldStaffDepartment {
  if (role === "advisor") {
    return "hvac-comfort-advisor";
  }

  if (role === "install") {
    switch (trade) {
      case "plumbing":
        return "plumbing-install";
      case "electrical":
        return "electrical-install";
      default:
        return "hvac-install";
    }
  }

  switch (trade) {
    case "plumbing":
      return "plumbing-service";
    case "electrical":
      return "electrical-service";
    default:
      return "hvac-service";
  }
}

function resolveTrade(text: string): FieldStaffTrade | null {
  if (hasAny(text, ["plumb"])) {
    return "plumbing";
  }

  if (hasAny(text, ["electric"])) {
    return "electrical";
  }

  if (hasAny(text, ["hvac", "heating", "cooling", "air conditioning"])) {
    return "hvac";
  }

  return null;
}

function resolveRole(text: string): FieldStaffRole | null {
  if (
    hasAny(text, [
      "comfort advisor",
      "comfort advisors",
      "sales advisor",
      "sales advisors",
      "advisor",
      "advisors"
    ])
  ) {
    return "advisor";
  }

  if (hasAny(text, ["install", "installer", "installation"])) {
    return "install";
  }

  if (hasAny(text, ["hvac service", "service technician", "service tech", "service"])) {
    return "service";
  }

  return null;
}

function classifyText(
  value: string | null | undefined,
  options: { defaultRole?: FieldStaffRole | null } = {},
): FieldStaffDepartment | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const text = normalizeText(value);
  const role = resolveRole(text) ?? options.defaultRole ?? null;

  if (!role) {
    return null;
  }

  return departmentForTradeRole(resolveTrade(text) ?? "hvac", role);
}

export function normalizeFieldStaffDepartment(
  department: string | null | undefined,
  sourceFamily?: FieldStaffSourceFamily | null,
): FieldStaffDepartment | null {
  if (!department) {
    return null;
  }

  if (department in FIELD_STAFF_DEPARTMENTS) {
    return department as FieldStaffDepartment;
  }

  const sourceDefaultRole = defaultRoleForSource(sourceFamily) ?? "service";

  if (department === "plumbing") {
    return sourceDefaultRole === "install" ? "plumbing-install" : "plumbing-service";
  }

  if (department === "electrical") {
    return sourceDefaultRole === "install" ? "electrical-install" : "electrical-service";
  }

  return null;
}

export function classifyFieldStaffDepartment(
  input: FieldStaffDepartmentInput,
): FieldStaffDepartment | null {
  const defaultRole = defaultRoleForSource(input.sourceFamily);

  return (
    classifyText(input.position) ??
    normalizeFieldStaffDepartment(input.department, input.sourceFamily) ??
    classifyText(input.department, { defaultRole }) ??
    classifyText(input.businessUnit, { defaultRole }) ??
    classifyText(input.role) ??
    (defaultRole ? departmentForTradeRole("hvac", defaultRole) : null)
  );
}

export function readTextField(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null || value === "") {
      continue;
    }

    return String(value);
  }

  return null;
}
