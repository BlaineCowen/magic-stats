import { NextResponse } from "next/server"
import { readdirSync, unlinkSync } from "fs"

export const dynamic = "force-dynamic"

const DATA_DIR = "/app/data/workout"

export async function GET() {
  try {
    const files = readdirSync(DATA_DIR).filter(f => f.endsWith(".csv"))
    const others = files
      .filter(f => f !== "strong_workouts.csv")
      .map(f => f.replace(".csv", ""))
      .sort()
    return NextResponse.json({ users: ["blaine", ...others] })
  } catch {
    return NextResponse.json({ users: ["blaine"] })
  }
}

export async function DELETE(req: Request) {
  const username = new URL(req.url).searchParams.get("user") ?? ""
  const sanitized = username.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32)
  if (!sanitized || sanitized === "blaine") {
    return NextResponse.json({ error: "Cannot delete this user" }, { status: 400 })
  }
  try {
    unlinkSync(`${DATA_DIR}/${sanitized}.csv`)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
}
