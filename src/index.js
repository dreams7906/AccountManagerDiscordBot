import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import { isAdmin, isStaff } from "./access.js";
import { byName } from "./commands/index.js";
import { config } from "./config.js";
import { startDiscordManager } from "./discord-manager.js";
import { startRobuxSales } from "./robux-sales.js";
import { startRobuxInvoices } from "./robux-invoices.js";
import { UserError } from "./db.js";
import { postFeed } from "./log.js";
import { syncBuyerRoles, syncStaff } from "./roles.js";
import { refreshSettings } from "./settings.js";
import { failure, privately } from "./ui.js";
import { syncVerifiedRoles } from './verification.js';

const ROLE_SYNC_EVERY = 10 * 60_000;

// Slash commands, buttons and forms need no privileged intents.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/** Answers with the error: the person's own message for refusals, a calm one for crashes. */
async function report(interaction, error) {
  const known = error instanceof UserError;
  if (!known) console.error(`[${new Date().toISOString()}] ${interaction.commandName ?? interaction.customId}:`, error);
  const payload = privately({ embeds: [failure(known ? error.message : "Something went wrong on our side. Try again in a minute; if it keeps happening, tell staff.")], components: [] });
  try {
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.reply(payload);
  } catch {
    /* the interaction expired; nothing more to do */
  }
}

const denied = (interaction, who = "staff") => interaction.reply(privately({ embeds: [failure(`That's for ${who} only.`)] }));

/** Admin commands need Administrator; staff commands need a staff role too. */
function allowed(command, interaction) {
  if (command.admin) return isAdmin(interaction);
  if (command.staff) return isStaff(interaction);
  return true;
}

client.on(Events.InteractionCreate, async (interaction) => {
  // Only the configured server; never in DMs.
  if (interaction.guildId !== config.guildId) {
    if (interaction.isRepliable()) await interaction.reply(privately({ content: "Use me in the server." })).catch(() => {});
    return;
  }

  try {
    if (interaction.isAutocomplete()) {
      const command = byName.get(interaction.commandName);
      if (command?.autocomplete && allowed(command, interaction)) await command.autocomplete(interaction);
      else await interaction.respond([]);
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = byName.get(interaction.commandName);
      if (!command) return;
      if (!allowed(command, interaction)) return denied(interaction, command.admin ? "server admins" : "staff");
      return await command.execute(interaction);
    }

    // Buttons and forms carry "command:handler" in their ID.
    if (interaction.isButton() || interaction.isModalSubmit()) {
      const [name, handlerName] = interaction.customId.split(":");
      const command = byName.get(name);
      const handler = (interaction.isButton() ? command?.buttons : command?.modals)?.[handlerName];
      if (!handler) return;
      if (!command.publicButtons && !allowed(command, interaction)) return denied(interaction, command.admin ? "server admins" : "staff");
      return await handler(interaction);
    }
  } catch (error) {
    if (interaction.isRepliable()) await report(interaction, error);
    else console.error(error);
  }
});

client.once(Events.ClientReady, async (ready) => {
  startRobuxSales();
  startRobuxInvoices();
  // Messages staff write on the website's Discord manager.
  startDiscordManager(ready);
  console.log(`Online as ${ready.user.tag}`);
  ready.user.setPresence({ activities: [{ name: "/help · /redeem", type: ActivityType.Watching }], status: "online" });

  const guild = await ready.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) console.warn("The bot isn't in the server set as DISCORD_GUILD_ID. Invite it with the link in the README.");
  const current = await refreshSettings().catch((e) => {
    console.warn(`Couldn't load /setup settings: ${e?.message ?? e}`);
    return null;
  });
  if (current && !current.buyerRoleId) console.warn("No buyer role yet. An admin can set one with /setup buyer-role.");

  const sync = async () => {
    try {
      await refreshSettings();
      // The website's staff panel trusts this list, so it runs first.
      await syncStaff(ready).catch((e) => console.warn(`Staff sync failed: ${e?.message ?? e}`));
      const added = await syncBuyerRoles(ready);
      if (added) console.log(`Gave the buyer role to ${added} member${added === 1 ? "" : "s"}.`);
    } catch (e) {
      console.warn(`Role sync failed: ${e?.message ?? e}`);
    }
  };
  setTimeout(sync, 15_000);
  setInterval(sync, ROLE_SYNC_EVERY);
  const verifyRoles = async () => {
    try { await refreshSettings(); await syncVerifiedRoles(ready); }
    catch (error) { console.warn(`Verification role sync failed: ${error.message}`); }
  };
  setTimeout(verifyRoles, 3000);
  setInterval(verifyRoles, 3000);

  // Sales, sign-ups and website actions, posted to the log channels.
  const feed = () => postFeed(ready).catch((e) => console.warn(`Log feed failed: ${e?.message ?? e}`));
  setTimeout(feed, 20_000);
  setInterval(feed, 60_000);
});

process.on("unhandledRejection", (e) => console.error("Unhandled:", e));

client.login(config.token).catch((e) => {
  console.error(`Couldn't sign in to Discord: ${e.message}\nCheck DISCORD_TOKEN in .env.`);
  process.exit(1);
});
