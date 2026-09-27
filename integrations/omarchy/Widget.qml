import QtQuick
import qs.Ui

BarWidget {
    id: root
    moduleName: "trolley.game"
    readonly property var service: bar && bar.shell ? bar.shell.serviceFor(moduleName) : null
    readonly property string serverUrl: String(setting("url", "https://trolley.typememetics.institute"))

    function configure() { if (service) service.configure(serverUrl) }
    onServiceChanged: configure()
    onServerUrlChanged: configure()
    Component.onCompleted: configure()

    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight

    WidgetButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: root.service ? root.service.label : "Trolley · unavailable"
        textRotation: root.vertical ? 90 : 0
        fixedHeight: root.vertical ? labelWidth + 20 : -1
        tooltipText: root.service ? root.service.detail : "Trolley requires Omarchy's built-in bar."
        onPressed: b => { if (b === Qt.LeftButton && root.service) root.service.toggle() }
    }
}
