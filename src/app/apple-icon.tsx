import { ImageResponse } from "next/og";

// Apple touch icon — used when a student adds the app to their iOS
// home screen. Same simple placeholder as the favicon, scaled up.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 140,
          fontWeight: 900,
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        B
      </div>
    ),
    size,
  );
}
