import { ChannelType, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";
import { rpc } from "./db.js";

/**
 * The website's Discord manager. Staff write messages on shiftam.xyz; they
 * wait in the database until this picks them up. The bot also keeps the
 * channel list there up to date, so the site can show it like Discord does.
 */

const KINDS = {
  [ChannelType.GuildCategory]: "category",
  [ChannelType.GuildText]: "text",
  [ChannelType.GuildAnnouncement]: "announcement",
};

async function syncChannels(client) {
  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) return;
  const channels = await guild.channels.fetch();
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const list = [...channels.values()]
    .filter((c) => c && KINDS[c.type])
    .map((c) => {
      const perms = c.type === ChannelType.GuildCategory ? null : c.permissionsFor(me);
      return {
        id: c.id,
        name: c.name,
        kind: KINDS[c.type],
        parentId: c.parentId ?? "",
        // Categories first by their own position; channels by category, then position.
        position: c.type === ChannelType.GuildCategory ? c.position * 1000 : ((c.parent?.position ?? -1) + 1) * 1000 + c.position + 1,
        canSend: perms ? perms.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.SendMessages) : true,
      };
    });
  await rpc("bot_discord_sync_channels", { p_guild: guild.id, p_channels: list });
}

/** discord.js message options from what the site stored. */
function payload(post) {
  const e = post.embed;
  const embeds = [];
  if (e) {
    const embed = new EmbedBuilder();
    if (e.title) embed.setTitle(e.title);
    if (e.description) embed.setDescription(e.description);
    if (e.url) embed.setURL(e.url);
    if (e.image) embed.setImage(e.image);
    if (e.thumbnail) embed.setThumbnail(e.thumbnail);
    if (e.footer) embed.setFooter({ text: e.footer });
    if (e.color) embed.setColor(parseInt(e.color, 16));
    embeds.push(embed);
  }
  // Nobody gets pinged by a message written on the website.
  return { content: post.content || null, embeds, allowedMentions: { parse: [] } };
}

const embedOf = (m) => {
  const e = m.embeds?.[0];
  if (!e) return null;
  return {
    title: e.title ?? undefined,
    description: e.description ?? undefined,
    url: e.url ?? undefined,
    image: e.image?.url ?? undefined,
    thumbnail: e.thumbnail?.url ?? undefined,
    footer: e.footer?.text ?? undefined,
    color: e.color != null ? e.color.toString(16).padStart(6, "0") : undefined,
  };
};

async function channelOf(client, id) {
  const channel = await client.channels.fetch(id).catch(() => null);
  if (!channel?.isTextBased?.()) throw new Error("That channel is gone or the bot can't see it.");
  return channel;
}

async function runPost(client, post) {
  try {
    const channel = await channelOf(client, post.channelId);
    if (post.action === "send") {
      const msg = await channel.send(payload(post));
      await rpc("bot_discord_done", { p_id: post.id, p_message_id: msg.id });
    } else if (post.action === "edit") {
      const msg = await channel.messages.fetch(post.messageId);
      await msg.edit(payload(post));
      await rpc("bot_discord_done", { p_id: post.id, p_message_id: msg.id });
    } else if (post.action === "delete") {
      const msg = await channel.messages.fetch(post.messageId).catch(() => null);
      if (msg) await msg.delete();
      await rpc("bot_discord_done", { p_id: post.id });
    }
  } catch (error) {
    // Discord says why ("Missing Permissions", "Unknown Message"); staff see it.
    await rpc("bot_discord_done", { p_id: post.id, p_error: error?.message ?? String(error) }).catch(() => {});
  }
}

async function loadChannel(client, channelId) {
  try {
    const channel = await channelOf(client, channelId);
    const messages = await channel.messages.fetch({ limit: 50 });
    const mine = [...messages.values()]
      .filter((m) => m.author.id === client.user.id)
      .map((m) => ({ id: m.id, content: m.content ?? "", embed: embedOf(m), createdAt: m.createdAt.toISOString() }));
    await rpc("bot_discord_loaded", { p_channel: channelId, p_messages: mine });
  } catch (error) {
    // Finish the request so the site stops waiting; the list just stays as it was.
    await rpc("bot_discord_loaded", { p_channel: channelId, p_messages: [] }).catch(() => {});
    console.warn(`Couldn't load #${channelId}: ${error?.message ?? error}`);
  }
}

export function startDiscordManager(client) {
  const sync = () => syncChannels(client).catch((e) => console.warn(`Channel sync failed: ${e?.message ?? e}`));
  setTimeout(sync, 5_000);
  setInterval(sync, 60_000);
  // A channel added, renamed or moved shows on the site within seconds.
  let soon;
  const resync = () => {
    clearTimeout(soon);
    soon = setTimeout(sync, 2_000);
  };
  client.on("channelCreate", resync);
  client.on("channelUpdate", resync);
  client.on("channelDelete", resync);

  let busy = false;
  const work = async () => {
    if (busy) return;
    busy = true;
    try {
      const todo = await rpc("bot_discord_take");
      for (const post of todo?.posts ?? []) await runPost(client, post);
      for (const channelId of todo?.loads ?? []) await loadChannel(client, channelId);
    } catch (e) {
      console.warn(`Discord manager check failed: ${e?.message ?? e}`);
    } finally {
      busy = false;
    }
  };
  setInterval(work, 3_000);
}
