type LogLevel = "debug" | "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function emit(level: LogLevel, scope: string, message: string, payload?: LogPayload) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...payload
  };

  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export function createLogger(scope: string) {
  return {
    debug(message: string, payload?: LogPayload) {
      emit("debug", scope, message, payload);
    },
    info(message: string, payload?: LogPayload) {
      emit("info", scope, message, payload);
    },
    warn(message: string, payload?: LogPayload) {
      emit("warn", scope, message, payload);
    },
    error(message: string, payload?: LogPayload) {
      emit("error", scope, message, payload);
    }
  };
}
