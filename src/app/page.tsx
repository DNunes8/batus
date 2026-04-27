import { studio } from "@/lib/studio.config";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
        {studio.name}
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        {studio.tagline}
      </p>
      <p className="mt-16 text-xs uppercase tracking-widest text-zinc-400">
        Em construção
      </p>
    </main>
  );
}
