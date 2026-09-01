import { timingSafeEqual } from "node:crypto";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { getConfig } from "@irbis/config";

function tokensMatch(actual: string | undefined, expected: string) {
  if (!actual) {
    return false;
  }

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

@Injectable()
export class DashboardAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const header = request.headers["x-dashboard-access-token"];
    const token = Array.isArray(header) ? header[0] : header;

    if (!tokensMatch(token, getConfig().auth.cookieSecret)) {
      throw new UnauthorizedException("Dashboard access is not authorized");
    }

    return true;
  }
}
