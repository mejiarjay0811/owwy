"use client";

import { Bell, ChevronRight, Coins, Crown, Info, LifeBuoy, Monitor, Moon, Repeat, ScrollText, ShieldCheck, SlidersHorizontal, Sun, SunMoon, Tags } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useEffect, useState } from "react";
import { AssistantSettingsForm } from "@/components/ask/assistant-settings";
import { CustomizeSheet } from "@/components/dashboard/dashboard";
import { Page, PageHeader } from "@/components/layout/page";
import { OwwyMark } from "@/components/owwy/owwy-mascot";
import { CategoriesSheet } from "@/components/settings/categories-sheet";
import { DataSection } from "@/components/settings/data-section";
import { ExchangeRatesSheet } from "@/components/settings/exchange-rates-sheet";
import { SecuritySection } from "@/components/settings/security-section";
import { Card } from "@/components/ui/display";
import { Field, Segmented, Select, SwitchRow, TextInput } from "@/components/ui/form";
import { useFinance } from "@/hooks/use-finance";
import { APP_VERSION } from "@/lib/app-info";
import { CURRENCY_LIST, getCurrency } from "@/lib/money";
import { isNative } from "@/lib/platform";
import { describeTimeOfDayTheme } from "@/lib/theme";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { toast } from "@/stores/ui";
import type { CurrencyCode, ThemePreference } from "@/types/models";

export default function SettingsPage() {
  const { settings, data, state } = useFinance();
  const [name, setName] = useState(settings.displayName);
  const [customize, setCustomize] = useState(false);
  const [categories, setCategories] = useState(false);
  const [rates, setRates] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, []);

  return (
    <Page>
      <PageHeader title="Settings" back="/more/" />

      <div className="flex flex-col gap-8">
        <Section title="You">
          <Card className="p-4">
            <Field label="What should Owwy call you?">
              {(props) => (
                <TextInput
                  {...props}
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => name !== settings.displayName && void updateSettings({ displayName: name.trim() })}
                  placeholder="Your first name"
                />
              )}
            </Field>
          </Card>
        </Section>

        <Section title="Appearance">
          <Card className="p-4">
            <Segmented<ThemePreference>
              label="Theme"
              size="sm"
              // Four options don't fit with icons on a narrow phone; the labels carry the meaning.
              className="[&_svg]:hidden min-[400px]:[&_svg]:inline"
              value={settings.theme}
              onChange={(theme) => void updateSettings({ theme })}
              options={[
                { value: "light", label: "Light", icon: <Sun /> },
                { value: "dark", label: "Dark", icon: <Moon /> },
                { value: "system", label: "System", icon: <Monitor /> },
                { value: "timeOfDay", label: "Clock", icon: <SunMoon /> },
              ]}
            />
            <p className="mt-2.5 px-1 text-caption text-ink-3">
              {settings.theme === "timeOfDay"
                ? describeTimeOfDayTheme()
                : settings.theme === "system"
                  ? "Follows your phone's light or dark setting."
                  : "Clock follows the time of day — light in the morning, dark in the evening."}
            </p>
          </Card>
        </Section>

        <Section title="Ask Owwy" id="assistant">
          <Card className="p-4">
            <AssistantSettingsForm />
          </Card>
        </Section>

        <Section title="Money setup">
          <Card className="divide-y divide-line/60 px-4">
            <div className="py-3">
              <Field label="Main currency" hint="Changing this relabels amounts; it doesn't convert them.">
                {(props) => (
                  <Select
                    {...props}
                    value={settings.currency}
                    onChange={(e) => {
                      const currency = e.target.value as CurrencyCode;
                      // Rates are expressed in the main currency, so they no longer apply.
                      void updateSettings({ currency, locale: getCurrency(currency).locale, exchangeRates: {} });
                      toast.show(`Currency set to ${currency}`, { description: data.transactions.length ? "Existing amounts were not converted." : undefined });
                    }}
                  >
                    {CURRENCY_LIST.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.symbol} {c.code} — {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <span className="font-semibold">Week starts on</span>
              <div className="w-36">
                <Select value={String(settings.weekStartsOn)} onChange={(e) => void updateSettings({ weekStartsOn: Number(e.target.value) as 0 | 1 })} aria-label="Week starts on">
                  <option value="1">Monday</option>
                  <option value="0">Sunday</option>
                </Select>
              </div>
            </div>
            <RowButton
              onClick={() => setRates(true)}
              icon={<Coins />}
              label="Exchange rates"
              description={state.multiCurrency ? "For your accounts in other currencies" : "For accounts in other currencies, like a USD card"}
            />
            <RowLink href="/safe-to-spend/" icon={<ShieldCheck />} label="Safe to spend" description="Payday, savings plan, cushion" />
            <RowLink href="/recurring/" icon={<Repeat />} label="Automations" description="Salary, savings transfers, rent" />
            <RowButton onClick={() => setCategories(true)} icon={<Tags />} label="Categories" description="Rename, hide, add your own" />
            <RowButton onClick={() => setCustomize(true)} icon={<SlidersHorizontal />} label="Customize home" description="Choose and reorder sections" />
            <SwitchRow checked={settings.showNetWorth} onCheckedChange={(showNetWorth) => void updateSettings({ showNetWorth })} label="Show net worth" description="On Accounts and Stats" />
          </Card>
        </Section>

        <Section title="Security & privacy" id="security">
          <Card className="px-4">
            <SecuritySection />
          </Card>
        </Section>

        <Section title="Notifications">
          <Card className="px-4">
            <SwitchRow
              checked={settings.billReminders}
              onCheckedChange={(billReminders) => void updateSettings({ billReminders })}
              label="Bill reminders"
              description={isNative() ? "On-device notifications before bills are due." : "Shown inside Owwy. The mobile app can also send notifications."}
              icon={<Bell className="size-5 text-ink-3" aria-hidden />}
            />
          </Card>
        </Section>

        <Section title="Your data" id="data">
          <DataSection />
        </Section>

        <Section title="About">
          <Card className="divide-y divide-line/60 px-4">
            <RowLink href="/premium/" icon={<Crown />} label="Owwy Premium" description="One purchase. No ads. No subscription." />
            <RowLink href="/privacy/" icon={<ShieldCheck />} label="Privacy policy" />
            <RowLink href="/terms/" icon={<ScrollText />} label="Terms of use" />
            <RowLink href="/support/" icon={<LifeBuoy />} label="Help & support" />
            <RowLink href="/about/" icon={<Info />} label="About Owwy" />
          </Card>
          <p className="mt-4 flex items-center justify-center gap-2 text-caption text-ink-3">
            <OwwyMark size={16} /> Owwy {APP_VERSION} · Private · Offline · No ads
          </p>
        </Section>
      </div>

      <CustomizeSheet open={customize} onOpenChange={setCustomize} widgets={settings.dashboard} />
      <CategoriesSheet open={categories} onOpenChange={setCategories} />
      <ExchangeRatesSheet open={rates} onOpenChange={setRates} />
    </Page>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-heading`} className="scroll-mt-20">
      <h2 id={`${id ?? title}-heading`} className="mb-2 px-1 text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function RowLink({ href, icon, label, description }: { href: string; icon: React.ReactNode; label: string; description?: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 py-2.5 hover:text-brand">
      <span className="text-ink-3 [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {description ? <span className="block text-callout text-ink-3">{description}</span> : null}
      </span>
      <ChevronRight className="size-5 text-ink-3" aria-hidden />
    </Link>
  );
}

function RowButton({ onClick, icon, label, description }: { onClick: () => void; icon: React.ReactNode; label: string; description?: string }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 py-2.5 text-left hover:text-brand">
      <span className="text-ink-3 [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {description ? <span className="block text-callout text-ink-3">{description}</span> : null}
      </span>
      <ChevronRight className="size-5 text-ink-3" aria-hidden />
    </button>
  );
}
