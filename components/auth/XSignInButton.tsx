"use client";

import { authClient } from "@/lib/auth-client";

export function XSignInButton() {
  return (
    <button type="button" onClick={() => authClient.signIn.social({ provider: "twitter", callbackURL: "/" })}>
      Sign in with X
    </button>
  );
}
