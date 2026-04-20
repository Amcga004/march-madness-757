export default function FantasyGolfLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3f1ea] text-[#162317] antialiased">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(11,93,59,0.06),transparent_28%),linear-gradient(180deg,#f6f4ed_0%,#f3f1ea_42%,#eeece3_100%)]">
        {children}
      </div>
    </div>
  );
}
