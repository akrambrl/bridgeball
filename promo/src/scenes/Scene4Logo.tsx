import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT } from "../theme";

/** Recreation of bridgeball-logo.svg as an animated component. */
const Logo: React.FC<{ draw: number }> = ({ draw }) => {
  const circ = 2 * Math.PI * 160;
  return (
    <svg viewBox="0 0 560 560" width={420} height={420}>
      <defs>
        <clipPath id="cg">
          <rect x="0" y="0" width="560" height="560" rx="112" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="560" height="560" rx="112" fill={COLORS.pitchDark} />
      <g clipPath="url(#cg)">
        {Array.from({ length: 7 }).map((_, i) => (
          <rect key={i} x={i * 80} y="0" width="80" height="560" fill={i % 2 ? COLORS.pitchLight : COLORS.pitchDark} />
        ))}
      </g>
      <line x1="0" y1="280" x2="560" y2="280" stroke={COLORS.line} strokeWidth="9" />
      <circle
        cx="280"
        cy="280"
        r="160"
        fill="none"
        stroke={COLORS.line}
        strokeWidth="9"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - draw)}
        transform="rotate(-90 280 280)"
      />
      <circle cx="280" cy="280" r="12" fill={COLORS.accent} />
    </svg>
  );
};

export const Scene4Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 13 } });
  const draw = interpolate(spring({ frame: frame - 6, fps, config: { damping: 18 } }), [0, 1], [0, 1]);
  const nameIn = spring({ frame: frame - 16, fps, config: { damping: 14 } });
  const tagIn = spring({ frame: frame - 26, fps, config: { damping: 14 } });
  const ctaIn = spring({ frame: frame - 38, fps, config: { damping: 10 } });
  const ctaPulse = 1 + 0.05 * Math.sin(frame / 5);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 35%, ${COLORS.pitchLight}, ${COLORS.pitchDeep})`,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        flexDirection: "column",
        gap: 30,
      }}
    >
      <div style={{ transform: `scale(${interpolate(pop, [0, 1], [0.5, 1])})`, opacity: pop }}>
        <Logo draw={draw} />
      </div>

      <div style={{ opacity: nameIn, transform: `translateY(${interpolate(nameIn, [0, 1], [30, 0])}px)`, textAlign: "center" }}>
        <div style={{ color: COLORS.white, fontSize: 96, fontWeight: 900, letterSpacing: 4 }}>
          GOAT&nbsp;FC
        </div>
      </div>

      <div
        style={{
          opacity: tagIn,
          transform: `translateY(${interpolate(tagIn, [0, 1], [30, 0])}px)`,
          color: "rgba(255,255,255,0.85)",
          fontSize: 40,
          fontWeight: 600,
          textAlign: "center",
          maxWidth: 800,
          lineHeight: 1.3,
        }}
      >
        Trouve le joueur qui fait le pont<br />entre deux clubs de foot.
      </div>

      <div
        style={{
          opacity: ctaIn,
          transform: `scale(${ctaIn * ctaPulse})`,
          marginTop: 30,
          background: COLORS.accent,
          color: COLORS.pitchDeep,
          fontWeight: 900,
          fontSize: 46,
          padding: "26px 64px",
          borderRadius: 50,
          boxShadow: "0 0 50px rgba(0,230,118,0.6)",
        }}
      >
        JOUE MAINTENANT ▶
      </div>
    </AbsoluteFill>
  );
};
