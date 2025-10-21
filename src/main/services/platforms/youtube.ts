import { request } from 'undici';

export interface YouTubeLiveStatus {
  isLive: boolean;
  title: string | null;
  viewerCount: number | null;
  startedAt: string | null;
  streamUrl: string | null;
}

export async function fetchYouTubeLiveStatus(channelIdOrHandle: string): Promise<YouTubeLiveStatus | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const channelIdentifier = channelIdOrHandle.startsWith('@')
    ? channelIdOrHandle
    : channelIdOrHandle.startsWith('UC')
      ? channelIdOrHandle
      : `@${channelIdOrHandle}`;

  try {
    // Attempt to resolve handle to channel ID if necessary
    let channelId = channelIdentifier;
    if (channelIdentifier.startsWith('@')) {
      const channelResponse = await request(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelIdentifier)}&key=${apiKey}`
      );
      if (channelResponse.statusCode === 200) {
        const searchPayload = (await channelResponse.body.json()) as {
          items?: Array<{ snippet: { channelId: string } }>;
        };
        channelId = searchPayload.items?.[0]?.snippet.channelId ?? channelIdentifier;
      }
    }

    const response = await request(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(
        channelId
      )}&eventType=live&type=video&key=${apiKey}`
    );

    if (response.statusCode !== 200) {
      return null;
    }

    const payload = (await response.body.json()) as {
      items?: Array<{ id: { videoId?: string }; snippet: { title: string; publishedAt: string } }>;
    };

    const liveItem = payload.items?.[0];
    if (!liveItem) {
      return {
        isLive: false,
        title: null,
        viewerCount: null,
        startedAt: null,
        streamUrl: null
      };
    }

    const videoId = liveItem.id?.videoId;
    return {
      isLive: true,
      title: liveItem.snippet.title,
      viewerCount: null,
      startedAt: liveItem.snippet.publishedAt,
      streamUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null
    };
  } catch (error) {
    console.warn('YouTube live status fetch failed', error);
    return null;
  }
}
