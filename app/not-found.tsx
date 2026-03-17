export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-sm text-slate-600">
          The page you are looking for does not exist.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="rounded-xl bg-slate-950 px-4 py-2 text-white"
          >
            Return Home
          </a>
        </div>
      </div>
    </main>
  );
}