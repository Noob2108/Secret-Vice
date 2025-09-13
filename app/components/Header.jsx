"use client";
import Image from "next/image";

export default function Header() {
  return (
    <header
      style={{
        position: "relative",
        height: 96,
        padding: "12px 20px",
        zIndex: 20,
        background: "transparent",
      }}
    >
      {/* Top-left corner logo */}
      <div style={{ position: "absolute", left: 20, top: 8 }}>
        <Image
          src="/logo.png"
          alt="SV glyph left"
          width={78}
          height={78}
          priority
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Top-right corner logo */}
      <div style={{ position: "absolute", right: 20, top: 8 }}>
        <Image
          src="/logo.png"
          alt="SV glyph right"
          width={78}
          height={78}
          priority
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Title centered */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Image
          src="/Title_image.png"
          alt="Secret Vice Automapper"
          width={340}
          height={80}
          priority
          style={{ objectFit: "contain", filter: "drop-shadow(0 0 10px rgba(255,42,160,.25))" }}
        />
      </div>
    </header>
  );
}
