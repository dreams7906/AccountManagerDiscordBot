import { SlashCommandBuilder } from "discord.js";
import { rpc } from "../db.js";
import { accountEmbed, privately } from "../ui.js";
import { addTarget, target } from "./shared.js";

export default {
  category: "Staff",
  staff: true,
  data: addTarget(new SlashCommandBuilder().setName("lookup").setDescription("Look up an account (staff)")),

  async execute(interaction) {
    const t = target(interaction);
    const account = await rpc("bot_lookup", t.args);
    await interaction.reply(privately({ embeds: [accountEmbed(account, { staff: true })], allowedMentions: { parse: [] } }));
  },
};
