import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { base, privately } from "../ui.js";
import account from "./account.js";
import hwidreset from "./hwidreset.js";
import { openRedeem } from "./redeem.js";
import resetpassword from "./resetpassword.js";
import { claimTrial } from "./trial.js";

/** The message members click instead of typing commands. */
function panelMessage() {
  const embed = base(`🎮 ${config.brand}`)
    .setDescription(
      [
        "**New here?** Press **Redeem a key** to make your account. Your Discord is linked automatically.",
        "**Want to try it first?** Press **Free trial** for one day, once per person.",
        "**Have time already?** Redeem another key to add more.",
        "",
        "🖥️ **Reset HWID** moves your account to another PC (once a day).",
        "🔐 **Reset password** sets a new one if you forgot it.",
        "",
        "Everything here is private: only you see the replies.",
      ].join("\n"),
    );
  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("panel:redeem").setLabel("Redeem a key").setEmoji("🔑").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("panel:trial").setLabel("Free trial").setEmoji("🎁").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("panel:account").setLabel("My account").setEmoji("👤").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("panel:hwid").setLabel("Reset HWID").setEmoji("🖥️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("panel:password").setLabel("Reset password").setEmoji("🔐").setStyle(ButtonStyle.Secondary),
  );
  const links = new ActionRowBuilder();
  if (config.websiteUrl) links.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Buy a key").setEmoji("🛒").setURL(`${config.websiteUrl}/#pricing`));
  if (config.downloadUrl) links.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Download").setEmoji("⬇️").setURL(config.downloadUrl));
  return { embeds: [embed], components: links.components.length ? [actions, links] : [actions] };
}

export default {
  category: "Staff",
  staff: true,
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Post the account panel with buttons in a channel (staff)")
    .addChannelOption((o) => o.setName("channel").setDescription("Where to post it (default: here)").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    await channel.send(panelMessage());
    await interaction.reply(privately({ content: `✅ Panel posted in <#${channel.id}>.` }));
  },

  // The panel's buttons work for everyone, so they aren't staff-only.
  publicButtons: true,
  buttons: {
    redeem: (interaction) => openRedeem(interaction),
    trial: (interaction) => claimTrial(interaction),
    account: (interaction) => account.execute(interaction),
    hwid: (interaction) => hwidreset.execute(interaction),
    password: (interaction) => resetpassword.execute(interaction),
  },
};
