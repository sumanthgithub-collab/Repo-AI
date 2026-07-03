const PLACEHOLDER_PATTERNS = [
  "your_",
  "_your_",
  "your-",
  "example.com",
  "localhost",
];

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function isPlaceholder(value: string | undefined): boolean {
  if (isBlank(value)) return true;
  const normalized = value!.trim().toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isClerkTestSecret(value: string | undefined): boolean {
  return value?.trim().startsWith("sk_test_") ?? false;
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => !isPlaceholder(process.env[key]));
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getAllowedOrigins(): string[] {
  const configured = [
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.CORS_ORIGINS ?? "").split(","),
  ];

  return configured
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));
}

export function validateProductionEnv(): void {
  if (!isProduction()) return;

  const missing: string[] = [];

  if (isPlaceholder(process.env.CLERK_SECRET_KEY)) missing.push("CLERK_SECRET_KEY");
  if (isClerkTestSecret(process.env.CLERK_SECRET_KEY)) {
    missing.push("CLERK_SECRET_KEY must be a live key in production");
  }
  if (isPlaceholder(process.env.DATABASE_URL)) missing.push("DATABASE_URL");
  if (!hasAnyEnv(["AI_SERVICE_URL", "AI_SERVICE_HOST"])) {
    missing.push("AI_SERVICE_URL or AI_SERVICE_HOST");
  }
  if (!hasAnyEnv(["FRONTEND_URL", "NEXT_PUBLIC_APP_URL", "CORS_ORIGINS"])) {
    missing.push("FRONTEND_URL, NEXT_PUBLIC_APP_URL, or CORS_ORIGINS");
  }

  if (process.env.DATABASE_URL?.trim().startsWith("file:")) {
    missing.push("DATABASE_URL must be PostgreSQL in production, not SQLite");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing or invalid production configuration: ${missing.join(", ")}`
    );
  }
}
