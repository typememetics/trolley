"use client";

import { useActionState, useState } from "react";
import { MAX_DEFENSE_LENGTH } from "@/lib/game/rules";
import { saveStandingDefenseAction } from "@/lib/player/actions";

/** The argument opponents will face: shown when written, a textarea when missing or being edited. */
export function StandingDefenseForm({ defense: initial }: { defense: string | null }) {
  // Held here rather than re-read from the server: refreshing the page would re-draw the opponent.
  const [defense, setDefense] = useState(initial);
  const [editing, setEditing] = useState(!initial);
  const [error, save, saving] = useActionState(async (_: string | null, formData: FormData) => {
    const result = await saveStandingDefenseAction(formData);
    if (result.saved === undefined) return result.error;
    setDefense(result.saved);
    setEditing(false);
    return null;
  }, null);

  if (!editing && defense) {
    return (
      <section className="defense">
        <h2>Your defense</h2>
        <blockquote>{defense}</blockquote>
        <button type="button" onClick={() => setEditing(true)}>Edit</button>
      </section>
    );
  }

  return (
    <form className="defense" action={save}>
      <h2>Your defense</h2>
      {!defense && <p>You haven&apos;t made your case yet.</p>}
      <p><label htmlFor="defense">Why should the AI save you? When someone else draws you, this is your argument for surviving.</label></p>
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
