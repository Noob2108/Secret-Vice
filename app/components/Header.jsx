"use client";

export default function Header() {
  return (
    <header className="w-full">
      <div className="flex items-center gap-3">
        <img
          src="/sv-logo.png"   // put your logo file in /public/sv-logo.png
          alt="Secret Vice"
          className="h-9 w-auto drop-shadow"
        />
        <h1 className="text-xl md:text-2xl font-semibold tracking-wide">
          Secret Vice Automapper
        </h1>
      </div>
      <p className="mt-1 text-xs md:text-sm opacity-70">
        Upload audio → analyze → map → download Beat Saber zip.
      </p>
    </header>
  );
}
