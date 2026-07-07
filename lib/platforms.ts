/**
 * Platform metadata for the services Odesli returns in `linksByPlatform`.
 *
 * - `name`  — recognizable display name
 * - `color` — brand-ish accent color, tuned to read well on the dark theme
 * - `slug`  — Simple Icons slug (used by PlatformIcon); omit if no icon exists
 */
export interface PlatformMeta {
  name: string;
  color: string;
  slug?: string;
}

export const PLATFORMS: Record<string, PlatformMeta> = {
  spotify: { name: "Spotify", color: "#1DB954", slug: "spotify" },
  appleMusic: { name: "Apple Music", color: "#FA5C71", slug: "applemusic" },
  youtubeMusic: { name: "YouTube Music", color: "#FF4E45", slug: "youtubemusic" },
  tidal: { name: "Tidal", color: "#5CE8DB", slug: "tidal" },
  deezer: { name: "Deezer", color: "#B155FF", slug: "deezer" },
  // No slug = no icon on the Simple Icons CDN (mostly trademark removals);
  // PlatformIcon renders a generic music-note glyph instead.
  amazonMusic: { name: "Amazon Music", color: "#25D1DA" },
  soundcloud: { name: "SoundCloud", color: "#FF7733", slug: "soundcloud" },
  pandora: { name: "Pandora", color: "#5C8AFF", slug: "pandora" },
  youtube: { name: "YouTube", color: "#FF4E45", slug: "youtube" },
  napster: { name: "Napster", color: "#41B4D2", slug: "napster" },
  yandex: { name: "Yandex Music", color: "#FFCC00" },
  audius: { name: "Audius", color: "#CC59E8" },
  // Less common platforms Odesli sometimes returns
  itunes: { name: "iTunes", color: "#EA6CC8", slug: "itunes" },
  amazonStore: { name: "Amazon", color: "#FF9900" },
  anghami: { name: "Anghami", color: "#B478FF" },
  boomplay: { name: "Boomplay", color: "#4AC6E0" },
  // Odesli doesn't index Qobuz, so it only ever appears as a search fallback.
  qobuz: { name: "Qobuz", color: "#5C7CFA" },
  audiomack: { name: "Audiomack", color: "#FFA200", slug: "audiomack" },
};

/**
 * Platforms pinned to the featured row at the top of results. When Odesli has
 * no exact match for one, it appears as a search fallback instead.
 */
export const FEATURED_PLATFORMS = ["spotify", "appleMusic", "youtubeMusic", "tidal"];

/** Display order for known platforms; anything unknown is appended after. */
export const PLATFORM_ORDER = [
  "spotify",
  "appleMusic",
  "youtubeMusic",
  "tidal",
  "deezer",
  "amazonMusic",
  "soundcloud",
  "pandora",
  "youtube",
  "napster",
  "yandex",
  "audius",
  "itunes",
  "amazonStore",
  "anghami",
  "boomplay",
  "audiomack",
];

/** "someNewService" -> "Some New Service" for platforms we don't know about. */
export function prettifyPlatformId(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}
