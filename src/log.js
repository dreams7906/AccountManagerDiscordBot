import { config } from "./config.js";
import { rpc } from "./db.js";
import { settings } from "./settings.js";
import { base, COLORS, lengthLabel, when } from "./ui.js";

/**
 * Logs go to one channel per kind, set with /setup:
 * - purchase: sales from the website
 * - staff: staff commands, website staff panel actions, settings changes
 * - account: sign-ups, redemptions, HWID and password resets, trials
 * A kind without its own channel falls back to the general log channel.
 */
function channelFor(category) {
  const s = settings();
  const own = { purchase: s.purchaseLogChannelId, staff: s.staffLogChannelId, account: s.accountLogChannelId }[category];
  return own || s.logChannelId;
}

/** Posts one log entry. Never throws. */
export async function log(client, { category = "staff", title, description, color = COLORS.muted, by, fields = [] }) {
  const channelId = channelFor(category);
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return;
    const embed = base(title, color).setDescription(description ?? null).addFields(fields);
    if (by) embed.setAuthor({ name: by.tag ?? by.username, iconURL: by.displayAvatarURL?.() });
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (e) {
    console.warn(`Couldn't post to the ${category} log: ${e?.message ?? e}`);
  }
}

const who = (username, discordId) => `**${username}**${discordId ? ` (<@${discordId}>)` : ""}`;
const sourceLabel = (source = "") =>
  source === "card" ? "Card" : source === "crypto" ? "Crypto" : source === "trial" ? "Free trial" : source.startsWith("discord:") ? `Discord (${source.slice(8)})` : source.startsWith("web:") ? `Staff panel (${source.slice(4)})` : source.startsWith("import:") ? `Imported (${source.slice(7)})` : source || "Unknown";

/**
 * Posts what happened outside Discord since the last check: website sales,
 * sign-ups and redemptions from the app or website, HWID resets, and
 * actions in the website's staff panel. The database keeps the position,
 * so a restart neither repeats nor floods.
 */
export async function postFeed(client) {
  const s = settings();
  if (!s.logChannelId && !s.purchaseLogChannelId && !s.staffLogChannelId && !s.accountLogChannelId) return;
  const feed = await rpc("bot_feed", { p_guild_id: config.guildId });
  if (!feed) return;

  for (const p of feed.purchases ?? []) {
    await log(client, {
      category: "purchase",
      title: "New purchase",
      color: COLORS.ok,
      fields: [
        { name: "Plan", value: p.plan, inline: true },
        { name: "Price", value: `$${Number(p.price).toFixed(2)}`, inline: true },
        { name: "Paid by", value: sourceLabel(p.source), inline: true },
        { name: "Key", value: `\`${p.key}\``, inline: true },
        ...(p.email ? [{ name: "Buyer", value: p.email, inline: true }] : []),
        { name: "When", value: when(p.at, "f"), inline: true },
      ],
    });
  }
  for (const r of feed.signups ?? []) {
    await log(client, { category: "account", title: "New account", color: COLORS.ok, description: `${who(r.username, r.discordId)} signed up ${when(r.at)}.` });
  }
  for (const r of feed.redemptions ?? []) {
    await log(client, {
      category: "account",
      title: r.firstKey ? "First key redeemed" : "Key redeemed",
      color: COLORS.brand,
      description: `${who(r.username, r.discordId)} added ${lengthLabel(r.days).toLowerCase()} ${when(r.at)}.`,
      fields: [
        { name: "Key", value: `\`${r.key}\``, inline: true },
        { name: "From", value: sourceLabel(r.source), inline: true },
      ],
    });
  }
  for (const r of feed.resets ?? []) {
    await log(client, { category: "account", title: "HWID reset", color: COLORS.warn, description: `${who(r.username, r.discordId)} moved their license to a new PC ${when(r.at)}.` });
  }
  for (const r of feed.staff ?? []) {
    await log(client, { category: "staff", title: `Website: ${r.action}`, color: COLORS.brand, description: `**${r.by}** in the staff panel${r.detail ? `\n${r.detail}` : ""}` });
  }
}
