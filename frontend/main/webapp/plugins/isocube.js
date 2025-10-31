/**
 * Isometric Cube plugin (pseudo-3D using 2D drawing)
 * Adds shape "isoCube" and a simple UI to adjust isoRx, isoRy, isoRz, isoZ.
 */
Draw.loadPlugin(function(editorUi)
{
    var graph = editorUi.editor.graph;

    // --- Shared utility function for setting stroke properties ---
    // This function is used by both isoCube and isoExtrude to ensure consistent stroke handling
    window.setup3DShapeStroke = function(c, style, defaultStrokewidth, baseFill)
    {
        // Helper function to check if color is "none"
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

        // Get stroke color from style
        var strokeColor = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null);
        
        // Check if strokeColor is explicitly set to mxConstants.NONE (when user disables line)
        // mxConstants.NONE is typically 'none' but could be null or empty
        var strokeColorNone = false;
        if (strokeColor == null || strokeColor === '' || strokeColor === 'none' || 
            strokeColor === mxConstants.NONE || strokeColor === 'transparent')
        {
            strokeColorNone = true;
        }
        else
        {
            strokeColorNone = isNoneColor(strokeColor);
        }
        
        // If strokeColor is not set, default to 'none' (line disabled by default for isoCube)
        // But for isoExtrude, we may want to use fillColor as default - handled by caller
        if (strokeColor == null || strokeColor === '')
        {
            strokeColor = 'none';
            strokeColorNone = true;
        }
        
        // Check strokeWidth
        var strokeWidthRaw = mxUtils.getValue(style, mxConstants.STYLE_STROKEWIDTH, null);
        var strokeWidth = parseFloat(strokeWidthRaw);
        // Default strokeWidth if not set or invalid
        if (strokeWidthRaw == null || strokeWidthRaw === '' || isNaN(strokeWidth))
        {
            strokeWidth = strokeColorNone ? 0 : (defaultStrokewidth || 1);
        }
        
        // Get stroke opacity
        var strokeOpacity = parseFloat(mxUtils.getValue(style, 'strokeOpacity', 1));
        
        // If strokeColor is none, force strokeWidth and strokeOpacity to 0
        if (strokeColorNone)
        {
            strokeWidth = 0;
            strokeOpacity = 0;
        }
        else
        {
            if (isNaN(strokeOpacity)) strokeOpacity = 1;
            if (strokeOpacity > 1) strokeOpacity = strokeOpacity / 100; // accept 0..100 style values
        }
        
        // Calculate if stroke is enabled
        var strokeEnabled = !strokeColorNone && strokeOpacity > 0 && strokeWidth > 0;
        
        // Set stroke properties on canvas
        if (strokeEnabled)
        {
            c.setStrokeColor(strokeColor);
            c.setStrokeWidth(strokeWidth);
            c.setStrokeAlpha(Math.max(0, Math.min(1, strokeOpacity)));
        }
        
        // Debug: Print stroke setup details
        if (window.console && window.console.log)
        {
            console.log('[setup3DShapeStroke] Stroke setup result:', {
                strokeColor: strokeColor,
                strokeColorNone: strokeColorNone,
                strokeWidth: strokeWidth,
                strokeOpacity: strokeOpacity,
                strokeEnabled: strokeEnabled,
                defaultStrokewidth: defaultStrokewidth,
                styleStrokeColor: mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null),
                styleStrokeWidth: mxUtils.getValue(style, mxConstants.STYLE_STROKEWIDTH, null),
                styleStrokeOpacity: mxUtils.getValue(style, 'strokeOpacity', null),
                mxConstantsNONE: mxConstants.NONE,
                isEqualToNONE: (strokeColor === mxConstants.NONE || 
                               mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null) === mxConstants.NONE)
            });
        }
        
        // Return stroke info object
        return {
            strokeColor: strokeColor,
            strokeWidth: strokeWidth,
            strokeOpacity: strokeOpacity,
            strokeEnabled: strokeEnabled
        };
    };

    // --- Shape registration ---
    function IsoCubeShape(bounds, fill, stroke, strokewidth)
    {
        mxShape.call(this);
        this.bounds = bounds;
        this.fill = fill;
        this.stroke = stroke;
        this.strokewidth = (strokewidth != null) ? strokewidth : 1;
    };

    mxUtils.extend(IsoCubeShape, mxShape);

    IsoCubeShape.prototype.paintVertexShape = function(c, x, y, w, h)
    {
        var style = this.style || {};
        var d = parseFloat(mxUtils.getValue(style, 'isoZ', Math.min(w, h) * 0.6));
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
            // Apply rotations in X->Y->Z order (3D)
            return rotZ(rotY(rotX(p)));
        };

        function project(p)
        {
            // Orthographic projection to 2D (keeps z for depth tests)
            return {x: cx + p.x, y: cy + p.y, z: p.z};
        };

        // 8 base vertices in a fixed, well-known order:
        // 0(-,-,-) 1(+,-,-) 2(-,+,-) 3(+,+,-) 4(-,-,+) 5(+,-,+) 6(-,+,+) 7(+,+,+)
        var v3 = [
            {x:-sx, y:-sy, z:-sz},
            {x: sx, y:-sy, z:-sz},
            {x:-sx, y: sy, z:-sz},
            {x: sx, y: sy, z:-sz},
            {x:-sx, y:-sy, z: sz},
            {x: sx, y:-sy, z: sz},
            {x:-sx, y: sy, z: sz},
            {x: sx, y: sy, z: sz}
        ];
        
        // Calculate bevel vertices
        // Top bevel indices: 8, 9, 10, 11 (if enabled, for simple bevel)
        // For rounded bevel, we need more vertices
        var topBevelStartIdx = 8;
        var topBevelSideStartIdx = 12; // Side vertices start after bevel top face vertices
        var bottomBevelStartIdx = 12; // Will be adjusted if top bevel exists
        var sideVertexPairs = []; // Store vertex pairs for rounded bevel sides (top)
        var bottomSideVertexPairs = []; // Store vertex pairs for rounded bevel sides (bottom)
        if (hasTopBevel && topBevelType === 'circle')
        {
            // Calculate scale factor for top bevel (shrink inward)
            var maxDim = Math.min(w, h);
            var scale = Math.max(0.1, 1 - (topBevelWidth / maxDim));
            var topBevelY = sy + topBevelHeight;
            
            // Number of segments per edge for smooth rounded corners
            // Increased for smoother curves, especially near corners
            var numSegments = 16; // Increased from 12 for even smoother curves
            
            // Original top face corners
            var origCorners = [
                {x: -sx, y: sy, z: -sz},   // 2: top-left-back
                {x: sx, y: sy, z: -sz},     // 3: top-right-back
                {x: sx, y: sy, z: sz},      // 7: top-right-front
                {x: -sx, y: sy, z: sz}      // 6: top-left-front
            ];
            
            // Bevel top face corners (contracted)
            var bevelCorners = [
                {x: -sx * scale, y: topBevelY, z: -sz * scale},
                {x: sx * scale, y: topBevelY, z: -sz * scale},
                {x: sx * scale, y: topBevelY, z: sz * scale},
                {x: -sx * scale, y: topBevelY, z: sz * scale}
            ];
            
            // Add bevel top face corners first
            for (var i = 0; i < bevelCorners.length; i++)
            {
                v3.push(bevelCorners[i]);
            }
            
            // Now create rounded side vertices along each edge
            // Each edge will have numSegments intermediate vertices
            var edges = [
                [0, 1], // back: 2->3
                [1, 2], // right: 3->7
                [2, 3], // front: 7->6
                [3, 0]  // left: 6->2
            ];
            
            // Create vertices for rounded edges
            sideVertexPairs.length = 0; // Clear array
            for (var e = 0; e < edges.length; e++)
            {
                var edge = edges[e];
                var startOrig = origCorners[edge[0]];
                var endOrig = origCorners[edge[1]];
                var startBevel = bevelCorners[edge[0]];
                var endBevel = bevelCorners[edge[1]];
                
                // Create intermediate vertices along this edge with rounded Y transition
                for (var s = 0; s <= numSegments; s++)
                {
                    var t = s / numSegments; // 0 to 1 along the edge
                    
                    // Interpolate X and Z along the edge (linear)
                    var origX = startOrig.x + (endOrig.x - startOrig.x) * t;
                    var origZ = startOrig.z + (endOrig.z - startOrig.z) * t;
                    var origY = startOrig.y; // Original Y position
                    
                    var bevelX = startBevel.x + (endBevel.x - startBevel.x) * t;
                    var bevelZ = startBevel.z + (endBevel.z - startBevel.z) * t;
                    var bevelY = startBevel.y; // Bevel Y position
                    
                    // Create vertices along the arc transition (in Y direction)
                    // Use smooth interpolation for gradual transition without sudden changes
                    // Increase density near corners for smoother appearance
                    var numArcPoints = 12; // Increased from 8 for even smoother arc, especially near corners
                    var arcVertices = [];
                    
                    for (var a = 0; a <= numArcPoints; a++)
                    {
                        var arcT = a / numArcPoints; // 0 to 1 along the arc
                        
                        // Interpolate X and Z linearly from original to bevel
                        var midX = origX + (bevelX - origX) * arcT;
                        var midZ = origZ + (bevelZ - origZ) * arcT;
                        
                        // Interpolate Y using smooth convex arc interpolation
                        // Use circular arc (sin function) for smooth, convex, continuous transition
                        // This creates a bulging outward effect with smooth continuation
                        var easedT;
                        // Use sin function for true circular arc: starts slow, bulges in middle, ends smooth
                        // sin(arcT * π/2) creates a convex arc from 0 to 1
                        // This ensures smooth continuation on the sides without sudden changes
                        easedT = Math.sin(arcT * Math.PI / 2);
                        
                        // Apply the circular arc interpolation for smooth, convex transition
                        // This creates a bulging, convex curve with smooth side continuation
                        var arcY = origY + (bevelY - origY) * easedT;
                        
                        var vertexIdx = v3.length;
                        v3.push({x: midX, y: arcY, z: midZ});
                        arcVertices.push(vertexIdx);
                    }
                    
                    // Store vertex pairs for face generation
                    // Each segment along the edge connects to the next segment
                    if (s === 0)
                    {
                        // First segment: store all arc vertices
                        sideVertexPairs.push({
                            edgeIdx: e,
                            segIdx: s,
                            arcVertices: arcVertices.slice()
                        });
                    }
                    else
                    {
                        // Subsequent segments: store and connect to previous
                        sideVertexPairs.push({
                            edgeIdx: e,
                            segIdx: s,
                            arcVertices: arcVertices.slice()
                        });
                    }
                }
            }
            
            // Store for later use in face generation
            topBevelSideStartIdx = topBevelStartIdx + 4; // After 4 bevel corners
        }
        else if (hasTopBevel)
        {
            // Non-circle bevel: simple version (keep existing logic)
            var maxDim = Math.min(w, h);
            var scale = Math.max(0.1, 1 - (topBevelWidth / maxDim));
            var topBevelY = sy + topBevelHeight;
            v3.push(
                {x: -sx * scale, y: topBevelY, z: -sz * scale},
                {x: sx * scale, y: topBevelY, z: -sz * scale},
                {x: sx * scale, y: topBevelY, z: sz * scale},
                {x: -sx * scale, y: topBevelY, z: sz * scale}
            );
        }
        
        // Bottom bevel: add vertices for rounded bevel (similar to top bevel)
        // Original bottom face vertices: 0(-,-,-), 1(+,-,-), 5(+,-,+), 4(-,-,+)
        // Bottom face CCW order: 0, 1, 5, 4 (looking from -Y)
        // Original vertices:
        //   0: (-sx, -sy, -sz) - bottom-left-back
        //   1: (sx, -sy, -sz)  - bottom-right-back
        //   5: (sx, -sy, sz)   - bottom-right-front
        //   4: (-sx, -sy, sz)  - bottom-left-front
        
        // Calculate bottom bevel start index (adjust based on top bevel)
        if (hasTopBevel)
        {
            if (topBevelType === 'circle')
            {
                // Top bevel has many vertices, calculate bottom start index
                var topBevelVertexCount = 4 + (16 + 1) * 4 * (12 + 1); // corners + edges * segments * arc points
                bottomBevelStartIdx = topBevelStartIdx + topBevelVertexCount;
            }
            else
            {
                bottomBevelStartIdx = topBevelStartIdx + 4; // Simple top bevel has 4 vertices
            }
        }
        else
        {
            bottomBevelStartIdx = 8; // Start after base 8 vertices
        }
        
        if (hasBottomBevel && bottomBevelType === 'circle')
        {
            // Calculate scale factor for bottom bevel (shrink inward)
            var maxDim = Math.min(w, h);
            var scale = Math.max(0.1, 1 - (bottomBevelWidth / maxDim));
            
            // Lower in Y direction (downward) by bottomBevelHeight
            var bottomBevelY = -sy - bottomBevelHeight;
            
            // Number of segments per edge for smooth rounded corners
            var numSegments = 16; // Same as top bevel
            
            // Original bottom face corners
            var origBottomCorners = [
                {x: -sx, y: -sy, z: -sz},   // 0: bottom-left-back
                {x: sx, y: -sy, z: -sz},     // 1: bottom-right-back
                {x: sx, y: -sy, z: sz},      // 5: bottom-right-front
                {x: -sx, y: -sy, z: sz}      // 4: bottom-left-front
            ];
            
            // Bevel bottom face corners (contracted and lowered)
            // Order: 0, 1, 5, 4 (matching original bottom face order)
            var bevelBottomCorners = [
                {x: -sx * scale, y: bottomBevelY, z: -sz * scale},  // bottom-left-back
                {x: sx * scale, y: bottomBevelY, z: -sz * scale},   // bottom-right-back
                {x: sx * scale, y: bottomBevelY, z: sz * scale},    // bottom-right-front
                {x: -sx * scale, y: bottomBevelY, z: sz * scale}    // bottom-left-front
            ];
            
            // Add bevel bottom face corners first
            for (var i = 0; i < bevelBottomCorners.length; i++)
            {
                v3.push(bevelBottomCorners[i]);
            }
            
            // Now create rounded side vertices along each edge
            // Bottom face edges in CCW order (looking from -Y): 0->1->5->4
            var bottomEdges = [
                [0, 1], // back: 0->1
                [1, 2], // right: 1->5 (index 2 in corners array)
                [2, 3], // front: 5->4 (indices 2->3 in corners array)
                [3, 0]  // left: 4->0 (indices 3->0 in corners array)
            ];
            
            // Create vertices for rounded edges
            bottomSideVertexPairs.length = 0; // Clear array
            for (var e = 0; e < bottomEdges.length; e++)
            {
                var edge = bottomEdges[e];
                var startOrig = origBottomCorners[edge[0]];
                var endOrig = origBottomCorners[edge[1]];
                var startBevel = bevelBottomCorners[edge[0]];
                var endBevel = bevelBottomCorners[edge[1]];
                
                // Create intermediate vertices along this edge with rounded Y transition
                for (var s = 0; s <= numSegments; s++)
                {
                    var t = s / numSegments; // 0 to 1 along the edge
                    
                    // Interpolate X and Z along the edge (linear)
                    var origX = startOrig.x + (endOrig.x - startOrig.x) * t;
                    var origZ = startOrig.z + (endOrig.z - startOrig.z) * t;
                    var origY = startOrig.y; // Original Y position
                    
                    var bevelX = startBevel.x + (endBevel.x - startBevel.x) * t;
                    var bevelZ = startBevel.z + (endBevel.z - startBevel.z) * t;
                    var bevelY = startBevel.y; // Bevel Y position (lower than original)
                    
                    // Create vertices along the arc transition (in Y direction)
                    // Use smooth interpolation for gradual transition without sudden changes
                    var numArcPoints = 12; // Same as top bevel
                    var arcVertices = [];
                    
                    for (var a = 0; a <= numArcPoints; a++)
                    {
                        var arcT = a / numArcPoints; // 0 to 1 along the arc
                        
                        // Interpolate X and Z linearly from original to bevel
                        var midX = origX + (bevelX - origX) * arcT;
                        var midZ = origZ + (bevelZ - origZ) * arcT;
                        
                        // Interpolate Y using smooth convex arc interpolation
                        // Use circular arc (sin function) for smooth, convex, continuous transition
                        // This creates a bulging outward effect with smooth continuation
                        var easedT;
                        // Use sin function for true circular arc: starts slow, bulges in middle, ends smooth
                        // sin(arcT * π/2) creates a convex arc from 0 to 1
                        // This ensures smooth continuation on the sides without sudden changes
                        easedT = Math.sin(arcT * Math.PI / 2);
                        
                        // Apply the circular arc interpolation for smooth, convex transition
                        // This creates a bulging, convex curve with smooth side continuation
                        var arcY = origY + (bevelY - origY) * easedT;
                        
                        var vertexIdx = v3.length;
                        v3.push({x: midX, y: arcY, z: midZ});
                        arcVertices.push(vertexIdx);
                    }
                    
                    // Store vertex pairs for face generation
                    bottomSideVertexPairs.push({
                        edgeIdx: e,
                        segIdx: s,
                        arcVertices: arcVertices.slice()
                    });
                }
            }
        }
        else if (hasBottomBevel)
        {
            // Non-circle bevel: simple version
            var maxDim = Math.min(w, h);
            var scale = Math.max(0.1, 1 - (bottomBevelWidth / maxDim));
            var bottomBevelY = -sy - bottomBevelHeight;
            v3.push(
                {x: -sx * scale, y: bottomBevelY, z: -sz * scale},
                {x: sx * scale, y: bottomBevelY, z: -sz * scale},
                {x: sx * scale, y: bottomBevelY, z: sz * scale},
                {x: -sx * scale, y: bottomBevelY, z: sz * scale}
            );
        }
        
        // Rotate (3D) first, then project for drawing
        var vr = [];
        for (var i = 0; i < v3.length; i++) vr[i] = rotate(v3[i]);
        var v = [];
        for (var i = 0; i < v3.length; i++) v[i] = project(vr[i]);

        // Build faces dynamically based on bevel configuration
        var faces = [];
        
        // Base faces (always present)
        faces.push([0,2,3,1]); // back (-Z)
        faces.push([4,5,7,6]); // front (+Z)
        
        // Side faces - modify if bevels are present
        if (hasTopBevel)
        {
            // Left side: connect bottom edge to original top edge (not bevel)
            faces.push([0,4,6,2]); // left side (partial, from bottom to original top)
            // Right side: connect bottom edge to original top edge (not bevel)
            faces.push([1,3,7,5]); // right side (partial, from bottom to original top)
            
            if (topBevelType === 'circle' && sideVertexPairs.length > 0)
            {
                // Rounded bevel: create multiple small faces for smooth curves
                // Top bevel face - use bevel corners
                faces.push([topBevelStartIdx, topBevelStartIdx+1, topBevelStartIdx+2, topBevelStartIdx+3]);
                
                // Create rounded side faces using arc vertices
                // Each edge has numSegments+1 segments, each with numArcPoints+1 vertices
                var numSegments = 16; // Match the value used in vertex generation
                var numArcPoints = 12; // Match the value used in vertex generation
                
                // Create faces for each edge
                for (var e = 0; e < 4; e++)
                {
                    // Find segments for this edge
                    var edgeSegments = [];
                    for (var i = 0; i < sideVertexPairs.length; i++)
                    {
                        if (sideVertexPairs[i].edgeIdx === e)
                        {
                            edgeSegments.push(sideVertexPairs[i]);
                        }
                    }
                    
                    // Create faces between consecutive segments
                    for (var s = 0; s < edgeSegments.length - 1; s++)
                    {
                        var seg1 = edgeSegments[s];
                        var seg2 = edgeSegments[s + 1];
                        
                        // Create faces connecting arc vertices
                        // Each face connects corresponding arc points between segments
                        for (var a = 0; a < numArcPoints; a++)
                        {
                            var v1 = seg1.arcVertices[a];
                            var v2 = seg1.arcVertices[a + 1];
                            var v3 = seg2.arcVertices[a + 1];
                            var v4 = seg2.arcVertices[a];
                            
                            // Create quad face (CCW order when looking from outside)
                            faces.push([v1, v2, v3, v4]);
                        }
                    }
                }
            }
            else
            {
                // Simple bevel: use existing logic
                // Top bevel face (replaces original top face)
                faces.push([topBevelStartIdx, topBevelStartIdx+1, topBevelStartIdx+2, topBevelStartIdx+3]);
                
                // Top bevel side faces (4 faces connecting original top edge to bevel edge)
                faces.push([6, 7, topBevelStartIdx+2, topBevelStartIdx+3]); // front bevel side
                faces.push([2, 3, topBevelStartIdx+1, topBevelStartIdx]); // back bevel side
                faces.push([6, 2, topBevelStartIdx, topBevelStartIdx+3]); // left bevel side
                faces.push([7, 3, topBevelStartIdx+1, topBevelStartIdx+2]); // right bevel side
            }
        }
        else
        {
            faces.push([0,4,6,2]); // left (-X)
            faces.push([1,3,7,5]); // right (+X)
            faces.push([2,6,7,3]); // top (+Y)
        }
        
        if (hasBottomBevel)
        {
            if (!hasTopBevel)
            {
                // If no top bevel, we still need left and right sides
                faces.push([0,4,6,2]); // left (-X)
                faces.push([1,3,7,5]); // right (+X)
            }
            
            if (bottomBevelType === 'circle' && bottomSideVertexPairs.length > 0)
            {
                // Rounded bottom bevel: create multiple small faces for smooth curves
                // Bottom bevel face - use bevel corners
                faces.push([bottomBevelStartIdx, bottomBevelStartIdx+1, bottomBevelStartIdx+2, bottomBevelStartIdx+3]);
                
                // Create rounded side faces using arc vertices
                // Each edge has numSegments+1 segments, each with numArcPoints+1 vertices
                var numSegments = 16; // Match the value used in vertex generation
                var numArcPoints = 12; // Match the value used in vertex generation
                
                // Create faces for each edge
                for (var e = 0; e < 4; e++)
                {
                    // Find segments for this edge
                    var edgeSegments = [];
                    for (var i = 0; i < bottomSideVertexPairs.length; i++)
                    {
                        if (bottomSideVertexPairs[i].edgeIdx === e)
                        {
                            edgeSegments.push(bottomSideVertexPairs[i]);
                        }
                    }
                    
                    // Create faces between consecutive segments
                    for (var s = 0; s < edgeSegments.length - 1; s++)
                    {
                        var seg1 = edgeSegments[s];
                        var seg2 = edgeSegments[s + 1];
                        
                        // Create faces connecting arc vertices
                        // Each face connects corresponding arc points between segments
                        // For bottom bevel, order must be CCW when looking from outside (below)
                        for (var a = 0; a < numArcPoints; a++)
                        {
                            var v1 = seg1.arcVertices[a];
                            var v2 = seg1.arcVertices[a + 1];
                            var v3 = seg2.arcVertices[a + 1];
                            var v4 = seg2.arcVertices[a];
                            
                            // Create quad face (CCW order when looking from outside/below)
                            faces.push([v1, v2, v3, v4]);
                        }
                    }
                }
            }
            else
            {
                // Simple bottom bevel: use existing logic
                // Bottom bevel face (replaces original bottom face)
                faces.push([bottomBevelStartIdx, bottomBevelStartIdx+1, bottomBevelStartIdx+2, bottomBevelStartIdx+3]);
                
                // Bottom bevel side faces (4 faces connecting original bottom edge to bevel edge)
                // Order must be CCW when looking from outside (below)
                faces.push([5, 4, bottomBevelStartIdx+3, bottomBevelStartIdx+2]); // front bevel side
                faces.push([1, 0, bottomBevelStartIdx, bottomBevelStartIdx+1]); // back bevel side
                faces.push([4, 0, bottomBevelStartIdx, bottomBevelStartIdx+3]); // left bevel side
                faces.push([5, 1, bottomBevelStartIdx+1, bottomBevelStartIdx+2]); // right bevel side
            }
        }
        else
        {
            if (!hasTopBevel)
            {
                faces.push([0,1,5,4]); // bottom (-Y)
            }
        }

        function faceNormal(idx)
        {
            // Compute normal in rotated 3D space for correct lighting/visibility
            var a = vr[idx[0]], b = vr[idx[1]], cpt = vr[idx[2]];
            var ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
            var vx = cpt.x - a.x, vy = cpt.y - a.y, vz = cpt.z - a.z;
            return {x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx};
        };

        // Determine face visibility (toward viewer if normal.z < 0) and avg depth
        var faceInfo = [];
        var visibleByIndex = new Array(faces.length);
        // View direction for orthographic camera looking along -Z
        var viewDir = {x: 0, y: 0, z: -1};
        for (var fi = 0; fi < faces.length; fi++)
        {
            var idx = faces[fi];
            var n = faceNormal(idx);
            var az = 0;
            for (var k = 0; k < idx.length; k++) az += vr[idx[k]].z;
            // Front-facing if dot(normal, viewDir) < 0
            var vis = (n.x*viewDir.x + n.y*viewDir.y + n.z*viewDir.z) < 0;
            visibleByIndex[fi] = vis;
            faceInfo.push({id: fi, idx: idx, normal: n, z: az / idx.length, visible: vis});
        }

        // Sort back-to-front by average z
        faceInfo.sort(function(a, b){ return a.z - b.z; });

        // Fill with shading based on a fixed light direction in view space
        // Default fill color to blue if not set or is 'none' (avoid black)
        var baseFill = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, null);
        // If fillColor is null, empty, or 'none', use default blue color
        if (baseFill == null || baseFill === '' || baseFill === 'none' || baseFill === 'transparent')
        {
            baseFill = '#1e78b7';
        }
        // Debug: log the fill color to console (can be removed later)
        // console.log('IsoCube baseFill:', baseFill, 'style fillColor:', mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, null));
        // Check if strokeColor is explicitly set, if not default to none (line disabled)
        var strokeColor = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null);
        if (strokeColor == null || strokeColor === '') strokeColor = 'none';
        var light = {x: 0.35, y: -0.5, z: -0.8};
        var lmag = Math.sqrt(light.x*light.x + light.y*light.y + light.z*light.z) || 1;
        light.x/=lmag; light.y/=lmag; light.z/=lmag;

        function shade(hex, factor)
        {
            function clamp(v){ return Math.max(0, Math.min(255, v)); }
            // Ensure we have a valid hex color, fallback to default blue if invalid
            if (!hex || typeof hex !== 'string' || (hex.toLowerCase() === 'none' || hex.toLowerCase() === 'transparent'))
            {
                hex = '#1e78b7';
            }
            if (hex.charAt(0) == '#') hex = hex.substring(1);
            // Handle 3-digit hex colors
            if (hex.length === 3) hex = hex.split('').map(function(c){return c+c;}).join('');
            // Validate hex length (should be 6 digits)
            if (hex.length !== 6)
            {
                hex = '1e78b7'; // Default blue without #
            }
            var r = parseInt(hex.substring(0,2), 16);
            var g = parseInt(hex.substring(2,4), 16);
            var b = parseInt(hex.substring(4,6), 16);
            // Validate parsed values - if NaN, use default blue
            if (isNaN(r) || isNaN(g) || isNaN(b))
            {
                r = 30; g = 120; b = 183; // Default blue RGB (1e78b7)
            }
            r = clamp(Math.round(r * factor));
            g = clamp(Math.round(g * factor));
            b = clamp(Math.round(b * factor));
            return '#' + ('0' + r.toString(16)).slice(-2) + ('0' + g.toString(16)).slice(-2) + ('0' + b.toString(16)).slice(-2);
        };

        // Line/Fill style should match standard Style > Line behavior
        // Respect Style > Line settings; draw lines unless Line is disabled
        // Use shared stroke setup function
        var strokeInfo = window.setup3DShapeStroke(c, style, this.strokewidth, baseFill);
        var strokeColor = strokeInfo.strokeColor;
        var strokeWidth = strokeInfo.strokeWidth;
        var strokeOpacity = strokeInfo.strokeOpacity;
        var strokeEnabled = strokeInfo.strokeEnabled;
        
        // Get dashed line style
        var baseDashed = String(mxUtils.getValue(style, mxConstants.STYLE_DASHED, '0')) === '1';
        
        // Honor style-provided opacities for fill
        var fillOpacity = parseFloat(mxUtils.getValue(style, 'fillOpacity', 1));
        if (isNaN(fillOpacity)) fillOpacity = 1;
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
        // Ensure baseFill is valid - force default if still invalid
        if (isNoneFill(baseFill))
        {
            baseFill = '#1e78b7';
        }
        var fillEnabled = !isNoneFill(baseFill) && fillOpacity > 0;
        // Force fillEnabled to true if we have a valid color (always fill 3D shapes)
        if (baseFill && baseFill !== 'none' && baseFill !== 'transparent' && fillOpacity > 0)
        {
            fillEnabled = true;
        }
        if (!fillEnabled && !strokeEnabled)
        {
            // Nothing to render at all when both fill and line are disabled
            return;
        }

        for (var fi2 = 0; fi2 < faceInfo.length; fi2++)
        {
            var f = faceInfo[fi2];
            // Normalize normal
            var n = f.normal; var nmag = Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z) || 1;
            var nx=n.x/nmag, ny=n.y/nmag, nz=n.z/nmag;
            var ndotl = Math.max(0, -(nx*light.x + ny*light.y + nz*light.z));
            if (fillEnabled)
            {
                // Always apply shading for better 3D appearance
                var tint = shade(baseFill, 0.55 + 0.45 * ndotl);
                // Ensure tint is valid before using
                if (!tint || tint === 'none' || tint === 'transparent' || tint.length < 4)
                {
                    tint = '#1e78b7';
                }
                c.begin();
                c.moveTo(v[f.idx[0]].x, v[f.idx[0]].y);
                for (var j = 1; j < f.idx.length; j++) c.lineTo(v[f.idx[j]].x, v[f.idx[j]].y);
                c.close();
                c.setFillColor(tint);
                // Ensure fill alpha is set before filling
                c.setFillAlpha(Math.max(0, Math.min(1, fillOpacity)));
                if (strokeEnabled) { c.fillAndStroke(); } else { c.fill(); }
            }
            else if (strokeEnabled)
            {
                // Only stroke, no fill
                c.begin();
                c.moveTo(v[f.idx[0]].x, v[f.idx[0]].y);
                for (var j = 1; j < f.idx.length; j++) c.lineTo(v[f.idx[j]].x, v[f.idx[j]].y);
                c.close();
                c.stroke();
            }
        }

        // Debug: draw face normals only when enabled via style
        var debugNormals = String(mxUtils.getValue(style, 'isoDebugNormals', '0')) === '1';
        if (debugNormals)
        {
            var normalLen = Math.min(w, h) * 0.2;
            for (var fi3 = 0; fi3 < faces.length; fi3++)
            {
                var idx = faces[fi3];
                // centroid in rotated 3D
                var cx3 = 0, cy3 = 0, cz3 = 0;
                for (var k = 0; k < idx.length; k++)
                {
                    cx3 += vr[idx[k]].x; cy3 += vr[idx[k]].y; cz3 += vr[idx[k]].z;
                }
                cx3 /= idx.length; cy3 /= idx.length; cz3 /= idx.length;
                // normal
                var n3 = faceNormal(idx);
                var nlen = Math.sqrt(n3.x*n3.x + n3.y*n3.y + n3.z*n3.z) || 1;
                n3.x/=nlen; n3.y/=nlen; n3.z/=nlen;
                var start2 = project({x: cx3, y: cy3, z: cz3});
                var end2 = project({x: cx3 + n3.x * normalLen, y: cy3 + n3.y * normalLen, z: cz3 + n3.z * normalLen});
                var vis = visibleByIndex[fi3];
                c.setDashed(!vis);
                c.setStrokeColor(vis ? '#00aa00' : '#aa0000');
                c.begin();
                c.moveTo(start2.x, start2.y);
                c.lineTo(end2.x, end2.y);
                c.stroke();
            }
            c.setDashed(false);
            c.setStrokeColor(strokeColor);
        }

        // Draw all 12 edges: solid if both adjacent faces visible, dashed otherwise
        var edges = [
            [0,1],[1,3],[3,2],[2,0], // back square
            [4,5],[5,7],[7,6],[6,4], // front square
            [0,4],[1,5],[2,6],[3,7]  // side connectors
        ];

        function edgeFaces(a,b)
        {
            var result = [];
            for (var i = 0; i < faces.length; i++)
            {
                var idx = faces[i];
                var cnt = 0;
                for (var k = 0; k < idx.length; k++) if (idx[k] === a || idx[k] === b) cnt++;
                if (cnt === 2) result.push(i);
            }
            return result;
        }

        var faceVisible = visibleByIndex;
        // Render edges only if line is enabled in style
       
        if (strokeEnabled)
        {
            for (var ei = 0; ei < edges.length; ei++)
            {
                var e = edges[ei];
                var adj = edgeFaces(e[0], e[1]);
                // Hidden edge policy: both adjacent faces back-facing => dashed, else solid
                var hidden = false;
                if (adj.length === 2)
                {
                    var f0 = faceVisible[adj[0]];
                    var f1 = faceVisible[adj[1]];
                    hidden = (!f0 && !f1);
                }
                c.setDashed(baseDashed || hidden);
                c.setStrokeColor(strokeColor);
                c.begin();
                c.moveTo(v[e[0]].x, v[e[0]].y);
                c.lineTo(v[e[1]].x, v[e[1]].y);
                c.stroke();
            }
            c.setDashed(baseDashed);
        }
    };

    IsoCubeShape.prototype.constraints = [
        // Corners
        new mxConnectionConstraint(new mxPoint(0, 0), true),
        new mxConnectionConstraint(new mxPoint(1, 0), true),
        new mxConnectionConstraint(new mxPoint(0, 1), true),
        new mxConnectionConstraint(new mxPoint(1, 1), true),
        // Edge midpoints
        new mxConnectionConstraint(new mxPoint(0.5, 0), true),
        new mxConnectionConstraint(new mxPoint(1, 0.5), true),
        new mxConnectionConstraint(new mxPoint(0.5, 1), true),
        new mxConnectionConstraint(new mxPoint(0, 0.5), true)
    ];

    mxCellRenderer.registerShape('isoCube', IsoCubeShape);

    // --- IsoCylinder Shape ---
    function IsoCylinderShape(bounds, fill, stroke, strokewidth)
    {
        mxShape.call(this);
        this.bounds = bounds;
        this.fill = fill;
        this.stroke = stroke;
        this.strokewidth = (strokewidth != null) ? strokewidth : 1;
    };

    mxUtils.extend(IsoCylinderShape, mxShape);

    IsoCylinderShape.prototype.paintVertexShape = function(c, x, y, w, h)
    {
        var style = this.style || {};
        var d = parseFloat(mxUtils.getValue(style, 'isoZ', Math.min(w, h) * 0.6));
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

        // Create cylinder: top circle, bottom circle, and side surface
        // Use 64 samples for smooth circular top and bottom
        var numSamples = 64;
        var v3 = []; // 3D vertices (before rotation)
        var topCircle = [];
        var bottomCircle = [];
        
        // Store original top and bottom circles for bevel generation
        for (var i = 0; i < numSamples; i++)
        {
            var angle = (i / numSamples) * 2 * Math.PI;
            var px = sx * Math.cos(angle);
            var py = sy * Math.sin(angle);
            
            // Top circle at z = sz (Y+ direction)
            topCircle.push({x: px, y: py, z: sz});
            // Bottom circle at z = -sz (Y- direction)
            bottomCircle.push({x: px, y: py, z: -sz});
            
            // Add to v3 array (original vertices)
            v3.push({x: px, y: py, z: sz});
        }
        
        // Store base indices for reference
        var topCircleStartIdx = 0;
        var bottomCircleStartIdx = numSamples;
        
        // Generate bevel vertices if needed
        var topBevelStartIdx = -1;
        var bottomBevelStartIdx = -1;
        var topSideVertexPairs = []; // For rounded bevel faces
        var bottomSideVertexPairs = []; // For rounded bevel faces
        
        // Top bevel
        if (hasTopBevel)
        {
            if (topBevelType === 'circle')
            {
                // Rounded bevel: create smooth arc transition
                // Cylinder height is along Z axis, so bevel raises Z
                var maxDim = Math.min(w, h);
                var scale = Math.max(0.1, 1 - (topBevelWidth / maxDim));
                var topBevelZ = sz + topBevelHeight; // Top bevel is raised along Z axis
                
                topBevelStartIdx = v3.length;
                
                // Number of segments along the arc (radial direction)
                var numSegments = 16;
                var numArcPoints = 12; // Points along the arc transition
                
                // For each sample point on the circle, create arc vertices
                for (var i = 0; i < numSamples; i++)
                {
                    var angle = (i / numSamples) * 2 * Math.PI;
                    var origX = sx * Math.cos(angle);
                    var origY = sy * Math.sin(angle);
                    var origZ = sz;
                    
                    var bevelX = origX * scale;
                    var bevelY = origY * scale;
                    var bevelZ = topBevelZ;
                    
                    // Create arc vertices for this sample point
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
                        sampleIdx: i,
                        arcVertices: arcVertices.slice()
                    });
                }
                
                // Create bevel top circle vertices (contracted circle at raised Z)
                for (var i = 0; i < numSamples; i++)
                {
                    var angle = (i / numSamples) * 2 * Math.PI;
                    var px = sx * scale * Math.cos(angle);
                    var py = sy * scale * Math.sin(angle);
                    var pz = topBevelZ;
                    v3.push({x: px, y: py, z: pz});
                }
            }
            else
            {
                // Simple bevel: just create contracted top circle
                var maxDim = Math.min(w, h);
                var scale = Math.max(0.1, 1 - (topBevelWidth / maxDim));
                var topBevelZ = sz + topBevelHeight;
                
                topBevelStartIdx = v3.length;
                for (var i = 0; i < numSamples; i++)
                {
                    var angle = (i / numSamples) * 2 * Math.PI;
                    var px = sx * scale * Math.cos(angle);
                    var py = sy * scale * Math.sin(angle);
                    var pz = topBevelZ;
                    v3.push({x: px, y: py, z: pz});
                }
            }
        }
        
        // Add original bottom circle vertices
        for (var i = 0; i < numSamples; i++)
        {
            var angle = (i / numSamples) * 2 * Math.PI;
            var px = sx * Math.cos(angle);
            var py = sy * Math.sin(angle);
            v3.push({x: px, y: py, z: -sz});
        }
        
        // Bottom bevel
        if (hasBottomBevel)
        {
            if (bottomBevelType === 'circle')
            {
                // Rounded bevel: create smooth arc transition
                // Cylinder height is along Z axis, so bevel lowers Z
                var maxDim = Math.min(w, h);
                var scale = Math.max(0.1, 1 - (bottomBevelWidth / maxDim));
                var bottomBevelZ = -sz - bottomBevelHeight; // Bottom bevel is lowered along Z axis
                
                bottomBevelStartIdx = v3.length;
                
                // Number of segments along the arc (radial direction)
                var numSegments = 16;
                var numArcPoints = 12; // Points along the arc transition
                
                // For each sample point on the circle, create arc vertices
                for (var i = 0; i < numSamples; i++)
                {
                    var angle = (i / numSamples) * 2 * Math.PI;
                    var origX = sx * Math.cos(angle);
                    var origY = sy * Math.sin(angle);
                    var origZ = -sz;
                    
                    var bevelX = origX * scale;
                    var bevelY = origY * scale;
                    var bevelZ = bottomBevelZ;
                    
                    // Create arc vertices for this sample point
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
                        sampleIdx: i,
                        arcVertices: arcVertices.slice()
                    });
                }
                
                // Create bevel bottom circle vertices (contracted circle at lowered Z)
                for (var i = 0; i < numSamples; i++)
                {
                    var angle = (i / numSamples) * 2 * Math.PI;
                    var px = sx * scale * Math.cos(angle);
                    var py = sy * scale * Math.sin(angle);
                    var pz = bottomBevelZ;
                    v3.push({x: px, y: py, z: pz});
                }
            }
            else
            {
                // Simple bevel: just create contracted bottom circle
                var maxDim = Math.min(w, h);
                var scale = Math.max(0.1, 1 - (bottomBevelWidth / maxDim));
                var bottomBevelZ = -sz - bottomBevelHeight;
                
                bottomBevelStartIdx = v3.length;
                for (var i = 0; i < numSamples; i++)
                {
                    var angle = (i / numSamples) * 2 * Math.PI;
                    var px = sx * scale * Math.cos(angle);
                    var py = sy * scale * Math.sin(angle);
                    var pz = bottomBevelZ;
                    v3.push({x: px, y: py, z: pz});
                }
            }
        }

        // Rotate and project all vertices
        var rotatedVertices = [];
        var projectedVertices = [];
        
        for (var i = 0; i < v3.length; i++)
        {
            var rotated = rotate(v3[i]);
            rotatedVertices.push(rotated);
            projectedVertices.push(project(rotated));
        }

        // Create faces: top circle, bottom circle, and side surface
        var faces = [];
        
        // Determine actual top and bottom circle indices
        var actualTopStartIdx = hasTopBevel ? topBevelStartIdx : topCircleStartIdx;
        var actualBottomStartIdx = hasBottomBevel ? bottomBevelStartIdx : bottomCircleStartIdx;
        
        // Adjust indices for bevel top circle (if it exists)
        if (hasTopBevel)
        {
            // Top bevel face uses the contracted circle
            var topBevelCircleStartIdx = topBevelStartIdx;
            if (topBevelType === 'circle')
            {
                // For rounded bevel, the bevel circle comes after arc vertices
                // Calculate: topBevelStartIdx + (numSamples * (numArcPoints + 1))
                topBevelCircleStartIdx = topBevelStartIdx + (numSamples * (13)); // 13 = numArcPoints + 1
            }
            
            var topBevelFaceIndices = [];
            for (var i = 0; i < numSamples; i++)
            {
                topBevelFaceIndices.push(topBevelCircleStartIdx + i);
            }
            faces.push({indices: topBevelFaceIndices, isTop: true});
        }
        else
        {
            // Original top face (CCW)
            var topFaceIndices = [];
            for (var i = 0; i < numSamples; i++)
            {
                topFaceIndices.push(i);
            }
            faces.push({indices: topFaceIndices, isTop: true});
        }
        
        // Adjust indices for bevel bottom circle (if it exists)
        if (hasBottomBevel)
        {
            // Bottom bevel face uses the contracted circle
            var bottomBevelCircleStartIdx = bottomBevelStartIdx;
            if (bottomBevelType === 'circle')
            {
                // For rounded bevel, the bevel circle comes after arc vertices
                bottomBevelCircleStartIdx = bottomBevelStartIdx + (numSamples * (13)); // 13 = numArcPoints + 1
            }
            
            var bottomBevelFaceIndices = [];
            for (var i = numSamples - 1; i >= 0; i--)
            {
                bottomBevelFaceIndices.push(bottomBevelCircleStartIdx + i);
            }
            faces.push({indices: bottomBevelFaceIndices, isBottom: true});
        }
        else
        {
            // Original bottom face (CW for correct normal)
            var bottomFaceIndices = [];
            for (var i = numSamples - 1; i >= 0; i--)
            {
                bottomFaceIndices.push(bottomCircleStartIdx + i);
            }
            faces.push({indices: bottomFaceIndices, isBottom: true});
        }
        
        // Side faces (connecting top and bottom circles)
        if (hasTopBevel && topBevelType === 'circle')
        {
            // Rounded top bevel: create faces connecting original top circle to bevel circle
            // Each sample point has arc vertices, create faces between consecutive samples
            for (var i = 0; i < numSamples; i++)
            {
                var next = (i + 1) % numSamples;
                
                // Get arc vertices for this sample and next sample
                var currArcVerts = topSideVertexPairs[i].arcVertices;
                var nextArcVerts = topSideVertexPairs[next].arcVertices;
                
                // Create faces connecting arc vertices
                for (var a = 0; a < currArcVerts.length - 1; a++)
                {
                    var v1 = currArcVerts[a];
                    var v2 = currArcVerts[a + 1];
                    var v3 = nextArcVerts[a + 1];
                    var v4 = nextArcVerts[a];
                    
                    // Create quad face (CCW order when looking from outside)
                    faces.push({
                        indices: [v1, v2, v3, v4],
                        isSide: true
                    });
                }
            }
        }
        else if (hasTopBevel)
        {
            // Simple top bevel: connect original top circle to bevel circle
            var topBevelCircleStartIdx = topBevelStartIdx;
            for (var i = 0; i < numSamples; i++)
            {
                var next = (i + 1) % numSamples;
                faces.push({
                    indices: [topCircleStartIdx + i, topCircleStartIdx + next, topBevelCircleStartIdx + next, topBevelCircleStartIdx + i],
                    isSide: true
                });
            }
        }
        
        // Middle side faces (only if no bevels or only one bevel)
        if (!hasTopBevel && !hasBottomBevel)
        {
            // Original side faces connecting top and bottom circles
            for (var i = 0; i < numSamples; i++)
            {
                var next = (i + 1) % numSamples;
                faces.push({
                    indices: [topCircleStartIdx + i, topCircleStartIdx + next, bottomCircleStartIdx + next, bottomCircleStartIdx + i],
                    isSide: true
                });
            }
        }
        else if (hasTopBevel && !hasBottomBevel)
        {
            // Connect bevel top to original bottom
            var topConnectIdx = hasTopBevel && topBevelType === 'circle' ? 
                (topBevelStartIdx + (numSamples * 13)) : topBevelStartIdx;
            for (var i = 0; i < numSamples; i++)
            {
                var next = (i + 1) % numSamples;
                faces.push({
                    indices: [topConnectIdx + i, topConnectIdx + next, bottomCircleStartIdx + next, bottomCircleStartIdx + i],
                    isSide: true
                });
            }
        }
        else if (!hasTopBevel && hasBottomBevel)
        {
            // Connect original top to bevel bottom
            var bottomConnectIdx = hasBottomBevel && bottomBevelType === 'circle' ?
                (bottomBevelStartIdx + (numSamples * 13)) : bottomBevelStartIdx;
            for (var i = 0; i < numSamples; i++)
            {
                var next = (i + 1) % numSamples;
                faces.push({
                    indices: [topCircleStartIdx + i, topCircleStartIdx + next, bottomConnectIdx + next, bottomConnectIdx + i],
                    isSide: true
                });
            }
        }
        else if (hasTopBevel && hasBottomBevel)
        {
            // Connect bevel top to bevel bottom
            var topConnectIdx = topBevelType === 'circle' ? 
                (topBevelStartIdx + (numSamples * 13)) : topBevelStartIdx;
            var bottomConnectIdx = bottomBevelType === 'circle' ?
                (bottomBevelStartIdx + (numSamples * 13)) : bottomBevelStartIdx;
            for (var i = 0; i < numSamples; i++)
            {
                var next = (i + 1) % numSamples;
                faces.push({
                    indices: [topConnectIdx + i, topConnectIdx + next, bottomConnectIdx + next, bottomConnectIdx + i],
                    isSide: true
                });
            }
        }
        
        // Bottom bevel side faces
        if (hasBottomBevel && bottomBevelType === 'circle')
        {
            // Rounded bottom bevel: create faces connecting original bottom circle to bevel circle
            for (var i = 0; i < numSamples; i++)
            {
                var next = (i + 1) % numSamples;
                
                // Get arc vertices for this sample and next sample
                var currArcVerts = bottomSideVertexPairs[i].arcVertices;
                var nextArcVerts = bottomSideVertexPairs[next].arcVertices;
                
                // Create faces connecting arc vertices
                for (var a = 0; a < currArcVerts.length - 1; a++)
                {
                    var v1 = currArcVerts[a];
                    var v2 = currArcVerts[a + 1];
                    var v3 = nextArcVerts[a + 1];
                    var v4 = nextArcVerts[a];
                    
                    // Create quad face (CCW order when looking from outside)
                    faces.push({
                        indices: [v1, v2, v3, v4],
                        isSide: true
                    });
                }
            }
        }
        else if (hasBottomBevel)
        {
            // Simple bottom bevel: connect original bottom circle to bevel circle
            var bottomBevelCircleStartIdx = bottomBevelStartIdx;
            for (var i = 0; i < numSamples; i++)
            {
                var next = (i + 1) % numSamples;
                faces.push({
                    indices: [bottomCircleStartIdx + i, bottomCircleStartIdx + next, bottomBevelCircleStartIdx + next, bottomBevelCircleStartIdx + i],
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
                visible: vis
            });
        }

        // Sort back-to-front
        faceInfo.sort(function(a, b){ return a.z - b.z; });

        // Get base fill color - Default to blue if not set or is 'none' (avoid black)
        var baseFill = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, null);
        // If fillColor is null, empty, or 'none', use default blue color
        if (baseFill == null || baseFill === '' || baseFill === 'none' || baseFill === 'transparent')
        {
            baseFill = '#1e78b7';
        }
        // Debug: log the fill color to console (can be removed later)
        // console.log('IsoCylinder baseFill:', baseFill, 'style fillColor:', mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, null));
        
        // Lighting for 3D effect
        var light = {x: 0.35, y: -0.5, z: -0.8};
        var lmag = Math.sqrt(light.x*light.x + light.y*light.y + light.z*light.z) || 1;
        light.x /= lmag; light.y /= lmag; light.z /= lmag;

        function shade(hex, factor)
        {
            function clamp(v){ return Math.max(0, Math.min(255, v)); }
            // Ensure we have a valid hex color, fallback to default blue if invalid
            if (!hex || typeof hex !== 'string' || (hex.toLowerCase() === 'none' || hex.toLowerCase() === 'transparent'))
            {
                hex = '#1e78b7';
            }
            if (hex.charAt(0) == '#') hex = hex.substring(1);
            // Handle 3-digit hex colors
            if (hex.length === 3) hex = hex.split('').map(function(c){return c+c;}).join('');
            // Validate hex length (should be 6 digits)
            if (hex.length !== 6)
            {
                hex = '1e78b7'; // Default blue without #
            }
            var r = parseInt(hex.substring(0,2), 16);
            var g = parseInt(hex.substring(2,4), 16);
            var b = parseInt(hex.substring(4,6), 16);
            // Validate parsed values - if NaN, use default blue
            if (isNaN(r) || isNaN(g) || isNaN(b))
            {
                r = 30; g = 120; b = 183; // Default blue RGB (1e78b7)
            }
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
            if (s.length === 9 && s.startsWith('#') && s.substring(7) === '00') return true;
            return false;
        }
        
        // Stroke color handling - same as isoCube
        var strokeColor = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null);
        var strokeColorNone = isNoneColor(strokeColor);
        
        // Check strokeWidth - if line is disabled, it should be 0 or not set
        var strokeWidthRaw = mxUtils.getValue(style, mxConstants.STYLE_STROKEWIDTH, null);
        var strokeWidth = parseFloat(strokeWidthRaw);
        // Default strokeWidth if not set or invalid
        if (strokeWidthRaw == null || strokeWidthRaw === '' || isNaN(strokeWidth))
        {
            strokeWidth = strokeColorNone ? 0 : this.strokewidth;
        }
        
        var strokeOpacity = parseFloat(mxUtils.getValue(style, 'strokeOpacity', 1));
        // If strokeColor is none, force strokeWidth and strokeOpacity to 0
        if (strokeColorNone)
        {
            strokeWidth = 0;
            strokeOpacity = 0;
        }
        else
        {
            if (isNaN(strokeOpacity)) strokeOpacity = 1;
            if (strokeOpacity > 1) strokeOpacity = strokeOpacity / 100;
        }
        
        // Honor style-provided opacities for fill
        var fillOpacity = parseFloat(mxUtils.getValue(style, 'fillOpacity', 1));
        if (isNaN(fillOpacity)) fillOpacity = 1;
        if (fillOpacity > 1) fillOpacity = fillOpacity / 100;
        c.setFillAlpha(Math.max(0, Math.min(1, fillOpacity)));
        
        var strokeEnabled = !strokeColorNone && strokeOpacity > 0 && strokeWidth > 0;
        
        // Only set stroke properties when actually enabled
        if (strokeEnabled)
        {
            c.setStrokeColor(strokeColor);
            c.setStrokeWidth(strokeWidth);
            c.setStrokeAlpha(Math.max(0, Math.min(1, strokeOpacity)));
        }
        
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
        
        // Ensure baseFill is valid - force default if still invalid
        if (isNoneFill(baseFill))
        {
            baseFill = '#1e78b7';
        }
        var fillEnabled = !isNoneFill(baseFill) && fillOpacity > 0;
        // Force fillEnabled to true if we have a valid color (always fill 3D shapes)
        if (baseFill && baseFill !== 'none' && baseFill !== 'transparent' && fillOpacity > 0)
        {
            fillEnabled = true;
        }
        
        if (!fillEnabled && !strokeEnabled) return;

        // Render faces
        for (var fi2 = 0; fi2 < faceInfo.length; fi2++)
        {
            var f = faceInfo[fi2];
            // Normalize normal
            var n = f.normal; var nmag = Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z) || 1;
            var nx=n.x/nmag, ny=n.y/nmag, nz=n.z/nmag;
            var ndotl = Math.max(0, -(nx*light.x + ny*light.y + nz*light.z));
            if (fillEnabled)
            {
                // Always apply shading for better 3D appearance
                var tint = shade(baseFill, 0.55 + 0.45 * ndotl);
                // Ensure tint is valid before using
                if (!tint || tint === 'none' || tint === 'transparent' || tint.length < 4)
                {
                    tint = '#1e78b7';
                }
                c.begin();
                c.moveTo(projectedVertices[f.indices[0]].x, projectedVertices[f.indices[0]].y);
                for (var j = 1; j < f.indices.length; j++) 
                {
                    c.lineTo(projectedVertices[f.indices[j]].x, projectedVertices[f.indices[j]].y);
                }
                c.close();
                c.setFillColor(tint);
                // Ensure fill alpha is set before filling
                c.setFillAlpha(Math.max(0, Math.min(1, fillOpacity)));
                if (strokeEnabled) { c.fillAndStroke(); } else { c.fill(); }
            }
            else if (strokeEnabled)
            {
                // Only stroke, no fill
                c.begin();
                c.moveTo(projectedVertices[f.indices[0]].x, projectedVertices[f.indices[0]].y);
                for (var j = 1; j < f.indices.length; j++) 
                {
                    c.lineTo(projectedVertices[f.indices[j]].x, projectedVertices[f.indices[j]].y);
                }
                c.close();
                c.stroke();
            }
        }
    };

    IsoCylinderShape.prototype.constraints = [
        new mxConnectionConstraint(new mxPoint(0.5, 0.5), false),
        new mxConnectionConstraint(new mxPoint(0.5, 0), true),
        new mxConnectionConstraint(new mxPoint(0.5, 1), true),
        new mxConnectionConstraint(new mxPoint(0, 0.5), true),
        new mxConnectionConstraint(new mxPoint(1, 0.5), true)
    ];

    mxCellRenderer.registerShape('isoCylinder', IsoCylinderShape);

    // --- Sidebar palette entry ---
    var sb = editorUi.sidebar;
    function addIsoPalette()
    {
        if (sb == null)
        {
            return;
        }
        
        try
        {
            // Remove existing isometric palette if it exists
            var isometricExists = sb.palettes && sb.palettes['isometric'] != null && sb.palettes['isometric'][1] != null;
            
            if (isometricExists)
            {
                try
                {
                    sb.removePalette('isometric');
                }
                catch (e)
                {
                    // Ignore error if palette doesn't exist or already removed
                    if (window.console)
                    {
                        console.warn('Failed to remove isometric palette:', e);
                    }
                }
            }
            
            // Ensure General palette exists before adding Isometric
            var generalExists = sb.palettes && sb.palettes['general'] != null && sb.palettes['general'][1] != null;
            
            if (!generalExists)
            {
                // If General doesn't exist yet, wait a bit and try again
                window.setTimeout(addIsoPalette, 100);
                return;
            }
            
            // Use standard addPalette method to ensure all functionality works correctly
            sb.addPalette('isometric', '3D 形状', true, function(content)
            {
                // Cube
                var cell = new mxCell('', new mxGeometry(0, 0, 250, 250),
                    'shape=isoCube;isoZ=70;isoRx=35;isoRy=35;isoRz=0;fillColor=#1e78b7;strokeColor=#1e78b7;rounded=0;');
                cell.vertex = true;
                var doc = mxUtils.createXmlDocument();
                var obj = doc.createElement('object');
                obj.setAttribute('label', '');
                obj.setAttribute('isoRx', '35');
                obj.setAttribute('isoRy', '35');
                obj.setAttribute('isoRz', '0');
                obj.setAttribute('isoZ', '70');
                cell.value = obj;
                content.appendChild(sb.createVertexTemplateFromCells([cell], 120, 120, 'Cube'));
                
                // Cylinder
                var cell2 = new mxCell('', new mxGeometry(0, 0, 250, 250),
                    'shape=isoCylinder;isoZ=70;isoRx=35;isoRy=35;isoRz=0;fillColor=#1e78b7;strokeColor=#1e78b7;rounded=0;');
                cell2.vertex = true;
                var doc2 = mxUtils.createXmlDocument();
                var obj2 = doc2.createElement('object');
                obj2.setAttribute('label', '');
                obj2.setAttribute('isoRx', '35');
                obj2.setAttribute('isoRy', '35');
                obj2.setAttribute('isoRz', '0');
                obj2.setAttribute('isoZ', '70');
                cell2.value = obj2;
                content.appendChild(sb.createVertexTemplateFromCells([cell2], 120, 120, 'Cylinder'));
            });
            
            // Now move the isometric palette to be right after general palette
            var generalPalette = sb.palettes['general'];
            var isometricPalette = sb.palettes['isometric'];
            
            if (generalPalette && isometricPalette && generalPalette[1] && generalPalette[1].parentNode)
            {
                var wrapper = generalPalette[1].parentNode;
                var generalOuter = generalPalette[1];
                var nextSibling = generalOuter.nextSibling;
                
                // Move isometric title and outer to be after general
                if (isometricPalette[0] && isometricPalette[0].parentNode)
                {
                    wrapper.insertBefore(isometricPalette[0], nextSibling);
                }
                if (isometricPalette[1] && isometricPalette[1].parentNode)
                {
                    wrapper.insertBefore(isometricPalette[1], nextSibling);
                }
            }
        }
        catch (e)
        {
            if (window.console)
            {
                console.warn('Failed to add isometric palette:', e);
            }
        }
    };
    
    // Handles reload of sidebar after dark mode change or reinit
    if (sb != null)
    {
        var sbInit = sb.init;
        sb.init = function()
        {
            // Call original init first to add General palette
            sbInit.apply(this, arguments);
            // Use setTimeout to ensure General palette is fully added to DOM
            // before adding Isometric palette
            var self = this;
            window.setTimeout(function()
            {
                addIsoPalette();
            }, 0);
        };
        
        // Also handle refresh() calls to ensure isometric stays after general
        var sbRefresh = sb.refresh;
        sb.refresh = function()
        {
            // Call original refresh
            sbRefresh.apply(this, arguments);
            // After refresh, ensure isometric palette is added after general
            var self = this;
            window.setTimeout(function()
            {
                addIsoPalette();
            }, 0);
        };
        
        // Try to add palette immediately if sidebar is already initialized
        // This handles the case where the plugin loads after sidebar.init() was called
        window.setTimeout(function()
        {
            addIsoPalette();
        }, 200);
    }

    // Note: Right-click menu "添加3D效果" is handled by isoextrude.js plugin
    // to avoid duplicate menu items

    // --- Inject properties into right-side Format panel (no separate popup)
    function renderIsoFormatPanel()
    {
        var fmt = editorUi.format;
        if (!fmt || !fmt.container) return;
        // Remove previous panels
        var old = document.getElementById('isoCube-format-panel');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var old2 = document.getElementById('isoCylinder-format-panel');
        if (old2 && old2.parentNode) old2.parentNode.removeChild(old2);

        var cell = graph.getSelectionCell();
        var style = (cell != null) ? graph.getCurrentCellStyle(cell) : null;
        var shapeType = (style != null) ? style['shape'] : null;
        if (!style || (shapeType !== 'isoCube' && shapeType !== 'isoCylinder')) return;

        var panel = document.createElement('div');
        panel.id = (shapeType === 'isoCylinder') ? 'isoCylinder-format-panel' : 'isoCube-format-panel';
        panel.className = 'geStyleOptions';
        panel.style.padding = '8px 12px';
        panel.style.borderTop = '1px solid var(--gePrimaryBorderColor, #e0e0e0)';

        // Insert panel at the bottom (after sketch section)
        // Find the last child or append to end
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
                if (cur && graph.getModel().isVertex(cur) && (curShape === 'isoCube' || curShape === 'isoCylinder'))
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
            
            // Also handle mouseenter to focus when hovering for easier wheel adjustment
            mxEvent.addListener(row, 'mouseenter', function()
            {
                // Auto-focus on hover for easier wheel adjustment
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
        
        // Add 3D Bevel controls (for isoCube and isoCylinder)
        if (shapeType === 'isoCube' || shapeType === 'isoCylinder')
        {
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
            
            // Top Bevel Width
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
                input.value = mxUtils.getValue(style, key, defaultValue || 0);
                
                var updateHandler = function()
                {
                    var cur = graph.getSelectionCell();
                    var curStyle = (cur != null) ? graph.getCurrentCellStyle(cur) : null;
                    var curShape = (curStyle != null) ? curStyle['shape'] : null;
                    if (cur && graph.getModel().isVertex(cur) && (curShape === 'isoCube' || curShape === 'isoCylinder'))
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
                if (cur && graph.getModel().isVertex(cur) && (curShape === 'isoCube' || curShape === 'isoCylinder'))
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
                if (cur && graph.getModel().isVertex(cur) && (curShape === 'isoCube' || curShape === 'isoCylinder'))
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
    }

    var scheduleRender = mxUtils.bind(this, function()
    {
        // Defer slightly to let core format panel rebuild first
        window.setTimeout(renderIsoFormatPanel, 0);
    });

    if (editorUi.format && editorUi.format.addListener)
    {
        editorUi.format.addListener('refresh', scheduleRender);
    }
    graph.getSelectionModel().addListener(mxEvent.CHANGE, scheduleRender);
    graph.getModel().addListener(mxEvent.CHANGE, scheduleRender);
    
    // --- Sync attributes from property panel to style ---
    // Listen for cell value changes to sync property panel attributes to style
    var originalSetValue = graph.getModel().setValue;
    graph.getModel().setValue = function(cell, value)
    {
        originalSetValue.apply(this, arguments);
        
        // Sync isoRx, isoRy, isoRz, isoZ from attributes to style if cell is isoCube or isoCylinder
        if (cell && graph.getModel().isVertex(cell))
        {
            var style = graph.getCurrentCellStyle(cell);
            var shape = style ? style[mxConstants.STYLE_SHAPE] : null;
            if (shape === 'isoCube' || shape === 'isoCylinder')
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
    
    // When loading existing isoCube/isoCylinder shapes, ensure attributes are set
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
                    if (shape === 'isoCube' || shape === 'isoCylinder')
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
                        var isoZ = mxUtils.getValue(style, 'isoZ', 70);
                        
                        if (!cellValue.getAttribute('isoRx')) cellValue.setAttribute('isoRx', String(isoRx));
                        if (!cellValue.getAttribute('isoRy')) cellValue.setAttribute('isoRy', String(isoRy));
                        if (!cellValue.getAttribute('isoRz')) cellValue.setAttribute('isoRz', String(isoRz));
                        if (!cellValue.getAttribute('isoZ')) cellValue.setAttribute('isoZ', String(isoZ));
                    }
                }
            }
        }
    });
});


