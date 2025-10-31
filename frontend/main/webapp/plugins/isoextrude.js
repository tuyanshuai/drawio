/**
 * Isometric Extrude plugin - Add 3D effect to any closed curve
 * Adds shape "isoExtrude" for creating 3D extruded shapes from closed paths
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
            shape.indexOf('cylinder') >= 0 || shape.indexOf('parallelogram') >= 0)
        {
            return true;
        }
        
        // Check for closed path indicators in style
        // This is a simplified check - in practice, you'd parse the actual path data
        return true; // Assume closed for now - can be enhanced with actual path parsing
    }

    // --- Helper: Check if cell is a closed shape ---
    function isClosedShape(cell)
    {
        if (!cell || !graph.getModel().isVertex(cell)) return false;
        
        var style = graph.getCurrentCellStyle(cell);
        var shape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);
        
        // Skip if already a 3D shape
        if (shape == 'isoCube' || shape == 'isoExtrude') return false;
        
        // Skip edges
        if (graph.getModel().isEdge(cell)) return false;
        
        // Check if it's a closed shape
        if (shape == null || shape == '') return true; // Default shapes are usually closed
        
        // Skip text-only shapes
        if (shape == 'text') return false;
        
        return isPathClosed(shape);
    }

    // --- Shape registration ---
    function IsoExtrudeShape(bounds, fill, stroke, strokewidth)
    {
        mxShape.call(this);
        this.bounds = bounds;
        this.fill = fill;
        this.stroke = stroke;
        this.strokewidth = (strokewidth != null) ? strokewidth : 1;
    };

    mxUtils.extend(IsoExtrudeShape, mxShape);

    // --- Helper: Get outline points based on shape type ---
    function getOutlinePoints(shapeType, x, y, w, h, style)
    {
        var cx = x + w / 2;
        var cy = y + h / 2;
        var sx = w / 2;
        var sy = h / 2;
        var points = [];
        
        // Default to rectangle if no shape type specified
        if (!shapeType || shapeType === '' || shapeType === null)
        {
            // Default rectangle - use 4 vertices
            return [
                {x: -sx, y: -sy},
                {x: sx, y: -sy},
                {x: sx, y: sy},
                {x: -sx, y: sy}
            ];
        }
        
        var shape = String(shapeType).toLowerCase();
        
        // Polygon shapes - use vertex points
        if (shape.indexOf('rectangle') >= 0 || shape.indexOf('rounded') >= 0)
        {
            // Rectangle or rounded rectangle
            var rx = parseFloat(mxUtils.getValue(style, mxConstants.STYLE_ROUNDED, 0));
            if (rx > 0)
            {
                // Rounded rectangle - sample corners and curves with many points for smooth curves
                var samples = Math.max(16, Math.floor(rx / 3)); // Increased minimum to 16 and divided by 3 for more samples
                var cornerRadius = Math.min(rx, Math.min(sx, sy));
                
                // Top edge: from top-right corner start to top-left corner end
                points.push({x: sx - cornerRadius, y: -sy});
                
                // Top-left corner (arc)
                for (var i = 0; i <= samples; i++)
                {
                    var angle = Math.PI + (i / samples) * Math.PI / 2;
                    points.push({x: -sx + cornerRadius + cornerRadius * Math.cos(angle), 
                                y: -sy + cornerRadius + cornerRadius * Math.sin(angle)});
                }
                
                // Left edge: from top-left corner end to bottom-left corner start
                points.push({x: -sx, y: -sy + cornerRadius});
                points.push({x: -sx, y: sy - cornerRadius});
                
                // Bottom-left corner (arc)
                for (var i = 0; i <= samples; i++)
                {
                    var angle = -Math.PI / 2 + (i / samples) * Math.PI / 2;
                    points.push({x: -sx + cornerRadius + cornerRadius * Math.cos(angle), 
                                y: sy - cornerRadius + cornerRadius * Math.sin(angle)});
                }
                
                // Bottom edge: from bottom-left corner end to bottom-right corner start
                points.push({x: -sx + cornerRadius, y: sy});
                points.push({x: sx - cornerRadius, y: sy});
                
                // Bottom-right corner (arc)
                for (var i = 0; i <= samples; i++)
                {
                    var angle = (i / samples) * Math.PI / 2;
                    points.push({x: sx - cornerRadius + cornerRadius * Math.cos(angle), 
                                y: sy - cornerRadius + cornerRadius * Math.sin(angle)});
                }
                
                // Right edge: from bottom-right corner end to top-right corner start
                points.push({x: sx, y: sy - cornerRadius});
                points.push({x: sx, y: -sy + cornerRadius});
                
                // Top-right corner (arc)
                for (var i = 0; i <= samples; i++)
                {
                    var angle = Math.PI / 2 + (i / samples) * Math.PI / 2;
                    points.push({x: sx - cornerRadius + cornerRadius * Math.cos(angle), 
                                y: -sy + cornerRadius + cornerRadius * Math.sin(angle)});
                }
            }
            else
            {
                // Simple rectangle - 4 vertices
                return [
                    {x: -sx, y: -sy},
                    {x: sx, y: -sy},
                    {x: sx, y: sy},
                    {x: -sx, y: sy}
                ];
            }
        }
        else if (shape.indexOf('rhombus') >= 0 || shape.indexOf('diamond') >= 0)
        {
            // Diamond/Rhombus - 4 vertices
            return [
                {x: 0, y: -sy},
                {x: sx, y: 0},
                {x: 0, y: sy},
                {x: -sx, y: 0}
            ];
        }
        else if (shape.indexOf('triangle') >= 0)
        {
            // Triangle - 3 vertices
            return [
                {x: 0, y: -sy},
                {x: sx, y: sy},
                {x: -sx, y: sy}
            ];
        }
        else if (shape.indexOf('hexagon') >= 0)
        {
            // Hexagon - 6 vertices
            for (var i = 0; i < 6; i++)
            {
                var angle = (i / 6) * 2 * Math.PI - Math.PI / 2;
                var r = Math.min(sx, sy) * 0.866; // hexagon radius
                points.push({x: r * Math.cos(angle), y: r * Math.sin(angle)});
            }
        }
        else if (shape.indexOf('pentagon') >= 0)
        {
            // Pentagon - 5 vertices
            for (var i = 0; i < 5; i++)
            {
                var angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
                var r = Math.min(sx, sy);
                points.push({x: r * Math.cos(angle), y: r * Math.sin(angle)});
            }
        }
        else if (shape.indexOf('octagon') >= 0)
        {
            // Octagon - 8 vertices
            for (var i = 0; i < 8; i++)
            {
                var angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
                var r = Math.min(sx, sy) * 0.924; // octagon radius
                points.push({x: r * Math.cos(angle), y: r * Math.sin(angle)});
            }
        }
        else if (shape.indexOf('star') >= 0)
        {
            // Star - sample points
            var numPoints = 10; // 5-pointed star = 10 vertices
            for (var i = 0; i < numPoints; i++)
            {
                var angle = (i / numPoints) * 2 * Math.PI - Math.PI / 2;
                var r = (i % 2 === 0) ? Math.min(sx, sy) : Math.min(sx, sy) * 0.5;
                points.push({x: r * Math.cos(angle), y: r * Math.sin(angle)});
            }
        }
        else if (shape.indexOf('parallelogram') >= 0)
        {
            // Parallelogram - 4 vertices with offset
            var offset = sx * 0.3;
            return [
                {x: -sx + offset, y: -sy},
                {x: sx + offset, y: -sy},
                {x: sx - offset, y: sy},
                {x: -sx - offset, y: sy}
            ];
        }
        else if (shape.indexOf('ellipse') >= 0 || shape.indexOf('circle') >= 0)
        {
            // Ellipse/Circle - uniform sampling with maximum points for extremely smooth curves
            var numSamples = 512; // Increased to 512 for ultra-smooth 3D effect (no visible edges)
            for (var i = 0; i < numSamples; i++)
            {
                var angle = (i / numSamples) * 2 * Math.PI;
                points.push({x: sx * Math.cos(angle), y: sy * Math.sin(angle)});
            }
        }
        else if (shape.indexOf('manualpolygon') >= 0 || shape.indexOf('polygon') >= 0)
        {
            // ManualPolygon shape - get coordinates from polyCoords style property
            var polyCoordsStr = mxUtils.getValue(style, 'polyCoords', null);
            if (polyCoordsStr)
            {
                try
                {
                    var polyCoords = JSON.parse(polyCoordsStr);
                    if (Array.isArray(polyCoords) && polyCoords.length >= 2)
                    {
                        // Convert relative coordinates (0-1) to absolute coordinates (-sx to sx, -sy to sy)
                        for (var i = 0; i < polyCoords.length; i++)
                        {
                            if (Array.isArray(polyCoords[i]) && polyCoords[i].length >= 2)
                            {
                                var relX = parseFloat(polyCoords[i][0]);
                                var relY = parseFloat(polyCoords[i][1]);
                                if (!isNaN(relX) && !isNaN(relY))
                                {
                                    // Convert from relative (0-1) to centered coordinates (-sx to sx, -sy to sy)
                                    points.push({
                                        x: (relX - 0.5) * w,
                                        y: (relY - 0.5) * h
                                    });
                                }
                            }
                        }
                        // Return points if we successfully parsed them
                        if (points.length >= 2)
                        {
                            return points;
                        }
                    }
                }
                catch (e)
                {
                    if (window.console)
                    {
                        console.error('[IsoExtrude] Failed to parse polyCoords:', e);
                    }
                }
            }
            // If polyCoords parsing failed, fall through to default rectangle
        }
        else
        {
            // Unknown shape - for safety, default to rectangle vertices instead of curve sampling
            // This prevents rectangles from being incorrectly rendered as circles
            return [
                {x: -sx, y: -sy},
                {x: sx, y: -sy},
                {x: sx, y: sy},
                {x: -sx, y: sy}
            ];
        }
        
        return points;
    }

    IsoExtrudeShape.prototype.paintVertexShape = function(c, x, y, w, h)
    {
        var style = this.style || {};
        
        // Get depth (default to half of average width/height)
        var defaultDepth = Math.min(w, h) * 0.5;
        var d = parseFloat(mxUtils.getValue(style, 'isoZ', defaultDepth));
        var rx = mxUtils.toRadians(parseFloat(mxUtils.getValue(style, 'isoRx', 35)));
        var ry = mxUtils.toRadians(parseFloat(mxUtils.getValue(style, 'isoRy', 35)));
        var rz = mxUtils.toRadians(parseFloat(mxUtils.getValue(style, 'isoRz', 0)));

        // Bevel parameters (units: points, convert to pixels: 1pt ≈ 1.33px at 96 DPI)
        var pointsToPixels = 1.33;
        var topBevelType = mxUtils.getValue(style, 'topBevelType', 'none');
        var topBevelWidth = parseFloat(mxUtils.getValue(style, 'topBevelWidth', 0)) * pointsToPixels;
        var topBevelHeight = parseFloat(mxUtils.getValue(style, 'topBevelHeight', 0)) * pointsToPixels;
        var bottomBevelType = mxUtils.getValue(style, 'bottomBevelType', 'none');
        var bottomBevelWidth = parseFloat(mxUtils.getValue(style, 'bottomBevelWidth', 0)) * pointsToPixels;
        var bottomBevelHeight = parseFloat(mxUtils.getValue(style, 'bottomBevelHeight', 0)) * pointsToPixels;
        
        var hasTopBevel = topBevelType !== 'none' && topBevelType !== '' && topBevelWidth > 0 && topBevelHeight > 0;
        var hasBottomBevel = bottomBevelType !== 'none' && bottomBevelType !== '' && bottomBevelWidth > 0 && bottomBevelHeight > 0;

        var cx = x + w / 2;
        var cy = y + h / 2;
        var sx = w / 2;
        var sy = h / 2;
        var sz = d / 2;

        // Get original shape type from style
        var originalShape = mxUtils.getValue(style, 'isoOriginalShape', null);
        
        // Rotation functions (same as isoCube)
        function rotX(p)
        {
            var s = Math.sin(rx), c = Math.cos(rx);
            return {x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c};
        };

        function rotY(p)
        {
            var s = Math.sin(ry), c = Math.cos(ry);
            return {x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c};
        };

        function rotZ(p)
        {
            var s = Math.sin(rz), c = Math.cos(rz);
            return {x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z};
        };

        function rotate(p)
        {
            return rotZ(rotY(rotX(p)));
        };

        function project(p)
        {
            return {x: cx + p.x, y: cy + p.y, z: p.z};
        };

        // Get base shape path points based on original shape type
        var basePoints = getOutlinePoints(originalShape, x, y, w, h, style);
        var numPoints = basePoints.length;

        // Create vertex array (v3) - will contain all vertices before rotation
        var v3 = [];
        
        function calcArcSegments(widthPx, heightPx)
        {
            var bevelSize = Math.max(widthPx, heightPx);
            var segments = Math.round(bevelSize / 1.5);
            if (!isFinite(segments) || segments <= 0)
            {
                segments = 0;
            }
            return Math.max(16, Math.min(64, segments || 0));
        }
        
        // Store base indices for reference
        var frontFaceStartIdx = 0;
        var backFaceStartIdx = numPoints;
        var topBevelStartIdx = -1;
        var bottomBevelStartIdx = -1;
        var topBevelCircleStartIdx = -1;
        var bottomBevelCircleStartIdx = -1;
        var topArcPointsPerSample = 0;
        var bottomArcPointsPerSample = 0;
        var topSideVertexPairs = []; // For rounded bevel faces
        var bottomSideVertexPairs = []; // For rounded bevel faces
        
        // Create original front face vertices (at z = sz)
        for (var i = 0; i < numPoints; i++)
        {
            v3.push({x: basePoints[i].x, y: basePoints[i].y, z: sz});
        }
        
        // Generate top bevel vertices if needed
        if (hasTopBevel)
        {
            if (topBevelType === 'circle')
            {
                // Rounded bevel: create smooth arc transition
                var maxDim = Math.min(w, h);
                var scale = Math.max(0.1, 1 - (topBevelWidth / maxDim));
                var topBevelZ = sz + topBevelHeight;
                
                topBevelStartIdx = v3.length;
                
                // Number of arc points along the transition
                var numArcPoints = calcArcSegments(topBevelWidth, topBevelHeight);
                var arcCount = numArcPoints + 1;
                topArcPointsPerSample = arcCount;
                
                // For each point on the outline, create arc vertices
                for (var i = 0; i < numPoints; i++)
                {
                    var origX = basePoints[i].x;
                    var origY = basePoints[i].y;
                    var origZ = sz;
                    
                    var bevelX = origX * scale;
                    var bevelY = origY * scale;
                    var bevelZ = topBevelZ;
                    
                    // Create arc vertices for this outline point
                    var arcVertices = [];
                    for (var a = 0; a <= numArcPoints; a++)
                    {
                        var arcT = a / numArcPoints; // 0 to 1 along the arc
                        
                        // Interpolate X and Y linearly from original to bevel (radius contraction)
                        var midX = origX + (bevelX - origX) * arcT;
                        var midY = origY + (bevelY - origY) * arcT;
                        
                        // Interpolate Z using smooth convex arc interpolation
                        // Use circular arc (sin function) for smooth, convex, continuous transition
                        var easedT = Math.sin(arcT * Math.PI / 2);
                        
                        // Apply the circular arc interpolation for smooth, convex transition
                        var arcZ = origZ + (bevelZ - origZ) * easedT;
                        
                        var vertexIdx = v3.length;
                        v3.push({x: midX, y: midY, z: arcZ});
                        arcVertices.push(vertexIdx);
                    }
                    
                    // Store vertex pairs for face generation
                    topSideVertexPairs.push({
                        pointIdx: i,
                        arcVertices: arcVertices.slice()
                    });
                }
                
                topBevelCircleStartIdx = topBevelStartIdx + (numPoints * arcCount);
                
                // Create bevel top face vertices (contracted outline at raised Z)
                for (var i = 0; i < numPoints; i++)
                {
                    var px = basePoints[i].x * scale;
                    var py = basePoints[i].y * scale;
                    var pz = topBevelZ;
                    v3.push({x: px, y: py, z: pz});
                }
            }
            else
            {
                // Simple bevel: just create contracted top face
                var maxDim = Math.min(w, h);
                var scale = Math.max(0.1, 1 - (topBevelWidth / maxDim));
                var topBevelZ = sz + topBevelHeight;
                
                topBevelStartIdx = v3.length;
                topBevelCircleStartIdx = topBevelStartIdx;
                topArcPointsPerSample = 0;
                for (var i = 0; i < numPoints; i++)
                {
                    var px = basePoints[i].x * scale;
                    var py = basePoints[i].y * scale;
                    var pz = topBevelZ;
                    v3.push({x: px, y: py, z: pz});
                }
            }
        }
        else
        {
            topArcPointsPerSample = 0;
            topBevelCircleStartIdx = -1;
        }
        
        // Update backFaceStartIdx after top bevel is added (if any)
        // Back face is added after all top bevel vertices
        backFaceStartIdx = v3.length;
        
        // Create original back face vertices (at z = -sz)
        for (var i = 0; i < numPoints; i++)
        {
            v3.push({x: basePoints[i].x, y: basePoints[i].y, z: -sz});
        }
        
        // Generate bottom bevel vertices if needed
        if (hasBottomBevel)
        {
            if (bottomBevelType === 'circle')
            {
                // Rounded bevel: create smooth arc transition
                var maxDim = Math.min(w, h);
                var scale = Math.max(0.1, 1 - (bottomBevelWidth / maxDim));
                var bottomBevelZ = -sz - bottomBevelHeight;
                
                bottomBevelStartIdx = v3.length;
                
                // Number of arc points along the transition
                var numArcPoints = calcArcSegments(bottomBevelWidth, bottomBevelHeight);
                var arcCount = numArcPoints + 1;
                bottomArcPointsPerSample = arcCount;
                
                // For each point on the outline, create arc vertices
                for (var i = 0; i < numPoints; i++)
                {
                    var origX = basePoints[i].x;
                    var origY = basePoints[i].y;
                    var origZ = -sz;
                    
                    var bevelX = origX * scale;
                    var bevelY = origY * scale;
                    var bevelZ = bottomBevelZ;
                    
                    // Create arc vertices for this outline point
                    var arcVertices = [];
                    for (var a = 0; a <= numArcPoints; a++)
                    {
                        var arcT = a / numArcPoints; // 0 to 1 along the arc
                        
                        // Interpolate X and Y linearly from original to bevel (radius contraction)
                        var midX = origX + (bevelX - origX) * arcT;
                        var midY = origY + (bevelY - origY) * arcT;
                        
                        // Interpolate Z using smooth convex arc interpolation
                        // Use circular arc (sin function) for smooth, convex, continuous transition
                        var easedT = Math.sin(arcT * Math.PI / 2);
                        
                        // Apply the circular arc interpolation for smooth, convex transition
                        var arcZ = origZ + (bevelZ - origZ) * easedT;
                        
                        var vertexIdx = v3.length;
                        v3.push({x: midX, y: midY, z: arcZ});
                        arcVertices.push(vertexIdx);
                    }
                    
                    // Store vertex pairs for face generation
                    bottomSideVertexPairs.push({
                        pointIdx: i,
                        arcVertices: arcVertices.slice()
                    });
                }
                
                bottomBevelCircleStartIdx = bottomBevelStartIdx + (numPoints * arcCount);
                
                // Create bevel bottom face vertices (contracted outline at lowered Z)
                for (var i = 0; i < numPoints; i++)
                {
                    var px = basePoints[i].x * scale;
                    var py = basePoints[i].y * scale;
                    var pz = bottomBevelZ;
                    v3.push({x: px, y: py, z: pz});
                }
            }
            else
            {
                // Simple bevel: just create contracted bottom face
                var maxDim = Math.min(w, h);
                var scale = Math.max(0.1, 1 - (bottomBevelWidth / maxDim));
                var bottomBevelZ = -sz - bottomBevelHeight;
                
                bottomBevelStartIdx = v3.length;
                bottomBevelCircleStartIdx = bottomBevelStartIdx;
                bottomArcPointsPerSample = 0;
                for (var i = 0; i < numPoints; i++)
                {
                    var px = basePoints[i].x * scale;
                    var py = basePoints[i].y * scale;
                    var pz = bottomBevelZ;
                    v3.push({x: px, y: py, z: pz});
                }
            }
        }
        else
        {
            bottomArcPointsPerSample = 0;
            bottomBevelCircleStartIdx = -1;
        }

        // Rotate all vertices
        var rotatedVertices = [];
        for (var i = 0; i < v3.length; i++)
        {
            rotatedVertices.push(rotate(v3[i]));
        }

        var projectedVertices = [];
        for (var i = 0; i < rotatedVertices.length; i++)
        {
            projectedVertices.push(project(rotatedVertices[i]));
        }

        // Create faces (front, back, and sides)
        var faces = [];
        
        // Top face (front face)
        if (hasTopBevel)
        {
            // Top bevel face uses the contracted outline
            var topBevelFaceStartIdx = topBevelType === 'circle' ? 
                topBevelCircleStartIdx : topBevelStartIdx;
            
            var topFaceIndices = [];
            for (var i = 0; i < numPoints; i++)
            {
                topFaceIndices.push(topBevelFaceStartIdx + i);
            }
            faces.push({indices: topFaceIndices, isFront: true});
        }
        else
        {
            // Original front face
            var frontFaceIndices = [];
            for (var i = 0; i < numPoints; i++)
            {
                frontFaceIndices.push(i);
            }
            faces.push({indices: frontFaceIndices, isFront: true});
        }
        
        // Bottom face (back face)
        if (hasBottomBevel)
        {
            // Bottom bevel face uses the contracted outline
            var bottomBevelFaceStartIdx = bottomBevelType === 'circle' ?
                bottomBevelCircleStartIdx : bottomBevelStartIdx;
            
            var bottomFaceIndices = [];
            for (var i = numPoints - 1; i >= 0; i--)
            {
                bottomFaceIndices.push(bottomBevelFaceStartIdx + i);
            }
            faces.push({indices: bottomFaceIndices, isFront: false});
        }
        else
        {
            // Original back face (reversed winding)
            var backFaceIndices = [];
            for (var i = numPoints - 1; i >= 0; i--)
            {
                backFaceIndices.push(backFaceStartIdx + i);
            }
            faces.push({indices: backFaceIndices, isFront: false});
        }
        
        // Side faces (connecting front and back)
        if (hasTopBevel && topBevelType === 'circle')
        {
            // Rounded top bevel: create faces connecting original front face to bevel face
            for (var i = 0; i < numPoints; i++)
            {
                var next = (i + 1) % numPoints;
                
                // Get arc vertices for this point and next point
                var currArcVerts = topSideVertexPairs[i].arcVertices;
                var nextArcVerts = topSideVertexPairs[next].arcVertices;
                var arcLen = Math.min(currArcVerts.length, nextArcVerts.length);
                
                // Create faces connecting arc vertices
                for (var a = 0; a < arcLen - 1; a++)
                {
                    var v1 = currArcVerts[a];
                    var v2 = currArcVerts[a + 1];
                    var v3 = nextArcVerts[a + 1];
                    var v4 = nextArcVerts[a];
                    
                    faces.push({
                        indices: [v1, v2, v3, v4],
                        isSide: true
                    });
                }
            }
        }
        else if (hasTopBevel)
        {
            // Simple top bevel: connect original front face to bevel face
            var topBevelFaceStartIdx = topBevelStartIdx;
            for (var i = 0; i < numPoints; i++)
            {
                var next = (i + 1) % numPoints;
                faces.push({
                    indices: [frontFaceStartIdx + i, frontFaceStartIdx + next, topBevelFaceStartIdx + next, topBevelFaceStartIdx + i],
                    isSide: true
                });
            }
        }
        
        // Middle side faces (only if no bevels or only one bevel)
        if (!hasTopBevel && !hasBottomBevel)
        {
            // Original side faces connecting front and back
            for (var i = 0; i < numPoints; i++)
            {
                var next = (i + 1) % numPoints;
                faces.push({
                    indices: [frontFaceStartIdx + i, frontFaceStartIdx + next, backFaceStartIdx + next, backFaceStartIdx + i],
                    isSide: true
                });
            }
        }
        else if (hasTopBevel && !hasBottomBevel)
        {
            // Connect bevel top to original back
            var topConnectIdx = topBevelType === 'circle' ? topBevelCircleStartIdx : topBevelStartIdx;
            for (var i = 0; i < numPoints; i++)
            {
                var next = (i + 1) % numPoints;
                faces.push({
                    indices: [topConnectIdx + i, topConnectIdx + next, backFaceStartIdx + next, backFaceStartIdx + i],
                    isSide: true
                });
            }
        }
        else if (!hasTopBevel && hasBottomBevel)
        {
            // Connect original front to bevel bottom
            var bottomConnectIdx = bottomBevelType === 'circle' ?
                bottomBevelCircleStartIdx : bottomBevelStartIdx;
            for (var i = 0; i < numPoints; i++)
            {
                var next = (i + 1) % numPoints;
                faces.push({
                    indices: [frontFaceStartIdx + i, frontFaceStartIdx + next, bottomConnectIdx + next, bottomConnectIdx + i],
                    isSide: true
                });
            }
        }
        else if (hasTopBevel && hasBottomBevel)
        {
            // Connect bevel top to bevel bottom
            var topConnectIdx = topBevelType === 'circle' ? 
                topBevelCircleStartIdx : topBevelStartIdx;
            var bottomConnectIdx = bottomBevelType === 'circle' ?
                bottomBevelCircleStartIdx : bottomBevelStartIdx;
            for (var i = 0; i < numPoints; i++)
            {
                var next = (i + 1) % numPoints;
                faces.push({
                    indices: [topConnectIdx + i, topConnectIdx + next, bottomConnectIdx + next, bottomConnectIdx + i],
                    isSide: true
                });
            }
        }
        
        // Bottom bevel side faces
        if (hasBottomBevel && bottomBevelType === 'circle')
        {
            // Rounded bottom bevel: create faces connecting original back face to bevel face
            for (var i = 0; i < numPoints; i++)
            {
                var next = (i + 1) % numPoints;
                
                // Get arc vertices for this point and next point
                var currArcVerts = bottomSideVertexPairs[i].arcVertices;
                var nextArcVerts = bottomSideVertexPairs[next].arcVertices;
                var arcLen = Math.min(currArcVerts.length, nextArcVerts.length);
                
                // Create faces connecting arc vertices
                for (var a = 0; a < arcLen - 1; a++)
                {
                    var v1 = currArcVerts[a];
                    var v2 = currArcVerts[a + 1];
                    var v3 = nextArcVerts[a + 1];
                    var v4 = nextArcVerts[a];
                    
                    faces.push({
                        indices: [v1, v2, v3, v4],
                        isSide: true
                    });
                }
            }
        }
        else if (hasBottomBevel)
        {
            // Simple bottom bevel: connect original back face to bevel face
            var bottomBevelFaceStartIdx = bottomBevelStartIdx;
            for (var i = 0; i < numPoints; i++)
            {
                var next = (i + 1) % numPoints;
                faces.push({
                    indices: [backFaceStartIdx + i, backFaceStartIdx + next, bottomBevelFaceStartIdx + next, bottomBevelFaceStartIdx + i],
                    isSide: true
                });
            }
        }

        // Calculate face normals and visibility
        var viewDir = {x: 0, y: 0, z: -1};
        var faceInfo = [];
        
        for (var fi = 0; fi < faces.length; fi++)
        {
            var face = faces[fi];
            var idx = face.indices;
            
            // Calculate normal
            var p0 = rotatedVertices[idx[0]];
            var p1 = rotatedVertices[idx[1]];
            var p2 = rotatedVertices[idx[2]];
            
            var ux = p1.x - p0.x, uy = p1.y - p0.y, uz = p1.z - p0.z;
            var vx = p2.x - p0.x, vy = p2.y - p0.y, vz = p2.z - p0.z;
            
            var nx = uy * vz - uz * vy;
            var ny = uz * vx - ux * vz;
            var nz = ux * vy - uy * vx;
            
            var len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
            nx /= len; ny /= len; nz /= len;
            
            // Average z for depth sorting
            var avgZ = 0;
            for (var k = 0; k < idx.length; k++)
            {
                avgZ += rotatedVertices[idx[k]].z;
            }
            avgZ /= idx.length;
            
            // Visibility
            var vis = (nx*viewDir.x + ny*viewDir.y + nz*viewDir.z) < 0;
            
            faceInfo.push({
                id: fi,
                indices: idx,
                normal: {x: nx, y: ny, z: nz},
                z: avgZ,
                visible: vis,
                isFrontFace: (fi < 2) // Remember original face type before sorting
            });
        }

        // Sort back-to-front
        faceInfo.sort(function(a, b){ return a.z - b.z; });

        // Lighting for 3D effect
        var light = {x: 0.35, y: -0.5, z: -0.8};
        var lmag = Math.sqrt(light.x*light.x + light.y*light.y + light.z*light.z) || 1;
        light.x /= lmag; light.y /= lmag; light.z /= lmag;

        function shade(hex, factor)
        {
            function clamp(v){ return Math.max(0, Math.min(255, v)); }
            if (hex.charAt(0) == '#') hex = hex.substring(1);
            if (hex.length === 3) hex = hex.split('').map(function(c){return c+c;}).join('');
            var r = parseInt(hex.substring(0,2), 16);
            var g = parseInt(hex.substring(2,4), 16);
            var b = parseInt(hex.substring(4,6), 16);
            r = clamp(Math.round(r * factor));
            g = clamp(Math.round(g * factor));
            b = clamp(Math.round(b * factor));
            return '#' + ('0' + r.toString(16)).slice(-2) + ('0' + g.toString(16)).slice(-2) + ('0' + b.toString(16)).slice(-2);
        }

        function isNoneColor(col)
        {
            if (col == null) return true;
            var s = String(col).toLowerCase();
            if (s === 'none' || s === 'transparent' || s === '') return true;
            if (s.indexOf('rgba(') === 0)
            {
                var m = s.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);
                if (m && parseFloat(m[1]) === 0) return true;
            }
            if (s.length === 9 && s.startsWith('#') && s.substring(7) === '00') return true; // #RRGGBBAA with AA=00
            return false;
        }
        
        // Get base fill color first (needed for stroke default)
        // Default fill color to blue if not set or is 'none' (avoid black)
        var baseFill = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, null);
        // Force default blue color - always use it if fillColor is invalid
        if (!baseFill || baseFill === '' || baseFill === 'none' || baseFill === 'transparent' || 
            baseFill === '#000000' || baseFill === '#000' || baseFill.toLowerCase() === 'black')
        {
            baseFill = '#1e78b7';
        }
        // Ensure baseFill is always a valid hex color
        if (!baseFill || !baseFill.startsWith('#'))
        {
            baseFill = '#1e78b7';
        }
        
        // Use shared stroke setup function (from isocube.js)
        // IMPORTANT: Match isocube.js behavior - call setup3DShapeStroke directly with original style
        // Do NOT modify style before calling setup3DShapeStroke, let it handle all logic
        // The only difference for isoExtrude is we want to default strokeColor to fillColor for NEW shapes
        // But we must respect when user explicitly disables line (mxConstants.NONE, null, etc.)
        
        var strokeColorFromStyle = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null);
        
        // Check if strokeColor property exists in style object
        // This is the key to distinguishing:
        // - "never set" (property doesn't exist) -> default to fillColor
        // - "explicitly disabled" (property exists, even if null/mxConstants.NONE) -> respect user's choice
        var hasStrokeColorProperty = (mxConstants.STYLE_STROKECOLOR in style);
        
        // Only default to fillColor for truly new shapes (property doesn't exist)
        // If property exists, user has interacted with it - respect their choice (even if null)
        var styleToUse = style;
        if (!hasStrokeColorProperty && strokeColorFromStyle == null)
        {
            // New shape: default strokeColor to fillColor (draw.io default behavior)
            if (baseFill && !isNoneColor(baseFill))
            {
                styleToUse = {};
                for (var key in style)
                {
                    styleToUse[key] = style[key];
                }
                styleToUse[mxConstants.STYLE_STROKECOLOR] = baseFill;
            }
        }
        // If property exists (user has set it), pass style as-is to setup3DShapeStroke
        // setup3DShapeStroke will handle mxConstants.NONE, null, 'none', etc. correctly
        
        // Debug: Check stroke color handling
        if (window.console && window.console.log)
        {
            console.log('[IsoExtrude] Stroke color check (BEFORE setup3DShapeStroke):', {
                strokeColorFromStyle: strokeColorFromStyle,
                hasStrokeColorProperty: hasStrokeColorProperty,
                willUseDefaultFillColor: (!hasStrokeColorProperty && strokeColorFromStyle == null),
                styleToUseStrokeColor: mxUtils.getValue(styleToUse, mxConstants.STYLE_STROKECOLOR, null),
                styleStrokeWidth: mxUtils.getValue(styleToUse, mxConstants.STYLE_STROKEWIDTH, null),
                styleStrokeOpacity: mxUtils.getValue(styleToUse, 'strokeOpacity', null),
                originalStyleStrokeColor: mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null),
                styleHasStrokeColorInObject: (mxConstants.STYLE_STROKECOLOR in style)
            });
        }
        
        // Use the shared stroke setup function from isocube.js
        // This ensures consistent stroke handling across all 3D shapes
        var strokeInfo = window.setup3DShapeStroke(c, styleToUse, this.strokewidth, baseFill);
        var strokeColor = strokeInfo.strokeColor;
        var strokeWidth = strokeInfo.strokeWidth;
        var strokeOpacity = strokeInfo.strokeOpacity;
        var strokeEnabled = strokeInfo.strokeEnabled;
        
        // Debug: Print all stroke properties AFTER setup
        if (window.console && window.console.log)
        {
            // Helper to check if color is "none" for debug output
            function isNoneColorDebug(col)
            {
                if (col == null) return true;
                var s = String(col).toLowerCase();
                if (s === 'none' || s === 'transparent' || s === '') return true;
                return false;
            }
            
            console.log('[IsoExtrude] Stroke Properties (AFTER setup3DShapeStroke):', {
                strokeColorFromStyle: strokeColorFromStyle,
                strokeColor: strokeColor,
                strokeWidth: strokeWidth,
                strokeOpacity: strokeOpacity,
                strokeEnabled: strokeEnabled,
                strokeEnabledCheck: (!isNoneColorDebug(strokeColor) && strokeOpacity > 0 && strokeWidth > 0),
                baseFill: baseFill,
                styleStrokeColor: mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null),
                styleStrokeWidth: mxUtils.getValue(style, mxConstants.STYLE_STROKEWIDTH, null),
                styleStrokeOpacity: mxUtils.getValue(style, 'strokeOpacity', null),
                defaultStrokewidth: this.strokewidth,
                styleToUseStrokeColor: mxUtils.getValue(styleToUse, mxConstants.STYLE_STROKECOLOR, null),
                hasSetupFunction: typeof window.setup3DShapeStroke === 'function',
                hasStrokeColorProperty: hasStrokeColorProperty
            });
        }
        
        // Honor style-provided opacities for fill
        // Default opacity to 60% (0.6) for 3D effect if not set
        var fillOpacity = parseFloat(mxUtils.getValue(style, 'fillOpacity', 0.6));
        if (isNaN(fillOpacity)) fillOpacity = 0.6; // Default 60% opacity for 3D effect
        if (fillOpacity > 1) fillOpacity = fillOpacity / 100; // accept 0..100 style values
        c.setFillAlpha(Math.max(0, Math.min(1, fillOpacity)));
        
        function isNoneFill(col)
        {
            if (col == null) return true;
            var s = String(col).toLowerCase();
            if (s === 'none' || s === 'transparent' || s === '') return true;
            if (s.indexOf('rgba(') === 0)
            {
                var m = s.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);
                if (m && parseFloat(m[1]) === 0) return true;
            }
            if (s.length === 9 && s.startsWith('#') && s.substring(7) === '00') return true;
            return false;
        }
        
        var fillEnabled = !isNoneFill(baseFill) && fillOpacity > 0;
        
        if (!fillEnabled && !strokeEnabled) return;

        // Check if this is a curve shape (ellipse/circle/cylinder)
        // For curves, we'll still draw lines on top/bottom faces, but may skip side faces
        var originalShape = mxUtils.getValue(style, 'isoOriginalShape', null);
        var isCurveShape = false;
        if (originalShape)
        {
            var shapeLower = originalShape.toLowerCase();
            isCurveShape = (shapeLower.indexOf('ellipse') >= 0 || shapeLower.indexOf('circle') >= 0 ||
                           shapeLower.indexOf('cylinder') >= 0);
        }
        // Also check if basePoints count indicates a curve (high sample count = curve)
        // Curves typically have 512 samples, polygons have much fewer (3-8 vertices)
        if (!isCurveShape && basePoints.length > 100)
        {
            isCurveShape = true;
        }
        
        // Process stroke color - convert light-dark() format to actual color
        // mxCanvas needs actual color values, not light-dark() strings
        var actualStrokeColor = strokeColor;
        if (strokeColor && typeof strokeColor === 'string' && strokeColor.indexOf('light-dark(') === 0)
        {
            // Parse light-dark(light, dark) format: light-dark(#000000, #ffffff)
            var match = strokeColor.match(/light-dark\(([^,]+),\s*([^)]+)\)/);
            if (match)
            {
                var lightColor = match[1].trim();
                var darkColor = match[2].trim();
                // Use mxUtils to get the actual color based on current mode
                if (typeof mxUtils !== 'undefined' && typeof mxUtils.getLightDarkColor === 'function')
                {
                    try
                    {
                        var lightDarkColor = mxUtils.getLightDarkColor(lightColor);
                        if (lightDarkColor && lightDarkColor.cssText)
                        {
                            actualStrokeColor = lightDarkColor.cssText;
                        }
                        else if (lightDarkColor && typeof lightDarkColor === 'string')
                        {
                            actualStrokeColor = lightDarkColor;
                        }
                        else
                        {
                            // Fallback: use light color directly
                            actualStrokeColor = lightColor;
                        }
                    }
                    catch (e)
                    {
                        // Fallback: use light color if parsing fails
                        actualStrokeColor = lightColor;
                    }
                }
                else
                {
                    // Fallback: use light color if mxUtils not available
                    actualStrokeColor = lightColor;
                }
                
                // Debug: Log color conversion
                if (window.console && window.console.log && fi === 0)
                {
                    console.log('[IsoExtrude] Converting light-dark color:', {
                        original: strokeColor,
                        light: lightColor,
                        dark: darkColor,
                        converted: actualStrokeColor
                    });
                }
            }
        }

        // Render faces
        for (var fi = 0; fi < faceInfo.length; fi++)
        {
            var finfo = faceInfo[fi];
            if (!finfo.visible && fi < 2) continue; // Skip back faces for front/back
            
            var idx = finfo.indices;
            var points = [];
            for (var k = 0; k < idx.length; k++)
            {
                var v = projectedVertices[idx[k]];
                points.push(new mxPoint(v.x, v.y));
            }

            // Calculate lighting for 3D effect
            var ndotl = finfo.normal.x * light.x + finfo.normal.y * light.y + finfo.normal.z * light.z;
            ndotl = Math.max(0, Math.min(1, ndotl));
            
            // Apply shading with very smooth transition to eliminate visible seams
            // Use very narrow lighting range: 0.85 to 1.0 (85% to 100% brightness)
            // Apply smooth curve with higher exponent for even smoother transition
            var lightingFactor = 0.85 + 0.15 * Math.pow(ndotl, 1.5);
            // Apply additional smoothing curve to reduce any abrupt changes
            lightingFactor = Math.pow(lightingFactor, 0.95);
            var faceFill = fillEnabled ? shade(baseFill, lightingFactor) : baseFill;
            
            // For curve shapes: do not draw lines at all (neither top/bottom nor side faces)
            // For non-curve shapes: draw lines on all faces normally
            var shouldDrawStroke = strokeEnabled && !isCurveShape;
            
            if (fillEnabled)
            {
                // Set fill color
                c.setFillColor(faceFill);
                
                // IMPORTANT: Set stroke properties BEFORE begin() to ensure they are applied
                // The order matters: setStroke* -> begin() -> draw path -> fillAndStroke()
                if (shouldDrawStroke)
                {
                    // Use actual color (processed from light-dark format if needed)
                    c.setStrokeColor(actualStrokeColor);
                    c.setStrokeWidth(strokeWidth);
                    c.setStrokeAlpha(Math.max(0, Math.min(1, strokeOpacity)));
                    
                    // Debug: Print stroke application for each face
                    if (window.console && window.console.log && fi === 0) // Only log for first face to avoid spam
                    {
                        console.log('[IsoExtrude] Setting stroke before drawing face:', {
                            faceIndex: fi,
                            shouldDrawStroke: shouldDrawStroke,
                            strokeColor: strokeColor,
                            strokeWidth: strokeWidth,
                            strokeOpacity: strokeOpacity,
                            isCurveShape: isCurveShape,
                            pointsCount: points.length,
                            faceFill: faceFill
                        });
                    }
                }
                else if (!strokeEnabled)
                {
                    // Explicitly clear stroke if disabled
                    c.setStrokeColor(null);
                    c.setStrokeWidth(0);
                }
                
                c.begin();
                
                // Use standard lineTo for all shapes
                c.moveTo(points[0].x, points[0].y);
                for (var k = 1; k < points.length; k++)
                {
                    c.lineTo(points[k].x, points[k].y);
                }
                c.close();
                
                if (shouldDrawStroke) 
                { 
                    // Debug: Verify before fillAndStroke
                    if (window.console && window.console.log && fi === 0)
                    {
                        console.log('[IsoExtrude] Calling fillAndStroke - shouldDrawStroke:', shouldDrawStroke, 'strokeEnabled:', strokeEnabled);
                    }
                    c.fillAndStroke(); 
                } 
                else 
                { 
                    c.fill();
                }
            }
            else if (shouldDrawStroke)
            {
                // Only stroke, no fill - draw lines only
                // Set stroke properties before begin()
                // Use actual color (processed from light-dark format if needed)
                c.setStrokeColor(actualStrokeColor);
                c.setStrokeWidth(strokeWidth);
                c.setStrokeAlpha(Math.max(0, Math.min(1, strokeOpacity)));
                
                c.begin();
                c.moveTo(points[0].x, points[0].y);
                for (var k = 1; k < points.length; k++)
                {
                    c.lineTo(points[k].x, points[k].y);
                }
                c.close();
                c.stroke();
            }
        }
    };

    // Register the shape
    mxCellRenderer.registerShape('isoExtrude', IsoExtrudeShape);
    
    // Override getCellStyle to set default fill color and opacity for 3D extrude shapes
    var originalGetCellStyle = graph.getCellStyle;
    graph.getCellStyle = function(cell, edgeStyle, applyDefaultStyle)
    {
        var style = originalGetCellStyle.apply(this, arguments);
        if (style && style[mxConstants.STYLE_SHAPE] === 'isoExtrude')
        {
            // Set default fill color to blue if not set or is black
            var fillColor = style[mxConstants.STYLE_FILLCOLOR];
            if (!fillColor || fillColor === '#000000' || fillColor === '#000' || 
                fillColor === 'black' || fillColor === 'none' || fillColor === 'transparent' || fillColor === null)
            {
                style[mxConstants.STYLE_FILLCOLOR] = '#1e78b7';
            }
            // Set default opacity to 60% (0.6) for 3D effect if not set
            if (!style['fillOpacity'] || style['fillOpacity'] === null || style['fillOpacity'] === undefined)
            {
                style['fillOpacity'] = '0.6';
            }
        }
        return style;
    };

    // Connection points (center of front face)
    IsoExtrudeShape.prototype.constraints = [
        new mxConnectionConstraint(new mxPoint(0.5, 0.5), false)
    ];

    // --- Right-click menu integration ---
    // Add multilingual support for "Add 3D Effect"
    // Default English translation
    mxResources.parse('add3dEffect=Add 3D Effect');
    
    // Add translations for common languages
    // Get language code (handle both 'zh-cn' and 'zh' formats)
    var lang = mxClient.language || '';
    var langCode = lang.toLowerCase();
    
    // Handle language codes with region (e.g., 'zh-cn', 'zh-tw')
    if (langCode.indexOf('zh') === 0)
    {
        if (langCode.indexOf('tw') >= 0 || langCode.indexOf('hant') >= 0)
        {
            mxResources.parse('add3dEffect=新增3D效果'); // Traditional Chinese
        }
        else
        {
            mxResources.parse('add3dEffect=添加3D效果'); // Simplified Chinese
        }
    }
    else if (langCode.indexOf('de') === 0)
    {
        mxResources.parse('add3dEffect=3D-Effekt hinzufügen');
    }
    else if (langCode.indexOf('fr') === 0)
    {
        mxResources.parse('add3dEffect=Ajouter effet 3D');
    }
    else if (langCode.indexOf('es') === 0)
    {
        mxResources.parse('add3dEffect=Añadir efecto 3D');
    }
    else if (langCode.indexOf('ja') === 0)
    {
        mxResources.parse('add3dEffect=3D効果を追加');
    }
    else if (langCode.indexOf('ko') === 0)
    {
        mxResources.parse('add3dEffect=3D 효과 추가');
    }
    else if (langCode.indexOf('pt') === 0)
    {
        mxResources.parse('add3dEffect=Adicionar efeito 3D');
    }
    else if (langCode.indexOf('ru') === 0)
    {
        mxResources.parse('add3dEffect=Добавить 3D эффект');
    }
    else if (langCode.indexOf('it') === 0)
    {
        mxResources.parse('add3dEffect=Aggiungi effetto 3D');
    }
    else if (langCode.indexOf('nl') === 0)
    {
        mxResources.parse('add3dEffect=3D-effect toevoegen');
    }
    else if (langCode.indexOf('pl') === 0)
    {
        mxResources.parse('add3dEffect=Dodaj efekt 3D');
    }
    else if (langCode.indexOf('sv') === 0)
    {
        mxResources.parse('add3dEffect=Lägg till 3D-effekt');
    }
    else if (langCode.indexOf('tr') === 0)
    {
        mxResources.parse('add3dEffect=3D efekti ekle');
    }
    else if (langCode.indexOf('cs') === 0)
    {
        mxResources.parse('add3dEffect=Přidat 3D efekt');
    }
    else if (langCode.indexOf('da') === 0)
    {
        mxResources.parse('add3dEffect=Tilføj 3D-effekt');
    }
    else if (langCode.indexOf('fi') === 0)
    {
        mxResources.parse('add3dEffect=Lisää 3D-efekti');
    }
    else if (langCode.indexOf('no') === 0)
    {
        mxResources.parse('add3dEffect=Legg til 3D-effekt');
    }
    else if (langCode.indexOf('vi') === 0)
    {
        mxResources.parse('add3dEffect=Thêm hiệu ứng 3D');
    }
    else if (langCode.indexOf('th') === 0)
    {
        mxResources.parse('add3dEffect=เพิ่มเอฟเฟกต์ 3D');
    }
    else if (langCode.indexOf('id') === 0)
    {
        mxResources.parse('add3dEffect=Tambahkan efek 3D');
    }
    else if (langCode.indexOf('hi') === 0)
    {
        mxResources.parse('add3dEffect=3D प्रभाव जोड़ें');
    }
    else if (langCode.indexOf('ar') === 0)
    {
        mxResources.parse('add3dEffect=إضافة تأثير ثلاثي الأبعاد');
    }

    editorUi.actions.addAction('add3dEffect', function()
    {
        var cells = graph.getSelectionCells();
        if (cells.length == 0) return;

        graph.getModel().beginUpdate();
        try
        {
            for (var i = 0; i < cells.length; i++)
            {
                var cell = cells[i];
                if (!isClosedShape(cell)) continue;

                var style = graph.getCurrentCellStyle(cell);
                var w = graph.getModel().getGeometry(cell).width;
                var h = graph.getModel().getGeometry(cell).height;
                var defaultDepth = Math.min(w, h) * 0.5;

                // Get original shape type to preserve for 3D rendering
                var originalShape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);

                // Preserve existing style properties
                var newStyle = 'shape=isoExtrude;';
                newStyle += 'isoZ=' + defaultDepth + ';';
                newStyle += 'isoRx=35;';
                newStyle += 'isoRy=35;';
                newStyle += 'isoRz=0;';
                
                // Save original shape type for outline generation
                if (originalShape) newStyle += 'isoOriginalShape=' + originalShape + ';';
                
                // If original shape is manualPolygon, preserve polyCoords
                if (originalShape === 'manualPolygon' || originalShape === 'polygon')
                {
                    var polyCoords = mxUtils.getValue(style, 'polyCoords', null);
                    if (polyCoords)
                    {
                        newStyle += 'polyCoords=' + polyCoords + ';';
                    }
                }

                // Copy fill color - use default blue if not set or is black
                var fillColor = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, null);
                if (!fillColor || fillColor === 'none' || fillColor === 'transparent' || fillColor === '' ||
                    fillColor === '#000000' || fillColor === '#000' || fillColor.toLowerCase() === 'black')
                {
                    fillColor = '#1e78b7'; // Default blue color
                }
                newStyle += 'fillColor=' + fillColor + ';';

                // Copy stroke properties - default to null (not set) if not explicitly set
                var strokeColor = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null);
                if (strokeColor) newStyle += 'strokeColor=' + strokeColor + ';';
                
                var strokeWidth = mxUtils.getValue(style, mxConstants.STYLE_STROKEWIDTH, null);
                if (strokeWidth != null) newStyle += 'strokeWidth=' + strokeWidth + ';';

                // Set default opacity to 60% (0.6) for 3D effect
                var fillOpacity = mxUtils.getValue(style, mxConstants.STYLE_FILLOPACITY, 60);
                newStyle += 'fillOpacity=' + fillOpacity + ';';

                var strokeOpacity = mxUtils.getValue(style, mxConstants.STYLE_STROKEOPACITY, 100);
                newStyle += 'strokeOpacity=' + strokeOpacity + ';';

                // Copy other relevant properties
                var rounded = mxUtils.getValue(style, mxConstants.STYLE_ROUNDED, 0);
                newStyle += 'rounded=' + rounded + ';';

                graph.setCellStyle(newStyle, [cell]);
                
                // Set rotation and depth as attributes in the cell value (for property panel)
                var cellValue = graph.getModel().getValue(cell);
                if (!mxUtils.isNode(cellValue))
                {
                    var doc = mxUtils.createXmlDocument();
                    var obj = doc.createElement('object');
                    obj.setAttribute('label', cellValue || '');
                    cellValue = obj;
                }
                
                // Always set attributes for property panel (force update)
                cellValue.setAttribute('isoRx', '35');
                cellValue.setAttribute('isoRy', '35');
                cellValue.setAttribute('isoRz', '0');
                cellValue.setAttribute('isoZ', String(defaultDepth));
                
                // Ensure the value is saved (this triggers setValue which will sync attributes)
                // Save immediately to ensure attributes are persisted
                graph.getModel().beginUpdate();
                try
                {
                    graph.getModel().setValue(cell, cellValue);
                }
                finally
                {
                    graph.getModel().endUpdate();
                }
                
                // Double-check: ensure attributes are still there after setValue
                // Some operations might clear attributes, so we set them again
                var verifyValue = graph.getModel().getValue(cell);
                if (mxUtils.isNode(verifyValue))
                {
                    if (!verifyValue.getAttribute('isoRx') || !verifyValue.getAttribute('isoRy') || 
                        !verifyValue.getAttribute('isoRz') || !verifyValue.getAttribute('isoZ'))
                    {
                        verifyValue.setAttribute('isoRx', '35');
                        verifyValue.setAttribute('isoRy', '35');
                        verifyValue.setAttribute('isoRz', '0');
                        verifyValue.setAttribute('isoZ', String(defaultDepth));
                        graph.getModel().setValue(cell, verifyValue);
                    }
                }
                
                // Debug log
                if (window.console && window.console.log)
                {
                    var finalValue = graph.getModel().getValue(cell);
                    console.log('[IsoExtrude] add3dEffect - Set attributes:', {
                        isoRx: finalValue && mxUtils.isNode(finalValue) ? finalValue.getAttribute('isoRx') : 'N/A',
                        isoRy: finalValue && mxUtils.isNode(finalValue) ? finalValue.getAttribute('isoRy') : 'N/A',
                        isoRz: finalValue && mxUtils.isNode(finalValue) ? finalValue.getAttribute('isoRz') : 'N/A',
                        isoZ: finalValue && mxUtils.isNode(finalValue) ? finalValue.getAttribute('isoZ') : 'N/A',
                        isNode: mxUtils.isNode(finalValue),
                        attributesCount: finalValue && finalValue.attributes ? finalValue.attributes.length : 0
                    });
                }
            }
            
            graph.refresh();
        }
        finally
        {
            graph.getModel().endUpdate();
        }
    });
    
    // Set action enabled state
    editorUi.actions.get('add3dEffect').isEnabled = function()
    {
        var cells = graph.getSelectionCells();
        if (cells.length == 0) return false;
        
        for (var i = 0; i < cells.length; i++)
        {
            if (isClosedShape(cells[i])) return true;
        }
        
        return false;
    };
    
    // Add to context menu - use a simple flag to prevent duplicate registration
    if (editorUi.menus && editorUi.menus.addPopupMenuCellItems && !window._isoExtrudeMenuHandlerAdded)
    {
        var addPopupMenuCellItems = editorUi.menus.addPopupMenuCellItems;
        
        editorUi.menus.addPopupMenuCellItems = function(menu, cell, evt)
        {
            addPopupMenuCellItems.apply(this, arguments);
            
            if (cell != null && graph.getSelectionCount() == 1 && graph.getModel().isVertex(cell))
            {
                var style = graph.getCurrentCellStyle(cell);
                var shape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);
                
                // Only show for non-3D shapes and closed shapes
                if (shape != 'isoCube' && shape != 'isoExtrude' && isClosedShape(cell))
                {
                    // Simple check: if action exists and is enabled, menu item should already be there
                    // But we add it anyway since addMenuItem will handle duplicates
                    menu.addSeparator();
                    editorUi.menus.addMenuItem(menu, 'add3dEffect', null, evt);
                }
            }
        };
        
        // Mark as registered
        window._isoExtrudeMenuHandlerAdded = true;
    }

    // --- Sync attributes from property panel to style ---
    // Listen for cell value changes to sync property panel attributes to style
    var originalSetValue = graph.getModel().setValue;
    graph.getModel().setValue = function(cell, value)
    {
        originalSetValue.apply(this, arguments);
        
        // Sync isoRx, isoRy, isoRz, isoZ from attributes to style if cell is isoExtrude
        if (cell && graph.getModel().isVertex(cell))
        {
            var style = graph.getCurrentCellStyle(cell);
            if (style && style[mxConstants.STYLE_SHAPE] === 'isoExtrude')
            {
                if (mxUtils.isNode(value))
                {
                    var isoRx = value.getAttribute('isoRx');
                    var isoRy = value.getAttribute('isoRy');
                    var isoRz = value.getAttribute('isoRz');
                    var isoZ = value.getAttribute('isoZ');
                    
                    graph.getModel().beginUpdate();
                    try
                    {
                        if (isoRx != null) graph.setCellStyles('isoRx', isoRx, [cell]);
                        if (isoRy != null) graph.setCellStyles('isoRy', isoRy, [cell]);
                        if (isoRz != null) graph.setCellStyles('isoRz', isoRz, [cell]);
                        if (isoZ != null) graph.setCellStyles('isoZ', isoZ, [cell]);
                        graph.refresh(cell);
                    }
                    finally
                    {
                        graph.getModel().endUpdate();
                    }
                }
            }
        }
    };
    
    // When loading existing isoExtrude shapes, ensure attributes are set
    graph.addListener(mxEvent.CELLS_ADDED, function(sender, evt)
    {
        var cells = evt.getProperty('cells');
        if (cells)
        {
            for (var i = 0; i < cells.length; i++)
            {
                var cell = cells[i];
                if (graph.getModel().isVertex(cell))
                {
                    var style = graph.getCurrentCellStyle(cell);
                    var shape = style ? style[mxConstants.STYLE_SHAPE] : null;
                    if (shape === 'isoExtrude')
                    {
                        var cellValue = graph.getModel().getValue(cell);
                        if (!mxUtils.isNode(cellValue))
                        {
                            var doc = mxUtils.createXmlDocument();
                            var obj = doc.createElement('object');
                            obj.setAttribute('label', cellValue || '');
                            cellValue = obj;
                            graph.getModel().setValue(cell, cellValue);
                        }
                        
                        // Sync style values to attributes if not already set
                        var isoRx = mxUtils.getValue(style, 'isoRx', 35);
                        var isoRy = mxUtils.getValue(style, 'isoRy', 35);
                        var isoRz = mxUtils.getValue(style, 'isoRz', 0);
                        var isoZ = mxUtils.getValue(style, 'isoZ', 50);
                        
                        // Always set attributes (force update)
                        cellValue.setAttribute('isoRx', String(isoRx));
                        cellValue.setAttribute('isoRy', String(isoRy));
                        cellValue.setAttribute('isoRz', String(isoRz));
                        cellValue.setAttribute('isoZ', String(isoZ));
                        
                        // Save to ensure attributes are persisted
                        graph.getModel().setValue(cell, cellValue);
                    }
                }
            }
        }
    });
    
    // Ensure attributes are set when opening property panel
    // Hook into EditDataDialog constructor to set attributes before dialog reads them
    if (typeof window.EditDataDialog !== 'undefined')
    {
        var OriginalEditDataDialog = window.EditDataDialog;
        window.EditDataDialog = function(ui, cell)
        {
            // Ensure attributes are set BEFORE EditDataDialog reads the value
            if (cell && ui.editor.graph.getModel().isVertex(cell))
            {
                var graph = ui.editor.graph;
                var style = graph.getCurrentCellStyle(cell);
                if (style && style[mxConstants.STYLE_SHAPE] === 'isoExtrude')
                {
                    var cellValue = graph.getModel().getValue(cell);
                    if (!mxUtils.isNode(cellValue))
                    {
                        var doc = mxUtils.createXmlDocument();
                        var obj = doc.createElement('object');
                        obj.setAttribute('label', cellValue || '');
                        cellValue = obj;
                        graph.getModel().setValue(cell, cellValue);
                    }
                    
                    // Sync style values to attributes
                    var isoRx = mxUtils.getValue(style, 'isoRx', 35);
                    var isoRy = mxUtils.getValue(style, 'isoRy', 35);
                    var isoRz = mxUtils.getValue(style, 'isoRz', 0);
                    var isoZ = mxUtils.getValue(style, 'isoZ', 50);
                    
                    // Always set attributes (force update)
                    cellValue.setAttribute('isoRx', String(isoRx));
                    cellValue.setAttribute('isoRy', String(isoRy));
                    cellValue.setAttribute('isoRz', String(isoRz));
                    cellValue.setAttribute('isoZ', String(isoZ));
                    
                    // Save to ensure attributes are persisted
                    graph.getModel().beginUpdate();
                    try
                    {
                        graph.getModel().setValue(cell, cellValue);
                    }
                    finally
                    {
                        graph.getModel().endUpdate();
                    }
                    
                    // Debug log - detailed information
                    if (window.console && window.console.log)
                    {
                        var finalValue = graph.getModel().getValue(cell);
                        var allAttrs = [];
                        if (finalValue && finalValue.attributes)
                        {
                            for (var ai = 0; ai < finalValue.attributes.length; ai++)
                            {
                                var attr = finalValue.attributes[ai];
                                allAttrs.push(attr.name + '=' + attr.value);
                            }
                        }
                        console.log('[IsoExtrude] EditDataDialog hook - Set attributes:', {
                            shape: style[mxConstants.STYLE_SHAPE],
                            isoRx: finalValue && mxUtils.isNode(finalValue) ? finalValue.getAttribute('isoRx') : 'N/A',
                            isoRy: finalValue && mxUtils.isNode(finalValue) ? finalValue.getAttribute('isoRy') : 'N/A',
                            isoRz: finalValue && mxUtils.isNode(finalValue) ? finalValue.getAttribute('isoRz') : 'N/A',
                            isoZ: finalValue && mxUtils.isNode(finalValue) ? finalValue.getAttribute('isoZ') : 'N/A',
                            isNode: mxUtils.isNode(finalValue),
                            attributesCount: finalValue && finalValue.attributes ? finalValue.attributes.length : 0,
                            allAttributes: allAttrs
                        });
                    }
                }
            }
            
            // Call original EditDataDialog constructor
            return new OriginalEditDataDialog(ui, cell);
        };
    }
    
    // Also keep showDataDialog override as backup
    if (editorUi.showDataDialog)
    {
        var originalShowDataDialog = editorUi.showDataDialog;
        editorUi.showDataDialog = function(cell)
        {
            // Ensure attributes are set for isoExtrude shapes before opening property panel
            if (cell && graph.getModel().isVertex(cell))
            {
                var style = graph.getCurrentCellStyle(cell);
                if (style && style[mxConstants.STYLE_SHAPE] === 'isoExtrude')
                {
                    var cellValue = graph.getModel().getValue(cell);
                    if (!mxUtils.isNode(cellValue))
                    {
                        var doc = mxUtils.createXmlDocument();
                        var obj = doc.createElement('object');
                        obj.setAttribute('label', cellValue || '');
                        cellValue = obj;
                        graph.getModel().setValue(cell, cellValue);
                    }
                    
                    // Sync style values to attributes
                    var isoRx = mxUtils.getValue(style, 'isoRx', 35);
                    var isoRy = mxUtils.getValue(style, 'isoRy', 35);
                    var isoRz = mxUtils.getValue(style, 'isoRz', 0);
                    var isoZ = mxUtils.getValue(style, 'isoZ', 50);
                    
                    // Always set attributes (force update)
                    cellValue.setAttribute('isoRx', String(isoRx));
                    cellValue.setAttribute('isoRy', String(isoRy));
                    cellValue.setAttribute('isoRz', String(isoRz));
                    cellValue.setAttribute('isoZ', String(isoZ));
                    
                    // Save to ensure attributes are persisted
                    graph.getModel().setValue(cell, cellValue);
                }
            }
            
            originalShowDataDialog.apply(this, arguments);
        };
    }
    
    // --- Double-click to edit plane (exit 3D mode, edit, then re-apply 3D) ---
    // Store 3D properties temporarily when entering edit mode
    var editingIsoExtrudeCells = {};
    
    // Listen for double-click events
    graph.addListener(mxEvent.DOUBLE_CLICK, function(sender, evt)
    {
        var cell = evt.getProperty('cell');
        if (!cell || !graph.getModel().isVertex(cell)) return;
        
        var style = graph.getCurrentCellStyle(cell);
        var shape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);
        
        // Check if it's an isoExtrude shape
        if (shape === 'isoExtrude')
        {
            // Consume the event to prevent default text editing
            var event = evt.getProperty('event');
            if (event) mxEvent.consume(event);
            
            // Save 3D properties
            var cellId = graph.getModel().getValue(cell);
            var cellIdStr = cellId && mxUtils.isNode(cellId) ? 
                cellId.getAttribute('label') || cell.getId() : cell.getId();
            
            editingIsoExtrudeCells[cell.getId()] = {
                isoRx: mxUtils.getValue(style, 'isoRx', '35'),
                isoRy: mxUtils.getValue(style, 'isoRy', '35'),
                isoRz: mxUtils.getValue(style, 'isoRz', '0'),
                isoZ: mxUtils.getValue(style, 'isoZ', '50'),
                isoOriginalShape: mxUtils.getValue(style, 'isoOriginalShape', null),
                polyCoords: mxUtils.getValue(style, 'polyCoords', null),
                fillColor: mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, null),
                strokeColor: mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null),
                strokeWidth: mxUtils.getValue(style, mxConstants.STYLE_STROKEWIDTH, null),
                fillOpacity: mxUtils.getValue(style, mxConstants.STYLE_FILLOPACITY, null),
                strokeOpacity: mxUtils.getValue(style, mxConstants.STYLE_STROKEOPACITY, null),
                rounded: mxUtils.getValue(style, mxConstants.STYLE_ROUNDED, null),
                // Preserve all other style properties
                originalStyle: graph.getModel().getStyle(cell)
            };
            
            // Restore original shape
            var originalShape = mxUtils.getValue(style, 'isoOriginalShape', null);
            if (!originalShape)
            {
                // If no original shape stored, default to rectangle
                originalShape = null; // null means default rectangle
            }
            
            // Build new style with original shape
            var newStyle = '';
            if (originalShape)
            {
                newStyle += 'shape=' + originalShape + ';';
            }
            
            // Restore polyCoords if present
            if (editingIsoExtrudeCells[cell.getId()].polyCoords)
            {
                newStyle += 'polyCoords=' + editingIsoExtrudeCells[cell.getId()].polyCoords + ';';
            }
            
            // Restore colors and other properties
            if (editingIsoExtrudeCells[cell.getId()].fillColor)
            {
                newStyle += 'fillColor=' + editingIsoExtrudeCells[cell.getId()].fillColor + ';';
            }
            if (editingIsoExtrudeCells[cell.getId()].strokeColor)
            {
                newStyle += 'strokeColor=' + editingIsoExtrudeCells[cell.getId()].strokeColor + ';';
            }
            if (editingIsoExtrudeCells[cell.getId()].strokeWidth)
            {
                newStyle += 'strokeWidth=' + editingIsoExtrudeCells[cell.getId()].strokeWidth + ';';
            }
            if (editingIsoExtrudeCells[cell.getId()].fillOpacity)
            {
                newStyle += 'fillOpacity=' + editingIsoExtrudeCells[cell.getId()].fillOpacity + ';';
            }
            if (editingIsoExtrudeCells[cell.getId()].strokeOpacity)
            {
                newStyle += 'strokeOpacity=' + editingIsoExtrudeCells[cell.getId()].strokeOpacity + ';';
            }
            if (editingIsoExtrudeCells[cell.getId()].rounded != null)
            {
                newStyle += 'rounded=' + editingIsoExtrudeCells[cell.getId()].rounded + ';';
            }
            
            // Apply the new style (restore to 2D)
            graph.getModel().beginUpdate();
            try
            {
                graph.setCellStyle(newStyle, [cell]);
                graph.refresh(cell);
            }
            finally
            {
                graph.getModel().endUpdate();
            }
            
            if (window.console && window.console.log)
            {
                console.log('[IsoExtrude] 进入编辑模式，已保存 3D 属性:', editingIsoExtrudeCells[cell.getId()]);
            }
        }
    });
    
    // Listen for selection changes and editing stop to re-apply 3D effect
    var reapply3DEffect = function(cell)
    {
        if (!cell || !editingIsoExtrudeCells[cell.getId()]) return;
        
        var props = editingIsoExtrudeCells[cell.getId()];
        var style = graph.getCurrentCellStyle(cell);
        var currentShape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);
        
        // Only re-apply if not already isoExtrude
        if (currentShape !== 'isoExtrude')
        {
            // Get current shape as the new original shape
            var newOriginalShape = currentShape || null;
            
            // Build new 3D style
            var newStyle = 'shape=isoExtrude;';
            newStyle += 'isoZ=' + props.isoZ + ';';
            newStyle += 'isoRx=' + props.isoRx + ';';
            newStyle += 'isoRy=' + props.isoRy + ';';
            newStyle += 'isoRz=' + props.isoRz + ';';
            
            // Save current shape as original
            if (newOriginalShape)
            {
                newStyle += 'isoOriginalShape=' + newOriginalShape + ';';
            }
            
            // Preserve polyCoords if current shape is manualPolygon
            if (currentShape === 'manualPolygon' || currentShape === 'polygon')
            {
                var polyCoords = mxUtils.getValue(style, 'polyCoords', null);
                if (polyCoords)
                {
                    newStyle += 'polyCoords=' + polyCoords + ';';
                }
            }
            
            // Preserve current colors and properties
            var fillColor = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, props.fillColor || '#1e78b7');
            newStyle += 'fillColor=' + fillColor + ';';
            
            var strokeColor = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null);
            if (strokeColor) newStyle += 'strokeColor=' + strokeColor + ';';
            
            var strokeWidth = mxUtils.getValue(style, mxConstants.STYLE_STROKEWIDTH, null);
            if (strokeWidth) newStyle += 'strokeWidth=' + strokeWidth + ';';
            
            var fillOpacity = mxUtils.getValue(style, mxConstants.STYLE_FILLOPACITY, 60);
            newStyle += 'fillOpacity=' + fillOpacity + ';';
            
            var strokeOpacity = mxUtils.getValue(style, mxConstants.STYLE_STROKEOPACITY, 100);
            newStyle += 'strokeOpacity=' + strokeOpacity + ';';
            
            var rounded = mxUtils.getValue(style, mxConstants.STYLE_ROUNDED, 0);
            newStyle += 'rounded=' + rounded + ';';
            
            // Apply 3D style
            graph.getModel().beginUpdate();
            try
            {
                graph.setCellStyle(newStyle, [cell]);
                
                // Sync attributes to cell value
                var cellValue = graph.getModel().getValue(cell);
                if (!mxUtils.isNode(cellValue))
                {
                    var doc = mxUtils.createXmlDocument();
                    var obj = doc.createElement('object');
                    obj.setAttribute('label', cellValue || '');
                    cellValue = obj;
                }
                
                cellValue.setAttribute('isoRx', String(props.isoRx));
                cellValue.setAttribute('isoRy', String(props.isoRy));
                cellValue.setAttribute('isoRz', String(props.isoRz));
                cellValue.setAttribute('isoZ', String(props.isoZ));
                graph.getModel().setValue(cell, cellValue);
                
                graph.refresh(cell);
                
                // Remove from editing list
                delete editingIsoExtrudeCells[cell.getId()];
                
                if (window.console && window.console.log)
                {
                    console.log('[IsoExtrude] 退出编辑模式，已重新应用 3D 效果');
                }
            }
            finally
            {
                graph.getModel().endUpdate();
            }
        }
    };
    
    // Track currently editing cell
    var currentEditingCell = null;
    
    // Listen for editing start to track the cell
    var originalStartEditingAtCell = graph.startEditingAtCell;
    graph.startEditingAtCell = function(cell, evt)
    {
        var result = originalStartEditingAtCell.apply(this, arguments);
        if (cell && editingIsoExtrudeCells[cell.getId()])
        {
            currentEditingCell = cell;
        }
        return result;
    };
    
    // Listen for editing stop
    var originalStopEditing = graph.stopEditing;
    graph.stopEditing = function(cancel)
    {
        var wasEditing = currentEditingCell;
        originalStopEditing.apply(this, arguments);
        
        if (wasEditing && editingIsoExtrudeCells[wasEditing.getId()])
        {
            if (!cancel)
            {
                // Text editing completed - re-apply 3D after a short delay
                window.setTimeout(function()
                {
                    if (!graph.isEditing() && editingIsoExtrudeCells[wasEditing.getId()])
                    {
                        reapply3DEffect(wasEditing);
                    }
                }, 50);
            }
            currentEditingCell = null;
        }
    };
    
    // Listen for ESC key to exit edit mode
    graph.addListener(mxEvent.ESCAPE, function(sender, evt)
    {
        // Check if any cells are in editing mode
        var cellsToReapply = [];
        for (var cellId in editingIsoExtrudeCells)
        {
            var cell = graph.getModel().getCell(cellId);
            if (cell)
            {
                cellsToReapply.push(cell);
            }
        }
        
        // Re-apply 3D for all editing cells
        for (var i = 0; i < cellsToReapply.length; i++)
        {
            reapply3DEffect(cellsToReapply[i]);
        }
        
        currentEditingCell = null;
    });
    
    // Listen for selection changes more directly
    var selectionModel = graph.getSelectionModel();
    if (selectionModel)
    {
        var previousSelection = [];
        
        selectionModel.addListener(mxEvent.CHANGE, function(sender, evt)
        {
            var currentSelection = selectionModel.cells || [];
            
            // Check cells that were previously selected but are not now
            for (var i = 0; i < previousSelection.length; i++)
            {
                var prevCell = previousSelection[i];
                var stillSelected = false;
                
                for (var j = 0; j < currentSelection.length; j++)
                {
                    if (currentSelection[j] == prevCell)
                    {
                        stillSelected = true;
                        break;
                    }
                }
                
                // Cell was deselected and was in editing mode
                if (!stillSelected && prevCell && editingIsoExtrudeCells[prevCell.getId()])
                {
                    // Stop editing if currently editing this cell
                    if (graph.isEditing() && currentEditingCell == prevCell)
                    {
                        graph.stopEditing(true);
                    }
                    
                    // Re-apply 3D effect
                    window.setTimeout(function(cell)
                    {
                        if (editingIsoExtrudeCells[cell.getId()])
                        {
                            reapply3DEffect(cell);
                        }
                    }, 50, prevCell);
                }
            }
            
            // Update previous selection
            previousSelection = currentSelection.slice();
        });
    }
    
    // Also listen for label changes (text editing completion)
    graph.addListener(mxEvent.LABEL_CHANGED, function(sender, evt)
    {
        var cell = evt.getProperty('cell');
        if (cell && editingIsoExtrudeCells[cell.getId()])
        {
            // Label changed - re-apply 3D after a short delay
            window.setTimeout(function()
            {
                if (!graph.isEditing() && editingIsoExtrudeCells[cell.getId()])
                {
                    reapply3DEffect(cell);
                }
            }, 100);
        }
    });
    
    // Listen for clicks on background or other cells
    var originalClick = graph.click;
    graph.click = function(me)
    {
        originalClick.apply(this, arguments);
        
        // Check if clicked on something else
        var clickedCell = me.getCell();
        var selectedCell = graph.getSelectionCell();
        
        // If we clicked on background or a different cell
        if ((clickedCell == null || clickedCell != selectedCell) && selectedCell)
        {
            // Check if the selected cell was in editing mode
            if (selectedCell && editingIsoExtrudeCells[selectedCell.getId()])
            {
                // Stop editing if currently editing
                if (graph.isEditing() && currentEditingCell == selectedCell)
                {
                    graph.stopEditing(true);
                }
                
                // Re-apply 3D effect
                window.setTimeout(function()
                {
                    if (editingIsoExtrudeCells[selectedCell.getId()])
                    {
                        reapply3DEffect(selectedCell);
                    }
                }, 50);
            }
        }
    };
    
    // Add 3D properties section to Style format panel for isoExtrude shapes
    if (typeof StyleFormatPanel !== 'undefined')
    {
        var originalStyleInit = StyleFormatPanel.prototype.init;
        StyleFormatPanel.prototype.init = function()
        {
            // Call original init
            originalStyleInit.apply(this, arguments);
            
            // Add 3D properties section for isoExtrude shapes
            var ui = this.editorUi;
            var graph = ui.editor.graph;
            var ss = ui.getSelectionState();
            
            if (ss.cells.length === 1 && ss.vertices.length === 1)
            {
                var cell = ss.cells[0];
                var style = graph.getCurrentCellStyle(cell);
                
                if (style && style[mxConstants.STYLE_SHAPE] === 'isoExtrude')
                {
                    var propsPanel = this.createPanel();
                    
                    // Create title for properties section
                    var title = this.createTitle(mxResources.get('properties') || '属性');
                    propsPanel.appendChild(title);
                    
                    // Helper function to add a property row
                    var addPropertyRow = mxUtils.bind(this, function(labelText, key, defaultValue, min, max, step)
                    {
                        var row = document.createElement('div');
                        row.className = 'geFormatEntry';
                        row.style.display = 'flex';
                        row.style.alignItems = 'center';
                        row.style.gap = '8px';
                        row.style.padding = '4px 0';
                        
                        var label = document.createElement('label');
                        label.style.minWidth = '80px';
                        label.style.flex = '0 0 auto';
                        mxUtils.write(label, labelText);
                        row.appendChild(label);
                        
                        var input = document.createElement('input');
                        input.type = 'number';
                        input.style.flex = '1 1 auto';
                        input.style.width = '100px';
                        if (min != null) input.min = String(min);
                        if (max != null) input.max = String(max);
                        input.step = String(step != null ? step : 1);
                        
                        // Get current value from style
                        var currentValue = mxUtils.getValue(style, key, defaultValue);
                        input.value = String(currentValue);
                        
                        // Update handler
                        var updateHandler = mxUtils.bind(this, function()
                        {
                            var newValue = parseInt(input.value) || defaultValue;
                            if (newValue !== currentValue)
                            {
                                graph.getModel().beginUpdate();
                                try
                                {
                                    graph.setCellStyles(key, String(newValue), [cell]);
                                    
                                    // Sync to cell value attributes
                                    var cellValue = graph.getModel().getValue(cell);
                                    if (mxUtils.isNode(cellValue))
                                    {
                                        cellValue.setAttribute(key, String(newValue));
                                        graph.getModel().setValue(cell, cellValue);
                                    }
                                    
                                    graph.refresh(cell);
                                    currentValue = newValue;
                                }
                                finally
                                {
                                    graph.getModel().endUpdate();
                                }
                            }
                        });
                        
                        mxEvent.addListener(input, 'change', updateHandler);
                        mxEvent.addListener(input, 'blur', updateHandler);
                        
                        // Add mouse wheel support for increment/decrement
                        mxEvent.addListener(input, 'wheel', function(evt)
                        {
                            var delta = evt.deltaY || -evt.wheelDelta || 0;
                            var increment = (evt.shiftKey || evt.ctrlKey) ? (step * 10) : step;
                            
                            if (delta < 0)
                            {
                                // Scroll up - increase value
                                var newValue = Math.min(max, parseInt(input.value) + increment);
                                input.value = String(newValue);
                                updateHandler();
                            }
                            else if (delta > 0)
                            {
                                // Scroll down - decrease value
                                var newValue = Math.max(min, parseInt(input.value) - increment);
                                input.value = String(newValue);
                                updateHandler();
                            }
                            
                            evt.preventDefault();
                            mxEvent.consume(evt);
                        });
                        
                        // Also handle mouseenter to focus when hovering (optional enhancement)
                        mxEvent.addListener(row, 'mouseenter', function()
                        {
                            // Auto-focus on hover for easier wheel adjustment
                            if (document.activeElement !== input && !input.disabled)
                            {
                                input.focus();
                            }
                        });
                        
                        row.appendChild(input);
                        propsPanel.appendChild(row);
                    });
                    
                    // Add property rows with Chinese labels
                    var propertyTranslations = {
                        'isoRx': mxResources.get('rotationX') || '旋转X',
                        'isoRy': mxResources.get('rotationY') || '旋转Y',
                        'isoRz': mxResources.get('rotationZ') || '旋转Z',
                        'isoZ': mxResources.get('depth') || '深度'
                    };
                    
                    addPropertyRow(propertyTranslations['isoRx'] || '旋转X', 'isoRx', 35, -180, 180, 1);
                    addPropertyRow(propertyTranslations['isoRy'] || '旋转Y', 'isoRy', 35, -180, 180, 1);
                    addPropertyRow(propertyTranslations['isoRz'] || '旋转Z', 'isoRz', 0, -180, 180, 1);
                    addPropertyRow(propertyTranslations['isoZ'] || '深度', 'isoZ', 50, 0, 2000, 1);
                    
                    // Insert after effects section (before opsPanel)
                    if (propsPanel.firstChild)
                    {
                        this.container.insertBefore(propsPanel, this.container.lastChild);
                    }
                }
            }
        };
    }
    
    // --- Inject properties into right-side Format panel for isoExtrude ---
    function renderIsoExtrudeFormatPanel()
    {
        var fmt = editorUi.format;
        if (!fmt || !fmt.container) return;
        // Remove previous panel
        var old = document.getElementById('isoExtrude-format-panel');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        var cell = graph.getSelectionCell();
        var style = (cell != null) ? graph.getCurrentCellStyle(cell) : null;
        var shapeType = (style != null) ? style['shape'] : null;
        if (!style || shapeType !== 'isoExtrude') return;

        var panel = document.createElement('div');
        panel.id = 'isoExtrude-format-panel';
        panel.className = 'geStyleOptions';
        panel.style.padding = '8px 12px';
        panel.style.borderTop = '1px solid var(--gePrimaryBorderColor, #e0e0e0)';

        // Insert panel at the bottom
        fmt.container.appendChild(panel);

        function addNumber(labelText, key, min, max, step)
        {
            var row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '6px';
            row.style.margin = '6px 0';
            var label = document.createElement('label');
            label.style.flex = '0 0 64px';
            mxUtils.write(label, labelText);
            var input = document.createElement('input');
            input.type = 'number';
            input.style.flex = '1 1 auto';
            if (min != null) input.min = String(min);
            if (max != null) input.max = String(max);
            input.step = String(step != null ? step : 1);
            input.value = mxUtils.getValue(style, key, key === 'isoZ' ? 100 : (key === 'isoRz' ? 0 : 35));

            var updateHandler = function()
            {
                var cur = graph.getSelectionCell();
                var curStyle = (cur != null) ? graph.getCurrentCellStyle(cur) : null;
                var curShape = (curStyle != null) ? curStyle['shape'] : null;
                if (cur && graph.getModel().isVertex(cur) && curShape === 'isoExtrude')
                {
                    graph.getModel().beginUpdate();
                    try
                    {
                        graph.setCellStyles(key, input.value, [cur]);
                        graph.refresh(cur);
                    }
                    finally
                    {
                        graph.getModel().endUpdate();
                    }
                }
            };

            mxEvent.addListener(input, 'change', updateHandler);
            mxEvent.addListener(input, 'blur', updateHandler);
            
            // Add mouse wheel support
            mxEvent.addListener(input, 'wheel', function(evt)
            {
                var delta = evt.deltaY || -evt.wheelDelta || 0;
                var increment = (evt.shiftKey || evt.ctrlKey) ? (step * 10) : step;
                
                if (delta < 0)
                {
                    var newValue = Math.min(max, parseInt(input.value) + increment);
                    input.value = String(newValue);
                    updateHandler();
                }
                else if (delta > 0)
                {
                    var newValue = Math.max(min, parseInt(input.value) - increment);
                    input.value = String(newValue);
                    updateHandler();
                }
                
                evt.preventDefault();
                mxEvent.consume(evt);
            });
            
            mxEvent.addListener(row, 'mouseenter', function()
            {
                if (document.activeElement !== input && !input.disabled)
                {
                    input.focus();
                }
            });

            row.appendChild(label);
            row.appendChild(input);
            panel.appendChild(row);
        }

        addNumber('Rot X', 'isoRx', -180, 180, 1);
        addNumber('Rot Y', 'isoRy', -180, 180, 1);
        addNumber('Rot Z', 'isoRz', -180, 180, 1);
        addNumber('Depth', 'isoZ', 0, 2000, 1);
        
        // Add 3D Bevel controls (for isoExtrude)
        // Add separator
        var separator = document.createElement('div');
        separator.style.height = '1px';
        separator.style.backgroundColor = 'var(--gePrimaryBorderColor, #e0e0e0)';
        separator.style.margin = '12px 0';
        panel.appendChild(separator);
        
        // Title: 三维格式
        var titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'center';
        titleRow.style.margin = '8px 0 4px 0';
        titleRow.style.fontWeight = '600';
        titleRow.style.fontSize = '12px';
        titleRow.style.color = 'var(--geTextColor, #333)';
        mxUtils.write(titleRow, '三维格式');
        panel.appendChild(titleRow);
        
        // Top Bevel Section
        var topBevelSection = document.createElement('div');
        topBevelSection.style.margin = '8px 0';
        
        var topBevelTitle = document.createElement('div');
        topBevelTitle.style.display = 'flex';
        topBevelTitle.style.alignItems = 'center';
        topBevelTitle.style.marginBottom = '6px';
        topBevelTitle.style.fontSize = '11px';
        topBevelTitle.style.color = 'var(--geTextColor, #666)';
        mxUtils.write(topBevelTitle, '顶部棱台');
        topBevelSection.appendChild(topBevelTitle);
        
        // Top Bevel Type selector
        var topBevelTypeRow = document.createElement('div');
        topBevelTypeRow.style.display = 'flex';
        topBevelTypeRow.style.alignItems = 'center';
        topBevelTypeRow.style.gap = '6px';
        topBevelTypeRow.style.margin = '4px 0';
        var topBevelTypeLabel = document.createElement('label');
        topBevelTypeLabel.style.flex = '0 0 64px';
        topBevelTypeLabel.style.fontSize = '11px';
        mxUtils.write(topBevelTypeLabel, '类型');
        var topBevelTypeSelect = document.createElement('select');
        topBevelTypeSelect.style.flex = '1 1 auto';
        topBevelTypeSelect.style.padding = '4px';
        topBevelTypeSelect.style.fontSize = '11px';
        topBevelTypeSelect.innerHTML = '<option value="none">无</option><option value="circle">圆角</option>';
        topBevelTypeSelect.value = mxUtils.getValue(style, 'topBevelType', 'none');
        topBevelTypeRow.appendChild(topBevelTypeLabel);
        topBevelTypeRow.appendChild(topBevelTypeSelect);
        topBevelSection.appendChild(topBevelTypeRow);
        
        function addBevelNumber(section, labelText, key, min, max, step, defaultValue)
        {
            var row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '6px';
            row.style.margin = '4px 0';
            var label = document.createElement('label');
            label.style.flex = '0 0 64px';
            label.style.fontSize = '11px';
            mxUtils.write(label, labelText);
            var input = document.createElement('input');
            input.type = 'number';
            input.style.flex = '1 1 auto';
            input.style.padding = '4px';
            input.style.fontSize = '11px';
            if (min != null) input.min = String(min);
            if (max != null) input.max = String(max);
            input.step = String(step != null ? step : 1);
            input.value = mxUtils.getValue(style, key, defaultValue);
            
            var updateHandler = function()
            {
                var cur = graph.getSelectionCell();
                var curStyle = (cur != null) ? graph.getCurrentCellStyle(cur) : null;
                var curShape = (curStyle != null) ? curStyle['shape'] : null;
                if (cur && graph.getModel().isVertex(cur) && curShape === 'isoExtrude')
                {
                    graph.getModel().beginUpdate();
                    try
                    {
                        graph.setCellStyles(key, input.value, [cur]);
                        graph.refresh(cur);
                    }
                    finally
                    {
                        graph.getModel().endUpdate();
                    }
                }
            };
            
            mxEvent.addListener(input, 'change', updateHandler);
            mxEvent.addListener(input, 'blur', updateHandler);
            
            mxEvent.addListener(input, 'wheel', function(evt)
            {
                var delta = evt.deltaY || -evt.wheelDelta || 0;
                var increment = (evt.shiftKey || evt.ctrlKey) ? (step * 10) : step;
                
                if (delta < 0)
                {
                    var newValue = Math.min(max, parseFloat(input.value) + increment);
                    input.value = String(newValue);
                    updateHandler();
                }
                else if (delta > 0)
                {
                    var newValue = Math.max(min, parseFloat(input.value) - increment);
                    input.value = String(newValue);
                    updateHandler();
                }
                
                evt.preventDefault();
                mxEvent.consume(evt);
            });
            
            mxEvent.addListener(row, 'mouseenter', function()
            {
                if (document.activeElement !== input && !input.disabled)
                {
                    input.focus();
                }
            });
            
            row.appendChild(label);
            row.appendChild(input);
            section.appendChild(row);
        }
        
        addBevelNumber(topBevelSection, '宽度', 'topBevelWidth', 0, 1000, 1, 0);
        addBevelNumber(topBevelSection, '高度', 'topBevelHeight', 0, 1000, 1, 0);
        
        // Top Bevel Type change handler
        mxEvent.addListener(topBevelTypeSelect, 'change', function()
        {
            var cur = graph.getSelectionCell();
            var curStyle = (cur != null) ? graph.getCurrentCellStyle(cur) : null;
            var curShape = (curStyle != null) ? curStyle['shape'] : null;
            if (cur && graph.getModel().isVertex(cur) && curShape === 'isoExtrude')
            {
                graph.getModel().beginUpdate();
                try
                {
                    graph.setCellStyles('topBevelType', topBevelTypeSelect.value, [cur]);
                    graph.refresh(cur);
                }
                finally
                {
                    graph.getModel().endUpdate();
                }
            }
        });
        
        panel.appendChild(topBevelSection);
        
        // Bottom Bevel Section
        var bottomBevelSection = document.createElement('div');
        bottomBevelSection.style.margin = '12px 0 8px 0';
        
        var bottomBevelTitle = document.createElement('div');
        bottomBevelTitle.style.display = 'flex';
        bottomBevelTitle.style.alignItems = 'center';
        bottomBevelTitle.style.marginBottom = '6px';
        bottomBevelTitle.style.fontSize = '11px';
        bottomBevelTitle.style.color = 'var(--geTextColor, #666)';
        mxUtils.write(bottomBevelTitle, '底部棱台');
        bottomBevelSection.appendChild(bottomBevelTitle);
        
        // Bottom Bevel Type selector
        var bottomBevelTypeRow = document.createElement('div');
        bottomBevelTypeRow.style.display = 'flex';
        bottomBevelTypeRow.style.alignItems = 'center';
        bottomBevelTypeRow.style.gap = '6px';
        bottomBevelTypeRow.style.margin = '4px 0';
        var bottomBevelTypeLabel = document.createElement('label');
        bottomBevelTypeLabel.style.flex = '0 0 64px';
        bottomBevelTypeLabel.style.fontSize = '11px';
        mxUtils.write(bottomBevelTypeLabel, '类型');
        var bottomBevelTypeSelect = document.createElement('select');
        bottomBevelTypeSelect.style.flex = '1 1 auto';
        bottomBevelTypeSelect.style.padding = '4px';
        bottomBevelTypeSelect.style.fontSize = '11px';
        bottomBevelTypeSelect.innerHTML = '<option value="none">无</option><option value="circle">圆角</option>';
        bottomBevelTypeSelect.value = mxUtils.getValue(style, 'bottomBevelType', 'none');
        bottomBevelTypeRow.appendChild(bottomBevelTypeLabel);
        bottomBevelTypeRow.appendChild(bottomBevelTypeSelect);
        bottomBevelSection.appendChild(bottomBevelTypeRow);
        
        addBevelNumber(bottomBevelSection, '宽度', 'bottomBevelWidth', 0, 1000, 1, 0);
        addBevelNumber(bottomBevelSection, '高度', 'bottomBevelHeight', 0, 1000, 1, 0);
        
        // Bottom Bevel Type change handler
        mxEvent.addListener(bottomBevelTypeSelect, 'change', function()
        {
            var cur = graph.getSelectionCell();
            var curStyle = (cur != null) ? graph.getCurrentCellStyle(cur) : null;
            var curShape = (curStyle != null) ? curStyle['shape'] : null;
            if (cur && graph.getModel().isVertex(cur) && curShape === 'isoExtrude')
            {
                graph.getModel().beginUpdate();
                try
                {
                    graph.setCellStyles('bottomBevelType', bottomBevelTypeSelect.value, [cur]);
                    graph.refresh(cur);
                }
                finally
                {
                    graph.getModel().endUpdate();
                }
            }
        });
        
        panel.appendChild(bottomBevelSection);
    }

    var scheduleRender = mxUtils.bind(this, function()
    {
        // Defer slightly to let core format panel rebuild first
        window.setTimeout(renderIsoExtrudeFormatPanel, 0);
    });

    if (editorUi.format && editorUi.format.addListener)
    {
        editorUi.format.addListener('refresh', scheduleRender);
    }
    graph.getSelectionModel().addListener(mxEvent.CHANGE, scheduleRender);
    graph.getModel().addListener(mxEvent.CHANGE, scheduleRender);
});

