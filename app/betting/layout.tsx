export default function BettingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#0D1117", minHeight: "100vh" }}>
      {children}
    </div>
  );
}
