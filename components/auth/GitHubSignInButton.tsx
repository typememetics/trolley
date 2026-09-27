"use client";

import { GitHubIcon } from "@/components/ui/icons";
import { authClient } from "@/lib/auth-client";

export function GitHubSignInButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/" })}>
      <GitHubIcon/> Sign in with GitHub
    </button>
  );
}
