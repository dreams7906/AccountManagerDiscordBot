import { ActionRowBuilder, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { rpc } from "../db.js";
import { log } from "../log.js";
import { giveBuyerRole } from "../roles.js";
import { accountEmbed, COLORS, privately } from "../ui.js";

export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("link").setDescription("Link your Discord to an account you made in the app or on the website"),

  async execute(interaction) {
    const input = (id, label, min, max) =>
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(min).setMaxLength(max));
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("link:submit")
        .setTitle("Link your account")
        .addComponents(input("username", "Username", 3, 20), input("password", "Password (only the bot sees this)", 1, 128)),
    );
  },

  modals: {
    async submit(interaction) {
      await interaction.deferReply({ flags: 64 });
      const account = await rpc("bot_link", {
        p_discord_id: interaction.user.id,
        p_username: interaction.fields.getTextInputValue("username").trim(),
        p_password: interaction.fields.getTextInputValue("password"),
      });
      const role = account.active && (await giveBuyerRole(interaction.guild, interaction.user.id));
      await interaction.editReply(
        privately({
          content: `🔗 **Linked!** You can now use /hwidreset, /redeem, /resetpassword and /account here.${role ? " You also got the buyer role." : ""}`,
          embeds: [accountEmbed(account)],
        }),
      );
      await log(interaction.client, { title: "🔗 Linked", description: `<@${interaction.user.id}> linked **${account.username}**`, color: COLORS.ok, by: interaction.user });
    },
  },
};
