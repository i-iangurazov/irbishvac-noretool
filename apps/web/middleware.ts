import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  isAllowedIrbisEmail,
  isPublicAuthPath,
  resolvePublicRequestUrl,
} from "./lib/auth-policy";

export default clerkMiddleware(async (auth, request) => {
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

  if (!isAllowedIrbisEmail(authState.sessionClaims.primaryEmail)) {
    return NextResponse.redirect(
      new URL(
        "/access-denied",
        resolvePublicRequestUrl(request.url, process.env.DASHBOARD_PUBLIC_URL),
      ),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
