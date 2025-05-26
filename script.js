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

// Angenommene globale Knoten-Verwaltung
const nodes = new Map(); // Speichert Knoten-Objekte: Map<nodeId, nodeObject>
let selectedNodeId = null;

// Standardwerte für Knoten
let DEFAULT_NODE_RADIUS = 30;
let DEFAULT_FONT_SIZE = 14;
let DEFAULT_NODE_COLOR = "#add8e6"; // Hellblau
let DEFAULT_TEXT_COLOR = "#000000"; // Schwarz

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

const decreaseNodeSizeBtn = document.getElementById('decreaseNodeSizeBtn');
const increaseNodeSizeBtn = document.getElementById('increaseNodeSizeBtn');
const defaultNodeColorInput = document.getElementById('defaultNodeColor');
const defaultTextColorInput = document.getElementById('defaultTextColor');
const resetDefaultColorsBtn = document.getElementById('resetDefaultColorsBtn');


// --- Event Listener initialisieren ---
document.addEventListener('DOMContentLoaded', () => {
    // Event Listener für "Add Root Node"
    if (addRootNodeBtn) {
        addRootNodeBtn.addEventListener('click', addRootNode);
    }

    // Event Listener für "Clear Map"
    if (clearMapBtn) {
        clearMapBtn.addEventListener('click', clearMap);
    }

    // Event Listener für "Download Map"
    if (downloadMapBtn) {
        downloadMapBtn.addEventListener('click', saveMap);
    }

    // Event Listener für "Screenshot"
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', takeScreenshot);
    }

    // Event Listener für Knotengröße
    if (decreaseNodeSizeBtn) {
        decreaseNodeSizeBtn.addEventListener('click', () => adjustNodeSize(-5));
    }
    if (increaseNodeSizeBtn) {
        increaseNodeSizeBtn.addEventListener('click', () => adjustNodeSize(5));
    }

    // Event Listener für Standardfarben
    if (defaultNodeColorInput) {
        defaultNodeColorInput.addEventListener('input', (event) => {
            DEFAULT_NODE_COLOR = event.target.value;
            showToast('Default node color updated!', 'info');
        });
        // Initialen Wert setzen
        defaultNodeColorInput.value = DEFAULT_NODE_COLOR;
    }
    if (defaultTextColorInput) {
        defaultTextColorInput.addEventListener('input', (event) => {
            DEFAULT_TEXT_COLOR = event.target.value;
            showToast('Default text color updated!', 'info');
        });
        // Initialen Wert setzen
        defaultTextColorInput.value = DEFAULT_TEXT_COLOR;
    }
    if (resetDefaultColorsBtn) {
        resetDefaultColorsBtn.addEventListener('click', resetDefaultColors);
    }


    // Event Listener für Tastenkombinationen
    mindmapContainer.addEventListener('keydown', handleKeyDown);

    // Event Listener für Shortcut-Fenster
    if (toggleShortcutBtn) {
        toggleShortcutBtn.addEventListener('click', toggleShortcuts);
    }
    if (closeShortcutBtn) {
        closeShortcutBtn.addEventListener('click', toggleShortcuts);
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
        color: DEFAULT_NODE_COLOR,
        textColor: DEFAULT_TEXT_COLOR,
        radius: DEFAULT_NODE_RADIUS,
        fontSize: DEFAULT_FONT_SIZE,
    };
    nodes.set(id, node);
    if (parentId !== null) {
        const parentNode = nodes.get(parentId);
        if (parentNode) {
            parentNode.children.push(id);
        }
    }
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
    
    // Doppelklick zum Bearbeiten des Knotentextes
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
                // Berechne die Schnittpunkte auf den Kreisen für die Linie
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
    mindmapSvg.innerHTML = ''; // Vorherige Elemente entfernen
    nodes.forEach(node => drawNode(node));
    updateConnections();
}

// --- KERN-FUNKTIONALITÄT ---

function selectNode(event, nodeId) {
    event.stopPropagation(); // Verhindert, dass Klick auf SVG die Auswahl aufhebt

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

// Wenn auf den SVG-Container geklickt wird (nicht auf einen Knoten), Auswahl aufheben
mindmapContainer.addEventListener('click', (event) => {
    if (event.target.id === 'mindmap-svg' || event.target.id === 'mindmap-container') {
        if (selectedNodeId !== null) {
            const oldSelectedNode = findNodeById(selectedNodeId);
            selectedNodeId = null;
            if (oldSelectedNode) {
                drawNode(oldSelectedNode); // Neu zeichnen, um den Rahmen zu entfernen
                showToast('Node selection cleared.', 'info');
            }
        }
    }
});


function addRootNode() {
    const rootId = 'node-' + Date.now();
    const rootNode = createNode(rootId, 'New Root', null, 200, 200); // Standardposition
    renderMindmap();
    selectNode(null, rootId);
    showToast('Root node added!', 'success');
}

function addChildNode() {
    if (selectedNodeId) {
        const parentNode = findNodeById(selectedNodeId);
        if (parentNode) {
            const childId = 'node-' + Date.now();
            const childNode = createNode(childId, 'New Child', parentNode.id, parentNode.x + 100, parentNode.y + 50);
            renderMindmap();
            selectNode(null, childId);
            showToast('Child node added!', 'success');
        }
    } else {
        showToast('Please select a node first to add a child!', 'error');
    }
}

function addSiblingNode() {
    if (selectedNodeId) {
        const currentNode = findNodeById(selectedNodeId);
        if (currentNode && currentNode.parentId !== null) {
            const parentNode = findNodeById(currentNode.parentId);
            if (parentNode) {
                const siblingId = 'node-' + Date.now();
                const siblingNode = createNode(siblingId, 'New Sibling', parentNode.id, currentNode.x, currentNode.y + 70); // Unter dem aktuellen Knoten
                renderMindmap();
                selectNode(null, siblingId);
                showToast('Sibling node added!', 'success');
            }
        } else {
            showToast('Cannot add sibling to a root node or no node selected!', 'error');
        }
    } else {
        showToast('Please select a node first to add a sibling!', 'error');
    }
}

function deleteSelectedNode() {
    if (selectedNodeId) {
        const nodeToDelete = findNodeById(selectedNodeId);
        if (nodeToDelete) {
            // Rekursive Funktion zum Löschen von Kindern
            function deleteChildren(node) {
                node.children.forEach(childId => {
                    const childNode = findNodeById(childId);
                    if (childNode) {
                        deleteChildren(childNode); // Rekursiver Aufruf
                    }
                });
                nodes.delete(node.id); // Knoten selbst löschen
            }

            deleteChildren(nodeToDelete); // Beginne mit dem Löschen der Kinder des ausgewählten Knotens

            // Entferne den Knoten aus der Kinderliste seines Elternteils
            if (nodeToDelete.parentId !== null) {
                const parent = findNodeById(nodeToDelete.parentId);
                if (parent) {
                    parent.children = parent.children.filter(childId => childId !== nodeToDelete.id);
                }
            }
            
            selectedNodeId = null; // Auswahl aufheben
            renderMindmap();
            showToast(`Node "${nodeToDelete.text}" and its children deleted.`, 'success');
        }
    } else {
        showToast('No node selected for deletion!', 'error');
    }
}

function clearMap() {
    if (confirm("Are you sure you want to clear the entire mind map? This action cannot be undone.")) {
        nodes.clear();
        selectedNodeId = null;
        renderMindmap();
        showToast('Mind map cleared!', 'success');
    }
}

function saveMap() {
    if (nodes.size === 0) {
        showToast('No nodes to save!', 'info');
        return;
    }
    const nodesArray = Array.from(nodes.values()); // Map zu Array konvertieren
    const dataStr = JSON.stringify(nodesArray, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
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

// Hinweis: Load Map Funktion ist nicht direkt über einen Button verfügbar,
// aber du könntest sie über Drag-and-Drop oder ein Date-Input implementieren, falls nötig.
// Für den "Ursprungszustand" lassen wir sie hier erstmal als Kommentar.
/*
function loadMap(jsonString) {
    try {
        const loadedNodesArray = JSON.parse(jsonString);
        nodes.clear();
        selectedNodeId = null;
        loadedNodesArray.forEach(node => {
            nodes.set(node.id, node);
        });
        renderMindmap();
        showToast('Mind map loaded successfully!', 'success');
    } catch (e) {
        showToast('Error loading map: Invalid JSON!', 'error');
        console.error(e);
    }
}
*/

// --- Tastatur-Shortcuts ---
function handleKeyDown(event) {
    if (shortcutWindow.classList.contains('show')) {
        // Wenn das Shortcut-Fenster offen ist, keine Aktionen auslösen
        return;
    }

    const isCtrlCmd = event.ctrlKey || event.metaKey; // Ctrl für Windows/Linux, Cmd für Mac
    const isShift = event.shiftKey;
    const isAlt = event.altKey;

    // Verhinderung von Standard-Browser-Aktionen
    if ((isCtrlCmd && event.key === 's') || (isCtrlCmd && event.key === 'p') || (event.key === 'Tab')) {
        event.preventDefault();
    }

    switch (event.key) {
        case 'r': // R for Root Node
            addRootNode();
            break;
        case 'Enter':
        case 'Tab':
            if (isShift) {
                addSiblingNode();
            } else {
                addChildNode();
            }
            break;
        case 'Delete':
        case 'Backspace':
            deleteSelectedNode();
            break;
        case 's':
            if (isCtrlCmd) {
                saveMap();
            }
            break;
        case 'p':
            if (isCtrlCmd) {
                takeScreenshot();
            }
            break;
        case 'h':
            if (isAlt) {
                toggleShortcuts();
            }
            break;
        // Navigation (optional, falls du das später hinzufügen möchtest)
        // case 'ArrowUp':
        // case 'ArrowDown':
        // case 'ArrowLeft':
        // case 'ArrowRight':
        //    break;
    }
}

// --- Screenshot Funktionalität ---
function takeScreenshot() {
    // Umgebende Box des gesamten Inhalts (Knoten und Linien) berechnen
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        minX = Math.min(minX, node.x - node.radius);
        minY = Math.min(minY, node.y - node.radius);
        maxX = Math.max(maxX, node.x + node.radius);
        maxY = Math.max(maxY, node.y + node.radius);
    });

    if (nodes.size === 0) {
        showToast('No nodes to screenshot!', 'info');
        return;
    }

    // Füge einen kleinen Puffer hinzu
    const padding = 50;
    const captureX = minX - padding;
    const captureY = minY - padding;
    const captureWidth = (maxX - minX) + 2 * padding;
    const captureHeight = (maxY - minY) + 2 * padding;

    // HTML2Canvas kann Probleme mit SVG haben. Hier wird versucht, das SVG direkt zu rendern.
    // Eine bessere Lösung wäre, das SVG in ein Canvas-Kontext zu zeichnen,
    // aber html2canvas bietet oft eine "useCORS: true" Option, die helfen kann.

    html2canvas(mindmapContainer, {
        backgroundColor: mindmapContainer.style.backgroundColor || window.getComputedStyle(mindmapContainer).backgroundColor,
        width: captureWidth,
        height: captureHeight,
        x: captureX,
        y: captureY,
        scale: 2, // Für bessere Auflösung
        useCORS: true // Wichtig für externe Ressourcen wie Bilder, auch wenn hier nicht direkt genutzt
    }).then(canvas => {
        const format = screenshotFormatSelect.value;

        if (screenshotToClipboardCb.checked) {
            // Download-Option aktiv, also speichern
            if (format === 'pdf') {
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const pdf = new window.jspdf.jsPDF({
                    orientation: captureWidth > captureHeight ? 'l' : 'p',
                    unit: 'px',
                    format: [captureWidth, captureHeight]
                });
                pdf.addImage(imgData, 'JPEG', 0, 0, captureWidth, captureHeight);
                pdf.save('mindmap.pdf');
            } else {
                const link = document.createElement('a');
                link.download = `mindmap.${format}`;
                link.href = canvas.toDataURL(`image/${format === 'jpeg' ? 'jpeg' : 'png'}`);
                link.click();
            }
            showToast('Screenshot downloaded!', 'success');

        } else {
            // In die Zwischenablage kopieren (nur PNG unterstützt)
            canvas.toBlob(function(blob) {
                const item = new ClipboardItem({'image/png': blob});
                navigator.clipboard.write([item]).then(function() {
                    showToast('Screenshot copied to clipboard!', 'success');
                }).catch(function(error) {
                    showToast('Failed to copy screenshot to clipboard. Browser support or permissions missing.', 'error');
                    console.error('Clipboard write failed:', error);
                });
            }, 'image/png');
        }
    }).catch(error => {
        showToast('Error taking screenshot. Please check browser console.', 'error');
        console.error('Screenshot error:', error);
    });
}


// --- Drag-Funktionen (notwendig für D3.js) ---
function dragstarted(event, node) {
    event.sourceEvent.stopPropagation(); // Verhindert Klicks auf Hintergrund
    d3.select(`#node-${node.id}`).raise().attr('stroke', 'orange');
    selectNode(null, node.id); // Knoten auswählen, wenn Drag beginnt
}

function dragged(event, node) {
    node.x = event.x;
    node.y = event.y;
    drawNode(node);
    updateConnections();
}

function dragended(event, node) {
    // Setze den Rand zurück, wenn der Knoten nicht mehr ausgewählt ist
    d3.select(`#node-${node.id}`).attr('stroke', selectedNodeId === node.id ? 'orange' : 'black');
    showToast(`Node "${node.text}" moved.`, 'info');
}

// --- Shortcut Window Funktionalität ---
// Draggable
d3.select('#shortcut-window').call(d3.drag()
    .on('start', function() {
        d3.select(this).raise().style('cursor', 'grabbing');
    })
    .on('drag', function(event) {
        d3.select(this)
            .style('left', `${event.x}px`)
            .style('top', `${event.y}px`);
    })
    .on('end', function() {
        d3.select(this).style('cursor', 'grab');
    }));

function toggleShortcuts() {
    shortcutWindow.classList.toggle('show');
    showToast(shortcutWindow.classList.contains('show') ? 'Shortcuts visible.' : 'Shortcuts hidden.', 'info');
}

// --- Knoten Größen Anpassung ---
function adjustNodeSize(delta) {
    if (selectedNodeId) {
        const node = findNodeById(selectedNodeId);
        if (node) {
            node.radius = Math.max(10, node.radius + delta); // Mindestgröße 10
            node.fontSize = Math.max(8, node.fontSize + (delta > 0 ? 1 : -1)); // Schriftgröße proportional anpassen
            drawNode(node);
            updateConnections();
            showToast('Node size adjusted!', 'info');
        }
    } else {
        showToast('Please select a node to adjust its size!', 'error');
    }
}

// --- Standardfarben zurücksetzen ---
function resetDefaultColors() {
    DEFAULT_NODE_COLOR = "#add8e6"; // Hellblau
    DEFAULT_TEXT_COLOR = "#000000"; // Schwarz
    if (defaultNodeColorInput) defaultNodeColorInput.value = DEFAULT_NODE_COLOR;
    if (defaultTextColorInput) defaultTextColorInput.value = DEFAULT_TEXT_COLOR;
    showToast('Default colors reset!', 'info');
}

// Wenn ein Knoten ausgewählt ist, können seine Farben geändert werden (optional, hier nicht direkt per Button)
// Du könntest hier eine Funktion einfügen, die die Farbe des ausgewählten Knotens ändert.
/*
function changeSelectedNodeColor(newColor) {
    if (selectedNodeId) {
        const node = findNodeById(selectedNodeId);
        if (node) {
            node.color = newColor;
            drawNode(node);
        }
    }
}

function changeSelectedNodeTextColor(newColor) {
    if (selectedNodeId) {
        const node = findNodeById(selectedNodeId);
        if (node) {
            node.textColor = newColor;
            drawNode(node);
        }
    }
}
*/
