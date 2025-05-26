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

// Angenommene globale Knoten-Verwaltung
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

// --- DOM-Elemente abrufen ---
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

// Buttons für Größenanpassung
const decreaseNodeSizeBtn = document.getElementById('decreaseNodeSizeBtn');
const increaseNodeSizeBtn = document.getElementById('increaseNodeSizeBtn');

// --- Event Listener initialisieren ---
document.addEventListener('DOMContentLoaded', () => {
    // Deine vorhandenen Event Listener HIER AKTIVIEREN/EINFÜGEN
    // WICHTIG: Stelle sicher, dass die Funktionen, auf die sie sich beziehen, existieren und korrekt sind!

    if (addRootNodeBtn) addRootNodeBtn.addEventListener('click', addRootNode); // AKTIVIERT
    if (clearMapBtn) clearMapBtn.addEventListener('click', clearMap); // AKTIVIERT (muss existieren)
    if (downloadMapBtn) downloadMapBtn.addEventListener('click', saveMap); // AKTIVIERT (muss existieren)
    if (screenshotBtn) screenshotBtn.addEventListener('click', takeScreenshot); // AKTIVIERT (muss existieren)
    if (toggleShortcutBtn) toggleShortcutBtn.addEventListener('click', toggleShortcuts); // AKTIVIERT (muss existieren)
    if (closeShortcutBtn) closeShortcutBtn.addEventListener('click', toggleShortcuts); // AKTIVIERT (muss existieren)
    
    // Für die Farb-Inputs (wenn sie existieren)
    if (defaultNodeColorInput) defaultNodeColorInput.addEventListener('input', handleColorChange); // AKTIVIERT
    if (defaultTextColorInput) defaultTextColorInput.addEventListener('input', handleColorChange); // AKTIVIERT
    if (resetDefaultColorsBtn) resetDefaultColorsBtn.addEventListener('click', resetDefaultColors); // AKTIVIERT (muss existieren)


    // Event Listener für Größenanpassung (NEU - WIE ZUVOR)
    if (decreaseNodeSizeBtn) {
        decreaseNodeSizeBtn.addEventListener('click', () => adjustSelectedNodeSize(-1));
    }
    if (increaseNodeSizeBtn) {
        increaseNodeSizeBtn.addEventListener('click', () => adjustSelectedNodeSize(1));
    }
    
    // Keyboard shortcuts (ANPASSEN, falls anders, aber diese sind essentiell)
    document.addEventListener('keydown', handleKeyboardShortcuts); // AKTIVIERT

    // Initiales Rendern der Mindmap, falls vorhanden
    renderMindmap(); // AKTIVIERT (könnte eine leere Karte zeichnen, wenn keine Daten da sind)
});

// --- HELPER FUNKTIONEN ---

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
// Diese Funktion muss den Radius und die Schriftgröße des Knotens berücksichtigen.
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
    nodeGroup.on('dblclick', (event) => editNodeText(event, node.id)); // AKTIVIERT (muss existieren)
}

// Funktion zum Neuzeichnen aller Linien
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

// Haupt-Rendering-Funktion
function renderMindmap() {
    mindmapSvg.innerHTML = ''; // Leere das SVG vor dem Neuzeichnen
    nodes.forEach(node => drawNode(node)); // Zeichne alle Knoten
    updateConnections(); // Zeichne alle Linien
}

// --- FUNKTIONEN FÜR GRÖSSENANPASSUNG ---
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

// --- EXISTIERENDE FUNKTIONEN (JETZT HIER KOMPLETT) ---

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
    const rootNode = createNode(rootId, 'Root Node', null, 200, 200);
    renderMindmap();
    selectNode(null, rootId);
    showToast('Root node added!', 'success');
}

function handleKeyboardShortcuts(event) {
    // DELETE / BACKSPACE
    if (selectedNodeId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        deleteNode(selectedNodeId); // Ruft die Löschfunktion auf
    }
    // R - Add Root Node
    else if (event.key === 'r' || event.key === 'R') {
        addRootNode();
    }
    // Enter/Tab - Add Child Node
    else if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
        event.preventDefault();
        addChildNode(); // Ruft die Funktion zum Hinzufügen eines Kindknotens auf
    }
    // Shift+Enter/Tab - Add Sibling Node
    else if ((event.key === 'Enter' || event.key === 'Tab') && event.shiftKey) {
        event.preventDefault();
        addSiblingNode(); // Ruft die Funktion zum Hinzufügen eines Geschwisterknotens auf
    }
    // Ctrl/Cmd + S - Save Map
    else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveMap(); // Ruft die Speicherfunktion auf
    }
    // Ctrl/Cmd + P - Screenshot
    else if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        takeScreenshot(); // Ruft die Screenshot-Funktion auf
    }
    // Alt + H - Toggle Shortcuts
    else if (event.altKey && (event.key === 'h' || event.key === 'H')) {
        toggleShortcuts(); // Ruft die Funktion zum Umschalten der Shortcuts auf
    }
}

// Platzhalter-Funktionen, die du mit deiner echten Logik füllen musst
// Diese müssen existieren, da sie im Code aufgerufen werden!
function deleteNode(nodeId) {
    if (!nodeId) return;
    const nodeToDelete = findNodeById(nodeId);
    if (!nodeToDelete) return;

    // Rekursive Funktion zum Entfernen von Knoten und deren Kindern
    function removeNodeAndChildren(id) {
        const node = findNodeById(id);
        if (!node) return;

        // Kinder rekursiv entfernen
        node.children.forEach(childId => removeNodeAndChildren(childId));

        // Knoten aus dem Array/Map entfernen
        nodes.delete(id);

        // SVG-Element entfernen
        d3.select(`#node-${id}`).remove();
    }

    // Elternknoten finden und Kind entfernen
    if (nodeToDelete.parentId) {
        const parent = findNodeById(nodeToDelete.parentId);
        if (parent) {
            parent.children = parent.children.filter(childId => childId !== nodeId);
        }
    }
    
    removeNodeAndChildren(nodeId);
    selectedNodeId = null; // Auswahl aufheben
    renderMindmap(); // Map neu rendern, um Linien zu aktualisieren
    showToast(`Node "${nodeToDelete.text}" and its children deleted.`, 'success');
}

function addChildNode() {
    if (selectedNodeId === null) {
        showToast('Please select a parent node first!', 'error');
        return;
    }
    const parentNode = findNodeById(selectedNodeId);
    if (!parentNode) return;

    const childId = 'node-' + Date.now();
    // Einfache Positionierung: rechts vom Elternknoten
    const childX = parentNode.x + parentNode.radius + 100; 
    const childY = parentNode.y;
    
    const childNode = createNode(childId, 'New Child', parentNode.id, childX, childY);
    parentNode.children.push(childId); // Füge Kind zur Kinderliste des Elternteils hinzu
    renderMindmap();
    selectNode(null, childId);
    showToast('Child node added!', 'success');
}

function addSiblingNode() {
    if (selectedNodeId === null) {
        showToast('Please select a node first to add a sibling!', 'error');
        return;
    }
    const currentNode = findNodeById(selectedNodeId);
    if (!currentNode || currentNode.parentId === null) {
        showToast('Cannot add sibling to root node.', 'error');
        return;
    }

    const parentNode = findNodeById(currentNode.parentId);
    if (!parentNode) {
        showToast('Parent node not found.', 'error');
        return;
    }

    const siblingId = 'node-' + Date.now();
    // Einfache Positionierung: unterhalb des aktuellen Knotens
    const siblingX = currentNode.x;
    const siblingY = currentNode.y + currentNode.radius + 50; // Position unterhalb des aktuellen Knotens

    const siblingNode = createNode(siblingId, 'New Sibling', parentNode.id, siblingX, siblingY);
    parentNode.children.push(siblingId); // Füge Geschwister zur Kinderliste des Elternteils hinzu
    renderMindmap();
    selectNode(null, siblingId);
    showToast('Sibling node added!', 'success');
}


// Funktion zum Bearbeiten des Knotentextes
function editNodeText(event, nodeId) {
    const node = findNodeById(nodeId);
    if (!node) return;

    // Erstelle ein temporäres Input-Feld
    const textElement = d3.select(`#node-${node.id}`).select('text');
    const foreignObject = d3.select(`#node-${node.id}`)
        .append('foreignObject')
        .attr('x', -node.radius) // Basierend auf dem Radius des Knotens
        .attr('y', -node.fontSize / 2) // Zentrieren des Inputs
        .attr('width', node.radius * 2) // Breite des Inputs anpassen
        .attr('height', node.fontSize * 2); // Höhe des Inputs anpassen

    const input = foreignObject.append('xhtml:input')
        .attr('type', 'text')
        .attr('value', node.text)
        .style('width', '100%')
        .style('height', '100%')
        .style('border', 'none')
        .style('background', 'white')
        .style('font-size', `${node.fontSize}px`)
        .style('text-align', 'center')
        .style('color', node.textColor)
        .style('box-sizing', 'border-box')
        .on('keydown', function(e) {
            if (e.key === 'Enter') {
                updateText();
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        });

    // Blende den ursprünglichen Text aus
    textElement.style('display', 'none');

    // Fokus auf das Input-Feld setzen
    input.node().focus();

    const updateText = () => {
        node.text = input.node().value;
        foreignObject.remove(); // Input-Feld entfernen
        textElement.style('display', null); // Originaltext wieder einblenden
        drawNode(node); // Knoten neu zeichnen (Text aktualisieren)
        showToast('Node text updated!', 'info');
    };

    const cancelEdit = () => {
        foreignObject.remove();
        textElement.style('display', null);
        showToast('Text edit cancelled.', 'info');
    };
    
    // Klick außerhalb des Inputs beendet die Bearbeitung
    input.node().addEventListener('blur', updateText);
}


function saveMap() {
    const mapData = JSON.stringify(Array.from(nodes.values()), null, 2); // Konvertiert Map-Werte zu Array
    const blob = new Blob([mapData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Mind map saved as JSON!', 'success');
}

function clearMap() {
    if (confirm('Are you sure you want to clear the entire mind map? This cannot be undone.')) {
        nodes.clear(); // Alle Knoten entfernen
        selectedNodeId = null;
        renderMindmap(); // Leere Mindmap rendern
        showToast('Mind map cleared!', 'info');
    }
}

function takeScreenshot() {
    const isDownload = screenshotToClipboardCb.checked;
    const format = screenshotFormatSelect.value;

    html2canvas(mindmapContainer, {
        backgroundColor: null // Behält den Hintergrund des Containers bei
    }).then(canvas => {
        if (isDownload) {
            if (format === 'jpeg') {
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const a = document.createElement('a');
                a.href = imgData;
                a.download = 'mindmap.jpeg';
                a.click();
            } else if (format === 'pdf') {
                const { jsPDF } = window.jspdf;
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const imgWidth = 210; // A4 width in mm
                const pageHeight = 297; // A4 height in mm
                const imgHeight = canvas.height * imgWidth / canvas.width;
                let heightLeft = imgHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }
                pdf.save('mindmap.pdf');
            } else { // PNG (default)
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = 'mindmap.png';
                a.click();
            }
            showToast(`Screenshot downloaded as ${format.toUpperCase()}!`, 'success');
        } else {
            canvas.toBlob(function(blob) {
                const item = new ClipboardItem({ "image/png": blob });
                navigator.clipboard.write([item]).then(function() {
                    showToast('Screenshot copied to clipboard!', 'success');
                }).catch(function(error) {
                    console.error('Error copying to clipboard:', error);
                    showToast('Failed to copy screenshot to clipboard!', 'error');
                });
            });
        }
    }).catch(error => {
        console.error('Error taking screenshot:', error);
        showToast('Failed to take screenshot!', 'error');
    });
}


function toggleShortcuts() {
    shortcutWindow.classList.toggle('show');
    showToast(shortcutWindow.classList.contains('show') ? 'Shortcuts visible.' : 'Shortcuts hidden.', 'info');
}

function handleColorChange() {
    // Wenn ein Knoten ausgewählt ist, seine Farbe ändern
    if (selectedNodeId) {
        const node = findNodeById(selectedNodeId);
        if (node) {
            // Bestimme, welches Inputfeld geändert wurde und aktualisiere die entsprechende Farbe
            if (this.id === 'defaultNodeColor') {
                node.color = this.value;
            } else if (this.id === 'defaultTextColor') {
                node.textColor = this.value;
            }
            drawNode(node); // Knoten mit neuer Farbe neu zeichnen
            showToast('Node color updated!', 'info');
        }
    } else {
        // Falls kein Knoten ausgewählt ist, könnten dies die Standardfarben für neue Knoten sein.
        // Die Logik dazu ist bereits in createNode implementiert.
        showToast('Default color changed. Select a node to apply color.', 'info');
    }
}

function resetDefaultColors() {
    defaultNodeColorInput.value = '#add8e6';
    defaultTextColorInput.value = '#000000';
    showToast('Default colors reset!', 'info');
    // Hinweis: Dies ändert NICHT die Farben bestehender Knoten, nur die Standardwerte für neue.
    // Wenn du die Farben aller Knoten ändern willst, müsstest du über alle 'nodes' iterieren.
}

// Drag-Funktionen (wie von D3.js erwartet)
function dragstarted(event, node) {
    event.sourceEvent.stopPropagation(); // Verhindert, dass das Dragging andere Events auslöst
    d3.select(`#node-${node.id}`).raise().attr('stroke', 'orange'); // Bringt Knoten in den Vordergrund
    selectNode(null, node.id); // Stellt sicher, dass der gezogene Knoten ausgewählt ist
}

function dragged(event, node) {
    node.x = event.x;
    node.y = event.y;
    drawNode(node); // Aktualisiert die Position des Knotens
    updateConnections(); // Aktualisiert die Linien, die zu/von diesem Knoten führen
}

function dragended(event, node) {
    d3.select(`#node-${node.id}`).attr('stroke', selectedNodeId === node.id ? 'orange' : 'black'); // Setzt Rahmen zurück
    showToast(`Node "${node.text}" moved.`, 'info');
}

// Initialisiere die Mindmap, z.B. wenn die Seite geladen wird.
// renderMindmap(); // Wird bereits im DOMContentLoaded Event aufgerufen
