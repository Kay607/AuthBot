import axios from 'axios';
import * as cheerio from 'cheerio';

// Society event object
export interface Event {
	name: string;
	startTime: string;
	endTime: string;
	location: string;
	description: string;
	url: string;
	image: string;
}

function parseEventTime(input: string): { start: string; end: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Extract the date and time components
  const match = input.match(/(\d+)(?:st|nd|rd|th)\s+(\w+)\s+(.+?)\s+-\s+(?:(\d+)(?:st|nd|rd|th)\s+(\w+)\s+)?(.+)/);
  
  if (!match) {
    throw new Error("Invalid format");
  }
  
  const [, startDay, startMonth, startTime, endDay, endMonth, endTime] = match;
  
  // Parse month names
  const monthMap: { [key: string]: number } = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };
  
  const startMonthNum = monthMap[startMonth.toLowerCase()];
  const endMonthNum = endMonth ? monthMap[endMonth.toLowerCase()] : startMonthNum;
  
  // Parse time strings
  const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    timeStr = timeStr.trim().toLowerCase();
    
    if (timeStr === "midnight") return { hours: 0, minutes: 0 };
    if (timeStr === "noon") return { hours: 12, minutes: 0 };
    
    const timeMatch = timeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)?/);
    if (!timeMatch) throw new Error("Invalid time format");
    
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3];
    
    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    
    return { hours, minutes };
  };
  
  const startTimeParsed = parseTime(startTime);
  const endTimeParsed = parseTime(endTime);
  
  // Create dates
  let startYear = currentYear;
  let endYear = currentYear;
  
  // Check if start date has passed
  const startDate = new Date(startYear, startMonthNum, parseInt(startDay), startTimeParsed.hours, startTimeParsed.minutes);
  if (startDate < now) {
    startYear++;
    endYear++;
  }
  
  // Reconstruct dates with correct year
  const finalStartDate = new Date(startYear, startMonthNum, parseInt(startDay), startTimeParsed.hours, startTimeParsed.minutes);
  const finalEndDay = endDay ? parseInt(endDay) : parseInt(startDay);
  const finalEndDate = new Date(endYear, endMonthNum, finalEndDay, endTimeParsed.hours, endTimeParsed.minutes);
  
  // If end date is before start date (crosses year boundary), increment end year
  if (finalEndDate < finalStartDate) {
    finalEndDate.setFullYear(endYear + 1);
  }
  
  return {
    start: finalStartDate.toISOString(),
    end: finalEndDate.toISOString()
  };
}

export async function getEvents(organisationID: string) : Promise<Event[]> {
    
    const url = "https://www.guildofstudents.com/studentgroups/societies/" + organisationID + "/events/";
    
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const events: Event[] = [];

    $('.event_item').each((i, el) => {
        const name = $(el).find('.msl_event_name').text().trim();
        const time = $(el).find('.msl_event_time').text().trim();
        const location = $(el).find('.msl_event_location').text().trim();
        const description = $(el).find('.msl_event_description').text().trim();
        const relativeUrl = $(el).find('.msl_event_name').attr('href');
        const fullUrl = new URL(relativeUrl, url).href; // Convert relative URL to absolute

        const imgSrc = $(el).find('.msl_event_image img').attr('src');
        const imageUrl = imgSrc ? new URL(imgSrc, url).href : null;

        const { start, end } = parseEventTime(time);
        events.push({
            name,
            startTime: start,
            endTime: end,
            location,
            description,
            url: fullUrl,
            image: imageUrl
        });
    });

    // Sort by start time
    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return events;
}