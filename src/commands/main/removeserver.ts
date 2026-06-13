import { SlashCommandBuilder, CommandInteraction, MessageFlags, ButtonBuilder, ActionRowBuilder, ButtonStyle, Interaction, CacheType, MessageComponent, MessageComponentInteraction, ComponentType, Embed, EmbedBuilder } from 'discord.js';
import { disableButtons, failIsCommittee, failServerCheck } from '../../commandUtils';
import { deleteGroup } from '../../db/common';

const removeConfirmations: Map<string, Set<string>> = new Map();
const canceledRemovals: Array<string> = [];

export default {
	data: new SlashCommandBuilder()
		.setName('remove-server')
		.setDescription('[Committee Only] Remove this server from the bot\'s managed servers'),
		
	async execute(interaction: CommandInteraction) {

		if (failServerCheck(interaction)) return;
		if (failIsCommittee(interaction)) return;
        
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Remove Server")
                    .setDescription("You are about to remove this server from the bot\'s managed servers. Are you sure you want to do this? **(Requires 2 committee members to confirm)**")
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId("remove-server-cancel")
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId("remove-server-confirm")
                        .setLabel('Confirm')
                        .setStyle(ButtonStyle.Danger)
                )
            ]
        });
    },

    async buttonCallback(interaction: MessageComponentInteraction) {

        if (failServerCheck(interaction)) return;
        if (failIsCommittee(interaction)) return;

        if (canceledRemovals.includes(interaction.message.id)) {
            interaction.reply({
                content: 'This request has been cancelled already',
            })
            return;
        }

        if (interaction.customId === 'remove-server-cancel') {
            canceledRemovals.push(interaction.message.id);
            interaction.reply({
                content: 'Cancelled',
                flags: MessageFlags.Ephemeral
            })

            // Make the buttons not clickable
            disableButtons(interaction);
            return;
        }

        const hasAlreadyConfirmed = removeConfirmations.has(interaction.message.id) && removeConfirmations.get(interaction.message.id)!.has(interaction.user.id);
        if (hasAlreadyConfirmed) {
            interaction.reply({
                content: 'You have already confirmed',
                flags: MessageFlags.Ephemeral
            })
            return;
        }


        if (!removeConfirmations.has(interaction.message.id)) {
            removeConfirmations.set(interaction.message.id, new Set([interaction.user.id]));
        } else {
            removeConfirmations.get(interaction.message.id)!.add(interaction.user.id);
        }

        const confirmations = removeConfirmations.get(interaction.message.id);



        const requiredNumber = 2;
        const hasEnough = confirmations.size == requiredNumber;

        const message = hasEnough ? `Confirmed by ${interaction.user.username}` : `Confirmed by ${interaction.user.username}, ${requiredNumber - confirmations.size} more required`;
        interaction.reply({
            content: message
        })

        if (!hasEnough) return;

        interaction.reply({
            content: "Removing this server from the bot's managed servers"
        });

        deleteGroup(interaction.guildId);
    }
};
