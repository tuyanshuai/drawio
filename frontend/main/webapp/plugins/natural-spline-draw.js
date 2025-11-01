/**
 * Natural Spline Drawing Plugin - 手动绘制自然样条曲线工具
 * 允许用户通过点击画布上的点来手动绘制经过这些点的自然样条曲线
 */
Draw.loadPlugin(function(editorUi)
{
	if (editorUi.editor.isChromelessView())
	{
		return;
	}
	
	var graph = editorUi.editor.graph;
	
	/**
	 * 自然样条插值算法
	 * 使用三次样条插值，边界条件为自然样条（二阶导数为0）
	 */
	function naturalSplineInterpolation(points)
	{
		if (!points || points.length < 2)
		{
			return [];
		}
		
		var n = points.length - 1;
		
		if (n === 0)
		{
			return [points[0]];
		}
		
		if (n === 1)
		{
			// 只有两个点，返回线性插值
			return [points[0], points[1]];
		}
		
		// 计算每个点之间的距离（参数化）
		var t = [0];
		var cumulativeDist = 0;
		for (var i = 1; i < points.length; i++)
		{
			var dx = points[i].x - points[i - 1].x;
			var dy = points[i].y - points[i - 1].y;
			cumulativeDist += Math.sqrt(dx * dx + dy * dy);
			t.push(cumulativeDist);
		}
		
		// 归一化参数到 [0, 1]
		var totalDist = t[t.length - 1];
		if (totalDist === 0)
		{
			return points;
		}
		
		for (var i = 0; i < t.length; i++)
		{
			t[i] = t[i] / totalDist;
		}
		
		// 设置自然样条边界条件（二阶导数为0）
		// 建立三对角矩阵求解系统
		var h = [];
		var alpha = [];
		var l = [];
		var mu = [];
		var z = [];
		var c = [];
		var b = [];
		var d = [];
		
		// 初始化数组
		for (var i = 0; i <= n; i++)
		{
			h.push(0);
			alpha.push(0);
			l.push(0);
			mu.push(0);
			z.push(0);
			c.push(0);
			b.push(0);
			d.push(0);
		}
		
		// 计算 h[i] = t[i+1] - t[i]
		for (var i = 0; i < n; i++)
		{
			h[i] = t[i + 1] - t[i];
		}
		
		// 建立线性系统
		for (var i = 1; i < n; i++)
		{
			alpha[i] = (3 / h[i]) * (points[i + 1].y - points[i].y) - 
			           (3 / h[i - 1]) * (points[i].y - points[i - 1].y);
		}
		
		// 自然样条边界条件：c[0] = 0, c[n] = 0
		l[0] = 1;
		mu[0] = 0;
		z[0] = 0;
		
		for (var i = 1; i < n; i++)
		{
			l[i] = 2 * (t[i + 1] - t[i - 1]) - h[i - 1] * mu[i - 1];
			mu[i] = h[i] / l[i];
			z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
		}
		
		l[n] = 1;
		z[n] = 0;
		c[n] = 0;
		
		// 回代求解 c[i]
		for (var j = n - 1; j >= 0; j--)
		{
			c[j] = z[j] - mu[j] * c[j + 1];
			b[j] = (points[j + 1].y - points[j].y) / h[j] - 
			       h[j] * (c[j + 1] + 2 * c[j]) / 3;
			d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
		}
		
		// 同样处理 x 坐标
		var cx = [];
		var bx = [];
		var dx = [];
		
		for (var i = 0; i <= n; i++)
		{
			cx.push(0);
			bx.push(0);
			dx.push(0);
		}
		
		// 建立 x 坐标的线性系统
		var alphax = [];
		var lx = [];
		var mux = [];
		var zx = [];
		
		for (var i = 0; i <= n; i++)
		{
			alphax.push(0);
			lx.push(0);
			mux.push(0);
			zx.push(0);
		}
		
		for (var i = 1; i < n; i++)
		{
			alphax[i] = (3 / h[i]) * (points[i + 1].x - points[i].x) - 
			            (3 / h[i - 1]) * (points[i].x - points[i - 1].x);
		}
		
		lx[0] = 1;
		mux[0] = 0;
		zx[0] = 0;
		
		for (var i = 1; i < n; i++)
		{
			lx[i] = 2 * (t[i + 1] - t[i - 1]) - h[i - 1] * mux[i - 1];
			mux[i] = h[i] / lx[i];
			zx[i] = (alphax[i] - h[i - 1] * zx[i - 1]) / lx[i];
		}
		
		lx[n] = 1;
		zx[n] = 0;
		cx[n] = 0;
		
		for (var j = n - 1; j >= 0; j--)
		{
			cx[j] = zx[j] - mux[j] * cx[j + 1];
			bx[j] = (points[j + 1].x - points[j].x) / h[j] - 
			        h[j] * (cx[j + 1] + 2 * cx[j]) / 3;
			dx[j] = (cx[j + 1] - cx[j]) / (3 * h[j]);
		}
		
		// 生成平滑曲线点
		var curvePoints = [];
		var segmentsPerInterval = 30; // 每个区间生成30个点（增加采样率以提高平滑度）
		
		for (var i = 0; i < n; i++)
		{
			for (var j = 0; j <= segmentsPerInterval; j++)
			{
				var u = j / segmentsPerInterval; // 相对于当前区间的参数 [0, 1]
				var deltaT = u * h[i]; // 在当前区间内的参数值
				
				// 三次样条插值公式：S(t) = a + b*(t-ti) + c*(t-ti)^2 + d*(t-ti)^3
				// 其中 a = points[i], t-ti = deltaT
				var x = points[i].x + bx[i] * deltaT + 
				        cx[i] * deltaT * deltaT + 
				        dx[i] * deltaT * deltaT * deltaT;
				
				var y = points[i].y + b[i] * deltaT + 
				        c[i] * deltaT * deltaT + 
				        d[i] * deltaT * deltaT * deltaT;
				
				curvePoints.push({x: x, y: y});
			}
		}
		
		// 确保包含最后一个点
		if (curvePoints.length === 0 || 
		    Math.abs(curvePoints[curvePoints.length - 1].x - points[n].x) > 0.001 ||
		    Math.abs(curvePoints[curvePoints.length - 1].y - points[n].y) > 0.001)
		{
			curvePoints.push({x: points[n].x, y: points[n].y});
		}
		
		return curvePoints;
	}
	
	/**
	 * 自定义自然样条曲线形状 - 使用相对坐标绘制曲线
	 */
	function NaturalSplineShape()
	{
		mxActor.call(this);
	};
	
	mxUtils.extend(NaturalSplineShape, mxActor);
	
	NaturalSplineShape.prototype.isHtmlAllowed = function()
	{
		return false;
	};
	
	NaturalSplineShape.prototype.redrawPath = function(c, x, y, w, h)
	{
		var splineCoords = this.getSplineCoords();
		
		if (window.console && this.state && this.state.cell)
		{
			console.log('[Natural Spline Draw] redrawPath - coords count:', splineCoords ? splineCoords.length : 0, 'w:', w, 'h:', h);
		}
		
		if (splineCoords && splineCoords.length >= 2)
		{
			// 注意：此时 canvas 已经被 translate(x, y)，所以使用相对于 (0,0) 的坐标
			var firstX = splineCoords[0][0] * w;
			var firstY = splineCoords[0][1] * h;
			c.moveTo(firstX, firstY);
			
			if (window.console && this.state && this.state.cell && splineCoords.length <= 10)
			{
				console.log('[Natural Spline Draw] First point:', firstX, firstY, 'from coords:', splineCoords[0]);
			}
			
			for (var i = 1; i < splineCoords.length; i++)
			{
				var px = splineCoords[i][0] * w;
				var py = splineCoords[i][1] * h;
				c.lineTo(px, py);
				
				if (window.console && this.state && this.state.cell && splineCoords.length <= 10 && i === 1)
				{
					console.log('[Natural Spline Draw] Second point:', px, py, 'from coords:', splineCoords[i]);
				}
			}
			
			// 曲线是开放路径，不闭合
			// mxActor 的 paintVertexShape 会调用 fillAndStroke()，但如果 fillColor=none，只会描边
		}
		else
		{
			if (window.console)
			{
				console.warn('[Natural Spline Draw] redrawPath - 坐标不足，无法绘制:', {
					splineCoords: splineCoords,
					length: splineCoords ? splineCoords.length : 0,
					style: this.style ? Object.keys(this.style).slice(0, 5) : null
				});
			}
		}
	};
	
	NaturalSplineShape.prototype.getSplineCoords = function()
	{
		try
		{
			var coordsStr = mxUtils.getValue(this.style, 'splineCoords', '[]');
			
			if (window.console && this.state && this.state.cell)
			{
				console.log('[Natural Spline Draw] getSplineCoords - raw string:', coordsStr, 'type:', typeof coordsStr);
			}
			
			// 如果已经是数组，直接返回
			if (Array.isArray(coordsStr))
			{
				return coordsStr;
			}
			
			// 如果是字符串，尝试解析
			if (typeof coordsStr === 'string')
			{
				var parsed = JSON.parse(coordsStr);
				
				if (window.console && this.state && this.state.cell)
				{
					console.log('[Natural Spline Draw] getSplineCoords - parsed:', parsed, 'length:', parsed ? parsed.length : 0);
				}
				
				return parsed;
			}
			
			return [];
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[Natural Spline Draw] 解析 splineCoords 失败:', e, 'coordsStr:', mxUtils.getValue(this.style, 'splineCoords', '[]'));
			}
			return [];
		}
	};
	
	// 注册自定义形状
	mxCellRenderer.registerShape('naturalSpline', NaturalSplineShape);
	
	/**
	 * 自然样条曲线绘制工具 - 允许通过点击点来手动绘制
	 */
	function NaturalSplineDrawingTool(editorUi)
	{
		this.editorUi = editorUi;
		this.graph = editorUi.editor.graph;
		this.enabled = false;
		this.points = [];
		this.previewCell = null;
		this.pointHandles = [];
		this.mouseHandler = null;
		this.escapeHandler = null;
		this.keyDownHandler = null;
		this.viewChangeHandler = null;
	}
	
	/**
	 * 开始绘制曲线
	 */
	NaturalSplineDrawingTool.prototype.startDrawing = function()
	{
		if (this.enabled)
		{
			this.stopDrawing();
			return;
		}
		
		this.enabled = true;
		this.points = [];
		this.clearPreview();
		
		// 改变光标
		this.graph.container.style.cursor = 'crosshair';
		
		// 添加鼠标监听器
		var graph = this.graph;
		var tool = this;
		
		this.mouseHandler = {
			tool: this,
			mouseDown: function(sender, me)
			{
				if (!this.tool.enabled || !graph.isEnabled())
				{
					return;
				}
				
				var e = me.getEvent();
				
				// 处理中键
				if (mxEvent.isMiddleMouseButton(e))
				{
					return;
				}
				
				// 右键点击完成绘制
				if (mxEvent.isRightMouseButton(e) || mxEvent.isPopupTrigger(e))
				{
					if (this.tool.points.length >= 2)
					{
						this.tool.finishSpline();
					}
					else
					{
						this.tool.stopDrawing();
					}
					me.consume();
					return;
				}
				
				// 获取图形模型坐标中的点（使用 getPointForEvent 转换为模型坐标）
				var pt = graph.getPointForEvent(e, false);
				
				// 检查双击完成
				if (me.getEvent().detail === 2)
				{
					if (this.tool.points.length >= 2)
					{
						this.tool.finishSpline();
					}
					else
					{
						this.tool.stopDrawing();
					}
					me.consume();
					return;
				}
				
				// 添加点（左键点击）
				this.tool.addPoint(pt.x, pt.y);
				me.consume();
			},
			mouseMove: function(sender, me)
			{
				if (!this.tool.enabled)
				{
					return;
				}
				
				if (this.tool.points.length > 0)
				{
					var pt = graph.getPointForEvent(me.getEvent(), false);
					this.tool.updatePreview(pt.x, pt.y);
				}
			},
			mouseUp: function(sender, me)
			{
				// 在 mouseDown 中处理
			}
		};
		
		this.graph.addMouseListener(this.mouseHandler);
		
		// 监听视图变化，更新点句柄位置
		this.viewChangeHandler = mxUtils.bind(this, function()
		{
			if (this.enabled && this.pointHandles.length > 0)
			{
				this.updatePointHandles();
			}
		});
		
		this.graph.view.addListener(mxEvent.SCALE, this.viewChangeHandler);
		this.graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, this.viewChangeHandler);
		this.graph.view.addListener(mxEvent.TRANSLATE, this.viewChangeHandler);
		
		// 监听 ESC 键
		this.escapeHandler = mxUtils.bind(this, function(sender, evt)
		{
			if (this.enabled)
			{
				this.stopDrawing();
			}
		});
		
		this.graph.addListener(mxEvent.ESCAPE, this.escapeHandler);
		
		// 监听 Enter 键完成绘制
		this.keyDownHandler = mxUtils.bind(this, function(evt)
		{
			if (this.enabled && graph.isEnabled())
			{
				var keyCode = evt.keyCode || evt.which;
				if (keyCode === 13) // Enter
				{
					if (this.points.length >= 2)
					{
						this.finishSpline();
						mxEvent.consume(evt);
					}
				}
			}
		});
		
		mxEvent.addListener(document, 'keydown', this.keyDownHandler);
		
		if (window.console)
		{
			console.log('[Natural Spline Draw] 开始绘制曲线，点击添加点，右键/双击/Enter完成，ESC取消');
		}
	};
	
	/**
	 * 停止绘制
	 */
	NaturalSplineDrawingTool.prototype.stopDrawing = function()
	{
		if (!this.enabled)
		{
			return;
		}
		
		this.enabled = false;
		this.points = [];
		this.clearPreview();
		
		// 恢复光标
		this.graph.container.style.cursor = '';
		
		// 移除鼠标监听器
		if (this.mouseHandler)
		{
			this.graph.removeMouseListener(this.mouseHandler);
			this.mouseHandler = null;
		}
		
		// 移除键盘监听器
		if (this.escapeHandler)
		{
			this.graph.removeListener(this.escapeHandler);
			this.escapeHandler = null;
		}
		
		if (this.keyDownHandler)
		{
			mxEvent.removeListener(document, 'keydown', this.keyDownHandler);
			this.keyDownHandler = null;
		}
		
		// 移除视图变化监听器
		if (this.viewChangeHandler)
		{
			this.graph.view.removeListener(this.viewChangeHandler);
			this.viewChangeHandler = null;
		}
		
		if (window.console)
		{
			console.log('[Natural Spline Draw] 停止绘制');
		}
	};
	
	/**
	 * 添加点
	 */
	NaturalSplineDrawingTool.prototype.addPoint = function(x, y)
	{
		// 检查是否与上一个点太接近（距离阈值：5像素）
		var minDistance = 5;
		if (this.points.length > 0)
		{
			var lastPoint = this.points[this.points.length - 1];
			var dx = x - lastPoint.x;
			var dy = y - lastPoint.y;
			var distance = Math.sqrt(dx * dx + dy * dy);
			
			if (distance < minDistance)
			{
				if (window.console)
				{
					console.log('[Natural Spline Draw] 忽略与上一个点太接近的点，距离:', distance.toFixed(2), '像素');
				}
				return; // 忽略这个点
			}
		}
		
		this.points.push({x: x, y: y});
		
		// 创建可视化点句柄
		this.createPointHandle(x, y, this.points.length - 1);
		
		if (window.console)
		{
			console.log('[Natural Spline Draw] 添加点:', x + ',' + y, '共', this.points.length, '个点');
		}
		
		// 更新预览
		if (this.points.length > 1)
		{
			this.updatePreview(x, y);
		}
	};
	
	/**
	 * 创建点句柄（可视化标记）
	 */
	NaturalSplineDrawingTool.prototype.createPointHandle = function(x, y, index)
	{
		var handle = document.createElement('div');
		handle.style.position = 'absolute';
		handle.style.width = '8px';
		handle.style.height = '8px';
		handle.style.borderRadius = '50%';
		handle.style.backgroundColor = '#2196F3';
		handle.style.border = '2px solid white';
		handle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
		handle.style.pointerEvents = 'none';
		handle.style.zIndex = '10000';
		handle.className = 'spline-point-handle';
		handle.setAttribute('data-index', index);
		
		// 更新位置
		this.updateHandlePosition(handle, x, y);
		
		// 添加到 document.body 以确保正确的定位
		document.body.appendChild(handle);
		this.pointHandles.push(handle);
	};
	
	/**
	 * 更新点句柄位置
	 */
	NaturalSplineDrawingTool.prototype.updateHandlePosition = function(handle, x, y)
	{
		// x, y 是模型坐标，需要转换为绝对屏幕坐标
		var view = this.graph.view;
		var scale = view.scale;
		var tr = view.translate;
		
		// 模型坐标转视图坐标（相对于容器内部）
		var viewX = (x + tr.x) * scale;
		var viewY = (y + tr.y) * scale;
		
		// 获取容器在页面中的位置
		var offset = mxUtils.getOffset(this.graph.container);
		var scrollOrigin = mxUtils.getScrollOrigin(this.graph.container);
		
		// 计算绝对屏幕坐标
		var screenX = offset.x + viewX - scrollOrigin.x;
		var screenY = offset.y + viewY - scrollOrigin.y;
		
		handle.style.left = (screenX - 4) + 'px';
		handle.style.top = (screenY - 4) + 'px';
	};
	
	/**
	 * 更新预览
	 */
	NaturalSplineDrawingTool.prototype.updatePreview = function(currentX, currentY)
	{
		if (this.points.length === 0)
		{
			return;
		}
		
		// 如果鼠标位置与最后一个点太接近，使用最后一个点作为预览终点
		// 这样可以避免边界框过小导致的问题
		var minDistance = 5;
		var previewPoint = {x: currentX, y: currentY};
		if (this.points.length > 0)
		{
			var lastPoint = this.points[this.points.length - 1];
			var dx = currentX - lastPoint.x;
			var dy = currentY - lastPoint.y;
			var distance = Math.sqrt(dx * dx + dy * dy);
			
			if (distance < minDistance)
			{
				// 使用最后一个点的偏移位置，确保边界框有足够大小
				previewPoint = {
					x: lastPoint.x + (distance > 0 ? (dx / distance) * minDistance : minDistance),
					y: lastPoint.y + (distance > 0 ? (dy / distance) * minDistance : 0)
				};
			}
		}
		
		// 计算包括所有点和当前鼠标位置的边界框
		var allPoints = this.points.slice();
		allPoints.push(previewPoint);
		
		// 生成样条曲线点
		var curvePoints = naturalSplineInterpolation(allPoints);
		
		if (window.console)
		{
			console.log('[Natural Spline Draw] updatePreview - 输入点数:', allPoints.length, '生成曲线点数:', curvePoints.length);
		}
		
		if (curvePoints.length < 2)
		{
			if (window.console)
			{
				console.warn('[Natural Spline Draw] updatePreview - 生成的曲线点不足');
			}
			return;
		}
		
		// 计算边界框
		var minX = curvePoints[0].x;
		var minY = curvePoints[0].y;
		var maxX = curvePoints[0].x;
		var maxY = curvePoints[0].y;
		
		for (var i = 0; i < curvePoints.length; i++)
		{
			minX = Math.min(minX, curvePoints[i].x);
			minY = Math.min(minY, curvePoints[i].y);
			maxX = Math.max(maxX, curvePoints[i].x);
			maxY = Math.max(maxY, curvePoints[i].y);
		}
		
		// 确保边界框有最小尺寸，避免当点重叠或接近时计算出现问题
		var minSize = 10; // 最小边界框尺寸（像素）
		var width = Math.max(maxX - minX, minSize);
		var height = Math.max(maxY - minY, minSize);
		
		// 如果宽度或高度太小，扩展边界框
		if (maxX - minX < minSize)
		{
			var centerX = (minX + maxX) / 2;
			minX = centerX - minSize / 2;
			maxX = centerX + minSize / 2;
			width = minSize;
		}
		if (maxY - minY < minSize)
		{
			var centerY = (minY + maxY) / 2;
			minY = centerY - minSize / 2;
			maxY = centerY + minSize / 2;
			height = minSize;
		}
		
		// 转换为相对坐标（参考polygon的坐标转化函数）
		var relativePoints = [];
		for (var i = 0; i < curvePoints.length; i++)
		{
			var relX = width > 0 ? (curvePoints[i].x - minX) / width : 0.5;
			var relY = height > 0 ? (curvePoints[i].y - minY) / height : 0.5;
			
			// 确保相对坐标在有效范围内 [0, 1]
			relX = Math.max(0, Math.min(1, relX));
			relY = Math.max(0, Math.min(1, relY));
			
			relativePoints.push([relX, relY]);
		}
		
		// 创建或更新预览单元格
		var parent = this.graph.getDefaultParent();
		var fillColor = mxUtils.getValue(this.graph.currentVertexStyle, mxConstants.STYLE_FILLCOLOR, '#ffffff');
		var strokeColor = mxUtils.getValue(this.graph.currentVertexStyle, mxConstants.STYLE_STROKECOLOR, '#000000');
		
		var style = 'shape=naturalSpline;' +
			'splineCoords=' + JSON.stringify(relativePoints) + ';' +
			'fillColor=none;' +
			'strokeColor=' + strokeColor + 
			';strokeWidth=2;' +
			'opacity=60;' +
			'whiteSpace=wrap;';
		
		if (this.previewCell == null)
		{
			this.graph.getModel().beginUpdate();
			try
			{
				this.previewCell = this.graph.insertVertex(parent, null, '', minX, minY, width, height, style);
				this.graph.setCellsLocked([this.previewCell], true);
				this.graph.setCellStyle('opacity=60', [this.previewCell]);
			}
			finally
			{
				this.graph.getModel().endUpdate();
			}
		}
		else
		{
			this.graph.getModel().beginUpdate();
			try
			{
				var geo = new mxGeometry(minX, minY, width, height);
				this.graph.getModel().setGeometry(this.previewCell, geo);
				this.graph.getModel().setStyle(this.previewCell, style);
			}
			finally
			{
				this.graph.getModel().endUpdate();
			}
		}
		
		this.graph.view.validate();
		this.graph.refresh(this.previewCell);
		
		// 更新点句柄位置
		this.updatePointHandles();
	};
	
	/**
	 * 更新所有点句柄位置
	 */
	NaturalSplineDrawingTool.prototype.updatePointHandles = function()
	{
		for (var i = 0; i < this.pointHandles.length && i < this.points.length; i++)
		{
			var point = this.points[i];
			this.updateHandlePosition(this.pointHandles[i], point.x, point.y);
		}
	};
	
	/**
	 * 完成曲线
	 */
	NaturalSplineDrawingTool.prototype.finishSpline = function()
	{
		if (this.points.length < 2)
		{
			if (window.console)
			{
				console.warn('[Natural Spline Draw] 至少需要2个点才能完成曲线');
			}
			this.stopDrawing();
			return;
		}
		
		// 生成样条曲线点
		var curvePoints = naturalSplineInterpolation(this.points);
		
		if (window.console)
		{
			console.log('[Natural Spline Draw] finishSpline - 输入点数:', this.points.length, '生成曲线点数:', curvePoints.length);
			if (curvePoints.length > 0 && curvePoints.length <= 10)
			{
				console.log('[Natural Spline Draw] finishSpline - 前5个曲线点:', curvePoints.slice(0, 5));
			}
		}
		
		if (curvePoints.length < 2)
		{
			if (window.console)
			{
				console.warn('[Natural Spline Draw] 无法生成曲线点');
			}
			this.stopDrawing();
			return;
		}
		
		// 计算边界框
		var minX = curvePoints[0].x;
		var minY = curvePoints[0].y;
		var maxX = curvePoints[0].x;
		var maxY = curvePoints[0].y;
		
		for (var i = 0; i < curvePoints.length; i++)
		{
			minX = Math.min(minX, curvePoints[i].x);
			minY = Math.min(minY, curvePoints[i].y);
			maxX = Math.max(maxX, curvePoints[i].x);
			maxY = Math.max(maxY, curvePoints[i].y);
		}
		
		// 确保边界框有最小尺寸，避免当点重叠或接近时计算出现问题
		var minSize = 10; // 最小边界框尺寸（像素）
		var width = Math.max(maxX - minX, minSize);
		var height = Math.max(maxY - minY, minSize);
		
		// 如果宽度或高度太小，扩展边界框
		if (maxX - minX < minSize)
		{
			var centerX = (minX + maxX) / 2;
			minX = centerX - minSize / 2;
			maxX = centerX + minSize / 2;
			width = minSize;
		}
		if (maxY - minY < minSize)
		{
			var centerY = (minY + maxY) / 2;
			minY = centerY - minSize / 2;
			maxY = centerY + minSize / 2;
			height = minSize;
		}
		
		// 转换为相对坐标（参考polygon的坐标转化函数）
		var relativePoints = [];
		for (var i = 0; i < curvePoints.length; i++)
		{
			var relX = width > 0 ? (curvePoints[i].x - minX) / width : 0.5;
			var relY = height > 0 ? (curvePoints[i].y - minY) / height : 0.5;
			
			// 确保相对坐标在有效范围内 [0, 1]
			relX = Math.max(0, Math.min(1, relX));
			relY = Math.max(0, Math.min(1, relY));
			
			// 验证相对坐标有效性
			if (isNaN(relX) || isNaN(relY) || !isFinite(relX) || !isFinite(relY))
			{
				if (window.console)
				{
					console.error('[Natural Spline Draw] 无效的相对坐标:', relX, relY, '原始:', curvePoints[i]);
				}
				continue;
			}
			
			relativePoints.push([relX, relY]);
		}
		
		if (window.console)
		{
			console.log('[Natural Spline Draw] finishSpline - 相对坐标数量:', relativePoints.length);
			if (relativePoints.length > 0 && relativePoints.length <= 10)
			{
				console.log('[Natural Spline Draw] finishSpline - 前3个相对坐标:', relativePoints.slice(0, 3));
			}
		}
		
		if (relativePoints.length < 2)
		{
			if (window.console)
			{
				console.error('[Natural Spline Draw] finishSpline - 相对坐标不足');
			}
			this.stopDrawing();
			return;
		}
		
		// 创建最终曲线
		var parent = this.graph.getDefaultParent();
		var fillColor = mxUtils.getValue(this.graph.currentVertexStyle, mxConstants.STYLE_FILLCOLOR, '#ffffff');
		var strokeColor = mxUtils.getValue(this.graph.currentVertexStyle, mxConstants.STYLE_STROKECOLOR, '#000000');
		
		// 确保有默认颜色（如果没有设置）
		if (!strokeColor || strokeColor === 'none' || strokeColor === '')
		{
			strokeColor = '#000000';
		}
		
		var style = 'shape=naturalSpline;' +
			'splineCoords=' + JSON.stringify(relativePoints) + ';' +
			'fillColor=none;' +
			'strokeColor=' + strokeColor + 
			';strokeWidth=2;' +
			'whiteSpace=wrap;';
		
		if (window.console)
		{
			console.log('[Natural Spline Draw] 准备创建曲线 - 描边色:', strokeColor);
			console.log('[Natural Spline Draw] 边界框:', minX, minY, width, height);
			console.log('[Natural Spline Draw] 样式字符串长度:', style.length);
		}
		
		this.graph.getModel().beginUpdate();
		try
		{
			// 移除预览
			if (this.previewCell != null)
			{
				this.graph.removeCells([this.previewCell]);
				this.previewCell = null;
			}
			
			// 创建最终曲线
			var vertex = this.graph.insertVertex(parent, null, '', minX, minY, width, height, style);
			
			if (window.console)
			{
				console.log('[Natural Spline Draw] 创建曲线顶点:', vertex, '位置:', minX, minY, width, height);
				console.log('[Natural Spline Draw] 样式:', style);
			}
			
			// 确保顶点可见且可选择
			this.graph.setCellsVisible([vertex], true);
			this.graph.setCellsLocked([vertex], false);
			
			// 强制刷新视图
			this.graph.view.validate();
			this.graph.refresh(vertex);
			
			// 滚动以使新曲线可见
			this.graph.scrollCellToVisible(vertex);
			
			// 选择新创建的曲线
			this.graph.setSelectionCell(vertex);
		}
		finally
		{
			this.graph.getModel().endUpdate();
		}
		
		if (window.console)
		{
			console.log('[Natural Spline Draw] 完成曲线，共', this.points.length, '个控制点');
		}
		
		// 停止绘制（这会清除预览和点句柄）
		this.stopDrawing();
	};
	
	/**
	 * 清除预览
	 */
	NaturalSplineDrawingTool.prototype.clearPreview = function()
	{
		// 移除预览单元格
		if (this.previewCell != null)
		{
			this.graph.getModel().beginUpdate();
			try
			{
				this.graph.removeCells([this.previewCell]);
			}
			finally
			{
				this.graph.getModel().endUpdate();
			}
			this.previewCell = null;
		}
		
		// 移除点句柄
		for (var i = 0; i < this.pointHandles.length; i++)
		{
			var handle = this.pointHandles[i];
			if (handle && handle.parentNode)
			{
				handle.parentNode.removeChild(handle);
			}
		}
		this.pointHandles = [];
	};
	
	// 创建自然样条曲线绘制工具实例
	var splineTool = new NaturalSplineDrawingTool(editorUi);
	
	// 将 splineTool 暴露到全局作用域以便直接访问
	window.splineTool = splineTool;
	
	// 添加自然样条曲线绘制动作
	editorUi.actions.addAction('drawNaturalSpline', function()
	{
		splineTool.startDrawing();
	});
	
	if (window.console)
	{
		console.log('[Natural Spline Draw] 插件已加载');
	}
});

