// ====================================================================================
// ANNAHMEN:
// - `nodes` ist eine Map oder ein Array, das deine Knoten-Objekte speichert (z.B. Map<id, nodeObject>).
// - `selectedNodeId` ist eine Variable, die die ID des aktuell ausgewählten Knotens speichert.
// - `mindmapSvg` ist dein SVG-Element, in das Knoten gezeichnet werden.
// - `renderMindmap()` oder ähnliche Funktion zeichnet/aktualisiert die gesamte Mindmap.
// - `updateConnections()` oder ähnliche Funktion zeichnet/aktualisiert die Linien.
// ====================================================================================

// --- Globale Variablen und Konstanten ---
const mindmapContainer = document.getElementById('mindmap-container');
const mindmapSvg = document.getElementById('mindmap-svg');
const toastNotification = document.getElementById('toast-notification');

// Angenommene globale Knoten-Verwaltung (ersetze mit deiner tatsächlichen Struktur)
const nodes = new Map(); // Speichert Knoten-Objekte: Map<nodeId, nodeObject>
let selectedNodeId = null;

// Standardwerte für Knoten (NEU: Radius und Schriftgröße)
const DEFAULT_NODE_RADIUS = 30;
const DEFAULT_FONT_SIZE = 14;
const NODE_SIZE_STEP = 5;      // Schrittweite für Radiusänderung
const FONT_SIZE_STEP = 2;      // Schrittweite für Schriftgrößenänderung
const MIN_NODE_RADIUS = 15;    // Minimaler Radius
const MAX_NODE_RADIUS = 80;    // Maximaler Radius
const MIN_FONT_SIZE = 10;      // Minimale Schriftgröße
const MAX_FONT_SIZE = 36;      // Maximale Schriftgröße

// --- DOM-Elemente abrufen (NEU: Größen-Buttons) ---
const addRootNodeBtn = document.getElementById('addRootNodeBtn');
const clearMapBtn = document.getElementById('clearMapBtn');
const downloadMapBtn = document.getElementById('downloadMapBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const screenshotToClipboardCb = document.getElementById('screenshotToClipboardCb');
const screenshotFormatSelect = document.getElementById('screenshotFormatSelect');
const toggleShortcutBtn = document.getElementById('toggleShortcutBtn');
const shortcutWindow = document.getElementById('shortcut-window');
const closeShortcutBtn = document.getElementById('close-shortcut-btn');
const defaultNodeColorInput = document.getElementById('defaultNodeColor');
const defaultTextColorInput = document.getElementById('defaultTextColor');
const resetDefaultColorsBtn = document.getElementById('resetDefaultColorsBtn');

// NEU: Buttons für Größenanpassung
const decreaseNodeSizeBtn = document.getElementById('decreaseNodeSizeBtn');
const increaseNodeSizeBtn = document.getElementById('increaseNodeSizeBtn');


// --- Event Listener initialisieren ---
document.addEventListener('DOMContentLoaded', () => {
    // Deine vorhandenen Event Listener hier einfügen
    // addRootNodeBtn.addEventListener('click', addRootNode);
    // ... alle deine anderen Event Listener ...

    // Event Listener für Größenanpassung (NEU)
    if (decreaseNodeSizeBtn) {
        decreaseNodeSizeBtn.addEventListener('click', () => adjustSelectedNodeSize(-1));
    }
    if (increaseNodeSizeBtn) {
        increaseNodeSizeBtn.addEventListener('click', () => adjustSelectedNodeSize(1));
    }
    
    // Initiales Rendern der Mindmap, falls vorhanden
    // renderMindmap();
});

// --- HELPER FUNKTIONEN (Anpassungen für Node-Objekte) ---

// Funktion zum Erstellen eines neuen Knotens (ANPASSEN, falls anders)
function createNode(id, text, parentId, x, y, color, textColor) {
    const node = {
        id: id,
        text: text,
        parentId: parentId,
        children: [],
        x: x,
        y: y,
        color: color || defaultNodeColorInput.value,
        textColor: textColor || defaultTextColorInput.value,
        radius: DEFAULT_NODE_RADIUS, // NEU: Initialer Radius
        fontSize: DEFAULT_FONT_SIZE, // NEU: Initiale Schriftgröße
        // Füge hier weitere Eigenschaften hinzu, die du bereits hast (z.B. isSelected)
    };
    nodes.set(id, node);
    return node;
}

// Funktion zum Finden eines Knotens (ANPASSEN, falls anders)
function findNodeById(id) {
    return nodes.get(id);
}

// Funktion zum Anzeigen von Toast-Benachrichtigungen (ANPASSEN, falls anders)
function showToast(message, type = 'info') {
    toastNotification.textContent = message;
    toastNotification.className = `toast ${type} show`;
    setTimeout(() => {
        toastNotification.className = 'toast';
    }, 3000);
}

// --- FUNKTIONEN ZUR KNOTEN- UND LINIENDARSTELLUNG (WICHTIGE ANPASSUNGEN HIER) ---

// Funktion, die einen einzelnen Knoten im SVG erstellt/aktualisiert
// Diese Funktion muss den Radius und die Schriftgröße des Knotens berücksichtigen.
// ANPASSEN: Passe diese Funktion an DEINE bestehende draw/render/update-Node Funktion an.
function drawNode(node) {
    let nodeGroup = d3.select(`#node-${node.id}`);
    if (nodeGroup.empty()) {
        nodeGroup = d3.select(mindmapSvg)
                      .append('g')
                      .attr('id', `node-${node.id}`)
                      .attr('class', 'mindmap-node')
                      .on('click', (event) => selectNode(event, node.id))
                      .call(d3.drag()
                            .on('start', (event) => dragstarted(event, node))
                            .on('drag', (event) => dragged(event, node))
                            .on('end', (event) => dragended(event, node)));

        nodeGroup.append('circle');
        nodeGroup.append('text')
                 .attr('text-anchor', 'middle')
                 .attr('dominant-baseline', 'middle'); // Zentriert Text vertikal
    }

    // Knotendaten aktualisieren
    nodeGroup.attr('transform', `translate(${node.x},${node.y})`);

    nodeGroup.select('circle')
        .attr('r', node.radius) // NEU: Radius aus Node-Objekt verwenden
        .style('fill', node.color)
        .style('stroke', selectedNodeId === node.id ? 'orange' : 'black')
        .style('stroke-width', selectedNodeId === node.id ? 3 : 1);

    nodeGroup.select('text')
        .text(node.text)
        .attr('font-size', `${node.fontSize}px`) // NEU: Schriftgröße aus Node-Objekt verwenden
        .style('fill', node.textColor);
    
    // ANPASSEN: Füge hier deine Logik für Doppelklick zum Bearbeiten hinzu
    // nodeGroup.on('dblclick', (event) => editNodeText(event, node.id));

    // Optional: Größe des Textes anpassen, falls er den Kreis überragt (fortgeschritten)
    // Wenn du eine automatische Größenanpassung des Kreises an den Text hast,
    // muss dieser Teil deiner Logik hier berücksichtigt werden.
}

// Funktion zum Neuzeichnen aller Linien (ANPASSEN, falls anders)
// Diese Funktion MUSS die neuen Radien der Knoten berücksichtigen,
// um die Linien korrekt an den Rand der Kreise anzuschließen.
function updateConnections() {
    // Lösche alle vorhandenen Linien
    d3.select(mindmapSvg).selectAll('.mindmap-line').remove();

    // Zeichne neue Linien basierend auf den aktualisierten Knotenpositionen und Radien
    nodes.forEach(node => {
        if (node.parentId !== null) {
            const parent = findNodeById(node.parentId);
            if (parent) {
                // Berechne den Startpunkt der Linie am Rand des Elternknotens
                const angleParent = Math.atan2(node.y - parent.y, node.x - parent.x);
                const startX = parent.x + parent.radius * Math.cos(angleParent);
                const startY = parent.y + parent.radius * Math.sin(angleParent);

                // Berechne den Endpunkt der Linie am Rand des Kindknotens
                const angleNode = Math.atan2(parent.y - node.y, parent.x - node.x);
                const endX = node.x + node.radius * Math.cos(angleNode);
                const endY = node.y + node.radius * Math.sin(angleNode);

                d3.select(mindmapSvg).append('line')
                    .attr('class', 'mindmap-line')
                    .attr('x1', startX)
                    .attr('y1', startY)
                    .attr('x2', endX)
                    .attr('y2', endY)
                    .style('stroke', 'black')
                    .style('stroke-width', 2);
            }
        }
    });
}

// Haupt-Rendering-Funktion (ANPASSEN, falls anders)
function renderMindmap() {
    mindmapSvg.innerHTML = ''; // Leere das SVG vor dem Neuzeichnen
    nodes.forEach(node => drawNode(node)); // Zeichne alle Knoten
    updateConnections(); // Zeichne alle Linien
}

// --- NEUE FUNKTIONEN FÜR GRÖSSENANPASSUNG ---
function adjustSelectedNodeSize(direction) {
    if (selectedNodeId === null) {
        showToast('Please select a node first!', 'error');
        return;
    }

    const node = findNodeById(selectedNodeId);
    if (!node) return;

    let newRadius = node.radius + (direction * NODE_SIZE_STEP);
    let newFontSize = node.fontSize + (direction * FONT_SIZE_STEP);

    // Grenzen für Größe festlegen
    newRadius = Math.max(MIN_NODE_RADIUS, Math.min(MAX_NODE_RADIUS, newRadius));
    newFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newFontSize));

    // Nur aktualisieren, wenn sich der Wert tatsächlich ändert
    if (node.radius !== newRadius || node.fontSize !== newFontSize) {
        node.radius = newRadius;
        node.fontSize = newFontSize;

        // Aktualisiere die Visualisierung des Knotens und aller Linien
        drawNode(node); // Aktualisiert den ausgewählten Knoten
        updateConnections(); // Aktualisiert alle Linien, da sich der Radius eines Knotens geändert hat
        showToast(`Node size changed to Radius: ${node.radius}, Font: ${node.fontSize}px`, 'info');
    } else {
        showToast('Node size is already at its limit.', 'info');
    }
}

// --- EXISTIERENDE FUNKTIONEN ANPASSEN ---

// Die `selectNode` Funktion muss die `selectedNodeId` setzen
// und dann `renderMindmap()` oder `drawNode()` für den alten und neuen Knoten aufrufen,
// um die Rahmen zu aktualisieren.
function selectNode(event, nodeId) {
    event.stopPropagation(); // Verhindert, dass Klick auf SVG die Auswahl aufhebt

    // Altes Auswahl entfernen
    if (selectedNodeId !== null) {
        const oldSelectedNode = findNodeById(selectedNodeId);
        if (oldSelectedNode) {
            drawNode(oldSelectedNode); // Neu zeichnen, um den Rahmen zu entfernen
        }
    }

    // Neue Auswahl setzen
    selectedNodeId = nodeId;
    const newSelectedNode = findNodeById(selectedNodeId);
    if (newSelectedNode) {
        drawNode(newSelectedNode); // Neu zeichnen, um den Rahmen anzuzeigen
        showToast(`Node "${newSelectedNode.text}" selected.`, 'info');
    }
}

// Root Node hinzufügen (Beispiel für den Aufruf von `createNode`)
addRootNodeBtn.addEventListener('click', () => {
    const rootId = 'node-' + Date.now();
    const rootNode = createNode(rootId, 'Root Node', null, 200, 200); // Standardposition, Farbe, etc.
    renderMindmap(); // Mindmap neu zeichnen
    selectNode(null, rootId); // Root Node direkt auswählen
    showToast('Root node added!', 'success');
});

// Löschen eines Knotens (ANPASSEN, falls anders)
document.addEventListener('keydown', (event) => {
    if (selectedNodeId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault(); // Verhindert, dass der Browser zurückgeht
        const nodeToDelete = findNodeById(selectedNodeId);
        if (nodeToDelete) {
            // Logik zum Löschen des Knotens und seiner Kinder aus der 'nodes'-Map
            // und zum Entfernen der SVG-Elemente
            // selectedNodeId auf null setzen
            // renderMindmap() aufrufen
            showToast(`Node "${nodeToDelete.text}" deleted.`, 'success');
        }
    }
});


// ... füge hier den Rest deines bestehenden script.js Codes ein ...
// (Keyboard shortcuts, add/edit/delete node logic, save/load, screenshot,
// clear map, color pickers, draggable/resizable window, etc.)


// Ein paar Platzhalter-Funktionen, die du mit deinen tatsächlichen Implementierungen ersetzen musst
function dragstarted(event, node) {
    // Deine Logik für Drag-Start
}
function dragged(event, node) {
    node.x = event.x;
    node.y = event.y;
    drawNode(node); // Aktualisiert die Position des Knotens
    updateConnections(); // Aktualisiert die Linien
}
function dragended(event, node) {
    // Deine Logik für Drag-Ende
}
// function editNodeText(event, nodeId) { ... } // Funktion zum Bearbeiten des Knotentextes
// function addSiblingNode() { ... }
// function addChildNode() { ... }
// function saveMap() { ... }
// function clearMap() { ... }
// function takeScreenshot() { ... }
// function toggleShortcuts() { ... }
// function handleColorChange() { ... }
// function resetDefaultColors() { ... }

// Initialisiere die Mindmap (lade sie, wenn sie im Speicher ist)
// Oder zeichne einfach eine leere Karte, wenn die Seite geladen wird
// renderMindmap();
