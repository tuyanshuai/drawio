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
        var baseFill = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, '#26a0da');
        var strokeColor = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, '#1e78b7');
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

        c.setStrokeColor(strokeColor);
        c.setStrokeWidth(this.strokewidth);
        // Honor style-provided opacities; default to fully opaque
        var fillOpacity = parseFloat(mxUtils.getValue(style, 'fillOpacity', 1));
        if (isNaN(fillOpacity)) fillOpacity = 1;
        var strokeOpacity = parseFloat(mxUtils.getValue(style, 'strokeOpacity', 1));
        if (isNaN(strokeOpacity)) strokeOpacity = 1;
        c.setFillAlpha(Math.max(0, Math.min(1, fillOpacity)));
        c.setStrokeAlpha(Math.max(0, Math.min(1, strokeOpacity)));

        for (var fi2 = 0; fi2 < faceInfo.length; fi2++)
        {
            var f = faceInfo[fi2];
            // Normalize normal
            var n = f.normal; var nmag = Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z) || 1;
            var nx=n.x/nmag, ny=n.y/nmag, nz=n.z/nmag;
            var ndotl = Math.max(0, -(nx*light.x + ny*light.y + nz*light.z));
            var tint = shade(baseFill, 0.55 + 0.45 * ndotl);
            c.begin();
            c.moveTo(v[f.idx[0]].x, v[f.idx[0]].y);
            for (var j = 1; j < f.idx.length; j++) c.lineTo(v[f.idx[j]].x, v[f.idx[j]].y);
            c.close();
            c.setFillColor(tint);
            c.fillAndStroke();
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
        for (var ei = 0; ei < edges.length; ei++)
        {
            var e = edges[ei];
            var adj = edgeFaces(e[0], e[1]);
            // Edge style policy (engineering drawing style):
            // - Any adjacent face front-facing -> solid (visible outline or seam)
            // - Both adjacent faces back-facing -> dashed (hidden edge)
            var dashed = false;
            if (adj.length === 2)
            {
                var f0 = faceVisible[adj[0]];
                var f1 = faceVisible[adj[1]];
                dashed = (!f0 && !f1);
            }
            c.setDashed(dashed);
            c.setStrokeColor(strokeColor);
            c.begin();
            c.moveTo(v[e[0]].x, v[e[0]].y);
            c.lineTo(v[e[1]].x, v[e[1]].y);
            c.stroke();
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

    // --- Insert menu item ---
    // Try to add into Insert menu if present
    var insertMenu = editorUi.menus.get('insert');
    if (insertMenu != null)
    {
        var oldInsertFunct = insertMenu.funct;
        insertMenu.funct = function(menu, parent)
        {
            oldInsertFunct.apply(this, arguments);
            editorUi.menus.addMenuItems(menu, ['-', 'insertIsoCube'], parent);
        };
    }
    // Also add into Extras for visibility in UIs without Insert
    var extrasMenu = editorUi.menus.get('extras');
    if (extrasMenu != null)
    {
        var oldExtrasFunct = extrasMenu.funct;
        extrasMenu.funct = function(menu, parent)
        {
            oldExtrasFunct.apply(this, arguments);
            editorUi.menus.addMenuItems(menu, ['-', 'insertIsoCube'], parent);
        };
    }

    mxResources.parse('insertIsoCube=3D Cube (Isometric)');
    editorUi.actions.addAction('insertIsoCube', function()
    {
        var gs = graph.getGridSize();
        var parent = graph.getDefaultParent();
        var w = 120, h = 120;
        var v = graph.insertVertex(parent, null, '', gs * 2, gs * 2, w, h,
            'shape=isoCube;isoZ=100;isoRx=35;isoRy=35;isoRz=0;fillColor=#26a0da;strokeColor=#1e78b7;rounded=0;');
        graph.setSelectionCell(v);
    });

    // --- Sidebar palette entry ---
    var sb = editorUi.sidebar;
    function addIsoPalette()
    {
        if (sb != null)
        {
            sb.addPalette('isometric', 'Isometric', false, function(content)
            {
                (function(){
                    var cell = new mxCell('', new mxGeometry(0, 0, 120, 120),
                        'shape=isoCube;isoZ=100;isoRx=35;isoRy=35;isoRz=0;fillColor=#26a0da;strokeColor=#1e78b7;rounded=0;');
                    cell.vertex = true;
                    content.appendChild(sb.createVertexTemplateFromCells([cell], 120, 120, 'Cube'));
                })();
            });
        }
    };
    addIsoPalette();
    if (sb != null)
    {
        var sbInit = sb.init;
        sb.init = function()
        {
            sbInit.apply(this, arguments);
            addIsoPalette();
        };
    }

    // --- Property panel for isoCube ---
    var propWin = null;
    function ensurePropWindow()
    {
        if (propWin != null) return propWin;
        var container = document.createElement('div');
        container.style.background = Editor.isDarkMode() ? Editor.darkColor : '#ffffff';
        container.style.padding = '8px';
        container.style.border = '1px solid lightgray';
        container.style.minWidth = '220px';

        function addRow(labelText, key, min, max, step)
        {
            var row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '6px';
            row.style.marginBottom = '6px';
            var label = document.createElement('label');
            label.style.flex = '0 0 48px';
            mxUtils.write(label, labelText);
            var input = document.createElement('input');
            input.type = 'number';
            input.style.flex = '1 1 auto';
            input.min = (min != null) ? String(min) : '';
            input.max = (max != null) ? String(max) : '';
            input.step = (step != null) ? String(step) : '1';

            mxEvent.addListener(input, 'change', function()
            {
                var cell = graph.getSelectionCell();
                if (cell != null && graph.getModel().isVertex(cell) && graph.getCurrentCellStyle(cell)['shape'] === 'isoCube')
                {
                    var val = input.value;
                    graph.getModel().beginUpdate();
                    try
                    {
                        graph.setCellStyles(key, val, [cell]);
                        // Force immediate repaint so visibility is recomputed after rotation/depth changes
                        graph.refresh(cell);
                    }
                    finally
                    {
                        graph.getModel().endUpdate();
                    }
                }
            });

            row.appendChild(label);
            row.appendChild(input);
            container.appendChild(row);

            return input;
        };

        var rxIn = addRow('Rot X', 'isoRx', -180, 180, 1);
        var ryIn = addRow('Rot Y', 'isoRy', -180, 180, 1);
        var rzIn = addRow('Rot Z', 'isoRz', -180, 180, 1);
        var dIn  = addRow('Depth', 'isoZ', 0, 1000, 1);

        propWin = new mxWindow('Isometric Cube', container, document.body.offsetWidth - 280, 100, 240, 160, true, true);
        propWin.destroyOnClose = false;
        propWin.setMaximizable(false);
        propWin.setResizable(false);
        propWin.setClosable(true);

        function syncInputs(cell)
        {
            var style = (cell != null) ? graph.getCurrentCellStyle(cell) : null;
            if (style != null && style['shape'] === 'isoCube')
            {
                rxIn.value = mxUtils.getValue(style, 'isoRx', 35);
                ryIn.value = mxUtils.getValue(style, 'isoRy', 35);
                rzIn.value = mxUtils.getValue(style, 'isoRz', 0);
                dIn.value  = mxUtils.getValue(style, 'isoZ', 100);
                propWin.setVisible(true);
            }
            else
            {
                propWin.setVisible(false);
            }
        };

        graph.getSelectionModel().addListener(mxEvent.CHANGE, function()
        {
            syncInputs(graph.getSelectionCell());
        });
        graph.getModel().addListener(mxEvent.CHANGE, function()
        {
            if (propWin.isVisible()) syncInputs(graph.getSelectionCell());
        });

        // Initial state
        syncInputs(graph.getSelectionCell());
        return propWin;
    };

    // Lazy create the window when needed
    graph.selectionModel.addListener(mxEvent.CHANGE, function()
    {
        var cell = graph.getSelectionCell();
        var style = (cell != null) ? graph.getCurrentCellStyle(cell) : null;
        if (style != null && style['shape'] === 'isoCube')
        {
            ensurePropWindow();
        }
    });
});


