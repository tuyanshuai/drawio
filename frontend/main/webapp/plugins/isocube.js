/**
 * Isometric Cube plugin (pseudo-3D using 2D drawing)
 * Adds shape "isoCube" and a simple UI to adjust isoRx, isoRy, isoRz, isoZ.
 */
Draw.loadPlugin(function(editorUi)
{
    var graph = editorUi.editor.graph;

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

        // 8 vertices in a fixed, well-known order:
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
        // Rotate (3D) first, then project for drawing
        var vr = [];
        for (var i = 0; i < 8; i++) vr[i] = rotate(v3[i]);
        var v = [];
        for (var i = 0; i < 8; i++) v[i] = project(vr[i]);

        // Faces with consistent CCW winding so normals point outward
        var faces = [
            [0,2,3,1], // back (-Z)
            [4,5,7,6], // front (+Z)
            [0,4,6,2], // left (-X)
            [1,3,7,5], // right (+X)
            [0,1,5,4], // bottom (-Y)
            [2,6,7,3]  // top (+Y)
        ];

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
        var baseFill = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, null);
        // Check if strokeColor is explicitly set, if not default to none (line disabled)
        var strokeColor = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, null);
        if (strokeColor == null || strokeColor === '') strokeColor = 'none';
        var light = {x: 0.35, y: -0.5, z: -0.8};
        var lmag = Math.sqrt(light.x*light.x + light.y*light.y + light.z*light.z) || 1;
        light.x/=lmag; light.y/=lmag; light.z/=lmag;

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
        };

        // Line/Fill style should match standard Style > Line behavior
        // Respect Style > Line settings; draw lines unless Line is disabled
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
        var baseDashed = String(mxUtils.getValue(style, mxConstants.STYLE_DASHED, '0')) === '1';
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
        // console.log('strokeColor:', strokeColor, 'strokeColorNone:', strokeColorNone, 'strokeWidth:', strokeWidth, 'strokeOpacity:', strokeOpacity, 'strokeEnabled:', strokeEnabled);
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
                c.begin();
                c.moveTo(v[f.idx[0]].x, v[f.idx[0]].y);
                for (var j = 1; j < f.idx.length; j++) c.lineTo(v[f.idx[j]].x, v[f.idx[j]].y);
                c.close();
                c.setFillColor(tint);
                if (strokeEnabled) { c.fillAndStroke(); } else { c.fill(); }
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
        var topCircle = [];
        var bottomCircle = [];
        
        for (var i = 0; i < numSamples; i++)
        {
            var angle = (i / numSamples) * 2 * Math.PI;
            var px = sx * Math.cos(angle);
            var py = sy * Math.sin(angle);
            
            // Top circle at z = sz
            topCircle.push({x: px, y: py, z: sz});
            // Bottom circle at z = -sz
            bottomCircle.push({x: px, y: py, z: -sz});
        }

        // Rotate and project all vertices
        var allVertices = topCircle.concat(bottomCircle);
        var rotatedVertices = [];
        var projectedVertices = [];
        
        for (var i = 0; i < allVertices.length; i++)
        {
            var rotated = rotate(allVertices[i]);
            rotatedVertices.push(rotated);
            projectedVertices.push(project(rotated));
        }

        // Create faces: top circle, bottom circle, and side surface
        var faces = [];
        
        // Top face (CCW)
        var topFaceIndices = [];
        for (var i = 0; i < numSamples; i++)
        {
            topFaceIndices.push(i);
        }
        faces.push({indices: topFaceIndices, isTop: true});
        
        // Bottom face (CW for correct normal)
        var bottomFaceIndices = [];
        for (var i = numSamples - 1; i >= 0; i--)
        {
            bottomFaceIndices.push(i + numSamples);
        }
        faces.push({indices: bottomFaceIndices, isBottom: true});
        
        // Side faces (connecting top and bottom circles)
        for (var i = 0; i < numSamples; i++)
        {
            var next = (i + 1) % numSamples;
            faces.push({
                indices: [i, next, next + numSamples, i + numSamples],
                isSide: true
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
        
        var fillEnabled = !isNoneFill(baseFill) && fillOpacity > 0;
        
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
                c.begin();
                c.moveTo(projectedVertices[f.indices[0]].x, projectedVertices[f.indices[0]].y);
                for (var j = 1; j < f.indices.length; j++) 
                {
                    c.lineTo(projectedVertices[f.indices[j]].x, projectedVertices[f.indices[j]].y);
                }
                c.close();
                c.setFillColor(tint);
                if (strokeEnabled) { c.fillAndStroke(); } else { c.fill(); }
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
        if (sb != null)
        {
            // Remove existing palette if it exists to avoid duplicates
            if (sb.palettes['isometric'])
            {
                sb.removePalette('isometric');
            }
            
            sb.addPalette('isometric', '3D 形状', true, function(content)
            {
                (function(){
                    // Cube
                    var cell = new mxCell('', new mxGeometry(0, 0, 250, 250),
                        'shape=isoCube;isoZ=70;isoRx=35;isoRy=35;isoRz=0;fillColor=none;strokeColor=#1e78b7;rounded=0;');
                    cell.vertex = true;
                    content.appendChild(sb.createVertexTemplateFromCells([cell], 120, 120, 'Cube'));
                    
                    // Cylinder
                    var cell2 = new mxCell('', new mxGeometry(0, 0, 250, 250),
                        'shape=isoCylinder;isoZ=70;isoRx=35;isoRy=35;isoRz=0;fillColor=none;strokeColor=#1e78b7;rounded=0;');
                    cell2.vertex = true;
                    content.appendChild(sb.createVertexTemplateFromCells([cell2], 120, 120, 'Cylinder'));
                })();
            });
        }
    };
    
    // Add palette immediately
    addIsoPalette();
    
    // Handles reload of sidebar after dark mode change or reinit
    if (sb != null)
    {
        var sbInit = sb.init;
        sb.init = function()
        {
            // Add Isometric palette BEFORE General palette
            addIsoPalette();
            sbInit.apply(this, arguments);
        };
    }

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

        // Insert rows directly into the existing format container without separate section title
        var first = fmt.container.firstChild;
        if (first) fmt.container.insertBefore(panel, first.nextSibling);
        else fmt.container.appendChild(panel);

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

            mxEvent.addListener(input, 'change', function()
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
            });

            row.appendChild(label);
            row.appendChild(input);
            panel.appendChild(row);
        }

        addNumber('Rot X', 'isoRx', -180, 180, 1);
        addNumber('Rot Y', 'isoRy', -180, 180, 1);
        addNumber('Rot Z', 'isoRz', -180, 180, 1);
        addNumber('Depth', 'isoZ', 0, 2000, 1);
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
});


