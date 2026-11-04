import { PermissionFlagsBits } from "discord.js";
import { settings } from "./settings.js";

/** Server admins: anyone with the Administrator permission. */
export const isAdmin = (interaction) => !!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

/** Staff: admins, or anyone with a staff role set with /setup. */
export function isStaff(interaction) {
  const member = interaction.member;
  if (!member) return false;
  if (isAdmin(interaction)) return true;
  // Cached members carry a role manager; uncached ones arrive as raw role IDs.
  const roles = Array.isArray(member.roles) ? member.roles : [...(member.roles?.cache?.keys() ?? [])];
  return settings().staffRoleIds.some((id) => roles.includes(id));
}
