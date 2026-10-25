import { prisma } from "@irbis/db";
import { staffPortraitKey, staffPortraitUrl } from "./staff-portrait-url";

/** Resolve existing reviewed portraits by text aliases; never guess identities. */
export async function preparedStaffPortraitUrls(names: string[]) {
  const keys = [...new Set(names.map(staffPortraitKey).filter(Boolean))];
  const result = new Map<string, string>();
  if (!keys.length) return result;
  try {
    const portraits = await prisma.staffPortrait.findMany({
      where: { OR: [{ key: { in: keys } }, { aliases: { hasSome: keys } }] },
      select: { key: true, aliases: true },
    });
    for (const name of names) {
      const key = staffPortraitKey(name);
      if (
        portraits.some(
          (portrait) => portrait.key === key || portrait.aliases.includes(key),
        )
      )
        result.set(name, staffPortraitUrl(name));
    }
  } catch {
    // A portrait lookup failure must not hide report metrics or existing photos.
  }
  return result;
}

export const validStaffPortraitKey = (key: string) =>
  /^[a-z0-9][a-z0-9-]{1,119}$/.test(key);

export async function staffPortrait(key: string) {
  return prisma.staffPortrait.findFirst({
    where: {
      OR: [{ key }, { workerId: key }, { aliases: { has: key } }],
    },
    select: { imageBytes: true, mimeType: true, checksum: true },
  });
}
