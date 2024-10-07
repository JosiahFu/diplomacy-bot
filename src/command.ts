import { APIGuildMember, ApplicationCommandOptionBase, ApplicationCommandOptionType, Attachment, AttachmentBuilder, CacheType, ChatInputCommandInteraction, Client, CommandInteractionOptionResolver, GuildMember, GuildMemberRoleManager, Interaction, roleMention, SharedSlashCommandOptions, SlashCommandBooleanOption, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandIntegerOption, SlashCommandNumberOption, SlashCommandRoleOption, SlashCommandStringOption, SlashCommandUserOption, StringSelectMenuOptionBuilder, TextChannel, userMention, VoiceChannel } from 'discord.js';
import { Country, STATE, Season, countries, decrementTurn, incrementTurn, resetState, updateStorage } from './storage.js';

function getOutputChannel(interaction: ChatInputCommandInteraction<CacheType>) {
    const outputChannel = interaction.client.channels.cache.get(process.env.OUTPUT_CHANNEL_ID);
    if (!outputChannel?.isTextBased()) process.exit('Output channel was not a text based channel');
    return outputChannel;
}

async function sendTurnMessage(interaction: ChatInputCommandInteraction, season: Season, year: number) {
    const channel = getOutputChannel(interaction)
    if (STATE.scores !== undefined) {
        await channel.send({
            content: formatScoreboard()
        })
        STATE.lastScores = {...STATE.scores}
    }
    const message = await channel.send({
        content: `## Start of ${season} ${year}`,
        files: STATE.gSlideId ? [
            new AttachmentBuilder(`https://docs.google.com/presentation/d/${STATE.gSlideId}/export?format=png`)
                .setName(`diplomacy_board_${year}_${season.toLowerCase()}_${STATE.gSlideId}.png`)
        ] : undefined,
    })
    STATE.lastEndTurn = message.id
    updateStorage();
    return message;
}

function displaydiff(prev: number | undefined, current: number) {
    if (prev === undefined || prev === current) return ''
    if (prev > current) return `(-${prev - current})`
    return `(+${current - prev})`
}

function formatScoreboard() {
    if (STATE.scores === undefined) return undefined
    return '## Scoreboard\n' + Object.entries(STATE.scores).map(([role, score]) => `${roleMention(role)}: ${score} ${displaydiff(STATE.lastScores?.[role], score)}`).join('\n')
}

function getCountryRole(member: GuildMember | APIGuildMember | null) {
    return (Object.entries(roles) as [Country, string][]).find(([_, id]) => (member?.roles as GuildMemberRoleManager).cache.has(id))?.[0];
}

function extractSlideId(link: string | null) {
    if (link === null) return undefined
    return gSlideUrlRegex.exec(link)?.[1] ?? gSlideIdRegex.exec(link)?.[0] ?? undefined
}

interface Command {
    description: string;
    options?: ApplicationCommandOptionBase[];
    execute(interaction: ChatInputCommandInteraction<CacheType>, options: Omit<CommandInteractionOptionResolver<CacheType>, 'getMessage' | 'getFocused'>): void | Promise<void>;
}

const roles: Record<Country, string> = {
    austria: process.env.ROLE_AUSTRIA,
    england: process.env.ROLE_ENGLAND,
    france: process.env.ROLE_FRANCE,
    germany: process.env.ROLE_GERMANY,
    italy: process.env.ROLE_ITALY,
    russia: process.env.ROLE_RUSSIA,
    turkey: process.env.ROLE_TURKEY,
}

const vcs: Record<Country | 'jail' | 'main', string> = {
    austria: process.env.VC_AUSTRIA,
    england: process.env.VC_ENGLAND,
    france: process.env.VC_FRANCE,
    germany: process.env.VC_GERMANY,
    italy: process.env.VC_ITALY,
    russia: process.env.VC_RUSSIA,
    turkey: process.env.VC_TURKEY,
    jail: process.env.VC_JAIL,
    main: process.env.VC_MAIN,
}

const gSlideUrlRegex = /docs\.google\.com\/presentation\/d\/([A-Za-z0-9-]+)\/?/;
const gSlideIdRegex = /^[A-Za-z0-9-]+$/

export const commands: Record<string, Command> = {
    order: {
        description: 'Set your order for this turn',
        options: [
            new SlashCommandStringOption().setName('order').setDescription('Your order').setRequired(true)
        ],
        async execute(interaction, options) {
            const order = options.getString('order', true)
            const countryRole = getCountryRole(interaction.member)
            if (countryRole === undefined) {
                await interaction.reply({
                    content: `You are not part of the game`,
                    ephemeral: true,
                })
                return    
            }
            STATE.orders[countryRole] = order;
            updateStorage();
            await interaction.reply({
                content: `Your order is:\n> ${order}`,
                ephemeral: true,
            })
        },
    },
    showorder: {
        description: 'View your current order',
        options: [],
        async execute(interaction) {
            const countryRole = getCountryRole(interaction.member)
            if (countryRole === undefined) {
                await interaction.reply({
                    content: `You are not part of the game`,
                    ephemeral: true,
                })
                return    
            }
            const order = STATE.orders[countryRole]
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
                content: `Recieved orders from:\n${submitted.length > 0 ? submitted.map(e => userMention(e)).join('\n') : 'Nobody'}`,
                ephemeral: true
            })
        },
    },
    reveal: {
        description: 'Reveal all orders',
        async execute(interaction) {
            interaction.reply({
                content: 'Revealed all orders',
                ephemeral: true,
            })
            const message = await getOutputChannel(interaction).send({content: `# Orders:\n${Object.entries(STATE.orders).map(([role, order]) => `${roleMention(roles[role as Country])}: ${order}`).join('\n')}`})
            STATE.lastOrders = STATE.orders
            STATE.orders = {}
            STATE.lastReveal = message.id
            updateStorage();
        },
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
    },
    endturn: {
        description: 'End the turn',
        async execute(interaction) {
            const [year, season] = STATE.turn;
            incrementTurn();
            sendTurnMessage(interaction, season, year)
            interaction.reply({
                content: 'Ended the turn',
                ephemeral: true,
            })
        },
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
    },
    newgame: {
        description: 'Start a new game',
        options: [
            new SlashCommandStringOption()
                .setName('slide_link')
                .setDescription('The URL or ID of the Google Slides document holding the current game')
                .setRequired(false),
            new SlashCommandBooleanOption()
                .setName('scoreboard')
                .setDescription('Whether the game should use a scoreboard')
                .setRequired(false),
        ],
        execute(interaction, options) {
            interaction.reply({
                content: 'Starting a new game',
                ephemeral: true
            });
            const slideId = extractSlideId(options.getString('slide_link', false))
            resetState();
            if (slideId) {
                STATE.gSlideId = slideId
            }
            if (options.getBoolean('scoreboard', false)) {
                STATE.scores = Object.fromEntries(Object.values(roles).map(role => [role, 0]))
            }
            const [year, season] = STATE.turn;
            sendTurnMessage(interaction, season, year)
        },
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
    },
    setslides: {
        description: 'Set the Google Slide holding the game',
        options: [
            new SlashCommandStringOption()
                .setName('slide_link')
                .setDescription('The URL or ID of the Google Slides document holding the current game')
                .setRequired(true)
        ],
        execute(interaction, options) {
            const linkOption = options.getString('slide_link');
            const slideId = extractSlideId(linkOption);
            if (!slideId) {
                interaction.reply({
                    content: `Invalid link: ${linkOption}`,
                    ephemeral: true
                });
                return;
            }
            STATE.gSlideId = slideId
            interaction.reply({
                content: `Set slide link to https://docs.google.com/presentation/d/${slideId}/`,
                ephemeral: true
            });
            updateStorage();
        },
    },
    assigntargets: {
        description: 'Assign each country a unique target',
        execute(interaction, options) {
            const order = [...countries]
            order.sort(() => Math.random() - 0.5)
            const targets = Object.fromEntries(order.map((e, i) => [e, order[(i + 1) % order.length]])) as Record<Country, Country>
            STATE.targets = targets;
            updateStorage();
            interaction.reply({
                content: 'Targets assigned!',
                ephemeral: true
            })
            getOutputChannel(interaction).send({
                content: `# Targets Assigned!`
            })
        }
    },
    gettarget: {
        description: 'Reveal what your target is',
        execute(interaction, options) {
            const entry = getCountryRole(interaction.member)
            if (entry === undefined) {
                interaction.reply({
                    content: 'You don\'t have a country role',
                    ephemeral: true
                })
                return
            }
            if (STATE.targets === undefined) {
                interaction.reply({
                    content: 'Targets are not assigned yet',
                    ephemeral: true
                })
                return
            }
            const target = STATE.targets[entry]
            interaction.reply({
                content: `Your target is ${roleMention(roles[target])}`,
                ephemeral: true
            })
        }
    },
    setscore: {
        description: 'Set a player\'s score',
        options: [
            new SlashCommandRoleOption()
                .setName('country')
                .setDescription('The country to set the score of')
                .setRequired(true),
            new SlashCommandIntegerOption()
                .setName('value')
                .setDescription('The score to set for the country')
                .setRequired(true)
        ],
        async execute(interaction, options) {
            if (STATE.scores === undefined) {
                interaction.reply({content: 'Scoreboard not enabled for this game', ephemeral: true})
                return
            }
            const targetRole = options.getRole('country', true)
            if (!(Object.values(roles).includes(targetRole.id))) {
                interaction.reply({content: 'Must be a country role', ephemeral: true})
                return
            }
            const value = options.getInteger('value', true)
            STATE.scores[targetRole.id] = value
            updateStorage()
            interaction.reply({
                content: `Set score for ${roleMention(targetRole.id)} to ${value}`,
                ephemeral: true,
            })
        },
    },
    addscore: {
        description: 'Add to a player\'s score',
        options: [
            new SlashCommandRoleOption()
                .setName('country')
                .setDescription('The country to add to the score of')
                .setRequired(true),
            new SlashCommandIntegerOption()
                .setName('value')
                .setDescription('The value to add for that country')
                .setRequired(true)
        ],
        async execute(interaction, options) {
            if (STATE.scores === undefined) {
                interaction.reply({content: 'Scoreboard not enabled for this game', ephemeral: true})
                return
            }
            const targetRole = options.getRole('country', true)
            if (!(Object.values(roles).includes(targetRole.id))) {
                interaction.reply({content: 'Must be a country role', ephemeral: true})
                return
            }
            const value = options.getInteger('value', true)
            STATE.scores[targetRole.id] += + value
            updateStorage()
            interaction.reply({
                content: `Added ${value} to the score of ${roleMention(targetRole.id)} for a total of ${STATE.scores[targetRole.id]}`,
                ephemeral: true,
            })
        },
    },
    scoreboard: {
        description: 'Display the scoreboard',
        options: [
            new SlashCommandBooleanOption()
                .setName('public')
                .setDescription('Whether the scoreboard should display publicly. Defaults to false.')
                .setRequired(false)
        ],
        execute(interaction, options) {
            if (STATE.scores === undefined) {
                interaction.reply({content: 'Scoreboard not enabled for this game', ephemeral: true})
                return
            }
            interaction.reply({
                content: formatScoreboard()!,
                ephemeral: !(options.getBoolean('public', false) ?? false)
            })
        },
    },
    move_central: {
        description: 'Move everyone to the main VC',
        execute(interaction) {
            const mainChannel = interaction.guild!.channels.cache.get(vcs.main)
            if (!(mainChannel instanceof VoiceChannel)) {
                interaction.reply({content: 'Bad configuration', ephemeral: true})
                return
            }
            interaction.reply({content: 'Moved everyone to the correct channels', ephemeral: true})
            const rolesList = Object.values(roles)
            interaction.guild?.members.cache.filter(mem => mem.roles.cache.some(role => rolesList.includes(role.id))).forEach(mem => {
                mem.voice.setChannel(mainChannel)
            })
            interaction.guild!.members.cache.find(member => member.user === interaction.user)!.voice.setChannel(mainChannel)
        },
    },
    move_distribute: {
        description: 'Move everyone to their respective VCs',
        async execute(interaction) {
            interaction.reply({content: 'Moving everyone to the correct channels', ephemeral: true})
            for (const country of countries) {
                const channel = interaction.guild!.channels.cache.get(vcs[country])
                if (!(channel instanceof VoiceChannel)) {
                    interaction.followUp({content: `Bad configuration for ${country}`, ephemeral: true})
                    return
                }
                interaction.guild?.members.cache.filter(mem => mem.roles.cache.some(role => role.id === roles[country])).forEach(mem => {
                    mem.voice.setChannel(channel)
                })
            }
        },
    },
    jail: {
        description: 'Move someone to jail',
        options: [
            new SlashCommandUserOption()
                .setName('user')
                .setDescription('The user to send to jail')
                .setRequired(true)
        ],
        async execute(interaction, options) {
            const jail = interaction.guild!.channels.cache.get(vcs.jail)
            if (!(jail instanceof VoiceChannel)) {
                interaction.reply({content: 'Bad configuration', ephemeral: true})
                return
            }
            const user = options.getUser('user', true)
            const member = interaction.guild!.members.cache.find(member => member.user == user)!
            if (member.voice.channel !== (interaction.member as GuildMember).voice.channel) {
                interaction.reply({content: `You must be in the same channel as ${userMention(user.id)}`, ephemeral: true})
                return
            }
            interaction.reply({content: `Moved ${userMention(user.id)} to jail`, ephemeral: true})
            member.voice.setChannel(jail)
        },
    },
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
