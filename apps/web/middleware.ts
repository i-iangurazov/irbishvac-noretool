import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAllowedIrbisEmail, isPublicAuthPath } from "./lib/auth-policy";

export default clerkMiddleware(async (auth, request) => {
  if (isPublicAuthPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const authState = await auth();

  if (!authState.isAuthenticated) {
    return authState.redirectToSignIn({ returnBackUrl: request.url });
  }

  if (!isAllowedIrbisEmail(authState.sessionClaims.primaryEmail)) {
    return NextResponse.redirect(new URL("/access-denied", request.url));
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
