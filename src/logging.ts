import { MessageFlags, TextChannel } from "discord.js";
import { client } from './client';
import { getGroup } from "./db/common";

export function logToChannel(guildID: string, silent: boolean, ...args: any[]) {
    // Args as a string
    let message = args.join(" ");
    // If the message is too long, truncate it
    if (message.length > 2000) message = (message + "... (truncated)").substring(0, 2000);

    const channel_id = getGroup(guildID)?.log_channel_id;
    if (!channel_id) return;
    
    const channel = client.channels.cache.get(channel_id) as TextChannel;
    if (!channel) return;

    channel.send({ content: message, flags: silent ? MessageFlags.SuppressNotifications : undefined });
}

export function committeeErrorToChannel(guildID: string, ...args: any[])
{
    logToChannel(guildID, false, ...args, '\n@everyone');
}
