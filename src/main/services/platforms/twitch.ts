import { request } from 'undici';

export interface TwitchLiveStatus {
  isLive: boolean;
  title: string | null;
  viewerCount: number | null;
  startedAt: string | null;
}

let appAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function fetchAppAccessToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  if (appAccessToken && tokenExpiresAt > Date.now()) {
    return appAccessToken;
  }

  try {
    const response = await request('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.statusCode !== 200) {
      return null;
    }

    const payload = (await response.body.json()) as { access_token: string; expires_in: number };
    appAccessToken = payload.access_token;
    tokenExpiresAt = Date.now() + payload.expires_in * 1000 * 0.9;
    return appAccessToken;
  } catch (error) {
    console.warn('Twitch token fetch failed', error);
    return null;
  }
}

export async function fetchTwitchLiveStatus(channelName: string): Promise<TwitchLiveStatus | null> {
  const token = await fetchAppAccessToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!token || !clientId) {
    return null;
  }

  try {
    const response = await request(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channelName)}`,
      {
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (response.statusCode !== 200) {
      return null;
    }

    const payload = (await response.body.json()) as {
      data: Array<{ title: string; viewer_count: number; started_at: string }>;
    };

    const stream = payload.data?.[0];
    if (!stream) {
      return {
        isLive: false,
        title: null,
        viewerCount: null,
        startedAt: null
      };
    }

    return {
      isLive: true,
      title: stream.title,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at
    };
  } catch (error) {
    console.warn('Twitch live status fetch failed', error);
    return null;
  }
}
