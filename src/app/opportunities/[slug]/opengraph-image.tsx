import { ImageResponse } from "next/og";
import { opportunity } from "@/lib/queries";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PainRadar evidence-backed opportunity";
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const o = await opportunity(slug);
  return new ImageResponse(
    <div
      style={{
        background: "#0b0b10",
        color: "#f0eff7",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 80,
        justifyContent: "space-between",
        borderBottom: "8px solid #ac8dff",
      }}
    >
      <div style={{ display: "flex", color: "#bba2ff", fontSize: 30 }}>
        PainRadar · Evidence first. AI second.
      </div>
      <div style={{ display: "flex", fontSize: 60, letterSpacing: -2 }}>
        {o?.public ? o.title : "Find problems worth building."}
      </div>
      <div style={{ display: "flex", color: "#aaa3b8", fontSize: 28 }}>
        {o?.public
          ? `${o.mentions} observed signals · ${o.confidence} confidence`
          : "Market intelligence for builders"}
      </div>
    </div>,
    size,
  );
}
