import { SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { base, linkButtons, privately } from "../ui.js";

export default {
  category: "Info",
  data: new SlashCommandBuilder().setName("download").setDescription("Get the app and see how to start"),

  async execute(interaction) {
    const embed = base(`Get ${config.brand}`).setDescription(
      [
        config.downloadUrl ? `**1.** [Download the app](${config.downloadUrl}) and run the setup.` : "**1.** Ask staff for the download link.",
        "**2.** Get a key with **/pricing**, or from staff.",
        "**3.** Run **/redeem** here to make your account, or choose **Register** in the app.",
        "**4.** Sign in to the app. Your account locks to that PC; **/hwidreset** moves it (once a day).",
      ].join("\n"),
    );
    await interaction.reply(privately({ embeds: [embed], components: linkButtons() }));
  },
};
