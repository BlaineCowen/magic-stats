// Local class-name helper for the polyhedge route.
// Intentionally not depending on tailwind-merge — these classes are plain CSS
// (see src/app/polyhedge/polyhedge.css), not Tailwind utilities, so we just
// concatenate truthy values.

export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
