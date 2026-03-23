import { Injectable, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@irbis/db";

@Injectable()
export class AuthService {
  async getCurrentUser() {
    return prisma.user.findFirst({
      orderBy: {
        createdAt: "asc"
      },
      select: {
        id: true,
        email: true,
        role: true
      }
    });
  }

  async login(email: string, password: string) {
    void password;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return {
      user,
      note: "Session creation scaffolded; cookie/session issuance to be completed during environment integration."
    };
  }
}
