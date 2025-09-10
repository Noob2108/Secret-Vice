// app/layout.js
export const metadata = {
  title: "Secret Vice Automapper",
  description: "Upload → analyze → auto-map → download",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#000", color: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
