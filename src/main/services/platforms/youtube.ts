import { request } from "undici";
import { load, type CheerioAPI } from "cheerio";

export interface YouTubeLiveStatus {
  isLive: boolean;
  title: string | null;
  viewerCount: number | null;
  startedAt: string | null;
  streamUrl: string | null;
}

const USER_AGENT = "StageDock/1.0 (+https://github.com/owner/StageDock)";
const CHANNEL_ID_REGEX = /^(?:UC|HC)[0-9A-Za-z_-]{22}$/;

const channelIdCache = new Map<string, string | null>();

export async function fetchYouTubeLiveStatus(
  channelIdOrHandle: string
): Promise<YouTubeLiveStatus | null> {
  try {
    const channelId = await resolveChannelId(channelIdOrHandle);
    if (!channelId) {
      console.warn("YouTube live status: failed to resolve channel ID", {
        input: channelIdOrHandle,
      });
      return null;
    }

    console.debug("YouTube live status: resolved channel ID", {
      input: channelIdOrHandle,
      channelId,
    });

    const liveStatus = await fetchLiveStatusFromChannelPage(
      channelId,
      channelIdOrHandle
    );
    if (liveStatus) {
      return liveStatus;
    }

    return {
      isLive: false,
      title: null,
      viewerCount: null,
      startedAt: null,
      streamUrl: null,
    };
  } catch (error) {
    console.warn("YouTube live status fetch failed", error);
    return null;
  }
}

async function resolveChannelId(
  channelIdOrHandle: string
): Promise<string | null> {
  const trimmed = channelIdOrHandle.trim();
  if (!trimmed) {
    return null;
  }

  if (CHANNEL_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split("/").filter(Boolean);
      if (
        segments[0] === "channel" &&
        segments[1] &&
        CHANNEL_ID_REGEX.test(segments[1])
      ) {
        return segments[1];
      }

      const handleSegment = segments.find((segment) => segment.startsWith("@"));
      if (handleSegment) {
        return fetchChannelIdFromPage(
          `https://www.youtube.com/${handleSegment}`
        );
      }

      if (segments[0] && segments[0] !== "watch") {
        return fetchChannelIdFromPage(
          `https://www.youtube.com/${segments.join("/")}`
        );
      }
    } catch (error) {
      console.warn("Failed to parse YouTube channel input URL", {
        input: trimmed,
        error,
      });
      return null;
    }
  }

  if (trimmed.startsWith("@")) {
    return fetchChannelIdFromPage(`https://www.youtube.com/${trimmed}`);
  }

  const withoutPrefix = trimmed.replace(/^channel\//i, "");
  if (CHANNEL_ID_REGEX.test(withoutPrefix)) {
    return withoutPrefix;
  }

  const candidates = new Set<string>();
  candidates.add(`https://www.youtube.com/@${withoutPrefix}`);
  candidates.add(`https://www.youtube.com/${withoutPrefix}`);

  for (const candidate of candidates) {
    const resolved = await fetchChannelIdFromPage(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

async function fetchChannelIdFromPage(url: string): Promise<string | null> {
  const normalized = url.replace(/\/+$/, "");
  const candidates = [
    normalized,
    `${normalized}/about`,
    `${normalized}/streams`,
    `${normalized}/videos`,
  ];

  for (const candidateUrl of candidates) {
    const cached = channelIdCache.get(candidateUrl);
    if (cached !== undefined) {
      if (cached) {
        channelIdCache.set(url, cached);
        return cached;
      }
      continue;
    }

    try {
      const response = await request(candidateUrl, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
        },
      });

      if (response.statusCode !== 200) {
        channelIdCache.set(candidateUrl, null);
        continue;
      }

      const html = await response.body.text();
      const match = html.match(/"channelId":"(UC[0-9A-Za-z_-]{22})"/);
      const channelId = match?.[1] ?? null;
      channelIdCache.set(candidateUrl, channelId);
      if (channelId) {
        channelIdCache.set(url, channelId);
        return channelId;
      }
    } catch (error) {
      console.warn("Failed to resolve YouTube channel ID", {
        url: candidateUrl,
        error,
      });
      channelIdCache.set(candidateUrl, null);
    }
  }

  channelIdCache.set(url, null);
  return null;
}

async function fetchLiveStatusFromChannelPage(
  channelId: string,
  originalInput: string
): Promise<YouTubeLiveStatus | null> {
  const candidateUrls = buildLivePageCandidates(channelId, originalInput);

  for (const url of candidateUrls) {
    try {
      const response = await request(url, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
        },
        maxRedirections: 5,
      });

      if (response.statusCode !== 200) {
        continue;
      }

      const html = await response.body.text();
      const liveStatus = parseLiveStatusFromHtml(html, url);
      if (liveStatus) {
        console.debug("YouTube live status: parsed live status from HTML", {
          channelId,
          source: url,
          isLive: liveStatus.isLive,
          videoUrl: liveStatus.streamUrl ?? null,
        });
        if (liveStatus.isLive) {
          return liveStatus;
        }
      } else {
        console.debug(
          "YouTube live status: no live information found in HTML",
          {
            channelId,
            source: url,
          }
        );
      }
    } catch (error) {
      console.warn("YouTube live status: failed to fetch live page", {
        channelId,
        url,
        error,
      });
    }
  }

  return null;
}

function parseLiveStatusFromHtml(
  html: string,
  sourceUrl: string
): YouTubeLiveStatus | null {
  const $ = load(html);
  const player = extractJsonBlock<any>(
    html,
    /ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});/
  );

  if (player) {
    const liveDetails =
      player?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails ??
      null;
    const liveRenderer =
      player?.playabilityStatus?.liveStreamability?.liveStreamabilityRenderer ??
      null;
    const videoDetails = player?.videoDetails ?? null;

    const isLive =
      Boolean(liveDetails?.isLiveNow) ||
      Boolean(liveDetails?.isLive) ||
      Boolean(videoDetails?.isLiveContent) ||
      Boolean((liveRenderer as { isLive?: boolean } | null)?.isLive);

    if (isLive) {
      const videoId =
        extractVideoId(videoDetails) ??
        extractVideoId(liveRenderer) ??
        extractVideoIdFromDocument($) ??
        null;
      const title =
        extractText(videoDetails?.title) ??
        extractText(liveDetails?.title) ??
        extractTitleFromDocument($) ??
        null;
      const startedAt =
        (liveDetails?.startTimestamp as string | undefined) ??
        (liveRenderer as { startTimestamp?: string } | null)?.startTimestamp ??
        extractStartTimestamp($) ??
        null;
      const viewerCount = parseViewCount(
        videoDetails?.viewCount ??
          (
            liveRenderer as {
              viewerCount?: unknown;
              liveStream?: { viewerCount?: unknown; activeViewers?: unknown };
            } | null
          )?.viewerCount ??
          (
            liveRenderer as {
              liveStream?: { viewerCount?: unknown; activeViewers?: unknown };
            } | null
          )?.liveStream?.viewerCount ??
          (
            liveRenderer as {
              liveStream?: { viewerCount?: unknown; activeViewers?: unknown };
            } | null
          )?.liveStream?.activeViewers
      );

      return {
        isLive: true,
        title,
        viewerCount,
        startedAt: normalizeTimestamp(startedAt),
        streamUrl: videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : sourceUrl,
      };
    }
  }

  const overlayCandidate = findLiveVideoFromOverlay($);
  if (overlayCandidate) {
    return {
      isLive: true,
      title: overlayCandidate.title ?? extractTitleFromDocument($),
      viewerCount: null,
      startedAt: normalizeTimestamp(extractStartTimestamp($)),
      streamUrl: `https://www.youtube.com/watch?v=${overlayCandidate.videoId}`,
    };
  }

  const videoId = extractVideoIdFromDocument($);
  if (!videoId) {
    return null;
  }

  if (!isLiveFromDocument($, html)) {
    return null;
  }

  return {
    isLive: true,
    title: extractTitleFromDocument($),
    viewerCount: null,
    startedAt: normalizeTimestamp(extractStartTimestamp($)),
    streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

function buildLivePageCandidates(
  channelId: string,
  originalInput: string
): string[] {
  const normalizedInput = originalInput.trim();
  const urls = new Set<string>();

  const handleCandidates = new Set<string>();

  if (
    normalizedInput.startsWith("http://") ||
    normalizedInput.startsWith("https://")
  ) {
    try {
      const inputUrl = new URL(normalizedInput);
      const pathname = inputUrl.pathname.replace(/\/+$/, "");
      if (pathname && pathname !== "/") {
        urls.add(`https://www.youtube.com${pathname}`);
        urls.add(`https://www.youtube.com${pathname}/live`);

        const segments = pathname.split("/").filter(Boolean);
        const handleSegment = segments.find((segment) =>
          segment.startsWith("@")
        );
        if (handleSegment) {
          handleCandidates.add(handleSegment);
        }
      }
    } catch {
      // Ignore invalid URLs and fall back to handle logic.
    }
  } else {
    const bareHandle = normalizedInput.replace(/^@/, "");
    if (bareHandle) {
      handleCandidates.add(`@${bareHandle}`);
      handleCandidates.add(bareHandle);
    }
  }

  for (const candidate of handleCandidates) {
    const cleaned = candidate.replace(/\/+$/, "");
    urls.add(`https://www.youtube.com/${cleaned}`);
    urls.add(`https://www.youtube.com/${cleaned}/live`);
    urls.add(`https://www.youtube.com/c/${bareCandidate(cleaned)}`);
    urls.add(`https://www.youtube.com/c/${bareCandidate(cleaned)}/live`);
    urls.add(`https://www.youtube.com/user/${bareCandidate(cleaned)}`);
    urls.add(`https://www.youtube.com/user/${bareCandidate(cleaned)}/live`);
  }

  urls.add(`https://www.youtube.com/channel/${channelId}/live`);
  urls.add(`https://www.youtube.com/channel/${channelId}`);
  urls.add(`https://www.youtube.com/embed/live_stream?channel=${channelId}`);

  return Array.from(urls);
}

function extractJsonBlock<T>(html: string, pattern: RegExp): T | null {
  const match = html.match(pattern);
  if (!match) {
    return null;
  }

  return safeJsonParse<T>(match[1]);
}

function safeJsonParse<T>(input: string): T | null {
  const candidates = [
    input,
    input.trim(),
    input.trim().replace(/;$/, ""),
    input
      .trim()
      .replace(/;$/, "")
      .replace(/<\/script>$/i, ""),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      continue;
    }
  }

  return null;
}

function extractVideoId(source: unknown): string | null {
  if (!source || typeof source !== "object") {
    return null;
  }

  const videoId = (source as { videoId?: unknown }).videoId;
  return typeof videoId === "string" && videoId.length >= 11 ? videoId : null;
}

function extractText(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (
    "simpleText" in value &&
    typeof (value as { simpleText?: unknown }).simpleText === "string"
  ) {
    return (value as { simpleText: string }).simpleText;
  }

  if ("runs" in value && Array.isArray((value as { runs?: unknown }).runs)) {
    const runs = (value as { runs: Array<{ text?: unknown }> }).runs;
    return runs
      .map((run) => (typeof run?.text === "string" ? run.text : ""))
      .join("");
  }

  return null;
}

function parseViewCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const digits = value.replace(/[^0-9]/g, "");
    if (!digits) {
      return null;
    }
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if ("simpleText" in value) {
    return parseViewCount((value as { simpleText?: unknown }).simpleText);
  }

  if ("runs" in value && Array.isArray((value as { runs?: unknown }).runs)) {
    const joined = (value as { runs: Array<{ text?: unknown }> }).runs
      .map((run) => (typeof run?.text === "string" ? run.text : ""))
      .join("");
    return parseViewCount(joined);
  }

  if ("viewCountText" in value) {
    return parseViewCount((value as { viewCountText?: unknown }).viewCountText);
  }

  return null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function bareCandidate(candidate: string): string {
  return candidate.replace(/^@/, "");
}

function extractVideoIdFromDocument($: CheerioAPI): string | null {
  const candidates = [
    $("link[rel='canonical']").attr("href"),
    $("meta[property='og:video:url']").attr("content"),
    $("meta[property='og:url']").attr("content"),
    $("meta[itemprop='url']").attr("content"),
    $("a[href^='/watch?v=']").attr("href"),
  ];

  for (const href of candidates) {
    const videoId = extractVideoIdFromHref(href);
    if (videoId) {
      return videoId;
    }
  }

  const dataVideoId = $("[data-video-id]").attr("data-video-id");
  if (dataVideoId && dataVideoId.length >= 11) {
    return dataVideoId;
  }

  return null;
}

function extractTitleFromDocument($: CheerioAPI): string | null {
  const candidates = [
    $("meta[property='og:title']").attr("content"),
    $("meta[name='title']").attr("content"),
    $("meta[name='twitter:title']").attr("content"),
    $("meta[itemprop='name']").attr("content"),
    $("#video-title").first().text(),
    $("title").first().text(),
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return decodeHtmlEntities(candidate.trim());
    }
  }

  return null;
}

function extractStartTimestamp($: CheerioAPI): string | null {
  const candidates = [
    $("meta[itemprop='startDate']").attr("content"),
    $("meta[property='video:release_date']").attr("content"),
    $("meta[property='l:original_publish_date']").attr("content"),
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeTimestamp(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function isLiveFromDocument($: CheerioAPI, rawHtml: string): boolean {
  const metaValues = [
    $("meta[itemprop='isLiveBroadcast']").attr("content"),
    $("meta[property='og:video:live_broadcast']").attr("content"),
    $("meta[name='is_live']").attr("content"),
  ];

  if (metaValues.some(isTruthy)) {
    return true;
  }

  const liveBadge = $(
    "ytd-badge-supported-renderer, .badge-style-type-live-now, .ytp-live-badge"
  )
    .toArray()
    .some((el) => $(el).text().trim().toUpperCase().includes("LIVE"));
  if (liveBadge) {
    return true;
  }

  const scriptIndicators = $("script")
    .toArray()
    .some((el) => {
      const content = $(el).html();
      if (!content) {
        return false;
      }
      return (
        /"isLive":\s*true/.test(content) ||
        /"isLiveContent":\s*true/.test(content) ||
        /"isLiveNow":\s*true/.test(content)
      );
    });

  if (scriptIndicators) {
    return true;
  }

  return (
    /"isLive":\s*true/.test(rawHtml) ||
    /"isLiveContent":\s*true/.test(rawHtml) ||
    /"isLiveNow":\s*true/.test(rawHtml)
  );
}

function isTruthy(value?: string | null): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function extractVideoIdFromHref(href?: string | null): string | null {
  if (!href) {
    return null;
  }

  try {
    const url = href.startsWith("http")
      ? new URL(href)
      : new URL(href, "https://www.youtube.com");
    const id = url.searchParams.get("v");
    if (id && id.length >= 11) {
      return id;
    }

    const liveMatch = url.pathname.match(/\/live\/([0-9A-Za-z_-]{11})/);
    if (liveMatch) {
      return liveMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

function findLiveVideoFromOverlay(
  $: CheerioAPI
): { videoId: string; title?: string | null } | null {
  const overlays = $(
    "ytd-thumbnail-overlay-time-status-renderer[overlay-style='LIVE']"
  );

  for (const element of overlays.toArray()) {
    const overlay = $(element);
    let anchor = overlay.parents("a[href^='/watch?v=']").first();
    if (!anchor.length) {
      anchor = overlay.siblings("a[href^='/watch?v=']").first();
    }
    if (!anchor.length) {
      anchor = overlay.find("a[href^='/watch?v=']").first();
    }
    if (!anchor.length) {
      const renderer = overlay
        .parents(
          "ytd-grid-video-renderer, ytd-video-renderer, ytd-rich-item-renderer, ytd-rich-grid-media"
        )
        .first();
      if (renderer.length) {
        anchor = renderer.find("a[href^='/watch?v=']").first();
      }
    }

    const href = anchor.attr("href");
    const videoId = extractVideoIdFromHref(href);
    if (!videoId) {
      continue;
    }

    let title =
      anchor.attr("title") ??
      anchor.attr("aria-label") ??
      anchor.find("#video-title").first().text();

    if (!title) {
      const renderer = anchor.length
        ? anchor
        : overlay.parents(
            "ytd-grid-video-renderer, ytd-video-renderer, ytd-rich-item-renderer, ytd-rich-grid-media"
          );
      const rendererTitle = renderer.find("#video-title").first().text();
      if (rendererTitle) {
        title = rendererTitle;
      }
    }

    const finalTitle = title ? title.trim() : null;
    return {
      videoId,
      title: finalTitle ? decodeHtmlEntities(finalTitle) : null,
    };
  }

  return null;
}
