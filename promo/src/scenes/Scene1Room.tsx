import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Room } from "../components/Room";
import { Character } from "../components/Character";
import { COLORS, FONT } from "../theme";

const FRIENDS = [
  { skin: COLORS.skin[1], hair: COLORS.hair[1], hoodie: COLORS.hoodie[0], hairStyle: "short" as const, phase: 0 },
  { skin: COLORS.skin[3], hair: COLORS.hair[2], hoodie: COLORS.hoodie[1], hairStyle: "curly" as const, phase: 1.5 },
  { skin: COLORS.skin[0], hair: COLORS.hair[3], hoodie: COLORS.hoodie[2], hairStyle: "cap" as const, phase: 3 },
];

export const Scene1Room: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleIn = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const titleY = interpolate(titleIn, [0, 1], [60, 0]);

  return (
    <AbsoluteFill>
      <Room lampGlow={0.4 + 0.2 * Math.sin(frame / 20)} />

      {/* Friends sitting in a row */}
      <div style={{ position: "absolute", bottom: "16%", left: 0, width: "100%", display: "flex", justifyContent: "center", gap: 30, alignItems: "flex-end" }}>
        {FRIENDS.map((f, i) => {
          const bob = Math.sin(frame / 16 + f.phase) * 5;
          const lean = Math.sin(frame / 24 + f.phase) * 3;
          const enter = spring({ frame: frame - i * 6, fps, config: { damping: 13 } });
          return (
            <div
              key={i}
              style={{
                width: 280,
                height: 460,
                transform: `translateY(${interpolate(enter, [0, 1], [120, 0])}px)`,
                opacity: enter,
              }}
            >
              <Character {...f} bob={bob} lean={lean} />
            </div>
          );
        })}
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: "6%",
          left: 0,
          width: "100%",
          textAlign: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleIn,
          fontFamily: FONT,
        }}
      >
        <div style={{ color: COLORS.white, fontSize: 64, fontWeight: 900, textShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
          Soirée entre potes.
        </div>
        <div style={{ color: COLORS.accent, fontSize: 44, fontWeight: 800, marginTop: 8 }}>
          Une seule question…
        </div>
      </div>
    </AbsoluteFill>
  );
};
