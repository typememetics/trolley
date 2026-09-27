"use client";

import { useActionState, useState } from "react";
import { CheckIcon, CloseIcon, PencilIcon } from "@/components/ui/icons";
import { MAX_DEFENSE_LENGTH } from "@/lib/game/rules";
import { saveStandingDefenseAction } from "@/lib/player/actions";

/**
 * The argument opponents will face, and the one JEV weighs when you play: shown when
 * written, a textarea when missing or being edited. `onReadyChange` reports whether a
 * saved defense is showing, i.e. whether there is something to judge.
 */
export function StandingDefenseForm({ defense: initial, onReadyChange }: {
  defense: string | null;
  onReadyChange?: (ready: boolean) => void;
}) {
  // Held here rather than re-read from the server: refreshing the page would re-draw the opponent.
  const [defense, setDefense] = useState(initial);
  const [editing, setEditingState] = useState(!initial);
  const [length, setLength] = useState(initial?.length ?? 0);
  // Only ever called with a saved defense in hand (Edit and Cancel exist only then).
  const setEditing = (on: boolean) => {
    setEditingState(on);
    onReadyChange?.(!on);
  };
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
        <button type="button" className="btn" onClick={() => { setLength(defense.length); setEditing(true); }}><PencilIcon/> Edit</button>
      </section>
    );
  }

  return (
    <form className="defense" action={save}>
      <h2>Your defense</h2>
      {!defense && <p>You haven&apos;t made your case yet.</p>}
      <p><label htmlFor="defense">Why should the AI save you? AGI weighs it against your opponent&apos;s, and when someone else draws you, this is your argument for surviving.</label></p>
      <textarea
        id="defense"
        name="defense"
        rows={4}
        required
        maxLength={MAX_DEFENSE_LENGTH}
        defaultValue={defense ?? ""}
        placeholder="Make your case..."
        onChange={(e) => setLength(e.target.value.length)}
      />
      <p className="defense-count" aria-live="polite">{length}/{MAX_DEFENSE_LENGTH}</p>
      {error && <p className="defense-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={saving}><CheckIcon/> {saving ? "Saving..." : "Save defense"}</button>
      {defense && <button type="button" className="btn" onClick={() => setEditing(false)}><CloseIcon/> Cancel</button>}
    </form>
  );
}
