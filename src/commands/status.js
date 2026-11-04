import { SlashCommandBuilder } from "discord.js";
import { loadPlans } from "../db.js";
import { base, COLORS, privately, when } from "../ui.js";

const started = new Date();

export default {
  category: "Info",
  data: new SlashCommandBuilder().setName("status").setDescription("Check the bot and the account servers are up"),

  async execute(interaction) {
    const t0 = Date.now();
    const up = await loadPlans()
      .then(() => true)
      .catch(() => false);
    const dbMs = Date.now() - t0;
    const embed = base(up ? "Everything's up" : "Account servers aren't answering", up ? COLORS.ok : COLORS.err).addFields(
      { name: "Bot", value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true },
      { name: "Accounts", value: up ? `${dbMs} ms` : "Down", inline: true },
      { name: "Online since", value: when(started.toISOString()), inline: true },
    );
    await interaction.reply(privately({ embeds: [embed] }));
  },
};
