import "dotenv/config";

export const databaseConfig = {
  url: readDatabaseUrl(),
  connection: readConnectionOptions(),
  ssl: readDatabaseSsl(),
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 8000),
  idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 10_000),
  max: Number(process.env.DATABASE_POOL_MAX ?? 3),
};

export function hasDatabaseUrl() {
  return Boolean(databaseConfig.url || databaseConfig.connection);
}

export function getSafeDatabaseInfo() {
  const parsed = parseDatabaseInfo();
  if (!parsed.configured) {
    return {
      configured: false,
      host: "",
      port: "",
      database: "",
      user: "",
      source: "",
      ssl: databaseConfig.ssl,
    };
  }

  return {
    ...parsed,
    ssl: databaseConfig.ssl,
    poolMax: databaseConfig.max,
    connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
    isSupabase: isSupabaseHost(parsed.host),
    isSupabasePooler: isSupabasePoolerHost(parsed.host),
    warning: buildDatabaseWarning(parsed),
  };
}

export function getPoolConfig() {
  const base = {
    ssl: databaseConfig.ssl,
    connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
    idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
    max: databaseConfig.max,
    allowExitOnIdle: true,
  };
  if (databaseConfig.connection) return { ...base, ...databaseConfig.connection };
  return { ...base, connectionString: databaseConfig.url };
}

function parseDatabaseInfo() {
  if (databaseConfig.connection) {
    return {
      configured: true,
      host: databaseConfig.connection.host ?? "",
      port: String(databaseConfig.connection.port ?? ""),
      database: databaseConfig.connection.database ?? "",
      user: databaseConfig.connection.user ?? "",
      source: "split-env",
    };
  }

  try {
    const url = new URL(databaseConfig.url);
    return {
      configured: true,
      host: url.hostname,
      port: url.port || defaultPort(url.hostname),
      database: url.pathname.replace("/", ""),
      user: decodeURIComponent(url.username),
      source: "DATABASE_URL",
    };
  } catch {
    return {
      configured: true,
      host: "invalid-url",
      port: "",
      database: "",
      user: "",
      source: "DATABASE_URL",
    };
  }
}

function readDatabaseUrl() {
  return (process.env.DATABASE_URL ?? "").trim();
}

function readConnectionOptions() {
  const host = process.env.PGHOST ?? process.env.POSTGRES_HOST ?? process.env.SUPABASE_DB_HOST;
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD ?? process.env.SUPABASE_DB_PASSWORD;
  if (!host || !password) return null;
  return {
    host,
    port: Number(process.env.PGPORT ?? process.env.POSTGRES_PORT ?? process.env.SUPABASE_DB_PORT ?? defaultPort(host)),
    database: process.env.PGDATABASE ?? process.env.POSTGRES_DATABASE ?? process.env.SUPABASE_DB_NAME ?? "postgres",
    user: process.env.PGUSER ?? process.env.POSTGRES_USER ?? process.env.SUPABASE_DB_USER ?? inferSupabaseUser(host),
    password,
  };
}

function readDatabaseSsl() {
  if (process.env.DATABASE_SSL === "true") return { rejectUnauthorized: false };
  if (process.env.DATABASE_SSL === "false") {
    return isSupabaseHost(readDatabaseUrl() || process.env.PGHOST || process.env.POSTGRES_HOST || process.env.SUPABASE_DB_HOST) ? { rejectUnauthorized: false } : false;
  }
  return isSupabaseHost(readDatabaseUrl() || process.env.PGHOST || process.env.POSTGRES_HOST || process.env.SUPABASE_DB_HOST) ? { rejectUnauthorized: false } : false;
}

function inferSupabaseUser(host = "") {
  const projectRef = String(host).match(/(?:db\.|pooler\.|aws-[^.]+\.)?([a-z0-9]{20})\.supabase\.(?:co|com)/i)?.[1];
  return projectRef && isSupabasePoolerHost(host) ? `postgres.${projectRef}` : "postgres";
}

function defaultPort(host = "") {
  return isSupabasePoolerHost(host) ? "6543" : "5432";
}

function isSupabaseHost(value = "") {
  return String(value).includes(".supabase.co") || String(value).includes(".supabase.com");
}

function isSupabasePoolerHost(value = "") {
  return String(value).includes("pooler.supabase.");
}

function buildDatabaseWarning(info) {
  if (!info.configured) return "DATABASE_URL 未配置";
  if (info.host === "invalid-url") return "DATABASE_URL 格式无效，请直接复制 Supabase Connection string";
  if (isSupabasePoolerHost(info.host) && info.user === "postgres") {
    return "Supabase Transaction Pooler 的用户名应为 postgres.<project-ref>，请复制 Supabase Pooler URI，不要手写";
  }
  return "";
}
