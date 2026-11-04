import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import { isStaff } from "./access.js";
import { byName } from "./commands/index.js";
import { config } from "./config.js";
import { UserError } from "./db.js";
import { syncBuyerRoles } from "./roles.js";
import { failure, privately } from "./ui.js";

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

const denied = (interaction) => interaction.reply(privately({ embeds: [failure("That's for staff only.")] }));

client.on(Events.InteractionCreate, async (interaction) => {
  // Only the configured server; never in DMs.
  if (interaction.guildId !== config.guildId) {
    if (interaction.isRepliable()) await interaction.reply(privately({ content: "Use me in the server." })).catch(() => {});
    return;
  }

  try {
    if (interaction.isAutocomplete()) {
      const command = byName.get(interaction.commandName);
      if (command?.autocomplete && (!command.staff || isStaff(interaction))) await command.autocomplete(interaction);
      else await interaction.respond([]);
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = byName.get(interaction.commandName);
      if (!command) return;
      if (command.staff && !isStaff(interaction)) return denied(interaction);
      return await command.execute(interaction);
    }

    // Buttons and forms carry "command:handler" in their ID.
    if (interaction.isButton() || interaction.isModalSubmit()) {
      const [name, handlerName] = interaction.customId.split(":");
      const command = byName.get(name);
      const handler = (interaction.isButton() ? command?.buttons : command?.modals)?.[handlerName];
      if (!handler) return;
      if (command.staff && !command.publicButtons && !isStaff(interaction)) return denied(interaction);
      return await handler(interaction);
    }
  } catch (error) {
    if (interaction.isRepliable()) await report(interaction, error);
    else console.error(error);
  }
});

client.once(Events.ClientReady, async (ready) => {
  console.log(`Online as ${ready.user.tag}`);
  ready.user.setPresence({ activities: [{ name: "/help · /redeem", type: ActivityType.Watching }], status: "online" });

  const guild = await ready.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) console.warn("⚠️ The bot isn't in the server set as DISCORD_GUILD_ID. Invite it with the link in the README.");
  if (!config.buyerRoleId) console.warn("ℹ️ BUYER_ROLE_ID isn't set, so no one gets the buyer role.");

  const sync = async () => {
    try {
      const added = await syncBuyerRoles(ready);
      if (added) console.log(`Gave the buyer role to ${added} member${added === 1 ? "" : "s"}.`);
    } catch (e) {
      console.warn(`Role sync failed: ${e?.message ?? e}`);
    }
  };
  setTimeout(sync, 15_000);
  setInterval(sync, ROLE_SYNC_EVERY);
});

process.on("unhandledRejection", (e) => console.error("Unhandled:", e));

client.login(config.token).catch((e) => {
  console.error(`Couldn't sign in to Discord: ${e.message}\nCheck DISCORD_TOKEN in .env.`);
  process.exit(1);
});
