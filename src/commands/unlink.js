import { SlashCommandBuilder } from "discord.js";
import { authorizationMessage } from "./link.js";

export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("unlink").setDescription("Remove your Discord link through official authorization"),
  execute: interaction => interaction.reply(authorizationMessage()),
  buttons: {
    confirm: interaction => interaction.reply(authorizationMessage()),
    cancel: interaction => interaction.reply(authorizationMessage()),
  },
};
