import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { privately } from "../ui.js";

export function authorizationMessage() {
  return privately({
    content: "Sign in to your ShiftAM dashboard and use **Continue with Discord**. Linking, changing and removing Discord require official authorization. Your Discord stays reserved to your ShiftAM account.",
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Authorize Discord on dashboard").setStyle(ButtonStyle.Link).setURL("https://shiftam.xyz/account"))],
  });
}
export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("link").setDescription("Verify and link Discord through official authorization"),
  execute: interaction => interaction.reply(authorizationMessage()),
  modals: { submit: interaction => interaction.reply(authorizationMessage()) },
};
