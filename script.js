// ====================================================================================
// ANNAHMEN:
// - `nodes` ist eine Map, die deine Knoten-Objekte speichert.
// - `selectedNodeId` speichert die ID des aktuell ausgewählten Knotens.
// - `mindmapSvg` ist dein SVG-Element.
// ====================================================================================

// --- Globale Variablen und Konstanten ---
const mindmapContainer = document.getElementById('mindmap-container');
const mindmapSvg = document.getElementById('mindmap-svg');
const toastNotification = document.getElementById('toast-notification');
const body = document.body; // Referenz zum Body-Element

// Angenommene globale Knoten-Verwaltung
const nodes = new Map(); // Speichert Knoten-Objekte: Map<nodeId, nodeObject>
let selectedNodeId = null;

// Standardwerte für Knoten (vereinfacht, um den Fokus auf Dark Mode zu legen)
const DEFAULT_NODE_RADIUS = 30;
const DEFAULT_FONT_SIZE = 14;

// --- DOM-Elemente abrufen ---
const addRootNodeBtn = document.getElementById('addRootNodeBtn');
const toggleShortcutBtn = document.getElementById('toggleShortcutBtn');
const shortcutWindow = document.getElementById('shortcut-window');
const closeShortcutBtn = document.getElementById('close-shortcut-btn');

// NEU: Dark Mode Button
const toggleDarkModeBtn = document.getElementById('toggleDarkModeBtn');

// --- Event Listener initialisieren ---
document.addEventListener('DOMContentLoaded', () => {
    // Event Listener für "Add Root Node"
    if (addRootNodeBtn) {
        addRootNodeBtn.addEventListener('click', addRootNode);
    }

    // Event Listener für Shortcut-Fenster
    if (toggleShortcutBtn) {
        toggleShortcutBtn.addEventListener('click', toggleShortcuts);
    }
    if (closeShortcutBtn) {
        closeShortcutBtn.addEventListener('click', toggleShortcuts);
    }
    
    // NEU: Event Listener für Dark Mode
    if (toggleDarkModeBtn) {
        toggleDarkModeBtn.addEventListener('click', toggleDarkMode);
    }

    // Initiales Rendern der Mindmap (wird eine leere Mindmap zeichnen)
    renderMindmap();
});

// --- HELPER FUNKTIONEN ---

// Funktion zum Erstellen eines neuen Knotens
function createNode(id, text, parentId, x, y) {
    const node = {
        id: id,
        text: text,
        parentId: parentId,
        children: [],
        x: x,
        y: y,
        // Standardfarben für Knoten im Dark Mode
        color: '#add8e6', // Hellblau
        textColor: '#000000', // Schwarz
        radius: DEFAULT_NODE_RADIUS,
        fontSize: DEFAULT_FONT_SIZE,
    };
    nodes.set(id, node);
    return node;
}

// Funktion zum Finden eines Knotens
function findNodeById(id) {
    return nodes.get(id);
}

// Funktion zum Anzeigen von Toast-Benachrichtigungen
function showToast(message, type = 'info') {
    toastNotification.textContent = message;
    toastNotification.className = `toast ${type} show`;
    setTimeout(() => {
        toastNotification.className = 'toast';
    }, 3000);
}

// --- FUNKTIONEN ZUR KNOTEN- UND LINIENDARSTELLUNG ---

// Funktion, die einen einzelnen Knoten im SVG erstellt/aktualisiert
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
                 .attr('dominant-baseline', 'middle');
    }

    nodeGroup.attr('transform', `translate(${node.x},${node.y})`);

    nodeGroup.select('circle')
        .attr('r', node.radius)
        .style('fill', node.color)
        .style('stroke', selectedNodeId === node.id ? 'orange' : 'black')
        .style('stroke-width', selectedNodeId === node.id ? 3 : 1);

    nodeGroup.select('text')
        .text(node.text)
        .attr('font-size', `${node.fontSize}px`)
        .style('fill', node.textColor);
    
    // Doppelklick zum Bearbeiten des Knotentextes (vereinfacht)
    nodeGroup.on('dblclick', (event) => {
        const newText = prompt('Enter new node text:', node.text);
        if (newText !== null) {
            node.text = newText;
            drawNode(node); // Knoten neu zeichnen mit neuem Text
            showToast('Node text updated!', 'info');
        }
    });
}

// Funktion zum Neuzeichnen aller Linien
function updateConnections() {
    d3.select(mindmapSvg).selectAll('.mindmap-line').remove();

    nodes.forEach(node => {
        if (node.parentId !== null) {
            const parent = findNodeById(node.parentId);
            if (parent) {
                const angleParent = Math.atan2(node.y - parent.y, node.x - parent.x);
                const startX = parent.x + parent.radius * Math.cos(angleParent);
                const startY = parent.y + parent.radius * Math.sin(angleParent);

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

// Haupt-Rendering-Funktion
function renderMindmap() {
    mindmapSvg.innerHTML = '';
    nodes.forEach(node => drawNode(node));
    updateConnections();
}

// --- KERN-FUNKTIONALITÄT (vereinfacht) ---

function selectNode(event, nodeId) {
    event.stopPropagation();

    if (selectedNodeId !== null) {
        const oldSelectedNode = findNodeById(selectedNodeId);
        if (oldSelectedNode) {
            drawNode(oldSelectedNode); // Neu zeichnen, um den Rahmen zu entfernen
        }
    }

    selectedNodeId = nodeId;
    const newSelectedNode = findNodeById(selectedNodeId);
    if (newSelectedNode) {
        drawNode(newSelectedNode); // Neu zeichnen, um den Rahmen anzuzeigen
        showToast(`Node "${newSelectedNode.text}" selected.`, 'info');
    }
}

function addRootNode() {
    const rootId = 'node-' + Date.now();
    const rootNode = createNode(rootId, 'Root Node', null, 200, 200); // Standardposition
    renderMindmap();
    selectNode(null, rootId);
    showToast('Root node added!', 'success');
}

// --- NEU: DARK MODE FUNKTIONALITÄT ---
function toggleDarkMode() {
    body.classList.toggle('light-mode'); // Schaltet die 'light-mode'-Klasse am Body um

    // Speichere die aktuelle Einstellung im localStorage, damit sie beim nächsten Besuch erhalten bleibt
    if (body.classList.contains('light-mode')) {
        localStorage.setItem('theme', 'light');
        showToast('Switched to Light Mode', 'info');
    } else {
        localStorage.setItem('theme', 'dark');
        showToast('Switched to Dark Mode', 'info');
    }
    // Nach dem Umschalten die Mindmap neu rendern, um sicherzustellen,
    // dass Knoten und Linien die korrekten Farben haben, falls sie vom CSS abhängig sind.
    renderMindmap();
}

// Lade Theme-Einstellung beim Start der Seite
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        body.classList.add('light-mode');
    }
    // Den Rest der Event-Listener und Initialisierungen ausführen
    // ... (bereits oben im DOMContentLoaded Block)
});


// --- Drag-Funktionen (notwendig für D3.js) ---
function dragstarted(event, node) {
    event.sourceEvent.stopPropagation();
    d3.select(`#node-${node.id}`).raise().attr('stroke', 'orange');
    selectNode(null, node.id);
}

function dragged(event, node) {
    node.x = event.x;
    node.y = event.y;
    drawNode(node);
    updateConnections();
}

function dragended(event, node) {
    d3.select(`#node-${node.id}`).attr('stroke', selectedNodeId === node.id ? 'orange' : 'black');
    showToast(`Node "${node.text}" moved.`, 'info');
}

// --- Shortcut Window Funktionalität (minimal) ---
function toggleShortcuts() {
    shortcutWindow.classList.toggle('show');
    showToast(shortcutWindow.classList.contains('show') ? 'Shortcuts visible.' : 'Shortcuts hidden.', 'info');
}

// Hier würden normalerweise alle anderen Funktionen (deleteNode, addChildNode, saveMap etc.) stehen.
// Für den "Ursprungszustand mit Dark Mode" halten wir sie aber minimal oder lassen sie weg.
