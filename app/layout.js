import "./globals.css";
import Header from "./components/Header";
import BackgroundLogo from "./components/BackgroundLogo";

export const metadata = {
  title: "Secret Vice Automapper",
  description: "Beat Saber automapper by Secret Vice",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-deep text-white" style={{ minHeight: "100vh", position: "relative" }}>
        <BackgroundLogo />
        <Header />
        <main style={{ position: "relative", zIndex: 10 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
