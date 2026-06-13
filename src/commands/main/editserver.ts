import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { failIsAdmin } from '../../commandUtils';
import { SettingsPanel } from '../../config';
import { addEditButtonCallback, setCurrentAddEditPanel } from '../../addEditServer';
import { getGroup } from '../../db/common';



export default {
	data: new SlashCommandBuilder()
		.setName('edit-server')
		.setDescription('[Admin Only] Edit this server\'s settings'),


	async execute(interaction: CommandInteraction) {

		if (failIsAdmin(interaction)) return;

        const existsAlready = getGroup(interaction.guildId);
        if (!existsAlready) {
            await interaction.reply({
                content: "This server is not set up for the bot. To add it, use the /addserver command.",
            });
        }

    
        await setCurrentAddEditPanel(interaction, SettingsPanel.NAME);

    },

    buttonCallback: addEditButtonCallback

    
};
