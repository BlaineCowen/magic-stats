"use client";

import type { TeamInfo } from "@/lib/fourth/games";

/**
 * A small football field for one snap: the offense always drives to the right, its own end zone on
 * the left in its color, the defense's on the right in theirs, the ball, and the yellow line to gain.
 */

const W = 600;
const H = 92;
const EZ = 50; // end zone width; the 100 yards between are 5 units each
const Y = (W - 2 * EZ) / 100;

// readable label color on a team color
function ink(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r! * 299 + g! * 587 + b! * 114) / 1000 > 150 ? "#111827" : "#ffffff";
}

export function MiniField({
  yardline,
  ydstogo,
  offense,
  defense,
}: {
  /** yards from the defense's goal line */
  yardline: number;
  ydstogo: number;
  offense: TeamInfo;
  defense: TeamInfo;
}) {
  const x = (yl: number) => W - EZ - yl * Y;
  const ball = x(yardline);
  const target = x(Math.max(0, yardline - ydstogo));
  const where =
    yardline === 50
      ? "midfield"
      : yardline > 50
        ? `${offense.abbr} ${100 - yardline}`
        : `${defense.abbr} ${yardline}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-md"
      role="img"
      aria-label={`Ball at the ${where}, ${ydstogo >= yardline ? "goal to go" : `${ydstogo} yards to go`}`}
    >
      {/* 10-yard stripes */}
      {Array.from({ length: 10 }, (_, i) => (
        <rect
          key={i}
          x={EZ + i * 10 * Y}
          y={0}
          width={10 * Y}
          height={H}
          fill={i % 2 ? "#2f7a4b" : "#2b7045"}
        />
      ))}
      <rect x={0} y={0} width={EZ} height={H} fill={offense.color} />
      <rect x={W - EZ} y={0} width={EZ} height={H} fill={defense.color} />
      <text
        x={EZ / 2}
        y={H / 2}
        fill={ink(offense.color)}
        fontSize={15}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(-90 ${EZ / 2} ${H / 2})`}
      >
        {offense.abbr}
      </text>
      <text
        x={W - EZ / 2}
        y={H / 2}
        fill={ink(defense.color)}
        fontSize={15}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(90 ${W - EZ / 2} ${H / 2})`}
      >
        {defense.abbr}
      </text>
      {/* yard lines and numbers */}
      {Array.from({ length: 11 }, (_, i) => (
        <line
          key={i}
          x1={EZ + i * 10 * Y}
          x2={EZ + i * 10 * Y}
          y1={0}
          y2={H}
          stroke="#ffffff"
          strokeOpacity={i === 0 || i === 10 ? 0.9 : 0.35}
        />
      ))}
      {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((n, i) => (
        <text
          key={i}
          x={EZ + (i + 1) * 10 * Y}
          y={H - 6}
          fill="#ffffff"
          fillOpacity={0.55}
          fontSize={11}
          textAnchor="middle"
        >
          {n}
        </text>
      ))}
      {/* what they need */}
      <rect
        x={Math.min(ball, target)}
        y={6}
        width={Math.abs(target - ball)}
        height={H - 22}
        fill="#facc15"
        fillOpacity={0.28}
      />
      <line
        x1={target}
        x2={target}
        y1={2}
        y2={H - 14}
        stroke="#facc15"
        strokeWidth={3}
      />
      <ellipse
        cx={ball}
        cy={(H - 14) / 2 + 3}
        rx={11}
        ry={7}
        fill="#8b4513"
        stroke="#ffffff"
        strokeWidth={1.2}
      />
      <line
        x1={ball - 4}
        x2={ball + 4}
        y1={(H - 14) / 2 + 3}
        y2={(H - 14) / 2 + 3}
        stroke="#ffffff"
        strokeWidth={1}
      />
    </svg>
  );
}
