#!/usr/bin/env python3
"""One persistent browser profile and popup, controlled by the shell over stdin."""
import hashlib
import json
import os
import signal
from pathlib import Path
import sys
from urllib.parse import urlsplit


def origin_url(value):
    url = urlsplit(value)
    if (url.scheme not in ("https", "http") or not url.hostname
            or url.username or url.password or url.query or url.fragment
            or url.path not in ("", "/")):
        raise ValueError("Use the server origin, e.g. https://trolley.example.com")
    if url.scheme == "http" and url.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("Use HTTPS except for a local development server")
    return value.rstrip("/")


def status_message(data):
    if data.get("authenticated") is False:
        return {"label": "Trolley · sign in", "detail": "Click to sign in with GitHub and play"}
    if data.get("authenticated") is not True:
        raise ValueError("Invalid status response")
    elo = data["elo"]
    rank = data["rank"]
    if isinstance(elo, bool) or not isinstance(elo, int):
        raise ValueError("Invalid Elo")
    if rank is not None and (isinstance(rank, bool) or not isinstance(rank, int) or rank < 1):
        raise ValueError("Invalid rank")
    standing = f"#{rank}" if rank is not None else "unranked"
    return {"label": f"Trolley · {elo} Elo · {standing}",
            "detail": f"{data['name']} — {elo} Elo, {standing}. Click to play."}


def emit(message):
    print(json.dumps(message), flush=True)


def main():
    base = origin_url(sys.argv[1])
    # Imported here so protocol/validation tests don't require a desktop runtime.
    from PySide6.QtCore import QSocketNotifier, QTimer, QUrl, Qt
    from PySide6.QtGui import QKeySequence, QShortcut
    from PySide6.QtWidgets import QApplication, QMainWindow, QToolBar
    from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from shiboken6 import delete

    os.umask(0o077)
    app = QApplication(["trolley-popup"])
    app.setApplicationName("trolley-popup")
    app.setQuitOnLastWindowClosed(False)
    signal.signal(signal.SIGTERM, lambda *_: app.quit())
    signal.signal(signal.SIGINT, lambda *_: app.quit())
    # Let Python service termination signals while the Qt event loop is idle.
    signal_timer = QTimer(app)
    signal_timer.timeout.connect(lambda: None)
    signal_timer.start(250)
    identity = hashlib.sha256(base.encode()).hexdigest()[:24]
    data_dir = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "trolley" / identity
    data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    profile = QWebEngineProfile("trolley-" + identity, app)
    profile.setPersistentStoragePath(str(data_dir))
    profile.setCachePath(str(data_dir / "cache"))
    profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.AllowPersistentCookies)

    class Popup(QMainWindow):
        def closeEvent(self, event):
            event.ignore()
            self.hide()
            refresh()

    window = Popup()
    window.setWindowTitle("Trolley")
    window.setWindowFlags(Qt.WindowType.Tool)
    screen = app.primaryScreen().availableGeometry()
    window.resize(min(1100, screen.width() - 40), min(850, screen.height() - 60))
    web = QWebEngineView(window)
    page = QWebEnginePage(profile, web)
    web.setPage(page)
    window.setCentralWidget(web)
    toolbar = QToolBar("Navigation", window)
    toolbar.setMovable(False)
    window.addToolBar(toolbar)
    toolbar.addAction("Back", web.back)
    toolbar.addAction("Play", lambda: web.setUrl(QUrl(base + "/")))
    toolbar.addAction("Reload", web.reload)
    toolbar.addAction("Hide", window.close)
    escape = QShortcut(QKeySequence("Escape"), window)
    escape.activated.connect(window.close)
    # A second, nonvisual page reads only the authenticated status endpoint.
    # Cookies stay inside the profile; neither QML nor stdout receives a token.
    status_page = QWebEnginePage(profile, app)
    busy = False

    def unavailable():
        emit({"label": "Trolley · offline", "detail": "Could not refresh rating. Click to open or retry the game."})

    timeout = QTimer(app)
    timeout.setSingleShot(True)
    timeout.setInterval(15000)

    def timed_out():
        nonlocal busy
        busy = False
        status_page.triggerAction(QWebEnginePage.WebAction.Stop)
        unavailable()

    timeout.timeout.connect(timed_out)

    def receive(text):
        nonlocal busy
        busy = False
        timeout.stop()
        try:
            emit(status_message(json.loads(text)))
        except (ValueError, KeyError, TypeError, AttributeError):
            unavailable()

    def loaded(ok):
        # Chromium reports HTTP 401 as a failed load even when the JSON body exists.
        status_page.toPlainText(receive)

    def refresh():
        nonlocal busy
        if busy:
            return
        busy = True
        timeout.start()
        status_page.load(QUrl(base + "/api/omarchy/status"))

    status_page.loadFinished.connect(loaded)
    web.loadFinished.connect(lambda ok: refresh())
    timer = QTimer(app)
    timer.setInterval(30000)
    timer.timeout.connect(refresh)
    timer.start()
    buffer = b""
    notifier = QSocketNotifier(sys.stdin.fileno(), QSocketNotifier.Type.Read, app)

    def command():
        nonlocal buffer
        chunk = os.read(sys.stdin.fileno(), 4096)
        if not chunk:
            notifier.setEnabled(False)
            app.quit()
            return
        buffer += chunk
        while b"\n" in buffer:
            line, buffer = buffer.split(b"\n", 1)
            if line == b"toggle":
                if window.isVisible():
                    window.close()
                else:
                    window.show()
                    window.raise_()
                    window.activateWindow()
                    refresh()

    notifier.activated.connect(command)
    emit({"label": "Trolley · connecting…", "detail": "Click to open Trolley"})
    web.setUrl(QUrl(base + "/"))
    refresh()
    result = app.exec()
    # Destroy pages before their shared profile, allowing cookies to flush.
    delete(status_page)
    delete(window)
    delete(profile)
    return result


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ImportError, ValueError, IndexError) as error:
        print(f"Trolley: {error}", file=sys.stderr)
        sys.exit(1)
