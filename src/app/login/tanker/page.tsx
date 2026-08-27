import { Suspense } from "react";
import { CredentialsLoginForm } from "@/components/auth/credentials-login-form";

export default function TankerLoginPage() {
  return (
    <Suspense fallback={null}>
      <CredentialsLoginForm variant="tanker" />
    </Suspense>
  );
}
