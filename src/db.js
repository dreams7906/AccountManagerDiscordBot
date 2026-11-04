import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

let client = null;

/** The database, with the secret key: the bot's functions are server-only. */
export function db() {
  client ??= createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } });
  return client;
}

/** A refusal the person can act on, shown as-is (unlike crashes, which are logged). */
export class UserError extends Error {}

/**
 * Calls a database function. Its messages ("That key has already been
 * used.") are written for people, so they come back as UserErrors.
 */
export async function rpc(name, args = {}) {
  const { data, error } = await db().rpc(name, args);
  if (error) {
    // Permission and connection problems are setup mistakes, not the user's.
    if (error.code === "42501" || error.code === "PGRST202" || !error.code) throw new Error(`${name}: ${error.message}`);
    throw new UserError(error.message);
  }
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") throw new UserError(data.error);
  return data;
}

let plans = { at: 0, list: [] };

/** Plans on sale, cached for five minutes. */
export async function loadPlans() {
  if (Date.now() - plans.at < 5 * 60_000 && plans.list.length) return plans.list;
  const { data, error } = await db().from("plans").select("*").order("sort");
  if (error) throw new Error(`plans: ${error.message}`);
  plans = { at: Date.now(), list: data ?? [] };
  return plans.list;
}
