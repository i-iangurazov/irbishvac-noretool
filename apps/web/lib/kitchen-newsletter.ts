import { prisma, type Prisma } from "@irbis/db";
import { auth } from "@clerk/nextjs/server";
import {
  isAllowedDashboardIdentity,
  SHARED_DASHBOARD_USER_ID,
} from "./dashboard-identity";

export type NewsletterPage = { mime: "image/webp"; data: string };
export type NewsletterInfo = {
  month: string;
  sourceName: string;
  version: string;
  pages: string[];
  canUpload?: boolean;
};
export async function kitchenIdentity(): Promise<{ userId: string } | null> {
  const identity = await auth();
  if (
    !isAllowedDashboardIdentity({
      isAuthenticated: identity.isAuthenticated,
      userId: identity.userId,
      primaryEmail: identity.sessionClaims?.primaryEmail,
    })
  )
    return null;
  return { userId: identity.userId! };
}
export const kitchenCanUpload = (userId: string | null) =>
  Boolean(userId && userId !== SHARED_DASHBOARD_USER_ID);
export const validIssueMonth = (month: string) =>
  /^20\d{2}-(0[1-9]|1[0-2])$/.test(month);

export async function newsletterRecord(month: string) {
  return prisma.kitchenNewsletter.findUnique({ where: { issueMonth: month } });
}
export async function newsletterInfo(
  month: string,
): Promise<NewsletterInfo | null> {
  const record = await prisma.kitchenNewsletter.findUnique({
    where: { issueMonth: month },
    select: { sourceName: true, uploadedAt: true },
  });
  if (!record) return null;
  const version = record.uploadedAt.toISOString();
  return {
    month,
    sourceName: record.sourceName,
    version,
    pages: [1, 2].map(
      (page) =>
        `/api/kitchen/insider/page/${page}?month=${month}&v=${encodeURIComponent(version)}`,
    ),
  };
}
export async function newsletterPage(month: string, page: number) {
  const record = await newsletterRecord(month);
  if (record) {
    const entry = (record.pagesJson as unknown as NewsletterPage[])[page - 1];
    return entry
      ? { bytes: Buffer.from(entry.data, "base64"), mime: entry.mime }
      : null;
  }
  return null;
}
export async function saveNewsletter(
  month: string,
  pages: NewsletterPage[],
  sourceName: string,
  uploadedBy: string,
) {
  const values = {
    pagesJson: pages as unknown as Prisma.InputJsonValue,
    sourceName,
    uploadedBy,
    uploadedAt: new Date(),
  };
  await prisma.kitchenNewsletter.upsert({
    where: { issueMonth: month },
    create: { issueMonth: month, ...values },
    update: values,
  });
}
