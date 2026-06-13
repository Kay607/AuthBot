import { SlashCommandBuilder, CommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import { failIsCommittee, failServerCheck } from '../../commandUtils';
import { getEvents } from '../../events';
import { getTickets } from '../../guildHandler';
import { Event } from '../../events';
import { getGroup } from '../../db/common';


interface EventWithTicket extends Event {
    tickets: number
}

export default {
	data: new SlashCommandBuilder()
		.setName('tickets')
		.setDescription('[Committee Only] Check number of tickets sold for events'),
		
	async execute(interaction: CommandInteraction) {

		if (failServerCheck(interaction)) return;
		if (failIsCommittee(interaction)) return;

		const guildID = interaction.guildId;

		
		await interaction.deferReply();

		const group = getGroup(guildID);

        const events = await getEvents(group.organisation_id);

        let productRows = await getTickets(interaction.user.id,group.organisation_id);


        productRows = productRows.filter((row) => {
            // Remove rows that don't have a '-'
            return row.product.includes('-') && row.product.includes(']') && !row.product.includes('Booking Fee');
        });

        productRows = productRows.map((row) => {
            // '[37289482] ???? Event name ???? Thu 20 Nov 2025 - Member'
            // Remove the first part of the string
            let newProduct = row.product.split('] ')[1];

            // Remove the last part of the string (Member / Non-Member)
            newProduct = newProduct.replace(/ - [^-]+$/, '');

            // Remove all emojis
            newProduct = newProduct.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');

            // Remove all question marks
            newProduct = newProduct.replace(/\?/g, '');

            newProduct = newProduct.replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\b/, '');


            return {
                product: newProduct.trim(),
                quantity: row.quantity,
                type: row.type,
                total: row.total,
            };
        });


        const newEvents = events.map((event) => {
            let cleanedEventName = event.name;
            // Remove emojis
            cleanedEventName = cleanedEventName.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
            // Remove question marks
            cleanedEventName = cleanedEventName.replace(/\?/g, '');


            let tickets = 0;
            // Match event with ticket product
            const ticketProducts = productRows.filter((row) => row.product === cleanedEventName);
                ticketProducts.forEach((row) => {
                    if (row.type === "Sale") {
                        tickets += row.quantity;
                    }
                    else if (row.type === "Refund") {
                        tickets -= row.quantity;
                    }
                });

            return {
                ...event,
                tickets,
            } as EventWithTicket;
        });
        
        //console.log(newEvents);

        const embeds = newEvents.map((event) => {
        const embed = new EmbedBuilder()
            .setTitle(event.name)
            .setDescription(event.description)
            .setURL(event.url)

        if (event.location) {
            embed.addFields({ name: 'Location', value: event.location }, { name: 'Tickets Sold', value: event.tickets.toString() });
        }


        if (!event.image.includes('/asset/Organisation/'))
        {
            embed.setThumbnail(event.image);
        }
        return embed;
    });

    // Max 10 embeds per reply
    // Send first up to 10, then send the rest in separate messages in blocks of 10
    for (let i = 0; i < embeds.length; i += 10) {
        const batch = embeds.slice(i, i + 10);
        if (i === 0) {
            await interaction.editReply({ embeds: batch });
        } else {
            await interaction.channel?.send({ embeds: batch });
        }
    }

	},
};
