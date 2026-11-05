import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { rpc, UserError } from "../db.js";
import { base, COLORS, privately, when } from "../ui.js";

const STATE = { ingame: "In game", loading: "Loading", disconnected: "Disconnected", offline: "Not running" };
const ACTION = {
  launch: "Launch",
  rejoin: "Rejoin",
  close: "Close",
  rejoin_disconnected: "Rejoin disconnected",
  load_config: "Load config",
  launch_config: "Launch config",
  reset_settings: "Reset settings",
};

const uptime = (ms) => {
  if (!ms) return "";
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

/**
 * The private status card: every account in ShiftAM on the person's own PC,
 * their configs and games, and what they can do. Built from their verified
 * Discord only, so it never shows anyone else's accounts.
 */
function view(v, note) {
  const clients = v.clients ?? [];
  const running = clients.filter((c) => c.state !== "offline");
  const configs = v.configs ?? [];
  const games = v.games ?? [];
  const down = clients.filter((c) => c.state === "disconnected").length;
  const inGame = clients.filter((c) => c.state === "ingame").length;
  const color = !v.connected ? COLORS.muted : down ? COLORS.warn : COLORS.ok;
  const head = v.connected
    ? `**Connected**${v.pcName ? ` · ${v.pcName}` : ""} · checked in ${when(v.updatedAt)}`
    : v.updatedAt
      ? `**ShiftAM is not open** · last seen ${when(v.updatedAt)}`
      : "**ShiftAM is not open.** Open it on your PC and sign in; your accounts show up here by themselves.";
  // Numbered in the app's order so the Launch / Rejoin / Close forms can use the number.
  const lines = clients.slice(0, 25).map((c, i) => {
    const bits = [STATE[c.state] ?? "Running", c.state === "offline" ? null : c.game, uptime(c.startedAt), c.ramMb ? `${Math.round(c.ramMb)} MB` : null].filter(Boolean).join(" · ");
    return `\`${String(i + 1).padStart(2)}\` **${c.username}** · ${bits}`;
  });
  if (clients.length > 25) lines.push(`…and ${clients.length - 25} more on shiftam.xyz/account`);
  const embed = base("Your ShiftAM accounts", color)
    .setDescription([note, head, "", lines.length ? lines.join("\n") : v.connected ? "No accounts in ShiftAM yet." : ""].filter((x) => x !== undefined && x !== null).join("\n").slice(0, 4000))
    .addFields(
      { name: "Running", value: `${running.length} of ${clients.length}`, inline: true },
      { name: "In game", value: String(inGame), inline: true },
      { name: "Disconnected", value: String(down), inline: true },
    );
  if (configs.length) {
    embed.addFields({
      name: "Configs",
      value: configs.slice(0, 10).map((c, i) => `\`${i + 1}\` **${c.name}** · ${c.accounts} account${c.accounts === 1 ? "" : "s"}${c.game ? ` · ${c.game}` : ""}`).join("\n").slice(0, 1000),
    });
  }
  if (games.length) {
    embed.addFields({ name: "Games", value: games.slice(0, 10).map((g, i) => `\`${i + 1}\` ${g.name}`).join("\n").slice(0, 1000) });
  }
  const recent = (v.commands ?? []).slice(0, 3);
  if (recent.length) {
    embed.addFields({
      name: "Recent actions",
      value: recent.map((c) => `${c.state === "done" ? "Done" : c.state === "running" ? "Running" : "Queued"}: ${ACTION[c.action] ?? c.action}${c.target ? ` · ${c.target}` : ""}${c.result ? ` — ${c.result}` : ""}`).join("\n").slice(0, 1000),
    });
  }
  const off = !v.connected;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("remote:refresh").setLabel("Refresh").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("remote:asklaunch").setLabel("Launch…").setStyle(ButtonStyle.Success).setDisabled(off || running.length === clients.length || !games.length),
    new ButtonBuilder().setCustomId("remote:rejoinall").setLabel("Rejoin disconnected").setStyle(ButtonStyle.Primary).setDisabled(off || down === 0),
    new ButtonBuilder().setCustomId("remote:askrejoin").setLabel("Rejoin…").setStyle(ButtonStyle.Secondary).setDisabled(off || !running.length),
    new ButtonBuilder().setCustomId("remote:askclose").setLabel("Close…").setStyle(ButtonStyle.Danger).setDisabled(off || !running.length),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("remote:askload").setLabel("Load config…").setStyle(ButtonStyle.Secondary).setDisabled(off || !configs.length),
    new ButtonBuilder().setCustomId("remote:asklaunchcfg").setLabel("Launch config…").setStyle(ButtonStyle.Success).setDisabled(off || !configs.length),
    new ButtonBuilder().setCustomId("remote:reset").setLabel("Reset settings").setStyle(ButtonStyle.Secondary).setDisabled(off),
  );
  return privately({ embeds: [embed], components: [row, row2] });
}

const load = (interaction) => rpc("bot_remote_view", { p_discord_id: interaction.user.id });

/** Finds an item by its number in the list or its exact name. */
function pickFrom(items, text, nameOf, what) {
  const q = String(text ?? "").trim().replace(/^@/, "");
  const n = Number(q);
  const found = Number.isInteger(n) && n >= 1 && n <= items.length ? items[n - 1] : items.find((x) => nameOf(x).toLowerCase() === q.toLowerCase());
  if (!found) throw new UserError(`No ${what} matches "${q}". Use its number from the list or its exact name.`);
  return found;
}
const pick = (clients, text) => pickFrom(clients, text, (c) => c.username, "account");
const gameFrom = (v, text) => pickFrom(v.games ?? [], text, (g) => g.name, "game").placeId;
const configFrom = (v, text) => pickFrom(v.configs ?? [], text, (c) => c.name, "config");

const field = (id, label, required = true) =>
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(required).setMaxLength(60));

const MODALS = {
  rejoin: ["Rejoin an account", () => [field("who", "Account number from the list, or username")]],
  close: ["Close an account", () => [field("who", "Account number from the list, or username")]],
  launch: ["Launch an account", () => [field("who", "Account number from the list, or username"), field("game", "Game number from the list, or its name")]],
  load: ["Load a config", () => [field("cfg", "Config number from the list, or its name")]],
  launchcfg: ["Launch a config", () => [field("cfg", "Config number from the list, or its name"), field("game", "Game number (empty uses the config's game)", false)]],
};

function askModal(kind) {
  const [title, rows] = MODALS[kind];
  return new ModalBuilder().setCustomId(`remote:${kind}`).setTitle(title).addComponents(...rows());
}

async function act(interaction, action, target, place = null) {
  const v = await rpc("bot_remote_command", { p_discord_id: interaction.user.id, p_action: action, p_target: target, p_place: place });
  return view(v, `Sent: **${ACTION[action]}**. Your PC picks it up within about 20 seconds.`);
}

export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("remote").setDescription("See your ShiftAM accounts and launch, rejoin or close them from anywhere"),

  async execute(interaction) {
    await interaction.reply(view(await load(interaction)));
  },

  buttons: {
    async refresh(interaction) {
      await interaction.update(view(await load(interaction)));
    },
    async rejoinall(interaction) {
      await interaction.update(await act(interaction, "rejoin_disconnected", null));
    },
    async reset(interaction) {
      await interaction.update(await act(interaction, "reset_settings", null));
    },
    askrejoin: (interaction) => interaction.showModal(askModal("rejoin")),
    askclose: (interaction) => interaction.showModal(askModal("close")),
    asklaunch: (interaction) => interaction.showModal(askModal("launch")),
    askload: (interaction) => interaction.showModal(askModal("load")),
    asklaunchcfg: (interaction) => interaction.showModal(askModal("launchcfg")),
  },

  modals: {
    async rejoin(interaction) {
      const c = pick((await load(interaction)).clients ?? [], interaction.fields.getTextInputValue("who"));
      await interaction.reply(await act(interaction, "rejoin", c.id));
    },
    async close(interaction) {
      const c = pick((await load(interaction)).clients ?? [], interaction.fields.getTextInputValue("who"));
      await interaction.reply(await act(interaction, "close", c.id));
    },
    async launch(interaction) {
      const v = await load(interaction);
      const c = pick(v.clients ?? [], interaction.fields.getTextInputValue("who"));
      if (c.state !== "offline") throw new UserError(`${c.username} is already running. Use Rejoin instead.`);
      await interaction.reply(await act(interaction, "launch", c.id, gameFrom(v, interaction.fields.getTextInputValue("game"))));
    },
    async load(interaction) {
      const c = configFrom(await load(interaction), interaction.fields.getTextInputValue("cfg"));
      await interaction.reply(await act(interaction, "load_config", c.id));
    },
    async launchcfg(interaction) {
      const v = await load(interaction);
      const c = configFrom(v, interaction.fields.getTextInputValue("cfg"));
      const game = interaction.fields.getTextInputValue("game").trim();
      await interaction.reply(await act(interaction, "launch_config", c.id, game ? gameFrom(v, game) : null));
    },
  },
};
