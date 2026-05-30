import React from "react";
import { COLORS } from "../theme";

type Props = {
  skin: string;
  hair: string;
  hoodie: string;
  /** Hair style variant */
  hairStyle?: "short" | "buzz" | "curly" | "cap";
  /** Subtle vertical bob for idle animation (px) */
  bob?: number;
  /** Tilt the head/upper body a touch (deg) */
  lean?: number;
  /** Arms raised celebration amount 0..1 */
  cheer?: number;
};

/**
 * A flat-design seated person holding a phone with both hands.
 * Drawn in a 200x320 viewBox; scale via the wrapping <svg> width/height.
 */
export const Character: React.FC<Props> = ({
  skin,
  hair,
  hoodie,
  hairStyle = "short",
  bob = 0,
  lean = 0,
  cheer = 0,
}) => {
  const armUp = cheer; // 0 = holding phone, 1 = arms up
  return (
    <svg viewBox="0 0 200 320" width="100%" height="100%">
      <g transform={`translate(0 ${bob})`}>
        {/* Torso / hoodie */}
        <path
          d="M50 200 Q50 150 100 150 Q150 150 150 200 L160 320 L40 320 Z"
          fill={hoodie}
        />
        {/* Hoodie shading */}
        <path d="M100 150 L100 320 L160 320 L150 200 Q150 150 100 150 Z" fill="rgba(0,0,0,0.12)" />

        {/* Neck */}
        <rect x="88" y="120" width="24" height="40" rx="10" fill={skin} />

        <g transform={`rotate(${lean} 100 110)`}>
          {/* Head */}
          <ellipse cx="100" cy="92" rx="42" ry="46" fill={skin} />
          {/* Ear */}
          <circle cx="60" cy="96" r="8" fill={skin} />
          <circle cx="140" cy="96" r="8" fill={skin} />

          {/* Hair */}
          {hairStyle === "short" && (
            <path d="M58 86 Q58 44 100 44 Q142 44 142 86 Q142 64 100 62 Q58 64 58 86 Z" fill={hair} />
          )}
          {hairStyle === "buzz" && (
            <path d="M60 84 Q62 50 100 50 Q138 50 140 84 Q120 70 100 70 Q80 70 60 84 Z" fill={hair} />
          )}
          {hairStyle === "curly" && (
            <g fill={hair}>
              <circle cx="68" cy="62" r="16" />
              <circle cx="90" cy="52" r="17" />
              <circle cx="112" cy="52" r="17" />
              <circle cx="132" cy="64" r="15" />
            </g>
          )}
          {hairStyle === "cap" && (
            <g>
              <path d="M56 78 Q56 46 100 46 Q144 46 144 78 L56 78 Z" fill={COLORS.accentDim} />
              <rect x="48" y="74" width="60" height="12" rx="6" fill={COLORS.accent} />
            </g>
          )}

          {/* Eyes */}
          <circle cx="84" cy="94" r="5" fill="#1A1A1A" />
          <circle cx="116" cy="94" r="5" fill="#1A1A1A" />
          {/* Smile */}
          <path d="M84 112 Q100 124 116 112" stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>

        {/* Arms + phone (interpolate between holding and cheering) */}
        {armUp < 0.5 ? (
          <>
            {/* Forearms coming up to hold phone */}
            <path d="M58 210 Q70 250 100 252" stroke={hoodie} strokeWidth="26" fill="none" strokeLinecap="round" />
            <path d="M142 210 Q130 250 100 252" stroke={hoodie} strokeWidth="26" fill="none" strokeLinecap="round" />
            {/* Hands */}
            <circle cx="86" cy="252" r="12" fill={skin} />
            <circle cx="114" cy="252" r="12" fill={skin} />
            {/* Phone in hands */}
            <g transform="translate(78 226)">
              <rect x="0" y="0" width="44" height="78" rx="8" fill={COLORS.phone} />
              <rect x="4" y="4" width="36" height="70" rx="5" fill={COLORS.pitchDark} />
              <line x1="4" y1="39" x2="40" y2="39" stroke={COLORS.line} strokeWidth="1.5" />
              <circle cx="22" cy="39" r="3" fill={COLORS.accent} />
            </g>
          </>
        ) : (
          <>
            {/* Arms raised in celebration */}
            <path d="M58 206 Q40 150 56 120" stroke={hoodie} strokeWidth="26" fill="none" strokeLinecap="round" />
            <path d="M142 206 Q160 150 144 120" stroke={hoodie} strokeWidth="26" fill="none" strokeLinecap="round" />
            <circle cx="56" cy="116" r="12" fill={skin} />
            <circle cx="144" cy="116" r="12" fill={skin} />
          </>
        )}
      </g>
    </svg>
  );
};
