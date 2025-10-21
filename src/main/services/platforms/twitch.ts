import { request } from "undici";

export interface TwitchLiveStatus {
  isLive: boolean;
  title: string | null;
  viewerCount: number | null;
  startedAt: string | null;
  streamUrl: string | null;
}

const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_PUBLIC_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const USER_AGENT = "StageDock/1.0 (+https://github.com/owner/StageDock)";

const TWITCH_LIVE_STATUS_QUERY =
  "query ($login: String!) { user(login: $login) { stream { type title viewersCount createdAt game { name } } } }";

interface TwitchGraphQLResponse {
  data?: {
    user?: {
      stream?: {
        type: string | null;
        title: string | null;
        viewersCount: number | null;
        createdAt: string | null;
        game?: {
          name?: string | null;
        } | null;
      } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

function normalizeLogin(input: string): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const urlPrefixes = ["https://www.twitch.tv/", "http://www.twitch.tv/", "https://twitch.tv/", "http://twitch.tv/"];
  for (const prefix of urlPrefixes) {
    if (lower.startsWith(prefix)) {
      const remainder = trimmed.slice(prefix.length);
      return remainder.split(/[/?#]/)[0] ?? null;
    }
  }

  return trimmed;
}

export async function fetchTwitchLiveStatus(channelName: string): Promise<TwitchLiveStatus | null> {
  const login = normalizeLogin(channelName);
  if (!login) {
    return null;
  }

  try {
    const response = await request(TWITCH_GQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Client-ID": TWITCH_PUBLIC_CLIENT_ID,
        "Content-Type": "text/plain;charset=UTF-8",
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: TWITCH_LIVE_STATUS_QUERY,
        variables: { login },
      }),
    });

    if (response.statusCode !== 200) {
      console.warn(
        "Twitch live status fetch failed due to unexpected status code",
        response.statusCode
      );
      return null;
    }

    const payload = (await response.body.json()) as TwitchGraphQLResponse;
    if (payload.errors?.length) {
      console.warn("Twitch live status fetch returned GraphQL errors", {
        login,
        errors: payload.errors,
      });
      return null;
    }

    const stream = payload.data?.user?.stream ?? null;
    if (!stream) {
      return {
        isLive: false,
        title: null,
        viewerCount: null,
        startedAt: null,
        streamUrl: null,
      };
    }

    return {
      isLive: stream.type === "live",
      title: stream.title ?? null,
      viewerCount: stream.viewersCount ?? null,
      startedAt: stream.createdAt ?? null,
      streamUrl: `https://www.twitch.tv/${login}`,
    };
  } catch (error) {
    console.warn("Twitch live status fetch failed", { login, error });
    return null;
  }
}
