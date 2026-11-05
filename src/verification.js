import { PermissionFlagsBits } from 'discord.js';
import { rpc, UserError } from './db.js';
import { config } from './config.js';
import { settings } from './settings.js';
import { privately, success } from './ui.js';

const pending = new Map();
export function rememberVerification(interaction) {
  for (const [key,value] of pending) if (value.expires < Date.now()) pending.delete(key);
  pending.set(`${interaction.guildId}:${interaction.user.id}`, { interaction, expires: Date.now()+12*60_000 });
}
async function notifyVerified(guildId, discordId) {
  const key=`${guildId}:${discordId}`;
  const entry=pending.get(key);
  if (!entry) return;
  pending.delete(key);
  if (entry.expires < Date.now()) return;
  await entry.interaction.editReply(privately({
    embeds:[success('✅ Verification successful','Your Discord account is verified and your verified role has been added.')],components:[],
  })).catch(() => {});
}

const privileged = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers];

export function verificationRoleProblem(role, staffRoles = []) {
  if (!role || role.id === role.guild.id || role.managed) return 'Choose a normal member role, not @everyone or an integration role.';
  if (staffRoles.includes(role.id) || privileged.some(permission => role.permissions.has(permission)))
    return 'The verified role must be a member role without staff or moderation permissions.';
  return null;
}

export async function applyVerifiedRole(member, role, staffRoles = []) {
  const problem = verificationRoleProblem(role, staffRoles);
  if (problem) throw new UserError(problem);
  const bot = await member.guild.members.fetchMe();
  if (!bot.permissions.has(PermissionFlagsBits.ManageRoles) || bot.roles.highest.comparePositionTo(role) <= 0)
    throw new UserError('Give the bot Manage Roles and move its role above the verified role.');
  if (member.roles.cache.has(role.id)) return false;
  await member.roles.add(role, 'Discord identity verified through official authorization');
  return true;
}

export async function checkVerification(guild, discordId) {
  const current = settings();
  if (!current.verifiedRoleId) throw new UserError('A server admin needs to set /setup verified-role first.');
  const verified = await rpc('bot_member_verified', { p_guild_id: guild.id, p_discord_id: discordId });
  if (!verified) return false;
  const role = await guild.roles.fetch(current.verifiedRoleId);
  const member = await guild.members.fetch({ user: discordId, force: true });
  await applyVerifiedRole(member, role, current.staffRoleIds);
  await notifyVerified(guild.id,discordId);
  return true;
}

let syncing = false;
export async function syncVerifiedRoles(client) {
  if (syncing || !settings().verifiedRoleId) return;
  syncing = true;
  try {
    const guild = await client.guilds.fetch(config.guildId);
    const current = settings();
    const role = await guild.roles.fetch(current.verifiedRoleId);
    const problem = verificationRoleProblem(role, current.staffRoleIds);
    if (problem) throw new UserError(problem);
    const bot=await guild.members.fetchMe();
    if (!bot.permissions.has(PermissionFlagsBits.ManageRoles) || bot.roles.highest.comparePositionTo(role)<=0)
      throw new UserError('Give the bot Manage Roles and move its role above the verified role.');
    const members = await rpc('bot_verification_members', { p_guild_id: guild.id });
    for (const { discord_id: id } of members ?? []) {
      try {
        const member = await guild.members.fetch({ user: id, force: true });
        await applyVerifiedRole(member, role, current.staffRoleIds);
        await notifyVerified(guild.id,id);
      } catch (error) {
        if (error?.code !== 10007) console.warn(`Verified role could not be assigned to ${id}: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } finally { syncing = false; }
}
