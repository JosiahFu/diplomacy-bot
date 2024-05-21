import { ApplicationCommandOptionBase, ApplicationCommandOptionType, CacheType, ChatInputCommandInteraction, Client, CommandInteractionOptionResolver, SharedSlashCommandOptions, SlashCommandBooleanOption, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandIntegerOption, SlashCommandNumberOption, SlashCommandRoleOption, SlashCommandStringOption, SlashCommandUserOption, StringSelectMenuOptionBuilder, TextChannel } from 'discord.js';
import { STATE, Season, decrementTurn, incrementTurn, resetState, updateStorage } from './storage.js';

function getOutputChannel(interaction: ChatInputCommandInteraction<CacheType>) {
    const outputChannel = interaction.client.channels.cache.get(process.env.OUTPUT_CHANNEL_ID!);
    if (!outputChannel?.isTextBased()) process.exit('Output channel was not a text based channel');
    return outputChannel;
}

interface Command {
    description: string;
    options?: ApplicationCommandOptionBase[];
    execute(interaction: ChatInputCommandInteraction<CacheType>, options: Omit<CommandInteractionOptionResolver<CacheType>, 'getMessage' | 'getFocused'>): void | Promise<void>;
    priveleged?: boolean;
}

export const commands: Record<string, Command> = {
    order: {
        description: 'Set your order for this turn',
        options: [
            new SlashCommandStringOption().setName('order').setDescription('Your order').setRequired(true)
        ],
        async execute(interaction, options) {
            const order = options.getString('order')
            if (!order) return;
            STATE.orders[interaction.user.id] = order;
            updateStorage();
            await interaction.reply({
                content: `Your order is:\n> ${order}`,
                ephemeral: true,
            })
        },
    },
    orderstatus: {
        description: 'See which players have submitted orders',
        options: [],
        execute(interaction, options) {
            const submitted = Object.keys(STATE.orders);
            interaction.reply({
                content: `Recieved orders from:\n${submitted.length > 0 ? submitted.map(e => `<@${e}>`).join('\n') : 'Nobody'}`,
                ephemeral: true
            })
        },
        priveleged: true,
    },
    reveal: {
        description: 'Reveal all orders',
        async execute(interaction) {
            interaction.reply({
                content: 'Revealed all orders',
                ephemeral: true,
            })
            const message = await getOutputChannel(interaction).send({content: `# Orders:\n${Object.entries(STATE.orders).map(([user, order]) => `<@${user}>: ${order}`).join('\n')}`})
            STATE.lastOrders = STATE.orders
            STATE.orders = {}
            STATE.lastReveal = message.id
            updateStorage();
        },
        priveleged: true,
    },
    unreveal: {
        description: 'Undo the last reveal',
        async execute(interaction) {
            if (!STATE.lastReveal) {
                interaction.reply({
                    content: 'No reveals to undo',
                    ephemeral: true
                })
                return;
            }
            const message = await getOutputChannel(interaction).messages.fetch(STATE.lastReveal)
            if (!message) {
                interaction.reply({
                    content: 'Could not find last reveal message',
                    ephemeral: true
                })
                return;
            }
            await message.delete();
            STATE.lastReveal = undefined;
            STATE.orders = STATE.lastOrders;
            STATE.lastOrders = {}
            updateStorage();
            interaction.reply({
                content: 'Undid last reveal',
                ephemeral: true
            })
        },
        priveleged: true,
    },
    endturn: {
        description: 'End the turn',
        async execute(interaction) {
            const [year, season] = STATE.turn;
            incrementTurn();
            const message = await getOutputChannel(interaction).send({
                content: `## Start of ${season} ${year}`
            })
            STATE.lastEndTurn = message.id
            updateStorage();
            interaction.reply({
                content: 'Ended the turn',
                ephemeral: true,
            })
        },
        priveleged: true,
    },
    revertendturn: {
        description: 'Revert the last end turn',
        async execute(interaction) {
            if (!STATE.lastEndTurn) {
                interaction.reply({
                    content: 'No endturns to undo',
                    ephemeral: true
                })
                return;
            }
            const message = await getOutputChannel(interaction).messages.fetch(STATE.lastEndTurn)
            if (!message) {
                interaction.reply({
                    content: 'Could not find last endturn message',
                    ephemeral: true
                })
                return;
            }
            message.delete();
            STATE.lastEndTurn = undefined;
            decrementTurn();
            updateStorage();
            interaction.reply({
                content: 'Undid last endturn',
                ephemeral: true
            })
        },
        priveleged: true,
    },
    newgame: {
        description: 'Start a new game',
        async execute(interaction) {
            interaction.reply({
                content: 'Starting a new game',
                ephemeral: true
            });
            resetState();
            const [year, season] = STATE.turn;
            const message = await getOutputChannel(interaction).send({
                content: `## Start of ${season} ${year}`
            })
            STATE.lastEndTurn = message.id
            updateStorage();
        },
        priveleged: true,
    },
    setturn: {
        description: 'Manually set the turn',
        options: [
            new SlashCommandIntegerOption()
                .setName('year')
                .setDescription('The year to set the turn to')
                .setMinValue(1901)
                .setRequired(true),
            new SlashCommandStringOption()
                .setName('season')
                .setDescription('The season to set the turn to')
                .addChoices(
                    {name: 'Fall', value: 'Fall'},
                    {name: 'Spring', value: 'Spring'}
                )
                .setRequired(true)
        ],
        execute(interaction, options) {
            const year = options.getInteger('year')!
            const season = options.getString('season') as Season
            STATE.turn = [year, season]
            updateStorage();
            interaction.reply({
                content: `Set the turn to ${season} ${year}`,
                ephemeral: true
            });
        },
        priveleged: true,
    }
};

export function getOptionAdd<T extends ApplicationCommandOptionBase>(option: T): ((input: T) => void) | undefined {
    switch(option.type) {
        case ApplicationCommandOptionType.Attachment: return SharedSlashCommandOptions.prototype.addAttachmentOption as any;
        case ApplicationCommandOptionType.Boolean: return SharedSlashCommandOptions.prototype.addBooleanOption as any;
        case ApplicationCommandOptionType.Channel: return SharedSlashCommandOptions.prototype.addChannelOption as any;
        case ApplicationCommandOptionType.Integer: return SharedSlashCommandOptions.prototype.addIntegerOption as any;
        case ApplicationCommandOptionType.Mentionable: return SharedSlashCommandOptions.prototype.addMentionableOption as any;
        case ApplicationCommandOptionType.Number: return SharedSlashCommandOptions.prototype.addNumberOption as any;
        case ApplicationCommandOptionType.Role: return SharedSlashCommandOptions.prototype.addRoleOption as any;
        case ApplicationCommandOptionType.String: return SharedSlashCommandOptions.prototype.addStringOption as any;
        case ApplicationCommandOptionType.User: return SharedSlashCommandOptions.prototype.addUserOption as any;
    }
}
