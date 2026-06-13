import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { failIsAdmin } from '../../commandUtils';
import { SettingsPanel } from '../../config';
import { addEditButtonCallback, setCurrentAddEditPanel } from '../../addEditServer';
import { getGroup } from '../../db/common';



export default {
	data: new SlashCommandBuilder()
		.setName('add-server')
		.setDescription('[Admin Only] Add this server to the bot\'s managed servers'),

	async execute(interaction: CommandInteraction) {

		if (failIsAdmin(interaction)) return;

        const existsAlready = getGroup(interaction.guildId);
        if (existsAlready) {
            await interaction.reply({
                content: "This server is already set up for the bot. To change settings, use the edit command.",
            });

            return;
        }

    
        await setCurrentAddEditPanel(interaction, SettingsPanel.NAME);

    },

    buttonCallback: addEditButtonCallback

    
};
