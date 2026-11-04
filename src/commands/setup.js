import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { UserError } from "../db.js";
import { log } from "../log.js";
import { syncBuyerRoles } from "../roles.js";
import { changeSetting, refreshSettings } from "../settings.js";
import { base, COLORS, privately, when } from "../ui.js";

const role = (desc) => (o) => o.setName("role").setDescription(desc).setRequired(true);

/** The current settings as a card. */
function settingsEmbed(s, note) {
  return base("⚙️ Bot settings")
    .setDescription(note ?? "Change these with **/setup**. Only server admins can.")
    .addFields(
      { name: "Buyer role", value: s.buyerRoleId ? `<@&${s.buyerRoleId}>` : "Not set: no one gets a role", inline: true },
      { name: "Log channel", value: s.logChannelId ? `<#${s.logChannelId}>` : "Off", inline: true },
      { name: "Staff roles", value: s.staffRoleIds.length ? s.staffRoleIds.map((id) => `<@&${id}>`).join(" ") : "Only admins", inline: false },
      { name: "Last changed", value: s.updatedAt ? `${when(s.updatedAt)} by ${s.updatedBy ?? "?"}` : "Never", inline: false },
    );
}

/** Why the bot couldn't hand out this role, or null when it can. */
async function cannotGive(interaction, picked) {
  if (picked.id === interaction.guild.id) return "That's @everyone, which everyone already has.";
  if (picked.managed) return "That role belongs to a bot or integration, so it can't be handed out.";
  const me = await interaction.guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return "I don't have the **Manage Roles** permission. Give it to my role, then try again.";
  if (me.roles.highest.comparePositionTo(picked) <= 0) return `My role is below ${picked}. Drag my role above it in Server Settings → Roles, then try again.`;
  return null;
}

export default {
  category: "Admin",
  admin: true,
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Bot settings: buyer role, staff roles, log channel (admins only)")
    // Hidden from everyone without Administrator in the command list too.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName("view").setDescription("See the current settings"))
    .addSubcommand((s) => s.setName("buyer-role").setDescription("The role people get when they have an account with time").addRoleOption(role("The buyer role")))
    .addSubcommand((s) => s.setName("staff-add").setDescription("Let a role use the staff commands").addRoleOption(role("The staff role")))
    .addSubcommand((s) => s.setName("staff-remove").setDescription("Stop a role using the staff commands").addRoleOption(role("The role to remove")))
    .addSubcommand((s) =>
      s
        .setName("log-channel")
        .setDescription("Where to post logs of keys, resets and bans; leave empty to turn logs off")
        .addChannelOption((o) => o.setName("channel").setDescription("A staff-only text channel").addChannelTypes(ChannelType.GuildText)),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const by = interaction.user.tag ?? interaction.user.username;

    if (sub === "view") {
      return interaction.reply(privately({ embeds: [settingsEmbed(await refreshSettings())], allowedMentions: { parse: [] } }));
    }

    await interaction.deferReply({ flags: 64 });
    let s;
    let note;

    if (sub === "buyer-role") {
      const picked = interaction.options.getRole("role", true);
      const problem = await cannotGive(interaction, picked);
      if (problem) throw new UserError(problem);
      s = await changeSetting("buyer_role", picked.id, by);
      note = `✅ Buyer role is now ${picked}. Everyone with time gets it within a minute, and new buyers get it when they redeem or link.`;
      // Gives it to existing buyers now rather than at the next check.
      syncBuyerRoles(interaction.client).catch((e) => console.warn(`Role sync failed: ${e?.message ?? e}`));
    } else if (sub === "staff-add") {
      const picked = interaction.options.getRole("role", true);
      if (picked.id === interaction.guild.id) throw new UserError("That's @everyone. Pick a role only your staff have.");
      s = await changeSetting("staff_add", picked.id, by);
      note = `✅ ${picked} can now use the staff commands.`;
    } else if (sub === "staff-remove") {
      const picked = interaction.options.getRole("role", true);
      s = await changeSetting("staff_remove", picked.id, by);
      note = `✅ ${picked} can no longer use the staff commands.`;
    } else if (sub === "log-channel") {
      const channel = interaction.options.getChannel("channel");
      if (channel) {
        const me = await interaction.guild.members.fetchMe();
        const can = channel.permissionsFor(me);
        if (!can?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
          throw new UserError(`I can't post in ${channel}. Let my role view it, send messages and embed links there, then try again.`);
        }
      }
      s = await changeSetting("log_channel", channel?.id ?? "", by);
      note = channel ? `✅ Logs now go to ${channel}.` : "✅ Logs are off.";
    }

    await interaction.editReply(privately({ embeds: [settingsEmbed(s, note)], allowedMentions: { parse: [] } }));
    await log(interaction.client, { title: "⚙️ Settings changed", description: note.replace("✅ ", ""), color: COLORS.brand, by: interaction.user });
  },
};
