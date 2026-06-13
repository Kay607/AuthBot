import { CommandInteraction, MessageComponentInteraction, ModalSubmitInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ChannelType } from "discord.js";
import { failIsAdmin } from "./commandUtils";
import { Group, lastSettingsPanel, SettingsPanel, TemporaryGroup } from "./config";
import { getGroup, upsertGroup } from "./db/common";

const tempGroups: Map<string, TemporaryGroup> = new Map();

export const setCurrentAddEditPanel = async (interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction, settingsPanel: SettingsPanel) => {
    let tempGroup: TemporaryGroup;

    const previousGroup: Group = getGroup(interaction.guildId);
    const hasTempGroupAlready = Array.from(tempGroups.values()).find((tempGroup) => tempGroup.server_id == interaction.guildId);
    if (previousGroup && !hasTempGroupAlready) {
        tempGroup = {
            settingsPanel: settingsPanel,
            ...previousGroup
        }
    }
    else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        tempGroup = tempGroups.get((interaction as MessageComponentInteraction).message.id);
        tempGroup.settingsPanel = settingsPanel;
    }
    else {
        tempGroup = {
            settingsPanel: settingsPanel,
            name: "",
            member_role_id: "",
            committee_role_ids: [],
            auto_delete_channel_ids: [],
            server_id: interaction.guildId,
        }


    }

    let embed;
    let buttons = [];
    let rows = [];
    let canGoForward = false;

    switch (settingsPanel) {
        case SettingsPanel.NAME:
            {
                //console.log(tempGroup);
                canGoForward = tempGroup.name != null;
                embed = new EmbedBuilder()
                    .setTitle('Name')
                    .setDescription(`What would you like to name this server?\nCurrent: \`${tempGroup.name || 'None'}\``);

                buttons = [
                    new ButtonBuilder()
                        .setCustomId('add-server-edit-name')
                        .setLabel('Edit')
                        .setStyle(ButtonStyle.Success)
                ];
            }
            break;

        case SettingsPanel.ORGANISATION_ID:
            {
                //console.log(tempGroup);
                canGoForward = tempGroup.name != null;
                embed = new EmbedBuilder()
                    .setTitle('Organisation ID')
                    .setDescription(`What is the Guild of Students Organisation ID?\nGo to the admin page an check the URL. Eg. https://www.guildofstudents.com/organisation/admin/[ORGANISATION_ID]/\nCurrent: \`${tempGroup.organisation_id || 'None'}\``);

                buttons = [
                    new ButtonBuilder()
                        .setCustomId('add-server-edit-organisationid')
                        .setLabel('Edit')
                        .setStyle(ButtonStyle.Success)
                ];
            }
            break;

        case SettingsPanel.MEMBER_ROLE:
            {
                canGoForward = tempGroup.member_role_id != undefined;

                if (interaction.isCommand()) return;

                embed = new EmbedBuilder()
                    .setTitle('Member Role')
                    .setDescription(`Which role would you like to set as the member role?\nCurrent: ${tempGroup.member_role_id ? `<@&${tempGroup.member_role_id}>` : '`None`'}`);

                const roleId = tempGroup.member_role_id;
                rows = [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                    new RoleSelectMenuBuilder()
                        .setCustomId('add-server-edit-member-role-role')
                        .setPlaceholder('Choose member role')
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setDefaultRoles(roleId ? [roleId] : [])
                )];
            }
            break;

        case SettingsPanel.COMMITTEE_ROLES:
            {
                canGoForward = tempGroup.committee_role_ids.length > 0;

                if (interaction.isCommand()) return;

                const rolesText = tempGroup.committee_role_ids.length === 0 ? '`None`' : tempGroup.committee_role_ids.map((id) => `<@&${id}>`).join('\n');
                embed = new EmbedBuilder()
                    .setTitle('Committee Roles')
                    .setDescription(`Which roles would you like to set as the committee roles?\nCurrent:\n${rolesText}`);

                rows = [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                    new RoleSelectMenuBuilder()
                        .setCustomId('add-server-edit-committee-roles-roles')
                        .setPlaceholder('Choose committee roles')
                        .setMinValues(1)
                        .setMaxValues(25)
                        .setDefaultRoles(tempGroups.get(interaction.message.id)!.committee_role_ids)
                )];

            }
            break;

        case SettingsPanel.AUTO_DELETE_CHANNELS:
            {
                canGoForward = true;

                if (interaction.isCommand()) return;

                const rolesText = tempGroup.auto_delete_channel_ids.length === 0 ? '`None`' : tempGroup.auto_delete_channel_ids.map((id) => `<#${id}>`).join('\n');
                embed = new EmbedBuilder()
                    .setTitle('Auto Delete Channels')
                    .setDescription(`Set up channels to auto delete messages sent by non-committee users.\nCurrent:\n${rolesText}`);

                rows = [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('add-server-edit-autodelete-channels-channels')
                        .setPlaceholder('Choose auto delete channels')
                        .setMinValues(1)
                        .setMaxValues(25)
                        .setChannelTypes(ChannelType.GuildText)
                        .setDefaultChannels(tempGroups.get(interaction.message.id)!.auto_delete_channel_ids)
                )];
            }
            break;

        case SettingsPanel.LOG_CHANNEL:
            {
                canGoForward = true;

                if (interaction.isCommand()) return;

                const rolesText = tempGroup.log_channel_id ? `<#${tempGroup.log_channel_id}>` : '`None`';
                embed = new EmbedBuilder()
                    .setTitle('Log Channel')
                    .setDescription(`Set up a channel to log information from this bot to.\nCurrent:\n${rolesText}`);

                const logChannel = tempGroups.get(interaction.message.id)!.log_channel_id
                rows = [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('add-server-edit-log-channel-channel')
                        .setPlaceholder('Choose log channel')
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setDefaultChannels(logChannel ? [logChannel] : [])
                )];
            }
            break;


        default:
            canGoForward = false;
            embed = new EmbedBuilder();
            break;

    }

    const isLast = settingsPanel == lastSettingsPanel;

    const data = {
        embeds: [embed],
        components: [
            ...rows,
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('add-server-leftarrow')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(settingsPanel == SettingsPanel.NAME),
                ...buttons,

                (!isLast || interaction.isCommand()) ? new ButtonBuilder()
                    .setCustomId('add-server-rightarrow')
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!canGoForward)
                    :
                    new ButtonBuilder()
                        .setCustomId('add-server-submit')
                        .setLabel('Submit')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(tempGroups.get(interaction.message.id).log_channel_id === undefined)
            )
        ]
    };

    const isCommand = interaction.isChatInputCommand();

    if (isCommand) {
        await interaction.reply(data);
        const message = await interaction.fetchReply();

        tempGroups.set(message.id, tempGroup);
        return;
    }
    else if (interaction.deferred || interaction.replied) {
        interaction.editReply(data);
        return;
    }
    else {
        if (!interaction.isMessageComponent()) return;
        await interaction.message.edit(data);
    }
};

export const addEditButtonCallback = async (interaction: MessageComponentInteraction | ModalSubmitInteraction) => {

    if (failIsAdmin(interaction)) return;

    console.log(interaction.customId);
    console.log(tempGroups);
    console.log(interaction.message.id);
    if (interaction.customId === 'add-server-rightarrow' || interaction.customId === 'edit-server-rightarrowd') {
        interaction.deferUpdate();
        await setCurrentAddEditPanel(interaction, tempGroups.get(interaction.message.id)!.settingsPanel + 1);
        return;
    }
    else if (interaction.customId === 'add-server-leftarrow' || interaction.customId === 'edit-server-leftarrow') {
        interaction.deferUpdate();
        await setCurrentAddEditPanel(interaction, tempGroups.get(interaction.message.id)!.settingsPanel - 1);
        return;
    }
    else if (interaction.customId === 'add-server-edit-name') {
        // Show modal to take input of name, with the current name as the default
        if (!interaction.isMessageComponent()) return;

        const modal = new ModalBuilder()
            .setCustomId('add-server-edit-name-modal')
            .setTitle('Name')
            .addComponents(
                new TextInputBuilder()
                    .setCustomId('add-server-edit-name-modal-name')
                    .setLabel('Name')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(tempGroups.get(interaction.message.id)!.name)
            );

        await interaction.showModal(modal);
        return;
    }
    else if (interaction.customId === 'add-server-edit-name-modal') {
        //console.log(interaction);
        // console.log("Modal submittttt :3");
        if (!interaction.isModalSubmit()) return;
        await interaction.deferUpdate();

        const name = interaction.fields.getTextInputValue('add-server-edit-name-modal-name');
        tempGroups.get(interaction.message.id)!.name = name;
        await setCurrentAddEditPanel(interaction, tempGroups.get(interaction.message.id)!.settingsPanel);
        return;
    }
    else if (interaction.customId === 'add-server-edit-organisationid') {
        // Show modal to take input of name, with the current name as the default
        if (!interaction.isMessageComponent()) return;

        const modal = new ModalBuilder()
            .setCustomId('add-server-edit-organisationid-modal')
            .setTitle('Organisation ID')
            .addComponents(
                new TextInputBuilder()
                    .setCustomId('add-server-edit-organisationid-modal-id')
                    .setLabel('Organisation ID')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(tempGroups.get(interaction.message.id)!.organisation_id ?? '')
            );

        await interaction.showModal(modal);
        return;
    }
    else if (interaction.customId === 'add-server-edit-organisationid-modal') {
        if (!interaction.isModalSubmit()) return;
        await interaction.deferUpdate();

        const orgid = interaction.fields.getTextInputValue('add-server-edit-organisationid-modal-id');
        tempGroups.get(interaction.message.id)!.organisation_id = orgid;
        await setCurrentAddEditPanel(interaction, tempGroups.get(interaction.message.id)!.settingsPanel);
        return;
    }
    else if (interaction.customId === 'add-server-edit-member-role') {
        // Show modal to take input of role ID
        if (!interaction.isMessageComponent()) return;

        const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('add-server-edit-member-role-role')
                .setPlaceholder('Choose a role')
                .setMinValues(1)
                .setMaxValues(1)
                .setDefaultRoles([tempGroups.get(interaction.message.id)!.member_role_id])
        );

        interaction.message.edit({
            components: [row1]
        });

        return;
    }
    else if (interaction.customId === 'add-server-edit-member-role-role') {
        await interaction.deferUpdate();

        if (!interaction.isRoleSelectMenu()) return;

        const role = interaction.values[0];

        if (!role) {
            // Send empheral message
            await interaction.followUp({
                content: 'No role selected',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        tempGroups.get(interaction.message.id)!.member_role_id = role;
        await setCurrentAddEditPanel(interaction, tempGroups.get(interaction.message.id)!.settingsPanel);
    }
    else if (interaction.customId === 'add-server-edit-committee-roles-roles') {
        //console.log(interaction);
        await interaction.deferUpdate();

        if (!interaction.isRoleSelectMenu()) return;

        const roles = interaction.values;

        if (!roles) {
            // Send empheral message
            await interaction.followUp({
                content: 'No roles selected',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        tempGroups.get(interaction.message.id)!.committee_role_ids = roles;
        await setCurrentAddEditPanel(interaction, tempGroups.get(interaction.message.id)!.settingsPanel);

        return;
    }
    else if (interaction.customId === 'add-server-edit-autodelete-channels-channels') {
        if (!interaction.isChannelSelectMenu()) return;

        //console.log(interaction);
        await interaction.deferUpdate();

        const channels = interaction.values;
        if (!channels) {
            // Send empheral message
            await interaction.followUp({
                content: 'No channels selected',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        tempGroups.get(interaction.message.id)!.auto_delete_channel_ids = channels;
        await setCurrentAddEditPanel(interaction, tempGroups.get(interaction.message.id)!.settingsPanel);
    }
    else if (interaction.customId === 'add-server-edit-log-channel-channel') {
        if (!interaction.isChannelSelectMenu()) return;

        await interaction.deferUpdate();

        const channel = interaction.values[0];
        if (!channel) {
            // Send empheral message
            await interaction.followUp({
                content: 'No channel selected',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        tempGroups.get(interaction.message.id)!.log_channel_id = channel;
        await setCurrentAddEditPanel(interaction, tempGroups.get(interaction.message.id)!.settingsPanel);
    }
    else if (interaction.customId === 'add-server-submit') {
        await interaction.deferUpdate();

        const tempGroup = tempGroups.get(interaction.message.id)!;
        const permanentGroup: Group = {
            server_id: interaction.guildId!,
            name: tempGroup.name,
            member_role_id: tempGroup.member_role_id,
            committee_role_ids: tempGroup.committee_role_ids,
            auto_delete_channel_ids: tempGroup.auto_delete_channel_ids,
            log_channel_id: tempGroup.log_channel_id,
            organisation_id: tempGroup.organisation_id,
        };

        upsertGroup(permanentGroup);

        // Remove temp group
        tempGroups.delete(interaction.message.id);


        await interaction.editReply({
            content: "Server updated successfully! To change settings, use the /editserver command.",
            embeds: [],
            components: []
        });
    }
};
