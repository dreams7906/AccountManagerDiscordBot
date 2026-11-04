import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { rpc } from "../db.js";
import { base, COLORS, notice, privately, success, when } from "../ui.js";
import { notLinked } from "./account.js";

/** Explains what a reset does and asks to confirm, or says why it can't happen yet. */
async function ask(interaction, respond) {
  const me = await rpc("bot_me", { p_discord_id: interaction.user.id });
  if (!me) return respond(notLinked());
  if (!me.deviceLocked) return respond(privately({ embeds: [notice("Nothing to reset", "Your account isn't locked to a PC right now. It locks to the next PC you sign in to the app on.")], components: [] }));
  if (!me.canMoveDevice) return respond(privately({ embeds: [notice("Already reset today", `You can reset once a day. Next reset: ${when(me.moveAvailableAt)}.`)], components: [] }));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("hwidreset:confirm").setLabel("Yes, reset").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("hwidreset:cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );
  return respond(
    privately({
      embeds: [
        base("Reset your HWID?", COLORS.warn).setDescription(
          `This unlocks **${me.username}** from its PC and signs the app out there. The next PC you sign in on becomes your new one.\n\nYou can do this **once a day**.`,
        ),
      ],
      components: [row],
    }),
  );
}

export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("hwidreset").setDescription("Move your account to another PC (once a day; needs your Discord linked)"),

  async execute(interaction) {
    await ask(interaction, (payload) => interaction.reply(payload));
  },

  buttons: {
    // From the Reset HWID button on /account.
    async ask(interaction) {
      await ask(interaction, (payload) => interaction.reply(payload));
    },
    async confirm(interaction) {
      await interaction.deferUpdate();
      const account = await rpc("bot_hwid_reset", { p_discord_id: interaction.user.id });
      await interaction.editReply({
        embeds: [success("HWID reset", `**${account.username}** is unlocked. Sign in to the app on your new PC to lock it there.\nNext reset: ${when(account.moveAvailableAt)}.`)],
        components: [],
      });
    },
    async cancel(interaction) {
      await interaction.update({ embeds: [base("Cancelled", COLORS.muted).setDescription("Nothing changed.")], components: [] });
    },
  },
};
