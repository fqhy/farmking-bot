const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const mcDataLoader = require('minecraft-data');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
let config;

if (fs.existsSync(configPath)) {
    config = require(configPath);
} else {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!! config.json not found! Please create it and     !!!");
    console.error("!!! fill in your bot token, channel ID, and         !!!");
    console.error("!!! username before running the bot.                !!!");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel],
});

client.once('ready', () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
});

client.login(config.token);

let statsInterval = null;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initializeBot() {
    let statsMessage = null;

    const bot = mineflayer.createBot({
        host: 'play.itsjerryandharry.com',
        port: 25565,
        username: config.username,
        auth: "microsoft",
        version: '1.8.9'
    });

    bot.loadPlugin(pathfinder);

    function parseScoreboard() {
        const stats = {
            balance: 'N/A',
            moneyPerSecond: 'N/A',
            playtime: 'N/A',
            totalMade: 'N/A',
            playtimeHours: 0
        };

        if (!bot.scoreboard || !bot.scoreboard.sidebar) {
            return stats;
        }

        const items = bot.scoreboard.sidebar.items.map(item =>
            item.displayName.getText(null).replace(/§[0-9a-fk-or]/g, '')
        );

        for (let i = 0; i < items.length - 1; i++) {
            const currentLine = items[i];
            const nextLine = items[i + 1];

            if (currentLine.includes('Current Balance')) {
                stats.balance = nextLine.replace('$', '').trim();
            } else if (currentLine.includes('Money Per Second')) {
                stats.moneyPerSecond = nextLine.replace('$', '').trim();
            } else if (currentLine.includes('Total Time Played')) {
                stats.playtime = nextLine.trim();
                const days = parseFloat(stats.playtime);
                if (!isNaN(days)) {
                    stats.playtimeHours = (days * 24).toFixed(1);
                }
            } else if (currentLine.includes('Total Money Made')) {
                stats.totalMade = nextLine.replace('$', '').trim();
            }
        }

        return stats;
    }

    async function updateStatsMessage() {
        try {
            const statsChannel = await client.channels.fetch(config.statistics_channel_id);
            if (!statsChannel) {
                console.error(`Could not find stats channel with ID: ${config.statistics_channel_id}`);
                return;
            }

            const scoreboard = parseScoreboard();

            const embed = {
                color: 0x00FF00,
                title: 'Farm King Statistics',
                description: [
                    `**Current balance:** $${scoreboard.balance}`,
                    `**Money per second:** $${scoreboard.moneyPerSecond}`,
                    `**Playtime:** ${scoreboard.playtime} (${scoreboard.playtimeHours} hours)`,
                    `**Total made:** $${scoreboard.totalMade}`,
                    `\nLast updated: <t:${Math.floor(Date.now() / 1000)}:R>`
                ].join('\n'),
                footer: { text: 'Bot statistics are updated every 30 seconds.' },
            };

            if (statsMessage) {
                await statsMessage.edit({ embeds: [embed] });
            } else {
                const messages = await statsChannel.messages.fetch({ limit: 10 });
                const botMessage = messages.find(m => m.author.id === client.user.id);
                statsMessage = botMessage ? await botMessage.edit({ embeds: [embed] }) : await statsChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error("Error updating stats message:", error);
            statsMessage = null;
        }
    }

    function findNearbyTallgrass(radius) {
        const center = bot.entity.position;
        const blocks = [];

        for (let x = -radius; x <= radius; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -radius; z <= radius; z++) {
                    const pos = center.offset(x, y, z);
                    const block = bot.blockAt(pos);
                    if (block && block.name === 'tallgrass') {
                        blocks.push(pos);
                    }
                }
            }
        }
        return blocks;
    }
    
    async function grassNuker() {
        console.log("Grass nuker activated.");
        while (true) {
            const targets = findNearbyTallgrass(5);
    
            if (targets.length === 0) {
                await sleep(10);
                continue;
            }
    
            for (const pos of targets) {
                const block = bot.blockAt(pos);
                if (!block || block.name !== 'tallgrass') continue;
    
                try {
                    bot.lookAt(block.position.offset(0.5, 0.5, 0.5), false);
                    await bot.dig(block);
                } catch (e) {
                    // Ignore digging errors
                }
    
                await sleep(10);
            }
        }
    }

    bot.once('spawn', async () => {
        console.log("Bot has spawned. Checking current server...");
        
        const waitForServerMessage = () => {
            return new Promise((resolve) => {
                const listener = (jsonMsg) => {
                    const message = jsonMsg.toString().trim();
                    if (message.startsWith('You are currently connected to')) {
                        bot.removeListener('message', listener);
                        resolve(message);
                    }
                };
                bot.on('message', listener);
            });
        };

        bot.chat('/gserver');
        const serverMessage = await waitForServerMessage();
        console.log(`Server check response: "${serverMessage}"`);

        if (serverMessage.includes('lobby')) {
            console.log("Currently in lobby. Switching to farmking server...");
            bot.chat('/server farmking');
            return; 
        }
        
        console.log("Correct server (farmking) confirmed. Proceeding.");

        if (statsInterval) clearInterval(statsInterval);
        statsInterval = setInterval(updateStatsMessage, 30000);

        if (config.nuke) {
            grassNuker();
        } else {
            console.log("Nuke mode is disabled in config.json. Bot will remain idle.");
        }
    });

    function handleDisconnect(reason) {
        console.log(`Bot disconnected. Reason: ${reason}. Reconnecting in ${config.reconnect_delay_ms / 1000} seconds...`);
        bot.end();
        if (statsInterval) clearInterval(statsInterval);
        setTimeout(initializeBot, config.reconnect_delay_ms);
    }

    bot.on('kicked', (reason) => handleDisconnect(`Kicked - ${reason}`));
    bot.on('error', (err) => handleDisconnect(`Error - ${err.message}`));
    bot.on('end', (reason) => handleDisconnect(`Connection Ended - ${reason}`));
}

initializeBot();