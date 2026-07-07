"use client";

import { useState } from "react";

/**
 * Platform logo via the Simple Icons CDN (no icon package needed), with a
 * generic music-note fallback if a slug has no icon or the CDN is unreachable.
 */
export default function PlatformIcon({
  slug,
  color,
  name,
}: {
  slug: string | null;
  color: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!slug || failed) {
    return (
      <svg
        className="platform-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill={color}
      >
        <path d="M9 3v10.55A4 4 0 1 0 11 17V7h8V3H9z" />
      </svg>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="platform-icon"
      src={`https://cdn.simpleicons.org/${slug}/${color.replace("#", "")}`}
      alt=""
      aria-hidden="true"
      width={18}
      height={18}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
