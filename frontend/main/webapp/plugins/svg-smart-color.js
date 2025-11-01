/**
 * SVG智能色插件 - 为SVG元素提供智能重新染色功能
 * 功能：
 * 1. 分析SVG的颜色
 * 2. 根据颜色的区域面积统计最常见的颜色
 * 3. 颜色近似和重新染色
 */
Draw.loadPlugin(function(editorUi)
{
	if (editorUi.editor.isChromelessView())
	{
		return;
	}
	
	var graph = editorUi.editor.graph;
	
	/**
	 * 从SVG字符串或节点中提取SVG内容
	 */
	function getSvgContent(cell)
	{
		if (!cell)
		{
			return null;
		}
		
		var state = graph.view.getState(cell);
		var style = (state != null) ? state.style : graph.getCellStyle(cell);
		var image = (style != null) ? mxUtils.getValue(style, mxConstants.STYLE_IMAGE, null) : null;
		
		var value = graph.getModel().getValue(cell);
		var svgString = null;
		
		// 尝试从image样式获取
		if (image != null)
		{
			var lowerImage = String(image).toLowerCase();
			if (lowerImage.indexOf('data:image/svg') === 0)
			{
				try
				{
					svgString = Graph.getSvgFromDataUri(image);
				}
				catch (e)
				{
					// Graph.getSvgFromDataUri 失败，可能不是base64编码，尝试URL解码
					if (window.console)
					{
						console.warn('[SVG Smart Color] Graph.getSvgFromDataUri 失败，尝试备用方法:', e);
					}
					
					var commaIndex = image.indexOf(',');
					if (commaIndex >= 0)
					{
						try
						{
							// 尝试URL解码
							svgString = decodeURIComponent(image.substring(commaIndex + 1));
						}
						catch (e2)
						{
							// URL解码也失败，尝试直接使用（可能已经是纯文本）
							if (window.console)
							{
								console.warn('[SVG Smart Color] URL解码也失败:', e2);
							}
							var rawContent = image.substring(commaIndex + 1);
							// 检查是否看起来像SVG XML
							if (rawContent.trim().charAt(0) === '<')
							{
								svgString = rawContent;
							}
						}
					}
				}
			}
		}
		
		// 尝试从value节点获取
		if (!svgString && mxUtils.isNode(value))
		{
			var nodeName = value.nodeName ? value.nodeName.toLowerCase() : '';
			if (nodeName === 'svg')
			{
				svgString = mxUtils.getXml(value);
			}
			else if (nodeName === 'svgimage')
			{
				var svgText = value.getAttribute ? value.getAttribute('svgText') : null;
				if (svgText)
				{
					try
					{
						svgString = decodeURIComponent(svgText);
					}
					catch (e)
					{
						// 如果解码失败，直接使用原始值
						svgString = svgText;
					}
				}
				else
				{
					var dataUri = value.getAttribute ? value.getAttribute('svgDataUri') : null;
					if (dataUri && dataUri.toLowerCase().indexOf('data:image/svg') === 0)
					{
						try
						{
							svgString = Graph.getSvgFromDataUri(dataUri);
						}
						catch (e)
						{
							// Graph.getSvgFromDataUri 失败，尝试URL解码
							if (window.console)
							{
								console.warn('[SVG Smart Color] 从svgDataUri获取SVG失败，尝试备用方法:', e);
							}
							
							var comma = dataUri.indexOf(',');
							if (comma >= 0)
							{
								try
								{
									svgString = decodeURIComponent(dataUri.substring(comma + 1));
								}
								catch (e2)
								{
									// URL解码也失败，尝试直接使用
									var rawContent = dataUri.substring(comma + 1);
									if (rawContent.trim().charAt(0) === '<')
									{
										svgString = rawContent;
									}
								}
							}
						}
					}
				}
			}
		}
		
		// 尝试从字符串value获取
		if (!svgString && typeof value === 'string')
		{
			var trimmed = value.trim();
			if (trimmed.length > 4 && trimmed.charAt(0) === '<')
			{
				try
				{
					var doc = mxUtils.parseXml(trimmed);
					if (doc && doc.documentElement && doc.documentElement.nodeName && 
						doc.documentElement.nodeName.toLowerCase() === 'svg')
					{
						svgString = trimmed;
					}
				}
				catch (e)
				{
					// ignore
				}
			}
		}
		
		return svgString;
	}
	
	/**
	 * 检查cell是否为SVG
	 */
	function isSvgCell(cell)
	{
		if (!cell)
		{
			if (window.console)
			{
				console.log('[SVG Smart Color] isSvgCell: cell为空');
			}
			return false;
		}
		
		var state = graph.view.getState(cell);
		var style = (state != null) ? state.style : graph.getCellStyle(cell);
		var image = (style != null) ? mxUtils.getValue(style, mxConstants.STYLE_IMAGE, null) : null;
		var value = graph.getModel().getValue(cell);
		
		// 检查image样式
		if (image != null)
		{
			var lowerImage = String(image).toLowerCase();
			if (lowerImage.indexOf('data:image/svg') === 0 || /\.svg(\?.*)?$/i.test(lowerImage))
			{
				if (window.console)
				{
					console.log('[SVG Smart Color] 检测到SVG image:', image.substring(0, 50));
				}
				return true;
			}
		}
		
		// 检查value节点
		if (mxUtils.isNode(value))
		{
			var nodeName = value.nodeName ? value.nodeName.toLowerCase() : '';
			if (nodeName === 'svg')
			{
				if (window.console)
				{
					console.log('[SVG Smart Color] 检测到SVG节点');
				}
				return true;
			}
			else if (nodeName === 'svgimage')
			{
				var svgText = value.getAttribute ? value.getAttribute('svgText') : null;
				var dataUri = value.getAttribute ? value.getAttribute('svgDataUri') : null;
				if (svgText || (dataUri && dataUri.toLowerCase().indexOf('data:image/svg') === 0))
				{
					if (window.console)
					{
						console.log('[SVG Smart Color] 检测到SvgImage节点');
					}
					return true;
				}
			}
		}
		
		// 检查字符串value
		if (typeof value === 'string')
		{
			var trimmed = value.trim();
			if (trimmed.length > 4 && trimmed.charAt(0) === '<')
			{
				try
				{
					var doc = mxUtils.parseXml(trimmed);
					if (doc && doc.documentElement && doc.documentElement.nodeName && 
						doc.documentElement.nodeName.toLowerCase() === 'svg')
					{
						if (window.console)
						{
							console.log('[SVG Smart Color] 检测到SVG字符串');
						}
						return true;
					}
				}
				catch (e)
				{
					// ignore
				}
			}
		}
		
		return false;
	}
	
	/**
	 * 将颜色字符串转换为RGB值
	 */
	function parseColor(colorStr)
	{
		if (!colorStr || colorStr === 'none' || colorStr === 'transparent')
		{
			return null;
		}
		
		// 处理hex颜色
		if (colorStr.match(/^#[0-9A-Fa-f]{6}$/))
		{
			var r = parseInt(colorStr.substring(1, 3), 16);
			var g = parseInt(colorStr.substring(3, 5), 16);
			var b = parseInt(colorStr.substring(5, 7), 16);
			return {r: r, g: g, b: b, hex: colorStr};
		}
		
		// 处理rgb/rgba颜色
		var rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (rgbMatch)
		{
			var r = parseInt(rgbMatch[1], 10);
			var g = parseInt(rgbMatch[2], 10);
			var b = parseInt(rgbMatch[3], 10);
			return {r: r, g: g, b: b, hex: rgbToHex(r, g, b)};
		}
		
		// 尝试使用canvas API转换命名颜色
		try
		{
			var canvas = document.createElement('canvas');
			canvas.width = canvas.height = 1;
			var ctx = canvas.getContext('2d');
			ctx.fillStyle = colorStr;
			var hex = ctx.fillStyle;
			if (hex && hex.match(/^#[0-9A-Fa-f]{6}$/))
			{
				var r = parseInt(hex.substring(1, 3), 16);
				var g = parseInt(hex.substring(3, 5), 16);
				var b = parseInt(hex.substring(5, 7), 16);
				return {r: r, g: g, b: b, hex: hex};
			}
		}
		catch (e)
		{
			// ignore
		}
		
		return null;
	}
	
	/**
	 * RGB转Hex
	 */
	function rgbToHex(r, g, b)
	{
		function toHex(n)
		{
			n = Math.max(0, Math.min(255, Math.round(n)));
			var hex = n.toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		}
		return '#' + toHex(r) + toHex(g) + toHex(b);
	}
	
	/**
	 * 计算两个颜色的欧氏距离（用于颜色近似）
	 */
	function colorDistance(c1, c2)
	{
		if (!c1 || !c2) return Infinity;
		var dr = c1.r - c2.r;
		var dg = c1.g - c2.g;
		var db = c1.b - c2.b;
		return Math.sqrt(dr * dr + dg * dg + db * db);
	}
	
	/**
	 * 找到最接近的目标颜色
	 */
	function findClosestColor(color, targetColors)
	{
		if (!color || targetColors.length === 0) return null;
		
		var minDist = Infinity;
		var closest = targetColors[0];
		
		for (var i = 0; i < targetColors.length; i++)
		{
			var dist = colorDistance(color, targetColors[i]);
			if (dist < minDist)
			{
				minDist = dist;
				closest = targetColors[i];
			}
		}
		
		return closest;
	}
	
	/**
	 * 分析SVG中的颜色及其区域面积
	 */
	function analyzeSvgColors(svgString)
	{
		if (!svgString)
		{
			return [];
		}
		
		try
		{
			var doc = mxUtils.parseXml(svgString);
			var svgElement = doc.documentElement;
			
			if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg')
			{
				return [];
			}
			
			var colorMap = {}; // color -> {color, area, count}
			
			// 获取viewBox或尺寸
			var viewBox = svgElement.getAttribute('viewBox');
			var width = parseFloat(svgElement.getAttribute('width')) || 100;
			var height = parseFloat(svgElement.getAttribute('height')) || 100;
			
			var vbX = 0, vbY = 0, vbWidth = width, vbHeight = height;
			if (viewBox)
			{
				var vb = viewBox.split(/\s+|,/);
				if (vb.length >= 4)
				{
					vbX = parseFloat(vb[0]) || 0;
					vbY = parseFloat(vb[1]) || 0;
					vbWidth = parseFloat(vb[2]) || width;
					vbHeight = parseFloat(vb[3]) || height;
				}
			}
			
			// 尝试创建临时DOM元素用于计算（如果需要getBBox等方法）
			var tempSvgElement = null;
			try
			{
				// 创建临时SVG元素
				var tempDiv = document.createElement('div');
				tempDiv.style.position = 'absolute';
				tempDiv.style.visibility = 'hidden';
				tempDiv.style.width = vbWidth + 'px';
				tempDiv.style.height = vbHeight + 'px';
				document.body.appendChild(tempDiv);
				
				var tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				tempSvg.setAttribute('width', vbWidth);
				tempSvg.setAttribute('height', vbHeight);
				tempSvg.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbWidth + ' ' + vbHeight);
				tempDiv.appendChild(tempSvg);
				
				// 克隆SVG内容
				var clone = svgElement.cloneNode(true);
				// 移除旧的命名空间属性（如果有）
				var importedNode = document.importNode ? document.importNode(clone, true) : clone.cloneNode(true);
				tempSvg.appendChild(importedNode);
				
				tempSvgElement = tempSvg;
			}
			catch (e)
			{
				if (window.console)
				{
					console.warn('[SVG Smart Color] 无法创建临时SVG元素，将使用简化分析:', e);
				}
			}
			
			// 递归遍历所有元素
			function traverseElement(element, parentMatrix, tempElement)
			{
				if (!element || element.nodeType !== 1)
				{
					return;
				}
				
				try
				{
					var tagName = element.nodeName ? element.nodeName.toLowerCase() : '';
					
					// 尝试从临时元素获取bbox（如果可用）
					var tempBbox = null;
					if (tempElement && (tagName === 'path' || tagName === 'polygon' || tagName === 'polyline'))
					{
						try
						{
							// 尝试在临时SVG中找到对应的元素
							var tempEl = tempElement.querySelector ? 
								tempElement.querySelector('*[data-temp-id="' + element.getAttribute('id') + '"]') : null;
							if (!tempEl && element.getAttribute)
							{
								var id = element.getAttribute('id');
								if (id)
								{
									tempEl = tempElement.getElementById ? tempElement.getElementById(id) : null;
								}
							}
							
							if (tempEl && tempEl.getBBox)
							{
								tempBbox = tempEl.getBBox();
							}
						}
						catch (e)
						{
							// ignore
						}
					}
					
					// 计算元素的面积（近似）
					var area = 0;
					var hasGeometry = false;
					
					if (tagName === 'rect')
					{
						var x = parseFloat(element.getAttribute('x') || 0);
						var y = parseFloat(element.getAttribute('y') || 0);
						var w = parseFloat(element.getAttribute('width') || 0);
						var h = parseFloat(element.getAttribute('height') || 0);
						area = w * h;
						hasGeometry = true;
					}
					else if (tagName === 'circle')
					{
						var r = parseFloat(element.getAttribute('r') || 0);
						area = Math.PI * r * r;
						hasGeometry = true;
					}
					else if (tagName === 'ellipse')
					{
						var rx = parseFloat(element.getAttribute('rx') || 0);
						var ry = parseFloat(element.getAttribute('ry') || 0);
						area = Math.PI * rx * ry;
						hasGeometry = true;
					}
					else if (tagName === 'path')
					{
						if (tempBbox)
						{
							area = tempBbox.width * tempBbox.height;
							hasGeometry = true;
						}
						else
						{
							// 备用方法：使用路径长度估算
							try
							{
								var pathLength = element.getTotalLength ? element.getTotalLength() : 0;
								if (pathLength > 0)
								{
									// 近似使用路径长度估算面积（对于复杂路径）
									var bbox = element.getBBox ? element.getBBox() : null;
									if (bbox)
									{
										area = bbox.width * bbox.height;
										hasGeometry = true;
									}
								}
							}
							catch (e)
							{
								// ignore
							}
						}
					}
					else if (tagName === 'polygon' || tagName === 'polyline')
					{
						var points = element.getAttribute('points');
						if (points)
						{
							if (tempBbox)
							{
								area = tempBbox.width * tempBbox.height;
								hasGeometry = true;
							}
							else
							{
								var bbox = element.getBBox ? element.getBBox() : null;
								if (bbox)
								{
									area = bbox.width * bbox.height;
									hasGeometry = true;
								}
							}
						}
					}
					
					// 获取计算后的样式
					var computedStyle = null;
					try
					{
						if (tempElement && element.ownerDocument && element.ownerDocument.defaultView)
						{
							computedStyle = element.ownerDocument.defaultView.getComputedStyle(element);
						}
					}
					catch (e)
					{
						// ignore
					}
					
					// 提取填充色
					if (hasGeometry)
					{
						var fill = element.getAttribute('fill');
						if (!fill && computedStyle)
						{
							fill = computedStyle.fill;
						}
						if (fill && fill !== 'none')
						{
							var fillColor = parseColor(fill);
							if (fillColor)
							{
								var key = fillColor.hex;
								if (!colorMap[key])
								{
									colorMap[key] = {
										color: fillColor,
										area: 0,
										count: 0
									};
								}
								colorMap[key].area += area;
								colorMap[key].count += 1;
							}
						}
					}
					
					// 提取描边色（面积权重较小，因为描边通常是线）
					var stroke = element.getAttribute('stroke');
					if (!stroke && computedStyle)
					{
						stroke = computedStyle.stroke;
					}
					var strokeWidth = parseFloat(element.getAttribute('stroke-width') || 0);
					if (!strokeWidth && computedStyle)
					{
						strokeWidth = parseFloat(computedStyle.strokeWidth || 0);
					}
					
					if (stroke && stroke !== 'none' && strokeWidth > 0 && hasGeometry)
					{
						var strokeColor = parseColor(stroke);
						if (strokeColor)
						{
							// 描边面积近似为周长 * strokeWidth
							var perimeter = 0;
							if (tagName === 'rect')
							{
								var w = parseFloat(element.getAttribute('width') || 0);
								var h = parseFloat(element.getAttribute('height') || 0);
								perimeter = 2 * (w + h);
							}
							else if (tagName === 'circle')
							{
								var r = parseFloat(element.getAttribute('r') || 0);
								perimeter = 2 * Math.PI * r;
							}
							else
							{
								// 其他形状使用路径长度估算
								try
								{
									perimeter = element.getTotalLength ? element.getTotalLength() : area * 0.1;
								}
								catch (e)
								{
									perimeter = area * 0.1;
								}
							}
							var strokeArea = perimeter * strokeWidth;
							
							var key = strokeColor.hex;
							if (!colorMap[key])
							{
								colorMap[key] = {
									color: strokeColor,
									area: 0,
									count: 0
								};
							}
							colorMap[key].area += strokeArea;
							colorMap[key].count += 1;
						}
					}
				}
				catch (e)
				{
					if (window.console)
					{
						console.warn('[SVG Smart Color] 处理元素时出错:', e);
					}
				}
				
				// 递归处理子元素
				var tempChild = tempElement ? 
					(tempElement.querySelector ? tempElement.querySelector('*') : tempElement.firstElementChild) : null;
				for (var i = 0; i < element.childNodes.length; i++)
				{
					var nextTempChild = null;
					if (tempElement && tempChild)
					{
						nextTempChild = tempChild;
						tempChild = tempChild.nextElementSibling;
					}
					traverseElement(element.childNodes[i], null, nextTempChild);
				}
			}
			
			// 开始遍历
			var actualTempElement = tempSvgElement ? tempSvgElement.querySelector('svg > *') : null;
			traverseElement(svgElement, null, actualTempElement);
			
			// 清理临时元素
			if (tempSvgElement && tempSvgElement.parentNode)
			{
				var tempDiv = tempSvgElement.parentNode;
				if (tempDiv && tempDiv.parentNode)
				{
					tempDiv.parentNode.removeChild(tempDiv);
				}
			}
			
			// 转换为数组并按面积排序
			var colors = [];
			for (var key in colorMap)
			{
				if (colorMap.hasOwnProperty(key))
				{
					colors.push(colorMap[key]);
				}
			}
			
			colors.sort(function(a, b)
			{
				return b.area - a.area;
			});
			
			return colors;
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[SVG Smart Color] 分析SVG颜色时出错:', e);
			}
			return [];
		}
	}
	
	/**
	 * 对SVG进行重新染色
	 */
	function recolorSvg(svgString, colorMapping)
	{
		if (!svgString || !colorMapping)
		{
			return svgString;
		}
		
		try
		{
			var doc = mxUtils.parseXml(svgString);
			var svgElement = doc.documentElement;
			
			if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg')
			{
				return svgString;
			}
			
			// 递归替换颜色
			function replaceColors(element)
			{
				if (!element || element.nodeType !== 1)
				{
					return;
				}
				
				try
				{
					// 处理fill属性
					var fill = element.getAttribute('fill');
					if (fill && fill !== 'none')
					{
						var fillColor = parseColor(fill);
						if (fillColor && colorMapping[fillColor.hex])
						{
							element.setAttribute('fill', colorMapping[fillColor.hex].hex);
						}
					}
					
					// 处理stroke属性
					var stroke = element.getAttribute('stroke');
					if (stroke && stroke !== 'none')
					{
						var strokeColor = parseColor(stroke);
						if (strokeColor && colorMapping[strokeColor.hex])
						{
							element.setAttribute('stroke', colorMapping[strokeColor.hex].hex);
						}
					}
					
					// 处理style属性中的颜色
					var style = element.getAttribute('style');
					if (style)
					{
						var newStyle = style;
						var fillMatch = style.match(/fill\s*:\s*([^;]+)/i);
						if (fillMatch)
						{
							var fillValue = fillMatch[1].trim();
							var fillColor = parseColor(fillValue);
							if (fillColor && colorMapping[fillColor.hex])
							{
								newStyle = newStyle.replace(/fill\s*:\s*[^;]+/i, 'fill:' + colorMapping[fillColor.hex].hex);
							}
						}
						
						var strokeMatch = style.match(/stroke\s*:\s*([^;]+)/i);
						if (strokeMatch)
						{
							var strokeValue = strokeMatch[1].trim();
							var strokeColor = parseColor(strokeValue);
							if (strokeColor && colorMapping[strokeColor.hex])
							{
								newStyle = newStyle.replace(/stroke\s*:\s*[^;]+/i, 'stroke:' + colorMapping[strokeColor.hex].hex);
							}
						}
						
						if (newStyle !== style)
						{
							element.setAttribute('style', newStyle);
						}
					}
				}
				catch (e)
				{
					if (window.console)
					{
						console.warn('[SVG Smart Color] 替换颜色时出错:', e);
					}
				}
				
				// 递归处理子元素
				for (var i = 0; i < element.childNodes.length; i++)
				{
					replaceColors(element.childNodes[i]);
				}
			}
			
			replaceColors(svgElement);
			
			return mxUtils.getXml(svgElement);
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[SVG Smart Color] 重新染色时出错:', e);
			}
			return svgString;
		}
	}
	
	/**
	 * 显示智能色对话框
	 */
	function showSmartColorDialog(cell)
	{
		var svgString = getSvgContent(cell);
		if (!svgString)
		{
			editorUi.handleError({message: '无法获取SVG内容'});
			return;
		}
		
		// 分析颜色
		var colors = analyzeSvgColors(svgString);
		
		if (colors.length === 0)
		{
			editorUi.handleError({message: '未在SVG中发现颜色'});
			return;
		}
		
		// 创建主容器
		var mainContainer = document.createElement('div');
		mainContainer.style.minWidth = '500px';
		mainContainer.style.display = 'flex';
		mainContainer.style.flexDirection = 'column';
		mainContainer.style.maxHeight = '70vh';
		
		// 内容容器（可滚动）
		var contentWrapper = document.createElement('div');
		contentWrapper.style.flex = '1';
		contentWrapper.style.overflowY = 'auto';
		contentWrapper.style.overflowX = 'hidden';
		contentWrapper.style.padding = '20px';
		contentWrapper.style.paddingBottom = '10px';
		contentWrapper.style.minHeight = '0';
		contentWrapper.style.maxHeight = '60vh'; // 限制最大高度，确保有空间显示按钮
		
		// 标题
		var title = document.createElement('h3');
		title.style.marginTop = '0px';
		title.style.marginBottom = '20px';
		mxUtils.write(title, '智能色 - SVG颜色分析');
		contentWrapper.appendChild(title);
		
		// 颜色分析结果展示
		var colorsInfo = document.createElement('div');
		colorsInfo.style.marginBottom = '20px';
		colorsInfo.style.padding = '10px';
		colorsInfo.style.backgroundColor = '#f5f5f5';
		colorsInfo.style.borderRadius = '4px';
		
		var colorsText = document.createElement('p');
		colorsText.style.margin = '0 0 10px 0';
		mxUtils.write(colorsText, 'SVG中共发现 ' + colors.length + ' 种颜色');
		colorsInfo.appendChild(colorsText);
		
		// 显示前10种颜色（按面积排序）
		var colorsList = document.createElement('div');
		colorsList.style.maxHeight = '200px';
		colorsList.style.overflowY = 'auto';
		var displayCount = Math.min(colors.length, 10);
		
		for (var i = 0; i < displayCount; i++)
		{
			var colorItem = colors[i];
			var itemDiv = document.createElement('div');
			itemDiv.style.display = 'flex';
			itemDiv.style.alignItems = 'center';
			itemDiv.style.marginBottom = '5px';
			itemDiv.style.padding = '5px';
			itemDiv.style.backgroundColor = '#fff';
			itemDiv.style.borderRadius = '3px';
			
			// 颜色块
			var colorBlock = document.createElement('div');
			colorBlock.style.width = '30px';
			colorBlock.style.height = '30px';
			colorBlock.style.backgroundColor = colorItem.color.hex;
			colorBlock.style.border = '1px solid #ccc';
			colorBlock.style.borderRadius = '3px';
			colorBlock.style.marginRight = '10px';
			itemDiv.appendChild(colorBlock);
			
			// 颜色信息
			var colorInfo = document.createElement('div');
			colorInfo.style.flex = '1';
			var infoText = colorItem.color.hex + ' (面积: ' + colorItem.area.toFixed(2) + ', 使用次数: ' + colorItem.count + ')';
			mxUtils.write(colorInfo, infoText);
			itemDiv.appendChild(colorInfo);
			
			colorsList.appendChild(itemDiv);
		}
		
		colorsInfo.appendChild(colorsList);
		contentWrapper.appendChild(colorsInfo);
		
		// 颜色数量输入
		var countLabel = document.createElement('label');
		countLabel.style.display = 'block';
		countLabel.style.marginBottom = '5px';
		countLabel.style.fontWeight = 'bold';
		mxUtils.write(countLabel, '目标颜色数量:');
		contentWrapper.appendChild(countLabel);
		
		var countInput = document.createElement('input');
		countInput.type = 'number';
		countInput.min = '1';
		countInput.max = '10';
		countInput.value = Math.min(colors.length, 10).toString();
		countInput.style.width = '100%';
		countInput.style.padding = '5px';
		countInput.style.marginBottom = '10px';
		countInput.style.boxSizing = 'border-box';
		contentWrapper.appendChild(countInput);
		
		// 预设配色方案
		var presetSchemes = {
			'cns': {
				name: 'Cell Nature Science',
				colors: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22', '#17BECF']
			},
			'default': {
				name: '默认（保持原色）',
				colors: []
			}
		};
		
		// 预设方案选择
		var presetLabel = document.createElement('label');
		presetLabel.style.display = 'block';
		presetLabel.style.marginBottom = '5px';
		presetLabel.style.fontWeight = 'bold';
		mxUtils.write(presetLabel, '预设配色方案:');
		contentWrapper.appendChild(presetLabel);
		
		var presetSelect = document.createElement('select');
		presetSelect.style.width = '100%';
		presetSelect.style.padding = '5px';
		presetSelect.style.marginBottom = '10px';
		presetSelect.style.boxSizing = 'border-box';
		
		var defaultOption = document.createElement('option');
		defaultOption.value = 'default';
		mxUtils.write(defaultOption, '默认（保持原色）');
		presetSelect.appendChild(defaultOption);
		
		var cnsOption = document.createElement('option');
		cnsOption.value = 'cns';
		mxUtils.write(cnsOption, 'Cell Nature Science');
		presetSelect.appendChild(cnsOption);
		
		contentWrapper.appendChild(presetSelect);
		
		// 颜色映射区域
		var mappingContainer = document.createElement('div');
		mappingContainer.id = 'colorMappingContainer';
		mappingContainer.style.marginBottom = '20px';
		
		// 存储颜色映射
		var colorMappingInputs = {}; // originalColor -> input element
		
		// 更新颜色映射区域
		function updateColorMapping()
		{
			// 清空容器
			while (mappingContainer.firstChild)
			{
				mappingContainer.removeChild(mappingContainer.firstChild);
			}
			colorMappingInputs = {};
			
			var targetCount = parseInt(countInput.value);
			if (isNaN(targetCount) || targetCount < 1 || targetCount > 10)
			{
				return;
			}
			
			// 选择主要颜色
			var mainColors = colors.slice(0, Math.min(targetCount, colors.length));
			
			// 创建映射标题
			var mappingTitle = document.createElement('div');
			mappingTitle.style.fontWeight = 'bold';
			mappingTitle.style.marginBottom = '10px';
			mappingTitle.style.paddingBottom = '5px';
			mappingTitle.style.borderBottom = '1px solid #ddd';
			mxUtils.write(mappingTitle, '颜色映射（点击颜色块可修改）:');
			mappingContainer.appendChild(mappingTitle);
			
			// 为每个主要颜色创建映射项
			for (var i = 0; i < mainColors.length; i++)
			{
				var colorItem = mainColors[i];
				var mapDiv = document.createElement('div');
				mapDiv.style.display = 'flex';
				mapDiv.style.alignItems = 'center';
				mapDiv.style.marginBottom = '10px';
				mapDiv.style.padding = '8px';
				mapDiv.style.backgroundColor = '#fff';
				mapDiv.style.border = '1px solid #ddd';
				mapDiv.style.borderRadius = '4px';
				
				// 原始颜色
				var originalColorBlock = document.createElement('div');
				originalColorBlock.style.width = '40px';
				originalColorBlock.style.height = '40px';
				originalColorBlock.style.backgroundColor = colorItem.color.hex;
				originalColorBlock.style.border = '1px solid #ccc';
				originalColorBlock.style.borderRadius = '4px';
				originalColorBlock.style.marginRight = '10px';
				originalColorBlock.style.flexShrink = '0';
				mapDiv.appendChild(originalColorBlock);
				
				// 箭头
				var arrow = document.createElement('div');
				arrow.style.margin = '0 10px';
				arrow.style.fontSize = '18px';
				mxUtils.write(arrow, '→');
				mapDiv.appendChild(arrow);
				
				// 目标颜色输入
				var colorInput = document.createElement('input');
				colorInput.type = 'color';
				colorInput.value = colorItem.color.hex;
				colorInput.style.width = '50px';
				colorInput.style.height = '40px';
				colorInput.style.border = '1px solid #ccc';
				colorInput.style.borderRadius = '4px';
				colorInput.style.cursor = 'pointer';
				colorInput.style.flexShrink = '0';
				mapDiv.appendChild(colorInput);
				
				// 颜色值显示
				var colorValue = document.createElement('div');
				colorValue.style.marginLeft = '10px';
				colorValue.style.flex = '1';
				colorValue.style.fontFamily = 'monospace';
				colorValue.textContent = colorItem.color.hex;
				mapDiv.appendChild(colorValue);
				
				// 更新颜色值显示
				colorInput.addEventListener('input', function(input, valueDiv, originalHex)
				{
					return function()
					{
						valueDiv.textContent = input.value.toUpperCase();
					};
				}(colorInput, colorValue, colorItem.color.hex));
				
				// 使用颜色选择器对话框
				var colorBlock = document.createElement('div');
				colorBlock.style.width = '50px';
				colorBlock.style.height = '40px';
				colorBlock.style.backgroundColor = colorInput.value;
				colorBlock.style.border = '1px solid #ccc';
				colorBlock.style.borderRadius = '4px';
				colorBlock.style.cursor = 'pointer';
				colorBlock.style.flexShrink = '0';
				colorBlock.style.marginLeft = '10px';
				colorBlock.title = '点击选择颜色';
				
				// 同步colorInput变化到colorBlock
				colorInput.addEventListener('input', function(input, block)
				{
					return function()
					{
						block.style.backgroundColor = input.value;
					};
				}(colorInput, colorBlock));
				
				colorBlock.addEventListener('click', function(originalColor, targetInput, targetBlock)
				{
					return function()
					{
						editorUi.pickColor(targetInput.value, function(newColor)
						{
							targetInput.value = newColor;
							targetBlock.style.backgroundColor = newColor;
							colorValue.textContent = newColor.toUpperCase();
						});
					};
				}(colorItem.color.hex, colorInput, colorBlock));
				
				mapDiv.appendChild(colorBlock);
				
				// 保存映射
				colorMappingInputs[colorItem.color.hex] = {
					input: colorInput,
					block: colorBlock,
					value: colorValue
				};
				
				mappingContainer.appendChild(mapDiv);
			}
			
			// 应用预设方案
			applyPresetScheme();
		}
		
		// 应用预设配色方案
		function applyPresetScheme()
		{
			var preset = presetSelect.value;
			if (preset === 'default')
			{
				return; // 保持原色
			}
			
			var scheme = presetSchemes[preset];
			if (!scheme || !scheme.colors || scheme.colors.length === 0)
			{
				return;
			}
			
			// 获取所有映射项
			var mappingItems = [];
			for (var hex in colorMappingInputs)
			{
				if (colorMappingInputs.hasOwnProperty(hex))
				{
					mappingItems.push({
						original: hex,
						element: colorMappingInputs[hex]
					});
				}
			}
			
			// 应用预设颜色
			for (var i = 0; i < mappingItems.length && i < scheme.colors.length; i++)
			{
				var presetColor = scheme.colors[i];
				var item = mappingItems[i];
				item.element.input.value = presetColor;
				item.element.block.style.backgroundColor = presetColor;
				item.element.value.textContent = presetColor.toUpperCase();
			}
		}
		
		// 监听数量变化
		countInput.addEventListener('change', updateColorMapping);
		countInput.addEventListener('input', updateColorMapping);
		
		// 监听预设方案变化
		presetSelect.addEventListener('change', applyPresetScheme);
		
		// 初始更新
		updateColorMapping();
		
		contentWrapper.appendChild(mappingContainer);
		
		// 将内容容器添加到主容器
		mainContainer.appendChild(contentWrapper);
		
		// 创建应用函数
		var applyFn = function()
		{
			var targetCount = parseInt(countInput.value);
			if (isNaN(targetCount) || targetCount < 1 || targetCount > 10)
			{
				editorUi.handleError({message: '颜色数量必须在1-10之间'});
				return;
			}
			
			// 选择前targetCount种主要颜色
			var mainColors = colors.slice(0, Math.min(targetCount, colors.length));
			
			// 创建颜色映射：使用用户选择的映射或默认映射
			var colorMapping = {};
			
			// 从用户输入构建映射
			var userMapping = {}; // originalHex -> newColor object
			for (var i = 0; i < mainColors.length; i++)
			{
				var originalHex = mainColors[i].color.hex;
				if (colorMappingInputs[originalHex])
				{
					var newColorHex = colorMappingInputs[originalHex].input.value;
					var newColor = parseColor(newColorHex);
					if (newColor)
					{
						userMapping[originalHex] = newColor;
						colorMapping[originalHex] = newColor;
					}
				}
			}
			
			// 其他颜色映射到最接近的主颜色（使用用户选择的新颜色）
			var targetColors = [];
			for (var i = 0; i < mainColors.length; i++)
			{
				var originalHex = mainColors[i].color.hex;
				if (userMapping[originalHex])
				{
					targetColors.push(userMapping[originalHex]);
				}
				else
				{
					targetColors.push(mainColors[i].color);
				}
			}
			
			for (var i = mainColors.length; i < colors.length; i++)
			{
				var color = colors[i].color;
				var closest = findClosestColor(color, mainColors.map(function(item) { return item.color; }));
				if (closest)
				{
					// 找到对应的新颜色
					var closestIndex = -1;
					for (var j = 0; j < mainColors.length; j++)
					{
						if (mainColors[j].color.hex === closest.hex)
						{
							closestIndex = j;
							break;
						}
					}
					
					if (closestIndex >= 0 && userMapping[mainColors[closestIndex].color.hex])
					{
						colorMapping[color.hex] = userMapping[mainColors[closestIndex].color.hex];
					}
					else
					{
						colorMapping[color.hex] = closest;
					}
				}
			}
			
			// 执行重新染色
			var newSvgString = recolorSvg(svgString, colorMapping);
			
			// 更新cell的SVG内容
			graph.getModel().beginUpdate();
			try
			{
				var style = graph.getCurrentCellStyle(cell);
				var image = mxUtils.getValue(style, mxConstants.STYLE_IMAGE, null);
				
				if (image && image.toLowerCase().indexOf('data:image/svg') === 0)
				{
					// 更新data URI
					var encodedSvg = 'data:image/svg+xml,' + encodeURIComponent(newSvgString);
					graph.setCellStyles(mxConstants.STYLE_IMAGE, encodedSvg, [cell]);
				}
				else
				{
					// 更新value节点
					var value = graph.getModel().getValue(cell);
					if (mxUtils.isNode(value))
					{
						var nodeName = value.nodeName ? value.nodeName.toLowerCase() : '';
						if (nodeName === 'svg')
						{
							var newDoc = mxUtils.parseXml(newSvgString);
							graph.getModel().setValue(cell, newDoc.documentElement);
						}
						else if (nodeName === 'svgimage')
						{
							var encodedSvg = 'data:image/svg+xml,' + encodeURIComponent(newSvgString);
							if (value.setAttribute)
							{
								value.setAttribute('svgText', encodeURIComponent(newSvgString));
								value.setAttribute('svgDataUri', encodedSvg);
							}
							graph.getModel().setValue(cell, value);
						}
					}
				}
				
				graph.refresh(cell);
			}
			finally
			{
				graph.getModel().endUpdate();
			}
			
			editorUi.editor.setModified(true);
			editorUi.editor.setStatus('SVG重新染色完成');
		};
		
		// 使用CustomDialog来确保按钮正常工作
		// CustomDialog会在mainContainer后面添加按钮区域
		var customDialog = new CustomDialog(editorUi, mainContainer, applyFn, function()
		{
			editorUi.hideDialog();
		}, '应用', null, null, false, '取消', false);
		
		// 确保CustomDialog的容器使用flex布局
		var dialogContainer = customDialog.container;
		if (dialogContainer)
		{
			// 检查是否已经有flex布局
			var computedStyle = window.getComputedStyle(dialogContainer);
			if (!computedStyle.display || computedStyle.display === 'block')
			{
				dialogContainer.style.display = 'flex';
				dialogContainer.style.flexDirection = 'column';
				dialogContainer.style.maxHeight = '80vh';
			}
			
			// 确保按钮区域有固定样式
			var buttonsArea = null;
			for (var i = 0; i < dialogContainer.childNodes.length; i++)
			{
				var child = dialogContainer.childNodes[i];
				if (child.nodeType === 1 && child.childNodes.length > 0)
				{
					// 查找包含按钮的div（通常是最后一个包含.geBtn类的div）
					var buttons = child.querySelectorAll && child.querySelectorAll('.geBtn');
					if (buttons && buttons.length > 0)
					{
						buttonsArea = child;
						break;
					}
				}
			}
			
			if (buttonsArea)
			{
				buttonsArea.style.flexShrink = '0';
				buttonsArea.style.padding = '10px 20px';
				buttonsArea.style.borderTop = '1px solid #ddd';
				buttonsArea.style.backgroundColor = '#fafafa';
			}
		}
		
		// 显示对话框
		editorUi.showDialog(dialogContainer, 600, 650, true, true, function()
		{
			if (countInput.focus)
			{
				countInput.focus();
			}
			
			// 延迟设置样式，确保CustomDialog已经完成DOM操作
			setTimeout(function()
			{
				// 确保dialogContainer使用flex布局
				dialogContainer.style.display = 'flex';
				dialogContainer.style.flexDirection = 'column';
				dialogContainer.style.maxHeight = '80vh';
				dialogContainer.style.overflow = 'hidden';
				
				// 设置mainContainer的flex属性
				if (mainContainer.parentNode === dialogContainer)
				{
					mainContainer.style.flex = '1';
					mainContainer.style.minHeight = '0';
					mainContainer.style.overflow = 'hidden';
				}
				
				// 设置contentWrapper确保可以滚动
				contentWrapper.style.flex = '1';
				contentWrapper.style.minHeight = '0';
				contentWrapper.style.maxHeight = 'none'; // 移除最大高度限制，让flex控制
				
				// 查找按钮区域并设置样式
				for (var i = 0; i < dialogContainer.childNodes.length; i++)
				{
					var child = dialogContainer.childNodes[i];
					if (child.nodeType === 1 && child !== mainContainer)
					{
						var buttons = child.querySelectorAll && child.querySelectorAll('.geBtn');
						if (buttons && buttons.length > 0)
						{
							child.style.flexShrink = '0';
							child.style.padding = '10px 20px';
							child.style.borderTop = '1px solid #ddd';
							child.style.backgroundColor = '#fafafa';
							child.style.textAlign = 'right';
							break;
						}
					}
				}
			}, 0);
			
			// 添加拖拽功能
			setTimeout(function()
			{
				var dialogDiv = customDialog.container;
				if (dialogDiv && dialogDiv.parentNode)
				{
					var dialogWindow = dialogDiv.parentNode;
					if (dialogWindow && dialogWindow.className && dialogWindow.className.indexOf('geDialog') >= 0)
					{
						// 使对话框可拖拽
						var isDragging = false;
						var dragStartX = 0;
						var dragStartY = 0;
						var dialogStartX = 0;
						var dialogStartY = 0;
						
						// 创建拖拽标题栏
						var titleBar = document.createElement('div');
						titleBar.style.height = '30px';
						titleBar.style.backgroundColor = '#f0f0f0';
						titleBar.style.borderBottom = '1px solid #ddd';
						titleBar.style.cursor = 'move';
						titleBar.style.padding = '5px 10px';
						titleBar.style.display = 'flex';
						titleBar.style.alignItems = 'center';
						titleBar.style.userSelect = 'none';
						titleBar.style.flexShrink = '0';
						
						var titleText = document.createElement('div');
						titleText.style.flex = '1';
						mxUtils.write(titleText, '智能色 - SVG颜色分析');
						titleBar.appendChild(titleText);
						
						// 将标题栏插入到对话框开头
						if (dialogDiv.firstChild)
						{
							dialogDiv.insertBefore(titleBar, dialogDiv.firstChild);
						}
						else
						{
							dialogDiv.appendChild(titleBar);
						}
						
						// 拖拽事件
						var startDrag = function(e)
						{
							isDragging = true;
							dragStartX = (e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0));
							dragStartY = (e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0));
							
							var rect = dialogWindow.getBoundingClientRect();
							dialogStartX = rect.left;
							dialogStartY = rect.top;
							
							var moveHandler = function(evt)
							{
								if (isDragging)
								{
									var clientX = evt.clientX || (evt.touches && evt.touches[0] ? evt.touches[0].clientX : dragStartX);
									var clientY = evt.clientY || (evt.touches && evt.touches[0] ? evt.touches[0].clientY : dragStartY);
									
									var deltaX = clientX - dragStartX;
									var deltaY = clientY - dragStartY;
									
									dialogWindow.style.left = (dialogStartX + deltaX) + 'px';
									dialogWindow.style.top = (dialogStartY + deltaY) + 'px';
									
									mxEvent.consume(evt);
								}
							};
							
							var endHandler = function(evt)
							{
								isDragging = false;
								mxEvent.removeListener(document, 'mousemove', moveHandler);
								mxEvent.removeListener(document, 'mouseup', endHandler);
								if (mxClient.IS_TOUCH)
								{
									mxEvent.removeListener(document, 'touchmove', moveHandler);
									mxEvent.removeListener(document, 'touchend', endHandler);
								}
								mxEvent.consume(evt);
							};
							
							mxEvent.addListener(document, 'mousemove', moveHandler);
							mxEvent.addListener(document, 'mouseup', endHandler);
							if (mxClient.IS_TOUCH)
							{
								mxEvent.addListener(document, 'touchmove', moveHandler);
								mxEvent.addListener(document, 'touchend', endHandler);
							}
							
							mxEvent.consume(e);
						};
						
						mxEvent.addListener(titleBar, 'mousedown', startDrag);
						if (mxClient.IS_TOUCH)
						{
							mxEvent.addListener(titleBar, 'touchstart', startDrag);
						}
					}
				}
			}, 50);
		});
	}
	
	// 添加右键菜单项
	// 使用延迟加载确保menus对象已初始化
	var initMenuHandler = function()
	{
		if (window.console)
		{
			console.log('[SVG Smart Color] initMenuHandler 被调用');
			console.log('[SVG Smart Color] editorUi.menus:', editorUi.menus ? '存在' : '不存在');
			console.log('[SVG Smart Color] addPopupMenuCellItems:', editorUi.menus && editorUi.menus.addPopupMenuCellItems ? '存在' : '不存在');
			console.log('[SVG Smart Color] _svgSmartColorMenuHandlerAdded:', window._svgSmartColorMenuHandlerAdded);
		}
		
		if (editorUi.menus && editorUi.menus.addPopupMenuCellItems && !window._svgSmartColorMenuHandlerAdded)
		{
			var addPopupMenuCellItems = editorUi.menus.addPopupMenuCellItems;
			
			editorUi.menus.addPopupMenuCellItems = function(menu, cell, evt)
			{
				addPopupMenuCellItems.apply(this, arguments);
				
				var graph = editorUi.editor.graph;
				if (cell != null && graph.getSelectionCount() == 1 && graph.getModel().isVertex(cell))
				{
					var isSvg = isSvgCell(cell);
					if (window.console)
					{
						console.log('[SVG Smart Color] 检查cell:', cell, '是否为SVG:', isSvg);
					}
					
					if (isSvg)
					{
						menu.addSeparator();
						menu.addItem('智能色', null, function()
						{
							showSmartColorDialog(cell);
						});
					}
				}
			};
			
			window._svgSmartColorMenuHandlerAdded = true;
			
			if (window.console)
			{
				console.log('[SVG Smart Color] 菜单处理器已注册');
			}
			
			return true; // 成功注册
		}
		else
		{
			if (window.console)
			{
				console.log('[SVG Smart Color] 菜单处理器注册失败 - 条件不满足');
			}
			return false; // 注册失败
		}
	};
	
	// 立即尝试注册
	var registered = initMenuHandler();
	
	// 如果menus对象还不存在，稍后重试
	if (!registered)
	{
		if (window.console)
		{
			console.log('[SVG Smart Color] 延迟注册菜单处理器...');
		}
		
		// 尝试多次延迟注册
		var retryCount = 0;
		var maxRetries = 20; // 最多重试20次（2秒）
		
		var retryInterval = setInterval(function()
		{
			retryCount++;
			registered = initMenuHandler();
			
			if (registered)
			{
				clearInterval(retryInterval);
				if (window.console)
				{
					console.log('[SVG Smart Color] 菜单处理器延迟注册成功');
				}
			}
			else if (retryCount >= maxRetries)
			{
				clearInterval(retryInterval);
				if (window.console)
				{
					console.error('[SVG Smart Color] 菜单处理器注册失败：menus对象未找到');
				}
			}
		}, 100);
	}
	
	if (window.console)
	{
		console.log('[SVG Smart Color] 插件已加载');
	}
});

