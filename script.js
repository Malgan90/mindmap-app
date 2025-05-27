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

    const mindmapWrapper = document.getElementById('mindmap-wrapper');

    let toastTimeout;

    const CSS_VAR_NODE_DEFAULT_BG = '--node-default-bg';
    const CSS_VAR_NODE_DEFAULT_TEXT = '--node-default-text';
    const CSS_VAR_MINDMAP_BG = '--mindmap-bg';

    // IMPORTANT: These values should match the defaults in style.css :root and body.dark-mode
    const LIGHT_MODE_DEFAULTS = {
        nodeBg: '#add8e6', // Matches --node-default-bg in :root
        nodeText: '#000000' // Matches --node-default-text in :root
    };
    const DARK_MODE_DEFAULTS = {
        nodeBg: '#586776', // Matches --node-default-bg in body.dark-mode
        nodeText: '#f1f1f1' // Matches --node-default-text in body.dark-mode
    };

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

    function updateCSSVariablesFromPickers() {
        document.documentElement.style.setProperty(CSS_VAR_NODE_DEFAULT_BG, defaultNodeColorPicker.value);
        document.documentElement.style.setProperty(CSS_VAR_NODE_DEFAULT_TEXT, defaultTextColorPicker.value);
    }

    function applyDarkModePreference() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        document.body.classList.toggle('dark-mode', isDarkMode);
        if (toggleDarkModeBtn) {
            toggleDarkModeBtn.textContent = isDarkMode ? '☀️' : '🌙';
            toggleDarkModeBtn.title = isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }

        const currentThemeDefaults = isDarkMode ? DARK_MODE_DEFAULTS : LIGHT_MODE_DEFAULTS;
        defaultNodeColorPicker.value = currentThemeDefaults.nodeBg;
        defaultTextColorPicker.value = currentThemeDefaults.nodeText;
        
        // Ensure the CSS variables for defaults are also set to the theme's actual defaults
        updateCSSVariablesFromPickers();
    }

    if (toggleDarkModeBtn) {
        toggleDarkModeBtn.addEventListener('click', () => {
            const isCurrentlyDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', !isCurrentlyDark);
            applyDarkModePreference();
        });
    }

    defaultNodeColorPicker.addEventListener('input', updateCSSVariablesFromPickers);
    defaultTextColorPicker.addEventListener('input', updateCSSVariablesFromPickers);
    
    applyDarkModePreference(); // Call initially to set up theme and default colors

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
        textInput.addEventListener('mousedown', (e) => e.stopPropagation());
        textInput.addEventListener('focus', (e) => e.target.select());
        textInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === 'Escape') textInput.blur();
        });
        textInput.addEventListener('change', (e) => {
            nodeData.text = e.target.value;
        });

        const controlsDiv = document.createElement('div');
        controlsDiv.classList.add('node-controls');
        controlsDiv.addEventListener('mousedown', e => e.stopPropagation());

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
        textColorDiv.appendChild(textColorLabel);
        textColorDiv.appendChild(nodeTextColorInput);
        nodeColorPickersDiv.appendChild(textColorDiv);
        controlsDiv.appendChild(nodeColorPickersDiv);

        const resetColorsBtn = document.createElement('button');
        resetColorsBtn.textContent = 'Reset Colors';
        resetColorsBtn.classList.add('reset-colors-btn');
        resetColorsBtn.title = 'Reset colors to theme default'; // MODIFIED TITLE
        resetColorsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetNodeColors(nodeData, nodeDiv, textInput);
        });
        controlsDiv.appendChild(resetColorsBtn);

        const toggleColorControlsBtn = document.createElement('button');
        toggleColorControlsBtn.classList.add('node-toggle-colors-btn');
        toggleColorControlsBtn.innerHTML = '+'; // GEÄNDERT
        toggleColorControlsBtn.title = 'Toggle color settings';
        toggleColorControlsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parentNodeElement = e.currentTarget.closest('.node');
            if (!parentNodeElement) return;
            const isCurrentlyActive = parentNodeElement.classList.contains('color-controls-active');
            document.querySelectorAll('.node.color-controls-active').forEach(n => {
                if (n !== parentNodeElement) {
                    n.classList.remove('color-controls-active');
                }
            });
            parentNodeElement.classList.toggle('color-controls-active', !isCurrentlyActive);
        });
        toggleColorControlsBtn.addEventListener('mousedown', e => e.stopPropagation());

        nodeDiv.appendChild(textInput);
        nodeDiv.appendChild(controlsDiv);
        nodeDiv.appendChild(toggleColorControlsBtn);

        nodeDiv.addEventListener('mousedown', handleNodeMouseDown);
        nodeDiv.addEventListener('click', handleNodeClick);
        nodeData.element = nodeDiv;
        return nodeDiv;
    }

    function resetNodeColors(nodeData, nodeDivElement, textInputElement) {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const themeDefaults = isDarkMode ? DARK_MODE_DEFAULTS : LIGHT_MODE_DEFAULTS;

        nodeData.bgColor = themeDefaults.nodeBg;
        nodeData.textColor = themeDefaults.nodeText;

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
        let x = initialProps.x !== undefined ? initialProps.x : 50;
        let y = initialProps.y !== undefined ? initialProps.y : 50;
        let text = initialProps.text || 'New Idea';

        // New nodes use the current default picker values from the toolbar
        const bgColor = initialProps.bgColor || defaultNodeColorPicker.value;
        const textColor = initialProps.textColor || defaultTextColorPicker.value;

        const tempElement = createDummyNodeElement(text);
        let nodeWidth = Math.max(100, tempElement.offsetWidth);
        let nodeHeight = Math.max(100, tempElement.offsetHeight);
        tempElement.remove();

        if (parentId) {
            const parent = nodes.find(n => n.id === parentId);
            if (parent && parent.element) {
                x = parent.x + parent.element.offsetWidth + 30;
                y = parent.y + (parent.element.offsetHeight / 2) - (nodeHeight / 2);
            }
        } else {
            const rootNodes = nodes.filter(n => !n.parentId);
            x = 50 + rootNodes.length * 20;
            y = 50 + rootNodes.length * 20;
        }

        x = Math.max(0, Math.min(x, mindmapContainer.scrollWidth - nodeWidth - 10));
        y = Math.max(0, Math.min(y, mindmapContainer.scrollHeight - nodeHeight - 10));

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
        if (nodeToDelete.element) {
            nodeToDelete.element.classList.remove('color-controls-active');
            nodeToDelete.element.remove();
        }
        nodes = nodes.filter(n => n.id !== nodeId);
        if (selectedNodeId === nodeId) {
            const newSelectedId = nodeToDelete.parentId ? nodeToDelete.parentId : (nodes.length > 0 ? nodes[0].id : null);
            selectNode(newSelectedId);
        }
        drawLines();
    }

    function handleNodeClick(e) {
        if (e.target.classList.contains('node-toggle-colors-btn')) {
            e.stopPropagation();
            return;
        }
        e.stopPropagation();
        const nodeId = e.currentTarget.id;
        selectNode(nodeId);
    }

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

    mindmapContainer.addEventListener('click', (e) => {
        if (e.target === mindmapContainer) {
            selectNode(null);
            document.querySelectorAll('.node.color-controls-active').forEach(n => {
                n.classList.remove('color-controls-active');
            });
        }
    });
    mindmapWrapper.addEventListener('click', (e) => {
        if (e.target === mindmapWrapper) {
            selectNode(null);
            document.querySelectorAll('.node.color-controls-active').forEach(n => {
                n.classList.remove('color-controls-active');
            });
        }
    });

    function drawLines() {
        svg.innerHTML = '';
        nodes.forEach(node => {
            if (node.parentId) {
                const parentNode = nodes.find(p => p.id === node.parentId);
                if (parentNode && parentNode.element && node.element) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

                    const pX = parentNode.x + (parentNode.element.offsetWidth / 2);
                    const pY = parentNode.y + (parentNode.element.offsetHeight / 2);
                    const cX = node.x + (node.element.offsetWidth / 2);
                    const cY = node.y + (node.element.offsetHeight / 2);

                    line.setAttribute('x1', pX);
                    line.setAttribute('y1', pY);
                    line.setAttribute('x2', cX);
                    line.setAttribute('y2', cY);
                    line.dataset.parentId = parentNode.id;
                    line.dataset.childId = node.id;
                    svg.appendChild(line);
                }
            }
        });
    }
    window.addEventListener('resize', drawLines);
    mindmapWrapper.addEventListener('scroll', drawLines);

    function handleNodeMouseDown(e) {
        if (e.target.tagName === 'INPUT' ||
            e.target.closest('button') ||
            e.target.closest('.node-controls') ||
            e.target.closest('.node-color-pickers input[type="color"]')) {
            return;
        }
        activeDragNodeData = nodes.find(n => n.id === e.currentTarget.id);
        if (!activeDragNodeData || !activeDragNodeData.element) { activeDragNodeData = null; return; }
        e.stopPropagation();
        selectNode(activeDragNodeData.id);
        if (activeDragNodeData.element.classList.contains('color-controls-active')) {
            activeDragNodeData.element.classList.remove('color-controls-active');
        }
        activeDragNodeData.element.classList.add('dragging');

        const mouseViewportX = e.clientX;
        const mouseViewportY = e.clientY;
        const nodeViewportRect = activeDragNodeData.element.getBoundingClientRect();
        dragOffsetX = mouseViewportX - nodeViewportRect.left;
        dragOffsetY = mouseViewportY - nodeViewportRect.top;

        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
    }

    function handleDocumentMouseMove(e) {
        if (!activeDragNodeData || !activeDragNodeData.element) { cleanupGlobalDragListeners(); return; }
        e.preventDefault();

        const containerViewportRect = mindmapContainer.getBoundingClientRect();
        const newNodeViewportX = e.clientX - dragOffsetX;
        const newNodeViewportY = e.clientY - dragOffsetY;

        let newX = newNodeViewportX - containerViewportRect.left + mindmapWrapper.scrollLeft;
        let newY = newNodeViewportY - containerViewportRect.top + mindmapWrapper.scrollTop;

        const nodeWidth = activeDragNodeData.element.offsetWidth;
        const nodeHeight = activeDragNodeData.element.offsetHeight;

        const maxScrollX = mindmapContainer.scrollWidth - nodeWidth;
        const maxScrollY = mindmapContainer.scrollHeight - nodeHeight;
        newX = Math.max(0, Math.min(newX, maxScrollX < 0 ? 0 : maxScrollX));
        newY = Math.max(0, Math.min(newY, maxScrollY < 0 ? 0 : maxScrollY));

        activeDragNodeData.x = newX;
        activeDragNodeData.y = newY;
        activeDragNodeData.element.style.left = `${newX}px`;
        activeDragNodeData.element.style.top = `${newY}px`;
        drawLines();

        clearAllHighlights();
        currentDragTargetInfo = { type: null, id: null, lineElement: null, lineParentId: null, lineChildId: null };
        const draggedNodeRect = activeDragNodeData.element.getBoundingClientRect();
        const dropPointElemX = draggedNodeRect.left + (draggedNodeRect.width / 2);
        const dropPointElemY = draggedNodeRect.top + (draggedNodeRect.height / 2);
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
            const svgRect = svg.getBoundingClientRect();
            const dropPointSvgX = dropPointElemX - svgRect.left;
            const dropPointSvgY = dropPointElemY - svgRect.top;

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
                    if (!originalParentOfLine.childrenIds.includes(activeDragNodeData.id)) originalParentOfLine.childrenIds.push(activeDragNodeData.id);
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
        try {
            let r = parseInt(hex.slice(1, 3), 16); let g = parseInt(hex.slice(3, 5), 16); let b = parseInt(hex.slice(5, 7), 16);
            r = Math.max(0, r - 40); g = Math.max(0, g - 40); b = Math.max(0, b - 40);
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        } catch (e) { return '#000000'; }
    }

    function createDummyNodeElement(text) {
        const dummyDiv = document.createElement('div');
        dummyDiv.classList.add('node');
        dummyDiv.style.cssText = `position:absolute; visibility:hidden; left:-10000px; top:-10000px; min-width:100px; padding: 10px; box-sizing:border-box; min-height: 100px;`;
        const dummyInput = document.createElement('input');
        dummyInput.classList.add('node-text-input');
        dummyInput.style.width = '90%';
        dummyInput.style.fontSize = '1em';
        dummyInput.value = text;
        dummyDiv.appendChild(dummyInput);
        document.body.appendChild(dummyDiv);
        return dummyDiv;
    }

    function showToast(message) {
        if (toastTimeout) clearTimeout(toastTimeout);
        toastNotification.textContent = message; toastNotification.classList.add('show');
        toastTimeout = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    }

    function toggleShortcutVisibility() { shortcutWindow.classList.toggle('hidden'); }

    function handleResetDefaultColors() {
        // This function now correctly resets the toolbar pickers to the theme's true defaults.
        const isDarkMode = document.body.classList.contains('dark-mode');
        const currentThemeDefaults = isDarkMode ? DARK_MODE_DEFAULTS : LIGHT_MODE_DEFAULTS;

        defaultNodeColorPicker.value = currentThemeDefaults.nodeBg;
        defaultTextColorPicker.value = currentThemeDefaults.nodeText;
        updateCSSVariablesFromPickers(); // This sets the inline styles on :root to the theme's defaults
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
        document.addEventListener('mouseup', stopDragOrResizeShortcutWindow, { once: true });
    });
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); isResizingShortcutWindow = true;
        shortcutWindowResizeStartX = e.clientX; shortcutWindowResizeStartY = e.clientY;
        shortcutWindowInitialWidth = shortcutWindow.offsetWidth; shortcutWindowInitialHeight = shortcutWindow.offsetHeight;
        document.addEventListener('mousemove', resizeShortcutWindow);
        document.addEventListener('mouseup', stopDragOrResizeShortcutWindow, { once: true });
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
        const serializableState = {
            nodes: nodes.map(n => ({ id: n.id, text: n.text, x: n.x, y: n.y, parentId: n.parentId, bgColor: n.bgColor, textColor: n.textColor, childrenIds: n.childrenIds })),
            nodeIdCounter: nodeIdCounter,
        };
        const dataStr = JSON.stringify(serializableState, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
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
        if (previouslySelectedNodeId) {
            const el = document.getElementById(previouslySelectedNodeId);
            if (el) el.classList.remove('selected');
        }

        const activeColorControls = [];
        document.querySelectorAll('.node.color-controls-active').forEach(n => {
            activeColorControls.push(n.id);
            n.classList.remove('color-controls-active');
        });
        document.querySelectorAll('.node-toggle-colors-btn').forEach(btn => btn.style.display = 'none');

        const options = {
            width: mindmapWrapper.scrollWidth,
            height: mindmapWrapper.scrollHeight,
            windowWidth: mindmapWrapper.scrollWidth,
            windowHeight: mindmapWrapper.scrollHeight,
            scrollX: -mindmapWrapper.scrollLeft,
            scrollY: -mindmapWrapper.scrollTop,
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue(CSS_VAR_MINDMAP_BG).trim(),
            logging: false, useCORS: true,
            ignoreElements: (element) => {
                return element.classList.contains('node-controls') || element.classList.contains('node-toggle-colors-btn');
            }
        };
        html2canvas(mindmapWrapper, options)
            .then(canvas => { if (onSuccess) onSuccess(canvas); })
            .catch(err => { console.error("Screenshot capture error:", err); showToast("An error occurred while capturing the mind map."); if (onError) onError(err); })
            .finally(() => {
                if (shortcutWindowWasVisible) shortcutWindow.classList.remove('hidden');
                selectNode(previouslySelectedNodeId);

                activeColorControls.forEach(nodeId => {
                    const nodeEl = document.getElementById(nodeId);
                    if (nodeEl) nodeEl.classList.add('color-controls-active');
                });
                document.querySelectorAll('.node-toggle-colors-btn').forEach(btn => {
                    const nodeEl = btn.closest('.node');
                    if (nodeEl && (nodeEl.classList.contains('selected') || nodeEl.classList.contains('color-controls-active'))) {
                        btn.style.display = '';
                    } else {
                        btn.style.display = 'none';
                    }
                });
                if (onFinallyCallback) onFinallyCallback();
            });
    }

    function screenshotToClipboard() {
        captureMindmapCanvas((canvas) => {
            canvas.toBlob(async function (blob) {
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
        captureMindmapCanvas((canvas) => { downloadCanvasImage(canvas, format); });
    }

    function downloadCanvasImage(canvas, format = 'png') {
        let imageDataURL; let fileExtension = format; let fileName = `mindmap.${fileExtension}`;
        if (format === 'jpeg') imageDataURL = canvas.toDataURL('image/jpeg', 0.9);
        else if (format === 'pdf') {
            try {
                const PDFCreator = window.jspdf.jsPDF || (typeof jsPDF !== 'undefined' ? jsPDF : null);
                if (!PDFCreator) { showToast("jsPDF not found. Downloading as PNG."); imageDataURL = canvas.toDataURL('image/png'); fileName = 'mindmap.png'; triggerDownload(imageDataURL, fileName); return; }
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const orientation = imgWidth > imgHeight ? 'l' : 'p';
                const pdf = new PDFCreator({ orientation: orientation, unit: 'px', format: [imgWidth, imgHeight] });
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
                pdf.save('mindmap.pdf'); showToast('PDF downloaded!'); return;
            } catch (e) { console.error("PDF error:", e); showToast("Error generating PDF. Downloading as PNG."); imageDataURL = canvas.toDataURL('image/png'); fileName = 'mindmap.png'; }
        } else imageDataURL = canvas.toDataURL('image/png');
        triggerDownload(imageDataURL, fileName);
    }

    function triggerDownload(imageURL, fileName) {
        const link = document.createElement('a'); link.href = imageURL; link.download = fileName;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showToast(`${fileName.split('.').pop().toUpperCase()} downloaded!`);
    }

    function clearMap() {
        nodes.forEach(n => { if (n.element) n.element.remove(); });
        nodes = []; nodeIdCounter = 0; selectNode(null);
        document.querySelectorAll('.node.color-controls-active').forEach(n => {
            n.classList.remove('color-controls-active');
        });
        drawLines();
        showToast("Map cleared.");
    }

    mindmapContainer.addEventListener('keydown', (e) => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.closest('.node-text-input')) {
            if (e.key === 'Enter' || e.key === 'Escape') document.activeElement.blur();
            return;
        }
        if (document.activeElement && document.activeElement.closest('.node-controls')) {
            if (e.key === 'Escape') document.activeElement.blur();
            return;
        }

        if (e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); toggleShortcutVisibility(); return; }
        if ((e.ctrlKey || e.metaKey)) {
            switch (e.key.toLowerCase()) {
                case 's': e.preventDefault(); downloadMapData(); return;
                case 'p': e.preventDefault(); if (e.shiftKey) downloadScreenshot(); else screenshotToClipboard(); return;
            }
        }

        if (!selectedNodeId && e.key.toLowerCase() !== 'r') return;

        switch (e.key.toLowerCase()) {
            case 'enter':
            case 'tab':
                if (selectedNodeId) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        const sNode = nodes.find(n => n.id === selectedNodeId);
                        if (sNode && sNode.parentId) addNode(sNode.parentId);
                        else if (sNode && !sNode.parentId) addNode(null);
                    } else {
                        addNode(selectedNodeId);
                    }
                }
                break;
            case 'delete':
            case 'backspace':
                if (selectedNodeId) { e.preventDefault(); deleteNode(selectedNodeId); }
                break;
            case 'r':
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); addNode(null); }
                break;
        }
    });

    if (addRootNodeBtn) addRootNodeBtn.addEventListener('click', () => addNode(null));
    if (clearMapBtn) clearMapBtn.addEventListener('click', () => clearMap());
    if (downloadMapBtn) downloadMapBtn.addEventListener('click', downloadMapData);
    if (screenshotToClipboardBtn) screenshotToClipboardBtn.addEventListener('click', screenshotToClipboard);
    if (downloadScreenshotBtn) downloadScreenshotBtn.addEventListener('click', downloadScreenshot);
    if (resetDefaultColorsBtn) resetDefaultColorsBtn.addEventListener('click', handleResetDefaultColors);

    drawLines();
    mindmapContainer.focus();
});
