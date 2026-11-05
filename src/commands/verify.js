import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { base, COLORS, privately, success } from '../ui.js';
import { checkVerification, rememberVerification } from '../verification.js';

export function verificationPanel() {
  return {
    embeds: [base('✅ Verification required').setDescription('Verify your Discord account to access the server.\n\nClick **Verify now!** below and complete the official Discord authorization. If you already verified your linked ShiftAM account, your role is added automatically.')],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify:check').setLabel('Verify now!').setStyle(ButtonStyle.Success))],
    allowedMentions: { parse: [] },
  };
}

async function verify(interaction) {
  await interaction.deferReply({ flags: 64 });
  if (await checkVerification(interaction.guild, interaction.user.id)) {
    return interaction.editReply(privately({ embeds: [success('✅ Verification successful', 'Your Discord account is verified and your verified role is ready.')], components: [] }));
  }
  const website = config.websiteUrl || 'https://shiftam.xyz';
  const url = new URL('/auth/discord/guild-start', website);
  url.searchParams.set('guild', interaction.guild.id);
  await interaction.editReply(privately({
    embeds: [base('Authorize with Discord', COLORS.brand).setDescription('Use the button below to complete official Discord authorization. A purchase or ShiftAM account is not required.\n\nReturn here afterward; the bot checks every 3 seconds and adds your role automatically. Press **Check verification** to check immediately.')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Authorize with Discord').setURL(url.toString()),
      new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('Check verification').setCustomId('verify:check'),
    )],
  }));
  rememberVerification(interaction);
}
export default {
  category: 'Account',
  data: new SlashCommandBuilder().setName('verify').setDescription('Verify Discord and receive the server verified role'),
  execute: verify,
  buttons: { check: verify },
};
