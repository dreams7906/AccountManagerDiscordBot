import "dotenv/config";

/** A setting from .env; throws a clear message when a required one is missing. */
function read(name, required = true) {
  const value = process.env[name]?.trim() ?? "";
  if (required && !value) throw new Error(`${name} is missing. Copy .env.example to .env and fill it in.`);
  return value;
}

const list = (name) => read(name, false).split(",").map((s) => s.trim()).filter(Boolean);

/** Settings are read when first used, so `npm run check` works without a .env. */
export const config = {
  get token() { return read("DISCORD_TOKEN"); },
  get clientId() { return read("DISCORD_CLIENT_ID"); },
  get guildId() { return read("DISCORD_GUILD_ID"); },
  get supabaseUrl() { return read("SUPABASE_URL"); },
  get supabaseKey() { return read("SUPABASE_SECRET_KEY"); },
  /** Given to everyone with an account that has time; never taken away. */
  get buyerRoleId() { return read("BUYER_ROLE_ID", false); },
  /** Roles allowed to use staff commands, besides anyone with Administrator. */
  get staffRoleIds() { return list("STAFF_ROLE_IDS"); },
  get logChannelId() { return read("LOG_CHANNEL_ID", false); },
  get websiteUrl() { return read("WEBSITE_URL", false).replace(/\/$/, ""); },
  get downloadUrl() { return read("DOWNLOAD_URL", false); },
  get brand() { return read("BRAND_NAME", false) || "Custom Account Manager"; },
};
