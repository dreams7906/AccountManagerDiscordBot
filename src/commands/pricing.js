import { SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { loadPlans } from "../db.js";
import { base, lengthLabel, linkButtons } from "../ui.js";

export default {
  category: "Info",
  data: new SlashCommandBuilder().setName("pricing").setDescription("Key prices and where to buy"),

  async execute(interaction) {
    const plans = (await loadPlans()).filter((p) => p.active);
    const embed = base("Keys")
      .setDescription(`One key per account. Redeem another any time to add more.${config.websiteUrl ? `\nBuy on the [website](${config.websiteUrl}/#pricing) by card or crypto.` : ""}`)
      .addFields(plans.map((p) => ({ name: lengthLabel(p.duration_days), value: `**$${Number(p.price_usd).toFixed(2)}**`, inline: true })));
    await interaction.reply({ embeds: [embed], components: linkButtons() });
  },
};
