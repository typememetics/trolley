import QtQuick
import Quickshell.Io

Item {
    id: root
    property string serverUrl: ""
    property string label: "Trolley · starting…"
    property string detail: "Click to play Trolley"
    property bool pendingOpen: false
    property bool restarting: false

    function configure(url) {
        if (serverUrl === url) return
        serverUrl = url
        if (backend.running) {
            restarting = true
            backend.running = false
        }
        else backend.running = true
    }

    function toggle() {
        if (backend.running) backend.write("toggle\n")
        else {
            pendingOpen = true
            backend.running = true
        }
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
