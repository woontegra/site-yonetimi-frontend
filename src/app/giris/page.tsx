"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function GirisPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0b1c2c]" />}>
      <LoginForm />
    </Suspense>
  );
}
