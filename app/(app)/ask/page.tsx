"use client";

import { Suspense } from "react";
import { AskScreen } from "@/components/ask/ask-screen";

export default function AskPage() {
  return (
    <Suspense>
      <AskScreen />
    </Suspense>
  );
}
