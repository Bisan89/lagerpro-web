import "./globals.css";

export const metadata = {
  title: "Lager Pro",
  description: "Lager Pro Web",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar">
      <body>{children}</body>
    </html>
  );
}
