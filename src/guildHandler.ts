import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { generateOTP, OTPCredentials } from './autoOtp';


function requestHasValidToken(response: AxiosResponse): boolean {
	if (response.headers.location)
		return !response.headers.location.includes("/login");

	return true;
}


async function isTokenValid(token: string): Promise<boolean> {
	const response = await axios.get(
		"https://www.guildofstudents.com/profile/",
		{
			maxRedirects: 0,
			validateStatus: () => true,
			headers: {
				Cookie: `.AspNet.SharedCookie=${token}`
			}
		}
	);
	return requestHasValidToken(response);
}

// `https://www.guildofstudents.com/organisation/memberlist/${organisationId}/?sort=groups`;

export async function fetchHTML(
	url: string,
	authFile: string,
	method: "GET" | "POST" = "GET",
	data: any = null,
	headers: any = {},
	other: Array<any> = []
): Promise<string | null> {
	const authDir = path.resolve("authdata");
	if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);

	const getResponse = async () => {
		const file = fs.readFileSync(path.join(authDir, `${authFile}.json`), "utf-8");
		const cookies = JSON.parse(file).cookies;
		const token = cookies.find(
			(c: any) =>
				c.name === ".AspNet.SharedCookie" &&
				c.domain === "www.guildofstudents.com"
		)?.value;

		return axios({
			url,
			method,
			data,
			maxRedirects: 0,
			validateStatus: () => true,
			headers: {
				Cookie: `.AspNet.SharedCookie=${token}`,
				...headers
			}
		});
	};

	let response = await getResponse();
	let tokenValid = requestHasValidToken(response);

	if (!tokenValid) {
		const refreshed = await refreshToken(authFile);
		if (refreshed === RefreshTokenStatus.REFRESHED) {
			response = await getResponse();
			tokenValid = requestHasValidToken(response);
		}
	}

	if (!tokenValid) return null;

	if (method === "POST") {
		console.log(response);
	}
	return response.data;
}




export enum RefreshTokenStatus {
	REFRESHED = "REFRESHED",
	REQUIRE_AUTHENTICATOR = "REQUIRE_AUTHENTICATOR",
	NOT_REFRESHED = "NOT_REFRESHED"
}


export async function refreshToken(authFile: string): Promise<RefreshTokenStatus> {
	const authDir = path.resolve('authdata');
	if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);

	// Load storage state
	console.log(authFile);
	const STORAGE_FILE = path.join(authDir, `${authFile}.json`);
	console.log(STORAGE_FILE);

	const browser = await chromium.launch({ headless: true });
	const context = fs.existsSync(STORAGE_FILE)
		? await browser.newContext({ storageState: STORAGE_FILE })
		: await browser.newContext();

	const page = await context.newPage();

	// Navigate to login page
	await page.goto('https://www.guildofstudents.com/sso/login.ashx?ReturnUrl=/profile', { waitUntil: 'networkidle' });

	// Save browser cookies
	await context.storageState({ path: path.join(authDir, `${authFile}.json`) });

	const urlEnd = await page.url();

	if (urlEnd.includes("/profile")) {
		await browser.close();
		return RefreshTokenStatus.REFRESHED;
	}

	const pageHTML = await page.content();

	// Close the browser now
	await browser.close();

	const requireAuthenticator = pageHTML.toLowerCase().includes('authenticator') || pageHTML.toLowerCase().includes('enter the code') || pageHTML.toLowerCase().includes('if you have problems logging in');
	return requireAuthenticator ? RefreshTokenStatus.REQUIRE_AUTHENTICATOR : RefreshTokenStatus.NOT_REFRESHED;
}

export async function autoLogin(authFile: string, credentials: OTPCredentials, email: string, password: string) {
	const authDir = path.resolve('authdata');
	if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);

	// Load storage state
	console.log(authFile);
	const STORAGE_FILE = path.join(authDir, `${authFile}.json`);
	console.log(STORAGE_FILE);

	const browser = await chromium.launch({ headless: true });
	const context = fs.existsSync(STORAGE_FILE)
		? await browser.newContext({ storageState: STORAGE_FILE })
		: await browser.newContext();

	const page = await context.newPage();

	// Navigate to login page
	await page.goto('https://www.guildofstudents.com/sso/login.ashx?ReturnUrl=/profile', { waitUntil: 'networkidle' });


	// Check if it doesn't need authenticating
	const urlEnd = await page.url();

	if (urlEnd.includes("/profile")) {
		await browser.close();
		return RefreshTokenStatus.REFRESHED;
	}

	// Send email, next page
	// Send password, next page
	// Send otp, enter

	const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

	const pageHTML = await page.content();

	// If input[name="otc"] is present, wants otp
	const wantsOtpDirectly = pageHTML.toLowerCase().includes('input[name="otc"]');

	if (!wantsOtpDirectly) {
		await page.waitForSelector('input[name="loginfmt"]');
		await page.fill('input[name="loginfmt"]', email);
		await page.click('#idSIButton9');


		await page.waitForSelector('input[name="passwd"]');
		await page.fill('input[name="passwd"]', password);
		await page.click('#idSIButton9');
	}

	await page.waitForSelector('input[name="otc"]');
	const otp = generateOTP(credentials);
	await page.fill('input[name="otc"]', otp);
	await page.click('#idSubmit_SAOTCC_Continue');

	await page.click('#idSIButton9');


	// Wait for network idle
	await page.waitForFunction(() => {
		return window.location.href.includes('/profile');
	}, { timeout: 20000 });

	await context.storageState({ path: path.join(authDir, `${authFile}.json`) });


	// Check if it made it
	const urlEnd2 = await page.url();
	if (urlEnd2.includes("/profile")) {
		await browser.close();
		return RefreshTokenStatus.REFRESHED;
	}

	return RefreshTokenStatus.NOT_REFRESHED;
}


export interface ProductRow {
	product: string;
	quantity: number;
	type: string;
	total: number;
}

export async function getTickets(authFile: string, organisation_id: string): Promise<ProductRow[]> {
	const authDir = path.resolve('authdata');
	if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);

	// Load storage state
	console.log(authFile);
	const STORAGE_FILE = path.join(authDir, `${authFile}.json`);
	console.log(STORAGE_FILE);

	const browser = await chromium.launch({ headless: true });
	const context = fs.existsSync(STORAGE_FILE)
		? await browser.newContext({ storageState: STORAGE_FILE })
		: await browser.newContext();

	const page = await context.newPage();

	const url = `https://www.guildofstudents.com/sso/login.ashx?ReturnUrl=/organisation/salesreports/${organisation_id}/`;


	// Navigate to login page
	await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

	// Save browser cookies
	await context.storageState({ path: path.join(authDir, `${authFile}.json`) });

	const urlEnd = await page.url();

	if (!urlEnd.includes("/organisation/salesreports")) {
		await browser.close();
		return null;
	}

	//const pageHTML = await page.content();

	// Press button with id ctl00_ctl00_Main_AdminPageContent_lbSales

	// Set it to 8 weeks ago
	const fromDate = new Date();
	fromDate.setDate(fromDate.getDate() - 8 * 7);
	const dateString = fromDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

	await page.$eval(
		'#ctl00_ctl00_Main_AdminPageContent_drDateRange_txtFromDate',
		(input: HTMLInputElement, value: string) => {
			input.value = value;
			input.dispatchEvent(new Event('change', { bubbles: true })); // optional, triggers page JS
		},
		dateString // <-- pass dateString as argument
	);

	await page.click('#ctl00_ctl00_Main_AdminPageContent_lbSales');
	await page.waitForSelector('#ctl00_ctl00_Main_AdminPageContent_ReportViewer1_ReportViewer', { timeout: 60_000 });

	// Get the HTML of the page
	const pageHTML = await page.content();

	// Close the browser now
	await browser.close();


	const $ = cheerio.load(pageHTML);

	// Get last span[aria-label="Report table"]
	const tableLabel = $('span[aria-label="Report table"]').last();
	const table = tableLabel.next('table');

	const rows: ProductRow[] = [];

	// Get first tbody element
	const tbody = table.find('tbody').first();

	// Get all tr elements in tbody
	const trs = tbody.find('tr');

	// Remove first 2
	trs.slice(2).each((index, tr) => {
		const tds = $(tr).find('td');
		const product = tds.eq(0).text().trim();
		const quantity = parseInt(tds.eq(1).text().trim());
		const type = tds.eq(2).text().trim();
		const total = parseInt(tds.eq(3).text().trim());

		if (type === '') return;

		rows.push({ product, quantity, type, total });
	});


	//const requireAuthenticator = pageHTML.toLowerCase().includes('authenticator') || pageHTML.toLowerCase().includes('enter the code');
	//return requireAuthenticator ? RefreshTokenStatus.REQUIRE_AUTHENTICATOR : RefreshTokenStatus.NOT_REFRESHED;
	return rows;
}

