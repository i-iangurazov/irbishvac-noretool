import { prisma } from "@irbis/db";

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
