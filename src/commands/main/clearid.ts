import { SlashCommandBuilder, CommandInteraction, MessageFlags } from 'discord.js';
import { failIsCommittee, failServerCheck, failStudentIDFormat, isStudentIDUsed } from '../../commandUtils';
import { deleteAcceptedRecord } from '../../db/common';

export default {
	data: new SlashCommandBuilder()
		.setName('clearid')
		.setDescription('[Committee Only] Clear usage of a student id')
		.addNumberOption(option => option.setName("student_id")
			.setDescription("Student ID")
			.setRequired(true)),
		
	async execute(interaction: CommandInteraction) {
		if(failIsCommittee(interaction)) return;
		if(failServerCheck(interaction)) return;

		const student_id = (interaction as any).options.get('student_id')?.value;
		if(failStudentIDFormat(interaction, student_id)) return;

		const guildID = interaction.guildId;

		// Check if it's in use already
		if (!(await isStudentIDUsed(interaction, student_id))) {
			interaction.reply({
				content: "This student ID is not in use, cannot clear",
				flags: MessageFlags.Ephemeral
			});
			return;
		}


		deleteAcceptedRecord(guildID, student_id.toString());
		interaction.reply({
			content: "Cleared student ID",
			flags: MessageFlags.Ephemeral
		});

	},
};
