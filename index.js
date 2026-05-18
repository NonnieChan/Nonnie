const express = require('express');
const path = require('path');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

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
