"use client";

import { Check, KeyRound, Lock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, SwitchRow, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { ASSISTANT_MODELS } from "@/lib/defaults/settings";
import { ANTHROPIC_KEY_ID, deleteSecret, hasSecret, saveSecret } from "@/lib/security/secrets";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";

export function AssistantSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Ask Owwy" description="Choose how questions are answered.">
      {open ? <AssistantSettingsForm onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

export function AssistantSettingsForm({ onDone }: { onDone?: () => void }) {
  const { settings } = useFinance();
  const assistant = settings.assistant;
  const [keySaved, setKeySaved] = useState<boolean | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void hasSecret(ANTHROPIC_KEY_ID).then(setKeySaved);
  }, []);

  // Choosing AI without a key just reveals the key field; answers stay on device until one is saved.
  const choose = (provider: "local" | "anthropic") => void updateSettings({ assistant: { provider } });

  const saveKey = async () => {
    const trimmed = key.trim();
    if (!/^sk-ant-[\w-]{20,}$/.test(trimmed)) {
      toast.error(new Error("That doesn't look like a Claude API key. It should start with sk-ant-."));
      return;
    }
    setSaving(true);
    try {
      await saveSecret(ANTHROPIC_KEY_ID, trimmed);
      await updateSettings({ assistant: { provider: "anthropic" } });
      setKey("");
      setKeySaved(true);
      toast.success("Key saved on this device, encrypted");
    } catch (error) {
      toast.error(error, "Couldn't save the key on this device.");
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    await deleteSecret(ANTHROPIC_KEY_ID);
    await updateSettings({ assistant: { provider: "local" } });
    setKeySaved(false);
    toast.show("Key removed. Ask Owwy now answers on this device only.");
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Answer with" className="grid gap-2">
        <ModeCard
          selected={assistant.provider === "local"}
          onClick={() => choose("local")}
          icon={<Lock />}
          title="On device"
          description="Answers are worked out on your phone. Nothing leaves it, and it works offline."
        />
        <ModeCard
          selected={assistant.provider === "anthropic"}
          onClick={() => choose("anthropic")}
          icon={<Sparkles />}
          title="On device + AI"
          description="Uses your own Claude API key for harder questions and messier sentences. Needs internet."
        />
      </div>

      {assistant.provider === "anthropic" ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
          <Field label="Model">
            {(props) => (
              <Select {...props} value={assistant.model} onChange={(e) => void updateSettings({ assistant: { model: e.target.value } })}>
                {ASSISTANT_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} — {model.hint}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {keySaved ? (
            <div className="flex items-center gap-3 rounded-xl bg-positive-soft px-3 py-2.5 text-callout text-positive">
              <KeyRound className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 font-semibold">API key saved on this device (encrypted)</span>
              <button type="button" onClick={removeKey} className="font-semibold underline">
                Remove
              </button>
            </div>
          ) : (
            <Field label="Your Claude API key" hint="Create one at console.anthropic.com. It's encrypted on this device, never included in backups, and only sent to Anthropic.">
              {(props) => (
                <div className="flex gap-2">
                  <TextInput {...props} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} />
                  <Button onClick={saveKey} loading={saving} className="h-12 shrink-0 rounded-[14px]">
                    Save
                  </Button>
                </div>
              )}
            </Field>
          )}

          <SwitchRow
            checked={assistant.shareNotes}
            onCheckedChange={(shareNotes) => void updateSettings({ assistant: { shareNotes } })}
            label="Include transaction notes"
            description="Lets Claude see notes like “Lunch with team”. Amounts, dates, categories and account names are always needed."
          />
        </div>
      ) : null}

      <SwitchRow
        checked={assistant.autoLog}
        onCheckedChange={(autoLog) => void updateSettings({ assistant: { autoLog } })}
        label="Instant log"
        description="Clear entries like “coffee 150” are saved right away, with Undo. Turn off to review before saving."
      />

      <SwitchRow
        checked={assistant.brief}
        onCheckedChange={(brief) => void updateSettings({ assistant: { brief } })}
        label="Brief answers"
        description="Short, to-the-point replies. Turn off for more detail."
      />

      <div className="rounded-2xl bg-surface-2 p-4 text-callout text-ink-2">
        <p className="font-semibold text-ink">What the AI can see</p>
        <p className="mt-1">
          Only your question, a few recent messages, your category and account names, and the results of the queries it asks Owwy to run — shown under every answer as “Ran a query”. It
          can prepare transactions for you to confirm, but it can never save, edit or delete anything on its own.
        </p>
      </div>

      {onDone ? (
        <Button size="lg" onClick={onDone}>
          Done
        </Button>
      ) : null}
    </div>
  );
}

function ModeCard({ selected, onClick, icon, title, description }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; description: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "press flex items-start gap-3 rounded-2xl border-2 p-4 text-left outline-none",
        selected ? "border-brand bg-brand-soft/50" : "border-line/70 bg-surface hover:border-line-strong",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5", selected ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-2")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-callout text-ink-2">{description}</span>
      </span>
      {selected ? <Check className="mt-1 size-5 text-brand" aria-hidden /> : null}
    </button>
  );
}
