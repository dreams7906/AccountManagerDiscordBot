import { SlashCommandBuilder } from "discord.js";
import { db, UserError } from "../db.js";
import { privately } from "../ui.js";

export default {
  category: "Staff",
  staff: true,
  data: new SlashCommandBuilder()
    .setName("robux")
    .setDescription("Manage Robux checkout settings (staff)")
    .addSubcommand(s => s.setName("view").setDescription("View the saved checkout settings"))
    .addSubcommand(s => s.setName("set").setDescription("Save a group pass and its listed price")
      .addStringOption(o => o.setName("plan").setDescription("License plan").setRequired(true)
        .addChoices({ name: "Weekly", value: "week" }, { name: "Monthly", value: "month" }, { name: "Lifetime", value: "lifetime" }))
      .addStringOption(o => o.setName("group").setDescription("Roblox group ID or link").setRequired(true))
      .addStringOption(o => o.setName("pass").setDescription("Roblox game pass ID or link").setRequired(true))
      .addIntegerOption(o => o.setName("price").setDescription("Listed price in Robux").setMinValue(1).setRequired(true))),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const table = db().from("robux_checkout_settings");
    if (interaction.options.getSubcommand() === "set") {
      const group = interaction.options.getString("group", true).trim();
      const pass = interaction.options.getString("pass", true).trim();
      const groupId = group.match(/^(\d{1,18})$/)?.[1] ?? group.match(/^https:\/\/(?:www\.)?roblox\.com\/(?:groups|communities)\/(\d{1,18})(?:[/?#]|$)/i)?.[1];
      const passId = pass.match(/^(\d{1,18})$/)?.[1] ?? pass.match(/^https:\/\/(?:www\.)?roblox\.com\/game-pass\/(\d{1,18})(?:[/?#]|$)/i)?.[1];
      if (!groupId || !passId) throw new UserError("Enter a Roblox group and game pass ID or link.");
      const { error } = await table.upsert({
        plan_id: interaction.options.getString("plan", true),
        group_id: groupId,
        pass_id: passId,
        price: interaction.options.getInteger("price", true),
      });
      if (error?.code === "23505") throw new UserError("That pass is already assigned to another plan.");
      if (error) throw new Error(`Saving Robux settings failed: ${error.code}`);
    }
    const { data, error } = await table.select("plan_id,group_id,pass_id,price").order("plan_id");
    if (error) throw new Error(`Reading Robux settings failed: ${error.code}`);
    const rows = data.map(row => `**${row.plan_id}** · ${row.price} Robux · [Group](https://www.roblox.com/communities/${row.group_id}) · [Pass](https://www.roblox.com/game-pass/${row.pass_id})`);
    await interaction.editReply(privately({ content: ["Saved Robux checkout settings", ...rows].join("\n") }));
  },
};
