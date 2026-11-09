import { ImageResponse } from "next/og"

export const dynamic = "force-static"

export const size = {
  width: 32,
  height: 32,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: "#e8e4dd",
          background: "#0c0c0d",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid #ffb454",
          borderRadius: 6,
        }}
      >
        F
      </div>
    ),
    {
      ...size,
    }
  )
}
