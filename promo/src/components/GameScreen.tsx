import React from "react";
import { interpolate } from "remotion";
import { COLORS, FONT } from "../theme";

/** A simple stylised club crest. */
const Crest: React.FC<{ primary: string; secondary: string; label: string }> = ({
  primary,
  secondary,
  label,
}) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
    <svg viewBox="0 0 100 110" width={130} height={143}>
      <path d="M50 4 L94 20 V60 Q94 92 50 106 Q6 92 6 60 V20 Z" fill={primary} stroke={COLORS.white} strokeWidth="4" />
      <path d="M50 4 L94 20 V60 Q94 92 50 106 Z" fill="rgba(0,0,0,0.15)" />
      <circle cx="50" cy="48" r="20" fill={secondary} />
      <path d="M30 78 H70" stroke={COLORS.white} strokeWidth="6" strokeLinecap="round" />
    </svg>
    <div style={{ color: COLORS.white, fontSize: 30, fontWeight: 800, fontFamily: FONT }}>{label}</div>
  </div>
);

type Props = {
  /** 0 = question only, 1 = answer fully revealed */
  reveal: number;
  /** Pulse value for the bridge glow (0..1) */
  pulse?: number;
};

/**
 * The GOAT FC gameplay UI: two clubs connected by a "bridge",
 * and the bridging player revealed underneath.
 */
export const GameScreen: React.FC<Props> = ({ reveal, pulse = 0 }) => {
  const answerOpacity = interpolate(reveal, [0.45, 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const answerY = interpolate(reveal, [0.45, 0.85], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const qMark = interpolate(reveal, [0.3, 0.5], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glow = 6 + pulse * 16;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(160deg, ${COLORS.pitchLight}, ${COLORS.pitchDeep})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: FONT,
        paddingTop: 40,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* faint pitch stripes */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(i * 100) / 7}%`,
            top: 0,
            width: `${100 / 7}%`,
            height: "100%",
            background: i % 2 ? "rgba(255,255,255,0.04)" : "transparent",
          }}
        />
      ))}

      {/* Header */}
      <div style={{ color: COLORS.accent, fontWeight: 900, fontSize: 34, letterSpacing: 2, zIndex: 2 }}>
        GOAT&nbsp;FC
      </div>
      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 22, marginTop: 6, zIndex: 2 }}>
        Qui fait le pont&nbsp;?
      </div>

      {/* Two clubs + bridge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          marginTop: 50,
          zIndex: 2,
        }}
      >
        <Crest primary="#C8102E" secondary="#FFFFFF" label="ARS" />
        {/* Bridge connector */}
        <div style={{ position: "relative", width: 90, height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: 8,
              borderRadius: 6,
              background: COLORS.accent,
              boxShadow: `0 0 ${glow}px ${COLORS.accent}`,
            }}
          />
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: COLORS.pitchDeep,
              border: `4px solid ${COLORS.accent}`,
              color: COLORS.accent,
              fontWeight: 900,
              fontSize: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: qMark,
              boxShadow: `0 0 ${glow}px ${COLORS.accent}`,
            }}
          >
            ?
          </div>
        </div>
        <Crest primary="#034694" secondary="#FFFFFF" label="CHE" />
      </div>

      {/* Answer reveal */}
      <div
        style={{
          marginTop: 60,
          transform: `translateY(${answerY}px)`,
          opacity: answerOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: COLORS.accent,
            color: COLORS.pitchDeep,
            padding: "16px 30px",
            borderRadius: 18,
            fontWeight: 900,
            fontSize: 32,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          }}
        >
          <span style={{ fontSize: 36 }}>✓</span> CESC&nbsp;FÀBREGAS
        </div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 20 }}>Pont trouvé&nbsp;!</div>
      </div>
    </div>
  );
};
