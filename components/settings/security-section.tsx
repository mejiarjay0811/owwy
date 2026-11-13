"use client";

import { FingerprintPattern as Fingerprint, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Select, SwitchRow, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { biometricsAvailable, isNative, platformName } from "@/lib/platform";
import { disablePin, enablePin, isValidPin, PIN_LENGTH } from "@/lib/services/security";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { toast } from "@/stores/ui";

export function SecuritySection() {
  const { settings } = useFinance();
  const security = settings.security;
  const [setup, setSetup] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [bio, setBio] = useState(false);

  useEffect(() => {
    void biometricsAvailable().then(setBio);
  }, []);

  return (
    <div className="divide-y divide-line/60">
      <SwitchRow
        checked={security.pinEnabled}
        onCheckedChange={(on) => (on ? setSetup(true) : setConfirmOff(true))}
        label="App lock"
        description={security.pinEnabled ? "Owwy asks for your PIN when it opens." : "Require a PIN to open Owwy."}
        icon={<Lock className="size-5 text-ink-3" aria-hidden />}
      />
      {security.pinEnabled ? (
        <>
          <div className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">Lock after</p>
              <p className="text-callout text-ink-3">Time in the background before locking</p>
            </div>
            <div className="w-40">
              <Select value={String(security.autoLockMinutes)} onChange={(e) => void updateSettings({ security: { autoLockMinutes: Number(e.target.value) } })} aria-label="Lock after">
                <option value="0">Immediately</option>
                <option value="1">1 minute</option>
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
                <option value="60">1 hour</option>
              </Select>
            </div>
          </div>
          <div className="py-3">
            <Button variant="secondary" size="sm" onClick={() => setSetup(true)}>
              Change PIN
            </Button>
          </div>
          {bio ? (
            <SwitchRow
              checked={security.biometricEnabled}
              onCheckedChange={(biometricEnabled) => void updateSettings({ security: { biometricEnabled } })}
              label={platformName() === "ios" ? "Face ID / Touch ID" : "Fingerprint or face unlock"}
              description="Unlock with biometrics; your PIN still works."
              icon={<Fingerprint className="size-5 text-ink-3" aria-hidden />}
            />
          ) : null}
        </>
      ) : null}
      <SwitchRow
        checked={settings.hideBalances}
        onCheckedChange={(hideBalances) => void updateSettings({ hideBalances })}
        label="Hide balances"
        description="Show •••••• instead of amounts — handy in public. Also on the 👁 button."
      />
      <p className="py-3 text-caption text-ink-3">
        {isNative()
          ? "In the mobile app, Owwy's screen is hidden in the app switcher."
          : "Your data lives in this browser's private storage on this device. App lock keeps it from casual view; for full-device protection, use your phone's screen lock too."}
      </p>

      <PinSetupSheet open={setup} onOpenChange={setSetup} />
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Turn off app lock?"
        description="Anyone with this device unlocked will be able to open Owwy."
        confirmLabel="Turn off"
        destructive
        onConfirm={async () => {
          await disablePin();
          toast.show("App lock turned off");
        }}
      />
    </div>
  );
}

function PinSetupSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Set a PIN" description="Only a secure hash of your PIN is stored on this device." size="sm">
      {/* Mounted only while open, so typed digits never linger. */}
      {open ? <PinForm onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function PinForm({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!isValidPin(pin)) return setError(`Use ${PIN_LENGTH.min} to ${PIN_LENGTH.max} digits.`);
    if (pin !== again) return setError("The PINs don't match.");
    if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin)) return setError("Pick something harder to guess than repeated or sequential digits.");
    setSaving(true);
    try {
      await enablePin(pin);
      sessionStorage.setItem("owwy-unlocked", "1");
      toast.success("App lock is on");
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const digits = (value: string) => value.replace(/\D/g, "").slice(0, PIN_LENGTH.max);

  return (
    <>
      <div className="flex flex-col gap-4">
        <Field label="New PIN" error={error}>
          {(props) => <TextInput {...props} type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(digits(e.target.value))} className="tabular tracking-[0.5em]" />}
        </Field>
        <Field label="Enter it again">
          {(props) => <TextInput {...props} type="password" inputMode="numeric" autoComplete="new-password" value={again} onChange={(e) => setAgain(digits(e.target.value))} className="tabular tracking-[0.5em]" />}
        </Field>
        <p className="text-caption text-ink-3">If you forget it, the only way back in is clearing Owwy&apos;s data on this device — keep a backup.</p>
        <Button size="lg" onClick={save} loading={saving}>
          Turn on app lock
        </Button>
      </div>
    </>
  );
}
