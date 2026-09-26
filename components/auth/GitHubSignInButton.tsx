"use client";

import { authClient } from "@/lib/auth-client";

export function GitHubSignInButton() {
  return (
    <button type="button" onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/" })}>
      Sign in with GitHub
    </button>
  );
}
