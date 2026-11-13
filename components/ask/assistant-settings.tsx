"use client";

import { Check, KeyRound, Lock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, SwitchRow, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { PROVIDERS, providerInfo } from "@/lib/assistant/providers";
import { ASSISTANT_KEY_ID, clearAssistantKey, hasAssistantKey, saveSecret } from "@/lib/security/secrets";
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

  const usingAi = assistant.provider !== "local";
  const provider = providerInfo(assistant.provider);
  const baseUrl = assistant.baseUrl || provider.baseUrl;

  useEffect(() => {
    void hasAssistantKey().then(setKeySaved);
  }, []);

  /** Switching service resets the model and address to that service's own. */
  const chooseProvider = (id: string) => {
    const next = providerInfo(id);
    void updateSettings({ assistant: { provider: id, model: next.models[0]?.id ?? assistant.model, baseUrl: "" } });
  };

  const saveKey = async () => {
    const trimmed = key.trim();
    if (!trimmed && !provider.keyOptional) {
      toast.error(new Error("Paste your API key first."));
      return;
    }
    setSaving(true);
    try {
      await saveSecret(ASSISTANT_KEY_ID, trimmed);
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
    await clearAssistantKey();
    await updateSettings({ assistant: { provider: "local" } });
    setKeySaved(false);
    toast.show("Key removed. Ask Owwy now answers on this device only.");
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Answer with" className="grid gap-2">
        <ModeCard
          selected={!usingAi}
          onClick={() => void updateSettings({ assistant: { provider: "local" } })}
          icon={<Lock />}
          title="On device"
          description="Answers are worked out on your phone. Nothing leaves it, and it works offline."
        />
        <ModeCard
          selected={usingAi}
          onClick={() => usingAi || chooseProvider("anthropic")}
          icon={<Sparkles />}
          title="On device + your own AI"
          description="Bring an API key from any AI service for harder questions and messier sentences. Needs internet."
        />
      </div>

      {usingAi ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
          <Field label="AI service">
            {(props) => (
              <Select {...props} value={assistant.provider} onChange={(e) => chooseProvider(e.target.value)}>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/* Free text, not a fixed list: these services add and retire models
              constantly, and a dropdown would go stale between releases. */}
          <Field
            label="Model"
            hint={provider.models.length ? `Suggestions: ${provider.models.map((m) => m.id).join(", ")}` : undefined}
          >
            {(props) => (
              <>
                <TextInput
                  {...props}
                  value={assistant.model}
                  onChange={(e) => void updateSettings({ assistant: { model: e.target.value } })}
                  placeholder={provider.models[0]?.id ?? "model name"}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {provider.models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => void updateSettings({ assistant: { model: m.id } })}
                      aria-pressed={assistant.model === m.id}
                      className={cn(
                        "press hit inline-flex h-8 items-center rounded-full border px-3 text-caption font-bold",
                        assistant.model === m.id ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>

          {keySaved ? (
            <div className="flex items-center gap-3 rounded-xl bg-positive-soft px-3 py-2.5 text-callout text-positive">
              <KeyRound className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 font-semibold">API key saved on this device (encrypted)</span>
              <button type="button" onClick={removeKey} className="hit font-semibold underline">
                Remove
              </button>
            </div>
          ) : (
            <Field
              label="Your API key"
              hint={`${provider.keyHint}${provider.console ? ` Create one at ${provider.console}.` : ""} It's encrypted on this device, never included in backups, and only sent to the service you chose.`}
            >
              {(props) => (
                <div className="flex gap-2">
                  <TextInput {...props} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your key" autoComplete="off" spellCheck={false} />
                  <Button onClick={saveKey} loading={saving} className="h-12 shrink-0 rounded-[14px]">
                    Save
                  </Button>
                </div>
              )}
            </Field>
          )}

          <Field
            label="Address"
            hint={assistant.baseUrl ? "Custom address. Clear it to use the service's own." : "The service's own address. Change it only for a self-hosted one."}
          >
            {(props) => (
              <TextInput
                {...props}
                value={baseUrl}
                onChange={(e) => void updateSettings({ assistant: { baseUrl: e.target.value === provider.baseUrl ? "" : e.target.value } })}
                placeholder={provider.baseUrl}
                autoComplete="off"
                spellCheck={false}
                inputMode="url"
              />
            )}
          </Field>

          <SwitchRow
            checked={assistant.shareNotes}
            onCheckedChange={(shareNotes) => void updateSettings({ assistant: { shareNotes } })}
            label="Include transaction notes"
            description="Lets the AI see notes like “Lunch with team”. Amounts, dates, categories and account names are always needed."
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
          can prepare transactions for you to confirm, but it can never save, edit or delete anything on its own. Owwy has no server in between: requests go from this device straight
          to the service you chose.
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
