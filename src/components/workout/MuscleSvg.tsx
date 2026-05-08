// src/components/workout/MuscleSvg.tsx
"use client"

import Body from "react-muscle-highlighter"
import type { ExtendedBodyPart } from "react-muscle-highlighter"
import { MUSCLE_TO_LIB_SLUG, type MuscleId, type LibMuscleSlug } from "@/lib/muscleMap"

interface Props {
  view: "front" | "back"
  gender: "male" | "female"
  intensities: Map<MuscleId, number>   // 0–1 normalized
  selected: LibMuscleSlug | null
  onSelect: (slug: LibMuscleSlug | null) => void
}

// Blend from dark body color to accent blue based on intensity
function intensityToHex(intensity: number): string {
  const t = intensity === 0 ? 0 : intensity * 0.82 + 0.08
  const r = Math.round(30 + (0 - 30) * t)
  const g = Math.round(37 + (170 - 37) * t)
  const b = Math.round(53 + (255 - 53) * t)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

const MAPPED_SLUGS = new Set<string>([
  "abs", "biceps", "calves", "chest", "deltoids", "forearm",
  "gluteal", "hamstring", "lower-back", "obliques", "quadriceps",
  "trapezius", "triceps", "upper-back",
])

export default function MuscleSvg({ view, gender, intensities, selected, onSelect }: Props) {
  // Aggregate intensities per library slug (take max across merged MuscleIds)
  const slugIntensities = new Map<LibMuscleSlug, number>()
  for (const [id, v] of intensities) {
    const slug = MUSCLE_TO_LIB_SLUG[id]
    if (!slug) continue
    const cur = slugIntensities.get(slug) ?? 0
    if (v > cur) slugIntensities.set(slug, v)
  }

  // Build data array for the library
  const data: ExtendedBodyPart[] = [...slugIntensities.entries()]
    .filter(([, v]) => v > 0)
    .map(([slug, v]) => ({
      slug,
      color: slug === selected ? "#00aaff" : intensityToHex(v),
    }))

  // Ensure selected slug has the highlight color even if intensity is 0
  if (selected && !slugIntensities.has(selected)) {
    data.push({ slug: selected, color: "#334155" })
  }

  return (
    <Body
      data={data}
      side={view}
      gender={gender}
      defaultFill="#1e2535"
      defaultStroke="#2d3748"
      scale={1.2}
      onBodyPartPress={(part: ExtendedBodyPart) => {
        const slug = part.slug as LibMuscleSlug | undefined
        if (!slug || !MAPPED_SLUGS.has(slug)) return
        onSelect(selected === slug ? null : slug)
      }}
    />
  )
}
