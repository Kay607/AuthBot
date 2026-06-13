import {
  SlashCommandBuilder,
  CommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';

import { failIsCommittee } from '../../commandUtils';
import { deleteCredentials, getCredentials, upsertCredentials } from '../../db/common';

/* ---------------- SESSION ---------------- */

type Session = {
  username?: string;
  password?: string;
  otpCredentials?: string;
};

const sessionCache: Record<string, Session> = {};

/* ---------------- UI ---------------- */

function buildUI(data: Session) {
  return {
    content: [
      `**Email:** ${data.username ?? 'Not set'}`,
      `**Password:** ${data.password ? 'Set' : 'Not set'}`,
      `**OTP:** ${data.otpCredentials ? 'Set' : 'Not set'}`,
      '',
      'Nothing is saved until Submit.',
    ].join('\n'),

    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('committee-credentials-edit_email')
          .setLabel('Edit Email')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('committee-credentials-set_password')
          .setLabel('Set Password')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('committee-credentials-setup_otp')
          .setLabel('Setup OTP')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('committee-credentials-delete')
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId('committee-credentials-submit')
          .setLabel('Submit')
          .setStyle(ButtonStyle.Success),
      ),
    ],
  };
}

/* ---------------- COMMAND ---------------- */

export default {
  data: new SlashCommandBuilder()
    .setName('committee-credentials')
    .setDescription('[Committee Only] Manage credentials'),

  async execute(interaction: CommandInteraction) {
    if (failIsCommittee(interaction)) return;

    const userId = interaction.user.id;

    const db = getCredentials(userId);

    sessionCache[userId] = {
      username: db?.username,
      otpCredentials: db?.otpCredentials ?? undefined,
      password: db?.password ?? undefined,
    };

    await interaction.reply({
      ...buildUI(sessionCache[userId]),
      flags: MessageFlags.Ephemeral
    });
  },

  buttonCallback: handleInteraction,
};

/* ---------------- HANDLER ---------------- */

async function handleInteraction(interaction: Interaction) {
  const userId = interaction.user.id;
  const data = sessionCache[userId] ?? (sessionCache[userId] = {});

  /* ---------------- BUTTONS ---------------- */

  if (interaction.isButton()) {
    switch (interaction.customId) {

      case 'committee-credentials-delete': {
        deleteCredentials(userId);

        delete sessionCache[userId];

        return interaction.update({
            content: 'Credentials deleted.',
            components: [],
        });
      }

      /* EMAIL */
      case 'committee-credentials-edit_email': {
        const modal = new ModalBuilder()
          .setCustomId('committee-credentials-modal_email')
          .setTitle('Edit Email');

        const input = new TextInputBuilder()
          .setCustomId('email')
          .setLabel('Email')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(data.username ?? '');

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      /* PASSWORD */
      case 'committee-credentials-set_password': {
        const modal = new ModalBuilder()
          .setCustomId('committee-credentials-modal_password')
          .setTitle('Set Password');

        const input = new TextInputBuilder()
          .setCustomId('password')
          .setLabel('Password')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      /* OTP MENU */
      case 'committee-credentials-setup_otp': {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('committee-credentials-otp_text')
            .setLabel('Enter OTP Secret')
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId('committee-credentials-otp_image')
            .setLabel('Paste OTP Image URL')
            .setStyle(ButtonStyle.Secondary),
        );

        return interaction.reply({
          content: 'Choose OTP method:',
          components: [row],
          flags: MessageFlags.Ephemeral
        });
      }

      /* OTP TEXT */
      case 'committee-credentials-otp_text': {
        const modal = new ModalBuilder()
          .setCustomId('committee-credentials-modal_otp')
          .setTitle('OTP Secret');

        const input = new TextInputBuilder()
          .setCustomId('otp')
          .setLabel('OTP Secret')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(data.otpCredentials ?? '');

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      /* OTP IMAGE URL */
      case 'committee-credentials-otp_image': {
        const modal = new ModalBuilder()
          .setCustomId('committee-credentials-modal_otp_image')
          .setTitle('OTP Image URL');

        const input = new TextInputBuilder()
          .setCustomId('otp_image')
          .setLabel('Image URL')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      /* SUBMIT */
      case 'committee-credentials-submit': {
        const existing = getCredentials(userId);

        const finalUsername = data.username ?? existing?.username;
        const finalPassword = data.password ?? existing?.password;
        const finalOtp = data.otpCredentials ?? existing?.otpCredentials;

        if (!finalUsername || !finalPassword || !finalOtp) {
          return interaction.update({
            ...buildUI(data),
            content:
              'Email, password, and OTP are required before submitting.',
          });
        }

        upsertCredentials(
          userId,
          finalUsername,
          finalPassword,
          finalOtp
        );

        delete sessionCache[userId];

        return interaction.update({
          content: 'Credentials saved successfully.',
          components: [],
        });
      }
    }
  }

  /* ---------------- MODALS ---------------- */

  if (interaction.isModalSubmit()) {
    switch (interaction.customId) {

      case 'committee-credentials-modal_email': {
        data.username = interaction.fields.getTextInputValue('email');
        await interaction.deferUpdate();
        await interaction.message?.edit(buildUI(data));
        return;
      }

      case 'committee-credentials-modal_password': {
        data.password = interaction.fields.getTextInputValue('password');
        await interaction.deferUpdate();
        await interaction.message?.edit(buildUI(data));
        return;
      }

      case 'committee-credentials-modal_otp': {
        data.otpCredentials = interaction.fields.getTextInputValue('otp');
        await interaction.deferUpdate();
        await interaction.message?.edit(buildUI(data));
        return;
      }

      case 'committee-credentials-modal_otp_image': {
        data.otpCredentials = interaction.fields.getTextInputValue('otp_image');
        await interaction.deferUpdate();
        await interaction.message?.edit(buildUI(data));
        return;
      }
    }
  }
}