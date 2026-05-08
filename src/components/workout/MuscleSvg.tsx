// src/components/workout/MuscleSvg.tsx
"use client"

import type { MouseEvent, ReactNode } from "react"
import type { MuscleId } from "@/lib/muscleMap"

interface Props {
  view: "front" | "back"
  intensities: Map<MuscleId, number>          // 0–1 normalized
  onHover: (id: MuscleId | null, e?: MouseEvent<SVGElement>) => void
}

function fill(intensities: Map<MuscleId, number>, id: MuscleId) {
  const v = intensities.get(id) ?? 0
  return v === 0 ? "rgba(255,255,255,0.06)" : `rgba(0,170,255,${(v * 0.82 + 0.08).toFixed(2)})`
}

function MuscleRegion({
  id, intensities, onHover, children,
}: {
  id: MuscleId
  intensities: Map<MuscleId, number>
  onHover: Props["onHover"]
  children: ReactNode
}) {
  return (
    <g
      data-muscle={id}
      style={{ cursor: "crosshair" }}
      onMouseEnter={e => onHover(id, e as unknown as MouseEvent<SVGElement>)}
      onMouseLeave={e => onHover(null, e as unknown as MouseEvent<SVGElement>)}
    >
      {children}
    </g>
  )
}

export default function MuscleSvg({ view, intensities, onHover }: Props) {
  const r = (id: MuscleId) => fill(intensities, id)
  const stroke = "#2d3748"
  const sw = 0.8

  if (view === "front") {
    return (
      <svg viewBox="0 0 110 260" style={{ width: "100%", maxWidth: "160px" }}>
        {/* Body silhouette (not interactive) */}
        <ellipse cx="55" cy="18" rx="16" ry="17" fill="#1e2535" stroke={stroke} strokeWidth="0.5" />
        {/* Neck */}
        <rect x="48" y="33" width="14" height="12" rx="2" fill="#1e2535" />

        {/* Upper chest */}
        <MuscleRegion id="upper-chest" intensities={intensities} onHover={onHover}>
          <rect x="33" y="48" width="44" height="14" rx="4" fill={r("upper-chest")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Lower chest */}
        <MuscleRegion id="lower-chest" intensities={intensities} onHover={onHover}>
          <rect x="31" y="62" width="48" height="20" rx="4" fill={r("lower-chest")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Anterior deltoid L/R */}
        <MuscleRegion id="ant-deltoid" intensities={intensities} onHover={onHover}>
          <ellipse cx="22" cy="58" rx="11" ry="13" fill={r("ant-deltoid")} stroke={stroke} strokeWidth={sw} />
          <ellipse cx="88" cy="58" rx="11" ry="13" fill={r("ant-deltoid")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Lateral deltoid L/R (outer cap of shoulder) */}
        <MuscleRegion id="lat-deltoid" intensities={intensities} onHover={onHover}>
          <ellipse cx="14" cy="52" rx="7" ry="8" fill={r("lat-deltoid")} stroke={stroke} strokeWidth={sw} />
          <ellipse cx="96" cy="52" rx="7" ry="8" fill={r("lat-deltoid")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Biceps L/R */}
        <MuscleRegion id="biceps" intensities={intensities} onHover={onHover}>
          <rect x="6" y="76" width="12" height="30" rx="5" fill={r("biceps")} stroke={stroke} strokeWidth={sw} />
          <rect x="92" y="76" width="12" height="30" rx="5" fill={r("biceps")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Forearms L/R */}
        <MuscleRegion id="forearms" intensities={intensities} onHover={onHover}>
          <rect x="5" y="108" width="12" height="26" rx="4" fill={r("forearms")} stroke={stroke} strokeWidth={sw} />
          <rect x="93" y="108" width="12" height="26" rx="4" fill={r("forearms")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Upper abs */}
        <MuscleRegion id="upper-abs" intensities={intensities} onHover={onHover}>
          <rect x="35" y="84" width="40" height="18" rx="3" fill={r("upper-abs")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Lower abs */}
        <MuscleRegion id="lower-abs" intensities={intensities} onHover={onHover}>
          <rect x="37" y="102" width="36" height="16" rx="3" fill={r("lower-abs")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Obliques L/R */}
        <MuscleRegion id="obliques" intensities={intensities} onHover={onHover}>
          <path d="M22,84 L35,84 L33,118 L20,124 Z" fill={r("obliques")} stroke={stroke} strokeWidth={sw} />
          <path d="M75,84 L88,84 L90,124 L77,118 Z" fill={r("obliques")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Hip flexors */}
        <MuscleRegion id="hip-flexors" intensities={intensities} onHover={onHover}>
          <ellipse cx="43" cy="146" rx="10" ry="7" fill={r("hip-flexors")} stroke={stroke} strokeWidth={sw} />
          <ellipse cx="67" cy="146" rx="10" ry="7" fill={r("hip-flexors")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Quads L/R */}
        <MuscleRegion id="quads" intensities={intensities} onHover={onHover}>
          <rect x="29" y="152" width="20" height="50" rx="5" fill={r("quads")} stroke={stroke} strokeWidth={sw} />
          <rect x="61" y="152" width="20" height="50" rx="5" fill={r("quads")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Calves L/R */}
        <MuscleRegion id="calves" intensities={intensities} onHover={onHover}>
          <rect x="30" y="206" width="18" height="42" rx="5" fill={r("calves")} stroke={stroke} strokeWidth={sw} />
          <rect x="62" y="206" width="18" height="42" rx="5" fill={r("calves")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>
      </svg>
    )
  }

  // ── Back view ────────────────────────────────────────────────────────────────
  return (
    <svg viewBox="0 0 110 260" style={{ width: "100%", maxWidth: "160px" }}>
      {/* Head */}
      <ellipse cx="55" cy="18" rx="16" ry="17" fill="#1e2535" stroke={stroke} strokeWidth="0.5" />
      {/* Neck */}
      <rect x="48" y="33" width="14" height="12" rx="2" fill="#1e2535" />

      {/* Trapezius */}
      <MuscleRegion id="traps" intensities={intensities} onHover={onHover}>
        <path d="M48,35 L62,35 L90,56 L80,68 L55,74 L30,68 L20,56 Z"
          fill={r("traps")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Posterior deltoid L/R */}
      <MuscleRegion id="post-deltoid" intensities={intensities} onHover={onHover}>
        <ellipse cx="22" cy="60" rx="11" ry="13" fill={r("post-deltoid")} stroke={stroke} strokeWidth={sw} />
        <ellipse cx="88" cy="60" rx="11" ry="13" fill={r("post-deltoid")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Lateral deltoid L/R (outer cap, visible from back too) */}
      <MuscleRegion id="lat-deltoid" intensities={intensities} onHover={onHover}>
        <ellipse cx="14" cy="52" rx="7" ry="8" fill={r("lat-deltoid")} stroke={stroke} strokeWidth={sw} />
        <ellipse cx="96" cy="52" rx="7" ry="8" fill={r("lat-deltoid")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Upper back (rhomboids) */}
      <MuscleRegion id="upper-back" intensities={intensities} onHover={onHover}>
        <rect x="34" y="68" width="42" height="22" rx="3" fill={r("upper-back")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Lats L/R */}
      <MuscleRegion id="lats" intensities={intensities} onHover={onHover}>
        <path d="M20,68 L35,72 L42,148 L22,148 Z" fill={r("lats")} stroke={stroke} strokeWidth={sw} />
        <path d="M90,68 L75,72 L68,148 L88,148 Z" fill={r("lats")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Lower back */}
      <MuscleRegion id="lower-back" intensities={intensities} onHover={onHover}>
        <rect x="36" y="112" width="38" height="30" rx="3" fill={r("lower-back")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Triceps L/R */}
      <MuscleRegion id="triceps" intensities={intensities} onHover={onHover}>
        <rect x="6" y="76" width="12" height="30" rx="5" fill={r("triceps")} stroke={stroke} strokeWidth={sw} />
        <rect x="92" y="76" width="12" height="30" rx="5" fill={r("triceps")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Forearms L/R (back) */}
      <MuscleRegion id="forearms" intensities={intensities} onHover={onHover}>
        <rect x="5" y="108" width="12" height="26" rx="4" fill={r("forearms")} stroke={stroke} strokeWidth={sw} />
        <rect x="93" y="108" width="12" height="26" rx="4" fill={r("forearms")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Glutes L/R */}
      <MuscleRegion id="glutes" intensities={intensities} onHover={onHover}>
        <ellipse cx="38" cy="160" rx="18" ry="16" fill={r("glutes")} stroke={stroke} strokeWidth={sw} />
        <ellipse cx="72" cy="160" rx="18" ry="16" fill={r("glutes")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Hamstrings L/R */}
      <MuscleRegion id="hamstrings" intensities={intensities} onHover={onHover}>
        <rect x="29" y="174" width="20" height="44" rx="5" fill={r("hamstrings")} stroke={stroke} strokeWidth={sw} />
        <rect x="61" y="174" width="20" height="44" rx="5" fill={r("hamstrings")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Calves L/R (back) */}
      <MuscleRegion id="calves" intensities={intensities} onHover={onHover}>
        <rect x="30" y="222" width="18" height="36" rx="5" fill={r("calves")} stroke={stroke} strokeWidth={sw} />
        <rect x="62" y="222" width="18" height="36" rx="5" fill={r("calves")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>
    </svg>
  )
}
