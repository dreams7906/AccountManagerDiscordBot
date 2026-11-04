import { PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";

/** Staff: anyone with Administrator, or one of the roles in STAFF_ROLE_IDS. */
export function isStaff(interaction) {
  const member = interaction.member;
  if (!member) return false;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  // Cached members carry a role manager; uncached ones arrive as raw role IDs.
  const roles = Array.isArray(member.roles) ? member.roles : [...(member.roles?.cache?.keys() ?? [])];
  return config.staffRoleIds.some((id) => roles.includes(id));
}
