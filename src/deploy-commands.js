// Registers the slash commands in your server. Run it once, and again after
// adding or changing commands: npm run deploy
import { InteractionContextType, REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";
import { config } from "./config.js";

const body = commands.map((c) => ({ ...c.data.toJSON(), contexts: [InteractionContextType.Guild] }));
const rest = new REST().setToken(config.token);

try {
  const saved = await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
  console.log(`✅ Registered ${saved.length} commands in your server:`);
  console.log(saved.map((c) => `/${c.name}`).join("  "));
} catch (e) {
  console.error(`❌ Couldn't register the commands: ${e.message}`);
  console.error("Check DISCORD_TOKEN, DISCORD_CLIENT_ID and DISCORD_GUILD_ID in .env, and that the bot is in the server.");
  process.exit(1);
}
