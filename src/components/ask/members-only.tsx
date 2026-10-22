/** Shown instead of Magic Stats to anyone who isn't signed in. */
export function MembersOnly() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <h1 className="font-display text-5xl leading-none font-extrabold tracking-tight text-slate-900">
        Magic Stats
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">
        Magic Stats is for people with a Blaine&apos;s Sports Tools account.
        Sign in to ask questions.
      </p>
      <a
        href="/outpost.goauthentik.io/start?rd=/magic-stats"
        className="bg-turf-800 hover:bg-turf-900 focus-visible:outline-turf-700 mt-6 inline-flex rounded-md px-5 py-2.5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Sign in
      </a>
    </main>
  );
}
