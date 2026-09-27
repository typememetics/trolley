# Trolley for Omarchy — launch kit

## Assets

| File | Use |
| --- | --- |
| [`../../../preview.png`](../../../preview.png) | Marketplace preview / landscape announcement |
| [`social-card.png`](social-card.png) | Social post, 1200 × 630 |
| [`popup-sign-in.png`](popup-sign-in.png) | Actual QtWebEngine popup, signed out |
| [`popup-github-login.png`](popup-github-login.png) | Actual popup showing the GitHub sign-in action |
| [`game.png`](game.png) | Browser screenshot of the live game |
| [`popup-tour.gif`](popup-tour.gif) | Short scrolling tour of the actual popup |
| [`launch.gif`](launch.gif) | Animated announcement using the captured interface |

Screenshots use a fresh signed-out profile on the public game. No player names,
private account data, fabricated rankings, or simulated match results are shown.
The GIFs demonstrate the interface and navigation, not a completed ranked game.
The social card and launch GIF are promotional layouts built around these captures.

## Store listing

**Name:** Trolley

**Category:** Widgets

**Tags:** games, bar, quickshell

**Short description:** Play Trolley in an Omarchy popup. Sign in with GitHub and
keep your Elo and global rank in the status bar.

**Long description:**

Two developers. One runaway trolley. An AI with its hand on the lever.
Trolley brings the game to your Omarchy desktop: click the status bar, sign in
with GitHub, and make your case in a floating popup. Your Elo and global rank
refresh in the bar, including changes caused by other players. Hide the popup
when you need your screen back and return to the same session later.

Requires the Quickshell-based Omarchy shell with its built-in bar, Python,
PySide6, QtWebEngine, and an internet connection. A GitHub account is required
to play. The plugin uses the hosted game by default.

## Short launch post

Your next moral crisis is one click away.

Trolley for Omarchy puts the game in a popup and your Elo + global rank in the
status bar. Sign in with GitHub. Make your case. Let the AI pull the lever.

Install: https://github.com/typememetics/trolley

## Longer community post

I built an Omarchy plugin for Trolley: two developers explain why they deserve
to survive, and an AI decides which track the trolley takes.

Click Trolley in the bar to open the game. GitHub login stays in the popup's
browser profile, and your Elo and global rank refresh every 30 seconds.
Close or hide the popup and come back to the same session.

It works with Omarchy's Quickshell shell and built-in bar. Install PySide6 and
QtWebEngine, then add the repository with `omarchy plugin add`:

```sh
omarchy pkg add pyside6 qt6-webengine
omarchy plugin add https://github.com/typememetics/trolley --enable
```

Source and setup: https://github.com/typememetics/trolley
Play in a browser: https://trolley.typememetics.institute

## Alt text

- **Preview/social card:** Trolley for Omarchy, with a screenshot of the game interface and the message “Your next moral crisis is one click away.”
- **Popup screenshot:** Trolley's railway scene inside a desktop popup with Back, Play, Reload, and Hide controls.
- **Sign-in screenshot:** The Trolley popup shows an invitation to make your case and a Sign in with GitHub button.
- **Popup tour GIF:** The popup scrolls from the trolley scene to the GitHub sign-in section and back.
- **Launch GIF:** An announcement cycles through GitHub sign-in, playing in a popup, and Elo and rank in the status bar alongside a real interface capture.

## Reuse

The promotional layouts and copy may be reused to promote this plugin under
the root license. Screenshots depict the existing game and preserve its branding.
Do not present the signed-out tour as a recording of authenticated gameplay.
