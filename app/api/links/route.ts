import { NextRequest, NextResponse } from "next/server";
import { getCache } from "@/lib/cache";
import { fetchMatch, normalizeUrl, type MatchResult } from "@/lib/odesli";

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

// Dedupe concurrent lookups of the same URL within this instance so a burst
// of identical requests costs one Odesli call, not several.
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof fetchMatch>>>>();

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl || !rawUrl.trim()) {
    return NextResponse.json(
      { error: "Paste a link to a song, album, or playlist first." },
      { status: 400 }
    );
  }

  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return NextResponse.json(
      { error: "That doesn't look like a valid link — paste the full URL, starting with https://" },
      { status: 400 }
    );
  }

  const cache = getCache<MatchResult>();
  const cached = await cache.get(normalized);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  let outcome = inFlight.get(normalized);
  if (!outcome) {
    outcome = fetchMatch(normalized).finally(() => inFlight.delete(normalized));
    inFlight.set(normalized, outcome);
  }
  const result = await outcome;

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  await cache.set(normalized, result.result, CACHE_TTL_SECONDS);
  return NextResponse.json({ ...result.result, cached: false });
}
