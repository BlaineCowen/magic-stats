import { NextResponse } from "next/server"
import { writeFileSync } from "fs"

export const dynamic = "force-dynamic"

const DATA_DIR = "/app/data/workout"

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const rawName = (form.get("username") as string) ?? ""
    const username = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32)
    if (!username) return NextResponse.json({ error: "Invalid username" }, { status: 400 })

    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    writeFileSync(`${DATA_DIR}/${username}.csv`, buffer)
    return NextResponse.json({ ok: true, username })
  } catch (err) {
    console.error("Workout upload error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
