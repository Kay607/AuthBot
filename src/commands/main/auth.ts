import { SlashCommandBuilder, CommandInteraction, MessageFlags, Role } from 'discord.js';
import { BANNED_MEMBERS } from '../../config';
import { isStudentIDMember } from '../../studentIDHandler';
import { logToChannel } from '../../logging';
import { failMemberRoleExists, failServerCheck, failStudentIDFormat, hasMemberRole, isStudentIDUsed } from '../../commandUtils';
import { addAcceptedRecord, deleteAcceptedRecord, getAcceptedDiscordId, getGroup } from '../../db/common';

export default {
	data: new SlashCommandBuilder()
		.setName('auth')
		.setDescription('Authenticate student ID')
		.addNumberOption(option => option.setName("student_id")
			.setDescription("Student ID")
			.setRequired(true)),
		
	async execute(interaction: CommandInteraction) {

		
		if (failServerCheck(interaction)) return;

		const student_id = (interaction as any).options.get('student_id')?.value;
		if (failStudentIDFormat(interaction, student_id)) return;

		const guildID = interaction.guildId;


		if (failMemberRoleExists(interaction)) return;


		const memberRoleID: string = getGroup(guildID)?.member_role_id;
		
		
		
		const memberRole: Role = interaction.guild?.roles.cache.get(memberRoleID);

		const member = interaction.guild?.members.cache.get(interaction.user.id);


		if (hasMemberRole(interaction)) {
			interaction.reply({
				content: "You already have the member role.",
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Check if studentid is already used
		if (await isStudentIDUsed(interaction, student_id.toString())) {

			// Get id of person who has this student id
			const userID = await getAcceptedDiscordId(guildID, student_id.toString());

			// Check if the user is still in the server
			const user = interaction.guild?.members.cache.get(userID);


			if (userID == interaction.user.id || !user) {
				// Clear cache of this student id
				await deleteAcceptedRecord(guildID, student_id.toString());
			}
			else
			{
				interaction.reply({
					content: "This student ID is already used. Contact a committee member.",
					flags: MessageFlags.Ephemeral
				});
				logToChannel(guildID, false, `[Authentication Rejected] ID already used (${student_id.toString()}). For user: ${interaction.user.username} (${interaction.user.displayName})`);

				return;
			}
		}

		await interaction.deferReply({flags: MessageFlags.Ephemeral});

		let idIsMember = await isStudentIDMember(student_id.toString(), guildID, () => {
			logToChannel(guildID, false, `[Refresh Cache] For user: ${interaction.user.username} (${interaction.user.displayName})`);
		});


		if (BANNED_MEMBERS.has(student_id)) {
			idIsMember = false;
			logToChannel(guildID, false, `[Authentication Rejected] <@685847668282359855> Banned member (${student_id.toString()}). For user: ${interaction.user.username} (${interaction.user.displayName})`);
		}

		if (!idIsMember) {
			interaction.editReply({
				content: "You are not a member of this society."
			});
			logToChannel(guildID, false, `[Authentication Rejected] Not a member (${student_id.toString()}). For user: ${interaction.user.username} (${interaction.user.displayName})`);

			return;
		}


		// Add user to registered members
		addAcceptedRecord(guildID, student_id.toString(), interaction.user.id);

		member.roles.add(memberRole);

		interaction.editReply({
			content: "You have been authenticated."
		});
		logToChannel(guildID, false, `[Authenticated] ${interaction.user.username} (${interaction.user.displayName}) - ${student_id.toString()}`);
		

		console.log(student_id);
	},
};
