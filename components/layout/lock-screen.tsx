"use client";

import { Delete, FingerprintPattern } from "lucide-react";
import { m, useAnimationControls } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { useFinance } from "@/hooks/use-finance";
import { biometricsAvailable, haptic, verifyBiometrics } from "@/lib/platform";
import { checkPin, lockoutSeconds, PIN_LENGTH } from "@/lib/services/security";
import { cn } from "@/lib/utils/cn";
import { useUI } from "@/stores/ui";

const ATTEMPTS_KEY = "owwy-pin-attempts";

/**
 * Locks the app behind a PIN when enabled: on launch and after the app has
 * been in the background longer than the auto-lock time. The app underneath
 * is made inert so it can't be focused or read by assistive tech while locked.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const { settings } = useFinance();
  const locked = useUI((s) => s.locked);
  const setLocked = useUI((s) => s.setLocked);
  const enabled = settings.security.pinEnabled;
  const autoLockMs = settings.security.autoLockMinutes * 60_000;
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (enabled && !sessionStorage.getItem("owwy-unlocked")) setLocked(true);
  }, [enabled, setLocked]);

  useEffect(() => {
    if (!enabled) {
      setLocked(false);
      return;
    }
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        if (autoLockMs === 0) lock();
      } else if (hiddenAt && Date.now() - hiddenAt >= autoLockMs) {
        lock();
      }
    };
    const lock = () => {
      sessionStorage.removeItem("owwy-unlocked");
      setLocked(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, autoLockMs, setLocked]);

  const showLock = enabled && locked;

  return (
    <>
      <div inert={showLock} aria-hidden={showLock || undefined} className={cn(showLock && "pointer-events-none select-none blur-xl")}>
        {children}
      </div>
      {showLock ? (
        <LockScreen
          biometric={settings.security.biometricEnabled}
          onUnlock={() => setLocked(false)}
          name={settings.displayName}
          length={settings.security.pinLength ?? PIN_LENGTH.max}
        />
      ) : null}
    </>
  );
}

function LockScreen({ onUnlock, biometric, name, length }: { onUnlock: () => void; biometric: boolean; name: string; length: number }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const shake = useAnimationControls();

  const unlock = useCallback(() => {
    sessionStorage.setItem("owwy-unlocked", "1");
    sessionStorage.removeItem(ATTEMPTS_KEY);
    void haptic("success");
    onUnlock();
  }, [onUnlock]);

  useEffect(() => {
    if (!biometric) return;
    void biometricsAvailable().then(async (available) => {
      setCanUseBiometrics(available);
      if (available && (await verifyBiometrics())) unlock();
    });
  }, [biometric, unlock]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const submit = useCallback(
    async (value: string) => {
      setChecking(true);
      const ok = await checkPin(value);
      setChecking(false);
      if (ok) return unlock();
      const attempts = Number(sessionStorage.getItem(ATTEMPTS_KEY) ?? 0) + 1;
      sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));
      const wait = lockoutSeconds(attempts);
      setCooldown(wait);
      setError(wait ? `Too many tries. Try again in ${wait} seconds.` : "That PIN didn't match. Try again.");
      setPin("");
      void haptic("warning");
      void shake.start({ x: [0, -12, 12, -8, 8, 0], transition: { duration: 0.4 } });
    },
    [shake, unlock],
  );

  const press = useCallback(
    (digit: string) => {
      if (checking || cooldown > 0 || pin.length >= length) return;
      setError(null);
      const next = pin + digit;
      setPin(next);
      if (next.length === length) void submit(next);
    },
    [checking, cooldown, submit, length, pin],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter" && pin.length >= PIN_LENGTH.min) void submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, pin, submit]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Owwy is locked"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-bg px-6 pt-[var(--safe-top)] pb-[calc(24px+var(--safe-bottom))]"
    >
      <OwwyMascot mood={error ? "concerned" : "neutral"} size={88} animated />
      <h1 className="font-display mt-4 text-[1.625rem]">{name ? `Welcome back, ${name}` : "Welcome back"}</h1>
      <p className="mt-1 text-body text-ink-2">Enter your PIN to open Owwy</p>

      <m.div animate={shake} className="mt-7 flex gap-3.5" aria-hidden>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border-2 transition-all duration-150",
              i < pin.length ? "scale-110 border-brand bg-brand" : "border-line-strong",
            )}
          />
        ))}
      </m.div>
      <p className="mt-4 h-5 text-callout font-medium text-negative" role="alert">
        {error}
      </p>

      <div className="mt-4 grid w-full max-w-[300px] grid-cols-3 gap-3">
        {keys.map((k) => (
          <PinKey key={k} onClick={() => press(k)} disabled={cooldown > 0}>
            {k}
          </PinKey>
        ))}
        {canUseBiometrics ? (
          <PinKey onClick={async () => (await verifyBiometrics()) && unlock()} label="Unlock with biometrics" subtle>
            <FingerprintPattern className="size-7" />
          </PinKey>
        ) : pin.length >= PIN_LENGTH.min && pin.length < length ? (
          <PinKey onClick={() => submit(pin)} label="Unlock" subtle>
            <span className="text-callout font-bold">OK</span>
          </PinKey>
        ) : (
          <span />
        )}
        <PinKey onClick={() => press("0")} disabled={cooldown > 0}>
          0
        </PinKey>
        <PinKey onClick={() => setPin((p) => p.slice(0, -1))} label="Delete last digit" subtle>
          <Delete className="size-6" />
        </PinKey>
      </div>
      <p className="mt-8 max-w-xs text-center text-caption text-ink-3">Forgot your PIN? For your privacy, Owwy can only be reset by clearing its data from this device&apos;s settings.</p>
    </div>
  );
}

function PinKey({ children, onClick, label, subtle, disabled }: { children: React.ReactNode; onClick: () => void; label?: string; subtle?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "press flex h-[68px] items-center justify-center rounded-[22px] text-[1.75rem] font-semibold outline-none disabled:opacity-40",
        subtle ? "text-ink-2 hover:bg-surface-2" : "bg-surface text-ink shadow-xs hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
