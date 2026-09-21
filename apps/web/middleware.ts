import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import {
  isCampaignIntegrationPath,
  isPublicAuthPath,
  resolvePublicRequestUrl,
} from "./lib/auth-policy";
import { isAllowedDashboardIdentity } from "./lib/dashboard-identity";

const authenticatedMiddleware = clerkMiddleware(async (auth, request) => {
  if (isPublicAuthPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const authState = await auth();

  if (!authState.isAuthenticated) {
    return authState.redirectToSignIn({
      returnBackUrl: resolvePublicRequestUrl(
        request.url,
        process.env.DASHBOARD_PUBLIC_URL,
      ),
    });
  }

  if (!isAllowedDashboardIdentity({
    isAuthenticated: authState.isAuthenticated,
    userId: authState.userId,
    primaryEmail: authState.sessionClaims.primaryEmail,
  })) {
    return NextResponse.redirect(
      new URL(
        "/access-denied",
        resolvePublicRequestUrl(request.url, process.env.DASHBOARD_PUBLIC_URL),
      ),
    );
  }

  return NextResponse.next();
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isCampaignIntegrationPath(request.nextUrl.pathname)) return NextResponse.next();
  return authenticatedMiddleware(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
