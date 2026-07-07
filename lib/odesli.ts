import { PLATFORMS, PLATFORM_ORDER, prettifyPlatformId } from "./platforms";

const ODESLI_ENDPOINT = "https://api.song.link/v1-alpha.1/links";

export interface PlatformLink {
  /** Odesli platform id, e.g. "appleMusic" */
  platform: string;
  name: string;
  url: string;
  color: string;
  slug: string | null;
}

export interface MatchResult {
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
  /** "song" | "album" | ... as reported by Odesli */
  type: string | null;
  /** Odesli's own universal page for this item */
  pageUrl: string | null;
  links: PlatformLink[];
  /**
   * "Search on X" fallbacks for featured platforms Odesli couldn't match —
   * not direct links to the item, but one tap from it.
   */
  searchLinks: PlatformLink[];
  /** The query behind the search fallbacks, e.g. "Dethrone Bad Omens". */
  searchQuery: string | null;
}

export type OdesliOutcome =
  | { ok: true; result: MatchResult }
  | { ok: false; status: number; message: string };

/**
 * Normalize a pasted URL into a canonical cache key: lowercase the host,
 * drop the hash, strip tracking params, trim trailing slashes. This makes
 * `open.spotify.com/track/x?si=abc` and `...?si=def` the same cache entry.
 * Returns null if the input isn't a usable http(s) URL.
 */
export function normalizeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  const trackingParams = ["si", "feature", "ref", "referrer", "at", "ct", "ls", "context", "nd"];
  const toDelete: string[] = [];
  url.searchParams.forEach((_value, key) => {
    if (trackingParams.includes(key) || key.startsWith("utm_")) toDelete.push(key);
  });
  toDelete.forEach((key) => url.searchParams.delete(key));

  let result = url.toString();
  if (url.search === "" && result.endsWith("?")) result = result.slice(0, -1);
  if (url.pathname !== "/" && result.endsWith("/")) result = result.slice(0, -1);
  return result;
}

interface OdesliResponse {
  entityUniqueId?: string;
  pageUrl?: string;
  entitiesByUniqueId?: Record<string, OdesliEntity>;
  linksByPlatform?: Record<string, { url?: string }>;
}

interface OdesliEntity {
  title?: string;
  artistName?: string;
  thumbnailUrl?: string;
  type?: string;
}

/**
 * Call the Odesli API for a (normalized) music URL and reduce its response to
 * the slim shape the UI needs. Friendly error messages, never raw API errors.
 */
export async function fetchMatch(url: string): Promise<OdesliOutcome> {
  let response: Response;
  try {
    response = await fetch(
      `${ODESLI_ENDPOINT}?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(15_000) }
    );
  } catch {
    return {
      ok: false,
      status: 502,
      message: "Couldn't reach the link-matching service. Try again in a moment.",
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      status: 429,
      message: "We're a bit busy right now — try again in a minute.",
    };
  }

  if (response.status >= 400 && response.status < 500) {
    // Odesli returns 400/404 for links it doesn't recognize or can't match.
    return {
      ok: false,
      status: 404,
      message:
        "Couldn't find that one — check it's a link to a song, album, or playlist from a supported service.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      message: "The link-matching service had a hiccup. Try again in a moment.",
    };
  }

  let data: OdesliResponse;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      status: 502,
      message: "The link-matching service had a hiccup. Try again in a moment.",
    };
  }

  const links = buildLinks(data.linksByPlatform ?? {});
  if (links.length === 0) {
    return {
      ok: false,
      status: 404,
      message: "No matches found on other services for that link.",
    };
  }

  const entity = pickEntity(data);
  const searchQuery = buildSearchQuery(entity);
  return {
    ok: true,
    result: {
      ...entity,
      pageUrl: data.pageUrl ?? null,
      links,
      searchLinks: searchQuery ? buildSearchLinks(searchQuery, links) : [],
      searchQuery,
    },
  };
}

// Search URLs for the featured platforms, used as fallbacks when Odesli has
// no exact match (its matching to these has visible gaps, especially for
// newer releases).
const SEARCH_FALLBACKS: Record<string, (query: string) => string> = {
  spotify: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  appleMusic: (q) => `https://music.apple.com/search?term=${encodeURIComponent(q)}`,
  youtubeMusic: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}`,
  tidal: (q) => `https://listen.tidal.com/search?q=${encodeURIComponent(q)}`,
};

function buildSearchQuery(entity: Pick<MatchResult, "title" | "artist">): string | null {
  if (!entity.title) return null;
  // "[Explicit]"-style store tags just pollute search queries.
  const query = [entity.title, entity.artist]
    .filter(Boolean)
    .join(" ")
    .replace(/\s*\[[^\]]*\]/g, "")
    .trim();
  return query || null;
}

function buildSearchLinks(query: string, matched: PlatformLink[]): PlatformLink[] {
  const matchedIds = new Set(matched.map((link) => link.platform));
  return Object.entries(SEARCH_FALLBACKS)
    .filter(([id]) => !matchedIds.has(id))
    .map(([id, buildUrl]) => {
      const meta = PLATFORMS[id];
      return {
        platform: id,
        name: meta.name,
        url: buildUrl(query),
        color: meta.color,
        slug: meta.slug ?? null,
      };
    });
}

function pickEntity(
  data: OdesliResponse
): Pick<MatchResult, "title" | "artist" | "thumbnailUrl" | "type"> {
  const entities = data.entitiesByUniqueId ?? {};
  const primary = data.entityUniqueId ? entities[data.entityUniqueId] : undefined;
  // The primary entity occasionally lacks artwork; borrow it from any match.
  const withThumb = Object.values(entities).find((e) => e.thumbnailUrl);
  return {
    title: primary?.title ?? withThumb?.title ?? null,
    artist: primary?.artistName ?? withThumb?.artistName ?? null,
    thumbnailUrl: primary?.thumbnailUrl ?? withThumb?.thumbnailUrl ?? null,
    type: primary?.type ?? null,
  };
}

// Store listings that duplicate a streaming sibling (purchase page for the
// same item). When both are present, show only the streaming link.
const STORE_DUPLICATES: Record<string, string> = {
  amazonStore: "amazonMusic",
  itunes: "appleMusic",
};

function buildLinks(linksByPlatform: Record<string, { url?: string }>): PlatformLink[] {
  const ids = Object.keys(linksByPlatform).filter((id) => {
    const streamingSibling = STORE_DUPLICATES[id];
    return !(streamingSibling && linksByPlatform[streamingSibling]?.url);
  });
  const known = PLATFORM_ORDER.filter((id) => ids.includes(id));
  const unknown = ids.filter((id) => !PLATFORM_ORDER.includes(id)).sort();

  return [...known, ...unknown]
    .map((id) => {
      const url = linksByPlatform[id]?.url;
      if (!url) return null;
      const meta = PLATFORMS[id];
      return {
        platform: id,
        name: meta?.name ?? prettifyPlatformId(id),
        url,
        color: meta?.color ?? "#9BA3AE",
        slug: meta?.slug ?? null,
      };
    })
    .filter((link): link is PlatformLink => link !== null);
}
