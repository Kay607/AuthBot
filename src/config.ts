export const clientId = "1437764613750915075";

export const token = process.env.BOT_TOKEN || "";
export const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN || "";

export const TUNEL_TYPE = TunnelType.NGROK;

export const BANNED_MEMBERS = new Set<number>([3006885]);

export const Prefix = "?";

export const enum TunnelType {
    NGROK = 0,
    EXPOSE = 1
}

export const enum SettingsPanel {
    NAME = 0,
    ORGANISATION_ID = 1,
    MEMBER_ROLE = 2,
    COMMITTEE_ROLES = 3,
    AUTO_DELETE_CHANNELS = 4,
    LOG_CHANNEL = 5
}

export const lastSettingsPanel = SettingsPanel.LOG_CHANNEL;

export interface TemporaryGroup {

    settingsPanel: SettingsPanel;
    // Used for readability, no actual functionality (can be anything)
    name?: string;

    // Discord server/guild id
    server_id: string;

    // Discord role id for the member role that will be given when authenticated
    member_role_id?: string;

    // Discord role ids for the committee roles (these are users with permission to reset student ID usage)
    committee_role_ids?: string[];

    // Organisation id used by the guild
    // https://www.guildofstudents.com/organisation/admin/<ORGANISATION_ID>/
    organisation_id?: string;

    // Messages in this channel will be deleted automatically if not sent by committee
    // Send message must be on for people to run commands, but this stops them talking in the channel
    auto_delete_channel_ids: string[];

    // Discord channel id for logging
    log_channel_id?: string;

}

export interface Group {
    // Used for readability, no actual functionality (can be anything)
    name: string;

    // Discord server/guild id
    server_id: string;

    // Discord role id for the member role that will be given when authenticated
    member_role_id: string;

    // Discord role ids for the committee roles (these are users with permission to reset student ID usage)
    committee_role_ids: string[];

    // Organisation id used by the guild
    // https://www.guildofstudents.com/organisation/admin/<ORGANISATION_ID>/
    organisation_id: string;

    // Messages in this channel will be deleted automatically if not sent by committee
    // Send message must be on for people to run commands, but this stops them talking in the channel
    auto_delete_channel_ids: string[];

    // Discord channel id for logging
    log_channel_id?: string;

}

