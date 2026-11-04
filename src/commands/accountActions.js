import { SlashCommandBuilder } from "discord.js";
import { rpc, UserError } from "../db.js";
import { log } from "../log.js";
import { giveBuyerRole } from "../roles.js";
import { accountEmbed, COLORS, privately, timeLine } from "../ui.js";
import { addTarget, target } from "./shared.js";

/**
 * Staff commands that change one account. Each picks the account by Discord
 * user or username, runs one action and logs it.
 */
function accountCommand({ name, description, extra = (b) => b, action, done, color = COLORS.brand, after }) {
  return {
    category: "Staff",
    staff: true,
    data: extra(addTarget(new SlashCommandBuilder().setName(name).setDescription(`${description} (staff)`))),
    async execute(interaction) {
      const t = target(interaction);
      const { act, days = 0, reason = "" } = action(interaction);
      await interaction.deferReply({ flags: 64 });
      const account = await rpc("bot_account_action", { ...t.args, p_action: act, p_days: days, p_reason: reason });
      if (after) await after(interaction, account);
      const text = done(account, { days, reason });
      await interaction.editReply(privately({ content: `${text}`, embeds: [accountEmbed(account, { staff: true })], allowedMentions: { parse: [] } }));
      await log(interaction.client, { title: `/${name}`, description: text, color, by: interaction.user });
    },
  };
}

const giveRoleIfActive = async (interaction, account) => {
  if (account.active && account.discordId) await giveBuyerRole(interaction.guild, account.discordId);
};

export const addtime = accountCommand({
  name: "addtime",
  description: "Add days to an account, or make it lifetime",
  extra: (b) =>
    b
      .addIntegerOption((o) => o.setName("days").setDescription("Days to add (1–3650)").setMinValue(1).setMaxValue(3650))
      .addBooleanOption((o) => o.setName("lifetime").setDescription("Make it lifetime instead")),
  action: (i) => {
    if (i.options.getBoolean("lifetime")) return { act: "lifetime" };
    const days = i.options.getInteger("days");
    if (!days) throw new UserError("Give a number of days, or set lifetime to True.");
    return { act: "add_days", days };
  },
  done: (a, { days }) => `**${a.username}**: ${days ? `added ${days} day${days === 1 ? "" : "s"}` : "now lifetime"}. ${timeLine(a)}`,
  color: COLORS.ok,
  after: giveRoleIfActive,
});

export const removetime = accountCommand({
  name: "removetime",
  description: "Take all time off an account",
  action: () => ({ act: "remove_time" }),
  done: (a) => `**${a.username}** has no time left now.`,
  color: COLORS.warn,
});

export const forcereset = accountCommand({
  name: "forcereset",
  description: "Unlock an account from its PC, ignoring the once-a-day limit",
  action: () => ({ act: "unlock_pc" }),
  done: (a) => `**${a.username}** is unlocked from its PC.`,
  color: COLORS.warn,
});

export const ban = accountCommand({
  name: "ban",
  description: "Ban an account: it can't sign in anywhere",
  extra: (b) => b.addStringOption((o) => o.setName("reason").setDescription("Shown to them when they try to sign in").setMaxLength(200)),
  action: (i) => ({ act: "ban", reason: i.options.getString("reason") ?? "" }),
  done: (a, { reason }) => `**${a.username}** is banned${reason ? `: ${reason}` : "."}`,
  color: COLORS.err,
});

export const unban = accountCommand({
  name: "unban",
  description: "Lift a ban",
  action: () => ({ act: "unban" }),
  done: (a) => `**${a.username}** is unbanned.`,
  color: COLORS.ok,
});
