### Repository URL

https://github.com/typememetics/trolley

### Category

Widgets

### Tags

games, bar, quickshell

### Suggest a missing tag

_No response_

### Maintainer notes

Trolley shows the signed-in player's current Elo and global rank in Omarchy's bar. Clicking opens the hosted game in a floating QtWebEngine popup with GitHub login and a persistent browser profile.

The root manifest points to the integration in integrations/omarchy/. The same repository also contains the hosted game; installing the desktop plugin requires no Node.js build or local game server. The default hosted status endpoint is deployed.

Manual setup: users must install pyside6 and qt6-webengine before enabling the plugin. It requires Python 3, the Quickshell-based Omarchy shell with its built-in bar, internet access, and a GitHub account to play. The helper runs as the current user. The README covers installation, updating, removal, stored browser data, and supported shell versions. The root MIT license explicitly scopes the Omarchy integration and marketing materials without changing the game server's existing licensing.

The root preview and linked screenshots/GIFs use a fresh signed-out profile. No private account data or fabricated player rankings are shown. Python protocol tests and signed-in/signed-out QtWebEngine smoke tests passed. Full server test execution was blocked by SIGILL on the development machine; no security-audit claim is made.

### Submission checklist

- [x] The repository is public and contains installation and removal instructions.
- [x] I have documented the plugin license and any external dependencies.
- [x] I confirm that I own or have permission to submit this plugin and its preview assets.
- [x] The plugin does not overwrite user configuration without explicit consent.
- [x] I understand that approval is for listing and is not a security review.
