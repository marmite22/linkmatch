# LinkMatch

Paste a music link from one streaming service, get matching links on all the others.

Powered by the [Odesli](https://odesli.co) (song.link) API. Paste a track, album, or playlist link from Spotify, Apple Music, YouTube Music, Tidal, Deezer, Amazon Music, etc., and LinkMatch shows the same item on every service Odesli can find — with title, artist, and artwork.

> Qobuz is not supported: Odesli doesn't index it.

**Shareable results:** a successful search puts the looked-up link in the address bar (`/?url=…`), so you can copy the browser URL and send it to friends — they land on the same results page (usually served straight from cache, costing zero API calls). Platforms Odesli can't match exactly (often Spotify / Apple Music / YouTube Music) get "try search" fallback links built from the title and artist.

## How it works

- Next.js single page ([app/page.tsx](app/page.tsx)) with one API route, [`GET /api/links?url=…`](app/api/links/route.ts).
- The API route calls Odesli **server-side** (no CORS issues, and all caching lives in one place), trims the response down to `{ title, artist, thumbnailUrl, links[] }`, and returns friendly error messages for invalid links, no-match, and rate limits.
- **Caching:** successful lookups are cached server-side for 24 hours, keyed by the normalized input URL (tracking params like `?si=…` and `utm_*` are stripped, so share-link variants of the same song hit the same entry). A cache hit skips Odesli entirely — repeat lookups of a popular song cost zero API calls. This matters because the keyless Odesli tier allows ~10 requests/minute **shared across all users of the app**.
- The cache is behind a small async interface ([lib/cache.ts](lib/cache.ts)) with an in-memory implementation for launch, so it can be swapped for a persistent store later without touching call sites.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000. No environment variables or API keys needed.

## Deploy to Vercel

Zero config — Vercel detects Next.js automatically:

1. Push this repo to GitHub.
2. [Import it in Vercel](https://vercel.com/new) and click Deploy.

Or from the CLI: `npx vercel`.

## Scaling notes

Fine as-is for friend-group scale. If usage grows, upgrade these two things first:

1. **Swap the in-memory cache for Vercel KV or Upstash Redis.** The in-memory cache lives per serverless instance, so it's lost on cold starts and not shared between concurrent instances. `lib/cache.ts` defines the `LinkCache` interface and includes a comment sketching the Redis implementation — implement it and change one line in `getCache()`.
2. **Request a higher-rate API key from Odesli** (email developers@song.link). The free 10 req/min tier is shared across *all* users of this deployment, not per-user, so it's the first ceiling you'll hit.

**Vercel costs:** the free (Hobby) tier includes roughly 100 GB bandwidth and ~1M function invocations per month. Each lookup is one tiny function call and a few KB of JSON, so friend-group usage rounds to zero. You'd need sustained public traffic — on the order of tens of thousands of visitors a month — before a paid Vercel plan ($20/mo Pro) becomes relevant. In practice you'll hit the Odesli rate limit long before any Vercel limit.
