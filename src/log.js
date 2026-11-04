import { settings } from "./settings.js";
import { base, COLORS } from "./ui.js";

/** Posts what happened to the staff log channel, when one is set. Never throws. */
export async function log(client, { title, description, color = COLORS.muted, by, fields = [] }) {
  const channelId = settings().logChannelId;
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return;
    const embed = base(title, color).setDescription(description ?? null).addFields(fields);
    if (by) embed.setAuthor({ name: by.tag ?? by.username, iconURL: by.displayAvatarURL?.() });
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (e) {
    console.warn(`Couldn't post to the log channel: ${e?.message ?? e}`);
  }
}
