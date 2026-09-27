# Trolley for Omarchy

A plugin for the **Quickshell Omarchy shell and its built-in bar**. It shows
`Trolley · 1516 Elo · #42`. Click it to open a floating, resizable game popup.
Sign in with GitHub inside the popup, then play the existing game there.
The popup's Close button, Escape, and a second bar click hide it without losing
an in-progress game. The toolbar provides Back, Play, Reload, and Hide.

## Install

Deploy the game including `/api/omarchy/status` first. The existing GitHub OAuth
app uses the same callback as the website:
`https://YOUR_GAME_HOST/api/auth/callback/github`. No separate OAuth app or desktop
client secret is needed. Set the game's normal environment variables and database
migrations as usual.

Install from the public repository:

```sh
omarchy plugin add https://github.com/typememetics/trolley --enable
```

The widget checks for PySide6 and QtWebEngine before starting the game helper.
If either is missing, it shows **Trolley · setup**. Clicking opens a terminal
that asks before running `omarchy pkg add pyside6 qt6-webengine`; sudo may ask
for your password. After setup, click the widget to play. Cancelled or failed
setup can be retried by clicking again. The plugin never installs packages on
load. `omarchy plugin add` does not execute install hooks.

For a local checkout without git-based updates, run
`bash integrations/omarchy/install.sh` instead. Both methods use the same plugin ID;
remove an existing installation before switching methods. Repository installs
can be updated with `omarchy plugin update trolley.game`.

The local-checkout installer installs dependencies with
`omarchy pkg add pyside6 qt6-webengine`, checks the Python import, copies the plugin into
`~/.config/omarchy/plugins/trolley.game`, and enables it. It refuses to overwrite
an existing installation. For updates, review and copy the five runtime files
(`manifest.json`, `Widget.qml`, `Service.qml`, `popup.py`, `setup.sh`) into that directory.
Omarchy hot-reloads them. The helper needs Python 3 and PySide6 with QtWebEngine.
This plugin does not support the older Waybar shell.

Set **Trolley server URL** in the widget settings, or set `url` on the widget's
existing entry in `~/.config/omarchy/shell.json`:

```json
{ "id": "trolley.game", "url": "https://YOUR_GAME_HOST" }
```

Keep the rest of your shell config. The entry belongs in `bar.layout.right`
(or your preferred section). The default is `https://trolley.typememetics.institute`. For local
development, use `http://localhost:3000`. Only HTTPS origins and local HTTP origins are accepted; subpath
installations are unsupported. The plugin uses one service and browser profile
across monitors. Replacement bars may withhold service access; use the built-in bar.

## Authentication and status

Click the bar, then **Sign in with GitHub** in the game. GitHub authentication
runs in the popup; sessions are independent from your usual browser. Sign out
using the game's existing sign-out button. Cookies and local storage live under
`$XDG_DATA_HOME/trolley/<server hash>` (default `~/.local/share/trolley`), with
private directory permissions. Cookies stay inside QtWebEngine; no session
secret is sent to QML, written in shell settings, or printed by the helper.
Different server origins get separate profiles.

Status refreshes every 30 seconds, when a page loads, and when opening/closing
the popup. This includes rating changes caused by other players. New players
show `1500 Elo · unranked` until their first resolved round. Rank is the exact
global leaderboard position, including beyond the first 100 players and the
same full-precision Elo / game count / name / id tie-breakers. Only display Elo
is rounded. Network/server failures show `offline`, without presenting an old
rating as current. Expired sessions show `sign in`.

The desktop helper loads a second, invisible page from the same origin to read
`/api/omarchy/status` with the shared cookie profile. It never embeds GitHub or
the game in an iframe. No CORS exception, bearer token, or public user lookup is
required. The status route is session-authenticated and returns private,
uncacheable JSON. The full game keeps using its existing server-side auth and
round validation.

## Check and troubleshoot

```sh
python -m unittest discover -s integrations/omarchy -p 'test_*.py'
bash -n integrations/omarchy/install.sh
# Run manually; type toggle + Enter to show/hide. Ctrl-D quits.
python -u integrations/omarchy/popup.py http://localhost:3000
```

If the bar says `unavailable`, check that `python` can import
`PySide6.QtWebEngineWidgets`, and inspect the shell logs or run the helper above.
For `offline`, check the configured origin and deployment's status endpoint.
Use Reload to retry a failed game page. Do not disable the Chromium sandbox.
QtWebEngine is a browser runtime and should receive normal system updates.

Manual integration check with a configured server:

1. Open from the bar, sign in with GitHub, and confirm the bar matches the leaderboard.
2. Play a round, close/reopen the popup, and verify state and rating refresh.
3. Restart the shell and verify the login persists.
4. Sign out and verify the bar changes to `sign in` within 30 seconds.
5. Disconnect the network and verify `offline`; reconnect and verify recovery.
6. With two monitors, verify either bar controls the same popup.

Remove with `omarchy plugin remove trolley.game`. Browser data is retained;
remove the corresponding profile directory separately if you want to forget
this device's login.

API references: [Omarchy shell](https://github.com/basecamp/omarchy),
[Quickshell Process](https://quickshell.org/docs/v0.3.0/types/Quickshell.Io/Process/),
[Qt persistent profiles](https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineCore/QWebEngineProfile.html).
