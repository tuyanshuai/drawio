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
				var commaIndex = image.indexOf(',');
				if (commaIndex >= 0)
				{
					var dataPart = image.substring(commaIndex + 1);
					var isBase64 = lowerImage.indexOf(';base64,') > 0;
					
					if (isBase64)
					{
						// Base64 编码的 SVG
						try
						{
							svgString = Graph.getSvgFromDataUri(image);
						}
						catch (e)
						{
							if (window.console)
							{
								console.warn('[SVG Smart Color] Base64解码失败:', e);
							}
							// 尝试手动解码
							try
							{
								if (window.atob)
								{
									var decoded = window.atob(dataPart);
									svgString = decodeURIComponent(escape(decoded));
								}
							}
							catch (e2)
							{
								if (window.console)
								{
									console.warn('[SVG Smart Color] 手动Base64解码失败:', e2);
								}
							}
						}
					}
					else
					{
						// URL 编码的 SVG
						try
						{
							svgString = decodeURIComponent(dataPart);
						}
						catch (e)
						{
							if (window.console)
							{
								console.warn('[SVG Smart Color] URL解码失败:', e);
							}
							// 如果URL解码失败，检查是否已经是纯文本
							if (dataPart.trim().charAt(0) === '<')
							{
								svgString = dataPart;
							}
							else
							{
								// 最后尝试使用 Graph.getSvgFromDataUri（可能内部处理了）
								try
								{
									svgString = Graph.getSvgFromDataUri(image);
								}
								catch (e2)
								{
									if (window.console)
									{
										console.warn('[SVG Smart Color] Graph.getSvgFromDataUri 也失败:', e2);
									}
								}
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
						var comma = dataUri.indexOf(',');
						if (comma >= 0)
						{
							var dataPart = dataUri.substring(comma + 1);
							var isBase64 = dataUri.toLowerCase().indexOf(';base64,') > 0;
							
							if (isBase64)
							{
								// Base64 编码的 SVG
								try
								{
									svgString = Graph.getSvgFromDataUri(dataUri);
								}
								catch (e)
								{
									if (window.console)
									{
										console.warn('[SVG Smart Color] 从svgDataUri Base64解码失败:', e);
									}
									// 尝试手动解码
									try
									{
										if (window.atob)
										{
											var decoded = window.atob(dataPart);
											svgString = decodeURIComponent(escape(decoded));
										}
									}
									catch (e2)
									{
										if (window.console)
										{
											console.warn('[SVG Smart Color] 手动Base64解码失败:', e2);
										}
									}
								}
							}
							else
							{
								// URL 编码的 SVG
								try
								{
									svgString = decodeURIComponent(dataPart);
								}
								catch (e)
								{
									if (window.console)
									{
										console.warn('[SVG Smart Color] 从svgDataUri URL解码失败:', e);
									}
									// 如果URL解码失败，检查是否已经是纯文本
									if (dataPart.trim().charAt(0) === '<')
									{
										svgString = dataPart;
									}
									else
									{
										// 最后尝试使用 Graph.getSvgFromDataUri
										try
										{
											svgString = Graph.getSvgFromDataUri(dataUri);
										}
										catch (e2)
										{
											if (window.console)
											{
												console.warn('[SVG Smart Color] Graph.getSvgFromDataUri 也失败:', e2);
											}
										}
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
	 * 分析SVG中的颜色及其区域面积（异步版本，使用Canvas）
	 * 使用Canvas渲染SVG为PNG，然后统计每种颜色的像素面积
	 * @returns {Promise<Array>} 返回颜色数组的Promise
	 */
	function analyzeSvgColorsAsync(svgString)
	{
		return new Promise(function(resolve, reject)
		{
			if (!svgString)
			{
				resolve([]);
				return;
			}
			
			try
			{
				var doc = mxUtils.parseXml(svgString);
				var svgElement = doc.documentElement;
				
				if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg')
				{
					resolve([]);
					return;
				}
				
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
				
				// 将SVG转换为Blob URL
				var svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
				var url = URL.createObjectURL(svgBlob);
				
				// 创建Image对象加载SVG
				var img = new Image();
				img.onload = function()
				{
					try
					{
						// 创建Canvas
						var canvas = document.createElement('canvas');
						// 使用合理的分辨率（最大2048px，保持比例）
						var maxResolution = 2048;
						var scale = Math.min(1, maxResolution / Math.max(vbWidth, vbHeight));
						canvas.width = Math.round(vbWidth * scale);
						canvas.height = Math.round(vbHeight * scale);
						
						var ctx = canvas.getContext('2d');
						
						// 绘制白色背景（确保透明区域有颜色）
						ctx.fillStyle = '#FFFFFF';
						ctx.fillRect(0, 0, canvas.width, canvas.height);
						
						// 绘制SVG到Canvas
						ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
						
						// 获取像素数据
						var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
						var pixels = imageData.data;
						
						// 统计颜色及其像素数量（面积）
						var colorMap = {}; // color -> {color, area (像素数), count}
						
						// 遍历所有像素
						for (var i = 0; i < pixels.length; i += 4)
						{
							var r = pixels[i];
							var g = pixels[i + 1];
							var b = pixels[i + 2];
							var a = pixels[i + 3];
							
							// 跳过完全透明的像素
							if (a < 128)
							{
								continue;
							}
							
							// 将颜色转换为hex
							var hex = rgbToHex(r, g, b);
							
							// 初始化或更新颜色统计
							if (!colorMap[hex])
							{
								colorMap[hex] = {
									color: {r: r, g: g, b: b, hex: hex},
									area: 0,
									count: 0
								};
							}
							
							// 增加该颜色的像素数量（面积）
							colorMap[hex].area += 1;
							colorMap[hex].count += 1;
						}
						
						// 转换为数组并按面积（像素数）排序
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
						
						// 清理
						URL.revokeObjectURL(url);
						if (window.console)
						{
							console.log('[SVG Smart Color] 颜色分析完成（Canvas方法），共发现', colors.length, '种颜色');
						}
						
						resolve(colors);
					}
					catch (e)
					{
						if (window.console)
						{
							console.error('[SVG Smart Color] Canvas分析出错:', e);
						}
						URL.revokeObjectURL(url);
						// 回退到备用方法
						analyzeSvgColorsFallback(svgString).then(resolve).catch(reject);
					}
				};
				
				img.onerror = function()
				{
					if (window.console)
					{
						console.error('[SVG Smart Color] SVG加载失败，使用备用方法');
					}
					URL.revokeObjectURL(url);
					// 回退到备用方法
					analyzeSvgColorsFallback(svgString).then(resolve).catch(reject);
				};
				
				img.src = url;
			}
			catch (e)
			{
				if (window.console)
				{
					console.error('[SVG Smart Color] 分析SVG颜色时出错:', e);
				}
				reject(e);
			}
		});
	}
	
	/**
	 * 分析SVG中的颜色及其区域面积（同步版本，兼容旧代码）
	 * 为了保持API兼容性，直接使用Canvas异步方法，但在调用方使用Promise
	 */
	function analyzeSvgColors(svgString)
	{
		// 为了兼容，直接返回异步版本
		// 调用方需要改为使用 analyzeSvgColorsAsync
		// 这里暂时使用备用方法作为同步返回
		if (!svgString)
		{
			return [];
		}
		
		// 直接使用备用方法（同步）
		// 注意：为了获得准确的结果，调用方应该使用 analyzeSvgColorsAsync
		try
		{
			return analyzeSvgColorsFallbackSync(svgString);
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[SVG Smart Color] 分析失败:', e);
			}
			return [];
		}
	}
	
	/**
	 * 备用方法：当Canvas方法失败时使用的简化分析方法（返回Promise）
	 */
	function analyzeSvgColorsFallback(svgString)
	{
		return new Promise(function(resolve, reject)
		{
			try
			{
				var result = analyzeSvgColorsFallbackSync(svgString);
				resolve(result);
			}
			catch (e)
			{
				reject(e);
			}
		});
	}
	
	/**
	 * 备用方法：同步版本的DOM遍历分析方法
	 */
	function analyzeSvgColorsFallbackSync(svgString)
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
	 * 启动颜色吸管工具，让用户在SVG上选择颜色
	 */
	function startColorDropper(cell, onColorSelected, svgStringOverride)
	{
		if (window.console)
		{
			console.log('[SVG Color Dropper] ===== 启动颜色吸管工具 =====');
			console.log('[SVG Color Dropper] Cell:', cell);
			console.log('[SVG Color Dropper] onColorSelected回调:', typeof onColorSelected);
			console.log('[SVG Color Dropper] svgStringOverride:', svgStringOverride ? '提供' : '未提供');
		}
		
		if (!cell || !onColorSelected)
		{
			if (window.console)
			{
				console.error('[SVG Color Dropper] ✗ 参数无效:', {
					cell: cell ? '存在' : 'null',
					onColorSelected: onColorSelected ? '存在' : 'null'
				});
			}
			return;
		}
		
		// 如果提供了SVG字符串覆盖，使用它；否则从cell获取
		var svgString = svgStringOverride || getSvgContent(cell);
		if (!svgString)
		{
			if (window.console)
			{
				console.error('[SVG Color Dropper] ✗ 无法获取SVG内容');
			}
			editorUi.handleError({message: '无法获取SVG内容'});
			return;
		}
		
		if (window.console)
		{
			console.log('[SVG Color Dropper] ✓ SVG内容获取成功，长度:', svgString.length);
			if (svgStringOverride)
			{
				console.log('[SVG Color Dropper] 使用提供的SVG字符串（可能是已应用的SVG）');
			}
		}
		
		// 创建吸管工具状态
		var isDropping = true;
		var cursor = graph.container.style.cursor || '';
		
		// 保存graph的原始状态
		var originalEnabled = graph.enabled;
		var originalDragEnabled = graph.dragEnabled;
		var originalPanEnabled = graph.panEnabled;
		
		graph.enabled = false;
		if (graph.setEnabled !== undefined)
		{
			graph.setEnabled(false);
		}
		graph.dragEnabled = false;
		if (graph.setDragEnabled !== undefined)
		{
			graph.setDragEnabled(false);
		}
		
		// 禁用panning（拖拽平移）
		if (graph.setPanEnabled !== undefined)
		{
			originalPanEnabled = graph.panEnabled;
			graph.setPanEnabled(false);
		}
		
		// 使用CSS样式来强制覆盖光标（覆盖所有元素，包括graph内部的）
		var styleSheet = document.createElement('style');
		styleSheet.id = 'svg-dropper-cursor-style';
		styleSheet.textContent = '* { cursor: crosshair !important; }';
		document.head.appendChild(styleSheet);
		
		// 也直接在container和body上设置
		graph.container.style.setProperty('cursor', 'crosshair', 'important');
		if (document.body)
		{
			document.body.style.setProperty('cursor', 'crosshair', 'important');
		}
		
		// 保存并替换graph的鼠标移动处理，防止光标被改变
		var originalMouseMove = graph.onMouseMove;
		var originalGetCursorForCell = graph.getCursorForCell;
		
		// 覆盖鼠标移动处理，强制保持十字光标
		if (graph.onMouseMove !== undefined)
		{
			graph.onMouseMove = function(me)
			{
				// 强制设置光标
				graph.container.style.setProperty('cursor', 'crosshair', 'important');
				if (document.body)
				{
					document.body.style.setProperty('cursor', 'crosshair', 'important');
				}
				// 不调用原始方法，完全禁用graph的鼠标处理
			};
		}
		
		// 覆盖getCursorForCell方法，始终返回crosshair
		if (graph.getCursorForCell !== undefined)
		{
			graph.getCursorForCell = function(cell)
			{
				return 'crosshair';
			};
		}
		
		// 创建canvas用于颜色采样
		var canvas = document.createElement('canvas');
		var img = new Image();
		var svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
		var url = URL.createObjectURL(svgBlob);
		
		var state = graph.view.getState(cell);
		if (!state)
		{
			URL.revokeObjectURL(url);
			graph.container.style.cursor = cursor;
			return;
		}
		
		// 使用cellBounds获取模型坐标（未缩放的graph坐标）
		var cellBounds = state.cellBounds;
		if (!cellBounds)
		{
			// 如果没有cellBounds，手动计算
			var scale = graph.view.scale;
			var translate = graph.view.translate;
			cellBounds = {
				x: state.x / scale - translate.x,
				y: state.y / scale - translate.y,
				width: state.width / scale,
				height: state.height / scale
			};
		}
		
		var cellX = cellBounds.x;
		var cellY = cellBounds.y;
		var cellWidth = cellBounds.width;
		var cellHeight = cellBounds.height;
		
		if (window.console)
		{
			console.log('[SVG Color Dropper] state位置 (view坐标):', state.x, state.y, state.width, state.height);
			console.log('[SVG Color Dropper] cellBounds (模型坐标):', cellX, cellY, cellWidth, cellHeight);
		}
		
		// 解析SVG获取viewBox
		var svgDoc = mxUtils.parseXml(svgString);
		var svgElement = svgDoc.documentElement;
		if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg')
		{
			URL.revokeObjectURL(url);
			graph.container.style.cursor = cursor;
			return;
		}
		
		var viewBox = svgElement.getAttribute('viewBox');
		var svgWidth = parseFloat(svgElement.getAttribute('width')) || cellWidth;
		var svgHeight = parseFloat(svgElement.getAttribute('height')) || cellHeight;
		
		var vbX = 0, vbY = 0, vbWidth = svgWidth, vbHeight = svgHeight;
		if (viewBox)
		{
			var vb = viewBox.split(/\s+|,/);
			if (vb.length >= 4)
			{
				vbX = parseFloat(vb[0]) || 0;
				vbY = parseFloat(vb[1]) || 0;
				vbWidth = parseFloat(vb[2]) || svgWidth;
				vbHeight = parseFloat(vb[3]) || svgHeight;
			}
		}
		
		// 准备canvas（一次性渲染）
		img.onload = function()
		{
			if (window.console)
			{
				console.log('[SVG Color Dropper] ===== 图像加载完成 =====');
				console.log('[SVG Color Dropper] Canvas尺寸:', vbWidth, vbHeight);
			}
			
			canvas.width = vbWidth;
			canvas.height = vbHeight;
			var ctx = canvas.getContext('2d');
			
			if (window.console)
			{
				console.log('[SVG Color Dropper] Canvas context创建成功');
			}
			
			ctx.drawImage(img, 0, 0, vbWidth, vbHeight);
			
			if (window.console)
			{
				console.log('[SVG Color Dropper] 图像已绘制到canvas');
				
				// 验证canvas内容（采样中心点）
				try
				{
					var testData = ctx.getImageData(Math.floor(vbWidth / 2), Math.floor(vbHeight / 2), 1, 1);
					var testColor = rgbToHex(testData.data[0], testData.data[1], testData.data[2]);
					console.log('[SVG Color Dropper] Canvas中心点颜色（验证）:', testColor);
				}
				catch (e)
				{
					console.warn('[SVG Color Dropper] 无法验证canvas内容:', e);
				}
			}
			
			// 清理函数
			var cleanup = function()
			{
				isDropping = false;
				
				// 恢复graph的鼠标事件处理
				if (originalMouseMove !== undefined)
				{
					graph.onMouseMove = originalMouseMove;
				}
				if (originalGetCursorForCell !== undefined)
				{
					graph.getCursorForCell = originalGetCursorForCell;
				}
				
				// 恢复graph的交互状态
				graph.enabled = originalEnabled;
				if (graph.setEnabled !== undefined)
				{
					graph.setEnabled(originalEnabled);
				}
				graph.dragEnabled = originalDragEnabled;
				if (graph.setDragEnabled !== undefined)
				{
					graph.setDragEnabled(originalDragEnabled);
				}
				if (graph.setPanEnabled !== undefined && originalPanEnabled !== undefined)
				{
					graph.setPanEnabled(originalPanEnabled);
				}
				
				// 移除强制光标样式
				var styleSheet = document.getElementById('svg-dropper-cursor-style');
				if (styleSheet && styleSheet.parentNode)
				{
					styleSheet.parentNode.removeChild(styleSheet);
				}
				
				// 恢复光标
				graph.container.style.removeProperty('cursor');
				if (cursor)
				{
					graph.container.style.cursor = cursor;
				}
				
				// 恢复body光标
				if (document.body)
				{
					document.body.style.removeProperty('cursor');
				}
				
				// 移除事件监听
				document.removeEventListener('mousemove', mouseMoveHandler, true);
				document.removeEventListener('click', mouseClickHandler, true);
				document.removeEventListener('contextmenu', cancelHandler, true);
				document.removeEventListener('mousedown', mouseDownHandler, true);
				
				URL.revokeObjectURL(url);
			};
			
			// 鼠标按下事件（用于捕获，防止graph拦截）
			var mouseDownHandler = function(evt)
			{
				if (window.console)
				{
					console.log('[SVG Color Dropper] ===== mousedown 事件触发 =====');
					console.log('[SVG Color Dropper] isDropping:', isDropping);
				}
				
				if (!isDropping) 
				{
					if (window.console)
					{
						console.log('[SVG Color Dropper] 跳过：isDropping为false');
					}
					return;
				}
				
				// 阻止所有默认行为和事件传播，确保graph不会处理
				evt.preventDefault();
				evt.stopPropagation();
				evt.stopImmediatePropagation();
				
				if (window.console)
				{
					console.log('[SVG Color Dropper] 已阻止事件传播');
				}
				
				// 检查是否点击在SVG cell上
				var mouseX = evt.clientX || mxEvent.getClientX(evt);
				var mouseY = evt.clientY || mxEvent.getClientY(evt);
				
				if (window.console)
				{
					console.log('[SVG Color Dropper] 鼠标位置 (client):', mouseX, mouseY);
				}
				
				// 使用graph的方法转换坐标（graph坐标系）
				var graphPoint = null;
				try
				{
					graphPoint = graph.getPointForEvent(evt, false);
				}
				catch (e)
				{
					if (window.console)
					{
						console.warn('[SVG Color Dropper] getPointForEvent失败，使用手动计算:', e);
					}
				}
				
				// 如果getPointForEvent失败，手动计算
				if (!graphPoint)
				{
					var graphContainer = graph.container;
					var containerRect = graphContainer.getBoundingClientRect();
					
					// 获取鼠标在container中的位置
					var containerX = mouseX - containerRect.left;
					var containerY = mouseY - containerRect.top;
					
					var scale = graph.view.scale;
					var translate = graph.view.translate;
					
					// 转换为graph坐标（未缩放的graph坐标系）
					graphPoint = new mxPoint(
						containerX / scale - translate.x,
						containerY / scale - translate.y
					);
					
					if (window.console)
					{
						console.log('[SVG Color Dropper] container位置:', containerRect.left, containerRect.top);
						console.log('[SVG Color Dropper] 鼠标在container中的位置:', containerX, containerY);
						console.log('[SVG Color Dropper] 手动计算graph坐标:', graphPoint.x, graphPoint.y);
					}
				}
				else
				{
					if (window.console)
					{
						console.log('[SVG Color Dropper] graph坐标 (getPointForEvent):', graphPoint.x, graphPoint.y);
					}
				}
				
				if (window.console)
				{
					console.log('[SVG Color Dropper] scale:', graph.view.scale, 'translate:', graph.view.translate.x, graph.view.translate.y);
					console.log('[SVG Color Dropper] cell位置:', cellX, cellY, '尺寸:', cellWidth, cellHeight);
				}
				
				// 计算鼠标相对于cell的位置
				var relativeX = graphPoint.x - cellX;
				var relativeY = graphPoint.y - cellY;
				
				if (window.console)
				{
					console.log('[SVG Color Dropper] 相对cell位置:', relativeX, relativeY);
				}
				
				// 检查是否在cell范围内
				if (relativeX >= 0 && relativeX <= cellWidth && relativeY >= 0 && relativeY <= cellHeight)
				{
					if (window.console)
					{
						console.log('[SVG Color Dropper] ✓ 在cell范围内');
					}
					
					// 转换为SVG坐标
					var svgX = vbX + (relativeX / cellWidth) * vbWidth;
					var svgY = vbY + (relativeY / cellHeight) * vbHeight;
					
					if (window.console)
					{
						console.log('[SVG Color Dropper] SVG坐标:', svgX, svgY);
						console.log('[SVG Color Dropper] viewBox:', vbX, vbY, vbWidth, vbHeight);
					}
					
					// 采样颜色
					var sampleX = Math.max(0, Math.min(vbWidth - 1, Math.round(svgX - vbX)));
					var sampleY = Math.max(0, Math.min(vbHeight - 1, Math.round(svgY - vbY)));
					
					if (window.console)
					{
						console.log('[SVG Color Dropper] Canvas采样位置:', sampleX, sampleY);
						console.log('[SVG Color Dropper] Canvas尺寸:', vbWidth, vbHeight);
						console.log('[SVG Color Dropper] ctx存在:', ctx !== null && ctx !== undefined);
					}
					
					try
					{
						if (!ctx)
						{
							throw new Error('Canvas context不存在');
						}
						
						if (window.console)
						{
							console.log('[SVG Color Dropper] 开始采样...');
						}
						
						var imageData = ctx.getImageData(sampleX, sampleY, 1, 1);
						
						if (window.console)
						{
							console.log('[SVG Color Dropper] 成功获取imageData');
						}
						
						var pixelData = imageData.data;
						
						if (window.console)
						{
							console.log('[SVG Color Dropper] 像素数据:', pixelData[0], pixelData[1], pixelData[2], pixelData[3]);
						}
						
						var color = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
						
						if (window.console)
						{
							console.log('[SVG Color Dropper] ✓ 成功获取颜色:', color);
							console.log('[SVG Color Dropper] 准备调用回调函数...');
						}
						
						// 调用回调
						onColorSelected(color);
						
						if (window.console)
						{
							console.log('[SVG Color Dropper] ✓ 回调已调用，开始清理...');
						}
						
						// 清理
						cleanup();
						
						if (window.console)
						{
							console.log('[SVG Color Dropper] ===== 完成 =====');
						}
					}
					catch (e)
					{
						if (window.console)
						{
							console.error('[SVG Color Dropper] ✗ 错误:', e);
							console.error('[SVG Color Dropper] 错误堆栈:', e.stack);
						}
						editorUi.handleError({message: '获取颜色失败: ' + e.message});
						cleanup();
					}
				}
				else
				{
					if (window.console)
					{
						console.log('[SVG Color Dropper] ✗ 不在cell范围内，取消吸管模式');
						console.log('[SVG Color Dropper] 范围检查:', {
							relativeX: relativeX,
							relativeY: relativeY,
							cellWidth: cellWidth,
							cellHeight: cellHeight,
							inRangeX: relativeX >= 0 && relativeX <= cellWidth,
							inRangeY: relativeY >= 0 && relativeY <= cellHeight
						});
					}
					// 点击在cell外，取消吸管模式
					cleanup();
				}
			};
			
			// 鼠标移动事件（用于实时预览和保持光标）
			var mouseMoveHandler = function(evt)
			{
				if (!isDropping) return;
				
				// 强制设置光标为十字形，覆盖任何其他样式
				graph.container.style.setProperty('cursor', 'crosshair', 'important');
				
				// 也设置在整个文档上（防止graph内部元素覆盖）
				if (document.body)
				{
					document.body.style.setProperty('cursor', 'crosshair', 'important');
				}
				
				var mouseX = evt.clientX || mxEvent.getClientX(evt);
				var mouseY = evt.clientY || mxEvent.getClientY(evt);
				
				// 使用graph的方法转换坐标（graph坐标系）
				var graphPoint = null;
				try
				{
					graphPoint = graph.getPointForEvent(evt, false);
				}
				catch (e)
				{
					// 如果失败，手动计算
					var graphContainer = graph.container;
					var containerRect = graphContainer.getBoundingClientRect();
					
					var containerX = mouseX - containerRect.left;
					var containerY = mouseY - containerRect.top;
					
					var scale = graph.view.scale;
					var translate = graph.view.translate;
					
					graphPoint = new mxPoint(
						containerX / scale - translate.x,
						containerY / scale - translate.y
					);
				}
				
				// 计算鼠标相对于cell的位置
				var relativeX = graphPoint.x - cellX;
				var relativeY = graphPoint.y - cellY;
				
				// 检查是否在cell范围内
				if (relativeX >= 0 && relativeX <= cellWidth && relativeY >= 0 && relativeY <= cellHeight)
				{
					// 转换为SVG坐标
					var svgX = vbX + (relativeX / cellWidth) * vbWidth;
					var svgY = vbY + (relativeY / cellHeight) * vbHeight;
					
					// 采样颜色
					var sampleX = Math.max(0, Math.min(vbWidth - 1, Math.round(svgX - vbX)));
					var sampleY = Math.max(0, Math.min(vbHeight - 1, Math.round(svgY - vbY)));
					
					try
					{
						var imageData = ctx.getImageData(sampleX, sampleY, 1, 1);
						var pixelData = imageData.data;
						var color = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
						
						// 实时显示颜色（可选：显示提示）
						if (window.console && window.location.search.indexOf('debug') >= 0)
						{
							console.log('[SVG Color Dropper] 颜色:', color);
						}
					}
					catch (e)
					{
						// ignore
					}
				}
			};
			
			// 点击事件（备用方案）
			var mouseClickHandler = function(evt)
			{
				// 这个事件可能已经被mouseDownHandler处理了
				// 但作为备用，我们也可以处理
			};
			
			var cancelHandler = function(evt)
			{
				evt.preventDefault();
				evt.stopPropagation();
				cleanup();
			};
			
			// 添加事件监听（使用捕获阶段确保优先处理）
			document.addEventListener('mousedown', mouseDownHandler, true);
			document.addEventListener('mousemove', mouseMoveHandler, true);
			document.addEventListener('click', mouseClickHandler, true);
			document.addEventListener('contextmenu', cancelHandler, true);
			
			if (window.console)
			{
				console.log('[SVG Color Dropper] ✓ 事件监听器已添加');
				console.log('[SVG Color Dropper] 等待用户点击...');
			}
			
			// 提示用户
			editorUi.editor.setStatus('点击SVG上的颜色进行选择，右键取消');
		};
		
		img.onerror = function(e)
		{
			if (window.console)
			{
				console.error('[SVG Color Dropper] ✗ 图像加载失败');
				console.error('[SVG Color Dropper] URL:', url);
				console.error('[SVG Color Dropper] 错误:', e);
			}
			
			URL.revokeObjectURL(url);
			
			// 恢复graph状态
			if (originalMouseMove !== undefined)
			{
				graph.onMouseMove = originalMouseMove;
			}
			if (originalGetCursorForCell !== undefined)
			{
				graph.getCursorForCell = originalGetCursorForCell;
			}
			graph.enabled = originalEnabled;
			if (graph.setEnabled !== undefined)
			{
				graph.setEnabled(originalEnabled);
			}
			graph.dragEnabled = originalDragEnabled;
			if (graph.setDragEnabled !== undefined)
			{
				graph.setDragEnabled(originalDragEnabled);
			}
			
			// 移除样式
			var styleSheet = document.getElementById('svg-dropper-cursor-style');
			if (styleSheet && styleSheet.parentNode)
			{
				styleSheet.parentNode.removeChild(styleSheet);
			}
			graph.container.style.cursor = cursor || '';
			
			editorUi.handleError({message: '无法加载SVG图像'});
		};
		
		if (window.console)
		{
			console.log('[SVG Color Dropper] ===== 启动吸管工具 =====');
			console.log('[SVG Color Dropper] SVG字符串长度:', svgString.length);
			console.log('[SVG Color Dropper] SVG预览:', svgString.substring(0, Math.min(100, svgString.length)));
			console.log('[SVG Color Dropper] Blob URL:', url);
			console.log('[SVG Color Dropper] 等待图像加载...');
		}
		
		img.src = url;
	}
	
	/**
	 * 替换SVG中指定的颜色
	 */
	function replaceColorInSvg(svgString, oldColorHex, newColorHex)
	{
		if (!svgString || !oldColorHex || !newColorHex)
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
			function replaceColor(element)
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
						if (fillColor && fillColor.hex.toLowerCase() === oldColorHex.toLowerCase())
						{
							element.setAttribute('fill', newColorHex);
						}
					}
					
					// 处理style属性中的fill颜色
					var style = element.getAttribute('style');
					if (style)
					{
						var newStyle = style;
						var fillMatch = style.match(/fill\s*:\s*([^;]+)/i);
						if (fillMatch)
						{
							var fillValue = fillMatch[1].trim();
							var fillColor = parseColor(fillValue);
							if (fillColor && fillColor.hex.toLowerCase() === oldColorHex.toLowerCase())
							{
								newStyle = newStyle.replace(/fill\s*:\s*[^;]+/i, 'fill:' + newColorHex);
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
					replaceColor(element.childNodes[i]);
				}
			}
			
			replaceColor(svgElement);
			
			return mxUtils.getXml(svgElement);
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[SVG Smart Color] 替换颜色时出错:', e);
			}
			return svgString;
		}
	}
	
	/**
	 * 在样式面板中显示局部改色选项
	 */
	function showLocalRecolorInFormatPanel(cell, originalSvgString)
	{
		var format = editorUi.format;
		if (!format || !format.container)
		{
			return;
		}
		
		// 移除之前的面板
		var oldPanel = document.getElementById('svg-local-recolor-panel');
		if (oldPanel && oldPanel.parentNode)
		{
			oldPanel.parentNode.removeChild(oldPanel);
		}
		
		// 创建局部改色面板
		var panel = document.createElement('div');
		panel.id = 'svg-local-recolor-panel';
		panel.className = 'geStyleOptions';
		panel.style.padding = '8px 12px';
		panel.style.borderTop = '1px solid var(--gePrimaryBorderColor, #e0e0e0)';
		
		// 标题
		var title = document.createElement('div');
		title.style.fontWeight = '600';
		title.style.fontSize = '12px';
		title.style.marginBottom = '8px';
		title.style.color = 'var(--geTextColor, #333)';
		mxUtils.write(title, '局部改色');
		panel.appendChild(title);
		
		// 当前颜色显示和吸管工具
		// 使用cell的ID作为key，将颜色值存储在外部，防止格式面板刷新时丢失
		var storageKey = 'svg-recolor-' + (cell.id || 'default');
		var currentColor = null;
		var colorToReplaceHex = null;
		
		// 尝试从存储中恢复颜色值（如果格式面板被刷新）
		if (window[storageKey])
		{
			currentColor = window[storageKey].currentColor;
			colorToReplaceHex = window[storageKey].colorToReplaceHex;
		}
		
		// 保存颜色值的函数（包括新颜色）
		var saveColorValues = function()
		{
			if (!window[storageKey])
			{
				window[storageKey] = {};
			}
			window[storageKey].currentColor = currentColor;
			window[storageKey].colorToReplaceHex = colorToReplaceHex;
			// 也保存新颜色值
			if (colorInput && colorInput.value)
			{
				window[storageKey].newColorInput = colorInput.value.trim();
			}
			if (newColorPreview && newColorPreview.style && newColorPreview.style.backgroundColor)
			{
				window[storageKey].newColorPreview = newColorPreview.style.backgroundColor;
			}
		};
		
		// 深度绑定：设置currentColor并同步UI和存储
		var setCurrentColor = function(newColor, skipSave)
		{
			if (window.console)
			{
				console.log('[SVG Smart Color] setCurrentColor: 从', currentColor, '更新到', newColor);
			}
			currentColor = newColor;
			
			// 确保UI元素引用有效（重新查找，防止引用丢失）
			var panel = document.getElementById('svg-local-recolor-panel');
			if (panel)
			{
				var preview = panel.querySelector('[data-color-preview="current"]');
				var value = panel.querySelector('[data-color-value="current"]');
				if (preview)
				{
					currentColorPreview = preview;
				}
				if (value)
				{
					currentColorValue = value;
				}
			}
			
			// 立即更新UI
			if (currentColorPreview && currentColorPreview.style)
			{
				currentColorPreview.style.backgroundColor = currentColor;
				if (window.console)
				{
					console.log('[SVG Smart Color] setCurrentColor: 已更新preview颜色为', currentColor);
				}
			}
			else if (window.console)
			{
				console.warn('[SVG Smart Color] setCurrentColor: currentColorPreview不存在，无法更新UI');
			}
			
			if (currentColorValue)
			{
				currentColorValue.textContent = currentColor;
				if (window.console)
				{
					console.log('[SVG Smart Color] setCurrentColor: 已更新value文本为', currentColor);
				}
			}
			else if (window.console)
			{
				console.warn('[SVG Smart Color] setCurrentColor: currentColorValue不存在，无法更新UI');
			}
			
			// 保存到外部存储（除非明确跳过）
			if (!skipSave)
			{
				saveColorValues();
			}
			
			if (window.console)
			{
				console.log('[SVG Smart Color] setCurrentColor完成: UI已更新，存储已保存');
				console.log('[SVG Smart Color] setCurrentColor验证:', {
					currentColor变量: currentColor,
					preview显示: currentColorPreview ? currentColorPreview.style.backgroundColor : 'N/A',
					value显示: currentColorValue ? currentColorValue.textContent : 'N/A'
				});
			}
		};
		
		// 深度绑定：设置colorToReplaceHex并同步存储
		var setColorToReplaceHex = function(newColor)
		{
			if (window.console)
			{
				console.log('[SVG Smart Color] setColorToReplaceHex: 从', colorToReplaceHex, '更新到', newColor);
			}
			colorToReplaceHex = newColor;
			saveColorValues();
		};
		
		// 防止forceSyncUI被频繁调用的标志
		var isSyncing = false;
		
		// 强制同步UI与内存变量（核心函数）
		var forceSyncUI = function()
		{
			// 防止重复调用
			if (isSyncing)
			{
				return;
			}
			isSyncing = true;
			
			try
			{
				// 先从外部存储恢复内存变量（优先使用内存变量，如果没有则从存储恢复）
				if (window[storageKey])
				{
					if (window[storageKey].currentColor)
					{
						var storedColor = window[storageKey].currentColor;
						if (!currentColor || currentColor !== storedColor)
						{
							currentColor = storedColor;
						}
					}
					if (window[storageKey].colorToReplaceHex)
					{
						var storedHex = window[storageKey].colorToReplaceHex;
						if (!colorToReplaceHex || colorToReplaceHex !== storedHex)
						{
							colorToReplaceHex = storedHex;
						}
					}
				}
				
				// 直接更新UI，不调用setCurrentColor避免循环
				if (currentColor)
				{
					if (currentColorPreview && currentColorPreview.style)
					{
						currentColorPreview.style.backgroundColor = currentColor;
					}
					if (currentColorValue)
					{
						currentColorValue.textContent = currentColor;
					}
				}
				
				// 强制更新新颜色显示（从外部存储或内存）
				var newColorValue = null;
				if (colorInput && colorInput.value)
				{
					newColorValue = colorInput.value.trim();
				}
				else if (window[storageKey] && window[storageKey].newColorInput)
				{
					newColorValue = window[storageKey].newColorInput;
					if (colorInput)
					{
						colorInput.value = newColorValue;
					}
				}
				
				var newColorPreviewValue = null;
				if (newColorPreview && newColorPreview.style && newColorPreview.style.backgroundColor)
				{
					newColorPreviewValue = newColorPreview.style.backgroundColor;
				}
				else if (window[storageKey] && window[storageKey].newColorPreview)
				{
					newColorPreviewValue = window[storageKey].newColorPreview;
					if (newColorPreview)
					{
						newColorPreview.style.backgroundColor = newColorPreviewValue;
					}
				}
				
				// 如果有新颜色值但没有预览值，尝试从输入框生成预览
				if (newColorValue && !newColorPreviewValue && newColorPreview)
				{
					var parsed = parseColor(newColorValue);
					if (parsed && parsed.hex)
					{
						newColorPreview.style.backgroundColor = parsed.hex;
					}
				}
			}
			finally
			{
				isSyncing = false;
			}
		};
		
		// 恢复UI显示的函数（使用强制同步）
		var restoreColorDisplay = function()
		{
			forceSyncUI();
		};
		
		var currentColorRow = document.createElement('div');
		currentColorRow.style.display = 'flex';
		currentColorRow.style.alignItems = 'center';
		currentColorRow.style.gap = '8px';
		currentColorRow.style.marginBottom = '8px';
		
		var currentColorLabel = document.createElement('label');
		currentColorLabel.style.fontSize = '11px';
		currentColorLabel.style.flex = '0 0 70px';
		mxUtils.write(currentColorLabel, '选择颜色:');
		currentColorRow.appendChild(currentColorLabel);
		
		// 当前颜色预览块
		var currentColorPreview = document.createElement('div');
		currentColorPreview.style.width = '40px';
		currentColorPreview.style.height = '40px';
		currentColorPreview.style.backgroundColor = '#FFFFFF';
		currentColorPreview.style.border = '2px solid #ccc';
		currentColorPreview.style.borderRadius = '4px';
		currentColorPreview.style.flexShrink = '0';
		currentColorRow.appendChild(currentColorPreview);
		
		// 当前颜色值显示
		var currentColorValue = document.createElement('div');
		currentColorValue.style.fontSize = '11px';
		currentColorValue.style.color = 'var(--geTextColor, #666)';
		currentColorValue.style.fontFamily = 'monospace';
		currentColorValue.style.flex = '1';
		currentColorValue.textContent = '未选择';
		currentColorRow.appendChild(currentColorValue);
		
		// 注意：currentColor和colorToReplaceHex在应用后必须保持不变
		// 只有通过吸管工具选择新颜色时才会更新
		
		// 吸管工具按钮
		var dropperButton = document.createElement('button');
		dropperButton.style.padding = '4px 8px';
		dropperButton.style.fontSize = '11px';
		dropperButton.style.cursor = 'pointer';
		if (Editor.colorDropperImage)
		{
			var dropperIcon = document.createElement('img');
			dropperIcon.src = Editor.colorDropperImage;
			dropperIcon.style.width = '14px';
			dropperIcon.style.height = '14px';
			dropperIcon.style.verticalAlign = 'middle';
			dropperButton.appendChild(dropperIcon);
		}
		else
		{
			mxUtils.write(dropperButton, '吸管');
		}
		
		dropperButton.addEventListener('click', function()
		{
			// 获取当前SVG内容（优先使用已应用的SVG，这样可以从更新后的颜色中采样）
			// 重要：如果有已应用的SVG，应该使用它，因为替换后的颜色已经应用到了SVG中
			// 如果当前有预览，先清除预览（恢复到已应用或原始状态），因为我们要从已应用的SVG中采样
			if (previewSvgString)
			{
				var baseSvgString = appliedSvgString || originalSvgString;
				updateSvgCell(cell, previewSvgString, baseSvgString, '', '');
				previewSvgString = null;
			}
			
			// 优先使用已应用的SVG（替换后的颜色），这样可以从新的颜色中采样
			// 重要：应用颜色替换后，原来的颜色已经被新颜色替换了，所以应该从新颜色中采样
			var currentSvgString = appliedSvgString || originalSvgString;
			
			if (window.console)
			{
				console.log('[SVG Smart Color] 吸管工具启动，使用SVG:', 
					appliedSvgString ? '已应用的SVG（包含替换后的颜色）' : '原始SVG');
				console.log('[SVG Smart Color] appliedSvgString存在:', appliedSvgString ? '是' : '否');
				console.log('[SVG Smart Color] 这样可以从替换后的颜色中继续采样');
			}
			
			// 如果已有应用的SVG，需要确保cell显示的是已应用的SVG，这样用户看到的和采样的是一致的
			// startColorDropper会使用传入的svgStringOverride来渲染canvas，但cell的显示也需要同步
			if (appliedSvgString)
			{
				// 确保cell显示的是已应用的SVG
				var state = graph.view.getState(cell);
				var style = (state != null) ? state.style : graph.getCellStyle(cell);
				var value = graph.getModel().getValue(cell);
				var currentImage = (style != null) ? mxUtils.getValue(style, mxConstants.STYLE_IMAGE, null) : null;
				
				// 检查当前cell显示的SVG是否已经是已应用的SVG
				var needsUpdate = false;
				var encodedSvg = 'data:image/svg+xml,' + encodeURIComponent(appliedSvgString);
				
				// 如果当前显示的SVG与已应用的SVG不同，需要更新
				if (currentImage && currentImage.toLowerCase().indexOf('data:image/svg') === 0)
				{
					// 简单比较：如果长度差异较大，说明可能需要更新
					// 或者检查当前image是否包含新颜色的特征
					// 为了简单，我们总是确保cell显示已应用的SVG
					needsUpdate = true;
				}
				
				if (needsUpdate)
				{
					graph.getModel().beginUpdate();
					try
					{
						if (style && currentImage && currentImage.toLowerCase().indexOf('data:image/svg') === 0)
						{
							graph.setCellStyles(mxConstants.STYLE_IMAGE, encodedSvg, [cell]);
						}
						else if (mxUtils.isNode(value) && value.nodeName === 'SvgImage')
						{
							var svgImageNode = value.cloneNode(true);
							svgImageNode.setAttribute('svgText', appliedSvgString);
							svgImageNode.setAttribute('svgDataUri', encodedSvg);
							graph.getModel().setValue(cell, svgImageNode);
							graph.setCellStyles(mxConstants.STYLE_IMAGE, encodedSvg, [cell]);
						}
						else if (mxUtils.isNode(value) && value.nodeName === 'svg')
						{
							var svgDoc = mxUtils.parseXml(appliedSvgString);
							if (svgDoc && svgDoc.documentElement)
							{
								var importedSvg = graph.getModel().getModel().importNode(svgDoc.documentElement, true);
								graph.getModel().setValue(cell, importedSvg);
								graph.setCellStyles(mxConstants.STYLE_IMAGE, encodedSvg, [cell]);
							}
						}
						graph.refresh(cell);
						graph.view.invalidate(cell);
						if (graph.view.validate)
						{
							graph.view.validate();
						}
					}
					finally
					{
						graph.getModel().endUpdate();
					}
				}
			}
			
			// 创建一个包装函数，确保使用当前SVG字符串
			var wrappedOnColorSelected = function(selectedColor)
			{
				// 使用深度绑定设置currentColor
				setCurrentColor(selectedColor);
				
				// 解析选择的颜色
				var colorToReplace = parseColor(selectedColor);
				if (colorToReplace && colorToReplace.hex)
				{
					setColorToReplaceHex(colorToReplace.hex);
					// 不清除colorInput，让用户可以选择不同的新颜色
				}
				
				editorUi.editor.setStatus('已选择颜色: ' + selectedColor + ' (从' + (appliedSvgString ? '替换后的SVG' : '原始SVG') + '中采样)');
				
				if (window.console)
				{
					console.log('[SVG Smart Color] 吸管工具采样完成，选择的颜色:', selectedColor);
					console.log('[SVG Smart Color] 来源:', appliedSvgString ? '替换后的SVG' : '原始SVG');
					console.log('[SVG Smart Color] 现在可以继续替换这个颜色:', selectedColor);
				}
			};
			
			// 传递当前SVG字符串给startColorDropper，确保使用更新后的颜色
			// 如果有已应用的SVG，使用它（这样可以从替换后的新颜色中采样）
			// 否则使用原始SVG
			startColorDropper(cell, wrappedOnColorSelected, currentSvgString);
		});
		
		currentColorRow.appendChild(dropperButton);
		panel.appendChild(currentColorRow);
		
		// 新颜色选择器
		var newColorRow = document.createElement('div');
		newColorRow.style.display = 'flex';
		newColorRow.style.alignItems = 'center';
		newColorRow.style.gap = '8px';
		newColorRow.style.marginBottom = '8px';
		
		var newColorLabel = document.createElement('label');
		newColorLabel.style.fontSize = '11px';
		newColorLabel.style.flex = '0 0 70px';
		mxUtils.write(newColorLabel, '新颜色:');
		newColorRow.appendChild(newColorLabel);
		
		// 新颜色预览块
		var newColorPreview = document.createElement('div');
		newColorPreview.style.width = '40px';
		newColorPreview.style.height = '40px';
		newColorPreview.style.backgroundColor = '#FFFFFF';
		newColorPreview.style.border = '2px solid #ccc';
		newColorPreview.style.borderRadius = '4px';
		newColorPreview.style.flexShrink = '0';
		newColorRow.appendChild(newColorPreview);
		
		// 颜色输入框（直接在样式面板中，不弹出对话框）
		var colorInput = document.createElement('input');
		colorInput.type = 'text';
		colorInput.value = '';
		colorInput.style.flex = '1';
		colorInput.style.padding = '4px';
		colorInput.style.fontSize = '11px';
		colorInput.style.fontFamily = 'monospace';
		colorInput.style.border = '1px solid #ccc';
		colorInput.style.borderRadius = '3px';
		
		// 同步颜色输入和预览
		colorInput.addEventListener('input', function()
		{
				var colorValue = colorInput.value.trim();
				if (colorValue.match(/^#[0-9A-Fa-f]{6}$/))
				{
					// 保存当前值
					var savedValue = colorValue;
					newColorPreview.style.backgroundColor = colorValue;
					
					// 保存到外部存储
					saveColorValues();
					
					// 立即预览（注意：不会更新currentColor，只有应用按钮才更新）
					applyPreview();
				}
			});
		
		colorInput.addEventListener('blur', function()
		{
			var colorValue = colorInput.value.trim();
			if (!colorValue.match(/^#[0-9A-Fa-f]{6}$/))
			{
				// 尝试解析颜色
				var parsed = parseColor(colorValue);
				if (parsed)
				{
					colorInput.value = parsed.hex.toUpperCase();
					newColorPreview.style.backgroundColor = parsed.hex;
					// 立即预览
					applyPreview();
				}
				else
				{
					colorInput.value = '';
					newColorPreview.style.backgroundColor = '#FFFFFF';
					// 如果之前有预览，恢复到基础状态
					if (previewSvgString)
					{
						var baseSvgString = appliedSvgString || originalSvgString;
						updateSvgCell(cell, previewSvgString, baseSvgString, '', '');
						previewSvgString = null;
					}
				}
			}
		});
		
		newColorRow.appendChild(colorInput);
		
		// 颜色网格选择器（常用颜色快速选择）
		var colorGrid = document.createElement('div');
		colorGrid.style.display = 'grid';
		colorGrid.style.gridTemplateColumns = 'repeat(8, 1fr)';
		colorGrid.style.gap = '4px';
		colorGrid.style.marginBottom = '8px';
		
		// 常用颜色
		var commonColors = [
			'#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
			'#FF0000', '#FF6600', '#FFCC00', '#66FF00', '#00FF00', '#00FFCC', '#0066FF', '#6600FF',
			'#FF0066', '#FF3366', '#FF6699', '#FF99CC', '#FFCCFF',
			'#1E78B7', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B',
			'#E377C2', '#7F7F7F', '#BCBD22', '#17BECF'
		];
		
		for (var i = 0; i < commonColors.length; i++)
		{
			var colorBox = document.createElement('div');
			colorBox.style.width = '24px';
			colorBox.style.height = '24px';
			colorBox.style.backgroundColor = commonColors[i];
			colorBox.style.border = '1px solid #ccc';
			colorBox.style.borderRadius = '2px';
			colorBox.style.cursor = 'pointer';
			colorBox.style.transition = 'transform 0.1s ease';
			
			colorBox.addEventListener('mouseenter', function(color)
			{
				return function()
				{
					colorBox.style.transform = 'scale(1.2)';
					colorBox.style.zIndex = '10';
					colorBox.style.position = 'relative';
				};
			}(commonColors[i]));
			
			colorBox.addEventListener('mouseleave', function()
			{
				colorBox.style.transform = 'scale(1)';
				colorBox.style.zIndex = '1';
			});
			
			colorBox.addEventListener('click', function(color)
			{
				return function()
				{
					// 设置新颜色输入框和预览
					var colorHex = color.toUpperCase();
					colorInput.value = colorHex;
					newColorPreview.style.backgroundColor = color;
					
					if (window.console)
					{
						console.log('[SVG Smart Color] 点击颜色网格，设置颜色:', colorHex);
						console.log('[SVG Smart Color] 当前状态:', {
							currentColor: currentColor,
							colorToReplaceHex: colorToReplaceHex,
							appliedSvgString存在: !!appliedSvgString
						});
					}
					
					// 确保颜色值不会被清除 - 在预览前后都保存
					var savedInputValue = colorHex;
					var savedPreviewColor = color;
					
					// 保存到外部存储
					saveColorValues();
					
					// 立即预览
					applyPreview();
					
					// 延迟一下，确保applyPreview已经设置好previewSvgString
					setTimeout(function()
					{
						// 重要：如果有已选择的颜色（currentColor和colorToReplaceHex存在），自动应用并更新currentColor
						// 这样用户点击颜色后就能立即看到效果并继续操作
						if (window.console)
						{
							console.log('[SVG Smart Color] 检查自动应用条件:', {
								previewSvgString存在: !!previewSvgString,
								currentColor: currentColor,
								colorToReplaceHex: colorToReplaceHex,
								colorHex: colorHex
							});
						}
						
						if (previewSvgString && currentColor && colorToReplaceHex)
						{
							// 解析新颜色
							var newColorObj = parseColor(colorHex);
							if (newColorObj && newColorObj.hex.toLowerCase() !== colorToReplaceHex.toLowerCase())
							{
								var isFirstApply = !appliedSvgString;
								
								if (window.console)
								{
									if (isFirstApply)
									{
										console.log('[SVG Smart Color] ===== 自动应用：第一次更新颜色 =====');
										console.log('[SVG Smart Color] 第一次：从原始SVG的颜色', colorToReplaceHex, '更新到', newColorObj.hex);
									}
									else
									{
										console.log('[SVG Smart Color] ===== 自动应用：第二次（或后续）更新颜色 =====');
										console.log('[SVG Smart Color] 后续更新：从已应用的颜色', colorToReplaceHex, '更新到', newColorObj.hex);
									}
									console.log('[SVG Smart Color] 更新currentColor和colorToReplaceHex为新颜色');
								}
								
								// 保存预览状态为已应用状态
								appliedSvgString = previewSvgString;
								appliedOldColor = colorToReplaceHex;
								appliedNewColor = newColorObj.hex;
								
								// 更新currentColor和colorToReplaceHex为新颜色
								setCurrentColor(newColorObj.hex);
								setColorToReplaceHex(newColorObj.hex);
								
								// 清除预览状态（因为已自动应用）
								previewSvgString = null;
								
								// 强制确保UI元素引用仍然有效并更新
								var panel = document.getElementById('svg-local-recolor-panel');
								if (panel)
								{
									var preview = panel.querySelector('[data-color-preview="current"]');
									var value = panel.querySelector('[data-color-value="current"]');
									if (preview)
									{
										currentColorPreview = preview;
										currentColorPreview.style.backgroundColor = currentColor;
									}
									if (value)
									{
										currentColorValue = value;
										currentColorValue.textContent = currentColor;
									}
								}
								
								editorUi.editor.setStatus('颜色已自动应用，可以继续使用吸管工具选择新颜色');
								
								if (window.console)
								{
									console.log('[SVG Smart Color] 自动应用完成，currentColor已更新为:', currentColor);
									console.log('[SVG Smart Color] colorToReplaceHex已更新为:', colorToReplaceHex);
									console.log('[SVG Smart Color] 此时两个颜色相同:', currentColor === colorToReplaceHex);
									if (isFirstApply)
									{
										console.log('[SVG Smart Color] ===== 第一次自动应用完成，SVG已更新，可以继续替换新颜色 =====');
									}
									else
									{
										console.log('[SVG Smart Color] ===== 第二次自动应用完成，SVG已第二次更新 =====');
									}
								}
							}
						}
						else if (window.console)
						{
							console.log('[SVG Smart Color] 自动应用条件不满足，跳过自动应用');
						}
					}, 50);
				};
			}(commonColors[i]));
			
			colorGrid.appendChild(colorBox);
		}
		
		panel.appendChild(newColorRow);
		panel.appendChild(colorGrid);
		
		// 跟踪当前应用的SVG字符串（如果已应用）- 这是已保存的状态
		var appliedSvgString = null;
		var appliedOldColor = null;
		var appliedNewColor = null;
		
		// 跟踪预览状态的SVG字符串（临时预览，未保存）
		var previewSvgString = null;
		
		// 预览函数：立即应用颜色替换但不保存
		var applyPreview = function()
		{
			// 重要：在预览之前检查并记录当前颜色状态
			if (!currentColor || !colorToReplaceHex)
			{
				if (window.console)
				{
					console.log('[SVG Smart Color] applyPreview: currentColor或colorToReplaceHex为空，无法预览');
					console.log('[SVG Smart Color] currentColor:', currentColor);
					console.log('[SVG Smart Color] colorToReplaceHex:', colorToReplaceHex);
				}
				return;
			}
			
			// 重要：在预览过程中，确保currentColor和colorToReplaceHex不被改变
			// 保存当前值作为备份，防止被意外修改
			var savedCurrentColor = currentColor;
			var savedColorToReplaceHex = colorToReplaceHex;
			
			// 保存新颜色输入框和预览块的值，防止被清除
			var savedNewColorInput = colorInput ? colorInput.value.trim() : '';
			var savedNewColorPreview = newColorPreview ? newColorPreview.style.backgroundColor : '';
			
			var newColor = savedNewColorInput;
			var newColorObj = parseColor(newColor);
			
			if (!newColorObj)
			{
				// 如果解析失败，恢复原值
				if (colorInput)
				{
					colorInput.value = savedNewColorInput;
				}
				if (newColorPreview)
				{
					newColorPreview.style.backgroundColor = savedNewColorPreview;
				}
				return;
			}
			
			if (newColorObj.hex.toLowerCase() === colorToReplaceHex.toLowerCase())
			{
				return;
			}
			
			// 使用已保存的SVG（如果已应用）或原始SVG作为基础
			var baseSvgString = appliedSvgString || originalSvgString;
			
			// 替换SVG中所有匹配的颜色
			var newSvgString = replaceColorInSvg(baseSvgString, savedColorToReplaceHex, newColorObj.hex);
			
			// 更新预览
			updateSvgCell(cell, baseSvgString, newSvgString, savedColorToReplaceHex, newColorObj.hex);
			previewSvgString = newSvgString;
			
			// 确保currentColor和colorToReplaceHex保持不变（防止被意外修改）
			currentColor = savedCurrentColor;
			colorToReplaceHex = savedColorToReplaceHex;
			
			// 保存颜色值到外部存储
			saveColorValues();
			
			// 重要：确保新颜色输入框和预览块的值被保留
			// 立即恢复（如果UI元素存在）
			if (colorInput && savedNewColorInput)
			{
				colorInput.value = savedNewColorInput;
			}
			if (newColorPreview && savedNewColorPreview)
			{
				newColorPreview.style.backgroundColor = savedNewColorPreview;
			}
			
			// 注意：applyPreview只预览，不更新currentColor
			// currentColor只有在应用按钮点击时才更新
		};
		
		// 按钮容器
		var buttonContainer = document.createElement('div');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '8px';
		buttonContainer.style.marginTop = '8px';
		
		// 应用按钮（保存当前预览）
		var applyButton = document.createElement('button');
		applyButton.style.flex = '1';
		applyButton.style.padding = '6px';
		applyButton.style.fontSize = '11px';
		applyButton.style.fontWeight = '600';
		applyButton.style.backgroundColor = 'var(--gePrimaryColor, #1ba1e2)';
		applyButton.style.color = '#fff';
		applyButton.style.border = 'none';
		applyButton.style.borderRadius = '3px';
		applyButton.style.cursor = 'pointer';
		mxUtils.write(applyButton, '应用');
		applyButton.addEventListener('click', function()
		{
			if (window.console)
			{
				console.log('[SVG Smart Color] ===== 应用按钮被点击 =====');
				console.log('[SVG Smart Color] 当前状态:', {
					currentColor: currentColor,
					colorToReplaceHex: colorToReplaceHex,
					previewSvgString存在: !!previewSvgString,
					appliedSvgString存在: !!appliedSvgString,
					colorInput值: colorInput ? colorInput.value.trim() : 'N/A'
				});
			}
			
			if (!currentColor || !colorToReplaceHex)
			{
				editorUi.handleError({message: '请先使用吸管工具选择要替换的颜色'});
				if (window.console)
				{
					console.error('[SVG Smart Color] 应用失败: currentColor或colorToReplaceHex为空');
				}
				return;
			}
			
			var newColor = colorInput.value.trim();
			var newColorObj = parseColor(newColor);
			
			if (!newColorObj)
			{
				editorUi.handleError({message: '无效的颜色值: ' + newColor});
				if (window.console)
				{
					console.error('[SVG Smart Color] 应用失败: 无效的颜色值', newColor);
				}
				return;
			}
			
			if (newColorObj.hex.toLowerCase() === colorToReplaceHex.toLowerCase())
			{
				editorUi.editor.setStatus('颜色未改变');
				if (window.console)
				{
					console.log('[SVG Smart Color] 应用失败: 颜色未改变', newColorObj.hex, '===', colorToReplaceHex);
				}
				return;
			}
			
			// 判断是否是第一次应用（没有appliedSvgString表示第一次）
			var isFirstApply = !appliedSvgString;
			
			// 如果当前有预览，保存预览状态
			if (previewSvgString)
			{
				appliedSvgString = previewSvgString;
				appliedOldColor = colorToReplaceHex;
				appliedNewColor = newColorObj.hex;
				
				if (window.console)
				{
					if (isFirstApply)
					{
						console.log('[SVG Smart Color] ===== 应用按钮：第一次更新颜色 =====');
						console.log('[SVG Smart Color] 第一次：从原始SVG的颜色', colorToReplaceHex, '更新到', newColorObj.hex);
					}
					else
					{
						console.log('[SVG Smart Color] ===== 应用按钮：第二次（或后续）更新颜色 =====');
						console.log('[SVG Smart Color] 后续更新：从已应用的颜色', colorToReplaceHex, '更新到', newColorObj.hex);
					}
					console.log('[SVG Smart Color] 更新currentColor和colorToReplaceHex为新颜色');
				}
				
				// 重要：更新currentColor和colorToReplaceHex为新颜色，这样吸管工具可以继续从新颜色采样
				// 使用深度绑定函数确保UI和变量完全同步
				setCurrentColor(newColorObj.hex);
				setColorToReplaceHex(newColorObj.hex);
				
				// 清除预览状态（因为已保存）
				previewSvgString = null;
				
				// 强制确保UI元素引用仍然有效并更新（防止格式面板刷新导致引用丢失）
				var panel = document.getElementById('svg-local-recolor-panel');
				if (panel)
				{
					// 重新查找UI元素并更新引用
					var preview = panel.querySelector('[data-color-preview="current"]');
					var value = panel.querySelector('[data-color-value="current"]');
					if (preview)
					{
						currentColorPreview = preview;
						currentColorPreview.style.backgroundColor = currentColor;
					}
					if (value)
					{
						currentColorValue = value;
						currentColorValue.textContent = currentColor;
					}
					
					if (window.console)
					{
						console.log('[SVG Smart Color] UI元素引用已更新:', {
							preview存在: !!currentColorPreview,
							value存在: !!currentColorValue,
							preview颜色: currentColorPreview ? currentColorPreview.style.backgroundColor : 'N/A',
							value文本: currentColorValue ? currentColorValue.textContent : 'N/A'
						});
					}
				}
				
				editorUi.editor.setStatus('颜色已保存，可以继续使用吸管工具选择新颜色');
				
				// 延迟验证，确保UI已经更新
				setTimeout(function()
				{
					// 再次验证UI元素引用并强制更新
					var panel = document.getElementById('svg-local-recolor-panel');
					if (panel)
					{
						var preview = panel.querySelector('[data-color-preview="current"]');
						var value = panel.querySelector('[data-color-value="current"]');
						if (preview)
						{
							currentColorPreview = preview;
							currentColorPreview.style.backgroundColor = currentColor;
						}
						if (value)
						{
							currentColorValue = value;
							currentColorValue.textContent = currentColor;
						}
					}
					
					if (window.console)
					{
						console.log('[SVG Smart Color] 应用完成，最终验证:');
						console.log('[SVG Smart Color] currentColor变量:', currentColor);
						console.log('[SVG Smart Color] colorToReplaceHex变量:', colorToReplaceHex);
						console.log('[SVG Smart Color] preview显示颜色:', currentColorPreview ? currentColorPreview.style.backgroundColor : 'N/A');
						console.log('[SVG Smart Color] value显示文本:', currentColorValue ? currentColorValue.textContent : 'N/A');
						console.log('[SVG Smart Color] 此时两个颜色相同:', currentColor === colorToReplaceHex);
						if (isFirstApply)
						{
							console.log('[SVG Smart Color] ===== 第一次更新完成，SVG已更新，可以继续替换新颜色 =====');
						}
						else
						{
							console.log('[SVG Smart Color] ===== 第二次更新完成，SVG已第二次更新 =====');
						}
					}
				}, 100);
			}
			else
			{
				// 如果没有预览，直接应用
				applyPreview();
				if (previewSvgString)
				{
					appliedSvgString = previewSvgString;
					appliedOldColor = colorToReplaceHex;
					appliedNewColor = newColorObj.hex;
					
					if (window.console)
					{
						if (isFirstApply)
						{
							console.log('[SVG Smart Color] ===== 应用按钮：第一次更新颜色（无预览直接应用） =====');
						}
						else
						{
							console.log('[SVG Smart Color] ===== 应用按钮：第二次（或后续）更新颜色（无预览直接应用） =====');
						}
						console.log('[SVG Smart Color] 旧颜色:', colorToReplaceHex);
						console.log('[SVG Smart Color] 新颜色:', newColorObj.hex);
					}
					
					// 重要：更新currentColor和colorToReplaceHex为新颜色
					// 使用深度绑定函数确保UI和变量完全同步
					setCurrentColor(newColorObj.hex);
					setColorToReplaceHex(newColorObj.hex);
					
					previewSvgString = null;
					
					// 强制确保UI元素引用仍然有效并更新（防止格式面板刷新导致引用丢失）
					var panel = document.getElementById('svg-local-recolor-panel');
					if (panel)
					{
						// 重新查找UI元素并更新引用
						var preview = panel.querySelector('[data-color-preview="current"]');
						var value = panel.querySelector('[data-color-value="current"]');
						if (preview)
						{
							currentColorPreview = preview;
							currentColorPreview.style.backgroundColor = currentColor;
						}
						if (value)
						{
							currentColorValue = value;
							currentColorValue.textContent = currentColor;
						}
					}
					
					editorUi.editor.setStatus('颜色已保存，可以继续使用吸管工具选择新颜色');
					
					if (window.console)
					{
						console.log('[SVG Smart Color] 应用完成，currentColor已更新为:', currentColor);
						console.log('[SVG Smart Color] colorToReplaceHex已更新为:', colorToReplaceHex);
						if (isFirstApply)
						{
							console.log('[SVG Smart Color] ===== 第一次更新完成 =====');
						}
						else
						{
							console.log('[SVG Smart Color] ===== 第二次更新完成 =====');
						}
					}
				}
			}
		});
		
		// 取消按钮（撤销预览或已保存的修改）
		var cancelButton = document.createElement('button');
		cancelButton.style.flex = '1';
		cancelButton.style.padding = '6px';
		cancelButton.style.fontSize = '11px';
		cancelButton.style.fontWeight = '600';
		cancelButton.style.backgroundColor = '#f5f5f5';
		cancelButton.style.color = '#333';
		cancelButton.style.border = '1px solid #ccc';
		cancelButton.style.borderRadius = '3px';
		cancelButton.style.cursor = 'pointer';
		mxUtils.write(cancelButton, '取消');
		cancelButton.addEventListener('click', function()
		{
			// 如果有预览，先撤销预览
			if (previewSvgString)
			{
				var baseSvgString = appliedSvgString || originalSvgString;
				updateSvgCell(cell, previewSvgString, baseSvgString, '', '');
				previewSvgString = null;
				editorUi.editor.setStatus('预览已取消');
			}
			// 如果已保存过修改，恢复到原始状态
			else if (appliedSvgString)
			{
				updateSvgCell(cell, appliedSvgString, originalSvgString, '', '');
				appliedSvgString = null;
				appliedOldColor = null;
				appliedNewColor = null;
				editorUi.editor.setStatus('已恢复到原始状态');
			}
			// 如果没有预览和已保存的修改，关闭面板
			else
			{
				var panelToRemove = document.getElementById('svg-local-recolor-panel');
				if (panelToRemove && panelToRemove.parentNode)
				{
					panelToRemove.parentNode.removeChild(panelToRemove);
				}
				// 移除选择监听
				graph.getSelectionModel().removeListener(selectionHandler);
			}
		});
		
		buttonContainer.appendChild(applyButton);
		buttonContainer.appendChild(cancelButton);
		panel.appendChild(buttonContainer);
		
		// 添加到格式面板
		format.container.appendChild(panel);
		
		// 恢复UI显示（如果颜色值已存在）
		restoreColorDisplay();
		
		// 监听格式面板的刷新，在刷新后恢复UI显示
		var originalRefresh = format.refresh;
		if (originalRefresh)
		{
			format.refresh = function()
			{
				originalRefresh.apply(this, arguments);
				// 延迟恢复UI，等待面板重新创建
				setTimeout(function()
				{
					// 从外部存储恢复内存变量
					if (window[storageKey])
					{
						if (window[storageKey].currentColor)
						{
							currentColor = window[storageKey].currentColor;
						}
						if (window[storageKey].colorToReplaceHex)
						{
							colorToReplaceHex = window[storageKey].colorToReplaceHex;
						}
					}
					
					// 尝试找到重新创建的UI元素并更新引用
					var panel = document.getElementById('svg-local-recolor-panel');
					if (panel)
					{
						var preview = panel.querySelector('[data-color-preview="current"]');
						var value = panel.querySelector('[data-color-value="current"]');
						if (preview) currentColorPreview = preview;
						if (value) currentColorValue = value;
						
						var input = panel.querySelector('input[data-color-input="new"]') || 
						           panel.querySelector('input[type="text"]');
						if (input) colorInput = input;
						
						var newPreview = panel.querySelector('div[data-color-preview="new"]');
						if (!newPreview)
						{
							var previews = panel.querySelectorAll('div[style*="width: 40px"][style*="height: 40px"]');
							for (var j = 0; j < previews.length; j++)
							{
								if (previews[j] !== currentColorPreview)
								{
									newColorPreview = previews[j];
									break;
								}
							}
						}
						else
						{
							newColorPreview = newPreview;
						}
					}
					
					// 强制同步UI
					forceSyncUI();
				}, 100);
			};
		}
		
		// 给UI元素添加标识，方便刷新后查找
		currentColorPreview.setAttribute('data-color-preview', 'current');
		currentColorValue.setAttribute('data-color-value', 'current');
		if (colorInput)
		{
			colorInput.setAttribute('data-color-input', 'new');
		}
		if (newColorPreview)
		{
			newColorPreview.setAttribute('data-color-preview', 'new');
		}
		
		// 确保格式面板可见
		if (!editorUi.isFormatPanelVisible())
		{
			editorUi.toggleFormatPanel(true);
		}
		
		// 监听选择变化，当选择改变时移除面板
		var selectionHandler = function()
		{
			var currentCell = graph.getSelectionCell();
			if (currentCell !== cell)
			{
				var panelToRemove = document.getElementById('svg-local-recolor-panel');
				if (panelToRemove && panelToRemove.parentNode)
				{
					panelToRemove.parentNode.removeChild(panelToRemove);
				}
				graph.getSelectionModel().removeListener(selectionHandler);
				// 如果选择改变时有预览，先撤销预览
				if (previewSvgString)
				{
					var baseSvgString = appliedSvgString || originalSvgString;
					updateSvgCell(cell, previewSvgString, baseSvgString, '', '');
				}
				// 如果选择改变时已保存了修改，恢复到原始状态
				else if (appliedSvgString)
				{
					updateSvgCell(cell, appliedSvgString, originalSvgString, '', '');
				}
			}
		};
		
		graph.getSelectionModel().addListener(mxEvent.CHANGE, selectionHandler);
	}
	
	// 在样式面板初始化时自动添加局部改色工具
	if (window.StyleFormatPanel)
	{
		var originalStyleInit = StyleFormatPanel.prototype.init;
		
		StyleFormatPanel.prototype.init = function()
		{
			originalStyleInit.apply(this, arguments);
			
			var ui = this.editorUi;
			var ss = ui.getSelectionState();
			
			// 检查是否是SVG元素
			if (ss.cells.length === 1 && ss.vertices.length === 1)
			{
				var cell = ss.cells[0];
				if (isSvgCell(cell))
				{
					var svgString = getSvgContent(cell);
					if (svgString)
					{
						// 延迟添加，确保其他面板已经添加完成
						setTimeout(function()
						{
							showLocalRecolorInFormatPanel(cell, svgString);
						}, 50);
					}
				}
			}
		};
	}
	
	/**
	 * 更新cell的SVG内容
	 */
	function updateSvgCell(cell, currentSvgString, newSvgString, oldColorHex, newColorHex)
	{
		if (!cell || !newSvgString)
		{
			return;
		}
		
		// 调试信息3: 显示更新后的SVG数据
		if (window.console)
		{
			console.log('[SVG Smart Color] 3. 更新后的SVG数据:');
			console.log('[SVG Smart Color] SVG长度:', newSvgString.length);
			console.log('[SVG Smart Color] SVG预览:', newSvgString.substring(0, Math.min(200, newSvgString.length)));
			console.log('[SVG Smart Color] 颜色替换:', oldColorHex, '->', newColorHex);
		}
		
		graph.getModel().beginUpdate();
		try
		{
			var state = graph.view.getState(cell);
			var style = (state != null) ? state.style : graph.getCellStyle(cell);
			var image = (style != null) ? mxUtils.getValue(style, mxConstants.STYLE_IMAGE, null) : null;
			var value = graph.getModel().getValue(cell);
			
			// 将SVG转换为data URI
			var encodedSvg = 'data:image/svg+xml,' + encodeURIComponent(newSvgString);
			
			// 调试信息4: 显示更新方式
			if (window.console)
			{
				console.log('[SVG Smart Color] 4. 更新SVG:');
				console.log('[SVG Smart Color] 原始image样式:', image ? (image.substring(0, 50) + '...') : 'null');
				console.log('[SVG Smart Color] value节点类型:', mxUtils.isNode(value) ? value.nodeName : typeof value);
			}
			
			// 根据原始存储方式更新
			// 检查是否有SvgImage节点，如果有则需要同时更新节点属性
			var hasSvgImageNode = mxUtils.isNode(value) && 
				value.nodeName && value.nodeName.toLowerCase() === 'svgimage';
			
			if (image && image.toLowerCase().indexOf('data:image/svg') === 0)
			{
				// 更新image样式
				if (window.console)
				{
					console.log('[SVG Smart Color] 使用方式: 更新image样式' + (hasSvgImageNode ? ' (同时更新SvgImage节点)' : ''));
				}
				graph.setCellStyles(mxConstants.STYLE_IMAGE, encodedSvg, [cell]);
				
				// 如果value是SvgImage节点，也需要更新节点属性
				if (hasSvgImageNode && value.setAttribute)
				{
					if (window.console)
					{
						console.log('[SVG Smart Color] 同时更新SvgImage节点属性');
					}
					// SvgImage节点需要存储SVG字符串（未编码）
					// 对于恢复操作，应该使用newSvgString（这是要恢复到的目标SVG）
					var svgTextToStore = newSvgString;
					
					var svgImageNode = value.cloneNode(true);
					svgImageNode.setAttribute('svgText', svgTextToStore);
					svgImageNode.setAttribute('svgDataUri', encodedSvg);
					graph.getModel().setValue(cell, svgImageNode);
				}
			}
			else if (mxUtils.isNode(value))
			{
				// 更新value节点
				var nodeName = value.nodeName ? value.nodeName.toLowerCase() : '';
				if (nodeName === 'svg')
				{
					// 直接更新SVG节点
					if (window.console)
					{
						console.log('[SVG Smart Color] 使用方式: 更新svg节点');
					}
					var newDoc = mxUtils.parseXml(newSvgString);
					graph.getModel().setValue(cell, newDoc.documentElement);
					
					// 也更新image样式以确保显示
					graph.setCellStyles(mxConstants.STYLE_IMAGE, encodedSvg, [cell]);
				}
				else if (nodeName === 'svgimage')
				{
					// 更新svgimage节点的属性
					if (window.console)
					{
						console.log('[SVG Smart Color] 使用方式: 更新svgimage节点');
					}
					if (value.setAttribute)
					{
						value.setAttribute('svgText', encodeURIComponent(newSvgString));
						value.setAttribute('svgDataUri', encodedSvg);
					}
					graph.getModel().setValue(cell, value);
					
					// 同时更新image样式以确保显示
					graph.setCellStyles(mxConstants.STYLE_IMAGE, encodedSvg, [cell]);
				}
				else
				{
					// 未知节点类型，使用image样式
					if (window.console)
					{
						console.log('[SVG Smart Color] 使用方式: 默认更新image样式 (未知节点类型:', nodeName, ')');
					}
					graph.setCellStyles(mxConstants.STYLE_IMAGE, encodedSvg, [cell]);
				}
			}
			else
			{
				// 默认情况：更新image样式
				if (window.console)
				{
					console.log('[SVG Smart Color] 使用方式: 默认更新image样式');
				}
				graph.setCellStyles(mxConstants.STYLE_IMAGE, encodedSvg, [cell]);
			}
			
			// 刷新cell - 使用多种方式确保视图更新
			graph.refresh(cell);
			graph.view.invalidate(cell);
			
			// 强制重新验证视图以确保显示更新
			if (graph.view.validate)
			{
				graph.view.validate();
			}
			
			// 标记为已修改
			editorUi.editor.setModified(true);
			if (oldColorHex && newColorHex)
			{
				editorUi.editor.setStatus('局部改色完成: ' + oldColorHex + ' -> ' + newColorHex);
			}
			
			if (window.console)
			{
				console.log('[SVG Smart Color] ===== 更新完成 =====');
			}
		}
		finally
		{
			graph.getModel().endUpdate();
			
			// 再次刷新以确保视图更新（在endUpdate之后）
			setTimeout(function()
			{
				graph.refresh(cell);
				if (graph.view.invalidate)
				{
					graph.view.invalidate(cell);
				}
			}, 10);
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
		
		// 显示加载提示
		editorUi.editor.setStatus('正在分析SVG颜色...');
		
		// 分析颜色（使用异步Canvas方法）
		analyzeSvgColorsAsync(svgString).then(function(colors)
		{
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
		
		// 显示颜色球（按面积排序，球的大小代表面积）
		var colorsList = document.createElement('div');
		colorsList.style.display = 'flex';
		colorsList.style.flexWrap = 'wrap';
		colorsList.style.gap = '15px';
		colorsList.style.justifyContent = 'flex-start';
		colorsList.style.alignItems = 'flex-end';
		colorsList.style.padding = '10px';
		colorsList.style.maxHeight = '300px';
		colorsList.style.overflowY = 'auto';
		colorsList.style.backgroundColor = '#fff';
		colorsList.style.borderRadius = '4px';
		
		var displayCount = Math.min(colors.length, 20); // 显示前20种颜色
		
		// 计算面积范围（用于归一化球的大小）
		// 球的面积应该与颜色的面积成正比，所以球的半径应该与颜色面积的平方根成正比
		var maxArea = colors.length > 0 ? colors[0].area : 1;
		var minArea = colors.length > 0 ? colors[colors.length - 1].area : 0;
		
		// 如果最小面积和最大面积相同或接近，使用绝对面积来计算
		// 避免除零并确保即使面积相近也能显示差异
		var totalArea = 0;
		for (var j = 0; j < displayCount; j++)
		{
			totalArea += colors[j].area;
		}
		
		// 球的大小范围（半径，像素）
		var minBallRadius = 10; // 最小球半径（对应最小面积）
		var maxBallRadius = 40; // 最大球半径（对应最大面积）
		var radiusRange = maxBallRadius - minBallRadius;
		
		// 创建基线（对齐基准线）
		var baseline = document.createElement('div');
		baseline.style.width = '100%';
		baseline.style.height = '1px';
		baseline.style.backgroundColor = 'transparent';
		baseline.style.marginBottom = (maxBallRadius * 2) + 'px';
		baseline.style.position = 'relative';
		
		for (var i = 0; i < displayCount; i++)
		{
			var colorItem = colors[i];
			
			// 计算球的大小（基于面积）
			// 球的面积应该与颜色的面积成正比，所以球的半径与颜色面积的平方根成正比
			var ballRadius;
			if (maxArea > minArea)
			{
				// 归一化面积（0到1之间）
				var normalizedArea = (colorItem.area - minArea) / (maxArea - minArea);
				// 球的半径与面积平方根成正比：r ∝ √area
				// 所以 normalizedRadius = √normalizedArea
				var normalizedRadius = Math.sqrt(normalizedArea);
				ballRadius = minBallRadius + normalizedRadius * radiusRange;
			}
			else
			{
				// 所有面积相同，使用相对面积（基于总面积的占比）
				if (totalArea > 0)
				{
					var areaRatio = colorItem.area / totalArea;
					var normalizedRadius = Math.sqrt(areaRatio * displayCount);
					ballRadius = minBallRadius + normalizedRadius * radiusRange;
				}
				else
				{
					ballRadius = minBallRadius;
				}
			}
			
			// 确保半径在有效范围内
			ballRadius = Math.max(minBallRadius, Math.min(maxBallRadius, ballRadius));
			var ballSize = ballRadius * 2; // 球的直径
			
			// 创建球容器（相对于基线的定位）
			var ballContainer = document.createElement('div');
			ballContainer.style.position = 'relative';
			ballContainer.style.display = 'inline-block';
			ballContainer.style.verticalAlign = 'bottom';
			ballContainer.style.marginRight = '10px';
			ballContainer.style.cursor = 'pointer';
			// 不设置title，避免hover时显示任何SVG内容或工具提示
			
			// 创建颜色球（圆形）
			var colorBall = document.createElement('div');
			colorBall.style.width = ballSize + 'px';
			colorBall.style.height = ballSize + 'px';
			colorBall.style.backgroundColor = colorItem.color.hex;
			colorBall.style.borderRadius = '50%';
			colorBall.style.border = '2px solid #fff';
			colorBall.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.3)';
			colorBall.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
			colorBall.style.position = 'relative';
			colorBall.style.verticalAlign = 'bottom';
			// 防止显示任何工具提示或SVG内容
			colorBall.title = '';
			colorBall.setAttribute('data-color', colorItem.color.hex);
			
			// 悬停效果
			ballContainer.addEventListener('mouseenter', function(ball) {
				return function() {
					ball.style.transform = 'scale(1.15)';
					ball.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25), inset 0 1px 2px rgba(255,255,255,0.4)';
				};
			}(colorBall));
			
			ballContainer.addEventListener('mouseleave', function(ball) {
				return function() {
					ball.style.transform = 'scale(1)';
					ball.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.3)';
				};
			}(colorBall));
			
			// 添加颜色信息标签（可选，显示在球下方）
			var colorLabel = document.createElement('div');
			colorLabel.style.fontSize = '10px';
			colorLabel.style.textAlign = 'center';
			colorLabel.style.marginTop = '5px';
			colorLabel.style.color = '#666';
			colorLabel.style.width = ballSize + 'px';
			colorLabel.style.wordBreak = 'break-all';
			colorLabel.style.maxWidth = '80px';
			mxUtils.write(colorLabel, colorItem.color.hex);
			
			ballContainer.appendChild(colorBall);
			ballContainer.appendChild(colorLabel);
			
			// 将球添加到基线容器
			baseline.appendChild(ballContainer);
		}
		
		colorsList.appendChild(baseline);
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
		}).catch(function(error)
		{
			if (window.console)
			{
				console.error('[SVG Smart Color] 分析颜色失败:', error);
			}
			editorUi.handleError({message: '分析SVG颜色失败: ' + (error.message || '未知错误')});
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
						// 局部改色已移到样式面板，不再需要右键菜单
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


