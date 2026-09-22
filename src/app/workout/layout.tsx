import type { ReactNode } from "react"

export const metadata = {
  title: "Workout Dashboard",
}

export default function WorkoutLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: "#0f1117", minHeight: "100vh", color: "#e2e8f0" }}>
      {children}
    </div>
  )
}
