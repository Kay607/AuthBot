import axios from "axios";
import * as cheerio from "cheerio";
import { Group } from './config';
import { fetchHTML } from './guildHandler';
import { client } from './client';
import { committeeErrorToChannel, logToChannel } from './logging';
import { getGroup, isMembershipCached, replaceMembershipCache } from './db/common';
import { getAdminDiscordId } from "./credentials";




export async function isStudentIDMember(id: string, guildID: string, onUpdateCache?: () => void): Promise<boolean> {
    if (!getGroup(guildID))
        return false;

    if (isMembershipCached(guildID, id)) return true;

    await updateMembersList(guildID);

    if (onUpdateCache) {
        onUpdateCache();
    }

    return isMembershipCached(guildID, id);
}

export async function updateMembersList(guildID: string) {

    console.log(`Updating membership list for guild ${guildID}`);

    const memberIds = await fetchMembershipList(guildID);

    if (!memberIds) {
        // Log error message failed to fetch membership list
        committeeErrorToChannel(guildID, '[Error] Failed to fetch membership list. Likely no valid token. Try /guildlogin');
        return;
    }

    replaceMembershipCache(guildID, Array.from(memberIds).map(id => id.toString()));
}

async function fetchMembershipList(guildID: string): Promise<Set<number> | null> {

    const groupData: Group = getGroup(guildID) as Group;

    if (!groupData) {
        throw new Error(`No group data found for guild ID ${guildID}`);
    }

    const organisationId = groupData.organisation_id;
    const url = `https://www.guildofstudents.com/organisation/memberlist/${organisationId}/?sort=groups`;
    const html = await fetchHTML(url, await getAdminDiscordId(guildID));

    if (!html) return null;

    const $ = cheerio.load(html);


    const tableIds = [
        "ctl00_ctl00_Main_AdminPageContent_rptGroups_ctl03_gvMemberships",
        "ctl00_ctl00_Main_AdminPageContent_rptGroups_ctl05_gvMemberships",
    ];

    const memberIds = new Set<number>();

    for (const tableId of tableIds) {
        const table = $(`table#${tableId}`);
        if (!table.length) {
            console.warn(`Membership table with ID ${tableId} could not be found.`);
            continue;
        }

        table.find("tr").slice(1).each((_, row) => {
            const cells = $(row).find("td");
            const rawId = $(cells[1]).text().trim();

            const id = parseInt(rawId, 10);
            if (isNaN(id)) {
                console.warn(`Failed to convert ID '${rawId}' in membership table to an integer`);
                return;
            }

            memberIds.add(id);
        });
    }

    if (memberIds.size === 0) {
        const message = "No members were found in either membership table.";
        console.warn(message);
        throw new Error(message);
    }

    return memberIds;
}
