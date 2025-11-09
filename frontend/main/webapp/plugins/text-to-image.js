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
		// Image generator API endpoint - defaults to local service
		apiUrl: urlParams['imageGeneratorApiUrl'] || urlParams['nanobananaApiUrl'] || 'http://localhost:8083/api/generate',
		// Default aspect ratio
		aspectRatio: urlParams['aspectRatio'] || '16:9',
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
		
		// Enhance prompt if BioRender style is enabled
		var finalPrompt = config.biorenderStyle ? enhancePromptForBioRender(prompt) : prompt;
		
		// Prepare request payload for image generator service
		var payload = {
			prompt: finalPrompt,
			aspect_ratio: config.aspectRatio,
			max_tokens: 150,
			temperature: 0.7
		};
		
		// Use fetch API for better CORS support
		if (window.console)
		{
			console.log('[Text to Image] 准备发送请求:', {
				url: config.apiUrl,
				method: 'POST',
				payload: payload
			});
		}
		
		// Use fetch API instead of XMLHttpRequest for better CORS handling
		fetch(config.apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload),
			mode: 'cors',
			credentials: 'omit'
		})
		.then(function(response)
		{
			if (window.console)
			{
				console.log('[Text to Image] 响应状态:', response.status, response.statusText);
			}
			
			if (!response.ok)
			{
				// Try to parse error response
				return response.text().then(function(text)
				{
					var errorMsg = 'API请求失败: HTTP ' + response.status;
					try
					{
						var errorResponse = JSON.parse(text);
						errorMsg += ' - ' + (errorResponse.detail || errorResponse.message || errorResponse.error || text);
					}
					catch (e)
					{
						errorMsg += ' - ' + text.substring(0, 200);
					}
					throw new Error(errorMsg);
				});
			}
			
			return response.json();
		})
		.then(function(response)
		{
			if (window.console)
			{
				console.log('[Text to Image] API 响应:', response);
			}
			
			// Extract image URL from response
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
			
			if (imageUrl)
			{
				// Load and insert image
				// imageUrl can be a data URL (data:image/png;base64,...) or regular URL
				// Note: spinner will be stopped in loadImageToCanvas
				loadImageToCanvas(imageUrl, callback);
			}
			else
			{
				editorUi.spinner.stop();
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
		})
		.catch(function(error)
		{
			editorUi.spinner.stop();
			
			var errorMsg = '网络请求失败: ' + error.message;
			
			if (window.console)
			{
				console.error('[Text to Image] 请求失败:', error);
				console.error('[Text to Image] 错误详情:', {
					message: error.message,
					stack: error.stack,
					url: config.apiUrl
				});
			}
			
			// Provide more helpful error message
			if (error.message.indexOf('Failed to fetch') !== -1 || 
			    error.message.indexOf('NetworkError') !== -1 ||
			    error.message.indexOf('网络') !== -1)
			{
				errorMsg = '网络请求失败，请检查服务是否运行在 ' + config.apiUrl + '\n错误: ' + error.message;
			}
			
			if (errorCallback)
			{
				errorCallback({message: errorMsg});
			}
		});
	}
	
	/**
	 * Loads image from URL and inserts it into canvas
	 */
	function loadImageToCanvas(imageUrl, callback)
	{
		if (window.console)
		{
			console.log('[Text to Image] 加载图像:', imageUrl.substring(0, 100) + '...');
			console.log('[Text to Image] 图像URL类型:', imageUrl.substring(0, 20));
			console.log('[Text to Image] 图像URL长度:', imageUrl.length);
		}
		
		editorUi.spinner.spin(document.body, mxResources.get('loading') || '正在插入图像...');
		
		var img = new Image();
		
		// 对于 data URL，不需要设置 crossOrigin
		if (imageUrl.substring(0, 5) !== 'data:')
		{
			img.crossOrigin = 'anonymous';
		}
		
		img.onload = function()
		{
			editorUi.spinner.stop();
			
			if (window.console)
			{
				console.log('[Text to Image] 图像加载成功:', {
					width: img.width,
					height: img.height,
					naturalWidth: img.naturalWidth,
					naturalHeight: img.naturalHeight,
					complete: img.complete
				});
			}
			
			// 检查图像尺寸
			var imgWidth = img.naturalWidth || img.width || 800;
			var imgHeight = img.naturalHeight || img.height || 600;
			
			if (imgWidth === 0 || imgHeight === 0)
			{
				editorUi.handleError({message: '图像尺寸无效 (0x0)，可能是图像数据损坏'});
				return;
			}
			
			// Calculate insert position
			var insertPoint = graph.getFreeInsertPoint();
			var x = Math.max(insertPoint.x, 20);
			var y = Math.max(insertPoint.y, 20);
			
			// Prepare image URL for style (remove data URI encoding info if present)
			var imageStyleUrl = imageUrl;
			// Only process data URIs (data:image/...)
			if (imageUrl.substring(0, 5) === 'data:')
			{
				var semi = imageUrl.indexOf(';');
				if (semi > 0 && imageUrl.indexOf(',') > semi)
				{
					// Remove encoding info (e.g., ;base64,) for cell style
					// Format: data:image/png;base64,xxxxx -> data:image/png,xxxxx
					imageStyleUrl = imageUrl.substring(0, semi) + imageUrl.substring(imageUrl.indexOf(',', semi + 1));
				}
			}
			
			// Build proper style string with image URL
			var style = 'shape=image;verticalLabelPosition=bottom;labelBackgroundColor=default;' +
				'verticalAlign=top;aspect=fixed;imageAspect=0;image=' + imageStyleUrl + ';';
			
			if (window.console)
			{
				console.log('[Text to Image] 插入图片:', {
					位置: {x: x, y: y},
					尺寸: {width: imgWidth, height: imgHeight},
					样式: style.substring(0, 100) + '...',
					imageUrl: imageUrl.substring(0, 100) + '...'
				});
			}
			
			// Insert image into graph with proper style
			graph.getModel().beginUpdate();
			try
			{
				var cell = graph.insertVertex(graph.getDefaultParent(), null, '', x, y, 
					imgWidth, imgHeight, style);
				
				if (cell)
				{
					// Ensure shape is set to image
					graph.setCellStyles(mxConstants.STYLE_SHAPE, 'image', [cell]);
					
					// Refresh the cell to ensure image is displayed
					graph.refresh(cell);
					
					// Select the new cell
					graph.setSelectionCell(cell);
					graph.scrollCellToVisible(cell);
					
					// Show success message
					editorUi.editor.setStatus(mxResources.get('done') || '完成');
					
					if (window.console)
					{
						console.log('[Text to Image] 图像已插入画布:', {
							位置: {x: x, y: y},
							尺寸: {width: imgWidth, height: imgHeight},
							单元格: cell,
							图片URL: imageUrl.substring(0, 100) + '...'
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
			}
			finally
			{
				graph.getModel().endUpdate();
			}
		};
		
		img.onerror = function(e)
		{
			editorUi.spinner.stop();
			if (window.console)
			{
				console.error('[Text to Image] 图像加载失败:', e);
				console.error('[Text to Image] 图像URL前100字符:', imageUrl.substring(0, 100));
			}
			editorUi.handleError({message: '加载图像失败，请检查图像URL或数据格式'});
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
			textarea.setAttribute('spellcheck', 'false');
			textarea.setAttribute('autocomplete', 'off');
			textarea.setAttribute('autocorrect', 'off');
			textarea.setAttribute('autocapitalize', 'off');
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
			textarea.style.outline = 'none';
			textarea.style.background = '#fff';
			
			// Ensure textarea is always editable and can receive focus
			textarea.addEventListener('mousedown', function(e)
			{
				// Prevent any event that might block input
				e.stopPropagation();
			}, true);
			
			textarea.addEventListener('click', function(e)
			{
				// Ensure focus on click
				if (document.activeElement !== textarea)
				{
					textarea.focus();
				}
				e.stopPropagation();
			}, true);
			
			textarea.addEventListener('focus', function(e)
			{
				// Ensure textarea is not readonly when focused
				textarea.removeAttribute('readonly');
				textarea.removeAttribute('disabled');
				e.stopPropagation();
			}, true);
			
			// Prevent graph from capturing keyboard events when typing in textarea
			textarea.addEventListener('keydown', function(e)
			{
				e.stopPropagation();
			}, true);
			
			textarea.addEventListener('keyup', function(e)
			{
				e.stopPropagation();
			}, true);
			
			textarea.addEventListener('input', function(e)
			{
				e.stopPropagation();
			}, true);
			
			// Ensure textarea is always editable - periodic check
			var ensureTextareaEditable = function()
			{
				if (textarea.hasAttribute('readonly'))
				{
					textarea.removeAttribute('readonly');
				}
				if (textarea.hasAttribute('disabled'))
				{
					textarea.removeAttribute('disabled');
				}
			};
			
			// Check periodically to ensure textarea is always editable
			var editableCheckInterval = setInterval(ensureTextareaEditable, 500);
			
			// Clean up interval when palette is removed
			var originalRemovePalette = sidebar.removePalette;
			if (originalRemovePalette)
			{
				sidebar.removePalette = function(name)
				{
					if (name === 'textToImage' && editableCheckInterval)
					{
						clearInterval(editableCheckInterval);
					}
					return originalRemovePalette.apply(this, arguments);
				};
			}
			
			// Generate button
			var generateBtn = mxUtils.button('生成图像', function()
			{
				var prompt = mxUtils.trim(textarea.value);
				
				if (!prompt)
				{
					editorUi.handleError({message: '请输入描述文字'});
					// Ensure textarea can still receive focus after error
					setTimeout(function() { textarea.focus(); }, 100);
					return;
				}
				
				// Ensure textarea is editable before generation
				ensureTextareaEditable();
				
				// Disable button during generation (but NOT textarea)
				generateBtn.setAttribute('disabled', 'disabled');
				generateBtn.textContent = '生成中...';
				
				generateImage(prompt, function(cell, imageUrl)
				{
					// Re-enable button
					generateBtn.removeAttribute('disabled');
					generateBtn.textContent = '生成图像';
					
					// Ensure textarea is still editable after generation
					ensureTextareaEditable();
					
					// Clear textarea but keep it editable
					textarea.value = '';
					
					// Optionally focus textarea for next input
					setTimeout(function() { textarea.focus(); }, 100);
				}, function(error)
				{
					// Re-enable button on error
					generateBtn.removeAttribute('disabled');
					generateBtn.textContent = '生成图像';
					
					// Ensure textarea is still editable after error
					ensureTextareaEditable();
					
					editorUi.handleError(error);
					
					// Focus textarea so user can continue typing
					setTimeout(function() { textarea.focus(); }, 100);
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
				'📐 风格：使用 gemini-2.5-flash-image 模型生成图像<br/>' +
				'⚙️ 配置：可通过 URL 参数 imageGeneratorApiUrl 设置 API 地址<br/>' +
				'🔧 服务：需要启动图像生成服务 (端口 8083)';
			
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

