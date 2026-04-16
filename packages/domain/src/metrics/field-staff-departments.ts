export type FieldStaffDepartment =
  | "hvac-service"
  | "plumbing"
  | "hvac-comfort-advisor"
  | "hvac-install"
  | "electrical";

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
  plumbing: {
    label: "Plumbing Service Technicians",
    positionLabels: ["Plumbing Service Technicians"]
  },
  "hvac-comfort-advisor": {
    label: "HVAC Comfort Advisors",
    positionLabels: ["HVAC Comfort Advisors"]
  },
  "hvac-install": {
    label: "HVAC Installation Technicians",
    positionLabels: ["HVAC Installation Technicians"]
  },
  electrical: {
    label: "Electrical Service Technicians",
    positionLabels: ["Electrical Service Technicians", "Electrical Service Techncians"]
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

function defaultDepartmentForSource(sourceFamily: FieldStaffSourceFamily | null | undefined) {
  switch (sourceFamily) {
    case "technicians":
      return "hvac-service";
    case "installers":
      return "hvac-install";
    case "advisors":
      return "hvac-comfort-advisor";
    default:
      return null;
  }
}

function classifyText(
  value: string | null | undefined,
  options: { allowGenericService?: boolean } = {},
): FieldStaffDepartment | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const text = normalizeText(value);

  if (hasAny(text, ["plumb"])) {
    return "plumbing";
  }

  if (hasAny(text, ["electric"])) {
    return "electrical";
  }

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
    return "hvac-comfort-advisor";
  }

  if (hasAny(text, ["install", "installer", "installation"])) {
    return "hvac-install";
  }

  if (
    hasAny(text, ["hvac service"]) ||
    (options.allowGenericService === true &&
      hasAny(text, ["service technician", "service tech", "service"]))
  ) {
    return "hvac-service";
  }

  return null;
}

export function classifyFieldStaffDepartment(
  input: FieldStaffDepartmentInput,
): FieldStaffDepartment | null {
  return (
    classifyText(input.position) ??
    classifyText(input.department, { allowGenericService: true }) ??
    classifyText(input.businessUnit, { allowGenericService: true }) ??
    classifyText(input.role) ??
    defaultDepartmentForSource(input.sourceFamily)
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
