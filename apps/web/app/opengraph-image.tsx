import { ImageResponse } from "next/og"

export const alt = "CustomerSignal AI — Your customers are telling you what to build next."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #101B35 0%, #0c1a24 60%, #0b2a33 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #4169F5, #5FA8F0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="38" height="38" viewBox="0 0 32 32">
              <path
                d="M4 18.5c2.2 0 2.2-6 4.4-6s2.2 9 4.4 9 2.2-12 4.4-12 2.2 9 4.4 9 2.2-4 4.4-4"
                fill="none"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>
            CustomerSignal<span style={{ color: "#BCCBFD", marginLeft: 8 }}>AI</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Your customers are telling you what to build next.
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "rgba(220,232,240,0.75)", maxWidth: 900 }}>
            AI-powered review analysis, competitor intelligence and product opportunity discovery.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "rgba(166,180,192,0.6)" }}>customersignal.ai</div>
      </div>
    ),
    size,
  )
}
