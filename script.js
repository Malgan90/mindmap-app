document.addEventListener('DOMContentLoaded', () => {
    const mindmapContainer = document.getElementById('mindmap-container');
    const svg = document.getElementById('mindmap-svg');
    const addRootNodeBtn = document.getElementById('addRootNodeBtn');
    const clearMapBtn = document.getElementById('clearMapBtn');
    const downloadMapBtn = document.getElementById('downloadMapBtn');
    const screenshotBtn = document.getElementById('screenshotBtn');
    const toggleShortcutBtn = document.getElementById('toggleShortcutBtn');
    const defaultNodeColorPicker = document.getElementById('defaultNodeColor');
    const defaultTextColorPicker = document.getElementById('defaultTextColor');
    // Die Checkbox wurde umbenannt, aber die ID bleibt screenshotToClipboardCb
    const screenshotToClipboardCb = document.getElementById('screenshotToClipboardCb'); 
    const screenshotFormatSelect = document.getElementById('screenshotFormatSelect');
    const toastNotification = document.getElementById('toast-notification');
    const resetDefaultColorsBtn = document.getElementById('resetDefaultColorsBtn');
    let toastTimeout;

    const initialDefaultNodeColor = '#add8e6';
    const initialDefaultTextColor = '#000000';

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

    function createNodeElement(nodeData) {
        const nodeDiv = document.createElement('div');
        nodeDiv.classList.add('node'); 
        nodeDiv.id = nodeData.id;
        nodeDiv.style.left = `${nodeData.x}px`; 
        nodeDiv.style.top = `${nodeData.y}px`;
        nodeDiv.style.backgroundColor = nodeData.bgColor; 
        nodeDiv.style.borderColor = getDarkerColor(nodeData.bgColor);
        if (nodeData.id === selectedNodeId) nodeDiv.classList.add('selected');

        const textInput = document.createElement('input');
        textInput.type = 'text'; 
        textInput.classList.add('node-text-input'); 
        textInput.value = nodeData.text; 
        textInput.style.color = nodeData.textColor;
        textInput.addEventListener('change', (e) => { nodeData.text = e.target.value; });
        textInput.addEventListener('mousedown', (e) => e.stopPropagation()); 
        textInput.addEventListener('focus', (e) => e.target.select());
        textInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') textInput.blur(); });

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
            drawLines(); 
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
        resetColorsBtn.title = 'Reset colors to default';
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
        nodeData.bgColor = defaultNodeColorPicker.value; 
        nodeData.textColor = defaultTextColorPicker.value;
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
        drawLines();
    }

    function addNode(parentId = null, initialProps = {}) {
        nodeIdCounter++; 
        const newNodeId = `node-${nodeIdCounter}`;
        let x = initialProps.x || 50, y = initialProps.y || 50, text = initialProps.text || 'New Idea';
        const bgColor = initialProps.bgColor || defaultNodeColorPicker.value, textColor = initialProps.textColor || defaultTextColorPicker.value;
        const tempElement = createDummyNodeElement(text); 
        const nodeWidth = tempElement.offsetWidth;
        const nodeHeight = tempElement.offsetHeight; 
        tempElement.remove();

        if (parentId) { 
            const parent = nodes.find(n => n.id === parentId); 
            if (parent && parent.element) { 
                x = parent.x + parent.element.offsetWidth + 50 + Math.random() * 20; 
                y = parent.y + (parent.element.offsetHeight / 2) - (nodeHeight / 2) + Math.random() * 40; 
            }
        } else { 
            const rootNodes = nodes.filter(n => !n.parentId); 
            x = 50 + rootNodes.length * (nodeWidth / 2 + 30); 
            y = 50 + rootNodes.length * 30; 
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
            selectedNodeId = null; 
            if (nodeToDelete.parentId) selectNode(nodeToDelete.parentId); 
            else if (nodes.length > 0) selectNode(nodes[0].id); 
        }
        drawLines();
    }

    function handleNodeClick(e) { e.stopPropagation(); const nodeId = e.currentTarget.id; selectNode(nodeId); }
    function selectNode(nodeId) {
        if (selectedNodeId === nodeId && nodeId !== null) return;
        
        if (selectedNodeId) { 
            const oldSelectedNode = nodes.find(n => n.id === selectedNodeId); 
            if (oldSelectedNode && oldSelectedNode.element) oldSelectedNode.element.classList.remove('selected'); 
        }
        selectedNodeId = nodeId;
        
        if (nodeId) { 
            const newSelectedNode = nodes.find(n => n.id === nodeId); 
            if (newSelectedNode && newSelectedNode.element) newSelectedNode.element.classList.add('selected'); 
        }
    }
    mindmapContainer.addEventListener('click', (e) => { if (e.target === mindmapContainer) { selectNode(null); } });

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
                    
                    line.setAttribute('x1', x1); 
                    line.setAttribute('y1', y1); 
                    line.setAttribute('x2', x2); 
                    line.setAttribute('y2', y2);
                    line.setAttribute('stroke', 'gray'); 
                    line.setAttribute('stroke-width', '2');
                    line.dataset.parentId = parentNode.id; 
                    line.dataset.childId = node.id;
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
        dragOffsetX = e.clientX - (rect.left - containerRect.left); 
        dragOffsetY = e.clientY - (rect.top - containerRect.top);
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
    }

    function handleDocumentMouseMove(e) {
        if (!activeDragNodeData || !activeDragNodeData.element) { cleanupGlobalDragListeners(); return; }
        e.preventDefault();
        const containerRect = mindmapContainer.getBoundingClientRect();
        let newX = e.clientX - containerRect.left - dragOffsetX + mindmapContainer.scrollLeft;
        let newY = e.clientY - containerRect.top - dragOffsetY + mindmapContainer.scrollTop;
        newX = Math.max(0, Math.min(newX, mindmapContainer.scrollWidth - activeDragNodeData.element.offsetWidth));
        newY = Math.max(0, Math.min(newY, mindmapContainer.scrollHeight - activeDragNodeData.element.offsetHeight));
        activeDragNodeData.x = newX; 
        activeDragNodeData.y = newY;
        activeDragNodeData.element.style.left = `${newX}px`; 
        activeDragNodeData.element.style.top = `${newY}px`;
        drawLines();
        clearAllHighlights();
        currentDragTargetInfo = { type: null, id: null, lineElement: null, lineParentId: null, lineChildId: null };
        const dropPointX = newX + activeDragNodeData.element.offsetWidth / 2;
        const dropPointY = newY + activeDragNodeData.element.offsetHeight / 2;
        const elementsUnderDropPoint = document.elementsFromPoint( (activeDragNodeData.element.getBoundingClientRect().left + activeDragNodeData.element.offsetWidth / 2), (activeDragNodeData.element.getBoundingClientRect().top + activeDragNodeData.element.offsetHeight / 2) );
        let foundNodeTarget = false;
        for (const el of elementsUnderDropPoint) {
            if (el.classList && el.classList.contains('node') && el.id !== activeDragNodeData.id) {
                const targetNodeData = nodes.find(n => n.id === el.id);
                if (targetNodeData && !isDescendant(activeDragNodeData, targetNodeData.id) && targetNodeData.id !== activeDragNodeData.parentId) {
                    el.classList.add('drop-target-highlight');
                    currentDragTargetInfo = { type: 'node', id: el.id, lineElement: null, lineParentId: null, lineChildId: null };
                    foundNodeTarget = true; 
                    break;
                }
            }
        }
        if (!foundNodeTarget) {
            const allLines = Array.from(svg.querySelectorAll('line'));
            for (const line of allLines) {
                const linePId = line.dataset.parentId; 
                const lineCId = line.dataset.childId;
                if (linePId === activeDragNodeData.id || lineCId === activeDragNodeData.id || (activeDragNodeData.parentId === linePId && activeDragNodeData.childrenIds.includes(lineCId))) continue;
                const x1 = parseFloat(line.getAttribute('x1'));
                const y1 = parseFloat(line.getAttribute('y1'));
                const x2 = parseFloat(line.getAttribute('x2'));
                const y2 = parseFloat(line.getAttribute('y2'));
                if (isPointNearLine(dropPointX, dropPointY, x1, y1, x2, y2, 25)) {
                    line.classList.add('line-drop-target-highlight');
                    currentDragTargetInfo = { type: 'line', id: null, lineElement: line, lineParentId: linePId, lineChildId: lineCId }; 
                    break;
                }
            }
        }
    }

    function handleDocumentMouseUp(e) {
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
                if (originalParentOfLine && originalChildOfLine && activeDragNodeData.id !== originalParentOfLine.id && activeDragNodeData.id !== originalChildOfLine.id && !isDescendant(activeDragNodeData, originalParentOfLine.id) && !isDescendant(activeDragNodeData, originalChildOfLine.id) ) {
                    if (activeDragNodeData.parentId) { 
                        const oldParent = nodes.find(n => n.id === activeDragNodeData.parentId); 
                        if (oldParent) oldParent.childrenIds = oldParent.childrenIds.filter(id => id !== activeDragNodeData.id); 
                    }
                    activeDragNodeData.parentId = originalParentOfLine.id;
                    if (!originalParentOfLine.childrenIds.includes(activeDragNodeData.id)) originalParentOfLine.childrenIds.push(activeDragNodeData.id);
                    originalParentOfLine.childrenIds = originalParentOfLine.childrenIds.filter(id => id !== originalChildOfLine.id);
                    originalChildOfLine.parentId = activeDragNodeData.id;
                    if (!activeDragNodeData.childrenIds.includes(originalChildOfLine.id)) activeDragNodeData.childrenIds.push(originalChildOfLine.id);
                    else { activeDragNodeData.childrenIds = activeDragNodeData.childrenIds.filter(id => id !== originalChildOfLine.id); activeDragNodeData.childrenIds.push(originalChildOfLine.id); }
                }
            }
            drawLines();
        }
        cleanupGlobalDragListeners();
    }

    function cleanupGlobalDragListeners() { 
        if (activeDragNodeData && activeDragNodeData.element && activeDragNodeData.element.classList.contains('dragging')) { 
            activeDragNodeData.element.classList.remove('dragging'); 
        } 
        activeDragNodeData = null; 
        currentDragTargetInfo = { type: null, id: null, lineElement: null, lineParentId: null, lineChildId: null }; 
        document.removeEventListener('mousemove', handleDocumentMouseMove); 
    }

    function clearAllHighlights() { 
        document.querySelectorAll('.node.drop-target-highlight').forEach(n => n.classList.remove('drop-target-highlight')); 
        document.querySelectorAll('line.line-drop-target-highlight').forEach(l => l.classList.remove('line-drop-target-highlight'));
    }

    function isDescendant(pParent, cId) { 
        if (!pParent || !pParent.childrenIds) return false; 
        if (pParent.childrenIds.includes(cId)) return true; 
        for (const id of pParent.childrenIds) { 
            const child = nodes.find(n => n.id === id); 
            if (child && isDescendant(child, cId)) return true; 
        } 
        return false; 
    }

    function getDarkerColor(hex) { 
        if (!hex || hex.length < 7) return '#000000'; 
        let r = parseInt(hex.slice(1,3),16);
        let g = parseInt(hex.slice(3,5),16);
        let b = parseInt(hex.slice(5,7),16); 
        r = Math.max(0, r - 40); 
        g = Math.max(0, g - 40); 
        b = Math.max(0, b - 40); 
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`; 
    }

    function createDummyNodeElement(txt) { 
        const d = document.createElement('div'); 
        d.classList.add('node'); 
        d.style.cssText = 'position:absolute;visibility:hidden;left:-10000px;'; 
        const i = document.createElement('input'); 
        i.classList.add('node-text-input'); 
        i.value = txt; 
        d.appendChild(i); 
        document.body.appendChild(d); 
        return d; 
    }

    function showToast(message) { 
        if (toastTimeout) clearTimeout(toastTimeout); 
        toastNotification.textContent = message; 
        toastNotification.classList.add('show'); 
        toastTimeout = setTimeout(() => { 
            toastNotification.classList.remove('show'); 
        }, 3000); 
    }

    function toggleShortcutVisibility() { shortcutWindow.classList.toggle('hidden');}
    function handleResetDefaultColors() { 
        defaultNodeColorPicker.value = initialDefaultNodeColor; 
        defaultTextColorPicker.value = initialDefaultTextColor; 
        showToast("Default colors have been reset."); 
    }

    toggleShortcutBtn.addEventListener('click', toggleShortcutVisibility);
    closeShortcutBtn.addEventListener('click', () => { shortcutWindow.classList.add('hidden'); });
    shortcutHeader.addEventListener('mousedown', (e) => { 
        if (e.target === closeShortcutBtn || e.target === resizeHandle || e.target.closest('button')) return; 
        isDraggingShortcutWindow = true; 
        shortcutWindowDragX = e.clientX - shortcutWindow.offsetLeft; 
        shortcutWindowDragY = e.clientY - shortcutWindow.offsetTop; 
        shortcutWindow.style.cursor = 'grabbing'; 
        document.addEventListener('mousemove', dragShortcutWindow); 
        document.addEventListener('mouseup', stopDragOrResizeShortcutWindow, {once: true}); 
    });

    resizeHandle.addEventListener('mousedown', (e) => { 
        e.stopPropagation(); 
        isResizingShortcutWindow = true; 
        shortcutWindowResizeStartX = e.clientX; 
        shortcutWindowResizeStartY = e.clientY; 
        shortcutWindowInitialWidth = shortcutWindow.offsetWidth; 
        shortcutWindowInitialHeight = shortcutWindow.offsetHeight; 
        document.addEventListener('mousemove', resizeShortcutWindow); 
        document.addEventListener('mouseup', stopDragOrResizeShortcutWindow, {once: true}); 
    });

    function dragShortcutWindow(e) { 
        if (!isDraggingShortcutWindow) return; 
        let nX = e.clientX - shortcutWindowDragX;
        let nY = e.clientY - shortcutWindowDragY; 
        const bR = document.body.getBoundingClientRect(); 
        nX = Math.max(0, Math.min(nX, bR.width - shortcutWindow.offsetWidth)); 
        nY = Math.max(0, Math.min(nY, bR.height - shortcutWindow.offsetHeight)); 
        shortcutWindow.style.left = `${nX}px`; 
        shortcutWindow.style.top = `${nY}px`; 
    }

    function resizeShortcutWindow(e) { 
        if (!isResizingShortcutWindow) return; 
        const dX = e.clientX - shortcutWindowResizeStartX;
        const dY = e.clientY - shortcutWindowResizeStartY; 
        shortcutWindow.style.width = `${Math.max(200, shortcutWindowInitialWidth + dX)}px`; 
        shortcutWindow.style.height = `${Math.max(100, shortcutWindowInitialHeight + dY)}px`; 
    }

    function stopDragOrResizeShortcutWindow() { 
        isDraggingShortcutWindow = false; 
        isResizingShortcutWindow = false; 
        shortcutWindow.style.cursor = 'default'; 
        shortcutHeader.style.cursor = 'move'; 
        document.removeEventListener('mousemove', dragShortcutWindow); 
        document.removeEventListener('mousemove', resizeShortcutWindow); 
    }

    function downloadMapData() { 
        if (nodes.length === 0) { showToast("The mind map is empty."); return; } 
        const nS = nodes.map(n => ({ id:n.id, text:n.text, x:n.x, y:n.y, parentId:n.parentId, bgColor:n.bgColor, textColor:n.textColor, childrenIds:n.childrenIds })); 
        const dS = JSON.stringify({ nodes:nS, nodeIdCounter }, null, 2); 
        const dU = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dS); 
        const eN = 'mindmap.json'; 
        let lE = document.createElement('a'); 
        lE.setAttribute('href',dU); 
        lE.setAttribute('download',eN); 
        lE.click(); 
    }

    // Überarbeitete takeScreenshot Funktion
    function takeScreenshot() {
        if (nodes.length === 0) {
            showToast("The mind map is empty.");
            return;
        }
        if (typeof html2canvas === 'undefined') {
            showToast('html2canvas not loaded.');
            return;
        }

        const format = screenshotFormatSelect.value;
        // Die Checkbox steuert, ob die Datei HERUNTERGELADEN werden soll
        const shouldDownloadFile = screenshotToClipboardCb.checked; 

        // Prüfung, ob die jspdf-Bibliothek für PDF-Export geladen ist (nur relevant, wenn PDF heruntergeladen werden soll)
        if (format === 'pdf' && shouldDownloadFile && (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined')) {
            showToast('jsPDF library not loaded for PDF export. Select another format or ensure library is loaded.');
            return;
        }

        // Temporäre Zustandsänderungen für den Screenshot
        const shortcutWindowWasVisible = !shortcutWindow.classList.contains('hidden');
        if (shortcutWindowWasVisible) shortcutWindow.classList.add('hidden');

        const currentlySelectedElement = selectedNodeId ? document.getElementById(selectedNodeId) : null;
        if (currentlySelectedElement) currentlySelectedElement.classList.remove('selected');

        document.querySelectorAll('.node-controls').forEach(el => el.style.display = 'none');

        const options = {
            width: mindmapContainer.scrollWidth,
            height: mindmapContainer.scrollHeight,
            windowWidth: mindmapContainer.scrollWidth,
            windowHeight: mindmapContainer.scrollHeight,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        };

        html2canvas(mindmapContainer, options).then(canvas => {
            // Erste Bedingung: Soll die Datei heruntergeladen werden (Checkbox ist an)?
            if (shouldDownloadFile) {
                // Wenn "Download file" Haken drin ist, immer herunterladen
                downloadCanvasImage(canvas, format);
            } else {
                // Wenn "Download file" Haken NICHT drin ist, versuche, in die Zwischenablage zu kopieren
                // Dies ist NUR für PNG möglich
                if (format === 'png') {
                    canvas.toBlob(async function(blob) {
                        if (navigator.clipboard && navigator.clipboard.write) {
                            try {
                                const clipboardItem = { [blob.type]: blob };
                                await navigator.clipboard.write([new ClipboardItem(clipboardItem)]);
                                showToast('Screenshot (PNG) copied to clipboard!');
                            } catch (err) {
                                console.error('Failed to copy screenshot to clipboard:', err);
                                showToast('Failed to copy to clipboard. Please select "Download file" to save as PNG.');
                                // Hier kein Fallback zum Download, da dies explizit nicht gewünscht ist, wenn der Haken fehlt.
                                // Der Nutzer muss den Haken setzen, um herunterzuladen.
                            }
                        } else {
                            showToast('Clipboard API not supported. Please select "Download file" to save as PNG.');
                        }
                    }, 'image/png');
                } else {
                    // Wenn kein Download gewünscht, aber Format nicht PNG ist (z.B. PDF/JPEG ohne Download-Haken)
                    showToast(`Copy to clipboard is only supported for PNG. Please select "Download file" to save as ${format.toUpperCase()}.`);
                }
            }
        }).catch(err => {
            console.error("Screenshot error:", err);
            showToast("An error occurred while taking the screenshot.");
        })
        .finally(() => {
            // Rückgängigmachen der temporären Zustandsänderungen
            if (shortcutWindowWasVisible) shortcutWindow.classList.remove('hidden');
            if (currentlySelectedElement) currentlySelectedElement.classList.add('selected');
            document.querySelectorAll('.node-controls').forEach(el => el.style.display = '');
        });
    }

    // downloadCanvasImage bleibt wie in der vorherigen Antwort beschrieben
    function downloadCanvasImage(canvas, format = 'png') {
        let imageDataURL;
        let fileExtension = format;

        if (format === 'jpeg') {
            imageDataURL = canvas.toDataURL('image/jpeg', 0.9);
        } else if (format === 'pdf') {
            try {
                const PDFCreator = window.jspdf.jsPDF || (typeof jsPDF !== 'undefined' ? jsPDF : null);
                if (!PDFCreator) {
                    showToast("jsPDF library not found. Downloading as PNG.");
                    imageDataURL = canvas.toDataURL('image/png');
                    fileExtension = 'png';
                    triggerDownload(imageDataURL, `mindmap.${fileExtension}`);
                    return;
                }
                const pdf = new PDFCreator({
                    orientation: canvas.width > canvas.height ? 'l' : 'p',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save('mindmap.pdf');
                showToast('PDF downloaded successfully!');
                return;
            } catch (e) {
                console.error("PDF generation error:", e);
                showToast("Error generating PDF. Downloading as PNG.");
                imageDataURL = canvas.toDataURL('image/png');
                fileExtension = 'png';
                triggerDownload(imageDataURL, `mindmap.${fileExtension}`);
                return;
            }
        } else {
            imageDataURL = canvas.toDataURL('image/png');
            fileExtension = 'png';
        }
        triggerDownload(imageDataURL, `mindmap.${fileExtension}`);
    }

    // triggerDownload bleibt wie in der vorherigen Antwort beschrieben
    function triggerDownload(imageURL, fileName){
        const link = document.createElement('a');
        link.href = imageURL;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`${fileName.split('.').pop().toUpperCase()} downloaded!`);
    }

    function clearMap() { 
        nodes.forEach(n => { if (n.element) n.element.remove(); }); 
        nodes = []; 
        nodeIdCounter = 0; 
        selectedNodeId = null; 
        drawLines(); 
    }

    mindmapContainer.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return; 
        if (e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); toggleShortcutVisibility(); return; }
        if (!selectedNodeId && !(e.ctrlKey || e.metaKey) && e.key.toLowerCase() !== 'r') return;
        
        switch (e.key.toLowerCase()) {
            case 'enter': 
            case 'tab': 
                if(selectedNodeId){
                    e.preventDefault(); 
                    if(e.shiftKey){
                        const s=nodes.find(n=>n.id===selectedNodeId); 
                        if(s)addNode(s.parentId);
                    }else{
                        addNode(selectedNodeId);
                    }
                } 
                break;
            case 'delete': 
            case 'backspace': 
                if(selectedNodeId){
                    e.preventDefault();
                    deleteNode(selectedNodeId);
                } 
                break;
            case 's': 
                if(e.ctrlKey||e.metaKey){
                    e.preventDefault();
                    downloadMapData();
                } 
                break;
            case 'p': 
                if(e.ctrlKey||e.metaKey){
                    e.preventDefault();
                    takeScreenshot();
                } 
                break;
            case 'r': 
                if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){
                    e.preventDefault();
                    addNode(null);
                } 
                break;
        }
    });

    addRootNodeBtn.addEventListener('click', () => addNode(null));
    clearMapBtn.addEventListener('click', clearMap);
    downloadMapBtn.addEventListener('click', downloadMapData);
    screenshotBtn.addEventListener('click', takeScreenshot);
    resetDefaultColorsBtn.addEventListener('click', handleResetDefaultColors);

    drawLines();
    mindmapContainer.focus();
});
