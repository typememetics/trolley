"use client";

import { useActionState, useState } from "react";
import { MAX_DEFENSE_LENGTH } from "@/lib/game/rules";
import { saveStandingDefenseAction } from "@/lib/player/actions";

/** The argument opponents will face: shown when written, a textarea when missing or being edited. */
export function StandingDefenseForm({ defense }: { defense: string | null }) {
  const [editing, setEditing] = useState(!defense);
  const [error, save, saving] = useActionState(async (_: string | null, formData: FormData) => {
    const result = await saveStandingDefenseAction(formData);
    if (!result.error) setEditing(false);
    return result.error ?? null;
  }, null);

  if (!editing && defense) {
    return (
      <section className="defense">
        <h2>Your standing defense</h2>
        <blockquote>{defense}</blockquote>
        <button type="button" onClick={() => setEditing(true)}>Edit</button>
      </section>
    );
  }

  return (
    <form className="defense" action={save}>
      <h2><label htmlFor="defense">Why should the AI save you?</label></h2>
      <p>If you&apos;re tied to the other track, this is your argument for surviving.</p>
      <textarea
        id="defense"
        name="defense"
        rows={4}
        required
        maxLength={MAX_DEFENSE_LENGTH}
        defaultValue={defense ?? ""}
        placeholder="Make your case..."
      />
      {error && <p className="defense-error" role="alert">{error}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save defense"}</button>
      {defense && <button type="button" onClick={() => setEditing(false)}>Cancel</button>}
    </form>
  );
}
