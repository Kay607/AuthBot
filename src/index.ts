import { Events } from 'discord.js';
import { token, Prefix } from './config';
import { loadCommands } from './commandLoader';
import { db } from "./db";

import { client } from './client';
import { logToChannel } from './logging';
import { autoDeleteChannels, committeeRoles } from './schema';
import { eq } from 'drizzle-orm';

console.log("Load");



loadCommands(client);


client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag}!`);
});

client.on(Events.InteractionCreate, async interaction => {


    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
        // Check if the button id starts with one of the chat command names
        const chatCommandNames : string[] = Array.from((client as any).commands.keys());

        const matchingName = chatCommandNames.find(name => interaction.customId.startsWith(name));

        if (!matchingName) {
            console.error(`No matching chat command found for button with id ${interaction.customId}.`);
            return;
        }

        const command = (client as any).commands.get(matchingName);

        if (!command.buttonCallback) {
            console.error(`No button callback found for command ${matchingName}. Trying to execute ${interaction.customId}.`);
            return;
        }

        command.buttonCallback(interaction);
    }



    if (!interaction.isChatInputCommand()) return;

    const command = (client as any).commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.on(Events.MessageCreate, async message => {

    if (message.author.bot) return;

    // Get a list of all auto delete channel ids between all societies
    const autoDeleteChannelIds = (await db
        .select({
            channelId: autoDeleteChannels.channelId,
        })
        .from(autoDeleteChannels)
        .where(eq(autoDeleteChannels.serverId, message.guildId))
    ).map(r => r.channelId);


    if (autoDeleteChannelIds.includes(message.channel.id))
    {
        const committee_role_ids = (await db.
            select({
                committee_role_id: committeeRoles.roleId
            })
            .from(committeeRoles)
            .where(eq(committeeRoles.serverId, message.guildId))
        ).map(r => r.committee_role_id);
        
        // Check if user is committee member
        if (committee_role_ids && committee_role_ids.length > 0 && !message.member?.roles.cache.some(role => committee_role_ids.includes(role.id)))
        {
            logToChannel(message.guildId, true, `${message.author.username} tried to send a message in an auto delete channel\n\n${message.content}`);

            await message.delete();
            return;
        }
    }

    const hasPrefix = message.content.startsWith(Prefix);
    if (hasPrefix) {
        const args = message.content.slice(Prefix.length).trim().split(/ +|\n+/);
        const command = args.shift()?.toLowerCase();

        if (!command) return;

        const joinedArgs = message.content.slice(Prefix.length + command.length).trim();

        switch (command) {
            }
    }
});

client.login(token);
