import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../theme";

/** Stylised bedroom interior used as the backdrop for the friends scenes. */
export const Room: React.FC<{ lampGlow?: number }> = ({ lampGlow = 0 }) => {
  return (
    <AbsoluteFill>
      {/* Wall */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLORS.wall}, ${COLORS.wallDark})` }} />

      {/* Floor */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "26%", background: COLORS.floor }} />
      <div style={{ position: "absolute", bottom: "26%", left: 0, width: "100%", height: 6, background: "rgba(0,0,0,0.25)" }} />

      {/* Window with night sky */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "8%",
          width: 300,
          height: 360,
          background: "linear-gradient(180deg, #11203A, #1B2E50)",
          border: "14px solid #15121F",
          borderRadius: 10,
          boxShadow: "0 0 60px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ position: "absolute", left: "50%", top: 0, width: 6, height: "100%", background: "#15121F", transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", top: "50%", left: 0, height: 6, width: "100%", background: "#15121F", transform: "translateY(-50%)" }} />
        {/* moon */}
        <div style={{ position: "absolute", top: 34, right: 34, width: 60, height: 60, borderRadius: "50%", background: "#F4F1D0", boxShadow: "0 0 40px rgba(244,241,208,0.6)" }} />
        {/* stars */}
        {[[40, 200], [90, 120], [200, 250], [150, 60], [60, 300]].map(([x, y], i) => (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 4, height: 4, borderRadius: "50%", background: "#FFF" }} />
        ))}
      </div>

      {/* Poster: a football pitch nod to the brand */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "9%",
          width: 240,
          height: 320,
          background: COLORS.pitchDark,
          borderRadius: 8,
          border: "8px solid #15121F",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${(i * 100) / 6}%`, top: 0, width: `${100 / 6}%`, height: "100%", background: i % 2 ? COLORS.pitchLight : "transparent" }} />
        ))}
        <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 4, background: "rgba(255,255,255,0.8)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 90, height: 90, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.8)", transform: "translate(-50%,-50%)" }} />
        <div style={{ position: "absolute", bottom: 14, left: 0, width: "100%", textAlign: "center", color: COLORS.accent, fontWeight: 900, fontSize: 26 }}>GOAT FC</div>
      </div>

      {/* Desk lamp glow */}
      <div
        style={{
          position: "absolute",
          top: "4%",
          left: "50%",
          width: 700,
          height: 700,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255,210,122,${0.12 + lampGlow * 0.12}), transparent 60%)`,
          pointerEvents: "none",
        }}
      />

      {/* Couch / bed the friends sit on */}
      <div style={{ position: "absolute", bottom: "20%", left: "6%", width: "88%", height: 220, background: "#4A4166", borderRadius: 30 }} />
      <div style={{ position: "absolute", bottom: "20%", left: "6%", width: "88%", height: 70, background: "#564B78", borderRadius: 30 }} />
    </AbsoluteFill>
  );
};
