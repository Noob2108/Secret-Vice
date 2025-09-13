import "./globals.css";
import Header from "./components/Header";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <Header />
        {children}
      </body>
    </html>
  );
}
