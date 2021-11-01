require('dotenv').config()

const {REST} = require('@discordjs/rest');
const {Routes} = require('discord-api-types/v9');


const commands = [{
    name: 'verify',
    description: 'Verifies your osu account'
}]

const rest = new REST({version: '9'}).setToken(process.env.DISCORD_API_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
            {body: commands},
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})()


const {Client, Intents} = require('discord.js');
const client = new Client({intents: [Intents.FLAGS.GUILDS]});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    require('./server')(client)
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'verify') {
        await verify(interaction)
    }
});

async function verify(interaction) {

    try {
        await interaction.member.send(
            `Welcome to Avalon!
Click here to verify your account: http://localhost:4040/verify?q=${interaction.member.user.id}`
        )
        interaction.reply(`I've sent you instructions on how to verify as a private message.`);
    } catch (e) {
        interaction.reply(`I couldn't send you instructions on how to verify. Please enable private messages on this server.`);
    }
}

client.login(process.env.DISCORD_API_TOKEN);

