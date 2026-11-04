import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { rpc, UserError } from "../db.js";
import { log } from "../log.js";
import { settings } from "../settings.js";
import { base, COLORS, privately } from "../ui.js";
import { openRedeem } from "./redeem.js";

/** The message admins post in a channel with /setup trial-panel. */
export function trialPanel() {
  return {
    embeds: [
      base("Free trial").setDescription(
        `Try ${config.brand} for 1 day. Your trial key is sent to you by DM.\n\nOne trial per person and per device.`,
      ),
    ],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("trial:claim").setLabel("Claim free trial").setStyle(ButtonStyle.Primary))],
  };
}

/**
 * Gives a free 1-day trial key (once per Discord user, once per PC), sends
 * it by DM so it isn't lost, and offers to make the account right away.
 */
export async function claimTrial(interaction) {
  if (!settings().trialsEnabled) throw new UserError("Free trials are paused right now. Check back later.");
  const key = await rpc("bot_claim_trial", { p_discord_id: interaction.user.id });

  let dmed = false;
  try {
    await interaction.user.send({
      embeds: [
        base("Your free trial key", COLORS.ok).setDescription(
          `\`\`\`\n${key}\n\`\`\`\nIn the server, run **/redeem** with this key to make your account, or choose **Register** in the app. It lasts 1 day from when you redeem it and works on one PC.`,
        ),
      ],
    });
    dmed = true;
  } catch {
    /* DMs closed: the key is shown below instead */
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`trial:redeem:${key}`).setLabel("Create my account").setStyle(ButtonStyle.Success),
  );
  await interaction.reply(
    privately({
      embeds: [
        base("Free trial", COLORS.ok).setDescription(
          `${dmed ? "Your trial key is in your DMs." : "Your DMs are closed, so here's your key:"}\n\`\`\`\n${key}\n\`\`\`\nPress **Create my account** to pick a username and password now.`,
        ),
      ],
      components: [row],
    }),
  );
  await log(interaction.client, { title: "Trial claimed", description: `<@${interaction.user.id}> claimed a free trial${dmed ? "" : " (DMs closed)"}`, color: COLORS.brand, by: interaction.user });
}

export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("trial").setDescription("Get a free 1-day trial key by DM (once per person)"),
  execute: claimTrial,
  // The trial panel's button is for everyone.
  publicButtons: true,
  buttons: {
    claim: (interaction) => claimTrial(interaction),
    // The key rides in the button's ID: "trial:redeem:<key>".
    redeem: (interaction) => openRedeem(interaction, interaction.customId.split(":").slice(2).join(":")),
  },
};
