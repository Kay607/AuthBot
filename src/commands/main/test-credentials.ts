import { SlashCommandBuilder, CommandInteraction, MessageFlags } from 'discord.js';
import { failIsCommittee, failServerCheck } from '../../commandUtils';
import { refreshToken, RefreshTokenStatus } from '../../guildHandler';
import { getAdminDiscordId } from '../../credentials';

export default {
	data: new SlashCommandBuilder()
		.setName('test-credentials')
		.setDescription('[Committee Only] Manually test if the committee account credentials are valid'),
		
	async execute(interaction: CommandInteraction) {

		if (failServerCheck(interaction)) return;
		if (failIsCommittee(interaction)) return;

		
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const credUserId = await getAdminDiscordId(interaction.guildId);
		const result: RefreshTokenStatus = await refreshToken(credUserId);

		let message;
		switch (result) {
			case RefreshTokenStatus.REFRESHED:
				message = 'Credentials are valid';
				break;
			case RefreshTokenStatus.REQUIRE_AUTHENTICATOR:
				message = 'Credentials require authenticator, rerun /guildlogin';
			case RefreshTokenStatus.NOT_REFRESHED:
				message = 'Credentials are invalid, rerun /guildlogin';
				break;
		}

		interaction.editReply({
			content: message 
		});
	},
};
