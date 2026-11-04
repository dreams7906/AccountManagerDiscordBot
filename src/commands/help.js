import { SlashCommandBuilder } from "discord.js";
import { isStaff } from "../access.js";
import { config } from "../config.js";
import { base, linkButtons, privately } from "../ui.js";

const SECTIONS = [
  ["Account", "🎮 Your account"],
  ["Info", "ℹ️ Info"],
  ["Staff", "🛠️ Staff"],
];

export default {
  category: "Info",
  data: new SlashCommandBuilder().setName("help").setDescription("Everything this bot can do"),

  async execute(interaction) {
    // Imported here: the list includes this command.
    const { commands } = await import("./index.js");
    const staff = isStaff(interaction);
    const embed = base(`📖 ${config.brand} bot`).setDescription(
      "**Start here:** get a key, then run **/redeem**. It makes your account and links your Discord.\nEverything the bot says to you is private.",
    );
    for (const [category, title] of SECTIONS) {
      if (category === "Staff" && !staff) continue;
      const list = commands.filter((c) => c.category === category);
      embed.addFields({ name: title, value: list.map((c) => `**/${c.data.name}** · ${c.data.description.replace(" (staff)", "")}`).join("\n") });
    }
    await interaction.reply(privately({ embeds: [embed], components: linkButtons() }));
  },
};
