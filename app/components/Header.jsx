"use client";
import Image from "next/image";

export default function Header() {
  return (
    <header className="relative w-full flex items-center px-6 py-4 bg-black text-white overflow-hidden">
      {/* Background faded logo */}
      <div className="absolute inset-0 flex justify-center items-center opacity-10 pointer-events-none">
        <Image
          src="/logo.png"
          alt="Secret Vice Background Logo"
          width={600}
          height={600}
          className="object-contain"
        />
      </div>

      {/* Title image top center */}
      <div className="relative z-10 flex-1 flex justify-center">
        <Image
          src="/Title_image.png"
          alt="Secret Vice Automapper Title"
          width={260}
          height={80}
          className="object-contain drop-shadow-lg"
        />
      </div>

      {/* Right corner duplicate logos */}
      <div className="flex items-center gap-4 ml-auto">
        <Image
          src="/logo.png"
          alt="Secret Vice Glyph Logo"
          width={80}
          height={80}
          className="object-contain"
        />
        <Image
          src="/logo.png"
          alt="Secret Vice Glyph Logo Duplicate"
          width={80}
          height={80}
          className="object-contain"
        />
      </div>
    </header>
  );
}
