"use client";

import { useRouter } from "next/navigation";
import { SignOutIcon } from "@/components/ui/icons";
import { authClient } from "@/lib/auth-client";

/** `compact` draws the icon alone, for tight spots where the label would crowd the bar. */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const signOut = async () => { await authClient.signOut(); router.refresh(); };
  return compact ? (
    <button type="button" className="sign-out" aria-label="Sign out" title="Sign out" onClick={signOut}>
      <SignOutIcon/>
    </button>
  ) : (
    <button type="button" className="btn" onClick={signOut}>
      <SignOutIcon/> Sign out
    </button>
  );
}
