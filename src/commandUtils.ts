import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, CommandInteraction, ComponentType, MessageComponentInteraction, MessageFlags, ModalSubmitInteraction, PermissionsBitField, Role, RoleFlags, RoleFlagsBitField, RoleSelectMenuBuilder, TextInputBuilder } from "discord.js";
import { getAcceptedDiscordId, getGroup } from "./db/common";

export function failServerCheck(interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction): Boolean {
    const guildID = interaction.guildId;
    if (!guildID) {
        interaction.reply({
            content: "This command can only be used in a server",
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    // Get the group for the server
    const group = getGroup(guildID);
    if (!group) {
        interaction.reply({
            content: "This server is not set up for the bot.",
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    const member = interaction.guild?.members.cache.get(interaction.user.id);

    if (!member) {
        interaction.reply({
            content: "You are not a member of this server. (Should never happen, contact bot maintainer)"
        });
        return true;
    }
    return false;
}

export function failStudentIDFormat(interaction: CommandInteraction | MessageComponentInteraction, student_id: string|null): Boolean {
    if (!student_id) {
        interaction.reply({
            content: "Invalid student ID",
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    if (!/^\d{6}\d?$/.test(student_id.toString())) {
        interaction.reply({
            content: "Invalid student ID",
            flags: MessageFlags.Ephemeral
        });
        return true;
    }
    return false;
}

export function failIsCommittee(interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction): Boolean {
    // Check if the user has permission
    const guildID = interaction.guildId;
    const validCommitteeRoles = getGroup(guildID)?.committee_role_ids;

    // If any roles are present, allow
    if (!validCommitteeRoles || validCommitteeRoles.length === 0) {
        interaction.reply({
            content: "No roles set up to use this command, contact bot maintainer if you are a committee member",
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    // interaction.member.roles can be either a string[] (array of role IDs) or a GuildMemberRoleManager with a cache.
    const memberRoles = (interaction.member as any)?.roles;
    let hasCommitteeRole = false;

    if (Array.isArray(memberRoles)) {
        // roles is an array of role IDs
        hasCommitteeRole = memberRoles.some((r: string) => validCommitteeRoles.includes(r));
    } else if (memberRoles && memberRoles.cache) {
        // roles is a RoleManager/GuildMemberRoleManager
        hasCommitteeRole = memberRoles.cache.some((role: any) => validCommitteeRoles.includes(role.id));
    }

    if (!hasCommitteeRole) {
        interaction.reply({
            content: "You do not have permission to use this command",
            flags: MessageFlags.Ephemeral
        });
        return true;
	}

    return false;
    
}

export function failIsAdmin(interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction): Boolean {
    
    const isAdmin = (interaction.member!.permissions as PermissionsBitField).has(PermissionsBitField.Flags.Administrator);

    if (!isAdmin) {
        interaction.reply({
            content: "You do not have permission to use this command",
            flags: MessageFlags.Ephemeral
        });
        return true;
	}

    return !isAdmin;
}

export function failMemberRoleExists(interaction: CommandInteraction | MessageComponentInteraction): Boolean {
    const guildID = interaction.guildId;
    const memberRoleID = getGroup(guildID)?.member_role_id
    if (!memberRoleID) {
        interaction.reply({
            content: "This server has no member role selected. Contact a committee member."
        });
        return true;
    }
    const memberRole = interaction.guild?.roles.cache.get(memberRoleID);
    if (!memberRole) {
        interaction.reply({
            content: "This server has no member role. Contact a committee member."
        });
        return true;
    }
    return false;
}

export function hasMemberRole(interaction: CommandInteraction | MessageComponentInteraction): Boolean {
    const guildID = interaction.guildId;
    const memberRoleID: string = getGroup(guildID)?.member_role_id;

    const member = interaction.guild?.members.cache.get(interaction.user.id);

    return member.roles.cache.has(memberRoleID);
}

export async function isStudentIDUsed(interaction: CommandInteraction | MessageComponentInteraction, student_id: string): Promise<Boolean> {
    const guildID = interaction.guildId;
    return await getAcceptedDiscordId(guildID, student_id.toString()) != null;
}

export function disableButtons(interaction: MessageComponentInteraction) {
    const newRows = interaction.message.components.map(row => {
        if (row.type !== ComponentType.ActionRow) return row;

        const actionRow = new ActionRowBuilder<ButtonBuilder>();

        row.components.forEach(component => {
            if (component.type === ComponentType.Button) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(component.customId!)
                        .setLabel((component as any).label)
                        .setStyle((component as any).style as ButtonStyle)
                        .setDisabled(true)
                );
            }
        });
        return actionRow;
    });

    interaction.message.edit({
        components: newRows
    })
}

export const componentCallbacks: Map<string, (interaction: MessageComponentInteraction|ModalSubmitInteraction) => void> = new Map();
export function addComponentCallback (component: ButtonBuilder|RoleSelectMenuBuilder|ChannelSelectMenuBuilder|TextInputBuilder, callback: (interaction: MessageComponentInteraction|ModalSubmitInteraction) => void): ButtonBuilder|RoleSelectMenuBuilder|ChannelSelectMenuBuilder|TextInputBuilder
{
    const customId = crypto.randomUUID();
    component.setCustomId(customId);
    componentCallbacks.set(customId, callback);
    return component;
}
