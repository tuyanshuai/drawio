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
		segmentApiUrl: urlParams['segmentApiUrl'] || 'http://localhost:8000/api/segment',
		// API key if needed
		apiKey: urlParams['segmentApiKey'] || null
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
		editorUi.spinner.spin(document.body, mxResources.get('loading') + '...');
		
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
			callback(null, 'Invalid image data format');
			return;
		}
		
		formData.append('image', blob, 'image.png');
		
		// Add API key if configured
		if (config.apiKey)
		{
			formData.append('api_key', config.apiKey);
		}
		
		// Make API request
		var xhr = new XMLHttpRequest();
		xhr.open('POST', config.segmentApiUrl, true);
		
		xhr.onload = function()
		{
			editorUi.spinner.stop();
			
			if (xhr.status === 200)
			{
				try
				{
					var response = JSON.parse(xhr.responseText);
					callback(response, null);
				}
				catch (e)
				{
					callback(null, 'Failed to parse API response: ' + e.message);
				}
			}
			else
			{
				callback(null, 'API request failed with status: ' + xhr.status);
			}
		};
		
		xhr.onerror = function()
		{
			editorUi.spinner.stop();
			callback(null, 'Network error occurred');
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
		
		for (var i = 0; i < masks.length; i++)
		{
			var mask = masks[i];
			var contour = extractContourFromMask(mask, width, height);
			
			if (contour && contour.length > 0)
			{
				// Calculate average brightness
				var avgBrightness = calculateAverageBrightness(mask, width, height);
				contour.avgBrightness = avgBrightness;
				contours.push(contour);
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
			// Already in point format
			contour = mask.points;
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
		
		// Smooth the contour
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
		
		epsilon = epsilon || 2.0;
		
		// Simplified smoothing - can be enhanced
		// For now, apply basic smoothing
		var smoothed = [];
		
		for (var i = 0; i < contour.length; i++)
		{
			var prev = contour[(i - 1 + contour.length) % contour.length];
			var curr = contour[i];
			var next = contour[(i + 1) % contour.length];
			
			// Simple moving average
			var smoothedPoint = {
				x: (prev.x + curr.x + next.x) / 3,
				y: (prev.y + curr.y + next.y) / 3
			};
			
			smoothed.push(smoothedPoint);
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
	 * Draws contours on the canvas
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
			var bounds = graph.getGraphBounds();
			var x = bounds.x + bounds.width + 20;
			var y = bounds.y;
			
			// Scale factor to fit in reasonable size
			var scale = Math.min(400 / imageWidth, 400 / imageHeight);
			var scaledWidth = imageWidth * scale;
			var scaledHeight = imageHeight * scale;
			
			for (var i = 0; i < contours.length; i++)
			{
				var contour = contours[i];
				
				if (!contour || contour.length === 0)
				{
					continue;
				}
				
				// Convert contour points to SVG path
				var pathString = contourToSVGPath(contour, true);
				
				if (!pathString)
				{
					continue;
				}
				
				// Scale the path
				var scaledPath = scalePath(pathString, scale);
				
				// Calculate bounding box
				var bbox = getPathBoundingBox(contour, scale);
				
				// Create custom shape with path
				var fillColor = brightnessToColor(contour.avgBrightness || 0.5);
				var strokeColor = '#000000';
				
				// Create style with path data encoded
				var encodedPath = encodeURIComponent(scaledPath);
				var style = 'shape=aiPath;pathData=' + encodedPath + 
					';fillColor=' + fillColor + 
					';strokeColor=' + strokeColor + 
					';strokeWidth=1;';
				
				// Insert vertex with custom shape
				var vertex = graph.insertVertex(parent, null, '', 
					x + bbox.x, y + bbox.y, 
					Math.max(bbox.width, 10), Math.max(bbox.height, 10), 
					style);
				
			}
			
			graph.refresh();
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
		return 'shape=aiPath;pathData=' + encodedPath + ';fillColor=' + fillColor + ';strokeColor=' + strokeColor + ';strokeWidth=1;';
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
		
		for (var i = 0; i < contour.length; i++)
		{
			var scaledX = contour[i].x * scale;
			var scaledY = contour[i].y * scale;
			
			minX = Math.min(minX, scaledX);
			minY = Math.min(minY, scaledY);
			maxX = Math.max(maxX, scaledX);
			maxY = Math.max(maxY, scaledY);
		}
		
		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	}
	
	/**
	 * Main processing function
	 */
	function processImage(imageData)
	{
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
					editorUi.handleError({message: 'Failed to segment image: ' + error});
					return;
				}
				
				if (!segmentationData)
				{
					editorUi.handleError({message: 'No segmentation data received'});
					return;
				}
				
				// Extract contours
				var contours = extractContours(segmentationData, imageWidth, imageHeight);
				
				if (!contours || contours.length === 0)
				{
					editorUi.handleError({message: 'No contours extracted from segmentation'});
					return;
				}
				
				// Draw contours on canvas
				drawContoursOnCanvas(contours, imageWidth, imageHeight);
			});
		};
		
		img.onerror = function()
		{
			editorUi.handleError({message: 'Failed to load image'});
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
		
		sidebar.addPalette('aiConvert', 'AI 图片转化', false, function(content)
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
			mxEvent.addListener(fileInput, 'change', function(evt)
			{
				if (fileInput.files && fileInput.files.length > 0)
				{
					var file = fileInput.files[0];
					
					// Check file type
					if (file.type.substring(0, 6) !== 'image/')
					{
						editorUi.handleError({message: '请选择图片文件（JPG或PNG）'});
						return;
					}
					
					// Read file
					readFileAsDataURL(file, function(dataURL)
					{
						if (dataURL)
						{
							processImage(dataURL);
						}
						else
						{
							editorUi.handleError({message: '读取文件失败'});
						}
					});
					
					// Reset input
					fileInput.type = '';
					fileInput.type = 'file';
					fileInput.value = '';
				}
			});
			
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

