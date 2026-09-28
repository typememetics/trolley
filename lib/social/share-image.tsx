import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The card X and Open Graph both show: the social art centered on the page's white, at their 1.91:1

export const shareImageAlt = "A runaway trolley, AGI at the lever, two developers on the tracks: Will AGI save you?";
export const shareImageSize = { width: 1200, height: 630 };

export async function renderShareImage() {
  const art = await readFile(join(process.cwd(), "public/images/social.png"));
  const src = `data:image/png;base64,${art.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* 886×670 source, scaled to leave a margin top and bottom */}
        <img src={src} width={806} height={610} alt=""/>
      </div>
    ),
    shareImageSize,
  );
}
