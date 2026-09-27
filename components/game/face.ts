/** What gets pasted over a victim's head. GitHub avatars and placeholders render identically. */
export interface Face {
  src: string;
  label: string;
}

const initials = (name: string) =>
  name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(word => [...word][0]).join("").toUpperCase() || "?";

/** A circle with the player's initials, drawn locally so it can never fail to load. */
export function placeholderAvatar(name: string, fill = "#e8e2d6"): string {
  const text = initials(name).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">`
    + `<rect width="100" height="100" fill="${fill}"/>`
    + `<text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="#111">${text}</text>`
    + `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const faceOf = (who: { name: string; image: string | null }): Face =>
  ({ src: who.image || placeholderAvatar(who.name), label: who.name });
