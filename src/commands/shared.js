import { loadPlans } from "../db.js";
import { lengthLabel } from "../ui.js";

/** Staff commands can point at a Discord user or an account username. */
export function addTarget(builder) {
  return builder
    .addUserOption((o) => o.setName("user").setDescription("The Discord user whose account it is"))
    .addStringOption((o) => o.setName("username").setDescription("Or the account's username").setMaxLength(20));
}

/** The target as database arguments, plus a label for messages. */
export function target(interaction) {
  const user = interaction.options.getUser("user");
  const username = interaction.options.getString("username");
  return {
    args: { p_discord_id: user?.id ?? null, p_username: user ? null : username },
    label: user ? `<@${user.id}>` : `**${username ?? "?"}**`,
    user,
  };
}

/** Suggests plans as staff type, from the plans table. */
export async function planAutocomplete(interaction) {
  const typed = interaction.options.getFocused().toLowerCase();
  const plans = await loadPlans().catch(() => []);
  await interaction.respond(
    plans
      .filter((p) => !typed || p.id.includes(typed) || p.name.toLowerCase().includes(typed))
      .slice(0, 25)
      .map((p) => ({ name: `${lengthLabel(p.duration_days)} · $${Number(p.price_usd).toFixed(2)}`, value: p.id })),
  );
}
