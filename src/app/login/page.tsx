import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = { title: "Teacher sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthCard />
    </Suspense>
  );
}
