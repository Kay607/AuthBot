import { SlashCommandBuilder, CommandInteraction, MessageFlags } from 'discord.js';
import { failIsCommittee, failServerCheck, failStudentIDFormat } from '../../commandUtils';
import { logToChannel } from '../../logging';
import { BANNED_MEMBERS } from '../../config';
import { isStudentIDMember } from '../../studentIDHandler';

export default {
    data: new SlashCommandBuilder()
        .setName('test-id')
        .setDescription('[Committee Only] Manually test if a student ID has a membership')
        .addNumberOption(option => option.setName("student_id")
			.setDescription("Student ID")
			.setRequired(true)),
        
    async execute(interaction: CommandInteraction) {

        if (failServerCheck(interaction)) return;
        if (failIsCommittee(interaction)) return;

        const guildID = interaction.guildId;

        const student_id = (interaction as any).options.get('student_id')?.value;
        if (failStudentIDFormat(interaction, student_id)) return;

        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const idIsMember = await isStudentIDMember(student_id.toString(), guildID, () => {
            logToChannel(guildID, false, `[Refresh Cache] For user: ${interaction.user.username} (${interaction.user.displayName})`);
        });
        
        
        if (BANNED_MEMBERS.has(student_id)) {
            interaction.editReply({
                content: "This student is banned"
            });
            return;
        }

    
        if (idIsMember)
        {
            interaction.editReply({
                content: "This student is a member"
            });
            return;
        }

        interaction.editReply({
            content: "This student is not a member"
        });
        
    },
};
