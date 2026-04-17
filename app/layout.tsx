import "./globals.css";

export const metadata = {
  title: "EdgePulse",
  description: "Sports betting intelligence and fantasy. Find your edge.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
