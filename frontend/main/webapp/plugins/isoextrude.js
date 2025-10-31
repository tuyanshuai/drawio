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

        // Create front and back faces
        var frontFace = [];
        var backFace = [];
        for (var i = 0; i < basePoints.length; i++)
        {
            frontFace.push({x: basePoints[i].x, y: basePoints[i].y, z: sz});
            backFace.push({x: basePoints[i].x, y: basePoints[i].y, z: -sz});
        }

        // Rotate all vertices
        var allVertices = frontFace.concat(backFace);
        var rotatedVertices = [];
        for (var i = 0; i < allVertices.length; i++)
        {
            rotatedVertices.push(rotate(allVertices[i]));
        }

        var projectedVertices = [];
        for (var i = 0; i < rotatedVertices.length; i++)
        {
            projectedVertices.push(project(rotatedVertices[i]));
        }

        // Create faces (front, back, and sides)
        var faces = [];
        var numPoints = basePoints.length;
        
        // Front face
        var frontFaceIndices = [];
        for (var i = 0; i < numPoints; i++)
        {
            frontFaceIndices.push(i);
        }
        faces.push({indices: frontFaceIndices, isFront: true});

        // Back face (reversed winding)
        var backFaceIndices = [];
        for (var i = numPoints - 1; i >= 0; i--)
        {
            backFaceIndices.push(i + numPoints);
        }
        faces.push({indices: backFaceIndices, isFront: false});

        // Side faces
        for (var i = 0; i < numPoints; i++)
        {
            var next = (i + 1) % numPoints;
            faces.push({
                indices: [i, next, next + numPoints, i + numPoints],
                isFront: null
            });
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
    
    // Listen for editing stop
    var originalStopEditing = graph.stopEditing;
    graph.stopEditing = function(cancel)
    {
        originalStopEditing.apply(this, arguments);
        
        if (!cancel)
        {
            var cell = graph.getSelectionCell();
            if (cell) reapply3DEffect(cell);
        }
    };
    
    // Listen for selection changes (when user clicks away)
    graph.addListener(mxEvent.CHANGE, function(sender, evt)
    {
        var changes = evt.getProperty('edit').changes;
        if (changes)
        {
            for (var i = 0; i < changes.length; i++)
            {
                var change = changes[i];
                if (change.constructor.name === 'mxSelectionChange')
                {
                    // Selection changed - check if we need to re-apply 3D for previously selected cells
                    var previous = change.previous;
                    if (previous && previous.length > 0)
                    {
                        for (var j = 0; j < previous.length; j++)
                        {
                            var prevCell = previous[j];
                            if (prevCell && editingIsoExtrudeCells[prevCell.getId()])
                            {
                                // User deselected - re-apply 3D
                                reapply3DEffect(prevCell);
                            }
                        }
                    }
                }
            }
        }
    });
    
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
});

