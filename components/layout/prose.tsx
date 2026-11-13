/** Readable long-form layout for policy and help pages. */
export function Prose({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <article className="text-body text-ink-2 [&_a]:font-semibold [&_a]:text-brand [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-[1.375rem] [&_h2]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="font-display text-[2.25rem] leading-tight text-ink">{title}</h1>
      {updated ? <p className="!mt-1 text-caption text-ink-3">Last updated {updated}</p> : null}
      {children}
    </article>
  );
}
