import { Suspense } from "react";
import { CredentialsLoginForm } from "@/components/auth/credentials-login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <CredentialsLoginForm variant="main" />
    </Suspense>
  );
}
