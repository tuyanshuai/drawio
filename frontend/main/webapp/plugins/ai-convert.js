/**
 * AI Image Conversion Plugin - Segment Anything Model Integration
 * Converts images to vector shapes using Segment Anything Model
 */
Draw.loadPlugin(function(editorUi)
{
	if (editorUi.editor.isChromelessView())
	{
		return;
	}
	
	var graph = editorUi.editor.graph;
	var sidebar = editorUi.sidebar;
	
	if (!sidebar)
	{
		return;
	}
	
	// Configuration - can be overridden
	var config = {
		// Segment Anything API endpoint - can be configured
		segmentApiUrl: urlParams['segmentApiUrl'] || 'http://localhost:8081/api/segment',
		// API key if needed
		apiKey: urlParams['segmentApiKey'] || null,
		// Segment parameters
		threshold: urlParams['segmentThreshold'] || 0.5,
		minArea: urlParams['segmentMinArea'] || 100
	};
	
	/**
	 * Reads file as data URL
	 */
	function readFileAsDataURL(file, callback)
	{
		if (Graph.fileSupport && FileReader)
		{
			var reader = new FileReader();
			
			reader.onload = function(e)
			{
				callback(e.target.result);
			};
			
			reader.onerror = function()
			{
				callback(null);
			};
			
			reader.readAsDataURL(file);
		}
		else
		{
			callback(null);
		}
	}
	
	/**
	 * Converts image to base64 data URL
	 */
	function imageToDataURL(image, callback)
	{
		var canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		
		var ctx = canvas.getContext('2d');
		ctx.drawImage(image, 0, 0);
		
		try
		{
			var dataURL = canvas.toDataURL('image/png');
			callback(dataURL);
		}
		catch (e)
		{
			callback(null);
		}
	}
	
	/**
	 * Calls Segment Anything API to segment the image
	 */
	function segmentImage(imageData, callback)
	{
		// Update spinner message (spinner is already started by processImage)
		editorUi.spinner.spin(document.body, mxResources.get('loading') || '正在分割图片...');
		
		// Prepare form data
		var formData = new FormData();
		
		// Convert data URL to blob if needed
		var blob;
		if (imageData.substring(0, 5) == 'data:')
		{
			// Extract base64 data
			var base64Data = imageData.split(',')[1];
			var mimeType = imageData.match(/data:([^;]+);/)[1];
			var byteCharacters = atob(base64Data);
			var byteArrays = [];
			
			for (var i = 0; i < byteCharacters.length; i++)
			{
				byteArrays.push(byteCharacters.charCodeAt(i));
			}
			
			blob = new Blob([new Uint8Array(byteArrays)], {type: mimeType});
		}
		else
		{
			editorUi.spinner.stop();
			callback(null, 'Invalid image data format');
			return;
		}
		
		// Use 'file' field name as expected by the API
		formData.append('file', blob, 'image.png');
		
		// Add API key if configured
		if (config.apiKey)
		{
			formData.append('api_key', config.apiKey);
		}
		
		// Build URL with query parameters
		var apiUrl = config.segmentApiUrl;
		var separator = apiUrl.indexOf('?') !== -1 ? '&' : '?';
		
		// Add query parameters (with fallback for older browsers)
		if (typeof URLSearchParams !== 'undefined')
		{
			var queryParams = new URLSearchParams();
			queryParams.append('threshold', config.threshold.toString());
			queryParams.append('min_area', config.minArea.toString());
			apiUrl += separator + queryParams.toString();
		}
		else
		{
			// Fallback for older browsers
			apiUrl += separator + 'threshold=' + encodeURIComponent(config.threshold) + 
			          '&min_area=' + encodeURIComponent(config.minArea);
		}
		
		// Log request details
		if (window.console)
		{
			console.log('[AI Convert] 发送 API 请求:', apiUrl);
			console.log('[AI Convert] 请求参数:', {
				threshold: config.threshold,
				min_area: config.minArea,
				imageSize: blob.size + ' bytes'
			});
		}
		
		// Make API request
		var xhr = new XMLHttpRequest();
		xhr.open('POST', apiUrl, true);
		
		xhr.onload = function()
		{
			editorUi.spinner.stop();
			
			if (xhr.status === 200)
			{
				try
				{
					var response = JSON.parse(xhr.responseText);
					
					// Log API response to console
					if (window.console)
					{
						console.log('[AI Convert] API 响应:', response);
						console.log('[AI Convert] 原始响应文本:', xhr.responseText);
					}
					
					callback(response, null);
				}
				catch (e)
				{
					if (window.console)
					{
						console.error('[AI Convert] 解析响应失败:', e);
						console.error('[AI Convert] 原始响应文本:', xhr.responseText);
					}
					callback(null, 'Failed to parse API response: ' + e.message);
				}
			}
			else
			{
				if (window.console)
				{
					console.error('[AI Convert] API 请求失败:', xhr.status);
					console.error('[AI Convert] 响应文本:', xhr.responseText);
				}
				callback(null, 'API request failed with status: ' + xhr.status);
			}
		};
		
		xhr.onerror = function()
		{
			editorUi.spinner.stop();
			var errorMsg = 'Network error occurred';
			
			// Check if it's a connection refused error
			if (config.segmentApiUrl.indexOf('localhost:8081') !== -1 || 
			    config.segmentApiUrl.indexOf('127.0.0.1:8081') !== -1)
			{
				errorMsg = '无法连接到 Segment API 服务 (http://localhost:8081/api/segment)。\n\n' +
				           '请确保：\n' +
				           '1. Segment API 服务正在运行\n' +
				           '2. 服务监听在端口 8081\n' +
				           '3. 或者通过 URL 参数设置正确的 API 地址：?segmentApiUrl=http://your-server:port/api/segment';
			}
			
			if (window.console)
			{
				console.error('[AI Convert] 网络错误:', errorMsg);
			}
			
			callback(null, errorMsg);
		};
		
		xhr.onabort = function()
		{
			editorUi.spinner.stop();
			callback(null, 'Request aborted');
		};
		
		xhr.send(formData);
	}
	
	/**
	 * Extracts contours from segmentation masks
	 * Uses marching squares algorithm or contour tracing
	 */
	function extractContours(segmentationData, width, height)
	{
		var contours = [];
		
		// Handle different response formats
		var masks = segmentationData.masks || segmentationData.segments || [];
		
		if (masks.length === 0 && segmentationData.mask)
		{
			// Single mask format
			masks = [segmentationData.mask];
		}
		
		if (window.console)
		{
			console.log('[AI Convert] 开始提取轮廓，掩码数量:', masks.length);
		}
		
		for (var i = 0; i < masks.length; i++)
		{
			var mask = masks[i];
			var contour = extractContourFromMask(mask, width, height);
			
			if (contour && contour.length > 0)
			{
				// Validate contour points
				var isValid = true;
				for (var j = 0; j < contour.length; j++)
				{
					if (!contour[j] || typeof contour[j].x !== 'number' || typeof contour[j].y !== 'number' ||
					    isNaN(contour[j].x) || isNaN(contour[j].y))
					{
						isValid = false;
						if (window.console)
						{
							console.error('[AI Convert] 轮廓 ' + i + ' 包含无效点:', contour[j]);
						}
						break;
					}
				}
				
				if (isValid)
				{
					// 保存填充颜色信息（优先使用 hex，然后是 rgb，最后是计算的亮度）
					if (mask.fill)
					{
						// 优先使用 hex 颜色
						if (mask.fill.hex)
						{
							contour.fillColor = mask.fill.hex;
						}
						// 其次使用 rgb 数组转换为 hex
						else if (mask.fill.rgb && Array.isArray(mask.fill.rgb))
						{
							var r = Math.round(mask.fill.rgb[0] || 128);
							var g = Math.round(mask.fill.rgb[1] || 128);
							var b = Math.round(mask.fill.rgb[2] || 128);
							contour.fillColor = rgbToHex(r, g, b);
						}
						// 使用 color 字符串（格式如 "rgb(255, 0, 0)"）
						else if (mask.fill.color)
						{
							contour.fillColor = parseColorString(mask.fill.color);
						}
					}
					
					// 如果没有颜色信息，计算平均亮度用于灰度填充
					if (!contour.fillColor)
					{
						var avgBrightness = 0.5; // default
						if (mask.fill && mask.fill.rgb && Array.isArray(mask.fill.rgb))
						{
							// Calculate brightness from RGB: (R*0.299 + G*0.587 + B*0.114) / 255
							var r = mask.fill.rgb[0] || 128;
							var g = mask.fill.rgb[1] || 128;
							var b = mask.fill.rgb[2] || 128;
							avgBrightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
						}
						else
						{
							avgBrightness = calculateAverageBrightness(mask, width, height);
						}
						contour.avgBrightness = avgBrightness;
						contour.fillColor = brightnessToColor(avgBrightness);
					}
					
					contours.push(contour);
					
					if (window.console && i < 3)
					{
						console.log('[AI Convert] 轮廓 ' + i + ' 提取成功:', {
							点数: contour.length,
							第一个点: contour[0],
							最后一个点: contour[contour.length - 1],
							填充颜色: contour.fillColor || '未设置',
							maskFill: mask.fill ? {
								hex: mask.fill.hex,
								rgb: mask.fill.rgb,
								color: mask.fill.color
							} : '无'
						});
					}
				}
			}
		}
		
		return contours;
	}
	
	/**
	 * Extracts contour points from a binary mask
	 */
	function extractContourFromMask(mask, width, height)
	{
		var contour = [];
		
		// Handle different mask formats
		if (mask.points && Array.isArray(mask.points))
		{
			// Convert points to {x, y} format if needed
			for (var i = 0; i < mask.points.length; i++)
			{
				var point = mask.points[i];
				if (Array.isArray(point) && point.length >= 2)
				{
					// Format: [x, y]
					contour.push({x: point[0], y: point[1]});
				}
				else if (point && typeof point.x === 'number' && typeof point.y === 'number')
				{
					// Format: {x, y}
					contour.push({x: point.x, y: point.y});
				}
			}
		}
		else if (mask.path && typeof mask.path === 'string')
		{
			// SVG path format - parse it
			contour = parseSVGPath(mask.path);
		}
		else if (mask.rle || mask.data)
		{
			// RLE or array format - convert to contour
			contour = maskToContour(mask, width, height);
		}
		
		// Smooth the contour (only if we have valid points)
		if (contour.length > 0)
		{
			contour = smoothContour(contour);
		}
		
		return contour;
	}
	
	/**
	 * Converts mask data to contour points
	 */
	function maskToContour(mask, width, height)
	{
		// Simple contour extraction using edge detection
		// This is a simplified version - can be enhanced with proper contour tracing
		var contour = [];
		var data = mask.data || mask.rle || [];
		
		// If we have polygon points directly, use them
		if (mask.polygon && Array.isArray(mask.polygon))
		{
			return mask.polygon;
		}
		
		// Otherwise, try to extract from mask data
		// This is a placeholder - actual implementation would depend on mask format
		if (data.length > 0)
		{
			// Use marching squares or similar algorithm
			// For now, return empty array - will be implemented based on actual API response format
			return [];
		}
		
		return contour;
	}
	
	/**
	 * Smooths contour using Douglas-Peucker algorithm or B-spline
	 */
	function smoothContour(contour, epsilon)
	{
		if (!contour || contour.length < 3)
		{
			return contour;
		}
		
		// Validate contour points format
		for (var k = 0; k < contour.length; k++)
		{
			if (!contour[k] || typeof contour[k].x !== 'number' || typeof contour[k].y !== 'number')
			{
				if (window.console)
				{
					console.error('[AI Convert] 无效的轮廓点格式:', contour[k]);
				}
				return contour; // Return original if invalid
			}
		}
		
		epsilon = epsilon || 2.0;
		
		// Simplified smoothing - can be enhanced
		// For now, apply basic smoothing
		var smoothed = [];
		
		for (var i = 0; i < contour.length; i++)
		{
			var prev = contour[(i - 1 + contour.length) % contour.length];
			var curr = contour[i];
			var next = contour[(i + 1) % contour.length];
			
			// Validate points before smoothing
			if (typeof prev.x === 'number' && typeof prev.y === 'number' &&
			    typeof curr.x === 'number' && typeof curr.y === 'number' &&
			    typeof next.x === 'number' && typeof next.y === 'number')
			{
				// Simple moving average
				var smoothedPoint = {
					x: (prev.x + curr.x + next.x) / 3,
					y: (prev.y + curr.y + next.y) / 3
				};
				
				smoothed.push(smoothedPoint);
			}
			else
			{
				// If invalid, use original point
				smoothed.push(curr);
			}
		}
		
		return smoothed;
	}
	
	/**
	 * Parses SVG path string to point array
	 */
	function parseSVGPath(pathString)
	{
		var points = [];
		var commands = pathString.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
		
		if (!commands)
		{
			return points;
		}
		
		var x = 0, y = 0;
		
		for (var i = 0; i < commands.length; i++)
		{
			var cmd = commands[i].charAt(0);
			var coords = commands[i].substring(1).trim().split(/[\s,]+/).map(parseFloat);
			
			if (cmd === 'M' || cmd === 'm' || cmd === 'L' || cmd === 'l')
			{
				// Move or line to
				var isRelative = (cmd === 'm' || cmd === 'l');
				
				for (var j = 0; j < coords.length; j += 2)
				{
					if (j + 1 < coords.length)
					{
						if (isRelative)
						{
							x += coords[j];
							y += coords[j + 1];
						}
						else
						{
							x = coords[j];
							y = coords[j + 1];
						}
						
						points.push({x: x, y: y});
					}
				}
			}
		}
		
		return points;
	}
	
	/**
	 * Calculates average brightness of a region
	 */
	function calculateAverageBrightness(mask, width, height)
	{
		// Placeholder - actual implementation depends on mask format
		// Returns brightness value between 0 (black) and 1 (white)
		return 0.5;
	}
	
	/**
	 * Converts contour points to SVG path string
	 */
	function contourToSVGPath(contour, closed)
	{
		if (!contour || contour.length === 0)
		{
			return '';
		}
		
		var path = 'M ' + contour[0].x + ' ' + contour[0].y;
		
		for (var i = 1; i < contour.length; i++)
		{
			path += ' L ' + contour[i].x + ' ' + contour[i].y;
		}
		
		if (closed)
		{
			path += ' Z';
		}
		
		return path;
	}
	
	/**
	 * Maps brightness to color
	 */
	function brightnessToColor(brightness)
	{
		// Map brightness (0-1) to grayscale color
		var gray = Math.round(brightness * 255);
		var hex = gray.toString(16);
		if (hex.length === 1) hex = '0' + hex;
		return '#' + hex + hex + hex;
	}
	
	/**
	 * Converts RGB values to hex color string
	 */
	function rgbToHex(r, g, b)
	{
		var toHex = function(n)
		{
			n = Math.max(0, Math.min(255, Math.round(n)));
			var hex = n.toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};
		return '#' + toHex(r) + toHex(g) + toHex(b);
	}
	
	/**
	 * Parses color string (e.g., "rgb(255, 0, 0)" or "rgba(255, 0, 0, 0.5)") to hex
	 */
	function parseColorString(colorStr)
	{
		if (!colorStr) return null;
		
		// 如果已经是 hex 格式
		if (colorStr.match(/^#[0-9A-Fa-f]{6}$/))
		{
			return colorStr;
		}
		
		// 解析 rgb/rgba 格式
		var rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (rgbMatch)
		{
			var r = parseInt(rgbMatch[1], 10);
			var g = parseInt(rgbMatch[2], 10);
			var b = parseInt(rgbMatch[3], 10);
			return rgbToHex(r, g, b);
		}
		
		return null;
	}
	
	/**
	 * Converts contour points to mxPoint array relative to bounding box
	 */
	function contourToPoints(contour, bbox, scale)
	{
		if (!contour || contour.length === 0)
		{
			return [];
		}
		
		var points = [];
		for (var i = 0; i < contour.length; i++)
		{
			var scaledX = contour[i].x * scale - bbox.x;
			var scaledY = contour[i].y * scale - bbox.y;
			points.push(new mxPoint(scaledX, scaledY));
		}
		
		return points;
	}
	
	// 注意：AI 转换功能现在使用 polygon-draw.js 插件中的 manualPolygon 形状
	// 这样可以保持代码一致性，两个功能共享同一个形状实现
	
	
	/**
	 * Draws contours on the canvas using polygon shapes
	 */
	function drawContoursOnCanvas(contours, imageWidth, imageHeight)
	{
		if (!contours || contours.length === 0)
		{
			return;
		}
		
		graph.getModel().beginUpdate();
		try
		{
			var parent = graph.getDefaultParent();
			
			// Scale factor to fit in reasonable size (use actual image dimensions from API)
			var scale = Math.min(400 / imageWidth, 400 / imageHeight);
			
			if (window.console)
			{
				console.log('[AI Convert] 图片尺寸:', imageWidth + 'x' + imageHeight, '缩放比例:', scale);
			}
			
			// 计算所有轮廓的总 bounding box（使用原始坐标，不缩放）
			var allMinX = Infinity, allMinY = Infinity;
			var allMaxX = -Infinity, allMaxY = -Infinity;
			
			for (var i = 0; i < contours.length; i++)
			{
				var contour = contours[i];
				if (contour && contour.length > 0)
				{
					// First get bounding box without scale
					var bboxUnscaled = getPathBoundingBox(contour, 1);
					
					if (bboxUnscaled.width > 0 && bboxUnscaled.height > 0)
					{
						allMinX = Math.min(allMinX, bboxUnscaled.x);
						allMinY = Math.min(allMinY, bboxUnscaled.y);
						allMaxX = Math.max(allMaxX, bboxUnscaled.x + bboxUnscaled.width);
						allMaxY = Math.max(allMaxY, bboxUnscaled.y + bboxUnscaled.height);
					}
				}
			}
			
			// 如果无法计算 bounding box，使用默认值
			if (allMinX === Infinity || allMinY === Infinity || allMaxX === -Infinity || allMaxY === -Infinity)
			{
				allMinX = 0;
				allMinY = 0;
				allMaxX = imageWidth;
				allMaxY = imageHeight;
			}
			
			var totalWidth = (allMaxX - allMinX) * scale;
			var totalHeight = (allMaxY - allMinY) * scale;
			
			// 获取画布视图区域，将图形绘制在中心区域
			var view = graph.view;
			var tr = view.translate;
			var s = view.scale;
			var containerBounds = graph.container ? graph.container.getBoundingClientRect() : {width: 800, height: 600};
			var centerX = (containerBounds.width / 2 / s) - tr.x;
			var centerY = (containerBounds.height / 2 / s) - tr.y;
			
			// 起始位置：画布中心减去总宽度/高度的一半
			var startX = centerX - totalWidth / 2;
			var startY = centerY - totalHeight / 2;
			
			if (window.console)
			{
				console.log('[AI Convert] 开始绘制多边形，轮廓数量:', contours.length);
				console.log('[AI Convert] 绘制区域:', {
					中心: centerX + ',' + centerY,
					起始位置: startX + ',' + startY,
					总尺寸: totalWidth + 'x' + totalHeight
				});
			}
			
			for (var i = 0; i < contours.length; i++)
			{
				var contour = contours[i];
				
				if (!contour || contour.length === 0)
				{
					continue;
				}
				
				// Calculate bounding box (unscaled first to get relative position)
				var bboxUnscaled = getPathBoundingBox(contour, 1);
				var bbox = getPathBoundingBox(contour, scale);
				
				// Validate bounding box
				if (isNaN(bbox.x) || isNaN(bbox.y) || isNaN(bbox.width) || isNaN(bbox.height) ||
				    bbox.width <= 0 || bbox.height <= 0)
				{
					if (window.console)
					{
						console.error('[AI Convert] 多边形 ' + i + ' 的边界框无效:', bbox);
					}
					continue;
				}
				
				// Calculate position relative to start position
				var posX = startX + (bboxUnscaled.x - allMinX) * scale;
				var posY = startY + (bboxUnscaled.y - allMinY) * scale;
				var width = Math.max(bbox.width, 10);
				var height = Math.max(bbox.height, 10);
				
				// Convert contour points to relative coordinates (0-1) for polygon
				var relativePoints = [];
				for (var j = 0; j < contour.length; j++)
				{
					var point = contour[j];
					
					// Ensure point is in {x, y} format
					var px, py;
					if (Array.isArray(point))
					{
						px = point[0];
						py = point[1];
					}
					else if (point && typeof point.x === 'number' && typeof point.y === 'number')
					{
						px = point.x;
						py = point.y;
					}
					else
					{
						if (window.console)
						{
							console.error('[AI Convert] 无效的点格式:', point);
						}
						continue;
					}
					
					// Convert to relative coordinates (0-1) within the bounding box
					var relX = (px * scale - bbox.x) / width;
					var relY = (py * scale - bbox.y) / height;
					
					// Validate relative coordinates
					if (!isNaN(relX) && !isNaN(relY) && isFinite(relX) && isFinite(relY))
					{
						relativePoints.push([relX, relY]);
					}
				}
				
				if (relativePoints.length === 0)
				{
					continue;
				}
				
				// 使用保存的填充颜色，如果没有则使用默认颜色
				var fillColor = contour.fillColor || brightnessToColor(contour.avgBrightness || 0.5);
				var strokeColor = '#000000';
				
				// Create style for filled polygon using manualPolygon shape from polygon-draw plugin
				var polyCoordsJson = JSON.stringify(relativePoints);
				var style = 'shape=manualPolygon;' +
					'polyCoords=' + polyCoordsJson + ';' +
					'fillColor=' + fillColor + 
					';strokeColor=' + strokeColor + 
					';strokeWidth=0.5;' +
					'whiteSpace=wrap;';
				
				// Create vertex with custom polygon shape
				var vertex = graph.insertVertex(parent, null, '', posX, posY, width, height, style);
				
				if (window.console && i < 3)
				{
					console.log('[AI Convert] 多边形 ' + i + ':', {
						点数: relativePoints.length,
						位置: posX + ',' + posY,
						尺寸: width + 'x' + height,
						颜色: fillColor,
						polyCoords: polyCoordsJson.substring(0, 80) + '...'
					});
				}
			}
			
			// 刷新并缩放到适合所有图形
			graph.refresh();
			
			// 尝试缩放到显示所有图形
			if (contours.length > 0)
			{
				setTimeout(function()
				{
					graph.fit(20);
				}, 100);
			}
			
			if (window.console)
			{
				console.log('[AI Convert] 多边形绘制完成！共绘制 ' + contours.length + ' 个多边形');
			}
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[AI Convert] 绘制多边形时出错:', e);
				console.error('[AI Convert] 错误堆栈:', e.stack);
			}
		}
		finally
		{
			graph.getModel().endUpdate();
		}
	}
	
	/**
	 * Scales SVG path
	 */
	function scalePath(pathString, scale)
	{
		// Simple scaling - replace all coordinates
		return pathString.replace(/([\d.]+)/g, function(match)
		{
			return parseFloat(match) * scale;
		});
	}
	
	/**
	 * Creates a custom path shape
	 */
	function PathShape()
	{
		mxActor.call(this);
	};
	
	mxUtils.extend(PathShape, mxActor);
	
	PathShape.prototype.pathData = '';
	
	PathShape.prototype.redrawPath = function(path, x, y, w, h)
	{
		// Get path data from style
		var pathData = mxUtils.getValue(this.style, 'pathData', '');
		
		if (pathData)
		{
			// Decode if needed
			try
			{
				pathData = decodeURIComponent(pathData);
			}
			catch (e)
			{
				// Use as-is if decoding fails
			}
		}
		
		if (pathData)
		{
			// Parse SVG path and draw it
			var pathCommands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
			
			if (pathCommands)
			{
				var currentX = 0, currentY = 0;
				var startX = 0, startY = 0;
				
				for (var i = 0; i < pathCommands.length; i++)
				{
					var cmd = pathCommands[i].charAt(0);
					var coords = pathCommands[i].substring(1).trim().split(/[\s,]+/).map(parseFloat);
					
					if (cmd === 'M' || cmd === 'm')
					{
						// Move to
						if (coords.length >= 2)
						{
							if (cmd === 'M')
							{
								currentX = coords[0];
								currentY = coords[1];
							}
							else
							{
								currentX += coords[0];
								currentY += coords[1];
							}
							startX = currentX;
							startY = currentY;
							path.moveTo(currentX, currentY);
						}
					}
					else if (cmd === 'L' || cmd === 'l')
					{
						// Line to
						for (var j = 0; j < coords.length; j += 2)
						{
							if (j + 1 < coords.length)
							{
								if (cmd === 'L')
								{
									currentX = coords[j];
									currentY = coords[j + 1];
								}
								else
								{
									currentX += coords[j];
									currentY += coords[j + 1];
								}
								path.lineTo(currentX, currentY);
							}
						}
					}
					else if (cmd === 'Z' || cmd === 'z')
					{
						// Close path
						path.close();
					}
				}
			}
		}
		
		path.end();
	};
	
	// Register the shape
	mxCellRenderer.registerShape('aiPath', PathShape);
	
	/**
	 * Creates a path shape style
	 */
	function createPathShape(pathString, fillColor, strokeColor)
	{
		// Store path data in a global map or use a different approach
		// For now, encode path in style using a special format
		var encodedPath = encodeURIComponent(pathString);
		
		// Use custom shape with path data stored in style
		return 'shape=aiPath;pathData=' + encodedPath + ';fillColor=' + fillColor + ';strokeColor=' + strokeColor + ';strokeWidth=0.5;';
	}
	
	/**
	 * Calculates bounding box of path
	 */
	function getPathBoundingBox(contour, scale)
	{
		if (!contour || contour.length === 0)
		{
			return {x: 0, y: 0, width: 0, height: 0};
		}
		
		var minX = Infinity, minY = Infinity;
		var maxX = -Infinity, maxY = -Infinity;
		
		scale = scale || 1;
		
		for (var i = 0; i < contour.length; i++)
		{
			var point = contour[i];
			
			// Validate point format
			if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' ||
			    isNaN(point.x) || isNaN(point.y))
			{
				if (window.console)
				{
					console.error('[AI Convert] getPathBoundingBox: 无效的点:', point, '索引:', i);
				}
				continue;
			}
			
			var scaledX = point.x * scale;
			var scaledY = point.y * scale;
			
			minX = Math.min(minX, scaledX);
			minY = Math.min(minY, scaledY);
			maxX = Math.max(maxX, scaledX);
			maxY = Math.max(maxY, scaledY);
		}
		
		// Validate results
		if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity)
		{
			if (window.console)
			{
				console.error('[AI Convert] getPathBoundingBox: 无法计算边界框');
			}
			return {x: 0, y: 0, width: 100, height: 100};
		}
		
		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	}
	
	/**
	 * Shows image preview dialog before processing
	 */
	function showImagePreviewDialog(imageData, callback, reselectCallback)
	{
		var div = document.createElement('div');
		div.style.padding = '10px';
		div.style.textAlign = 'center';
		
		// Title
		var title = document.createElement('div');
		title.style.fontSize = '16px';
		title.style.fontWeight = 'bold';
		title.style.marginBottom = '15px';
		title.textContent = '图片预览';
		div.appendChild(title);
		
		// Image preview container
		var imgContainer = document.createElement('div');
		imgContainer.style.marginBottom = '15px';
		imgContainer.style.maxHeight = '400px';
		imgContainer.style.maxWidth = '600px';
		imgContainer.style.overflow = 'auto';
		imgContainer.style.border = '1px solid #ccc';
		imgContainer.style.borderRadius = '4px';
		imgContainer.style.padding = '10px';
		imgContainer.style.backgroundColor = '#f5f5f5';
		imgContainer.style.display = 'inline-block';
		
		// Image element
		var img = document.createElement('img');
		img.src = imageData;
		img.style.maxWidth = '100%';
		img.style.maxHeight = '400px';
		img.style.display = 'block';
		img.style.margin = '0 auto';
		
		img.onload = function()
		{
			// Show image dimensions
			var info = document.createElement('div');
			info.style.fontSize = '12px';
			info.style.color = '#666';
			info.style.marginTop = '10px';
			info.textContent = '尺寸: ' + img.naturalWidth + ' × ' + img.naturalHeight + ' 像素';
			imgContainer.appendChild(info);
		};
		
		imgContainer.appendChild(img);
		div.appendChild(imgContainer);
		
		// Buttons container
		var btns = document.createElement('div');
		btns.style.marginTop = '15px';
		btns.style.textAlign = 'center';
		
		// Reselect button
		var reselectBtn = mxUtils.button('重新选择', function()
		{
			editorUi.hideDialog();
			if (reselectCallback)
			{
				reselectCallback();
			}
		});
		reselectBtn.className = 'geBtn';
		reselectBtn.style.marginRight = '10px';
		
		// Cancel button
		var cancelBtn = mxUtils.button(mxResources.get('cancel') || '取消', function()
		{
			editorUi.hideDialog();
		});
		cancelBtn.className = 'geBtn';
		cancelBtn.style.marginRight = '10px';
		
		// Start processing button
		var startBtn = mxUtils.button('开始处理', function()
		{
			editorUi.hideDialog();
			if (callback)
			{
				callback();
			}
		});
		startBtn.className = 'geBtn gePrimaryBtn';
		
		btns.appendChild(reselectBtn);
		btns.appendChild(cancelBtn);
		btns.appendChild(startBtn);
		div.appendChild(btns);
		
		// Show dialog
		editorUi.showDialog(div, 640, 500, true, true);
	}
	
	/**
	 * Main processing function
	 */
	function processImage(imageData)
	{
		// Show initial feedback
		editorUi.spinner.spin(document.body, mxResources.get('loading') || '正在处理图片...');
		
		// Load image to get dimensions
		var img = new Image();
		img.onload = function()
		{
			var imageWidth = img.width;
			var imageHeight = img.height;
			
			// Segment image
			segmentImage(imageData, function(segmentationData, error)
			{
				if (error)
				{
					editorUi.spinner.stop();
					if (window.console)
					{
						console.error('[AI Convert] 分割失败:', error);
					}
					editorUi.handleError({message: '图片分割失败: ' + error});
					return;
				}
				
				if (!segmentationData)
				{
					editorUi.spinner.stop();
					if (window.console)
					{
						console.error('[AI Convert] 未收到分割数据');
					}
					editorUi.handleError({message: '未收到分割数据'});
					return;
				}
				
				// Log segmentation data
				if (window.console)
				{
					console.log('[AI Convert] 分割数据:', segmentationData);
					console.log('[AI Convert] 图片尺寸:', imageWidth + 'x' + imageHeight);
				}
				
				// Update status
				editorUi.spinner.spin(document.body, mxResources.get('loading') || '正在提取轮廓...');
				
				// Extract contours
				var contours = extractContours(segmentationData, imageWidth, imageHeight);
				
				if (!contours || contours.length === 0)
				{
					editorUi.spinner.stop();
					if (window.console)
					{
						console.error('[AI Convert] 未能提取轮廓');
					}
					editorUi.handleError({message: '未能从分割结果中提取轮廓'});
					return;
				}
				
				// Log contours data
				if (window.console)
				{
					console.log('[AI Convert] 提取的轮廓数量:', contours.length);
					console.log('[AI Convert] 轮廓数据:', contours);
					for (var i = 0; i < Math.min(contours.length, 3); i++)
					{
						console.log('[AI Convert] 轮廓 ' + i + ':', {
							points: contours[i].length,
							avgBrightness: contours[i].avgBrightness,
							preview: contours[i].slice(0, 5) + '...'
						});
					}
				}
				
				// Update status
				editorUi.spinner.spin(document.body, mxResources.get('loading') || '正在绘制图形...');
				
				// Draw contours on canvas
				drawContoursOnCanvas(contours, imageWidth, imageHeight);
				
				// Stop spinner after drawing
				editorUi.spinner.stop();
				
				// Log final result
				if (window.console)
				{
					console.log('[AI Convert] 处理完成！');
					console.log('[AI Convert] 处理摘要:', {
						图片尺寸: imageWidth + 'x' + imageHeight,
						分割区域数: (segmentationData.masks || segmentationData.segments || []).length,
						提取轮廓数: contours.length,
						已绘制图形: true
					});
				}
				
				// Show success message
				editorUi.editor.setStatus(mxResources.get('done') || '完成');
			});
		};
		
		img.onerror = function()
		{
			editorUi.spinner.stop();
			editorUi.handleError({message: '加载图片失败'});
		};
		
		img.src = imageData;
	}
	
	/**
	 * Adds AI conversion palette to sidebar
	 */
	function addAIConvertPalette()
	{
		// Remove existing palette if it exists
		if (sidebar.palettes['aiConvert'])
		{
			sidebar.removePalette('aiConvert');
		}
		
		if (window.console)
		{
			console.log('[AI Convert Plugin] Creating palette');
		}
		
		sidebar.addPalette('aiConvert', 'AI 图片转化', true, function(content)
		{
			var div = document.createElement('div');
			div.style.padding = '10px';
			div.style.textAlign = 'center';
			
			// File input
			var fileInput = document.createElement('input');
			fileInput.setAttribute('type', 'file');
			fileInput.setAttribute('accept', 'image/jpeg,image/jpg,image/png');
			fileInput.style.display = 'none';
			
			// Upload button
			var uploadBtn = mxUtils.button('选择图片', function()
			{
				fileInput.click();
			});
			
			uploadBtn.className = 'geBtn';
			uploadBtn.style.width = '100%';
			uploadBtn.style.marginBottom = '10px';
			
			// File input handler
			var handleFileSelect = function(evt)
			{
				if (fileInput.files && fileInput.files.length > 0)
				{
					var file = fileInput.files[0];
					
					// Check file type
					if (file.type.substring(0, 6) !== 'image/')
					{
						editorUi.handleError({message: '请选择图片文件（JPG或PNG）'});
						// Reset input
						fileInput.type = '';
						fileInput.type = 'file';
						fileInput.value = '';
						return;
					}
					
					// Read file
					readFileAsDataURL(file, function(dataURL)
					{
						if (dataURL)
						{
							// Show preview dialog first
							showImagePreviewDialog(dataURL, function()
							{
								// User clicked "开始处理", process the image
								processImage(dataURL);
							}, function()
							{
								// User clicked "重新选择", reopen file selector
								fileInput.click();
							});
						}
						else
						{
							editorUi.handleError({message: '读取文件失败'});
							// Reset input
							fileInput.type = '';
							fileInput.type = 'file';
							fileInput.value = '';
						}
					});
				}
			};
			
			mxEvent.addListener(fileInput, 'change', handleFileSelect);
			
			// Info text
			var infoText = document.createElement('div');
			infoText.style.fontSize = '11px';
			infoText.style.color = '#666';
			infoText.style.marginTop = '10px';
			infoText.textContent = '支持 JPG、PNG 格式图片';
			
			div.appendChild(fileInput);
			div.appendChild(uploadBtn);
			div.appendChild(infoText);
			
			content.appendChild(div);
		});
	}
	
	// Add palette immediately
	if (window.console)
	{
		console.log('[AI Convert Plugin] Adding palette to sidebar');
	}
	addAIConvertPalette();
	
	// Handles reload of sidebar after dark mode change or reinit
	var originalInit = sidebar.init;
	sidebar.init = function()
	{
		originalInit.apply(this, arguments);
		if (window.console)
		{
			console.log('[AI Convert Plugin] Sidebar reinit, adding palette again');
		}
		addAIConvertPalette();
	};
});

