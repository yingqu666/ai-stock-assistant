import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { getPoolConfig, getSafeDatabaseInfo, hasDatabaseUrl } from "../../config/database.js";

const { Pool } = pg;
const pool = hasDatabaseUrl() ? new Pool(getPoolConfig()) : null;

export function isPostgresEnabled() {
  return Boolean(pool);
}

export async function initPostgres() {
  logDatabaseConfig("startup");
  if (!pool) return { ok: false, mode: "memory", message: "DATABASE_URL 未配置" };
  const schema = await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query("select 1");
  await pool.query(schema);
  console.log("PostgreSQL connected");
  return { ok: true, mode: "postgres" };
}

export async function getPostgresStatus() {
  const info = getSafeDatabaseInfo();
  if (!pool) return { mode: "memory", connected: false, tables: [], info };
  try {
    const result = await pool.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );
    return { mode: "postgres", connected: true, tables: result.rows.map((row) => row.table_name), info };
  } catch (error) {
    return { mode: "memory", connected: false, tables: [], error: error.message, info };
  }
}

export function logDatabaseConfig(stage = "startup") {
  const info = getSafeDatabaseInfo();
  console.log(
    `[database:${stage}] configured=${info.configured ? "yes" : "no"} source=${info.source || "none"} host=${info.host || "-"} port=${info.port || "-"} database=${info.database || "-"} user=${info.user || "-"} ssl=${info.ssl ? "on" : "off"} poolMax=${info.poolMax ?? "-"}`,
  );
  if (info.isSupabasePooler) console.log("[database:startup] Supabase Transaction Pooler detected");
  else if (info.isSupabase) console.log("[database:startup] Supabase direct database host detected");
  if (info.warning) console.warn(`[database:${stage}] ${info.warning}`);
}

export async function createUser(phone) {
  const id = `u_${phone}`;
  const result = await pool.query(
    `insert into users (id, phone) values ($1, $2)
     on conflict (phone) do update set phone = excluded.phone, updated_at = now()
     returning id, phone, created_at as "createdAt", updated_at as "updatedAt"`,
    [id, phone],
  );
  return result.rows[0];
}

export async function getUser(userId) {
  const result = await pool.query(`select id, phone, created_at as "createdAt", updated_at as "updatedAt" from users where id = $1`, [userId]);
  return result.rows[0] ?? null;
}

export async function getUserByPhone(phone) {
  const result = await pool.query(`select id, phone, created_at as "createdAt", updated_at as "updatedAt" from users where phone = $1`, [phone]);
  return result.rows[0] ?? null;
}

export async function addWatchlist(userId, payload) {
  const id = payload.id ?? randomUUID();
  const result = await pool.query(
    `insert into watchlists (id, user_id, stock_code, stock_name, reason, ai_level, group_name)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (user_id, stock_code) do update set
       stock_name = excluded.stock_name, reason = excluded.reason, ai_level = excluded.ai_level,
       group_name = excluded.group_name, updated_at = now()
     returning id, user_id as "userId", stock_code as "stockCode", stock_name as "stockName",
       reason, ai_level as "aiLevel", group_name as "groupName", created_at as "createdAt", updated_at as "updatedAt"`,
    [id, userId, payload.stockCode ?? payload.code, payload.stockName ?? payload.name, payload.reason ?? "", payload.aiLevel ?? "观察", payload.groupName ?? "长期观察"],
  );
  return result.rows[0];
}

export async function getWatchlist(userId) {
  const result = await pool.query(
    `select id, user_id as "userId", stock_code as "stockCode", stock_name as "stockName",
      reason, ai_level as "aiLevel", group_name as "groupName", created_at as "createdAt", updated_at as "updatedAt"
     from watchlists where user_id = $1 order by group_name asc, created_at desc`,
    [userId],
  );
  return result.rows;
}

export async function deleteWatchlist(userId, idOrCode) {
  const result = await pool.query(`delete from watchlists where user_id = $1 and (id = $2 or stock_code = $2)`, [userId, idOrCode]);
  return { ok: true, deleted: result.rowCount };
}

export async function getWatchlistGroups(userId) {
  await ensureDefaultWatchlistGroups(userId);
  const result = await pool.query(
    `select id, user_id as "userId", name, sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"
     from watchlist_groups where user_id = $1 order by sort_order asc, created_at asc`,
    [userId],
  );
  return result.rows;
}

export async function saveWatchlistGroup(userId, payload) {
  const id = payload.id ?? randomUUID();
  const name = payload.name ?? "长期观察";
  const result = await pool.query(
    `insert into watchlist_groups (id, user_id, name, sort_order)
     values ($1, $2, $3, $4)
     on conflict (user_id, name) do update set sort_order = excluded.sort_order, updated_at = now()
     returning id, user_id as "userId", name, sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"`,
    [id, userId, name, Number(payload.sortOrder ?? 100)],
  );
  return result.rows[0];
}

export async function renameWatchlistGroup(userId, oldName, newName) {
  await pool.query(`update watchlist_groups set name = $3, updated_at = now() where user_id = $1 and name = $2`, [userId, oldName, newName]);
  await pool.query(`update watchlists set group_name = $3, updated_at = now() where user_id = $1 and group_name = $2`, [userId, oldName, newName]);
  return { ok: true };
}

export async function deleteWatchlistGroup(userId, name) {
  await pool.query(`delete from watchlist_groups where user_id = $1 and name = $2`, [userId, name]);
  await pool.query(`update watchlists set group_name = '长期观察', updated_at = now() where user_id = $1 and group_name = $2`, [userId, name]);
  return { ok: true };
}

export async function moveWatchlistStock(userId, idOrCode, groupName) {
  const result = await pool.query(
    `update watchlists set group_name = $3, updated_at = now() where user_id = $1 and (id = $2 or stock_code = $2)
     returning id, user_id as "userId", stock_code as "stockCode", stock_name as "stockName",
      reason, ai_level as "aiLevel", group_name as "groupName", created_at as "createdAt", updated_at as "updatedAt"`,
    [userId, idOrCode, groupName],
  );
  return result.rows[0] ?? null;
}

async function ensureDefaultWatchlistGroups(userId) {
  const defaults = ["AI科技", "半导体", "ETF", "长期观察"];
  await Promise.all(defaults.map((name, index) => saveWatchlistGroup(userId, { name, sortOrder: index })));
}

export async function savePortfolio(userId, payload) {
  const id = payload.id ?? randomUUID();
  const result = await pool.query(
    `insert into portfolio (id, user_id, stock_code, stock_name, cost_price, quantity)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set stock_code = excluded.stock_code, stock_name = excluded.stock_name,
       cost_price = excluded.cost_price, quantity = excluded.quantity, updated_at = now()
     returning id, user_id as "userId", stock_code as "stockCode", stock_name as "stockName",
       cost_price as "costPrice", quantity, created_at as "createdAt", updated_at as "updatedAt"`,
    [id, userId, payload.stockCode ?? payload.code, payload.stockName ?? payload.name, Number(payload.costPrice ?? 0), Number(payload.quantity ?? 0)],
  );
  return result.rows[0];
}

export async function getPortfolio(userId) {
  const result = await pool.query(
    `select id, user_id as "userId", stock_code as "stockCode", stock_name as "stockName",
      cost_price as "costPrice", quantity, created_at as "createdAt", updated_at as "updatedAt"
     from portfolio where user_id = $1 order by created_at desc`,
    [userId],
  );
  return result.rows;
}

export async function deletePortfolio(userId, id) {
  const result = await pool.query(`delete from portfolio where user_id = $1 and id = $2`, [userId, id]);
  return { ok: true, deleted: result.rowCount };
}

export async function saveReport(userId, payload) {
  const id = payload.id ?? randomUUID();
  const result = await pool.query(
    `insert into reports (id, user_id, date, type, score, content, source_data)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set score = excluded.score, content = excluded.content,
       source_data = excluded.source_data, updated_at = now()
     returning id, user_id as "userId", date, type, score, content,
       source_data as "sourceData", created_at as "createdAt", updated_at as "updatedAt"`,
    [id, userId, payload.date ?? today(), payload.type ?? "manual", payload.score ?? null, payload.content ?? {}, payload.sourceData ?? payload.source_data ?? {}],
  );
  return result.rows[0];
}

export async function getReports(userId) {
  const result = await pool.query(
    `select id, user_id as "userId", date, type, score, content, source_data as "sourceData",
      created_at as "createdAt", updated_at as "updatedAt"
     from reports where user_id = $1 order by date desc, created_at desc limit 200`,
    [userId],
  );
  return result.rows;
}

export async function saveSettings(userId, settings) {
  const id = settings.id ?? `settings_${userId}`;
  const result = await pool.query(
    `insert into settings (id, user_id, refresh_interval, industries, risk_level, ai_mode)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id) do update set refresh_interval = excluded.refresh_interval,
       industries = excluded.industries, risk_level = excluded.risk_level, ai_mode = excluded.ai_mode, updated_at = now()
     returning id, user_id as "userId", refresh_interval as "refreshInterval",
       industries, risk_level as "riskLevel", ai_mode as "aiMode", updated_at as "updatedAt"`,
    [id, userId, Number(settings.refreshInterval ?? 30), JSON.stringify(settings.industries ?? []), settings.riskLevel ?? "中", settings.aiMode ?? settings.aiProvider ?? "fallback"],
  );
  return result.rows[0];
}

export async function getSettings(userId) {
  const result = await pool.query(
    `select id, user_id as "userId", refresh_interval as "refreshInterval",
      industries, risk_level as "riskLevel", ai_mode as "aiMode", updated_at as "updatedAt"
     from settings where user_id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function saveAIHistory(userId, payload) {
  const id = payload.id ?? randomUUID();
  const result = await pool.query(
    `insert into ai_history (
       id, user_id, date, prediction_type, prediction_content, target_date,
       market_prediction, sector_prediction, stock_prediction, risk_prediction,
       actual_result, accuracy_score, review_status, review_note
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     on conflict (id) do update set prediction_type = excluded.prediction_type,
       prediction_content = excluded.prediction_content, target_date = excluded.target_date,
       market_prediction = excluded.market_prediction, sector_prediction = excluded.sector_prediction,
       stock_prediction = excluded.stock_prediction, risk_prediction = excluded.risk_prediction,
       actual_result = excluded.actual_result, accuracy_score = excluded.accuracy_score,
       review_status = excluded.review_status, review_note = excluded.review_note, updated_at = now()
     returning id, user_id as "userId", date, prediction_type as "predictionType",
       prediction_content as "predictionContent", target_date as "targetDate",
       market_prediction as "marketPrediction", sector_prediction as "sectorPrediction",
       stock_prediction as "stockPrediction", risk_prediction as "riskPrediction",
       actual_result as "actualResult", accuracy_score as "accuracyScore",
       review_status as "reviewStatus", review_note as "reviewNote",
       created_at as "createdAt", updated_at as "updatedAt"`,
    [
      id,
      userId,
      payload.date ?? today(),
      payload.predictionType ?? payload.prediction_type ?? "market",
      payload.predictionContent ?? payload.prediction_content ?? {},
      payload.targetDate ?? payload.target_date ?? nextDate(payload.date),
      payload.marketPrediction ?? "",
      payload.sectorPrediction ?? {},
      payload.stockPrediction ?? {},
      payload.riskPrediction ?? {},
      payload.actualResult ?? null,
      payload.accuracyScore ?? payload.accuracy_score ?? null,
      payload.reviewStatus ?? payload.review_status ?? "pending",
      payload.reviewNote ?? payload.review_note ?? "",
    ],
  );
  return result.rows[0];
}

export async function getAIHistory(userId) {
  const result = await pool.query(
    `select id, user_id as "userId", date, prediction_type as "predictionType",
      prediction_content as "predictionContent", target_date as "targetDate",
      market_prediction as "marketPrediction", sector_prediction as "sectorPrediction",
      stock_prediction as "stockPrediction", risk_prediction as "riskPrediction",
      actual_result as "actualResult", accuracy_score as "accuracyScore",
      review_status as "reviewStatus", review_note as "reviewNote",
      created_at as "createdAt", updated_at as "updatedAt"
     from ai_history where user_id = $1 order by date desc, created_at desc limit 200`,
    [userId],
  );
  return result.rows;
}

export async function saveAIFeedback(userId, payload) {
  const id = payload.id ?? randomUUID();
  const result = await pool.query(
    `insert into ai_feedback (id, user_id, question, answer, rating, feedback, source, context)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, user_id as "userId", question, answer, rating, feedback, source, context,
       created_at as "createdAt", updated_at as "updatedAt"`,
    [id, userId, payload.question ?? "", payload.answer ?? "", payload.rating ?? null, payload.feedback ?? "", payload.source ?? "", payload.context ?? {}],
  );
  return result.rows[0];
}

export async function getAIFeedback(userId) {
  const result = await pool.query(
    `select id, user_id as "userId", question, answer, rating, feedback, source, context,
      created_at as "createdAt", updated_at as "updatedAt"
     from ai_feedback where user_id = $1 order by created_at desc limit 200`,
    [userId],
  );
  return result.rows;
}

export async function saveKnowledge(userId, payload) {
  const id = payload.id ?? randomUUID();
  const result = await pool.query(
    `insert into knowledge (id, user_id, title, category, content, source, date)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set title = excluded.title, category = excluded.category,
       content = excluded.content, source = excluded.source, date = excluded.date, updated_at = now()
     returning id, user_id as "userId", title, category, content, source, date,
       created_at as "createdAt", updated_at as "updatedAt"`,
    [id, userId, payload.title ?? "", payload.category ?? "general", payload.content ?? "", payload.source ?? "", payload.date ?? today()],
  );
  return result.rows[0];
}

export async function getKnowledge(userId) {
  const result = await pool.query(
    `select id, user_id as "userId", title, category, content, source, date,
      created_at as "createdAt", updated_at as "updatedAt"
     from knowledge where user_id = $1 order by date desc, created_at desc limit 500`,
    [userId],
  );
  return result.rows;
}

export async function saveInvestmentJournal(userId, payload) {
  const id = payload.id ?? randomUUID();
  const result = await pool.query(
    `insert into investment_journal (id, user_id, stock, action, reason, date, result, review)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set stock = excluded.stock, action = excluded.action,
       reason = excluded.reason, date = excluded.date, result = excluded.result,
       review = excluded.review, updated_at = now()
     returning id, user_id as "userId", stock, action, reason, date, result, review,
       created_at as "createdAt", updated_at as "updatedAt"`,
    [id, userId, payload.stock ?? "", payload.action ?? "关注", payload.reason ?? "", payload.date ?? today(), payload.result ?? "", payload.review ?? ""],
  );
  return result.rows[0];
}

export async function getInvestmentJournal(userId) {
  const result = await pool.query(
    `select id, user_id as "userId", stock, action, reason, date, result, review,
      created_at as "createdAt", updated_at as "updatedAt"
     from investment_journal where user_id = $1 order by date desc, created_at desc limit 500`,
    [userId],
  );
  return result.rows;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextDate(date = today()) {
  const value = new Date(date);
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}
