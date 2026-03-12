type Params = {
  params: Promise<{ slug: string }>;
};

export default async function PublicLeaguePage({ params }: Params) {
  const { slug } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center p-8">
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-bold">Public Standings Page</h1>

        <p className="mt-4 text-gray-600">
          This is the public standings page for:
        </p>

        <p className="mt-2 rounded-lg bg-slate-100 px-4 py-2 font-mono text-sm">
          {slug}
        </p>

        <p className="mt-4 text-gray-600">
          Later this page will show live standings, rosters, and bracket progress.
        </p>
      </div>
    </main>
  );
}