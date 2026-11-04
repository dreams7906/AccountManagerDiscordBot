import { ActionRowBuilder, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { rpc } from "../db.js";
import { log } from "../log.js";
import { giveBuyerRole } from "../roles.js";
import { accountEmbed, COLORS, linkButtons, privately, timeLine } from "../ui.js";

const KEY_HINT = "SAM-XXXXX-XXXXX-XXXXX-XXXXX";

function input(id, label, { min = 1, max = 100, placeholder = "", value = "" } = {}) {
  const box = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(min).setMaxLength(max);
  if (placeholder) box.setPlaceholder(placeholder);
  if (value) box.setValue(value);
  return new ActionRowBuilder().addComponents(box);
}

/** Adds a key's time to the caller's linked account. */
async function addTime(interaction, key) {
  const account = await rpc("bot_redeem", { p_discord_id: interaction.user.id, p_key: key.trim() });
  const role = await giveBuyerRole(interaction.guild, interaction.user.id);
  await interaction.editReply(
    privately({
      content: `Key redeemed. ${timeLine(account)}${role ? "\nBuyer role added." : ""}`,
      embeds: [accountEmbed(account)],
    }),
  );
  await log(interaction.client, { title: "Key redeemed", description: `<@${interaction.user.id}> added time to **${account.username}**`, color: COLORS.ok, by: interaction.user });
}

/** Makes an account from the form; the Discord ID comes from Discord itself. */
async function createAccount(interaction) {
  await interaction.deferReply({ flags: 64 });
  // The key is checked before anything is made.
  const account = await rpc("bot_register", {
    p_discord_id: interaction.user.id,
    p_username: interaction.fields.getTextInputValue("username").trim(),
    p_password: interaction.fields.getTextInputValue("password"),
    p_key: interaction.fields.getTextInputValue("key").trim(),
  });
  const role = account.active && (await giveBuyerRole(interaction.guild, interaction.user.id));
  await interaction.editReply(
    privately({
      content: [
        "Your account is ready and linked to your Discord.",
        "Open the app, choose **Sign in**, and use the username and password you just picked. It locks to the first PC you sign in on.",
        role ? "Buyer role added." : "",
      ]
        .filter(Boolean)
        .join("\n"),
      embeds: [accountEmbed(account, { title: "Your new account" })],
      components: linkButtons(),
    }),
  );
  await log(interaction.client, { title: "New account", description: `<@${interaction.user.id}> made **${account.username}** with a key`, color: COLORS.ok, by: interaction.user });
}

/**
 * Starts redeeming, from /redeem or the panel's button: adds time to a
 * linked account, or asks for a username and password to make one.
 */
export async function openRedeem(interaction, key = "") {
  const me = await rpc("bot_me", { p_discord_id: interaction.user.id });
  if (me) {
    if (key) {
      await interaction.deferReply({ flags: 64 });
      return addTime(interaction, key);
    }
    return interaction.showModal(
      new ModalBuilder().setCustomId("redeem:time").setTitle(`Add time to ${me.username}`.slice(0, 45)).addComponents(input("key", "Key", { min: 10, max: 40, placeholder: KEY_HINT })),
    );
  }
  return interaction.showModal(
    new ModalBuilder()
      .setCustomId("redeem:create")
      .setTitle("Create your account")
      .addComponents(
        input("key", "Key", { min: 10, max: 40, placeholder: KEY_HINT, value: key }),
        input("username", "Pick a username (3–20 letters, numbers, _)", { min: 3, max: 20 }),
        input("password", "Pick a password (8+ characters)", { min: 8, max: 128, placeholder: "Only the bot sees this" }),
      ),
  );
}

export default {
  category: "Account",
  data: new SlashCommandBuilder()
    .setName("redeem")
    .setDescription("Redeem a key: makes your account if you don't have one, or adds time to it")
    .addStringOption((o) => o.setName("key").setDescription(KEY_HINT).setMinLength(10).setMaxLength(40)),

  async execute(interaction) {
    await openRedeem(interaction, interaction.options.getString("key") ?? "");
  },

  modals: {
    async time(interaction) {
      await interaction.deferReply({ flags: 64 });
      await addTime(interaction, interaction.fields.getTextInputValue("key"));
    },
    create: createAccount,
  },
};
