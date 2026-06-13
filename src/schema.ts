import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";


export const guilds = sqliteTable("guilds", {
  serverId: text("server_id").primaryKey(),

  organisationId: text("organisation_id")
    .unique()
    .notNull(),

  name: text("name").notNull(),
  memberRoleId: text("member_role_id").notNull(),

  logChannelId: text("log_channel_id"),
});

export const credentials = sqliteTable("credentials", {
  discordId: text("discord_id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  otpCredentials: text("otp_credentials_b64"),
});

export const admins = sqliteTable("admins", {
  discordId: text("discord_id").primaryKey(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
});


export const committeeRoles = sqliteTable(
  "committee_roles",
  {
    serverId: text("server_id").notNull(),
    roleId: text("role_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.serverId, t.roleId] }),
  })
);

export const autoDeleteChannels = sqliteTable(
  "auto_delete_channels",
  {
    serverId: text("server_id").notNull(),
    channelId: text("channel_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.serverId, t.channelId] }),
  })
);

export const acceptedIds = sqliteTable(
  "accepted_ids",
  {
    guildId: text("guild_id").notNull(),
    studentId: text("student_id").notNull(),
    discordId: text("discord_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.guildId, t.studentId] }),
  })
);

export const membershipCache = sqliteTable(
  "membership_cache",
  {
    guildId: text("guild_id").notNull(),
    studentId: text("student_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.guildId, t.studentId] }),
  })
);

