import { redirect } from "next/navigation";

export default async function MembershipRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    for (const item of Array.isArray(value)
      ? value
      : value == null
        ? []
        : [value])
      params.append(key, item);
  }
  if (params.size) redirect(`/memberships?${params.toString()}`);
  redirect("/memberships");
}
