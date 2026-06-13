import { client } from "./client";
import { db } from "./db";
import { getCommitteeRoleIds, pruneExpiredAdmins } from "./db/common";
import { autoLogin, RefreshTokenStatus } from "./guildHandler";
import { admins, credentials } from "./schema";
import { eq, and, lt, inArray } from "drizzle-orm";
import { OTPCredentials } from "./autoOtp";

export async function getAdminDiscordId(guildID: string): Promise<string> {

    const committeeRolesIds = getCommitteeRoleIds(guildID);

    // Get all users with these roles
    const committeeUsers: string[] = Array.from(client.guilds.cache.get(guildID)?.members.cache.filter((member) => member.roles.cache.some((role) => committeeRolesIds.includes(role.id))).keys());

    console.log(committeeUsers);
    if (!committeeUsers) return null;

    // Filter users by those in the admin table
    pruneExpiredAdmins();
    const adminUsers = db.select().from(admins).where(
        inArray(admins.discordId, committeeUsers)
    ).get();

    console.log(adminUsers);

    if (adminUsers) {
        return adminUsers.discordId;
    }

    // Get all users who are in the credentials table and are committee

    const creds = db.select().from(credentials).where(
        inArray(credentials.discordId, committeeUsers)
    ).all();

    console.log(creds);

    // Try to login
    for (const cred of creds) {

        const decodedOtpCreds = Buffer.from(cred.otpCredentials, 'base64').toString();
        console.log(decodedOtpCreds);

        const result = await autoLogin(cred.discordId, JSON.parse(decodedOtpCreds) as OTPCredentials, cred.username, cred.password);

        // Add to admin table
        await db.insert(admins).values({
            discordId: cred.discordId,
            timestamp: new Date(),
        });

        if (result === RefreshTokenStatus.REFRESHED) {
            return cred.discordId;
        }

    }

    return null;

}