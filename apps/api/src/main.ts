import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { getConfig } from "@irbis/config";
import { AppModule } from "./modules/app.module";

function isPortInUseError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EADDRINUSE";
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? "3001");

  try {
    await app.listen(port);
  } catch (error) {
    if (isPortInUseError(error)) {
      console.error(
        `API port ${port} is already in use. Run "pnpm api:free-port" or stop the existing listener before restarting dev.`,
      );
      await app.close();
      process.exit(1);
    }

    throw error;
  }

  const config = getConfig();
  console.log(`API listening on ${config.app.apiBaseUrl}`);
}

void bootstrap();
