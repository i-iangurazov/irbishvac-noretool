import { isAllowedIrbisEmail } from "./auth-policy";

// Administrator-provisioned account, approved for full Dashboard access.
// Never replace this signed-user-ID check with a username or client metadata check.
export const SHARED_DASHBOARD_USER_ID = "user_3J5yhT8eUjYj4aUrbsKhhZzjtQf";

type DashboardIdentity = {
  isAuthenticated: boolean;
  userId?: string | null | undefined;
  primaryEmail?: unknown;
};

export function isAllowedDashboardIdentity(identity: DashboardIdentity) {
  if (!identity.isAuthenticated || !identity.userId) {
    return false;
  }

  return (
    identity.userId === SHARED_DASHBOARD_USER_ID ||
    isAllowedIrbisEmail(identity.primaryEmail)
  );
}
