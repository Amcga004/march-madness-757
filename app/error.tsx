"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-slate-50 text-slate-900">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-600">
              The app hit an unexpected error while loading this page.
            </p>

            {error?.digest ? (
              <p className="mt-3 text-xs text-slate-500">
                Error reference: {error.digest}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-xl bg-slate-950 px-4 py-2 text-white"
              >
                Try Again
              </button>

              <a
                href="/"
                className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Go Home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}