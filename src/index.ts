import 'dotenv/config';
import {
    Client,
    Events,
    IntentsBitField,
    REST,
    Routes,
    SlashCommandBuilder,
    ActivityType,
} from 'discord.js'
import { commands, getOptionAdd } from './command.js';

const { BOT_TOKEN, APPLICATION_ID } = process.env;

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages] });

const onExit = async () => {
    console.log('Stopping bot');
    await client.destroy();
};

client.once('ready', () => {
    console.log('Bot is online!');
    client.user!.setPresence({
        activities: [{
            name: "Let the games begin",
            type: ActivityType.Custom
        }]
    })

    process.on('SIGINT', onExit);
    process.on('SIGTERM', onExit);
});

const rest = new REST().setToken(BOT_TOKEN);

await rest.put(
    Routes.applicationCommands(APPLICATION_ID),
    {
        body: Object.entries(commands).map(([name, {description, options}]) => {
            const command = new SlashCommandBuilder()
                .setName(name)
                .setDescription(description);
            
            if (options) {
                for (const option of options) {
                    getOptionAdd(option)?.call(command, option)
                }
            }

            return command.toJSON();
        })
    }
);

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const data = commands[interaction.commandName]
    
    if (!data) {
        console.error(
            `No command matching ${interaction.commandName} was found.`
        );
        return;
    }
    
    await data.execute(interaction, interaction.options)
});

client.login(BOT_TOKEN)
