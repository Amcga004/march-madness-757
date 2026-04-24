import "./globals.css";

export const metadata = {
  title: "EdgePulse — Sports Betting Intelligence & Fantasy",
  description: "Real-time betting signals, edge analysis, and fantasy sports for NBA, MLB, NHL and PGA Tour. Built for serious bettors.",
  openGraph: {
    title: "EdgePulse — Sports Betting Intelligence & Fantasy",
    description: "Find your edge. Real-time signals across NBA, MLB, NHL and PGA Tour.",
    url: "https://www.edgepulse.ai",
    siteName: "EdgePulse",
  },
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
