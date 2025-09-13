// app/layout.js
import "./globals.css";
import Header from "./components/Header";

export const metadata = {
  title: "Secret Vice Automapper",
  description: "Beat Saber automapper by Secret Vice",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black text-white font-sans">
        <Header />   {/* 🔥 add this line */}
        <main>{children}</main>
      </body>
    </html>
  );
}
