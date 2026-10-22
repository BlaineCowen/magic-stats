import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The home-screen icon: the favicon drawn full-bleed at 180px (iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const svg = readFileSync(
    join(process.cwd(), "src/app/magic-stats/icon.svg"),
    "utf8",
  ).replace('rx="14"', 'rx="0"');
  return new ImageResponse(
    (
      <img
        src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        width={180}
        height={180}
        alt=""
      />
    ),
    size,
  );
}
