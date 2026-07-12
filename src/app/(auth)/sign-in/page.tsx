import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  const googleEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  return (
    // Suspense required: AuthForm reads useSearchParams (redirect param).
    <Suspense>
      <AuthForm mode="sign-in" googleEnabled={googleEnabled} />
    </Suspense>
  );
}
