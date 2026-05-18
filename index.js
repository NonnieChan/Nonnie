const express = require('express');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
	res.send('SnowBallry Bot is running!');
});

app.listen(PORT, () => {
	console.log(`Web server running on port ${PORT}`);
});

const client = new Client({
	intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
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
});

client.login(process.env.TOKEN);
