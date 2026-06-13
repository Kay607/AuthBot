import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { failServerCheck } from '../../commandUtils';
import { getEvents } from '../../events';
import { getGroup } from '../../db/common';



export default {
	data: new SlashCommandBuilder()
		.setName('events')
		.setDescription('List upcoming events'),
		
	async execute(interaction: CommandInteraction) {
		if (failServerCheck(interaction)) return;

		const guildId = interaction.guildId;
		const organisationID = getGroup(guildId)?.organisation_id;

		
		await interaction.deferReply();

		const events = await getEvents(organisationID);

		// Location may not be set
		const embeds = events.map((event) => {
			const embed = new EmbedBuilder()
				.setTitle(event.name)
				.setDescription(event.description)
				.setURL(event.url)

			if (event.location) {
				embed.addFields({ name: 'Location', value: event.location });
			}

			// Make discord time format
			const start = new Date(event.startTime);
			const end = new Date(event.endTime);

			const isMoreThan24Hours = end.getTime() - start.getTime() > 86400000;
			const isSameDay = start.getDate() === end.getDate() && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
			const extraEndRelative = isMoreThan24Hours ? `\n<t:${Math.floor(end.getTime() / 1000)}:R>` : '';
			const extraEnd = isSameDay ? ':t' : ``;
			embed.addFields({ name: 'Start', value: `<t:${Math.floor(start.getTime() / 1000)}>\n<t:${Math.floor(start.getTime() / 1000)}:R>`, inline: true });
			embed.addFields({ name: 'End', value: `<t:${Math.floor(end.getTime() / 1000)}${extraEnd}>${extraEndRelative}`, inline: true });

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
