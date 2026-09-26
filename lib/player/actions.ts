"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { MAX_DEFENSE_LENGTH } from "@/lib/game/rules";
import { saveStandingDefense } from "./profile";

export type SaveDefenseResult = { error: string } | { error?: never };

/** The browser sends only the text; whose defense it is comes from the session. */
export async function saveStandingDefenseAction(formData: FormData): Promise<SaveDefenseResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Sign in to write a defense." };

  const raw = formData.get("defense");
  const defense = typeof raw === "string" ? raw.trim() : "";
  if (!defense) return { error: "Your defense can't be empty." };
  if (defense.length > MAX_DEFENSE_LENGTH) return { error: `Keep it under ${MAX_DEFENSE_LENGTH} characters.` };

  await saveStandingDefense(session.user.id, defense);
  refresh();
  return {};
}
