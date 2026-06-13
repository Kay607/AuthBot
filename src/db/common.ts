import { eq, and, lt } from "drizzle-orm";
import { Group } from "../config";
import { db } from "../db";
import { guilds, committeeRoles, autoDeleteChannels, acceptedIds, membershipCache, credentials, admins } from "../schema";

export function getGroup(serverId: string): Group | null {
  if (!serverId) return null;

  const row = db
    .select()
    .from(guilds)
    .where(eq(guilds.serverId, serverId))
    .get();

  if (!row) return null;

  return {
    server_id: row.serverId,
    organisation_id: row.organisationId,
    name: row.name,
    member_role_id: row.memberRoleId,
    log_channel_id: row.logChannelId ?? undefined,
    committee_role_ids: getCommitteeRoleIds(row.serverId),
    auto_delete_channel_ids: getAutoDeleteChannelIds(row.serverId),
  };
}

export function getGroupByName(name: string): Group | null {
  if (!name) return null;

  const row = db
    .select()
    .from(guilds)
    .where(eq(guilds.name, name))
    .get();

  if (!row) return null;

  return {
    server_id: row.serverId,
    organisation_id: row.organisationId,
    name: row.name,
    member_role_id: row.memberRoleId,
    log_channel_id: row.logChannelId ?? undefined,
    committee_role_ids: getCommitteeRoleIds(row.serverId),
    auto_delete_channel_ids: getAutoDeleteChannelIds(row.serverId),
  };
}

export function upsertGroup(group: Group): void {
  db.transaction((tx) => {
    tx.insert(guilds)
      .values({
        serverId: group.server_id,
        organisationId: group.organisation_id,
        name: group.name,
        memberRoleId: group.member_role_id,
        logChannelId: group.log_channel_id ?? null,
      })
      .onConflictDoUpdate({
        target: guilds.serverId,
        set: {
          organisationId: group.organisation_id,
          name: group.name,
          memberRoleId: group.member_role_id,
          logChannelId: group.log_channel_id ?? null,
        },
      })
      .run();

    tx.delete(committeeRoles).where(eq(committeeRoles.serverId, group.server_id)).run();
    tx.delete(autoDeleteChannels).where(eq(autoDeleteChannels.serverId, group.server_id)).run();

    for (const roleId of group.committee_role_ids) {
      tx.insert(committeeRoles)
        .values({
          serverId: group.server_id,
          roleId,
        })
        .onConflictDoNothing()
        .run();
    }

    for (const channelId of group.auto_delete_channel_ids) {
      tx.insert(autoDeleteChannels)
        .values({
          serverId: group.server_id,
          channelId,
        })
        .onConflictDoNothing()
        .run();
    }
  });
}

export function deleteGroup(serverId: string): void {
  db.transaction((tx) => {
    tx.delete(guilds).where(eq(guilds.serverId, serverId)).run();
    tx.delete(acceptedIds).where(eq(acceptedIds.guildId, serverId)).run();
    tx.delete(membershipCache).where(eq(membershipCache.guildId, serverId)).run();
    tx.delete(committeeRoles).where(eq(committeeRoles.serverId, serverId)).run();
    tx.delete(autoDeleteChannels).where(eq(autoDeleteChannels.serverId, serverId)).run();
  });
}

export function getCredentials(discordId: string) {
  return db
    .select()
    .from(credentials)
    .where(eq(credentials.discordId, discordId))
    .get() ?? null;
}

export function upsertCredentials(
  discordId: string,
  username: string,
  password: string,
  otpCredentials?: string
): void {
  db.insert(credentials)
    .values({ discordId, username, password, otpCredentials: otpCredentials ?? null })
    .onConflictDoUpdate({
      target: credentials.discordId,
      set: { username, password, otpCredentials: otpCredentials ?? null },
    })
    .run();
}

export function deleteCredentials(discordId: string): void {
  db.delete(credentials).where(eq(credentials.discordId, discordId)).run();
}

export function pruneExpiredAdmins(): void {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  db.delete(admins)
    .where(lt(admins.timestamp, sevenDaysAgo))
    .run();
}

export function getAdmin(discordId: string) {
  pruneExpiredAdmins();
  return db
    .select()
    .from(admins)
    .where(eq(admins.discordId, discordId))
    .get() ?? null;
}

export function upsertAdmin(discordId: string): void {
  db.insert(admins)
    .values({ discordId, timestamp: new Date() })
    .onConflictDoUpdate({
      target: admins.discordId,
      set: { timestamp: new Date() },
    })
    .run();
}

export function getCommitteeRoleIds(serverId: string): string[] {
  return db
    .select({ roleId: committeeRoles.roleId })
    .from(committeeRoles)
    .where(eq(committeeRoles.serverId, serverId))
    .all()
    .map((row) => row.roleId);
}

export function getAutoDeleteChannelIds(serverId: string): string[] {
  return db
    .select({ channelId: autoDeleteChannels.channelId })
    .from(autoDeleteChannels)
    .where(eq(autoDeleteChannels.serverId, serverId))
    .all()
    .map((row) => row.channelId);
}

export function isMembershipCached(guildId: string, studentId: string): boolean {
  const row = db
    .select()
    .from(membershipCache)
    .where(
      and(
        eq(membershipCache.guildId, guildId),
        eq(membershipCache.studentId, studentId)
      )
    )
    .get();
  return !!row;
}

export function replaceMembershipCache(guildId: string, studentIds: string[]): void {
  db.transaction((tx) => {
    tx.delete(membershipCache).where(eq(membershipCache.guildId, guildId)).run();

    for (const studentId of studentIds) {
      tx.insert(membershipCache)
        .values({
          guildId,
          studentId,
        })
        .onConflictDoNothing()
        .run();
    }
  });
}

export function getAcceptedDiscordId(guildId: string, studentId: string): string | null {
  const row = db
    .select({ discordId: acceptedIds.discordId })
    .from(acceptedIds)
    .where(
      and(
        eq(acceptedIds.guildId, guildId),
        eq(acceptedIds.studentId, studentId)
      )
    )
    .get();

  return row?.discordId ?? null;
}

export function addAcceptedRecord(
  guildId: string,
  studentId: string,
  discordId: string
): void {
  db.insert(acceptedIds)
    .values({
      guildId,
      studentId,
      discordId,
    })
    .onConflictDoUpdate({
      target: [acceptedIds.guildId, acceptedIds.studentId],
      set: { discordId },
    })
    .run();
}

export function deleteAcceptedRecord(guildId: string, studentId: string): void {
  db.delete(acceptedIds)
    .where(
      and(
        eq(acceptedIds.guildId, guildId),
        eq(acceptedIds.studentId, studentId)
      )
    )
    .run();
}
