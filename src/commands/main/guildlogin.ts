import { SlashCommandBuilder, CommandInteraction, MessageFlags } from 'discord.js';
import { guildLogin } from '../../guildLoginHandler';
import { logToChannel } from '../../logging';
import { failIsCommittee, failServerCheck } from '../../commandUtils';
import { upsertAdmin } from '../../db/common';

export default {
	data: new SlashCommandBuilder()
		.setName('guildlogin')
		.setDescription('[Committee Only] Log in to the guild website to allow members to use the bot'),

	async execute(interaction: CommandInteraction) {

		if (failServerCheck(interaction)) return;
		if (failIsCommittee(interaction)) return;

		const guildID = interaction.guildId;


		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const loginResult = await guildLogin(interaction.user.id, (url) => {
			interaction.editReply({
				content: `Please log in:\n${url}`,
			});
		});

		if (loginResult) {
			interaction.editReply({
				content: 'Guild login successful',
			});

			upsertAdmin(interaction.user.id);
			logToChannel(guildID, false, `[Guild Login] ${interaction.user.username} (${interaction.user.displayName})`);
		}
		else {
			interaction.editReply({
				content: 'Guild login failed\nThis could be because you closed the browser or took too long (> 5 minutes)\nThis command is very complex, please contact the bot maintainer if you are having issues',
			});
		}



	},
};
