import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { rpc, UserError } from "../db.js";
import { base, COLORS, privately, when } from "../ui.js";

const STATE = { ingame: "In game", loading: "Loading", disconnected: "Disconnected" };
const ACTION = { rejoin: "Rejoin", close: "Close", rejoin_disconnected: "Rejoin disconnected" };

const uptime = (ms) => {
  if (!ms) return "";
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

/**
 * The private status card: every client on the person's own PC and what
 * they can do. Built from their verified Discord only, so it never shows
 * anyone else's accounts.
 */
function view(v, note) {
  const clients = v.clients ?? [];
  const down = clients.filter((c) => c.state === "disconnected").length;
  const inGame = clients.filter((c) => c.state === "ingame").length;
  const color = !v.connected ? COLORS.muted : down ? COLORS.warn : COLORS.ok;
  const head = v.connected
    ? `**Connected**${v.pcName ? ` · ${v.pcName}` : ""} · checked in ${when(v.updatedAt)}`
    : v.updatedAt
      ? `**ShiftAM is offline** · last seen ${when(v.updatedAt)}`
      : "**Not set up yet.** Turn on **Settings → Remote** in the ShiftAM app on your PC.";
  const lines = clients.slice(0, 25).map((c, i) => {
    const bits = [STATE[c.state] ?? "Running", c.game, uptime(c.startedAt), c.ramMb ? `${Math.round(c.ramMb)} MB` : null].filter(Boolean).join(" · ");
    return `\`${String(i + 1).padStart(2)}\` **${c.username}** · ${bits}`;
  });
  if (clients.length > 25) lines.push(`…and ${clients.length - 25} more on shiftam.xyz/remote`);
  const embed = base("Your Roblox clients", color)
    .setDescription([note, head, "", lines.length ? lines.join("\n") : v.connected ? "No Roblox clients running right now." : ""].filter((x) => x !== undefined && x !== null).join("\n"))
    .addFields({ name: "Running", value: String(clients.length), inline: true }, { name: "In game", value: String(inGame), inline: true }, { name: "Disconnected", value: String(down), inline: true });
  const recent = (v.commands ?? []).slice(0, 3);
  if (recent.length) {
    embed.addFields({
      name: "Recent actions",
      value: recent.map((c) => `${c.state === "done" ? "Done" : c.state === "running" ? "Running" : "Queued"}: ${ACTION[c.action] ?? c.action}${c.target ? ` · ${c.target}` : ""}${c.result ? ` — ${c.result}` : ""}`).join("\n").slice(0, 1000),
    });
  }
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("remote:refresh").setLabel("Refresh").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("remote:rejoinall").setLabel("Rejoin disconnected").setStyle(ButtonStyle.Primary).setDisabled(!v.connected || down === 0),
    new ButtonBuilder().setCustomId("remote:askrejoin").setLabel("Rejoin one…").setStyle(ButtonStyle.Secondary).setDisabled(!v.connected || !clients.length),
    new ButtonBuilder().setCustomId("remote:askclose").setLabel("Close one…").setStyle(ButtonStyle.Danger).setDisabled(!v.connected || !clients.length),
  );
  return privately({ embeds: [embed], components: [row] });
}

const load = (interaction) => rpc("bot_remote_view", { p_discord_id: interaction.user.id });

/** Finds a client by its number in the list or its username. */
function pick(clients, text) {
  const q = String(text ?? "").trim().replace(/^@/, "");
  const n = Number(q);
  const found = Number.isInteger(n) && n >= 1 && n <= clients.length ? clients[n - 1] : clients.find((c) => c.username.toLowerCase() === q.toLowerCase());
  if (!found) throw new UserError(`No running account matches "${q}". Use its number from the list or its exact username.`);
  return found;
}

function askModal(kind) {
  return new ModalBuilder()
    .setCustomId(`remote:${kind}`)
    .setTitle(kind === "rejoin" ? "Rejoin an account" : "Close an account")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("who").setLabel("Number from the list, or the username").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40),
      ),
    );
}

async function act(interaction, action, target) {
  const v = await rpc("bot_remote_command", { p_discord_id: interaction.user.id, p_action: action, p_target: target });
  return view(v, `Sent: **${ACTION[action]}**. Your PC picks it up within about 20 seconds.`);
}

export default {
  category: "Account",
  data: new SlashCommandBuilder().setName("remote").setDescription("Check your Roblox clients on your PC and rejoin or close them"),

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
    askrejoin: (interaction) => interaction.showModal(askModal("rejoin")),
    askclose: (interaction) => interaction.showModal(askModal("close")),
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
  },
};
