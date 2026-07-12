import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  const googleEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  return (
    <Suspense>
      <AuthForm mode="sign-up" googleEnabled={googleEnabled} />
    </Suspense>
  );
}
