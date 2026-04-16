"use client";

export default function WLogo({ size = 32 }: { size?: number }) {
  /*
   * WSupport logo — pink→orange→gold gradient W + blue swoosh.
   * Two overlapping V-swooshes as thick rounded strokes,
   * plus a curved blue wave underneath.
   */
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 110 105"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* A – outer left: hot pink */}
        <linearGradient id="ws-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E91E8C" />
          <stop offset="100%" stopColor="#F0547A" />
        </linearGradient>
        {/* B – inner left: coral → orange */}
        <linearGradient id="ws-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F06040" />
          <stop offset="100%" stopColor="#F7941D" />
        </linearGradient>
        {/* C – inner right: orange → amber */}
        <linearGradient id="ws-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7941D" />
          <stop offset="100%" stopColor="#FBB040" />
        </linearGradient>
        {/* D – outer right: orange */}
        <linearGradient id="ws-d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7941D" />
          <stop offset="100%" stopColor="#F9A835" />
        </linearGradient>
        {/* Swoosh: indigo → blue */}
        <linearGradient id="ws-sw" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3535CC" />
          <stop offset="100%" stopColor="#4488F5" />
        </linearGradient>
      </defs>

      {/* Right V (behind) */}
      <line x1="75" y1="74" x2="100" y2="12"
        stroke="url(#ws-d)" strokeWidth="14" strokeLinecap="round" />
      <line x1="55" y1="12" x2="75" y2="74"
        stroke="url(#ws-c)" strokeWidth="14" strokeLinecap="round" />

      {/* Left V (on top) */}
      <line x1="10" y1="12" x2="37" y2="74"
        stroke="url(#ws-a)" strokeWidth="14" strokeLinecap="round" />
      <line x1="37" y1="74" x2="55" y2="12"
        stroke="url(#ws-b)" strokeWidth="14" strokeLinecap="round" />

      {/* Blue swoosh wave */}
      <path
        d="M4 94 C22 82 42 88 58 90 C74 92 90 84 106 76"
        stroke="url(#ws-sw)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
