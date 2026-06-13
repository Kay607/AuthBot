import { NGROK_AUTH_TOKEN, TUNEL_TYPE, TunnelType } from "./config";

import ngrok from '@ngrok/ngrok';

export async function startTunnel(port: number): Promise<string> {
    if (TUNEL_TYPE == TunnelType.NGROK)
    {
        const tunnel = await ngrok.connect({ port: port, authtoken: NGROK_AUTH_TOKEN });
        return tunnel.url();
    }
}

export async function stopAllTunnels() 
{
    if (TUNEL_TYPE == TunnelType.NGROK)
    {
        await ngrok.disconnect();
        await ngrok.kill();
    }
}