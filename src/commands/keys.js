import { SlashCommandBuilder } from "discord.js";
import { rpc, UserError } from "../db.js";
import { log } from "../log.js";
import { base, COLORS, lengthLabel, privately, when } from "../ui.js";

const KEY = (o) => o.setName("key").setDescription("CAM-XXXXX-XXXXX-XXXXX-XXXXX").setRequired(true).setMinLength(10).setMaxLength(40);

function keyEmbed(k) {
  const state = k.revoked ? "Revoked" : k.redeemedBy ? "Used" : "Unused";
  return base(`${k.key}`, k.revoked ? COLORS.err : k.redeemedBy ? COLORS.muted : COLORS.ok).addFields(
    { name: "Status", value: state, inline: true },
    { name: "Length", value: lengthLabel(k.days), inline: true },
    { name: "Made", value: when(k.createdAt, "f"), inline: true },
    { name: "From", value: k.source || "—", inline: true },
    { name: "Used by", value: k.redeemedBy ? `**${k.redeemedBy}** ${when(k.redeemedAt)}` : "—", inline: true },
    { name: "Note", value: [k.note, k.buyerEmail].filter(Boolean).join(" · ") || "—", inline: true },
  );
}

export const keyinfo = {
  category: "Staff",
  staff: true,
  data: new SlashCommandBuilder().setName("keyinfo").setDescription("Check a key: unused, used by whom, or revoked (staff)").addStringOption(KEY),
  async execute(interaction) {
    const k = await rpc("bot_key_info", { p_key: interaction.options.getString("key", true) });
    if (!k) throw new UserError("That key doesn't exist.");
    await interaction.reply(privately({ embeds: [keyEmbed(k)] }));
  },
};

export const revokekey = {
  category: "Staff",
  staff: true,
  data: new SlashCommandBuilder()
    .setName("revokekey")
    .setDescription("Stop an unused key from working, or restore it (staff)")
    .addStringOption(KEY)
    .addBooleanOption((o) => o.setName("restore").setDescription("Undo a revoke instead")),
  async execute(interaction) {
    const restore = interaction.options.getBoolean("restore") ?? false;
    const k = await rpc("bot_revoke_key", { p_key: interaction.options.getString("key", true), p_revoked: !restore });
    await interaction.reply(privately({ content: restore ? "Key restored." : "Key revoked.", embeds: [keyEmbed(k)] }));
    await log(interaction.client, { title: restore ? "Key restored" : "Key revoked", description: `\`${k.key}\` (${lengthLabel(k.days)})`, color: restore ? COLORS.ok : COLORS.err, by: interaction.user });
  },
};
