"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import PlatformIcon from "@/components/PlatformIcon";
import type { MatchResult, PlatformLink } from "@/lib/odesli";
import { FEATURED_PLATFORMS } from "@/lib/platforms";

type Status =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "result"; result: MatchResult; cached: boolean };

// The featured row always shows all four pinned platforms: the exact link
// when Odesli matched it, otherwise its search fallback.
function featuredRow(result: MatchResult): { link: PlatformLink; isSearch: boolean }[] {
  return FEATURED_PLATFORMS.flatMap((id): { link: PlatformLink; isSearch: boolean }[] => {
    const exact = result.links.find((link) => link.platform === id);
    if (exact) return [{ link: exact, isSearch: false }];
    const fallback = (result.searchLinks ?? []).find((link) => link.platform === id);
    return fallback ? [{ link: fallback, isSearch: true }] : [];
  });
}

export default function Home() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  function clearInput() {
    setInput("");
    const url = new URL(window.location.href);
    url.searchParams.delete("url");
    window.history.replaceState(null, "", url.toString());
    inputRef.current?.focus();
  }

  const runLookup = useCallback(async (url: string) => {
    setStatus({ state: "loading" });
    try {
      const response = await fetch(`/api/links?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (!response.ok) {
        setStatus({
          state: "error",
          message: data.error ?? "Something went wrong. Try again in a moment.",
        });
        return;
      }
      setStatus({ state: "result", result: data, cached: data.cached === true });
      // Reflect the search in the address bar so the page is shareable:
      // anyone opening this URL sees the same results.
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set("url", url);
      window.history.replaceState(null, "", shareUrl.toString());
    } catch {
      setStatus({
        state: "error",
        message: "Couldn't reach the server. Check your connection and try again.",
      });
    }
  }, []);

  // Auto-run a lookup when arriving via a shared link (/?url=…).
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("url")?.trim();
    if (shared) {
      setInput(shared);
      runLookup(shared);
    }
  }, [runLookup]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = input.trim();
    if (!url) return;
    runLookup(url);
  }

  const loading = status.state === "loading";

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-badge">
          <span className="badge-dot" /> STEREO · MODEL LM-01
        </div>
        <h1 className="wordmark">LINKMATCH</h1>
        <p className="tagline">
          One music link in — every streaming service out.
        </p>
      </header>

      <form className="deck" onSubmit={onSubmit}>
        <label className="deck-label" htmlFor="music-url">
          INSERT LINK
        </label>
        <div className="slot">
          <div className="input-wrap">
            <input
              ref={inputRef}
              id="music-url"
              type="url"
              inputMode="url"
              placeholder="https://open.spotify.com/track/…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
              required
            />
            {input && !loading && (
              <button
                type="button"
                className="clear-btn"
                aria-label="Clear link"
                onClick={clearInput}
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" disabled={loading || !input.trim()}>
            {loading ? "SEARCHING" : "FIND LINKS"}
          </button>
        </div>
        <p className="hint">
          Works with tracks, albums and playlists from Spotify, Apple Music,
          YouTube Music, Tidal, Deezer, Amazon Music and more.
        </p>
      </form>

      {loading && (
        <div className="panel vfd" role="status" aria-live="polite">
          <span className="blink">▮</span> SEARCHING ALL SERVICES…
        </div>
      )}

      {status.state === "error" && (
        <div className="panel error" role="alert">
          {status.message}
        </div>
      )}

      {status.state === "result" && (
        <section className="panel result" aria-live="polite">
          <div className="now-playing">
            {status.result.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="artwork"
                src={status.result.thumbnailUrl}
                alt=""
                width={96}
                height={96}
              />
            )}
            <div className="meta">
              {status.result.type && (
                <span className="type-chip">{status.result.type.toUpperCase()}</span>
              )}
              <h2 className="title">{status.result.title ?? "Unknown title"}</h2>
              {status.result.artist && (
                <p className="artist">{status.result.artist}</p>
              )}
              {status.cached && (
                <span className="cache-chip" title="Served from cache — no API call used">
                  ◉ FROM MEMORY
                </span>
              )}
            </div>
          </div>

          <ul className="featured-links">
            {featuredRow(status.result).map(({ link, isSearch }) => (
              <li key={link.platform}>
                <a
                  className={isSearch ? "search" : undefined}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={
                    isSearch
                      ? `Search ${link.name} for “${status.result.searchQuery}”`
                      : `Open on ${link.name}`
                  }
                  style={{ "--brand": link.color } as React.CSSProperties}
                >
                  {isSearch && (
                    <span className="search-glass" aria-hidden="true">⌕</span>
                  )}
                  <PlatformIcon slug={link.slug} color={link.color} name={link.name} />
                  <span className="link-name">{link.name}</span>
                </a>
              </li>
            ))}
          </ul>

          {(() => {
            const moreExact = status.result.links.filter(
              (link) => !FEATURED_PLATFORMS.includes(link.platform)
            );
            // Non-featured search fallbacks (currently just Qobuz, which
            // Odesli never matches exactly) join the end of the list.
            const moreSearch = (status.result.searchLinks ?? []).filter(
              (link) => !FEATURED_PLATFORMS.includes(link.platform)
            );
            if (moreExact.length === 0 && moreSearch.length === 0) return null;
            return (
              <>
                <p className="links-caption">MORE SERVICES</p>
                <ul className="links">
                  {moreExact.map((link) => (
                    <li key={link.platform}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open on ${link.name}`}
                        style={{ "--brand": link.color } as React.CSSProperties}
                      >
                        <PlatformIcon slug={link.slug} color={link.color} name={link.name} />
                        <span className="link-name">{link.name}</span>
                        <span className="link-arrow" aria-hidden="true">↗</span>
                      </a>
                    </li>
                  ))}
                  {moreSearch.map((link) => (
                    <li key={link.platform}>
                      <a
                        className="search"
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Search ${link.name} for “${status.result.searchQuery}”`}
                        style={{ "--brand": link.color } as React.CSSProperties}
                      >
                        <PlatformIcon slug={link.slug} color={link.color} name={link.name} />
                        <span className="link-name">{link.name}</span>
                        <span className="link-arrow" aria-hidden="true">⌕</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}

          {status.result.pageUrl && (
            <p className="odesli-credit">
              Full page on{" "}
              <a href={status.result.pageUrl} target="_blank" rel="noopener noreferrer">
                song.link
              </a>
            </p>
          )}
        </section>
      )}

      <footer className="footnote">
        <p>
          Matching by{" "}
          <a href="https://odesli.co" target="_blank" rel="noopener noreferrer">
            Odesli
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
