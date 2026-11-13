"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Camera, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { deleteReceipt, listReceipts, MAX_ATTACHMENTS_PER_TRANSACTION } from "@/lib/storage/repositories/attachments";
import { toast } from "@/stores/ui";
import type { ID } from "@/types/models";

interface Thumb {
  key: string;
  url: string;
  onRemove: () => void;
}

/** Object URLs for blobs, revoked when they change or the component unmounts. */
function useObjectUrls(blobs: readonly Blob[]): string[] {
  const urls = useMemo(() => blobs.map((b) => URL.createObjectURL(b)), [blobs]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

/**
 * Receipt photos for a transaction. New photos wait in `pending` until the
 * transaction is saved; photos of an existing transaction show from the database.
 */
export function ReceiptPicker({ transactionId, pending, onPendingChange }: { transactionId?: ID; pending: File[]; onPendingChange: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const saved = useLiveQuery(() => (transactionId ? listReceipts(transactionId) : Promise.resolve([])), [transactionId]);
  const savedBlobs = useMemo(() => (saved ?? []).map((a) => a.blob), [saved]);
  const savedUrls = useObjectUrls(savedBlobs);
  const pendingUrls = useObjectUrls(pending);
  const [viewing, setViewing] = useState<string | null>(null);

  const thumbs: Thumb[] = [
    ...(saved ?? []).map((a, i) => ({ key: a.id, url: savedUrls[i], onRemove: () => void deleteReceipt(a.id) })),
    ...pending.map((file, i) => ({ key: `pending-${i}-${file.name}`, url: pendingUrls[i], onRemove: () => onPendingChange(pending.filter((_, j) => j !== i)) })),
  ];
  const full = thumbs.length >= MAX_ATTACHMENTS_PER_TRANSACTION;

  return (
    <div>
      <p className="mb-2 text-callout font-semibold text-ink-2">Receipt</p>
      <div className="flex flex-wrap gap-2">
        {thumbs.map((t) => (
          <div key={t.key} className="relative">
            <button type="button" onClick={() => setViewing(t.url)} className="press block size-16 overflow-hidden rounded-2xl border border-line/70 bg-surface-2" aria-label="View receipt photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
              <img src={t.url} alt="" className="size-full object-cover" />
            </button>
            <button type="button" onClick={t.onRemove} aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-ink text-ink-inverse shadow-sm">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {!full ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="press flex size-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-line-strong text-[11px] font-semibold text-ink-3 hover:border-brand hover:text-brand"
          >
            <Camera className="size-5" aria-hidden />
            Add
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-caption text-ink-3">Photos stay on this device.</p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
          e.target.value = "";
          if (!files.length) return;
          const room = MAX_ATTACHMENTS_PER_TRANSACTION - thumbs.length;
          if (files.length > room) toast.show(`Up to ${MAX_ATTACHMENTS_PER_TRANSACTION} photos per transaction`);
          onPendingChange([...pending, ...files.slice(0, room)]);
        }}
      />
      <Sheet open={Boolean(viewing)} onOpenChange={(o) => !o && setViewing(null)} title="Receipt" size="md">
        {viewing ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL
          <img src={viewing} alt="Receipt photo" className="mx-auto max-h-[70dvh] w-auto rounded-2xl" />
        ) : null}
      </Sheet>
    </div>
  );
}
