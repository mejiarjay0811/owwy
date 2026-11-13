"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MonthlyReviewView } from "@/components/insights/monthly-review";
import { MonthSwitcher, Page, PageHeader } from "@/components/layout/page";
import { useFinance } from "@/hooks/use-finance";
import { addMonthKey, formatMonth } from "@/lib/dates";
import { useRouter } from "next/navigation";

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewScreen />
    </Suspense>
  );
}

function ReviewScreen() {
  const { state } = useFinance();
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("month");
  const month = requested && /^\d{4}-\d{2}$/.test(requested) && requested <= state.month ? requested : addMonthKey(state.month, -1);
  const go = (delta: number) => router.replace(`/review/?month=${addMonthKey(month, delta)}`);

  return (
    <Page>
      <PageHeader title="Monthly review" back="/insights/" />
      <div className="mb-5 flex justify-center lg:justify-start">
        <MonthSwitcher label={formatMonth(month)} onPrevious={() => go(-1)} onNext={() => go(1)} nextDisabled={month >= state.month} />
      </div>
      <MonthlyReviewView key={month} month={month} />
    </Page>
  );
}
