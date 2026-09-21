import type { ReactNode } from "react"

import { QueryProvider } from "@/components/polyhedge/QueryProvider"

export const metadata = {
  title: "Live Draft — H-Town Ballers",
  description: "Superflex draft board that syncs with the live Sleeper draft",
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Second screen while drafting on a phone; prevent iOS zooming on the search input.
  maximumScale: 1,
}

export default function LiveDraftLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-white sm:my-4 sm:rounded-lg sm:shadow-sm">
      <QueryProvider>{children}</QueryProvider>
    </div>
  )
}
