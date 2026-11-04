import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { UserError } from "../db.js";
import { log } from "../log.js";
import { syncBuyerRoles } from "../roles.js";
import { changeSetting, refreshSettings } from "../settings.js";
import { base, COLORS, privately, when } from "../ui.js";
import { trialPanel } from "./trial.js";

const role = (desc) => (o) => o.setName("role").setDescription(desc).setRequired(true);

/** The current settings as a card. */
function settingsEmbed(s, note) {
  return base("Bot settings")
    .setDescription(note ?? "Change these with **/setup**. Only server admins can.")
    .addFields(
      { name: "Buyer role", value: s.buyerRoleId ? `<@&${s.buyerRoleId}>` : "Not set: no one gets a role", inline: true },
      { name: "General logs", value: s.logChannelId ? `<#${s.logChannelId}>` : "Off", inline: true },
      { name: "Purchase logs", value: s.purchaseLogChannelId ? `<#${s.purchaseLogChannelId}>` : "General", inline: true },
      { name: "Staff logs", value: s.staffLogChannelId ? `<#${s.staffLogChannelId}>` : "General", inline: true },
      { name: "Account logs", value: s.accountLogChannelId ? `<#${s.accountLogChannelId}>` : "General", inline: true },
      { name: "Free trials", value: s.trialsEnabled ? "On" : "Paused", inline: true },
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
        .setDescription("General logs, and any kind without its own channel; leave empty to turn off")
        .addChannelOption((o) => o.setName("channel").setDescription("A staff-only text channel").addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s
        .setName("purchase-logs")
        .setDescription("Where website sales are posted; leave empty to use the general log channel")
        .addChannelOption((o) => o.setName("channel").setDescription("A staff-only text channel").addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s
        .setName("staff-logs")
        .setDescription("Where staff actions are posted (Discord and website); empty uses the general channel")
        .addChannelOption((o) => o.setName("channel").setDescription("A staff-only text channel").addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s
        .setName("account-logs")
        .setDescription("Where sign-ups, redemptions, HWID resets and trials are posted; empty uses general")
        .addChannelOption((o) => o.setName("channel").setDescription("A staff-only text channel").addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s
        .setName("trials")
        .setDescription("Turn free trials on or off")
        .addStringOption((o) => o.setName("state").setDescription("On or off").setRequired(true).addChoices({ name: "On", value: "on" }, { name: "Off", value: "off" })),
    )
    .addSubcommand((s) =>
      s
        .setName("trial-panel")
        .setDescription("Post a Get free trial button in a channel; keys go out by DM")
        .addChannelOption((o) => o.setName("channel").setDescription("Where to post it (default: here)").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
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
      note = `Buyer role is now ${picked}. Everyone with time gets it within a minute, and new buyers get it when they redeem or link.`;
      // Gives it to existing buyers now rather than at the next check.
      syncBuyerRoles(interaction.client).catch((e) => console.warn(`Role sync failed: ${e?.message ?? e}`));
    } else if (sub === "staff-add") {
      const picked = interaction.options.getRole("role", true);
      if (picked.id === interaction.guild.id) throw new UserError("That's @everyone. Pick a role only your staff have.");
      s = await changeSetting("staff_add", picked.id, by);
      note = `${picked} can now use the staff commands.`;
    } else if (sub === "staff-remove") {
      const picked = interaction.options.getRole("role", true);
      s = await changeSetting("staff_remove", picked.id, by);
      note = `${picked} can no longer use the staff commands.`;
    } else if (sub === "trials") {
      const on = interaction.options.getString("state", true) === "on";
      s = await changeSetting("trials", on ? "on" : "off", by);
      note = on ? "Free trials are on." : "Free trials are paused. The trial button now tells people to check back later.";
    } else if (sub === "trial-panel") {
      const channel = interaction.options.getChannel("channel") ?? interaction.channel;
      await channel.send(trialPanel());
      s = await refreshSettings();
      note = `Trial panel posted in ${channel}.${s.trialsEnabled ? "" : " Trials are paused; turn them on with /setup trials."}`;
    } else if (["log-channel", "purchase-logs", "staff-logs", "account-logs"].includes(sub)) {
      const channel = interaction.options.getChannel("channel");
      if (channel) {
        const me = await interaction.guild.members.fetchMe();
        const can = channel.permissionsFor(me);
        if (!can?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
          throw new UserError(`I can't post in ${channel}. Let my role view it, send messages and embed links there, then try again.`);
        }
      }
      const kind = { "log-channel": ["log_channel", "General logs"], "purchase-logs": ["log_purchase", "Purchase logs"], "staff-logs": ["log_staff", "Staff logs"], "account-logs": ["log_account", "Account logs"] }[sub];
      s = await changeSetting(kind[0], channel?.id ?? "", by);
      note = channel ? `${kind[1]} now go to ${channel}.` : sub === "log-channel" ? "General logs are off." : `${kind[1]} now go to the general log channel.`;
    }

    await interaction.editReply(privately({ embeds: [settingsEmbed(s, note)], allowedMentions: { parse: [] } }));
    await log(interaction.client, { category: "staff", title: "Settings changed", description: note, color: COLORS.brand, by: interaction.user });
  },
};
