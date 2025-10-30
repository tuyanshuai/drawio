/**
 * Highlight Effect plugin - Add highlight effect to closed curves
 * Adds a "增加高光" (Add Highlight) option to the context menu for closed shapes
 */
Draw.loadPlugin(function(editorUi)
{
    var graph = editorUi.editor.graph;
    
    // Debug: Log that plugin is loaded
    if (window.console)
    {
        console.log('Highlight Effect plugin loaded');
    }

    // --- Helper: Check if a path is closed ---
    function isPathClosed(path)
    {
        if (!path || path.length < 2) return false;
        
        // Check if it's a closed shape (ellipse, rectangle, etc.)
        var shape = path.toLowerCase();
        if (shape.indexOf('ellipse') >= 0 || shape.indexOf('rectangle') >= 0 || 
            shape.indexOf('rounded') >= 0 || shape.indexOf('rhombus') >= 0 ||
            shape.indexOf('triangle') >= 0 || shape.indexOf('hexagon') >= 0 ||
            shape.indexOf('octagon') >= 0 || shape.indexOf('pentagon') >= 0 ||
            shape.indexOf('star') >= 0 || shape.indexOf('cloud') >= 0 ||
            shape.indexOf('cylinder') >= 0 || shape.indexOf('parallelogram') >= 0 ||
            shape.indexOf('circle') >= 0 || shape.indexOf('square') >= 0 ||
            shape.indexOf('diamond') >= 0 || shape.indexOf('trapezoid') >= 0)
        {
            return true;
        }
        
        // Check for closed path indicators - if it's a custom path shape
        // Assume closed for custom shapes with fill
        return true;
    }

    // --- Helper: Check if cell is a closed shape ---
    function isClosedShape(cell)
    {
        if (!cell || !graph.getModel().isVertex(cell)) return false;
        
        var style = graph.getCurrentCellStyle(cell);
        var shape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);
        
        // Skip edges
        if (graph.getModel().isEdge(cell)) return false;
        
        // Check if it's a closed shape
        if (shape == null || shape == '') return true; // Default shapes are usually closed
        
        // Skip text-only shapes
        if (shape == 'text') return false;
        
        // Check if it already has highlight effect
        var hasHighlight = mxUtils.getValue(style, 'highlightEffect', '0') == '1';
        
        return isPathClosed(shape);
    }

    // --- Helper: Create or get SVG filter for highlight effect ---
    function ensureHighlightFilter(svgRoot)
    {
        if (!svgRoot) return null;
        
        var defs = svgRoot.querySelector('defs');
        if (!defs)
        {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svgRoot.insertBefore(defs, svgRoot.firstChild);
        }
        
        var filterId = 'highlight-glow-filter';
        var existingFilter = defs.querySelector('#' + filterId);
        
        if (!existingFilter)
        {
            var filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            filter.setAttribute('id', filterId);
            filter.setAttribute('x', '-50%');
            filter.setAttribute('y', '-50%');
            filter.setAttribute('width', '200%');
            filter.setAttribute('height', '200%');
            
            // Create feGaussianBlur for outer glow effect
            var feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            feGaussianBlur.setAttribute('in', 'SourceAlpha');
            feGaussianBlur.setAttribute('stdDeviation', '6');
            feGaussianBlur.setAttribute('result', 'blur');
            filter.appendChild(feGaussianBlur);
            
            // Create feFlood for highlight color (white with high opacity)
            var feFlood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
            feFlood.setAttribute('flood-color', '#ffffff');
            feFlood.setAttribute('flood-opacity', '0.9');
            feFlood.setAttribute('result', 'flood');
            filter.appendChild(feFlood);
            
            // Create feComposite to combine flood with blur
            var feComposite = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
            feComposite.setAttribute('in', 'flood');
            feComposite.setAttribute('in2', 'blur');
            feComposite.setAttribute('operator', 'in');
            feComposite.setAttribute('result', 'highlight');
            filter.appendChild(feComposite);
            
            // Merge highlight and original graphic
            var feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
            var feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
            feMergeNode1.setAttribute('in', 'highlight');
            feMerge.appendChild(feMergeNode1);
            var feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
            feMergeNode2.setAttribute('in', 'SourceGraphic');
            feMerge.appendChild(feMergeNode2);
            filter.appendChild(feMerge);
            
            defs.appendChild(filter);
        }
        
        return filterId;
    }

    // --- Function: Add highlight effect to selected cells ---
    function addHighlightEffect(cells)
    {
        if (!cells || cells.length === 0) return;
        
        graph.getModel().beginUpdate();
        try
        {
            var cellsToHighlight = [];
            
            for (var i = 0; i < cells.length; i++)
            {
                var cell = cells[i];
                
                if (isClosedShape(cell))
                {
                    cellsToHighlight.push(cell);
                    
                    // Set highlight effect style flag
                    graph.setCellStyles('highlightEffect', '1', [cell]);
                    
                    // Add glow effect using shadow style
                    graph.setCellStyles(mxConstants.STYLE_SHADOW, '1', [cell]);
                    graph.setCellStyles(mxConstants.STYLE_SHADOW_BLUR, '12', [cell]);
                    graph.setCellStyles(mxConstants.STYLE_SHADOWCOLOR, '#ffffff', [cell]);
                    graph.setCellStyles(mxConstants.STYLE_SHADOW_OPACITY, '80', [cell]);
                    graph.setCellStyles(mxConstants.STYLE_SHADOW_OFFSET_X, '0', [cell]);
                    graph.setCellStyles(mxConstants.STYLE_SHADOW_OFFSET_Y, '0', [cell]);
                    
                    // Increase opacity slightly for brighter appearance
                    var currentOpacity = mxUtils.getValue(
                        graph.getCurrentCellStyle(cell),
                        mxConstants.STYLE_OPACITY, '100');
                    
                    if (parseInt(currentOpacity) < 100)
                    {
                        graph.setCellStyles(mxConstants.STYLE_OPACITY, 
                            Math.min(100, parseInt(currentOpacity) + 10).toString(), [cell]);
                    }
                }
            }
            
            // Apply SVG filter after rendering
            if (cellsToHighlight.length > 0)
            {
                graph.refresh();
                
                // Apply filter after a short delay to ensure rendering is complete
                setTimeout(function()
                {
                    for (var j = 0; j < cellsToHighlight.length; j++)
                    {
                        var state = graph.view.getState(cellsToHighlight[j]);
                        if (state && state.shape && state.shape.node)
                        {
                            var svgRoot = state.shape.node.ownerSVGElement || 
                                         (state.shape.node.parentNode ? 
                                          state.shape.node.parentNode.ownerSVGElement : null);
                            
                            if (svgRoot)
                            {
                                var filterId = ensureHighlightFilter(svgRoot);
                                if (filterId)
                                {
                                    // Apply filter to the shape node
                                    if (state.shape.node.nodeName == 'g')
                                    {
                                        // If it's a group, apply to all children
                                        var children = state.shape.node.querySelectorAll('path, rect, ellipse, polygon, circle');
                                        for (var k = 0; k < children.length; k++)
                                        {
                                            children[k].setAttribute('filter', 'url(#' + filterId + ')');
                                        }
                                    }
                                    else
                                    {
                                        state.shape.node.setAttribute('filter', 'url(#' + filterId + ')');
                                    }
                                }
                            }
                        }
                    }
                }, 100);
            }
        }
        finally
        {
            graph.getModel().endUpdate();
        }
    }

    // Add action for highlight effect
    editorUi.actions.addAction('addHighlight', function()
    {
        var cells = graph.getSelectionCells();
        if (cells.length === 0)
        {
            editorUi.alert(mxResources.get('nothingIsSelected') || 'Nothing is selected');
            return;
        }
        
        addHighlightEffect(cells);
    });
    
    // Set action properties
    editorUi.actions.get('addHighlight').isEnabled = function()
    {
        var cells = graph.getSelectionCells();
        if (cells.length == 0) return false;
        
        for (var i = 0; i < cells.length; i++)
        {
            if (isClosedShape(cells[i])) return true;
        }
        
        return false;
    };
    
    // Add resource for menu item
    if (typeof mxResources !== 'undefined')
    {
        mxResources.parse('addHighlight=增加高光');
    }

    // --- Override shape rendering to apply highlight filter ---
    var originalRedraw = mxShape.prototype.redraw;
    mxShape.prototype.redraw = function()
    {
        originalRedraw.apply(this, arguments);
        
        if (this.state && this.state.cell)
        {
            var style = this.state.style;
            if (mxUtils.getValue(style, 'highlightEffect', '0') == '1')
            {
                var svgRoot = this.node.ownerSVGElement || 
                             (this.node.parentNode ? this.node.parentNode.ownerSVGElement : null);
                
                if (svgRoot && this.node)
                {
                    var filterId = ensureHighlightFilter(svgRoot);
                    if (filterId)
                    {
                        if (this.node.nodeName == 'g')
                        {
                            var children = this.node.querySelectorAll('path, rect, ellipse, polygon, circle');
                            for (var i = 0; i < children.length; i++)
                            {
                                children[i].setAttribute('filter', 'url(#' + filterId + ')');
                            }
                        }
                        else
                        {
                            this.node.setAttribute('filter', 'url(#' + filterId + ')');
                        }
                    }
                }
            }
        }
    };

    // Add to context menu (same way as isoextrude plugin)
    if (editorUi.menus && editorUi.menus.addPopupMenuCellItems)
    {
        var addPopupMenuCellItems = editorUi.menus.addPopupMenuCellItems;
        editorUi.menus.addPopupMenuCellItems = function(menu, cell, evt)
        {
            addPopupMenuCellItems.apply(this, arguments);
            
            if (cell != null && graph.getSelectionCount() == 1 && graph.getModel().isVertex(cell))
            {
                var style = graph.getCurrentCellStyle(cell);
                var shape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);
                var hasHighlight = mxUtils.getValue(style, 'highlightEffect', '0') == '1';
                
                // Only show for non-3D shapes, closed shapes, and shapes without highlight
                if (shape != 'isoCube' && shape != 'isoExtrude' && isClosedShape(cell) && !hasHighlight)
                {
                    menu.addSeparator();
                    editorUi.menus.addMenuItem(menu, 'addHighlight', null, evt);
                }
            }
        };
    }
});

