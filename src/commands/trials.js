import { SlashCommandBuilder } from "discord.js";
import { log } from "../log.js";
import { changeSetting, refreshSettings } from "../settings.js";
import { base, COLORS, privately } from "../ui.js";

/** Lets staff pause or resume free trials at any time. */
export default {
  category: "Staff",
  staff: true,
  data: new SlashCommandBuilder()
    .setName("trials")
    .setDescription("Pause or resume free trials (staff)")
    .addStringOption((o) =>
      o.setName("state").setDescription("Leave empty to see whether trials are on").addChoices({ name: "On", value: "on" }, { name: "Off", value: "off" }),
    ),

  async execute(interaction) {
    const state = interaction.options.getString("state");
    if (!state) {
      const s = await refreshSettings();
      return interaction.reply(privately({ embeds: [base("Free trials", s.trialsEnabled ? COLORS.ok : COLORS.warn).setDescription(s.trialsEnabled ? "Trials are **on**." : "Trials are **paused**.")] }));
    }
    const s = await changeSetting("trials", state, interaction.user.tag ?? interaction.user.username);
    const text = s.trialsEnabled ? "Free trials are on." : "Free trials are paused. The trial button now tells people to check back later.";
    await interaction.reply(privately({ embeds: [base("Free trials", s.trialsEnabled ? COLORS.ok : COLORS.warn).setDescription(text)] }));
    await log(interaction.client, { title: s.trialsEnabled ? "Trials resumed" : "Trials paused", description: text, color: COLORS.warn, by: interaction.user });
  },
};
