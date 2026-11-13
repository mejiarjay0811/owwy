import Link from "@/components/ui/app-link";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-bg px-8 text-center">
      <OwwyMascot mood="thinking" size={112} />
      <h1 className="font-display mt-5 text-[2rem]">This branch is empty</h1>
      <p className="mt-2 max-w-sm text-body text-ink-2">Owwy looked everywhere, but this page doesn&apos;t exist.</p>
      <Link href="/" className="press mt-6 inline-flex h-11 items-center rounded-full bg-brand px-6 font-semibold text-brand-ink">
        Back home
      </Link>
    </main>
  );
}
