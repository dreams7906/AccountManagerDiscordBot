import { SlashCommandBuilder } from "discord.js";
import { rpc } from "../db.js";
import { base, privately } from "../ui.js";

export default {
  category: "Staff",
  staff: true,
  data: new SlashCommandBuilder().setName("stats").setDescription("Accounts and keys at a glance (staff)"),

  async execute(interaction) {
    const s = await rpc("bot_stats");
    const n = (v) => Number(v).toLocaleString("en-US");
    const embed = base("📊 Stats").addFields(
      { name: "Accounts", value: n(s.accounts), inline: true },
      { name: "With time", value: n(s.active), inline: true },
      { name: "Lifetime", value: n(s.lifetime), inline: true },
      { name: "Used the app today", value: n(s.onlineToday), inline: true },
      { name: "New this week", value: n(s.newThisWeek), inline: true },
      { name: "Discord linked", value: n(s.linked), inline: true },
      { name: "Keys unused", value: n(s.keysUnused), inline: true },
      { name: "Keys used", value: n(s.keysUsed), inline: true },
      { name: "Keys sold online", value: n(s.keysSold), inline: true },
      { name: "Banned", value: n(s.banned), inline: true },
    );
    await interaction.reply(privately({ embeds: [embed] }));
  },
};
