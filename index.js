const express = require('express');
const path = require('path');
const yts = require('yt-search');
const ytdl = require('ytdl-core');

const {
	Client,
	GatewayIntentBits,
	ActivityType,
	SlashCommandBuilder,
	REST,
	Routes,
	EmbedBuilder
} = require('discord.js');

const {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
	StreamType,
	VoiceConnectionStatus
} = require('@discordjs/voice');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

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

// 🎧 SYSTEM
const queue = new Map();
const loop = new Map();
const volume = new Map();
const nowPlaying = new Map();

// 🔥 PLAY ENGINE (STABLE)
function playSong(guildId, connection) {

	const serverQueue = queue.get(guildId);
	if (!serverQueue || serverQueue.songs.length === 0) {
		connection.destroy();
		queue.delete(guildId);
		return;
	}

	const song = serverQueue.songs[0];
	nowPlaying.set(guildId, song);

	const stream = ytdl(song.url, {
		filter: 'audioonly',
		highWaterMark: 1 << 25
	});

	let resource = createAudioResource(stream, {
		inputType: StreamType.Arbitrary
	});

	player.play(resource);
	connection.subscribe(player);

	player.once(AudioPlayerStatus.Idle, () => {

		const isLoop = loop.get(guildId);

		if (!isLoop) serverQueue.songs.shift();

		playSong(guildId, connection);
	});

	player.on('error', err => {
		console.log('Player error:', err);
	});
}

client.once('ready', async () => {

	console.log(`${client.user.tag} is online!`);

	client.user.setPresence({
		activities: [{ name: 'PRO Music 🎵', type: ActivityType.Playing }],
		status: 'online'
	});

	const commands = [

		new SlashCommandBuilder()
			.setName('play')
			.setDescription('Play music (url or search)')
			.addStringOption(o =>
				o.setName('query').setRequired(true)
			),

		new SlashCommandBuilder().setName('skip').setDescription('Skip song'),
		new SlashCommandBuilder().setName('stop').setDescription('Stop music'),
		new SlashCommandBuilder().setName('pause').setDescription('Pause'),
		new SlashCommandBuilder().setName('resume').setDescription('Resume'),
		new SlashCommandBuilder().setName('queue').setDescription('Show queue'),
		new SlashCommandBuilder().setName('nowplaying').setDescription('Now playing'),

		new SlashCommandBuilder()
			.setName('loop')
			.setDescription('Toggle loop'),

		new SlashCommandBuilder()
			.setName('volume')
			.setDescription('Set volume')
			.addIntegerOption(o =>
				o.setName('value').setRequired(true)
			),

		new SlashCommandBuilder()
			.setName('search')
			.setDescription('Search YouTube')
			.addStringOption(o =>
				o.setName('query').setRequired(true)
			)

	].map(c => c.toJSON());

	const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

	await rest.put(
		Routes.applicationCommands(client.user.id),
		{ body: commands }
	);

	console.log('Slash commands ready!');
});

client.on('interactionCreate', async interaction => {

	if (!interaction.isChatInputCommand()) return;

	const guildId = interaction.guild.id;

	let serverQueue = queue.get(guildId);

	// 🎵 PLAY
	if (interaction.commandName === 'play') {

		const query = interaction.options.getString('query');
		const voiceChannel = interaction.member.voice.channel;

		if (!voiceChannel)
			return interaction.reply('Join a voice channel first 👀');

		let url = query;

		if (!ytdl.validateURL(query)) {

			const result = await yts(query);
			const video = result.videos[0];

			if (!video)
				return interaction.reply('No results');

			url = video.url;
		}

		if (!serverQueue) {

			const connection = joinVoiceChannel({
				channelId: voiceChannel.id,
				guildId: voiceChannel.guild.id,
				adapterCreator: voiceChannel.guild.voiceAdapterCreator
			});

			// 🔥 auto reconnect
			connection.on(VoiceConnectionStatus.Disconnected, () => {
				try {
					connection.rejoin();
				} catch {
					connection.destroy();
				}
			});

			serverQueue = { connection, songs: [] };
			queue.set(guildId, serverQueue);
		}

		serverQueue.songs.push({ url });

		await interaction.reply('🎵 Added to queue');

		if (serverQueue.songs.length === 1) {
			playSong(guildId, serverQueue.connection);
		}
	}

	// ⏯ PAUSE
	if (interaction.commandName === 'pause') {
		player.pause();
		return interaction.reply('⏸ Paused');
	}

	// ▶ RESUME
	if (interaction.commandName === 'resume') {
		player.unpause();
		return interaction.reply('▶ Resumed');
	}

	// ⏭ SKIP
	if (interaction.commandName === 'skip') {
		if (!serverQueue)
			return interaction.reply('Nothing playing');

		player.stop();
		serverQueue.songs.shift();
		playSong(guildId, serverQueue.connection);

		return interaction.reply('⏭ Skipped');
	}

	// 🛑 STOP
	if (interaction.commandName === 'stop') {
		if (!serverQueue)
			return interaction.reply('Nothing playing');

		serverQueue.songs = [];
		player.stop();
		serverQueue.connection.destroy();
		queue.delete(guildId);

		return interaction.reply('🛑 Stopped');
	}

	// 📜 QUEUE
	if (interaction.commandName === 'queue') {

		if (!serverQueue || serverQueue.songs.length === 0)
			return interaction.reply('Queue empty');

		const list = serverQueue.songs
			.map((s, i) => `${i + 1}. ${s.url.slice(0, 60)}...`)
			.join('\n');

		return interaction.reply(`🎶 Queue:\n${list}`);
	}

	// 🎧 NOW PLAYING
	if (interaction.commandName === 'nowplaying') {

		const song = nowPlaying.get(guildId);

		if (!song)
			return interaction.reply('Nothing playing');

		const embed = new EmbedBuilder()
			.setTitle('🎵 Now Playing')
			.setDescription(song.url)
			.setColor('Blue');

		return interaction.reply({ embeds: [embed] });
	}

	// 🔁 LOOP
	if (interaction.commandName === 'loop') {

		const current = loop.get(guildId) || false;
		loop.set(guildId, !current);

		return interaction.reply(`🔁 Loop: ${!current}`);
	}

	// 🔊 VOLUME (logic placeholder)
	if (interaction.commandName === 'volume') {

		const val = interaction.options.getInteger('value');

		if (val < 0 || val > 100)
			return interaction.reply('0-100 only');

		volume.set(guildId, val);

		return interaction.reply(`🔊 Volume set to ${val}%`);
	}

	// 🔎 SEARCH
	if (interaction.commandName === 'search') {

		const query = interaction.options.getString('query');

		const result = await yts(query);
		const video = result.videos[0];

		if (!video)
			return interaction.reply('No results');

		return interaction.reply(`🎵 ${video.title}\n${video.url}`);
	}
});

client.login(process.env.TOKEN);
