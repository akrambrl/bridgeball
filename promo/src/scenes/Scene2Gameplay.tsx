import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GameScreen } from "../components/GameScreen";
import { COLORS, FONT } from "../theme";

export const Scene2Gameplay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Phone flies in and settles
  const enter = spring({ frame, fps, config: { damping: 16 } });
  const scale = interpolate(enter, [0, 1], [0.6, 1]);
  const rot = interpolate(enter, [0, 1], [-12, 0]);

  // Reveal progresses across the scene (question -> answer)
  const reveal = interpolate(frame, [40, durationInFrames - 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = (Math.sin(frame / 6) + 1) / 2;

  // Thumb tap around the reveal moment
  const tapWindow = interpolate(frame, [55, 65, 75], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Flash on correct answer
  const flash = interpolate(reveal, [0.78, 0.85, 1], [0, 0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${COLORS.wall}, ${COLORS.wallDark})` }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${scale}) rotate(${rot}deg)`,
            width: 620,
            height: 1240,
            borderRadius: 70,
            background: COLORS.phone,
            padding: 22,
            boxSizing: "border-box",
            boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          }}
        >
          {/* notch */}
          <div style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)", width: 160, height: 26, borderRadius: 14, background: "#000", zIndex: 5 }} />
          <div style={{ width: "100%", height: "100%", borderRadius: 50, overflow: "hidden", position: "relative" }}>
            <GameScreen reveal={reveal} pulse={pulse} />
            {/* tap ripple */}
            <div
              style={{
                position: "absolute",
                bottom: "30%",
                left: "50%",
                width: 120,
                height: 120,
                borderRadius: "50%",
                border: `4px solid ${COLORS.accent}`,
                transform: `translate(-50%,-50%) scale(${0.4 + tapWindow})`,
                opacity: tapWindow * 0.8,
              }}
            />
            {/* thumb */}
            <div
              style={{
                position: "absolute",
                bottom: -40,
                left: "54%",
                width: 90,
                height: 200,
                borderRadius: 45,
                background: COLORS.skin[1],
                transform: `translateY(${interpolate(tapWindow, [0, 1], [40, 0])}px) rotate(-18deg)`,
                boxShadow: "0 0 30px rgba(0,0,0,0.4)",
              }}
            />
            <AbsoluteFill style={{ background: COLORS.accent, opacity: flash, pointerEvents: "none" }} />
          </div>
        </div>
      </AbsoluteFill>

      {/* Caption */}
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          left: 0,
          width: "100%",
          textAlign: "center",
          fontFamily: FONT,
          opacity: enter,
        }}
      >
        <div style={{ color: COLORS.white, fontSize: 50, fontWeight: 900 }}>
          Le joueur qui relie 2 clubs.
        </div>
        <div style={{ color: COLORS.accent, fontSize: 34, fontWeight: 700, marginTop: 6 }}>
          À toi de le trouver.
        </div>
      </div>
    </AbsoluteFill>
  );
};
