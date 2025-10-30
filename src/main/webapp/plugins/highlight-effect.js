/**
 * Highlight Effect plugin - Add highlight effect to closed curves
 * Adds a "增加高光" (Add Highlight) option to the context menu for closed shapes
 */
Draw.loadPlugin(function(editorUi)
{
    var graph = editorUi.editor.graph;

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

    // --- Modify addPopupMenuCellItems to add highlight menu item ---
    var originalAddPopupMenuCellItems = Menus.prototype.addPopupMenuCellItems;
    Menus.prototype.addPopupMenuCellItems = function(menu, cell, evt)
    {
        var graph = this.editorUi.editor.graph;
        var ss = this.editorUi.getSelectionState();
        
        // Call original function first
        originalAddPopupMenuCellItems.apply(this, arguments);
        
        // Add highlight menu item for closed shapes
        if (cell != null)
        {
            // Check if it's a closed shape
            var isClosed = false;
            if (graph.getModel().isVertex(cell))
            {
                var style = graph.getCurrentCellStyle(cell);
                var shape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);
                
                if (shape == null || shape == '')
                {
                    isClosed = true; // Default shapes are usually closed
                }
                else if (shape != 'text')
                {
                    // Check if it's a known closed shape
                    var shapeLower = shape.toLowerCase();
                    isClosed = shapeLower.indexOf('ellipse') >= 0 || 
                              shapeLower.indexOf('rectangle') >= 0 || 
                              shapeLower.indexOf('rounded') >= 0 || 
                              shapeLower.indexOf('rhombus') >= 0 ||
                              shapeLower.indexOf('triangle') >= 0 || 
                              shapeLower.indexOf('hexagon') >= 0 ||
                              shapeLower.indexOf('octagon') >= 0 || 
                              shapeLower.indexOf('pentagon') >= 0 ||
                              shapeLower.indexOf('star') >= 0 || 
                              shapeLower.indexOf('cloud') >= 0 ||
                              shapeLower.indexOf('cylinder') >= 0 || 
                              shapeLower.indexOf('parallelogram') >= 0 ||
                              shapeLower.indexOf('circle') >= 0 || 
                              shapeLower.indexOf('square') >= 0 ||
                              shapeLower.indexOf('diamond') >= 0 || 
                              shapeLower.indexOf('trapezoid') >= 0 ||
                              shapeLower.indexOf('path') >= 0; // Custom paths are usually closed
                }
            }
            
            if (isClosed)
            {
                var hasHighlight = mxUtils.getValue(
                    graph.getCurrentCellStyle(cell),
                    'highlightEffect', '0') == '1';
                
                if (!hasHighlight)
                {
                    menu.addSeparator();
                    
                    menu.addItem('增加高光', null, mxUtils.bind(this, function()
                    {
                        var cells = graph.getSelectionCells();
                        if (cells.length === 0)
                        {
                            cells = [cell];
                        }
                        
                        addHighlightEffect(cells);
                    }));
                }
            }
        }
    };
});

