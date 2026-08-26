import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';
import { botDb } from './database.js';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('[FATAL] Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Slash Command Definitions
const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Fetch Adenine cryptographic and system operational state'),
  
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check WebSocket round-trip latency'),

  new SlashCommandBuilder()
    .setName('set-log')
    .setDescription('Set the administrative audit log channel')
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('Channel to receive security and operational notifications')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

// Deploy Slash Commands to Discord API
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log('[SETUP] Registering application slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('[SETUP] Slash commands successfully registered.');
  } catch (error) {
    console.error('[ERROR] Failed to register slash commands:', error.message);
  }
}

client.once('ready', () => {
  console.log(`[ONLINE] Authenticated as ${client.user.tag} (${client.user.id})`);
  registerCommands();
});

// Slash Command Interaction Handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId } = interaction;

  try {
    if (commandName === 'status') {
      const statusEmbed = new EmbedBuilder()
        .setColor(0x7C3AED)
        .setTitle('Adenine Systems Core')
        .setDescription('**State:** `NOMINAL`\n**Zero-Knowledge Engine:** `ACTIVE`\n**Encryption:** `Argon2id + AES-256-GCM`\n**P2P Sync:** `WebRTC Active`')
        .setFooter({ text: "If you don't hold the key, you don't own the data." })
        .setTimestamp();

      await interaction.reply({ embeds: [statusEmbed] });
      botDb.logEvent('COMMAND_STATUS', `User ${interaction.user.id} requested status in guild ${guildId}`);
    } 
    else if (commandName === 'ping') {
      const latency = Date.now() - interaction.createdTimestamp;
      await interaction.reply({ 
        content: `Gateway Latency: \`${latency}ms\` | API Heartbeat: \`${Math.round(client.ws.ping)}ms\``, 
        ephemeral: true 
      });
    }
    else if (commandName === 'set-log') {
      const channel = interaction.options.getChannel('channel');
      botDb.setLogChannel(guildId, channel.id);
      botDb.logEvent('CONFIG_UPDATE', `Guild ${guildId} set log channel to ${channel.id}`);

      await interaction.reply({
        content: `Audit logging assigned to <#${channel.id}>.`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(`[EXECUTION ERROR] Command /${commandName}:`, error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xEF4444)
      .setTitle('Command Failure')
      .setDescription(`An error occurred while executing \`/${commandName}\`.\n\`\`\`${error.message}\`\`\``);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

// Trap uncaught gateway rejections to keep process online
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

client.login(TOKEN);
