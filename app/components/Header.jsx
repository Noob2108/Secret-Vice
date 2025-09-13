"use client";
import Image from "next/image";

export default function Header() {
  return (
    <header className="relative w-full flex items-center px-6 py-4 bg-black text-white overflow-hidden">
      {/* Background logo (faded, behind everything) */}
      <div className="absolute inset-0 flex justify-center items-center opacity-10 pointer-events-none">
        <Image
          src="/logo.png"
          alt="Secret Vice Background Logo"
          width={600}
          height={600}
          className="object-contain"
        />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex items-center gap-4">
        {/* Full logo (small, top-left) */}
        <Image
          src="/sv-logo.png"
          alt="Secret Vice Full Logo"
          width={60}
          height={60}
          className="object-contain"
        />

        {/* Title image instead of plain text */}
        <Image
          src="/Title_image.png"
          alt="Secret Vice Automapper Title"
          width={200}
          height={60}
          className="object-contain drop-shadow-lg"
        />
      </div>
    </header>
  );
}
