import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";
import { db, loadPlans, UserError } from "../db.js";
import { log } from "../log.js";
import { base, COLORS, lengthLabel, privately } from "../ui.js";
import { planAutocomplete } from "./shared.js";

export default {
  category: "Staff",
  staff: true,
  data: new SlashCommandBuilder()
    .setName("genkey")
    .setDescription("Make keys (staff)")
    .addStringOption((o) => o.setName("plan").setDescription("How long each key lasts").setRequired(true).setAutocomplete(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("How many (1–50, default 1)").setMinValue(1).setMaxValue(50))
    .addStringOption((o) => o.setName("note").setDescription("Shown on the admin page, e.g. giveaway or a buyer's name").setMaxLength(100))
    .addUserOption((o) => o.setName("send_to").setDescription("DM the keys to this person")),

  autocomplete: planAutocomplete,

  async execute(interaction) {
    const planId = interaction.options.getString("plan", true);
    const amount = interaction.options.getInteger("amount") ?? 1;
    const note = interaction.options.getString("note") ?? "";
    const sendTo = interaction.options.getUser("send_to");
    const plan = (await loadPlans()).find((p) => p.id === planId && p.id !== "trial");
    if (!plan) throw new UserError("Pick a plan from the list.");
    await interaction.deferReply({ flags: 64 });

    // A list of keys, so this calls the table function directly rather than rpc().
    const { data, error } = await db().rpc("bot_create_keys", { p_plan: plan.id, p_count: amount, p_note: note, p_by: interaction.user.tag });
    if (error) throw new UserError(error.message);
    const keys = data.map((row) => (typeof row === "string" ? row : row.bot_create_keys));
    const length = lengthLabel(plan.duration_days);

    let dm = "";
    if (sendTo) {
      try {
        await sendTo.send({
          embeds: [
            base(`🔑 Your ${config.brand} key${keys.length > 1 ? "s" : ""}`, COLORS.ok).setDescription(
              `${length} each.\n\`\`\`\n${keys.join("\n")}\n\`\`\`\nRun **/redeem** in the server to make your account (or add time to it), or choose **Register** in the app.`,
            ),
          ],
        });
        dm = `\n📨 Sent to <@${sendTo.id}> by DM.`;
      } catch {
        dm = `\n⚠️ Couldn't DM <@${sendTo.id}> (their DMs are closed). Send the keys yourself.`;
      }
    }

    // Long lists go in a file so they stay easy to copy.
    const inline = keys.length <= 15;
    await interaction.editReply(
      privately({
        embeds: [
          base(`🔑 Made ${keys.length} ${length} key${keys.length > 1 ? "s" : ""}`, COLORS.ok).setDescription(
            `${inline ? `\`\`\`\n${keys.join("\n")}\n\`\`\`` : "The keys are in the attached file."}${note ? `\nNote: ${note}` : ""}${dm}`,
          ),
        ],
        files: inline ? [] : [new AttachmentBuilder(Buffer.from(keys.join("\n")), { name: `keys-${plan.id}-${keys.length}.txt` })],
        allowedMentions: { parse: [] },
      }),
    );
    await log(interaction.client, {
      title: "🔑 Keys made",
      description: `${keys.length} × ${length}${note ? ` · ${note}` : ""}${sendTo ? ` · sent to <@${sendTo.id}>` : ""}`,
      color: COLORS.brand,
      by: interaction.user,
    });
  },
};
