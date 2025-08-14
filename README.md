# Jerry and Harry Farm King Bot

A simple Mineflayer bot designed to work on the It’s Jerry and Harry’s Minecraft server. It connects to the  server and automatically farms tall grass if enabled. The bot also reports server statistics to a designated Discord channel.

## Features
1. Automatically connects to the server.
2. Switches from the lobby to the farmking server if necessary.
3. Optional nuke mode to automatically break all nearby grass from its spawn location.
4. Posts and updates a statistics message in a Discord channel.
5. Automatically reconnects if kicked or disconnected.

## Prerequisites
1. (v16.9.0 or higher)
2. Discord bot and a token
3. Valid MFA with Minecraft account

## Setup
1. Clone or download the repository
2. git clone https://github.com/fqhy/farmking-bot.git
3. cd farmking-bot
# Install dependencies
1. npm install
2. Configure config.json
- token: Your Discord bot's token.
- statistics_channel_id: The ID of the Discord channel where stats will be posted.
- username: Your Microsoft account email for Minecraft.
- nuke: Set to true to enable auto-farming, false to disable.

## Running the Bot
Use node index.js within the directory to start the bot.
