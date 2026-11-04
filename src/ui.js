import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { config } from "./config.js";

export const COLORS = { brand: 0x8e96ff, ok: 0x4ade80, warn: 0xfbbf24, err: 0xf87171, muted: 0x2b2d31 };

/** Discord renders these in each reader's own time zone. */
export const when = (iso, style = "R") => (iso ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:${style}>` : "—");

export function base(title, color = COLORS.brand) {
  return new EmbedBuilder().setColor(color).setTitle(title).setFooter({ text: config.brand }).setTimestamp();
}

export const success = (title, description) => base(`${title}`, COLORS.ok).setDescription(description ?? null);
export const failure = (message) => base("Couldn't do that", COLORS.err).setDescription(message);
export const notice = (title, description) => base(title, COLORS.warn).setDescription(description ?? null);

export function lengthLabel(days) {
  if (days === null || days === undefined) return "Lifetime";
  return days === 1 ? "1 day" : `${days} days`;
}

/** "Lifetime", "Ends in 3 days", "Expired 2 hours ago". */
export function timeLine(a) {
  if (a.lifetime) return "Lifetime";
  if (!a.expiresAt) return "No time yet";
  return new Date(a.expiresAt) > new Date() ? `Ends ${when(a.expiresAt)} (${when(a.expiresAt, "f")})` : `Expired ${when(a.expiresAt)}`;
}

/** An account card. Staff see a few extra lines. */
export function accountEmbed(a, { staff = false, title } = {}) {
  const status = a.banned ? "Banned" : a.active ? "Active" : "No time left";
  const pc = a.deviceLocked ? "Locked to a PC" : "Not locked to a PC";
  const reset = !a.deviceLocked
    ? "Nothing to reset"
    : a.canMoveDevice
      ? "Available now"
      : `Available ${when(a.moveAvailableAt)}`;
  const embed = base(title ?? `${a.username}`, a.banned ? COLORS.err : a.active ? COLORS.ok : COLORS.warn).addFields(
    { name: "Status", value: status, inline: true },
    { name: "Time", value: timeLine(a), inline: true },
    { name: "PC", value: pc, inline: true },
    { name: "HWID reset", value: reset, inline: true },
    { name: "Discord", value: a.discordId ? `<@${a.discordId}>` : "Not linked", inline: true },
    { name: "Keys redeemed", value: String(a.keysRedeemed ?? 0), inline: true },
  );
  if (staff) {
    embed.addFields(
      { name: "Registered", value: when(a.createdAt, "D"), inline: true },
      { name: "Last seen", value: a.lastLoginAt ? when(a.lastLoginAt) : "Never", inline: true },
      { name: "App version", value: a.lastVersion || "—", inline: true },
    );
    if (a.banned && a.banReason) embed.addFields({ name: "Ban reason", value: a.banReason });
    if (a.isAdmin) embed.addFields({ name: "Role", value: "Website admin" });
  }
  return embed;
}

/** Website and download buttons, when those are set up. */
export function linkButtons(...extra) {
  const row = new ActionRowBuilder();
  if (config.websiteUrl) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Website").setURL(config.websiteUrl));
  if (config.downloadUrl) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Download").setURL(config.downloadUrl));
  if (config.websiteUrl) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Buy a key").setURL(`${config.websiteUrl}/#pricing`));
  row.addComponents(...extra);
  return row.components.length ? [row] : [];
}

/** Everything the bot sends to one person is visible only to them. */
export const privately = (payload) => ({ ...payload, flags: 64 });
