const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

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
