"use client";

import { Suspense } from "react";
import { ActivationForm } from "@/components/auth/ActivationForm";

export default function AktivasyonPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0b1c2c]" />}>
      <ActivationForm />
    </Suspense>
  );
}
