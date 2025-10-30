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
                visible: vis
            });
        }

        // Sort back-to-front
        faceInfo.sort(function(a, b){ return a.z - b.z; });

        // Get base fill color - use third style color as default (#182E3E)
        var baseFill = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, '#182E3E');
        
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
            if (strokeOpacity > 1) strokeOpacity = strokeOpacity / 100; // accept 0..100 style values
        }
        
        // Honor style-provided opacities for fill
        var fillOpacity = parseFloat(mxUtils.getValue(style, 'fillOpacity', 1));
        if (isNaN(fillOpacity)) fillOpacity = 1;
        if (fillOpacity > 1) fillOpacity = fillOpacity / 100; // accept 0..100 style values
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
        
        var fillEnabled = !isNoneFill(baseFill) && fillOpacity > 0;
        
        if (!fillEnabled && !strokeEnabled) return;

        // Check if this is a curve shape (ellipse/circle) - for curves, don't draw side face lines
        var originalShape = mxUtils.getValue(style, 'isoOriginalShape', null);
        var isCurveShape = false;
        if (originalShape)
        {
            var shapeLower = originalShape.toLowerCase();
            isCurveShape = (shapeLower.indexOf('ellipse') >= 0 || shapeLower.indexOf('circle') >= 0);
        }
        // Also check if basePoints count indicates a curve (high sample count = curve)
        // Curves typically have 512 samples, polygons have much fewer (3-8 vertices)
        if (!isCurveShape && basePoints.length > 100)
        {
            isCurveShape = true;
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
            
            if (fillEnabled)
            {
                c.setFillColor(faceFill);
                c.begin();
                
                // Use standard lineTo for all shapes (no quadTo)
                // With 512 samples for curves, lineTo should be very smooth
                // Ensure we close the path properly
                c.moveTo(points[0].x, points[0].y);
                for (var k = 1; k < points.length; k++)
                {
                    c.lineTo(points[k].x, points[k].y);
                }
                // Explicitly close the path to ensure smooth connection
                c.close();
                
                // For curve shapes, don't draw lines on side faces (fi >= 2)
                // Only draw lines on front/back faces (fi < 2)
                var isSideFace = (fi >= 2);
                var shouldDrawStroke = strokeEnabled && (!isCurveShape || !isSideFace);
                
                if (shouldDrawStroke) 
                { 
                    c.fillAndStroke(); 
                } 
                else 
                { 
                    c.fill();
                }
            }
        }
    };

    // Register the shape
    mxCellRenderer.registerShape('isoExtrude', IsoExtrudeShape);

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

                // Copy fill color - use third style color as default if not set
                var fillColor = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, null);
                if (!fillColor || fillColor === 'none' || fillColor === 'transparent' || fillColor === '')
                {
                    fillColor = '#182E3E'; // Third style color
                }
                newStyle += 'fillColor=' + fillColor + ';';

                // Copy stroke properties - default to null (not set) if not explicitly set
                var strokeColor = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null);
                if (strokeColor) newStyle += 'strokeColor=' + strokeColor + ';';
                
                var strokeWidth = mxUtils.getValue(style, mxConstants.STYLE_STROKEWIDTH, null);
                if (strokeWidth != null) newStyle += 'strokeWidth=' + strokeWidth + ';';

                var fillOpacity = mxUtils.getValue(style, mxConstants.STYLE_FILLOPACITY, 100);
                newStyle += 'fillOpacity=' + fillOpacity + ';';

                var strokeOpacity = mxUtils.getValue(style, mxConstants.STYLE_STROKEOPACITY, 100);
                newStyle += 'strokeOpacity=' + strokeOpacity + ';';

                // Copy other relevant properties
                var rounded = mxUtils.getValue(style, mxConstants.STYLE_ROUNDED, 0);
                newStyle += 'rounded=' + rounded + ';';

                graph.setCellStyle(newStyle, [cell]);
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

    // Add to context menu
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
                menu.addSeparator();
                editorUi.menus.addMenuItem(menu, 'add3dEffect', null, evt);
            }
        }
    };

    // --- Format panel integration (similar to isoCube) ---
    function renderIsoExtrudeFormatPanel()
    {
        var fmt = editorUi.format;
        if (!fmt || !fmt.container) return;
        
        var old = document.getElementById('isoExtrude-format-panel');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        var cell = graph.getSelectionCell();
        var style = (cell != null) ? graph.getCurrentCellStyle(cell) : null;
        if (!style || style['shape'] !== 'isoExtrude') return;

        var panel = document.createElement('div');
        panel.id = 'isoExtrude-format-panel';
        panel.className = 'geStyleOptions';
        panel.style.padding = '8px 12px';
        panel.style.borderTop = '1px solid var(--gePrimaryBorderColor, #e0e0e0)';

        var isoRx = parseFloat(mxUtils.getValue(style, 'isoRx', 35));
        var isoRy = parseFloat(mxUtils.getValue(style, 'isoRy', 35));
        var isoRz = parseFloat(mxUtils.getValue(style, 'isoRz', 0));
        var isoZ = parseFloat(mxUtils.getValue(style, 'isoZ', 50));

        function updateValue(key, value)
        {
            graph.getModel().beginUpdate();
            try
            {
                graph.setCellStyles(key, value, [cell]);
                graph.refresh();
            }
            finally
            {
                graph.getModel().endUpdate();
            }
        }

        var row1 = document.createElement('div');
        row1.style.display = 'flex';
        row1.style.marginBottom = '8px';
        row1.style.alignItems = 'center';

        var label1 = document.createElement('div');
        label1.style.width = '80px';
        label1.style.fontSize = '12px';
        label1.textContent = 'Rotation X:';
        row1.appendChild(label1);

        var input1 = document.createElement('input');
        input1.type = 'number';
        input1.value = isoRx;
        input1.style.width = '60px';
        input1.style.marginRight = '8px';
        input1.onchange = function() { updateValue('isoRx', this.value); };
        row1.appendChild(input1);

        var label2 = document.createElement('div');
        label2.style.width = '80px';
        label2.style.fontSize = '12px';
        label2.textContent = 'Rotation Y:';
        row1.appendChild(label2);

        var input2 = document.createElement('input');
        input2.type = 'number';
        input2.value = isoRy;
        input2.style.width = '60px';
        input2.onchange = function() { updateValue('isoRy', this.value); };
        row1.appendChild(input2);

        panel.appendChild(row1);

        var row2 = document.createElement('div');
        row2.style.display = 'flex';
        row2.style.marginBottom = '8px';
        row2.style.alignItems = 'center';

        var label3 = document.createElement('div');
        label3.style.width = '80px';
        label3.style.fontSize = '12px';
        label3.textContent = 'Rotation Z:';
        row2.appendChild(label3);

        var input3 = document.createElement('input');
        input3.type = 'number';
        input3.value = isoRz;
        input3.style.width = '60px';
        input3.style.marginRight = '8px';
        input3.onchange = function() { updateValue('isoRz', this.value); };
        row2.appendChild(input3);

        var label4 = document.createElement('div');
        label4.style.width = '80px';
        label4.style.fontSize = '12px';
        label4.textContent = 'Depth:';
        row2.appendChild(label4);

        var input4 = document.createElement('input');
        input4.type = 'number';
        input4.value = isoZ;
        input4.style.width = '60px';
        input4.onchange = function() { updateValue('isoZ', this.value); };
        row2.appendChild(input4);

        panel.appendChild(row2);

        // Insert at the top of format container
        if (fmt.container.firstChild)
        {
            fmt.container.insertBefore(panel, fmt.container.firstChild);
        }
        else
        {
            fmt.container.appendChild(panel);
        }
    }

    // Update format panel when selection changes
    graph.addListener(mxEvent.CHANGE, function()
    {
        renderIsoExtrudeFormatPanel();
    });

    graph.addListener(mxEvent.CELLS_SELECTED, function()
    {
        renderIsoExtrudeFormatPanel();
    });

    // Initial render
    setTimeout(renderIsoExtrudeFormatPanel, 100);
});

