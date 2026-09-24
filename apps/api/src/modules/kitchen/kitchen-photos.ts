import type { KitchenDirectory } from "@irbis/domain";
import { resolveTechnicianPhotoUrl } from "@irbis/utils";

type PhotoAssets = {
  publicBaseUrl: string | null;
  technicianPhotoFolder: string;
  technicianPhotoExtension: string;
  technicianPhotoNameStyle: "slug" | "underscore" | "space";
};

const unique = (values: string[]) => [...new Set(values)];
const unaccented = (name: string) =>
  name.normalize("NFKD").replace(/\p{M}/gu, "");
const identity = (name: string) =>
  unaccented(name)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const titleCase = (name: string) =>
  name
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());

function namesFor(name: string) {
  const full = name.trim().replace(/\s+/g, " ");
  const withoutSuffix = full.replace(/,?\s+(?:jr|sr)\.?$/i, "");
  const withoutInitials = withoutSuffix
    .replace(/\b\p{L}\.?(?=\s)/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = withoutInitials.split(" ");
  return {
    full: unique([full, withoutSuffix, withoutInitials]).filter(Boolean),
    short:
      parts.length > 2
        ? unique([parts.slice(0, 2).join(" "), `${parts[0]} ${parts.at(-1)}`])
        : [],
  };
}

/** Name matching only: no first-name-only, guessed nicknames, or face matching. */
export function kitchenPhotoCandidates(
  directory: KitchenDirectory,
  assets: PhotoAssets,
) {
  const names = directory.employees.map((employee) => namesFor(employee.name));
  const fullOwners = new Map<string, Set<string>>();
  const allOwners = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, name: string, id: string) => {
    const key = identity(name);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(id);
  };
  directory.employees.forEach((employee, index) => {
    names[index]!.full.forEach((name) => add(fullOwners, name, employee.id));
    [...names[index]!.full, ...names[index]!.short].forEach((name) =>
      add(allOwners, name, employee.id),
    );
  });
  return directory.employees.map((employee, index) => {
    if (!assets.publicBaseUrl || employee.name === "Team member") return [];
    const acceptable = [
      ...names[index]!.full.filter(
        (name) => fullOwners.get(identity(name))?.size === 1,
      ),
      ...names[index]!.short.filter(
        (name) => allOwners.get(identity(name))?.size === 1,
      ),
    ];
    const variants = unique(
      acceptable.flatMap((name) =>
        unique([
          name,
          titleCase(name),
          unaccented(name),
          titleCase(unaccented(name)),
          unaccented(name).replace(/[-’']/g, " ").replace(/\s+/g, " "),
        ]),
      ),
    );
    return unique(
      variants
        .map((name) =>
          resolveTechnicianPhotoUrl({
            publicBaseUrl: assets.publicBaseUrl,
            folder: assets.technicianPhotoFolder,
            extension: assets.technicianPhotoExtension,
            nameStyle: assets.technicianPhotoNameStyle,
            name,
          }),
        )
        .filter((url): url is string => Boolean(url)),
    );
  });
}

/** Runs once during roster sync, not for each browser or screen change. */
export async function preferKitchenCloudflarePhotos(
  directory: KitchenDirectory,
  assets: PhotoAssets,
  request: typeof fetch = fetch,
): Promise<KitchenDirectory> {
  if (!assets.publicBaseUrl) return directory;
  const candidates = kitchenPhotoCandidates(directory, assets);
  const employees = directory.employees.map((employee) => ({ ...employee }));
  const availability = new Map<string, Promise<boolean>>();
  const deadline = AbortSignal.timeout(25_000);
  const exists = (url: string) => {
    if (!availability.has(url))
      availability.set(
        url,
        (async () => {
          try {
            const response = await request(url, {
              method: "HEAD",
              redirect: "error",
              signal: AbortSignal.any([deadline, AbortSignal.timeout(4_000)]),
            });
            return (
              response.ok &&
              Boolean(
                response.headers
                  .get("content-type")
                  ?.toLowerCase()
                  .startsWith("image/"),
              )
            );
          } catch {
            return false;
          }
        })(),
      );
    return availability.get(url)!;
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, employees.length) }, async () => {
      while (next < employees.length) {
        const index = next++;
        const employee = employees[index]!;
        const ripplingPhoto =
          employee.photoSource === "cloudflare"
            ? (employee.photoFallbackUrl ?? null)
            : employee.photoUrl;
        employee.photoUrl = ripplingPhoto;
        if (ripplingPhoto) employee.photoSource = "rippling";
        else delete employee.photoSource;
        employee.photoFallbackUrl = null;
        for (const url of candidates[index]!) {
          if (deadline.aborted) break;
          if (await exists(url)) {
            employee.photoUrl = url;
            employee.photoSource = "cloudflare";
            employee.photoFallbackUrl = ripplingPhoto;
            break;
          }
        }
      }
    }),
  );
  return {
    employees,
    quality: {
      ...directory.quality,
      missingPhotos: employees.filter((employee) => !employee.photoUrl).length,
    },
  };
}
