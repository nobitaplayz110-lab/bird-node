const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');
const axios = require('axios');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; //
const MAGMA_API_KEY = process.env.MAGMA_API_KEY;
const BASE_URL = "https://client.magmahost.net/api/client/servers";

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// --- COMMAND DEFINITION ---
const commands = [
    new SlashCommandBuilder()
        .setName('setup_panel')
        .setDescription('[ADMIN] Deploy a live BirdNode control panel for a specific server ID.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('server_id')
                .setDescription('The 8-character ID of the client server')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('client_name')
                .setDescription('Name of the client owner')
                .setRequired(false))
].map(command => command.toJSON());

// --- REGISTER SLASH COMMANDS ---
client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} Is Online and ready to manage servers!`);
    client.user.setActivity('Managing BirdNode Clouds ☁️');

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        console.log('🔄 Started refreshing application (/) commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('🟢 Slash Commands Successfully Synced Globally!');
    } catch (error) {
        console.error(error);
    }
});

// --- INTERACTION HANDLER (Commands & Buttons) ---
client.on('interactionCreate', async interaction => {
    // 1. Handle Slash Command (/setup_panel)
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup_panel') {
            await interaction.deferReply();

            const serverId = interaction.options.getString('server_id');
            const clientName = interaction.options.getString('client_name') || 'Premium Client';

            try {
                const response = await axios.get(`${BASE_URL}/${serverId}/resources`, {
                    headers: {
                        'Authorization': `Bearer ${MAGMA_API_KEY}`,
                        'Accept': 'application/json'
                    }
                });

                const stats = response.data.attributes.resources;
                const ramUsed = (stats.memory_bytes / (1024 * 1024)).toFixed(1);
                const cpuUsed = stats.cpu_absolute.toFixed(1);
                const diskUsed = (stats.disk_bytes / (1024 * 1024)).toFixed(1);
                const status = response.data.attributes.current_state.toUpperCase();

                // Premium Interface Design
                const embed = new EmbedBuilder()
                    .setTitle('🛸 BirdNode Virtual Cloud Terminal')
                    .setDescription(`**Infrastructure Connection:** \`🟢 ACTIVE\` \n**Client Owner:** \`${clientName}\``)
                    .setColor('#1bc47d')
                    .addFields(
                        { name: '📶 Power State', value: `\` ${status} \``, inline: true },
                        { name: '⚡ CPU Core Load', value: `\` ${cpuUsed}% \``, inline: true },
                        { name: '🧠 Memory Allocation', value: `\` ${ramUsed} MB \``, inline: true },
                        { name: '💾 Storage Space', value: `\` ${diskUsed} MB \``, inline: true },
                        { name: '🆔 Target Node ID', value: `\` ${serverId} \``, inline: false }
                    )
                    .setFooter({ text: '⚡ Managed Infrastructure via BirdNode Datacenters | AES-256 Cloud Shield' });

                // Buttons Row Setup
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId(`start_${serverId}`).setLabel('🟢 START').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`stop_${serverId}`).setLabel('🔴 STOP').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`restart_${serverId}`).setLabel('🔄 RESTART').setStyle(ButtonStyle.Primary)
                    );

                await interaction.editReply({ embeds: [embed], components: [row] });

            } catch (error) {
                console.error(error);
                await interaction.editReply(`❌ Failed to reach node server. Verify if Server ID \`${serverId}\` is correct.`);
            }
        }
    }

    // 2. Handle Button Clicks (Power Actions)
    if (interaction.isButton()) {
        await interaction.deferReply({ ephemeral: true });
        
        // CustomID format split: [action, serverId]
        const [action, serverId] = interaction.customId.split('_');

        try {
            const resp = await axios.post(`${BASE_URL}/${serverId}/power`, 
                { signal: action },
                {
                    headers: {
                        'Authorization': `Bearer ${MAGMA_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            if (resp.status === 204 || resp.status === 200) {
                await interaction.followUp({ content: `🟢 Command successfully sent: **${action.toUpperCase()}**`, ephemeral: true });
            } else {
                await interaction.followUp({ content: `❌ Panel backend error. Status: ${resp.status}`, ephemeral: true });
            }
        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: `❌ Connection failed or invalid action.`, ephemeral: true });
        }
    }
});

// Start the engine
client.login(BOT_TOKEN);
