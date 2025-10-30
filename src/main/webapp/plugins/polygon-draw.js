/**
 * Polygon Drawing Plugin - 手动绘制多边形工具
 * 允许用户通过点击画布上的点来手动绘制多边形
 */
Draw.loadPlugin(function(editorUi)
{
	if (editorUi.editor.isChromelessView())
	{
		return;
	}
	
	var graph = editorUi.editor.graph;
	
	/**
	 * 自定义多边形形状 - 使用相对坐标绘制多边形
	 */
	function ManualPolygonShape()
	{
		mxActor.call(this);
	};
	
	mxUtils.extend(ManualPolygonShape, mxActor);
	
	ManualPolygonShape.prototype.isHtmlAllowed = function()
	{
		return false;
	};
	
	ManualPolygonShape.prototype.redrawPath = function(c, x, y, w, h)
	{
		var polyCoords = this.getPolyCoords();
		
		if (polyCoords && polyCoords.length >= 2)
		{
			c.begin();
			c.moveTo(x + polyCoords[0][0] * w, y + polyCoords[0][1] * h);
			
			for (var i = 1; i < polyCoords.length; i++)
			{
				c.lineTo(x + polyCoords[i][0] * w, y + polyCoords[i][1] * h);
			}
			
			// 至少需要3个点才能闭合路径
			if (polyCoords.length >= 3)
			{
				c.close();
			}
			
			c.end();
			c.fillAndStroke();
		}
	};
	
	ManualPolygonShape.prototype.getPolyCoords = function()
	{
		try
		{
			var coordsStr = mxUtils.getValue(this.style, 'polyCoords', '[]');
			return JSON.parse(coordsStr);
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[Polygon Draw] 解析 polyCoords 失败:', e);
			}
			return [];
		}
	};
	
	// 注册自定义形状
	mxCellRenderer.registerShape('manualPolygon', ManualPolygonShape);
	
	/**
	 * 多边形绘制工具 - 允许通过点击点来手动绘制
	 */
	function PolygonDrawingTool(editorUi)
	{
		this.editorUi = editorUi;
		this.graph = editorUi.editor.graph;
		this.enabled = false;
		this.points = [];
		this.previewCell = null;
		this.previewPoints = [];
		this.pointHandles = [];
		this.mouseHandler = null;
		this.escapeHandler = null;
		this.keyDownHandler = null;
	}
	
	/**
	 * 开始绘制多边形
	 */
	PolygonDrawingTool.prototype.startDrawing = function()
	{
		if (this.enabled)
		{
			this.stopDrawing();
			return;
		}
		
		this.enabled = true;
		this.points = [];
		this.previewPoints = [];
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
					if (this.tool.points.length >= 3)
					{
						this.tool.finishPolygon();
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
					if (this.tool.points.length >= 3)
					{
						this.tool.finishPolygon();
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
					if (this.points.length >= 3)
					{
						this.finishPolygon();
						mxEvent.consume(evt);
					}
				}
			}
		});
		
		mxEvent.addListener(document, 'keydown', this.keyDownHandler);
		
		if (window.console)
		{
			console.log('[Polygon Draw] 开始绘制多边形，点击添加点，双击/右键/Enter完成，ESC取消');
		}
	};
	
	/**
	 * 停止绘制
	 */
	PolygonDrawingTool.prototype.stopDrawing = function()
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
		
		if (window.console)
		{
			console.log('[Polygon Draw] 停止绘制');
		}
	};
	
	/**
	 * 添加点
	 */
	PolygonDrawingTool.prototype.addPoint = function(x, y)
	{
		this.points.push({x: x, y: y});
		
		// 创建可视化点句柄
		this.createPointHandle(x, y, this.points.length - 1);
		
		if (window.console)
		{
			console.log('[Polygon Draw] 添加点:', x + ',' + y, '共', this.points.length, '个点');
		}
		
		// 更新预览
		if (this.points.length > 0)
		{
			this.updatePreview(x, y);
		}
	};
	
	/**
	 * 创建点句柄（可视化标记）
	 */
	PolygonDrawingTool.prototype.createPointHandle = function(x, y, index)
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
		handle.className = 'polygon-point-handle';
		handle.setAttribute('data-index', index);
		
		// 将模型坐标转换为屏幕坐标
		// x, y 是模型坐标，需要转换为屏幕坐标
		var view = this.graph.view;
		var scale = view.scale;
		var tr = view.translate;
		var screenX = (x + tr.x) * scale;
		var screenY = (y + tr.y) * scale;
		
		// 获取容器偏移和滚动位置
		var offset = mxUtils.getOffset(this.graph.container);
		var scrollOrigin = mxUtils.getScrollOrigin(this.graph.container);
		
		handle.style.left = (offset.x + screenX - scrollOrigin.x - 4) + 'px';
		handle.style.top = (offset.y + screenY - scrollOrigin.y - 4) + 'px';
		
		// 添加到 document.body 以确保正确的定位
		document.body.appendChild(handle);
		this.pointHandles.push(handle);
	};
	
	/**
	 * 更新预览
	 */
	PolygonDrawingTool.prototype.updatePreview = function(currentX, currentY)
	{
		if (this.points.length === 0)
		{
			return;
		}
		
		// 计算包括所有点和当前鼠标位置的边界框
		var allPoints = this.points.slice();
		allPoints.push({x: currentX, y: currentY});
		
		var minX = allPoints[0].x;
		var minY = allPoints[0].y;
		var maxX = allPoints[0].x;
		var maxY = allPoints[0].y;
		
		for (var i = 0; i < allPoints.length; i++)
		{
			minX = Math.min(minX, allPoints[i].x);
			minY = Math.min(minY, allPoints[i].y);
			maxX = Math.max(maxX, allPoints[i].x);
			maxY = Math.max(maxY, allPoints[i].y);
		}
		
		var width = Math.max(maxX - minX, 1);
		var height = Math.max(maxY - minY, 1);
		
		// 转换为相对坐标
		var relativePoints = [];
		for (var i = 0; i < this.points.length; i++)
		{
			relativePoints.push([
				(this.points[i].x - minX) / width,
				(this.points[i].y - minY) / height
			]);
		}
		
		// 添加当前鼠标位置用于预览
		relativePoints.push([
			(currentX - minX) / width,
			(currentY - minY) / height
		]);
		
		// 至少需要2个点才显示预览
		if (relativePoints.length < 2)
		{
			return;
		}
		
		// 创建或更新预览单元格
		var parent = this.graph.getDefaultParent();
		var fillColor = mxUtils.getValue(this.graph.currentVertexStyle, mxConstants.STYLE_FILLCOLOR, '#ffffff');
		var strokeColor = mxUtils.getValue(this.graph.currentVertexStyle, mxConstants.STYLE_STROKECOLOR, '#000000');
		
		var style = 'shape=manualPolygon;' +
			'polyCoords=' + JSON.stringify(relativePoints) + ';' +
			'fillColor=' + fillColor + 
			';strokeColor=' + strokeColor + 
			';strokeWidth=2;' +
			'dashed=1;' +
			'dashPattern=5 5;' +
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
	 * 更新点句柄位置
	 */
	PolygonDrawingTool.prototype.updatePointHandles = function()
	{
		var view = this.graph.view;
		var scale = view.scale;
		var tr = view.translate;
		var offset = mxUtils.getOffset(this.graph.container);
		var scrollOrigin = mxUtils.getScrollOrigin(this.graph.container);
		
		for (var i = 0; i < this.pointHandles.length && i < this.points.length; i++)
		{
			var point = this.points[i];
			var screenX = (point.x + tr.x) * scale;
			var screenY = (point.y + tr.y) * scale;
			
			this.pointHandles[i].style.left = (offset.x + screenX - scrollOrigin.x - 4) + 'px';
			this.pointHandles[i].style.top = (offset.y + screenY - scrollOrigin.y - 4) + 'px';
		}
	};
	
	/**
	 * 完成多边形
	 */
	PolygonDrawingTool.prototype.finishPolygon = function()
	{
		if (this.points.length < 3)
		{
			if (window.console)
			{
				console.warn('[Polygon Draw] 至少需要3个点才能完成多边形');
			}
			this.stopDrawing();
			return;
		}
		
		// 计算边界框
		var minX = this.points[0].x;
		var minY = this.points[0].y;
		var maxX = this.points[0].x;
		var maxY = this.points[0].y;
		
		for (var i = 1; i < this.points.length; i++)
		{
			minX = Math.min(minX, this.points[i].x);
			minY = Math.min(minY, this.points[i].y);
			maxX = Math.max(maxX, this.points[i].x);
			maxY = Math.max(maxY, this.points[i].y);
		}
		
		var width = Math.max(maxX - minX, 1);
		var height = Math.max(maxY - minY, 1);
		
		// 转换为相对坐标
		var relativePoints = [];
		for (var i = 0; i < this.points.length; i++)
		{
			relativePoints.push([
				(this.points[i].x - minX) / width,
				(this.points[i].y - minY) / height
			]);
		}
		
		// 创建最终多边形
		var parent = this.graph.getDefaultParent();
		var fillColor = mxUtils.getValue(this.graph.currentVertexStyle, mxConstants.STYLE_FILLCOLOR, '#ffffff');
		var strokeColor = mxUtils.getValue(this.graph.currentVertexStyle, mxConstants.STYLE_STROKECOLOR, '#000000');
		
		var style = 'shape=manualPolygon;' +
			'polyCoords=' + JSON.stringify(relativePoints) + ';' +
			'fillColor=' + fillColor + 
			';strokeColor=' + strokeColor + 
			';strokeWidth=2;' +
			'whiteSpace=wrap;';
		
		this.graph.getModel().beginUpdate();
		try
		{
			// 移除预览
			if (this.previewCell != null)
			{
				this.graph.removeCells([this.previewCell]);
				this.previewCell = null;
			}
			
			// 创建最终多边形
			var vertex = this.graph.insertVertex(parent, null, '', minX, minY, width, height, style);
			
			if (window.console)
			{
				console.log('[Polygon Draw] 创建多边形顶点:', vertex, '位置:', minX, minY, width, height);
				console.log('[Polygon Draw] 样式:', style);
				console.log('[Polygon Draw] 相对坐标:', relativePoints);
			}
			
			// 确保顶点可见且可选择
			this.graph.setCellsVisible([vertex], true);
			this.graph.setCellsLocked([vertex], false);
			this.graph.setSelectionCell(vertex);
			
			// 强制刷新视图
			this.graph.view.validate();
			this.graph.refresh(vertex);
			
			// 滚动以使新多边形可见
			this.graph.scrollCellToVisible(vertex);
		}
		finally
		{
			this.graph.getModel().endUpdate();
		}
		
		if (window.console)
		{
			console.log('[Polygon Draw] 完成多边形，共', this.points.length, '个点');
		}
		
		// 停止绘制
		this.stopDrawing();
	};
	
	/**
	 * 清除预览
	 */
	PolygonDrawingTool.prototype.clearPreview = function()
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
	
	// 创建多边形绘制工具实例
	var polygonTool = new PolygonDrawingTool(editorUi);
	
	// 将 polygonTool 暴露到全局作用域以便直接访问
	window.polygonTool = polygonTool;
	
	// 添加多边形绘制动作
	editorUi.actions.addAction('drawPolygon', function()
	{
		polygonTool.startDrawing();
	});
	
	if (window.console)
	{
		console.log('[Polygon Draw] 插件已加载');
	}
});

