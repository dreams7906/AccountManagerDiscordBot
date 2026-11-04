import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { base, privately } from "../ui.js";
import account from "./account.js";
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
    ].join("\n"),
  );
  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("panel:redeem").setLabel("Redeem a key").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("panel:account").setLabel("My account").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("panel:hwid").setLabel("Reset HWID").setStyle(ButtonStyle.Secondary),
  );
  const links = new ActionRowBuilder();
  if (config.websiteUrl) links.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Purchase").setURL(`${config.websiteUrl}/#pricing`));
  if (config.downloadUrl) links.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Download").setURL(config.downloadUrl));
  return { embeds: [embed], components: links.components.length ? [actions, links] : [actions] };
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
    // Kept so panels posted before these buttons were removed keep working.
    trial: (interaction) => claimTrial(interaction),
    password: (interaction) => resetpassword.execute(interaction),
  },
};
