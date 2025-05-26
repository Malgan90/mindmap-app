document.addEventListener('DOMContentLoaded', () => {
    const mindmapContainer = document.getElementById('mindmap-container');
    const svg = document.getElementById('mindmap-svg');
    const addRootNodeBtn = document.getElementById('addRootNodeBtn');
    const clearMapBtn = document.getElementById('clearMapBtn');
    const downloadMapBtn = document.getElementById('downloadMapBtn');
    const screenshotToClipboardBtn = document.getElementById('screenshotToClipboardBtn');
    const downloadScreenshotBtn = document.getElementById('downloadScreenshotBtn');
    const toggleShortcutBtn = document.getElementById('toggleShortcutBtn');
    const toggleDarkModeBtn = document.getElementById('toggleDarkModeBtn');
    const defaultNodeColorPicker = document.getElementById('defaultNodeColor');
    const defaultTextColorPicker = document.getElementById('defaultTextColor');
    const screenshotFormatSelect = document.getElementById('screenshotFormatSelect');
    const toastNotification = document.getElementById('toast-notification');
    const resetDefaultColorsBtn = document.getElementById('resetDefaultColorsBtn');
    let toastTimeout;

    // CSS Variablen Namen (müssen mit CSS :root Definitionen übereinstimmen)
    const CSS_VAR_NODE_DEFAULT_BG = '--node-default-bg';
    const CSS_VAR_NODE_DEFAULT_TEXT = '--node-default-text';
    const CSS_VAR_MINDMAP_BG = '--mindmap-bg'; // Für Screenshot Hintergrund

    // Ursprüngliche Default-Werte (Light Mode) aus den HTML input value Attributen
    const initialLightModeNodeColor = defaultNodeColorPicker.value;
    const initialLightModeTextColor = defaultTextColorPicker.value;

    const shortcutWindow = document.getElementById('shortcut-window');
    const shortcutHeader = shortcutWindow.querySelector('.shortcut-header');
    const closeShortcutBtn = document.getElementById('close-shortcut-btn');
    const resizeHandle = shortcutWindow.querySelector('.resize-handle');
    let isDraggingShortcutWindow = false, isResizingShortcutWindow = false;
    let shortcutWindowDragX, shortcutWindowDragY, shortcutWindowResizeStartX, shortcutWindowResizeStartY, shortcutWindowInitialWidth, shortcutWindowInitialHeight;

    let nodes = [];
    let nodeIdCounter = 0;
    let selectedNodeId = null;

    let activeDragNodeData = null;
    let dragOffsetX, dragOffsetY;
    let currentDragTargetInfo = { type: null, id: null, lineElement: null, lineParentId: null, lineChildId: null };

    // --- Dark Mode Logik ---
    function applyDarkModePreference() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        document.body.classList.toggle('dark-mode', isDarkMode);
        if (toggleDarkModeBtn) {
            toggleDarkModeBtn.textContent = isDarkMode ? '☀️' : '🌙';
            toggleDarkModeBtn.title = isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }

        // Setze die globalen Farbpicker auf die Defaults des aktuellen Themes
        // Dies liest die Werte, die im CSS für :root oder body.dark-mode definiert sind
        const currentThemeNodeBg = getComputedStyle(document.documentElement).getPropertyValue(CSS_VAR_NODE_DEFAULT_BG).trim();
        const currentThemeNodeText = getComputedStyle(document.documentElement).getPropertyValue(CSS_VAR_NODE_DEFAULT_TEXT).trim();
        
        defaultNodeColorPicker.value = currentThemeNodeBg;
        defaultTextColorPicker.value = currentThemeNodeText;
        // Die 'input' Event Listener der Picker sind nicht nötig, da die CSS Variablen bereits die Quelle der Wahrheit sind.
        // Aber wenn der User die Picker direkt ändert, müssen die CSS Variablen aktualisiert werden.
    }
    
    // Funktion zum Aktualisieren der CSS Variablen, wenn Picker geändert werden
    function updateCSSVariablesFromPickers() {
        document.documentElement.style.setProperty(CSS_VAR_NODE_DEFAULT_BG, defaultNodeColorPicker.value);
        document.documentElement.style.setProperty(CSS_VAR_NODE_DEFAULT_TEXT, defaultTextColorPicker.value);
    }

    if (toggleDarkModeBtn) {
        toggleDarkModeBtn.addEventListener('click', () => {
            const isCurrentlyDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', !isCurrentlyDark);
            applyDarkModePreference(); // Wendet Klassen an und aktualisiert Picker auf Theme-Defaults
        });
    }
    
    // Listener für globale Picker, um CSS Variablen zu aktualisieren
    defaultNodeColorPicker.addEventListener('input', updateCSSVariablesFromPickers);
    defaultTextColorPicker.addEventListener('input', updateCSSVariablesFromPickers);

    // Initial Dark Mode anwenden
    applyDarkModePreference();
    // --- Ende Dark Mode Logik ---

    function createNodeElement(nodeData) {
        const nodeDiv = document.createElement('div');
        nodeDiv.classList.add('node');
        nodeDiv.id = nodeData.id;
        nodeDiv.style.left = `${nodeData.x}px`;
        nodeDiv.style.top = `${nodeData.y}px`;
        nodeDiv.style.backgroundColor = nodeData.bgColor;
        nodeDiv.style.borderColor = getDarkerColor(nodeData.bgColor);

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.classList.add('node-text-input');
        textInput.value = nodeData.text;
        textInput.style.color = nodeData.textColor;
        textInput.addEventListener('change', (e) => { nodeData.text = e.target.value; });
        textInput.addEventListener('mousedown', (e) => e.stopPropagation());
        textInput.addEventListener('focus', (e) => e.target.select());
        textInput.addEventListener('keydown', (e) => { 
            e.stopPropagation(); 
            if (e.key === 'Enter' || e.key === 'Escape') textInput.blur(); 
        });

        const controlsDiv = document.createElement('div');
        controlsDiv.classList.add('node-controls');
        const buttonsRow = document.createElement('div');
        buttonsRow.classList.add('buttons-row');
        const addChildBtn = document.createElement('button');
        addChildBtn.textContent = '+';
        addChildBtn.title = 'Add child node';
        addChildBtn.addEventListener('click', (e) => { e.stopPropagation(); addNode(nodeData.id); });
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete this node';
        deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteNode(nodeData.id); });
        buttonsRow.appendChild(addChildBtn);
        buttonsRow.appendChild(deleteBtn);
        controlsDiv.appendChild(buttonsRow);

        const nodeColorPickersDiv = document.createElement('div');
        nodeColorPickersDiv.classList.add('node-color-pickers');
        const bgColorDiv = document.createElement('div');
        const bgColorLabel = document.createElement('label');
        bgColorLabel.textContent = 'Node:';
        const nodeBgColorInput = document.createElement('input');
        nodeBgColorInput.type = 'color';
        nodeBgColorInput.value = nodeData.bgColor;
        nodeBgColorInput.title = 'Change node background color';
        nodeBgColorInput.addEventListener('input', (e) => {
            nodeData.bgColor = e.target.value;
            nodeDiv.style.backgroundColor = nodeData.bgColor;
            nodeDiv.style.borderColor = getDarkerColor(nodeData.bgColor);
        });
        nodeBgColorInput.addEventListener('mousedown', e => e.stopPropagation());
        bgColorDiv.appendChild(bgColorLabel);
        bgColorDiv.appendChild(nodeBgColorInput);
        nodeColorPickersDiv.appendChild(bgColorDiv);

        const textColorDiv = document.createElement('div');
        const textColorLabel = document.createElement('label');
        textColorLabel.textContent = 'Text:';
        const nodeTextColorInput = document.createElement('input');
        nodeTextColorInput.type = 'color';
        nodeTextColorInput.value = nodeData.textColor;
        nodeTextColorInput.title = 'Change node text color';
        nodeTextColorInput.addEventListener('input', (e) => {
            nodeData.textColor = e.target.value;
            textInput.style.color = nodeData.textColor;
        });
        nodeTextColorInput.addEventListener('mousedown', e => e.stopPropagation());
        textColorDiv.appendChild(textColorLabel);
        textColorDiv.appendChild(nodeTextColorInput);
        nodeColorPickersDiv.appendChild(textColorDiv);
        controlsDiv.appendChild(nodeColorPickersDiv);

        const resetColorsBtn = document.createElement('button');
        resetColorsBtn.textContent = 'Reset Colors';
        resetColorsBtn.classList.add('reset-colors-btn');
        resetColorsBtn.title = 'Reset colors to current theme default';
        resetColorsBtn.addEventListener('click', (e) => { e.stopPropagation(); resetNodeColors(nodeData, nodeDiv, textInput); });
        controlsDiv.appendChild(resetColorsBtn);

        nodeDiv.appendChild(textInput);
        nodeDiv.appendChild(controlsDiv);
        nodeDiv.addEventListener('mousedown', handleNodeMouseDown);
        nodeDiv.addEventListener('click', handleNodeClick);
        nodeData.element = nodeDiv;
        return nodeDiv;
    }

    function resetNodeColors(nodeData, nodeDivElement, textInputElement) {
        nodeData.bgColor = defaultNodeColorPicker.value; // Nimmt aktuellen Wert des globalen Pickers
        nodeData.textColor = defaultTextColorPicker.value; // Nimmt aktuellen Wert des globalen Pickers

        nodeDivElement.style.backgroundColor = nodeData.bgColor;
        nodeDivElement.style.borderColor = getDarkerColor(nodeData.bgColor);
        textInputElement.style.color = nodeData.textColor;
        
        const nodeControls = nodeDivElement.querySelector('.node-controls');
        if (nodeControls) {
            const bgPicker = nodeControls.querySelector('.node-color-pickers input[type="color"]');
            const textPicker = nodeControls.querySelectorAll('.node-color-pickers input[type="color"]')[1];
            if (bgPicker) bgPicker.value = nodeData.bgColor;
            if (textPicker) textPicker.value = nodeData.textColor;
        }
    }

    function addNode(parentId = null, initialProps = {}) {
        nodeIdCounter++;
        const newNodeId = `node-${nodeIdCounter}`;
        let x = initialProps.x || 50, y = initialProps.y || 50, text = initialProps.text || 'New Idea';
        
        // Nimmt Default-Farben aus den globalen Pickern (die durch Dark Mode beeinflusst werden)
        const bgColor = initialProps.bgColor || defaultNodeColorPicker.value;
        const textColor = initialProps.textColor || defaultTextColorPicker.value;
        
        const tempElement = createDummyNodeElement(text);
        let nodeWidth = Math.max(100, tempElement.offsetWidth); // Mindestbreite 100px (aus CSS)
        let nodeHeight = Math.max(100, tempElement.offsetHeight); // Mindesthöhe 100px für runde Nodes
        tempElement.remove();

        if (parentId) {
            const parent = nodes.find(n => n.id === parentId);
            if (parent && parent.element) {
                const parentRect = parent.element.getBoundingClientRect();
                x = parent.x + parentRect.width + 30 + Math.random() * 20;
                y = parent.y + (parentRect.height / 2) - (nodeHeight / 2) + Math.random() * 40 - 20;
            }
        } else { 
            const rootNodes = nodes.filter(n => !n.parentId);
            x = 50 + rootNodes.length * 20; 
            y = 50 + rootNodes.length * 20;
        }
        
        x = Math.max(10, Math.min(x, mindmapContainer.scrollWidth - nodeWidth - 10));
        y = Math.max(10, Math.min(y, mindmapContainer.scrollHeight - nodeHeight - 10));
        
        const newNodeData = { id: newNodeId, text, x, y, parentId, bgColor, textColor, childrenIds: [], element: null };
        nodes.push(newNodeData);
        if (parentId) {
            const parent = nodes.find(n => n.id === parentId);
            if (parent) parent.childrenIds.push(newNodeId);
        }
        const nodeElement = createNodeElement(newNodeData);
        mindmapContainer.appendChild(nodeElement);
        drawLines();
        selectNode(newNodeId); 
        const newInput = nodeElement.querySelector('.node-text-input');
        if (newInput) newInput.focus();
        return newNodeData;
    }

    function deleteNode(nodeId) {
        const nodeToDelete = nodes.find(n => n.id === nodeId);
        if (!nodeToDelete) return;
        [...nodeToDelete.childrenIds].forEach(childId => deleteNode(childId));
        if (nodeToDelete.parentId) {
            const parent = nodes.find(n => n.id === nodeToDelete.parentId);
            if (parent) parent.childrenIds = parent.childrenIds.filter(id => id !== nodeId);
        }
        if (nodeToDelete.element) nodeToDelete.element.remove();
        nodes = nodes.filter(n => n.id !== nodeId);
        if (selectedNodeId === nodeId) {
            const newSelectedId = nodeToDelete.parentId ? nodeToDelete.parentId : (nodes.length > 0 ? nodes[0].id : null);
            selectNode(newSelectedId);
        }
        drawLines();
    }

    function handleNodeClick(e) { e.stopPropagation(); const nodeId = e.currentTarget.id; selectNode(nodeId); }
    
    function selectNode(nodeIdToSelect) {
        if (selectedNodeId && selectedNodeId !== nodeIdToSelect) {
            const oldSelectedNodeElement = document.getElementById(selectedNodeId);
            if (oldSelectedNodeElement) oldSelectedNodeElement.classList.remove('selected');
        }
        selectedNodeId = nodeIdToSelect;
        if (selectedNodeId) {
            const newSelectedNodeElement = document.getElementById(selectedNodeId);
            if (newSelectedNodeElement) newSelectedNodeElement.classList.add('selected');
        }
    }

    mindmapContainer.addEventListener('click', (e) => { if (e.target === mindmapContainer) selectNode(null); });

    function drawLines() {
        svg.innerHTML = '';
        nodes.forEach(node => {
            if (node.parentId) {
                const parentNode = nodes.find(p => p.id === node.parentId);
                if (parentNode && parentNode.element && node.element) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    const pRect = parentNode.element.getBoundingClientRect();
                    const cRect = node.element.getBoundingClientRect();
                    const containerRect = mindmapContainer.getBoundingClientRect();
                    const x1 = (pRect.left - containerRect.left + pRect.width / 2) + mindmapContainer.scrollLeft;
                    const y1 = (pRect.top - containerRect.top + pRect.height / 2) + mindmapContainer.scrollTop;
                    const x2 = (cRect.left - containerRect.left + cRect.width / 2) + mindmapContainer.scrollLeft;
                    const y2 = (cRect.top - containerRect.top + cRect.height / 2) + mindmapContainer.scrollTop;
                    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
                    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
                    // Linienfarbe wird jetzt durch CSS Variable '--line-color' in #mindmap-svg line gesteuert
                    line.setAttribute('stroke-width', '2');
                    line.dataset.parentId = parentNode.id; line.dataset.childId = node.id;
                    svg.appendChild(line);
                }
            }
        });
    }
    window.addEventListener('resize', drawLines);
    mindmapContainer.addEventListener('scroll', drawLines);

    function handleNodeMouseDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.closest('button') || e.target.closest('.node-controls input[type="color"]')) return;
        activeDragNodeData = nodes.find(n => n.id === e.currentTarget.id);
        if (!activeDragNodeData || !activeDragNodeData.element) { activeDragNodeData = null; return; }
        e.stopPropagation();
        selectNode(activeDragNodeData.id);
        activeDragNodeData.element.classList.add('dragging');
        const rect = activeDragNodeData.element.getBoundingClientRect();
        const containerRect = mindmapContainer.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left; dragOffsetY = e.clientY - rect.top;
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
    }

    function handleDocumentMouseMove(e) {
        if (!activeDragNodeData || !activeDragNodeData.element) { cleanupGlobalDragListeners(); return; }
        e.preventDefault();
        const containerRect = mindmapContainer.getBoundingClientRect();
        let newX = e.clientX - containerRect.left - dragOffsetX + mindmapContainer.scrollLeft;
        let newY = e.clientY - containerRect.top - dragOffsetY + mindmapContainer.scrollTop;
        const nodeWidth = activeDragNodeData.element.offsetWidth;
        const nodeHeight = activeDragNodeData.element.offsetHeight;
        newX = Math.max(0, Math.min(newX, mindmapContainer.scrollWidth - nodeWidth));
        newY = Math.max(0, Math.min(newY, mindmapContainer.scrollHeight - nodeHeight));
        activeDragNodeData.x = newX; activeDragNodeData.y = newY;
        activeDragNodeData.element.style.left = `${newX}px`; activeDragNodeData.element.style.top = `${newY}px`;
        drawLines();
        clearAllHighlights();
        currentDragTargetInfo = { type: null, id: null, lineElement: null, lineParentId: null, lineChildId: null };
        const dropPointElemX = activeDragNodeData.element.getBoundingClientRect().left + nodeWidth / 2;
        const dropPointElemY = activeDragNodeData.element.getBoundingClientRect().top + nodeHeight / 2;
        const elementsUnderDropPoint = document.elementsFromPoint(dropPointElemX, dropPointElemY);
        let foundNodeTarget = false;
        for (const el of elementsUnderDropPoint) {
            if (el.classList && el.classList.contains('node') && el.id !== activeDragNodeData.id) {
                const targetNodeData = nodes.find(n => n.id === el.id);
                if (targetNodeData && !isDescendant(activeDragNodeData, targetNodeData.id) && targetNodeData.id !== activeDragNodeData.parentId) {
                    el.classList.add('drop-target-highlight');
                    currentDragTargetInfo = { type: 'node', id: el.id };
                    foundNodeTarget = true; break;
                }
            }
        }
        if (!foundNodeTarget) {
            const dropPointSvgX = newX + nodeWidth / 2; const dropPointSvgY = newY + nodeHeight / 2;
            const allLines = Array.from(svg.querySelectorAll('line'));
            for (const line of allLines) {
                const linePId = line.dataset.parentId; const lineCId = line.dataset.childId;
                if (linePId === activeDragNodeData.id || lineCId === activeDragNodeData.id || (activeDragNodeData.parentId === linePId && activeDragNodeData.childrenIds.includes(lineCId))) continue;
                const x1 = parseFloat(line.getAttribute('x1')); const y1 = parseFloat(line.getAttribute('y1'));
                const x2 = parseFloat(line.getAttribute('x2')); const y2 = parseFloat(line.getAttribute('y2'));
                if (isPointNearLine(dropPointSvgX, dropPointSvgY, x1, y1, x2, y2, 20)) {
                    line.classList.add('line-drop-target-highlight');
                    currentDragTargetInfo = { type: 'line', lineElement: line, lineParentId: linePId, lineChildId: lineCId };
                    break;
                }
            }
        }
    }
    
    function isPointNearLine(px, py, x1, y1, x2, y2, tolerance) {
        const lenSq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (lenSq === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1)) < tolerance;
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * (x2 - x1); const projY = y1 + t * (y2 - y1);
        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY)) < tolerance;
    }

    function handleDocumentMouseUp() {
        if (activeDragNodeData && activeDragNodeData.element) {
            activeDragNodeData.element.classList.remove('dragging');
            clearAllHighlights();
            if (currentDragTargetInfo.type === 'node' && currentDragTargetInfo.id) {
                const dropTargetNode = nodes.find(n => n.id === currentDragTargetInfo.id);
                if (dropTargetNode && activeDragNodeData.id !== dropTargetNode.id && !isDescendant(activeDragNodeData, dropTargetNode.id) && activeDragNodeData.parentId !== dropTargetNode.id) {
                    if (activeDragNodeData.parentId) {
                        const oldParent = nodes.find(n => n.id === activeDragNodeData.parentId);
                        if (oldParent) oldParent.childrenIds = oldParent.childrenIds.filter(id => id !== activeDragNodeData.id);
                    }
                    activeDragNodeData.parentId = dropTargetNode.id;
                    if (!dropTargetNode.childrenIds.includes(activeDragNodeData.id)) dropTargetNode.childrenIds.push(activeDragNodeData.id);
                }
            } else if (currentDragTargetInfo.type === 'line' && currentDragTargetInfo.lineElement) {
                const { lineParentId, lineChildId } = currentDragTargetInfo;
                const originalParentOfLine = nodes.find(n => n.id === lineParentId);
                const originalChildOfLine = nodes.find(n => n.id === lineChildId);
                if (originalParentOfLine && originalChildOfLine && activeDragNodeData.id !== originalParentOfLine.id && activeDragNodeData.id !== originalChildOfLine.id && !isDescendant(activeDragNodeData, originalParentOfLine.id) && !isDescendant(activeDragNodeData, originalChildOfLine.id)) {
                    if (activeDragNodeData.parentId) {
                        const oldParentOfDragged = nodes.find(n => n.id === activeDragNodeData.parentId);
                        if (oldParentOfDragged) oldParentOfDragged.childrenIds = oldParentOfDragged.childrenIds.filter(id => id !== activeDragNodeData.id);
                    }
                    activeDragNodeData.parentId = originalParentOfLine.id;
                    if(!originalParentOfLine.childrenIds.includes(activeDragNodeData.id)) originalParentOfLine.childrenIds.push(activeDragNodeData.id);
                    originalParentOfLine.childrenIds = originalParentOfLine.childrenIds.filter(id => id !== originalChildOfLine.id);
                    originalChildOfLine.parentId = activeDragNodeData.id;
                    if (!activeDragNodeData.childrenIds.includes(originalChildOfLine.id)) activeDragNodeData.childrenIds.push(originalChildOfLine.id);
                }
            }
            drawLines();
        }
        cleanupGlobalDragListeners();
    }

    function cleanupGlobalDragListeners() {
        if (activeDragNodeData && activeDragNodeData.element && activeDragNodeData.element.classList.contains('dragging')) activeDragNodeData.element.classList.remove('dragging');
        activeDragNodeData = null;
        currentDragTargetInfo = { type: null, id: null, lineElement: null, lineParentId: null, lineChildId: null };
        document.removeEventListener('mousemove', handleDocumentMouseMove);
    }

    function clearAllHighlights() {
        document.querySelectorAll('.node.drop-target-highlight').forEach(n => n.classList.remove('drop-target-highlight'));
        document.querySelectorAll('line.line-drop-target-highlight').forEach(l => l.classList.remove('line-drop-target-highlight'));
    }

    function isDescendant(potentialParentNode, childNodeId) {
        if (!potentialParentNode || !potentialParentNode.childrenIds || potentialParentNode.childrenIds.length === 0) return false;
        if (potentialParentNode.childrenIds.includes(childNodeId)) return true;
        for (const id of potentialParentNode.childrenIds) {
            const child = nodes.find(n => n.id === id);
            if (child && isDescendant(child, childNodeId)) return true;
        }
        return false;
    }

    function getDarkerColor(hex) {
        if (!hex || hex.length < 7) return '#000000';
        let r = parseInt(hex.slice(1,3),16); let g = parseInt(hex.slice(3,5),16); let b = parseInt(hex.slice(5,7),16);
        r = Math.max(0, r - 40); g = Math.max(0, g - 40); b = Math.max(0, b - 40);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    function createDummyNodeElement(text) {
        const dummyDiv = document.createElement('div');
        dummyDiv.classList.add('node');
        dummyDiv.style.cssText = 'position:absolute; visibility:hidden; left:-10000px; top:-10000px; min-width:100px; min-height:100px;'; // Wichtig: min-Größen aus CSS
        const dummyInput = document.createElement('input');
        dummyInput.classList.add('node-text-input'); dummyInput.value = text;
        dummyDiv.appendChild(dummyInput);
        document.body.appendChild(dummyDiv);
        return dummyDiv;
    }

    function showToast(message) {
        if (toastTimeout) clearTimeout(toastTimeout);
        toastNotification.textContent = message; toastNotification.classList.add('show');
        toastTimeout = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    }

    function toggleShortcutVisibility() { shortcutWindow.classList.toggle('hidden');}
    
    function handleResetDefaultColors() {
        // Setzt die Picker auf die im CSS definierten Default-Werte für das aktuelle Theme
        const currentThemeNodeBg = getComputedStyle(document.documentElement).getPropertyValue(CSS_VAR_NODE_DEFAULT_BG).trim();
        const currentThemeNodeText = getComputedStyle(document.documentElement).getPropertyValue(CSS_VAR_NODE_DEFAULT_TEXT).trim();
        defaultNodeColorPicker.value = currentThemeNodeBg;
        defaultTextColorPicker.value = currentThemeNodeText;
        // Die CSS Variablen selbst müssen nicht manuell gesetzt werden, da die Picker-Werte
        // direkt die Quelle für neue Nodes sind und die CSS Variablen die Defaults für die Picker definieren.
        // Wenn der User die Picker ändert, werden die CSS-Variablen über updateCSSVariablesFromPickers() aktualisiert.
        showToast("Default colors reset to current theme's defaults.");
    }


    toggleShortcutBtn.addEventListener('click', toggleShortcutVisibility);
    closeShortcutBtn.addEventListener('click', () => { shortcutWindow.classList.add('hidden'); });
    shortcutHeader.addEventListener('mousedown', (e) => {
        if (e.target === closeShortcutBtn || e.target === resizeHandle || e.target.closest('button')) return;
        isDraggingShortcutWindow = true;
        shortcutWindowDragX = e.clientX - shortcutWindow.offsetLeft; shortcutWindowDragY = e.clientY - shortcutWindow.offsetTop;
        shortcutWindow.style.cursor = 'grabbing';
        document.addEventListener('mousemove', dragShortcutWindow);
        document.addEventListener('mouseup', stopDragOrResizeShortcutWindow, {once: true});
    });
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); isResizingShortcutWindow = true;
        shortcutWindowResizeStartX = e.clientX; shortcutWindowResizeStartY = e.clientY;
        shortcutWindowInitialWidth = shortcutWindow.offsetWidth; shortcutWindowInitialHeight = shortcutWindow.offsetHeight;
        document.addEventListener('mousemove', resizeShortcutWindow);
        document.addEventListener('mouseup', stopDragOrResizeShortcutWindow, {once: true});
    });
    function dragShortcutWindow(e) {
        if (!isDraggingShortcutWindow) return;
        let nX = e.clientX - shortcutWindowDragX; let nY = e.clientY - shortcutWindowDragY;
        const bR = document.body.getBoundingClientRect();
        nX = Math.max(0, Math.min(nX, bR.width - shortcutWindow.offsetWidth));
        nY = Math.max(0, Math.min(nY, bR.height - shortcutWindow.offsetHeight));
        shortcutWindow.style.left = `${nX}px`; shortcutWindow.style.top = `${nY}px`;
    }
    function resizeShortcutWindow(e) {
        if (!isResizingShortcutWindow) return;
        const dX = e.clientX - shortcutWindowResizeStartX; const dY = e.clientY - shortcutWindowResizeStartY;
        shortcutWindow.style.width = `${Math.max(200, shortcutWindowInitialWidth + dX)}px`;
        shortcutWindow.style.height = `${Math.max(100, shortcutWindowInitialHeight + dY)}px`;
    }
    function stopDragOrResizeShortcutWindow() {
        isDraggingShortcutWindow = false; isResizingShortcutWindow = false;
        shortcutWindow.style.cursor = 'default';
        document.removeEventListener('mousemove', dragShortcutWindow);
        document.removeEventListener('mousemove', resizeShortcutWindow);
    }

    function downloadMapData() {
        if (nodes.length === 0) { showToast("The mind map is empty."); return; }
        const serializableNodes = nodes.map(n => ({ id: n.id, text: n.text, x: n.x, y: n.y, parentId: n.parentId, bgColor: n.bgColor, textColor: n.textColor, childrenIds: n.childrenIds }));
        const dataStr = JSON.stringify({ nodes: serializableNodes, nodeIdCounter }, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'mindmap.json';
        let linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri); linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click(); linkElement.remove();
        showToast("Map data downloaded as JSON!");
    }

    function captureMindmapCanvas(onSuccess, onError, onFinallyCallback) {
        if (nodes.length === 0) { showToast("The mind map is empty."); if (onError) onError("Mindmap empty"); return; }
        if (typeof html2canvas === 'undefined') { showToast('html2canvas library not loaded.'); if (onError) onError("html2canvas not loaded"); return; }
        const shortcutWindowWasVisible = !shortcutWindow.classList.contains('hidden');
        if (shortcutWindowWasVisible) shortcutWindow.classList.add('hidden');
        const previouslySelectedNodeId = selectedNodeId;
        if (previouslySelectedNodeId) { const el = document.getElementById(previouslySelectedNodeId); if (el) el.classList.remove('selected'); }
        document.querySelectorAll('.node-controls').forEach(el => el.style.display = 'none');
        const options = {
            width: mindmapContainer.scrollWidth, height: mindmapContainer.scrollHeight,
            windowWidth: mindmapContainer.scrollWidth, windowHeight: mindmapContainer.scrollHeight,
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue(CSS_VAR_MINDMAP_BG).trim(),
            logging: false, useCORS: true
        };
        html2canvas(mindmapContainer, options)
            .then(canvas => { if (onSuccess) onSuccess(canvas); })
            .catch(err => { console.error("Screenshot capture error:", err); showToast("An error occurred while capturing the mind map."); if (onError) onError(err); })
            .finally(() => {
                if (shortcutWindowWasVisible) shortcutWindow.classList.remove('hidden');
                selectNode(previouslySelectedNodeId);
                if (onFinallyCallback) onFinallyCallback();
            });
    }

    function screenshotToClipboard() {
        captureMindmapCanvas( (canvas) => {
                canvas.toBlob(async function(blob) {
                    if (navigator.clipboard && navigator.clipboard.write) {
                        try {
                            const clipboardItem = new ClipboardItem({ 'image/png': blob });
                            await navigator.clipboard.write([clipboardItem]);
                            showToast('Screenshot (PNG) copied to clipboard!');
                        } catch (err) { console.error('Failed to copy screenshot to clipboard:', err); showToast('Failed to copy to clipboard.'); }
                    } else { showToast('Clipboard API not supported. Try downloading.'); }
                }, 'image/png');
            }
        );
    }

    function downloadScreenshot() {
        const format = screenshotFormatSelect.value;
        if (format === 'pdf' && (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined')) { showToast('jsPDF library not loaded for PDF.'); return; }
        captureMindmapCanvas( (canvas) => { downloadCanvasImage(canvas, format); });
    }

    function downloadCanvasImage(canvas, format = 'png') {
        let imageDataURL; let fileExtension = format; let fileName = `mindmap.${fileExtension}`;
        if (format === 'jpeg') imageDataURL = canvas.toDataURL('image/jpeg', 0.9);
        else if (format === 'pdf') {
            try {
                const PDFCreator = window.jspdf.jsPDF || (typeof jsPDF !== 'undefined' ? jsPDF : null);
                if (!PDFCreator) { showToast("jsPDF not found. Downloading as PNG."); imageDataURL = canvas.toDataURL('image/png'); fileName = 'mindmap.png'; triggerDownload(imageDataURL, fileName); return; }
                const orientation = canvas.width > canvas.height ? 'l' : 'p';
                const pdf = new PDFCreator({ orientation: orientation, unit: 'px', format: [canvas.width, canvas.height] });
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save('mindmap.pdf'); showToast('PDF downloaded!'); return;
            } catch (e) { console.error("PDF error:", e); showToast("Error generating PDF. Downloading as PNG."); imageDataURL = canvas.toDataURL('image/png'); fileName = 'mindmap.png'; }
        } else imageDataURL = canvas.toDataURL('image/png');
        triggerDownload(imageDataURL, fileName);
    }

    function triggerDownload(imageURL, fileName){
        const link = document.createElement('a'); link.href = imageURL; link.download = fileName;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showToast(`${fileName.split('.').pop().toUpperCase()} downloaded!`);
    }

    function clearMap() {
        nodes.forEach(n => { if (n.element) n.element.remove(); });
        nodes = []; nodeIdCounter = 0; selectNode(null); drawLines(); showToast("Map cleared.");
    }

    mindmapContainer.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); toggleShortcutVisibility(); return; }
        if ((e.ctrlKey || e.metaKey)) {
            switch (e.key.toLowerCase()) {
                case 's': e.preventDefault(); downloadMapData(); return;
                case 'p': e.preventDefault(); if (e.shiftKey) downloadScreenshot(); else screenshotToClipboard(); return;
            }
        }
        if (!selectedNodeId && e.key.toLowerCase() !== 'r') return;
        switch (e.key.toLowerCase()) {
            case 'enter': case 'tab':
                if (selectedNodeId) { e.preventDefault(); if(e.shiftKey){ const s=nodes.find(n=>n.id===selectedNodeId); if(s) addNode(s.parentId); } else addNode(selectedNodeId); } break;
            case 'delete': case 'backspace': if (selectedNodeId) { e.preventDefault(); deleteNode(selectedNodeId); } break;
            case 'r': if(!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey){ e.preventDefault(); addNode(null); } break;
        }
    });

    if (addRootNodeBtn) addRootNodeBtn.addEventListener('click', () => addNode(null));
    if (clearMapBtn) clearMapBtn.addEventListener('click', clearMap);
    if (downloadMapBtn) downloadMapBtn.addEventListener('click', downloadMapData);
    if (screenshotToClipboardBtn) screenshotToClipboardBtn.addEventListener('click', screenshotToClipboard);
    if (downloadScreenshotBtn) downloadScreenshotBtn.addEventListener('click', downloadScreenshot);
    if (resetDefaultColorsBtn) resetDefaultColorsBtn.addEventListener('click', handleResetDefaultColors);

    drawLines();
    mindmapContainer.focus();
});
