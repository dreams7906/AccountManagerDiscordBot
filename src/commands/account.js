import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { rpc } from "../db.js";
import { accountEmbed, base, linkButtons, privately } from "../ui.js";

/** The account card with buttons for what can be done next. */
export function accountView(me) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("account:refresh").setLabel("Refresh").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("hwidreset:ask").setLabel("Reset HWID").setStyle(ButtonStyle.Primary).setDisabled(!me.deviceLocked || !me.canMoveDevice),
  );
  return privately({ embeds: [accountEmbed(me, { title: `Your account: ${me.username}` })], components: [row] });
}

export const notLinked = () =>
  privately({
    embeds: [
      base("You don't have a linked account yet").setDescription(
        "• **Have a key?** Use **/redeem**: it makes your account, linked to your Discord.\n• **Already made one in the app or on the website?** Use **/link**.",
      ),
    ],
    components: linkButtons(),
  });

export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("account").setDescription("See your account: time left, PC lock and HWID reset"),

  async execute(interaction) {
    const me = await rpc("bot_me", { p_discord_id: interaction.user.id });
    await interaction.reply(me ? accountView(me) : notLinked());
  },

  buttons: {
    async refresh(interaction) {
      const me = await rpc("bot_me", { p_discord_id: interaction.user.id });
      await interaction.update(me ? accountView(me) : notLinked());
    },
  },
};
