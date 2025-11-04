/**
 * Text to Image Plugin - NanoBanana Integration
 * Generates BioRender-style scientific illustrations from text descriptions
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
	
	// Configuration - can be overridden via URL parameters
	var config = {
		// NanoBanana proxy API endpoint - defaults to local proxy service
		apiUrl: urlParams['nanobananaApiUrl'] || 'http://localhost:8083/api/generate',
		// Default image size
		width: parseInt(urlParams['imageWidth']) || 1024,
		height: parseInt(urlParams['imageHeight']) || 1024,
		// BioRender style prompt enhancement (handled by backend)
		biorenderStyle: urlParams['biorenderStyle'] !== '0'
	};
	
	/**
	 * Enhances prompt with BioRender style instructions
	 */
	function enhancePromptForBioRender(prompt)
	{
		if (!config.biorenderStyle)
		{
			return prompt;
		}
		
		var enhanced = 'Scientific illustration, BioRender style, ' + prompt + 
			'. Clean, professional scientific diagram with soft colors, ' +
			'minimalist design, clear labeling, scientific accuracy, ' +
			'vector art style, research publication quality, ' +
			'smooth gradients, modern biology illustration.';
		
		return enhanced;
	}
	
	/**
	 * Calls NanoBanana proxy API to generate image
	 */
	function generateImage(prompt, callback, errorCallback)
	{
		if (window.console)
		{
			console.log('[Text to Image] 生成图像请求:', {
				原始提示: prompt,
				API地址: config.apiUrl
			});
		}
		
		editorUi.spinner.spin(document.body, mxResources.get('loading') || '正在生成图像...');
		
		// Prepare request payload for proxy service
		var payload = {
			prompt: prompt,
			width: config.width,
			height: config.height,
			n: 1,
			response_format: 'url'
		};
		
		// Prepare headers
		var headers = {
			'Content-Type': 'application/json'
		};
		
		// Make API request
		var xhr = new XMLHttpRequest();
		xhr.open('POST', config.apiUrl, true);
		
		// Set headers
		for (var key in headers)
		{
			xhr.setRequestHeader(key, headers[key]);
		}
		
		xhr.onload = function()
		{
			editorUi.spinner.stop();
			
			if (xhr.status === 200 || xhr.status === 201)
			{
				try
				{
					var response = JSON.parse(xhr.responseText);
					
					if (window.console)
					{
						console.log('[Text to Image] API 响应:', response);
					}
					
					// Extract image URL from standardized proxy response
					var imageUrl = null;
					
					if (response.success && response.image_url)
					{
						imageUrl = response.image_url;
					}
					else if (response.image_url)
					{
						// Fallback: direct image_url
						imageUrl = response.image_url;
					}
					else if (response.data && response.data.length > 0)
					{
						// Fallback: nested data format
						imageUrl = response.data[0].url || response.data[0].image_url;
					}
					
					if (imageUrl)
					{
						// Load and insert image
						loadImageToCanvas(imageUrl, callback);
					}
					else
					{
						var errorMsg = '无法从API响应中提取图像URL。响应格式: ' + JSON.stringify(response);
						if (window.console)
						{
							console.error('[Text to Image]', errorMsg);
						}
						if (errorCallback)
						{
							errorCallback({message: errorMsg});
						}
					}
				}
				catch (e)
				{
					if (window.console)
					{
						console.error('[Text to Image] 解析响应失败:', e);
					}
					if (errorCallback)
					{
						errorCallback({message: '解析API响应失败: ' + e.message});
					}
				}
			}
			else
			{
				var errorMsg = 'API请求失败: HTTP ' + xhr.status;
				if (xhr.responseText)
				{
					try
					{
						var errorResponse = JSON.parse(xhr.responseText);
						errorMsg += ' - ' + (errorResponse.detail || errorResponse.message || errorResponse.error || xhr.responseText);
					}
					catch (e)
					{
						errorMsg += ' - ' + xhr.responseText.substring(0, 200);
					}
				}
				
				if (window.console)
				{
					console.error('[Text to Image]', errorMsg);
				}
				
				if (errorCallback)
				{
					errorCallback({message: errorMsg});
				}
			}
		};
		
		xhr.onerror = function()
		{
			editorUi.spinner.stop();
			var errorMsg = '网络请求失败，请检查服务是否运行在 ' + config.apiUrl;
			if (window.console)
			{
				console.error('[Text to Image]', errorMsg);
			}
			if (errorCallback)
			{
				errorCallback({message: errorMsg});
			}
		};
		
		xhr.ontimeout = function()
		{
			editorUi.spinner.stop();
			var errorMsg = '请求超时，图像生成可能需要更长时间，请稍后重试';
			if (window.console)
			{
				console.error('[Text to Image]', errorMsg);
			}
			if (errorCallback)
			{
				errorCallback({message: errorMsg});
			}
		};
		
		// Set timeout (60 seconds for image generation)
		xhr.timeout = 60000;
		
		// Send request
		try
		{
			xhr.send(JSON.stringify(payload));
		}
		catch (e)
		{
			editorUi.spinner.stop();
			if (window.console)
			{
				console.error('[Text to Image] 发送请求失败:', e);
			}
			if (errorCallback)
			{
				errorCallback({message: '发送请求失败: ' + e.message});
			}
		}
	}
	
	/**
	 * Loads image from URL and inserts it into canvas
	 */
	function loadImageToCanvas(imageUrl, callback)
	{
		if (window.console)
		{
			console.log('[Text to Image] 加载图像:', imageUrl);
		}
		
		editorUi.spinner.spin(document.body, mxResources.get('loading') || '正在插入图像...');
		
		var img = new Image();
		img.crossOrigin = 'anonymous';
		
		img.onload = function()
		{
			editorUi.spinner.stop();
			
			// Calculate insert position
			var insertPoint = graph.getFreeInsertPoint();
			var x = Math.max(insertPoint.x, 20);
			var y = Math.max(insertPoint.y, 20);
			
			// Insert image into graph
			var cell = graph.insertVertex(graph.getDefaultParent(), null, '', x, y, 
				img.width, img.height, 'image;html=1;aspect=fixed;');
			
			if (cell)
			{
				// Set image source
				graph.setAttributeForCell(cell, 'image', imageUrl);
				
				// Select the new cell
				graph.setSelectionCell(cell);
				graph.scrollCellToVisible(cell);
				
				// Show success message
				editorUi.editor.setStatus(mxResources.get('done') || '完成');
				
				if (window.console)
				{
					console.log('[Text to Image] 图像已插入画布:', {
						位置: {x: x, y: y},
						尺寸: {width: img.width, height: img.height},
						单元格: cell
					});
				}
				
				if (callback)
				{
					callback(cell, imageUrl);
				}
			}
			else
			{
				editorUi.handleError({message: '插入图像失败'});
			}
		};
		
		img.onerror = function()
		{
			editorUi.spinner.stop();
			editorUi.handleError({message: '加载图像失败，请检查图像URL'});
		};
		
		// Start loading image
		img.src = imageUrl;
	}
	
	/**
	 * Adds text-to-image palette to sidebar
	 */
	function addTextToImagePalette()
	{
		// Remove existing palette if it exists
		if (sidebar.palettes['textToImage'])
		{
			sidebar.removePalette('textToImage');
		}
		
		if (window.console)
		{
			console.log('[Text to Image Plugin] Creating palette');
		}
		
		sidebar.addPalette('textToImage', '文生图 (NanoBanana)', true, function(content)
		{
			var div = document.createElement('div');
			div.style.padding = '10px';
			
			// Title
			var title = document.createElement('div');
			title.style.fontSize = '12px';
			title.style.fontWeight = 'bold';
			title.style.marginBottom = '8px';
			title.style.color = '#333';
			title.textContent = '输入描述生成科研插图';
			
			// Text area for prompt
			var textarea = document.createElement('textarea');
			textarea.setAttribute('placeholder', '例如：细胞分裂过程，DNA双螺旋结构，蛋白质合成过程...');
			textarea.style.width = '100%';
			textarea.style.height = '80px';
			textarea.style.padding = '8px';
			textarea.style.marginBottom = '10px';
			textarea.style.border = '1px solid #ccc';
			textarea.style.borderRadius = '4px';
			textarea.style.fontSize = '12px';
			textarea.style.fontFamily = 'inherit';
			textarea.style.resize = 'vertical';
			textarea.style.boxSizing = 'border-box';
			
			// Generate button
			var generateBtn = mxUtils.button('生成图像', function()
			{
				var prompt = mxUtils.trim(textarea.value);
				
				if (!prompt)
				{
					editorUi.handleError({message: '请输入描述文字'});
					return;
				}
				
				// Disable button during generation
				generateBtn.setAttribute('disabled', 'disabled');
				generateBtn.textContent = '生成中...';
				
				generateImage(prompt, function(cell, imageUrl)
				{
					// Re-enable button
					generateBtn.removeAttribute('disabled');
					generateBtn.textContent = '生成图像';
					
					// Clear textarea after successful generation
					textarea.value = '';
				}, function(error)
				{
					// Re-enable button on error
					generateBtn.removeAttribute('disabled');
					generateBtn.textContent = '生成图像';
					
					editorUi.handleError(error);
				});
			});
			
			generateBtn.className = 'geBtn';
			generateBtn.style.width = '100%';
			generateBtn.style.marginBottom = '10px';
			
			// Info text
			var infoText = document.createElement('div');
			infoText.style.fontSize = '10px';
			infoText.style.color = '#666';
			infoText.style.marginTop = '8px';
			infoText.style.lineHeight = '1.4';
			infoText.innerHTML = '💡 提示：描述越详细，生成的图像质量越好<br/>' +
				'📐 风格：自动应用 BioRender 科研插图风格<br/>' +
				'⚙️ 配置：可通过 URL 参数 nanobananaApiUrl 设置 API 地址<br/>' +
				'🔧 服务：需要启动 nanobanana 代理服务 (端口 8083)';
			
			// Style toggle checkbox
			var styleDiv = document.createElement('div');
			styleDiv.style.marginTop = '10px';
			styleDiv.style.paddingTop = '10px';
			styleDiv.style.borderTop = '1px solid #eee';
			
			var styleCheckbox = document.createElement('input');
			styleCheckbox.setAttribute('type', 'checkbox');
			styleCheckbox.setAttribute('id', 'biorender-style-toggle');
			styleCheckbox.checked = config.biorenderStyle;
			styleCheckbox.style.marginRight = '6px';
			
			var styleLabel = document.createElement('label');
			styleLabel.setAttribute('for', 'biorender-style-toggle');
			styleLabel.style.fontSize = '11px';
			styleLabel.style.color = '#666';
			styleLabel.style.cursor = 'pointer';
			styleLabel.textContent = '启用 BioRender 风格增强';
			
			styleCheckbox.onchange = function()
			{
				config.biorenderStyle = styleCheckbox.checked;
				if (window.console)
				{
					console.log('[Text to Image] BioRender 风格:', config.biorenderStyle ? '启用' : '禁用');
				}
			};
			
			styleDiv.appendChild(styleCheckbox);
			styleDiv.appendChild(styleLabel);
			
			div.appendChild(title);
			div.appendChild(textarea);
			div.appendChild(generateBtn);
			div.appendChild(infoText);
			div.appendChild(styleDiv);
			
			content.appendChild(div);
		});
	}
	
	// Add palette immediately
	if (window.console)
	{
		console.log('[Text to Image Plugin] Adding palette to sidebar');
	}
	addTextToImagePalette();
	
	// Handles reload of sidebar after dark mode change or reinit
	var originalInit = sidebar.init;
	sidebar.init = function()
	{
		originalInit.apply(this, arguments);
		if (window.console)
		{
			console.log('[Text to Image Plugin] Sidebar reinit, adding palette again');
		}
		addTextToImagePalette();
	};
});

