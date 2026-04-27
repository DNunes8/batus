import { ImageResponse } from "next/og";

// Favicon for tabs, browser bar, etc. Black square with white "B"
// — placeholder until the real logo SVG arrives from Baltaru.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 24,
          fontWeight: 900,
          fontFamily: "Helvetica, Arial, sans-serif",
          letterSpacing: 0,
        }}
      >
        B
      </div>
    ),
    size,
  );
}
