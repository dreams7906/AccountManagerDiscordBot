import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { rpc } from "../db.js";
import { settings } from "../settings.js";
import { base, COLORS, notice, privately, success } from "../ui.js";
import account, { notLinked } from "./account.js";
import hwidreset from "./hwidreset.js";
import { openRedeem } from "./redeem.js";
import resetpassword from "./resetpassword.js";
import { claimTrial } from "./trial.js";

/** The license panel members use instead of typing commands. */
function panelMessage() {
  const embed = base("License management").setDescription(
    [
      "Manage your license privately. Only you see the replies.",
      "",
      "**Redeem a key**  Create your account, or add time to it",
      "**My account**  License status, expiry and device",
      "**Reset HWID**  Move your license to another PC, once every 24 hours",
      "**Get buyer role**  Claim the buyer role for an active license",
    ].join("\n"),
  );
  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("panel:redeem").setLabel("Redeem a key").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("panel:account").setLabel("My account").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("panel:hwid").setLabel("Reset HWID").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("panel:role").setLabel("Get buyer role").setStyle(ButtonStyle.Secondary),
  );
  const links = new ActionRowBuilder();
  if (config.websiteUrl) links.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Purchase").setURL(`${config.websiteUrl}/pricing`));
  if (config.downloadUrl) links.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Download").setURL(config.downloadUrl));
  return { embeds: [embed], components: links.components.length ? [actions, links] : [actions] };
}

/**
 * Gives the buyer role to someone whose Discord is linked to an account with
 * an active license, and explains why not otherwise.
 */
async function claimRole(interaction) {
  const roleId = settings().buyerRoleId;
  if (!roleId) return interaction.reply(privately({ embeds: [notice("Not available", "The buyer role hasn't been set up yet. Ask staff.")] }));
  const me = await rpc("bot_me", { p_discord_id: interaction.user.id });
  if (!me) return interaction.reply(notLinked());
  if (!me.active) return interaction.reply(privately({ embeds: [notice("No active license", `**${me.username}** has no time left. Redeem a key to get the buyer role.`)] }));
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.roles.cache.has(roleId)) return interaction.reply(privately({ embeds: [base("Already assigned", COLORS.muted).setDescription(`You already have <@&${roleId}>.`)], allowedMentions: { parse: [] } }));
  try {
    await member.roles.add(roleId, "Linked account with an active license");
  } catch {
    return interaction.reply(privately({ embeds: [notice("Couldn't assign the role", "The bot can't give that role right now. Ask staff to check its role position.")] }));
  }
  await interaction.reply(privately({ embeds: [success("Role assigned", `You now have <@&${roleId}>.`)], allowedMentions: { parse: [] } }));
}

export default {
  category: "Staff",
  staff: true,
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Post the license panel in a channel (staff)")
    .addChannelOption((o) => o.setName("channel").setDescription("Where to post it (default: here)").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    await channel.send(panelMessage());
    await interaction.reply(privately({ content: `License panel posted in <#${channel.id}>.` }));
  },

  // The panel's buttons work for everyone, so they aren't staff-only.
  publicButtons: true,
  buttons: {
    redeem: (interaction) => openRedeem(interaction),
    account: (interaction) => account.execute(interaction),
    hwid: (interaction) => hwidreset.execute(interaction),
    role: (interaction) => claimRole(interaction),
    // Kept so panels posted before these buttons were removed keep working.
    trial: (interaction) => claimTrial(interaction),
    password: (interaction) => resetpassword.execute(interaction),
  },
};
