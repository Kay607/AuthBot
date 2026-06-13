import express from 'express';
import { WebSocketServer } from 'ws';
import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { startTunnel, stopAllTunnels } from './tunnelHandler';

const PORT = 3000;
const SCREEN_W = 1280;
const SCREEN_H = 720;


export async function guildLogin(authFile: string, urlCallback?: (url: string) => void) : Promise<boolean> {
  const START_URL = `https://www.guildofstudents.com/sso/login.ashx?ReturnUrl=/profile`;
	const authDir = path.resolve('authdata');
	const STORAGE_FILE = path.join(authDir, `${authFile}.json`);
  
	if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);
  
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
  
	const page = await context.newPage();
	
	console.log('Interactive login required. Complete MFA/login in the opened browser.');
	await page.goto(START_URL, { waitUntil: 'networkidle' });
	await page.addStyleTag({ content: 'body { font-family: "Segoe UI Webfont",-apple-system,"Helvetica Neue","Lucida Grande","Roboto","Ebrima","Nirmala UI","Gadugi","Segoe Xbox Symbol","Segoe UI Symbol","Meiryo UI","Khmer UI","Tunga","Lao UI","Raavi","Iskoola Pota","Latha","Leelawadee","Microsoft YaHei UI","Microsoft JhengHei UI","Malgun Gothic","Estrangelo Edessa","Microsoft Himalaya","Microsoft New Tai Lue","Microsoft PhagsPa","Microsoft Tai Le","Microsoft Yi Baiti","Mongolian Baiti","MV Boli","Myanmar Text","Cambria Math", sans-serif !important; }' });

  // Express server to serve client UI
	const app = express();
	const publicDir = path.join(process.cwd(), 'public');
	app.use(express.static(publicDir));

	// Start HTTP server
	const server = app.listen(PORT, () => {
		console.log(`HTTP server listening on http://localhost:${PORT}`);
	});


	// WebSocket server (for frames + input)
	const wss = new WebSocketServer({ server, path: '/ws' });

	// Create a CDP session for screencast
	const client = await context.newCDPSession(page);

	let connectionCount = 0;

	

	const result = await new Promise<boolean>(async (resolve) => {
		let shouldExit = true;
		let safeClose = false;

		const shutdown = async () => {
		if (safeClose) return;
      console.log('No clients remaining, shutting down...');
      
      // Stop screencast
      await client.send('Page.stopScreencast', {});

      // Close all clients
      wss.clients.forEach((c) => {
        if (c.readyState === WebSocket.OPEN) {
          c.removeAllListeners('message');
          c.close();
        }
      });

      wss.close();
      await stopAllTunnels();
      server.close();
      await browser.close();
      console.log('Browser closed.');
    };

			// Start ngrok tunnel

		// When a client connects, we add them to set; send initial handshake
		wss.on('connection', (ws) => {
			console.log('client connected');
			connectionCount++;

			ws.on('message', async (raw) => {
				if (page.isClosed()) return;
				try {
					const msg = JSON.parse(raw.toString());
					if (msg.type === 'mouse') {
						let { x, y, action, button, clicks } = msg;
						// map coordinates (client canvas -> page)
						// server expects coordinates already mapped by client; trust it.
						//console.log(button);
						if (button !== 0) button = undefined;

						if (action === 'move') await page.mouse.move(x, y);
						if (action === 'down') await page.mouse.down({ button: button || 'left', clickCount: clicks || 1 });
						if (action === 'up') await page.mouse.up({ button: button || 'left', clickCount: clicks || 1 });
						if (action === 'click') await page.mouse.click(x, y, { button: button || 'left', clickCount: clicks || 1 });
					}
					else if (msg.type === 'keyboard')
					{
						const { action, text, key } = msg;
						if (action === 'type' && text) await page.keyboard.type(text);
						if (action === 'down' && key) await page.keyboard.down(key);
						if (action === 'up' && key) await page.keyboard.up(key);
						if (action === 'press' && key) await page.keyboard.press(key);
						} else if (msg.type === 'navigate') {
						// allow remote navigation (optional)
						const { url } = msg;
						if (typeof url === 'string' && url.startsWith('http')) {
							await page.goto(url);
						}
					}
				} catch (err) {

					const msg = JSON.parse(raw.toString());
					const { x, y, action, button, clicks } = msg;

					console.warn('failed to process msg', err, button);
				}
			});

			ws.on('close', async () => {
				connectionCount--;
				if (connectionCount === 0) {
					try {
						await shutdown();
					}
					catch (err) {
						
					}
				}
				shouldExit = false;

				if (!safeClose)
				resolve(false);
			});

			ws.send(JSON.stringify({ type: 'hello', width: SCREEN_W, height: SCREEN_H }));
		});

		// Start CDP screencast; deliver frames to clients
		await client.send('Page.startScreencast', {
			format: 'jpeg',
			quality: 70,
			maxWidth: SCREEN_W,
			maxHeight: SCREEN_H,
			everyNthFrame: 1
		});

		client.on('Page.screencastFrame', async (event: any) => {
			const { data, sessionId } = event;
			// broadcast to all connected clients
			const msg = JSON.stringify({ type: 'frame', data }); // data is base64 jpeg
			wss.clients.forEach((c) => {
				if (c.readyState === c.OPEN) c.send(msg);
			});
			// ack so CDP continues
			await client.send('Page.screencastFrameAck', { sessionId });
		});

		//Optional: announce public tunnel URL
		await stopAllTunnels();

		await new Promise(r => setTimeout(r, 300));
		const tunnelUrl = await startTunnel(PORT);
		console.log(`Tunnel URL: ${tunnelUrl}`);
		urlCallback(tunnelUrl);
		
		try {
			await page.waitForURL(`**/profile**`, { timeout: 5 * 60 * 1000 });
			console.log('Redirect detected; login completed.');
		} catch (e) {
			
			//console.log(e);
			console.log('Timeout waiting for login redirect. Make sure you completed login/MFA.');

			try {
				await shutdown();
			}
			catch (err) {
			}
			shouldExit = false;
			
			if (!safeClose)
				resolve(false);
		}

		if (shouldExit)
		{
			safeClose = true;

			// Stop CDP screencast
			await client.send('Page.stopScreencast', {});

			

			// Close websocket server, send final message first
			wss.clients.forEach((c) => {
				if (c.readyState === c.OPEN) {
					c.send(JSON.stringify({ type: 'bye' }));
					// optionally remove all event listeners
					c.removeAllListeners('message');
					c.close();
				}
			});
			wss.close();


			await stopAllTunnels();
			server.close();

			// Save cookies + localStorage for future headless runs
			await context.storageState({ path: STORAGE_FILE });
			console.log(`Saved storage state to ${STORAGE_FILE}`);

			// Close the browser now
			await browser.close();
			console.log('Browser closed.');

			resolve(true);
		}
	});

	return result;
}