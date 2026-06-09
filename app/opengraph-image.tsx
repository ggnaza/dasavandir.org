import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Dasavandir — Ուսուցման հարթակ կառուցված մանկավարժների համար";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "#1c1c1e",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Dark decorative blobs */}
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "120px",
            width: "320px",
            height: "320px",
            borderRadius: "50%",
            background: "#2a2a2c",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            right: "-40px",
            width: "280px",
            height: "280px",
            borderRadius: "50%",
            background: "#3a2020",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "200px",
            right: "320px",
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background: "#1a2535",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "64px 80px",
            width: "100%",
          }}
        >
          {/* Top row: logo + nav hint */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "48px",
            }}
          >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span
                style={{
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "-0.5px",
                }}
              >
                Dasavandir
              </span>
              <span style={{ fontSize: "20px", color: "#888888", fontWeight: 400 }}>
                .org
              </span>
            </div>
          </div>

          {/* "TEACH FOR ARMENIA" badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                background: "#e55a2b",
                borderRadius: "20px",
                padding: "8px 20px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                }}
              >
                TEACH FOR ARMENIA
              </span>
            </div>
          </div>

          {/* Main heading */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              marginBottom: "32px",
            }}
          >
            <span
              style={{
                fontSize: "62px",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.1,
                display: "flex",
              }}
            >
              Ուսուցման հարթակ
            </span>
            <span
              style={{
                fontSize: "62px",
                fontWeight: 800,
                color: "#e55a2b",
                lineHeight: 1.1,
                display: "flex",
              }}
            >
              կառուցված
            </span>
            <span
              style={{
                fontSize: "62px",
                fontWeight: 800,
                color: "#e55a2b",
                lineHeight: 1.1,
                display: "flex",
              }}
            >
              մանկավարժների համար։
            </span>
          </div>

          {/* URL */}
          <span style={{ fontSize: "18px", color: "#666666", display: "flex" }}>
            dasavandir.org
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
