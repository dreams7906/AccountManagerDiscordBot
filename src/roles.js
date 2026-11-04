import { config } from "./config.js";
import { rpc } from "./db.js";

/**
 * Gives the buyer role to one person if they don't have it. The role is
 * never taken away, even when their time runs out. Returns true when added.
 */
export async function giveBuyerRole(guild, discordId) {
  if (!config.buyerRoleId || !guild) return false;
  try {
    const member = await guild.members.fetch(discordId);
    if (member.roles.cache.has(config.buyerRoleId)) return false;
    await member.roles.add(config.buyerRoleId, "Has a Custom Account Manager account with time");
    return true;
  } catch (e) {
    // Not in the server, or the bot's role sits below the buyer role.
    if (e?.code !== 10007) console.warn(`Couldn't give the buyer role to ${discordId}: ${e?.message ?? e}`);
    return false;
  }
}

/**
 * Catches people who got time somewhere else (the website, the app, staff)
 * and gives them the role. Runs every few minutes.
 */
export async function syncBuyerRoles(client) {
  if (!config.buyerRoleId) return 0;
  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) return 0;
  const people = (await rpc("bot_role_list")) ?? [];
  let added = 0;
  for (const p of people.filter((x) => x.active)) {
    if (await giveBuyerRole(guild, p.discord_id)) added++;
    // Stays well under Discord's rate limits on large servers.
    await new Promise((r) => setTimeout(r, 250));
  }
  return added;
}
