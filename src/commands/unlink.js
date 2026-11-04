import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { rpc } from "../db.js";
import { log } from "../log.js";
import { base, COLORS, privately, success } from "../ui.js";
import { notLinked } from "./account.js";

export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("unlink").setDescription("Unlink your Discord from your account"),

  async execute(interaction) {
    const me = await rpc("bot_me", { p_discord_id: interaction.user.id });
    if (!me) return interaction.reply(notLinked());
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("unlink:confirm").setLabel("Unlink").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("unlink:cancel").setLabel("Keep it linked").setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply(
      privately({
        embeds: [base(`Unlink ${me.username}?`, COLORS.warn).setDescription("You won't be able to use /hwidreset or /resetpassword until you /link again. Your account and its time are kept.")],
        components: [row],
      }),
    );
  },

  buttons: {
    async confirm(interaction) {
      await interaction.deferUpdate();
      const account = await rpc("bot_unlink", { p_discord_id: interaction.user.id });
      await interaction.editReply({ embeds: [success("Unlinked", `Your Discord is no longer linked to **${account.username}**.`)], components: [] });
      await log(interaction.client, { title: "Unlinked", description: `<@${interaction.user.id}> unlinked **${account.username}**`, by: interaction.user });
    },
    async cancel(interaction) {
      await interaction.update({ embeds: [base("Still linked", COLORS.muted).setDescription("Nothing changed.")], components: [] });
    },
  },
};
