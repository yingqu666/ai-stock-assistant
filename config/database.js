import "dotenv/config";

export const databaseConfig = {
  url: readDatabaseUrl(),
  ssl: readDatabaseSsl(),
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 8000),
};

export function hasDatabaseUrl() {
  return Boolean(databaseConfig.url);
}

export function getSafeDatabaseInfo() {
  if (!databaseConfig.url) {
    return {
      configured: false,
      host: "",
      database: "",
      ssl: databaseConfig.ssl,
    };
  }

  try {
    const url = new URL(databaseConfig.url);
    return {
      configured: true,
      host: url.hostname,
      database: url.pathname.replace("/", ""),
      ssl: databaseConfig.ssl,
    };
  } catch {
    return {
      configured: true,
      host: "invalid-url",
      database: "",
      ssl: databaseConfig.ssl,
    };
  }
}

function readDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

function readDatabaseSsl() {
  if (process.env.DATABASE_SSL === "true") return { rejectUnauthorized: false };
  if (process.env.DATABASE_SSL === "false") {
    return isSupabaseUrl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false;
  }
  return isSupabaseUrl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false;
}

function isSupabaseUrl(url = "") {
  return url.includes(".supabase.co");
}
