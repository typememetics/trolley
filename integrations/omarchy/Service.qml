import QtQuick
import Quickshell.Io

Item {
    id: root
    property string serverUrl: ""
    property string label: "Trolley · starting…"
    property string detail: "Click to play Trolley"
    property bool pendingOpen: false
    property bool restarting: false
    property bool needsDependencies: false

    function checkDependencies() {
        if (!dependencyCheck.running) dependencyCheck.running = true
    }

    function configure(url) {
        if (serverUrl === url) return
        serverUrl = url
        if (backend.running) {
            restarting = true
            backend.running = false
        }
        else checkDependencies()
    }

    function toggle() {
        if (setup.running || dependencyCheck.running) return
        if (backend.running) backend.write("toggle\n")
        else {
            pendingOpen = true
            checkDependencies()
        }
    }

    Process {
        id: dependencyCheck
        command: ["python", "-c", "from PySide6.QtWebEngineWidgets import QWebEngineView"]
        onExited: (exitCode, exitStatus) => {
            root.needsDependencies = exitCode !== 0 || exitStatus !== 0
            if (!root.needsDependencies) {
                backend.running = true
                return
            }
            root.label = "Trolley · setup"
            root.detail = "Click to install PySide6 and QtWebEngine in a terminal. You will be asked to confirm."
            if (root.pendingOpen) {
                root.pendingOpen = false
                setup.running = true
            }
        }
    }

    Process {
        id: setup
        command: ["xdg-terminal-exec", "bash", decodeURIComponent(Qt.resolvedUrl("setup.sh").toString().replace(/^file:\/\//, ""))]
        onStarted: {
            root.label = "Trolley · setup"
            root.detail = "Complete setup in the terminal, then click to play."
        }
        onExited: root.checkDependencies()
    }

    Process {
        id: backend
        command: ["python", "-u", decodeURIComponent(Qt.resolvedUrl("popup.py").toString().replace(/^file:\/\//, "")), root.serverUrl]
        stdinEnabled: true
        stdout: SplitParser {
            onRead: data => {
                try {
                    var state = JSON.parse(data)
                    root.label = state.label
                    root.detail = state.detail
                    if (root.pendingOpen) {
                        root.pendingOpen = false
                        backend.write("toggle\n")
                    }
                } catch (error) { /* Ignore non-protocol output. */ }
            }
        }
        onExited: {
            if (root.restarting) {
                root.restarting = false
                backend.running = true
                return
            }
            root.label = "Trolley · unavailable"
            root.detail = "Click to retry. Requires Python with PySide6 and QtWebEngine; see the plugin README."
        }
    }
}
