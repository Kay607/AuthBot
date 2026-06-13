import fs from "fs";
import path from "path";
import { db } from "./db";
import { guilds, committeeRoles, autoDeleteChannels, acceptedIds, membershipCache } from "./schema";

interface SocietyData {
  registeredMembers?: Record<string, string>;
  acceptedIDs?: string[];
}

interface GroupData {
  server_id: string;
  name: string;
  member_role_id: string;
  committee_role_ids?: string[];
  auto_delete_channel_ids?: string[];
  log_channel_id?: string;
  organisation_id: string;
  manager_id: string;
}

interface DataJson {
  societies?: Record<string, SocietyData>;
  groups?: GroupData[];
}

function main() {
  let inputPath = "data.json";
  let clear = false;

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--input" && i + 1 < process.argv.length) {
      inputPath = process.argv[i + 1];
      i++;
    } else if (process.argv[i] === "--clear") {
      clear = true;
    }
  }

  const resolvedInputPath = path.resolve(inputPath);

  console.log(`Input file: ${resolvedInputPath}`);
  console.log(`Clearing existing data: ${clear}`);

  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`Missing file: ${resolvedInputPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(resolvedInputPath, "utf-8");
  const data: DataJson = JSON.parse(rawData);

  const stats = db.transaction((tx) => {
    let groupsImported = 0;
    let committeeRolesImported = 0;
    let autoDeleteChannelsImported = 0;
    let acceptedIdsImported = 0;
    let membershipCacheImported = 0;

    if (clear) {
      console.log("Clearing existing tables...");
      tx.delete(guilds).run();
      tx.delete(committeeRoles).run();
      tx.delete(autoDeleteChannels).run();
      tx.delete(acceptedIds).run();
      tx.delete(membershipCache).run();
    }

    if (data.groups) {
      for (const group of data.groups) {
        tx.insert(guilds)
          .values({
            serverId: group.server_id,
            organisationId: group.organisation_id,
            name: group.name,
            memberRoleId: group.member_role_id,
            logChannelId: group.log_channel_id || null,
          })
          .onConflictDoUpdate({
            target: guilds.serverId,
            set: {
              organisationId: group.organisation_id,
              name: group.name,
              memberRoleId: group.member_role_id,
              logChannelId: group.log_channel_id || null,
            },
          })
          .run();

        groupsImported++;

        if (group.committee_role_ids) {
          for (const roleId of group.committee_role_ids) {
            tx.insert(committeeRoles)
              .values({
                serverId: group.server_id,
                roleId,
              })
              .onConflictDoNothing()
              .run();

            committeeRolesImported++;
          }
        }

        if (group.auto_delete_channel_ids) {
          for (const channelId of group.auto_delete_channel_ids) {
            tx.insert(autoDeleteChannels)
              .values({
                serverId: group.server_id,
                channelId,
              })
              .onConflictDoNothing()
              .run();

            autoDeleteChannelsImported++;
          }
        }
      }
    }

    if (data.societies) {
      for (const [guildId, society] of Object.entries(data.societies)) {
        if (society.registeredMembers) {
          for (const [key, value] of Object.entries(society.registeredMembers)) {
            let studentId = "";
            let discordId = "";

            if (/^\d{6,7}$/.test(key)) {
              studentId = key;
              discordId = value;
            } else if (/^\d{6,7}$/.test(value)) {
              studentId = value;
              discordId = key;
            } else {
              if (key.length > value.length) {
                discordId = key;
                studentId = value;
              } else {
                discordId = value;
                studentId = key;
              }
            }

            if (studentId && discordId) {
              tx.insert(acceptedIds)
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

              acceptedIdsImported++;
            }
          }
        }

        if (society.acceptedIDs) {
          for (const studentId of society.acceptedIDs) {
            tx.insert(membershipCache)
              .values({
                guildId,
                studentId,
              })
              .onConflictDoNothing()
              .run();

            membershipCacheImported++;
          }
        }
      }
    }

    return {
      groupsImported,
      committeeRolesImported,
      autoDeleteChannelsImported,
      acceptedIdsImported,
      membershipCacheImported,
    };
  });

  console.log(`\nMigration completed`);
  console.log(stats);
}

main();