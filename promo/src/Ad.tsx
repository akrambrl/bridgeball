import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene1Room } from "./scenes/Scene1Room";
import { Scene2Gameplay } from "./scenes/Scene2Gameplay";
import { Scene3Reaction } from "./scenes/Scene3Reaction";
import { Scene4Logo } from "./scenes/Scene4Logo";
import { COLORS } from "./theme";

/** Fades its children in at the start and out at the end of the local sequence. */
const Fade: React.FC<{ duration: number; fade?: number; children: React.ReactNode }> = ({
  duration,
  fade = 14,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, fade, duration - fade, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const Ad: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const S1 = 130;
  const S2 = 160;
  const S3 = 110;
  const S4 = 130;

  // Subtle final fade to black at the very end
  const outro = interpolate(frame, [durationInFrames - 8, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: COLORS.pitchDeep }}>
      <Sequence from={0} durationInFrames={S1}>
        <Fade duration={S1}>
          <Scene1Room />
        </Fade>
      </Sequence>

      <Sequence from={120} durationInFrames={S2}>
        <Fade duration={S2}>
          <Scene2Gameplay />
        </Fade>
      </Sequence>

      <Sequence from={270} durationInFrames={S3}>
        <Fade duration={S3}>
          <Scene3Reaction />
        </Fade>
      </Sequence>

      <Sequence from={360} durationInFrames={S4}>
        <Fade duration={S4} fade={12}>
          <Scene4Logo />
        </Fade>
      </Sequence>

      <AbsoluteFill style={{ background: "#000", opacity: outro, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
