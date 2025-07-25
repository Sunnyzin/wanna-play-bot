require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, Events } = require('discord.js');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const cooldowns = new Map();

client.on('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || message.channel.id !== config.channelId) return;

  const userId = message.author.id;

  if (cooldowns.has(userId)) {
    const elapsed = (Date.now() - cooldowns.get(userId)) / 1000;
    if (elapsed < config.cooldownSeconds) {
      return message.reply(`⏳ Please wait ${Math.ceil(config.cooldownSeconds - elapsed)}s before sending another request.`);
    }
  }

  cooldowns.set(userId, Date.now());

  const questionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`voice_yes_${userId}`)
      .setLabel('Yes')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`voice_no_${userId}`)
      .setLabel('No')
      .setStyle(ButtonStyle.Danger)
  );

  const prompt = await message.reply({
    content: `🎮 Do you want to play in voice call?`,
    components: [questionRow]
  });

  setTimeout(() => {
    prompt.edit({ components: [] }).catch(() => {});
  }, 15000);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const [action, response, userId] = interaction.customId.split('_');
  const user = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!user || interaction.user.id !== userId) {
    return interaction.reply({ content: "❌ You can't answer this interaction.", ephemeral: true });
  }

  const msgContent = await interaction.channel.messages.fetch({ limit: 5 }).then(msgs =>
    msgs.find(m => m.author.id === userId && !m.author.bot)
  );

  if (!msgContent) {
    return interaction.reply({ content: "❌ Original message not found.", ephemeral: true });
  }

  const wantsVC = response === 'yes';
  const mentionRoles = wantsVC
    ? `<@&${config.wannaPlayRoleId}> <@&${config.voiceCallRoleId}>`
    : `<@&${config.wannaPlayRoleId}>`;

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setAuthor({ name: `${user.user.username} wants to play!`, iconURL: user.user.displayAvatarURL() })
    .addFields(
      { name: '💬 Message', value: msgContent.content },
      { name: '🎧 Voice Call', value: wantsVC ? 'Yes' : 'No' }
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`join_${userId}`)
      .setLabel('🎮 I want to play')
      .setStyle(ButtonStyle.Primary)
  );

  await msgContent.delete().catch(() => {});
  await interaction.message.delete().catch(() => {});
  await interaction.channel.send({ content: mentionRoles, embeds: [embed], components: [row] });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('join_')) {
    const requesterId = interaction.customId.split('_')[1];
    const requester = await interaction.guild.members.fetch(requesterId).catch(() => null);
    if (!requester) return;

    await interaction.reply({
      embeds: [{
        color: 0x00ff00,
        description: `🎮 ${interaction.user} wants to play with ${requester}!`
      }]
    });

    requester.send(`🔔 ${interaction.user} clicked "I want to play"!`).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);