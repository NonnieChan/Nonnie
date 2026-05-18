const express = require('express');
const path = require('path');

const {
	Client,
	GatewayIntentBits,
	ActivityType,
	SlashCommandBuilder,
	REST,
	Routes
} = require('discord.js');

const {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
	StreamType
} = require('@discordjs/voice');

const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
	console.log(`Web server running on port ${PORT}`);
});

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates
	]
});

const player = createAudioPlayer();

client.once('ready', async () => {

	console.log(`${client.user.tag} is online!`);

	client.user.setPresence({
		activities: [
			{
				name: 'Project Zomboid 🖤',
				type: ActivityType.Playing
			}
		],
		status: 'idle'
	});

	const commands = [
		new SlashCommandBuilder()
			.setName('play')
			.setDescription('Play music from YouTube')
			.addStringOption(option =>
				option
					.setName('url')
					.setDescription('YouTube URL')
					.setRequired(true)
			),

		new SlashCommandBuilder()
			.setName('stop')
			.setDescription('Stop music')
	].map(cmd => cmd.toJSON());

	const rest = new REST({ version: '10' })
		.setToken(process.env.TOKEN);

	try {
		console.log('Registering slash commands...');

		await rest.put(
			Routes.applicationCommands(client.user.id),
			{ body: commands }
		);

		console.log('Slash commands registered!');
	} catch (error) {
		console.error(error);
	}
});

client.on('interactionCreate', async interaction => {

	if (!interaction.isChatInputCommand()) return;

	// 🎵 PLAY
	if (interaction.commandName === 'play') {

		const url = interaction.options.getString('url');
		const voiceChannel = interaction.member.voice.channel;

		if (!voiceChannel) {
			return interaction.reply('Join a voice channel first 👀');
		}

		try {

			const connection = joinVoiceChannel({
				channelId: voiceChannel.id,
				guildId: voiceChannel.guild.id,
				adapterCreator: voiceChannel.guild.voiceAdapterCreator
			});

			// 🔥 FIX AUDIO STREAM
			const stream = ytdl(url, {
				filter: 'audioonly',
				quality: 'highestaudio',
				highWaterMark: 1 << 25
			});

			const resource = createAudioResource(stream, {
				inputType: StreamType.Arbitrary
			});

			player.play(resource);
			connection.subscribe(player);

			// 🔥 กันหลุด + auto cleanup
			player.once(AudioPlayerStatus.Idle, () => {
				connection.destroy();
			});

			player.on('error', err => {
				console.log('Player error:', err);
			});

			await interaction.reply('🎵 Now playing');

		} catch (err) {
			console.error('Play error:', err);
			await interaction.reply('❌ เล่นเพลงไม่ได้ (ลิงก์หรือ YouTube block)');
		}
	}

	// 🛑 STOP
	if (interaction.commandName === 'stop') {

		player.stop();
		await interaction.reply('🛑 Stopped');
	}
});

client.login(process.env.TOKEN);
