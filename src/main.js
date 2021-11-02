require('dotenv').config()

const {REST} = require('@discordjs/rest');
const {Routes} = require('discord-api-types/v9');
const mongoose = require('mongoose')
const { SlashCommandBuilder } = require('@discordjs/builders');


const commands = [
{
    name: 'verify',
    description: 'Verifies your osu account'
},
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription(`Shows a user's osu profile`)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to show the osu profile of')
                .setRequired(false)

        ).toJSON()



]

const rest = new REST({version: '9'}).setToken(process.env.DISCORD_API_TOKEN);

const MemberSchema = new mongoose.Schema({
    displayName: {type: String, required: true},
    profileId: {type: String, required: true, unique: true},
    discordProfileId: {type: String, required: true, unique: true}
})

const MemberModel = mongoose.model('member', MemberSchema);


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

    await mongoose.connect(`mongodb://${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/${process.env.MONGO_DATABASE}`);

    const {Client, Intents} = require('discord.js');
    const intents = [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES]
    const client = new Client({intents, ws: {intents}});


    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);

        require('./server')(client, MemberModel)
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;

        if (interaction.commandName === 'verify') {
            await verify(interaction)
        }

        if(interaction.commandName === 'profile') {
            console.log(interaction.member.id)
            console.log(interaction.user.id)
            const user =  interaction.options.getUser('user') || interaction.user

            console.log(user)

            const member = await MemberModel.findOne({discordProfileId: user.id})
            if(member) {
                interaction.reply(`https://osu.ppy.sh/users/${member.profileId}`)
            } else {
                interaction.reply('Could not find an osu profile for this user')
            }
        }
    });

    client.on('guildMemberAdd', async member => {
        console.log('member joined')


        const channel = await member.guild.channels.fetch('879095417600634971')

        const user = await MemberModel.findOne({discordProfileId: member.id})

        if (user) {
            const role = await member.guild.roles.fetch('904760669520408628')
            await member.roles.add(role)
            await channel.send(`Hello <@${member.id}>! Looks like I've seen you before. I automatically verified your account, no need to verify yourself.`)
        } else {
            try {
                await member.send(`Welcome to Avalon!
Click here to verify your account: http://mapping-tools.io/avalon/verify?q=${member.user.id}`)
                await channel.send(`Hello <@${member.id}>! Please check your DMs for instructions on how to verify your account.`)
            } catch (e) {
                console.log(e)
                await channel.send(`Hello <@${member.id}>! I could not send you instructions for verifying your profile. Please enable dms and then use the /verify command to verify your link your osu profile with your discord account.`)
            }
        }

    })

    async function verify(interaction) {

        if (interaction.member.roles.cache.some(role => role.id === '904760669520408628')) {
            interaction.reply('You are already verified')
        } else {
            try {
                await interaction.member.send(
                    `Welcome to Avalon!
Click here to verify your account: http://mapping-tools.io/avalon/verify?q=${interaction.member.user.id}`
                )
                if(interaction.user.id === '430781346730999809')
                    interaction.reply('fuck you')
                else
                    interaction.reply(`I've sent you instructions on how to verify as a private message.`);
            } catch (e) {
                console.log(e)
                interaction.reply(`I couldn't send you instructions on how to verify. Please enable private messages on this server.`);
            }
        }

    }


    client.on('messageCreate', message => {
        if(message.mentions.users.some(it => it.id === client.user.id)) {
            if(['hello', 'hi'].some(end => message.content.toLowerCase().endsWith(end)))
                message.reply('Hi :flushed:')
        }
    })


    client.login(process.env.DISCORD_API_TOKEN);


})()


