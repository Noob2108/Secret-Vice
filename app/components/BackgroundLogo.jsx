"use client";
import Image from "next/image";

export default function BackgroundLogo() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
        opacity: 0.08,           // faded
        zIndex: 0,               // sits behind everything
        mixBlendMode: "screen",  // nice neon blend on dark bg
      }}
    >
      <Image
        src="/logo.png"          // trimmed glyph
        alt="SV watermark"
        width={900}
        height={900}
        priority
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}
