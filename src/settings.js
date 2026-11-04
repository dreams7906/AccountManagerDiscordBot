import { config } from "./config.js";
import { rpc } from "./db.js";

/**
 * The server's /setup settings, kept in the database so they survive
 * restarts. Values from .env still work as a fallback.
 */
let saved = { buyerRoleId: null, staffRoleIds: [], logChannelId: null, purchaseLogChannelId: null, staffLogChannelId: null, accountLogChannelId: null, trialsEnabled: true, updatedBy: null, updatedAt: null };

const clean = (s) => ({
  buyerRoleId: s?.buyerRoleId ?? null,
  staffRoleIds: Array.isArray(s?.staffRoleIds) ? s.staffRoleIds : [],
  logChannelId: s?.logChannelId ?? null,
  purchaseLogChannelId: s?.purchaseLogChannelId ?? null,
  staffLogChannelId: s?.staffLogChannelId ?? null,
  accountLogChannelId: s?.accountLogChannelId ?? null,
  trialsEnabled: s?.trialsEnabled ?? true,
  updatedBy: s?.updatedBy ?? null,
  updatedAt: s?.updatedAt ?? null,
});

/** What the bot uses right now. */
export function settings() {
  return {
    buyerRoleId: saved.buyerRoleId || config.buyerRoleId || null,
    staffRoleIds: [...new Set([...saved.staffRoleIds, ...config.staffRoleIds])],
    logChannelId: saved.logChannelId || config.logChannelId || null,
    purchaseLogChannelId: saved.purchaseLogChannelId,
    staffLogChannelId: saved.staffLogChannelId,
    accountLogChannelId: saved.accountLogChannelId,
    trialsEnabled: saved.trialsEnabled,
    updatedBy: saved.updatedBy,
    updatedAt: saved.updatedAt,
  };
}

/** Reads the settings again from the database. */
export async function refreshSettings() {
  saved = clean(await rpc("bot_get_settings", { p_guild_id: config.guildId }));
  return settings();
}

/** Changes one setting: buyer_role, log_channel, log_purchase, log_staff, log_account, staff_add, staff_remove or trials. */
export async function changeSetting(setting, value, by) {
  saved = clean(await rpc("bot_set_setting", { p_guild_id: config.guildId, p_setting: setting, p_value: value ?? "", p_by: by }));
  return settings();
}
