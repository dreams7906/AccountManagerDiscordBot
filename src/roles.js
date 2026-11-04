import { PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";
import { rpc } from "./db.js";
import { settings } from "./settings.js";

/**
 * Gives the buyer role to one person if they don't have it. The role is
 * never taken away, even when their time runs out. Returns true when added.
 */
export async function giveBuyerRole(guild, discordId) {
  const role = settings().buyerRoleId;
  if (!role || !guild) return false;
  try {
    const member = await guild.members.fetch(discordId);
    if (member.roles.cache.has(role)) return false;
    await member.roles.add(role, "Has a Custom Account Manager account with time");
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
  if (!settings().buyerRoleId) return 0;
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

/**
 * Tells the database which linked accounts belong to staff, so the website's
 * staff panel knows who may use it. Admins are the server owner and anyone
 * with Administrator; staff have a /setup staff role. Entries expire after an
 * hour, so this runs with the role sync.
 */
export async function syncStaff(client) {
  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) return null;
  const staffRoles = settings().staffRoleIds;
  const people = (await rpc("bot_role_list")) ?? [];
  const members = [];
  for (const p of people) {
    const member = await guild.members.fetch(p.discord_id).catch(() => null);
    if (!member) continue;
    if (guild.ownerId === member.id || member.permissions.has(PermissionFlagsBits.Administrator)) members.push({ id: member.id, level: "admin" });
    else if (staffRoles.some((r) => member.roles.cache.has(r))) members.push({ id: member.id, level: "staff" });
  }
  return rpc("bot_sync_staff", { p_members: members });
}
