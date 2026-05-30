import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Room } from "../components/Room";
import { Character } from "../components/Character";
import { COLORS, FONT } from "../theme";

export const Scene3Reaction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Winner starts celebrating around frame 20
  const cheer = spring({ frame: frame - 20, fps, config: { damping: 12 } });
  const jump = Math.max(0, Math.sin((frame - 20) / 5)) * 25 * cheer;

  // "VS" badge pops
  const vsPop = spring({ frame: frame - 6, fps, config: { damping: 9, mass: 0.6 } });

  // loser slumps
  const slump = interpolate(spring({ frame: frame - 25, fps, config: { damping: 14 } }), [0, 1], [0, 8]);

  return (
    <AbsoluteFill>
      <Room lampGlow={0.6} />

      <div style={{ position: "absolute", bottom: "16%", left: 0, width: "100%", display: "flex", justifyContent: "center", gap: 120, alignItems: "flex-end" }}>
        {/* Winner */}
        <div style={{ width: 300, height: 480, transform: `translateY(${-jump}px)` }}>
          <Character
            skin={COLORS.skin[1]}
            hair={COLORS.hair[1]}
            hoodie={COLORS.hoodie[0]}
            hairStyle="short"
            cheer={cheer}
            lean={Math.sin(frame / 8) * 4}
          />
        </div>
        {/* Loser */}
        <div style={{ width: 300, height: 480 }}>
          <Character
            skin={COLORS.skin[3]}
            hair={COLORS.hair[2]}
            hoodie={COLORS.hoodie[1]}
            hairStyle="curly"
            lean={slump}
            bob={slump}
          />
        </div>
      </div>

      {/* VS badge */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${vsPop}) rotate(${interpolate(vsPop, [0, 1], [-30, -8])}deg)`,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: COLORS.accent,
            color: COLORS.pitchDeep,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 90,
            fontFamily: FONT,
            boxShadow: "0 0 60px rgba(0,230,118,0.6), 0 20px 50px rgba(0,0,0,0.4)",
            marginTop: -200,
          }}
        >
          VS
        </div>
      </AbsoluteFill>

      {/* Caption */}
      <div style={{ position: "absolute", top: "8%", left: 0, width: "100%", textAlign: "center", fontFamily: FONT, opacity: cheer }}>
        <div style={{ color: COLORS.white, fontSize: 58, fontWeight: 900, textShadow: "0 4px 16px rgba(0,0,0,0.6)" }}>
          Qui sera le GOAT&nbsp;?
        </div>
      </div>
    </AbsoluteFill>
  );
};
