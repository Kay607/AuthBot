import { SlashCommandBuilder, CommandInteraction, MessageFlags } from 'discord.js';
import { updateMembersList } from '../../studentIDHandler';
import { failIsCommittee, failServerCheck } from '../../commandUtils';

export default {
	data: new SlashCommandBuilder()
		.setName('refreshcache')
		.setDescription('[Committee Only] Manually refresh the cache'),
		
	async execute(interaction: CommandInteraction) {

		if (failServerCheck(interaction)) return;
		if (failIsCommittee(interaction)) return;

		const guildID = interaction.guildId;

		
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		await updateMembersList(guildID);

		interaction.editReply({
			content: "Cache refreshed"
		});
	},
};