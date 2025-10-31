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
			// 注意：此时 canvas 已经被 translate(x, y)，所以使用相对于 (0,0) 的坐标
			c.moveTo(polyCoords[0][0] * w, polyCoords[0][1] * h);
			
			for (var i = 1; i < polyCoords.length; i++)
			{
				c.lineTo(polyCoords[i][0] * w, polyCoords[i][1] * h);
			}
			
			// 至少需要3个点才能闭合路径
			if (polyCoords.length >= 3)
			{
				c.close();
			}
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
		this.viewChangeHandler = null;
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
				// false 表示不添加网格偏移的一半，获得精确位置
				var pt = graph.getPointForEvent(e, false);
				
				if (window.console)
				{
					console.log('[Polygon Draw] 鼠标点击 - 屏幕坐标:', mxEvent.getClientX(e), mxEvent.getClientY(e));
					console.log('[Polygon Draw] 模型坐标:', pt.x, pt.y);
					console.log('[Polygon Draw] me.getGraphX/Y:', me.getGraphX(), me.getGraphY());
				}
				
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
		
		// 移除视图变化监听器
		if (this.viewChangeHandler)
		{
			this.graph.view.removeListener(this.viewChangeHandler);
			this.viewChangeHandler = null;
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
		
		// 更新位置
		this.updateHandlePosition(handle, x, y);
		
		// 添加到 document.body 以确保正确的定位
		document.body.appendChild(handle);
		this.pointHandles.push(handle);
	};
	
	/**
	 * 更新点句柄位置
	 */
	PolygonDrawingTool.prototype.updateHandlePosition = function(handle, x, y)
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
		
		if (window.console && this.points.length <= 2)
		{
			console.log('[Polygon Draw] 更新句柄位置 - 模型坐标:', x, y, '屏幕坐标:', screenX, screenY);
		}
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
	 * 更新所有点句柄位置
	 */
	PolygonDrawingTool.prototype.updatePointHandles = function()
	{
		for (var i = 0; i < this.pointHandles.length && i < this.points.length; i++)
		{
			var point = this.points[i];
			this.updateHandlePosition(this.pointHandles[i], point.x, point.y);
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
		
		// 确保有默认颜色（如果没有设置）
		if (!fillColor || fillColor === 'none' || fillColor === '')
		{
			fillColor = '#ffffff';
		}
		if (!strokeColor || strokeColor === 'none' || strokeColor === '')
		{
			strokeColor = '#000000';
		}
		
		var style = 'shape=manualPolygon;' +
			'polyCoords=' + JSON.stringify(relativePoints) + ';' +
			'fillColor=' + fillColor + 
			';strokeColor=' + strokeColor + 
			';strokeWidth=2;' +
			'whiteSpace=wrap;';
		
		if (window.console)
		{
			console.log('[Polygon Draw] 准备创建多边形 - 填充色:', fillColor, '描边色:', strokeColor);
			console.log('[Polygon Draw] 边界框:', minX, minY, width, height);
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
			
			// 强制刷新视图
			this.graph.view.validate();
			this.graph.refresh(vertex);
			
			// 滚动以使新多边形可见
			this.graph.scrollCellToVisible(vertex);
			
			// 选择新创建的多边形
			this.graph.setSelectionCell(vertex);
		}
		finally
		{
			this.graph.getModel().endUpdate();
		}
		
		if (window.console)
		{
			console.log('[Polygon Draw] 完成多边形，共', this.points.length, '个点');
		}
		
		// 停止绘制（这会清除预览和点句柄）
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
	
	/**
	 * 编辑多边形顶点
	 * 从现有的多边形获取顶点，并允许用户编辑它们
	 */
	PolygonDrawingTool.prototype.editPolygonVertices = function(cell)
	{
		if (!cell)
		{
			if (window.console)
			{
				console.warn('[Polygon Draw] 编辑顶点: 未提供单元格');
			}
			return;
		}
		
		var style = this.graph.getCurrentCellStyle(cell);
		var shape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);
		
		// 检查是否是 manualPolygon 形状
		if (shape !== 'manualPolygon')
		{
			if (window.console)
			{
				console.warn('[Polygon Draw] 编辑顶点: 不是 manualPolygon 形状');
			}
			return;
		}
		
		// 获取多边形的几何信息
		var geo = this.graph.getModel().getGeometry(cell);
		if (!geo)
		{
			if (window.console)
			{
				console.warn('[Polygon Draw] 编辑顶点: 无法获取几何信息');
			}
			return;
		}
		
		// 获取相对坐标
		var relativePoints = ManualPolygonShape.prototype.getPolyCoords.call({style: style});
		if (!relativePoints || relativePoints.length < 3)
		{
			if (window.console)
			{
				console.warn('[Polygon Draw] 编辑顶点: 多边形点数不足');
			}
			return;
		}
		
		// 转换为绝对坐标
		this.points = [];
		for (var i = 0; i < relativePoints.length; i++)
		{
			var relPoint = relativePoints[i];
			this.points.push({
				x: geo.x + relPoint[0] * geo.width,
				y: geo.y + relPoint[1] * geo.height
			});
		}
		
		// 保存要编辑的单元格
		this.editingCell = cell;
		
		// 开始编辑模式
		this.enabled = true;
		this.clearPreview();
		
		// 改变光标
		this.graph.container.style.cursor = 'crosshair';
		
		// 创建点句柄并允许拖动
		for (var i = 0; i < this.points.length; i++)
		{
			this.createEditablePointHandle(this.points[i].x, this.points[i].y, i);
		}
		
		// 更新预览以显示当前形状
		this.updateEditingPreview();
		
		// 添加鼠标监听器
		var graph = this.graph;
		var tool = this;
		
		if (this.mouseHandler)
		{
			this.graph.removeMouseListener(this.mouseHandler);
		}
		
		this.mouseHandler = {
			tool: this,
			mouseDown: function(sender, me)
			{
				// 如果点击在点句柄上，不做处理（由点句柄处理）
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
				
				// 右键点击完成编辑
				if (mxEvent.isRightMouseButton(e) || mxEvent.isPopupTrigger(e))
				{
					if (this.tool.points.length >= 3)
					{
						this.tool.finishEditing();
					}
					else
					{
						this.tool.cancelEditing();
					}
					me.consume();
					return;
				}
				
				// 双击完成编辑
				if (me.getEvent().detail === 2)
				{
					if (this.tool.points.length >= 3)
					{
						this.tool.finishEditing();
					}
					else
					{
						this.tool.cancelEditing();
					}
					me.consume();
					return;
				}
			},
			mouseMove: function(sender, me)
			{
				// 在编辑模式下，鼠标移动会更新预览
				if (this.tool.enabled && this.tool.points.length > 0)
				{
					this.tool.updateEditingPreview();
				}
			},
			mouseUp: function(sender, me)
			{
				// 在 mouseDown 中处理
			}
		};
		
		this.graph.addMouseListener(this.mouseHandler);
		
		// 监听视图变化
		if (this.viewChangeHandler)
		{
			this.graph.view.removeListener(this.viewChangeHandler);
		}
		
		this.viewChangeHandler = mxUtils.bind(this, function()
		{
			if (this.enabled && this.pointHandles.length > 0)
			{
				this.updatePointHandles();
				this.updateEditingPreview();
			}
		});
		
		this.graph.view.addListener(mxEvent.SCALE, this.viewChangeHandler);
		this.graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, this.viewChangeHandler);
		this.graph.view.addListener(mxEvent.TRANSLATE, this.viewChangeHandler);
		
		// 监听 ESC 键取消编辑
		if (this.escapeHandler)
		{
			this.graph.removeListener(this.escapeHandler);
		}
		
		this.escapeHandler = mxUtils.bind(this, function(sender, evt)
		{
			if (this.enabled)
			{
				this.cancelEditing();
			}
		});
		
		this.graph.addListener(mxEvent.ESCAPE, this.escapeHandler);
		
		// 监听 Enter 键完成编辑
		if (this.keyDownHandler)
		{
			mxEvent.removeListener(document, 'keydown', this.keyDownHandler);
		}
		
		this.keyDownHandler = mxUtils.bind(this, function(evt)
		{
			if (this.enabled && graph.isEnabled())
			{
				var keyCode = evt.keyCode || evt.which;
				if (keyCode === 13) // Enter
				{
					if (this.points.length >= 3)
					{
						this.finishEditing();
						mxEvent.consume(evt);
					}
				}
			}
		});
		
		mxEvent.addListener(document, 'keydown', this.keyDownHandler);
		
		if (window.console)
		{
			console.log('[Polygon Draw] 开始编辑顶点，右键/双击/Enter完成，ESC取消');
		}
	};
	
	/**
	 * 创建可编辑的点句柄
	 */
	PolygonDrawingTool.prototype.createEditablePointHandle = function(x, y, index)
	{
		var handle = document.createElement('div');
		handle.style.position = 'absolute';
		handle.style.width = '10px';
		handle.style.height = '10px';
		handle.style.borderRadius = '50%';
		handle.style.backgroundColor = '#FF5722';
		handle.style.border = '2px solid white';
		handle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
		handle.style.cursor = 'move';
		handle.style.zIndex = '10001';
		handle.className = 'polygon-point-handle editable';
		handle.setAttribute('data-index', index);
		
		// 更新位置
		this.updateHandlePosition(handle, x, y);
		
		// 添加拖动功能
		var tool = this;
		var isDragging = false;
		var pointIndex = index;
		
		var mouseMoveHandler = function(e)
		{
			if (isDragging && tool.enabled)
			{
				e.preventDefault();
				var offset = mxUtils.getOffset(tool.graph.container);
				var scrollOrigin = mxUtils.getScrollOrigin(tool.graph.container);
				var view = tool.graph.view;
				var scale = view.scale;
				var tr = view.translate;
				
				var clientX = e.clientX - offset.x + scrollOrigin.x;
				var clientY = e.clientY - offset.y + scrollOrigin.y;
				
				// 转换为模型坐标
				var modelX = (clientX / scale) - tr.x;
				var modelY = (clientY / scale) - tr.y;
				
				// 更新点位置
				if (pointIndex >= 0 && pointIndex < tool.points.length)
				{
					tool.points[pointIndex].x = modelX;
					tool.points[pointIndex].y = modelY;
					
					// 更新句柄位置
					tool.updateHandlePosition(handle, modelX, modelY);
					
					// 更新预览
					tool.updateEditingPreview();
				}
			}
		};
		
		var mouseUpHandler = function(e)
		{
			if (isDragging)
			{
				isDragging = false;
				document.removeEventListener('mousemove', mouseMoveHandler);
				document.removeEventListener('mouseup', mouseUpHandler);
			}
		};
		
		handle.addEventListener('mousedown', function(e)
		{
			e.stopPropagation();
			e.preventDefault();
			isDragging = true;
			
			// 添加全局事件监听器
			document.addEventListener('mousemove', mouseMoveHandler);
			document.addEventListener('mouseup', mouseUpHandler);
		});
		
		// 添加到 document.body
		document.body.appendChild(handle);
		this.pointHandles.push(handle);
	};
	
	/**
	 * 更新编辑预览
	 */
	PolygonDrawingTool.prototype.updateEditingPreview = function()
	{
		if (this.points.length < 3)
		{
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
		
		// 获取当前样式
		var style = this.graph.getCurrentCellStyle(this.editingCell);
		var fillColor = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
		var strokeColor = mxUtils.getValue(style, mxConstants.STYLE_STROKECOLOR, '#000000');
		
		if (!fillColor || fillColor === 'none' || fillColor === '')
		{
			fillColor = '#ffffff';
		}
		if (!strokeColor || strokeColor === 'none' || strokeColor === '')
		{
			strokeColor = '#000000';
		}
		
		var newStyle = 'shape=manualPolygon;' +
			'polyCoords=' + JSON.stringify(relativePoints) + ';' +
			'fillColor=' + fillColor + 
			';strokeColor=' + strokeColor + 
			';strokeWidth=' + mxUtils.getValue(style, mxConstants.STYLE_STROKEWIDTH, '2') + ';' +
			'whiteSpace=wrap;';
		
		// 应用其他样式属性
		var opacity = mxUtils.getValue(style, mxConstants.STYLE_OPACITY, '100');
		if (opacity !== '100')
		{
			newStyle += 'opacity=' + opacity + ';';
		}
		
		this.graph.getModel().beginUpdate();
		try
		{
			var geo = new mxGeometry(minX, minY, width, height);
			this.graph.getModel().setGeometry(this.editingCell, geo);
			this.graph.getModel().setStyle(this.editingCell, newStyle);
			this.graph.view.validate();
			this.graph.refresh(this.editingCell);
		}
		finally
		{
			this.graph.getModel().endUpdate();
		}
	};
	
	/**
	 * 完成编辑
	 */
	PolygonDrawingTool.prototype.finishEditing = function()
	{
		if (this.points.length < 3)
		{
			if (window.console)
			{
				console.warn('[Polygon Draw] 至少需要3个点才能完成编辑');
			}
			this.cancelEditing();
			return;
		}
		
		// 最后更新一次
		this.updateEditingPreview();
		
		// 选择编辑后的单元格
		this.graph.setSelectionCell(this.editingCell);
		
		if (window.console)
		{
			console.log('[Polygon Draw] 完成编辑顶点');
		}
		
		// 停止编辑模式
		this.stopEditing();
	};
	
	/**
	 * 取消编辑
	 */
	PolygonDrawingTool.prototype.cancelEditing = function()
	{
		if (window.console)
		{
			console.log('[Polygon Draw] 取消编辑顶点');
		}
		
		// 停止编辑模式（不保存更改，因为已经在 updateEditingPreview 中实时更新了）
		this.stopEditing();
	};
	
	/**
	 * 停止编辑模式
	 */
	PolygonDrawingTool.prototype.stopEditing = function()
	{
		this.enabled = false;
		this.editingCell = null;
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
	
	// 添加编辑顶点动作
	editorUi.actions.addAction('editPolygonVertices', function()
	{
		var cell = editorUi.editor.graph.getSelectionCell();
		if (cell)
		{
			polygonTool.editPolygonVertices(cell);
		}
	});
	
	// 添加右键菜单项
	if (editorUi.menus && editorUi.menus.addPopupMenuCellItems && !window._polygonMenuHandlerAdded)
	{
		var addPopupMenuCellItems = editorUi.menus.addPopupMenuCellItems;
		
		editorUi.menus.addPopupMenuCellItems = function(menu, cell, evt)
		{
			addPopupMenuCellItems.apply(this, arguments);
			
			var graph = editorUi.editor.graph;
			if (cell != null && graph.getSelectionCount() == 1 && graph.getModel().isVertex(cell))
			{
				var style = graph.getCurrentCellStyle(cell);
				var shape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, null);
				
				// 只为 manualPolygon 形状显示编辑顶点菜单
				if (shape === 'manualPolygon')
				{
					menu.addSeparator();
					menu.addItem('编辑顶点', null, function()
					{
						polygonTool.editPolygonVertices(cell);
					});
				}
			}
		};
		
		// 标记为已注册，防止重复
		window._polygonMenuHandlerAdded = true;
	}
	
	if (window.console)
	{
		console.log('[Polygon Draw] 插件已加载');
	}
});

