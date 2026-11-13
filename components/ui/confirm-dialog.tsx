"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Extra content such as "Export first" or a typed confirmation. */
  children?: React.ReactNode;
  confirmDisabled?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  children,
  confirmDisabled,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div className="fixed inset-0 z-[60] bg-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-5">
              <Dialog.Content asChild forceMount role="alertdialog">
                <m.div
                  className="pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-bg-elevated p-6 shadow-lg outline-none"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Dialog.Title className="font-display text-[1.375rem] leading-tight">{title}</Dialog.Title>
                  <Dialog.Description asChild>
                    <div className="mt-2 text-body text-ink-2">{description}</div>
                  </Dialog.Description>
                  {children ? <div className="mt-4">{children}</div> : null}
                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Dialog.Close asChild>
                      <Button variant="secondary" disabled={busy}>
                        {cancelLabel}
                      </Button>
                    </Dialog.Close>
                    <Button variant={destructive ? "danger" : "primary"} onClick={confirm} loading={busy} disabled={confirmDisabled}>
                      {confirmLabel}
                    </Button>
                  </div>
                </m.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
