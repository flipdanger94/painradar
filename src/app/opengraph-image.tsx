import { ImageResponse } from "next/og";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: 85,
        background: "#0b0b10",
        color: "#f0eff7",
        borderBottom: "8px solid #b29aff",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 30,
          color: "#b29aff",
          marginBottom: 40,
        }}
      >
        PainRadar
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 76,
          lineHeight: 1.1,
          letterSpacing: -3,
        }}
      >
        Find problems worth building.
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 28,
          color: "#9695a8",
          marginTop: 35,
        }}
      >
        Evidence first. AI second.
      </div>
    </div>,
    size,
  );
}
