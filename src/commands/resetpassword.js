import { ActionRowBuilder, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { rpc, UserError } from "../db.js";
import { log } from "../log.js";
import { COLORS, privately, success } from "../ui.js";

export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("resetpassword").setDescription("Set a new password for your linked account (forgot it? this works)"),

  async execute(interaction) {
    const me = await rpc("bot_me", { p_discord_id: interaction.user.id });
    if (!me) throw new UserError("Your Discord isn't linked to an account yet. Use /redeem with a key, or /link if you already have one.");
    const box = (id, label) =>
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(8).setMaxLength(128));
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("resetpassword:submit")
        .setTitle(`New password for ${me.username}`.slice(0, 45))
        .addComponents(box("password", "New password (8+ characters)"), box("confirm", "Type it again")),
    );
  },

  modals: {
    async submit(interaction) {
      const password = interaction.fields.getTextInputValue("password");
      if (password !== interaction.fields.getTextInputValue("confirm")) throw new UserError("The two passwords don't match. Run /resetpassword again.");
      await interaction.deferReply({ flags: 64 });
      const account = await rpc("bot_set_password", { p_discord_id: interaction.user.id, p_password: password });
      await interaction.editReply(
        privately({ embeds: [success("Password changed", `**${account.username}** has a new password. You've been signed out everywhere, so sign in to the app again with it.`)] }),
      );
      await log(interaction.client, { title: "Password reset", description: `<@${interaction.user.id}> reset the password for **${account.username}**`, color: COLORS.warn, by: interaction.user });
    },
  },
};
