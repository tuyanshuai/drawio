/**
 * Icons Library API Plugin
 * 从 API 动态加载图标库（SVG 和 XML stencil 格式）
 * 支持按需加载、缓存、预加载、分组和搜索功能
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
	
	// ========== 配置 ==========
	var config = {
		// API 基础 URL - 可以通过 window.MATERIAL_LIBRARY_API_URL 覆盖
		apiBaseUrl: window.MATERIAL_LIBRARY_API_URL || 'http://localhost:8082/api',
		
		// 认证配置
		auth: {
			// Bearer Token 方式
			token: window.MATERIAL_LIBRARY_API_TOKEN || null,
			// 或 API Key 方式
			apiKey: window.MATERIAL_LIBRARY_API_KEY || null
		},
		
		// 缓存配置
		cache: {
			enabled: false,  // 暂时禁用缓存
			prefix: 'material_lib_',
			expireDays: 7  // 缓存过期天数（0 表示永不过期）
		},
		
		// 预加载配置
		preload: {
			enabled: true,
			delay: 2000  // 延迟 2 秒后开始预加载
		}
	};
	
	// ========== 缓存管理 ==========
	var CacheManager = {
		/**
		 * 获取缓存键
		 */
		getCacheKey: function(categoryId, version)
		{
			return config.cache.prefix + categoryId + '_' + (version || 'default');
		},
		
		/**
		 * 保存到缓存
		 */
		set: function(categoryId, version, data)
		{
			if (!config.cache.enabled) return;
			
			try
			{
				var key = this.getCacheKey(categoryId, version);
				var cacheData = {
					data: data,
					timestamp: Date.now(),
					version: version || 'default'
				};
				
				localStorage.setItem(key, JSON.stringify(cacheData));
				
				if (window.console)
				{
					console.log('[Material Library API] Cached:', categoryId, version);
				}
			}
			catch (e)
			{
				if (window.console)
				{
					console.warn('[Material Library API] Cache save failed:', e);
				}
			}
		},
		
		/**
		 * 从缓存读取
		 */
		get: function(categoryId, version)
		{
			if (!config.cache.enabled) return null;
			
			try
			{
				var key = this.getCacheKey(categoryId, version);
				var cached = localStorage.getItem(key);
				
				if (!cached) return null;
				
				var cacheData = JSON.parse(cached);
				
				// 检查缓存是否过期
				if (config.cache.expireDays > 0)
				{
					var expireTime = config.cache.expireDays * 24 * 60 * 60 * 1000;
					if (Date.now() - cacheData.timestamp > expireTime)
					{
						localStorage.removeItem(key);
						return null;
					}
				}
				
				// 检查版本是否匹配
				if (version && cacheData.version !== version)
				{
					localStorage.removeItem(key);
					return null;
				}
				
				if (window.console)
				{
					console.log('[Material Library API] Cache hit:', categoryId, version);
				}
				
				return cacheData.data;
			}
			catch (e)
			{
				if (window.console)
				{
					console.warn('[Material Library API] Cache read failed:', e);
				}
				return null;
			}
		},
		
		/**
		 * 清除缓存
		 */
		clear: function(categoryId)
		{
			try
			{
				if (categoryId)
				{
					// 清除特定分类的缓存（所有版本）
					var prefix = config.cache.prefix + categoryId + '_';
					for (var i = 0; i < localStorage.length; i++)
					{
						var key = localStorage.key(i);
						if (key && key.indexOf(prefix) === 0)
						{
							localStorage.removeItem(key);
						}
					}
				}
				else
				{
					// 清除所有缓存
					var prefix = config.cache.prefix;
					for (var i = localStorage.length - 1; i >= 0; i--)
					{
						var key = localStorage.key(i);
						if (key && key.indexOf(prefix) === 0)
						{
							localStorage.removeItem(key);
						}
					}
				}
				
				if (window.console)
				{
					console.log('[Material Library API] Cache cleared:', categoryId || 'all');
				}
			}
			catch (e)
			{
				if (window.console)
				{
					console.warn('[Material Library API] Cache clear failed:', e);
				}
			}
		}
	};
	
	// ========== API 请求 ==========
	var ApiClient = {
		/**
		 * 获取请求头
		 */
		getHeaders: function()
		{
			var headers = {
				'Content-Type': 'application/json'
			};
			
			if (config.auth.token)
			{
				headers['Authorization'] = 'Bearer ' + config.auth.token;
			}
			else if (config.auth.apiKey)
			{
				headers['X-API-Key'] = config.auth.apiKey;
			}
			
			return headers;
		},
		
		/**
		 * 发起 GET 请求
		 */
		get: function(url, callback, errorCallback)
		{
			var fullUrl = config.apiBaseUrl + url;
			
			mxUtils.get(fullUrl, mxUtils.bind(this, function(req)
			{
				if (req.getStatus() >= 200 && req.getStatus() <= 299)
				{
					try
					{
						var response = JSON.parse(req.getText());
						
						if (response.success)
						{
							callback(response.data);
						}
						else
						{
							var err = response.error || {message: 'Unknown error'};
							if (errorCallback)
							{
								errorCallback(err);
							}
							else if (window.console)
							{
								console.error('[Material Library API] API error:', err);
							}
						}
					}
					catch (e)
					{
						if (errorCallback)
						{
							errorCallback({message: 'Failed to parse response: ' + e.message});
						}
						else if (window.console)
						{
							console.error('[Material Library API] Parse error:', e);
						}
					}
				}
				else
				{
					var err = {message: 'HTTP ' + req.getStatus()};
					if (errorCallback)
					{
						errorCallback(err);
					}
					else if (window.console)
					{
						console.error('[Material Library API] HTTP error:', req.getStatus());
					}
				}
			}), mxUtils.bind(this, function(req)
			{
				var err = {message: 'Network error'};
				if (errorCallback)
				{
					errorCallback(err);
				}
				else if (window.console)
				{
					console.error('[Material Library API] Network error');
				}
			}), null, null, this.getHeaders());
		},
		
		/**
		 * 获取素材库列表
		 */
		getLibraries: function(callback, errorCallback)
		{
			this.get('/material-libraries', callback, errorCallback);
		},
		
		/**
		 * 获取分类素材
		 */
		getCategoryItems: function(categoryId, version, callback, errorCallback)
		{
			var url = '/material-libraries/' + encodeURIComponent(categoryId) + '/items';
			if (version)
			{
				url += '?version=' + encodeURIComponent(version);
			}
			
			this.get(url, callback, errorCallback);
		}
	};
	
	// ========== 素材加载器 ==========
	var MaterialLoader = {
		/**
		 * 加载 SVG 素材
		 */
		loadSvg: function(item, callback)
		{
			var self = this;
			
			// 如果已有 data，直接使用
			if (item.data && item.data.substring(0, 5) === 'data:')
			{
				// 验证 data URI 格式
				if (item.data.indexOf(',') === -1)
				{
					if (window.console)
					{
						console.error('[Icons Library API] Invalid data URI format (missing comma):', item.data.substring(0, 50));
					}
					// 如果格式不正确，尝试从 URL 加载
					if (item.url)
					{
						item.data = null; // 清除无效的 data
					}
					else
					{
						if (callback) callback(null);
						return;
					}
				}
				else
				{
					this.createSvgEntry(item, item.data, callback);
					return;
				}
			}
			
			// 否则从 URL 加载
			var url = item.url;
			
			if (!url)
			{
				if (window.console)
				{
					console.error('[Icons Library API] No URL or data provided for item:', item.id);
				}
				if (callback) callback(null);
				return;
			}
			
			// 转换 SVG URL 为 data URI
			editorUi.editor.convertImageToDataUri(url, mxUtils.bind(this, function(dataUri)
			{
				// 验证返回的 data URI 格式
				if (!dataUri)
				{
					if (window.console)
					{
						console.error('[Icons Library API] convertImageToDataUri returned null/undefined for:', url);
					}
					self.createSvgEntry(item, url, callback);
					return;
				}
				
				// 检查是否是 data URI
				if (dataUri.substring(0, 5) !== 'data:')
				{
					// 如果不是 data URI，可能是原始 URL，直接使用
					if (window.console)
					{
						console.log('[Icons Library API] convertImageToDataUri returned non-data URI, using as-is:', dataUri.substring(0, 50));
					}
					self.createSvgEntry(item, dataUri, callback);
					return;
				}
				
				// 检查 data URI 是否包含逗号（数据部分）
				if (dataUri.indexOf(',') === -1)
				{
					if (window.console)
					{
						console.error('[Icons Library API] Invalid data URI from convertImageToDataUri (missing comma):', dataUri.substring(0, 100));
					}
					// 如果转换失败，直接使用 URL
					self.createSvgEntry(item, url, callback);
				}
				else
				{
					self.createSvgEntry(item, dataUri, callback);
				}
			}), mxUtils.bind(this, function()
			{
				// 如果转换失败，直接使用 URL
				if (window.console)
				{
					console.warn('[Icons Library API] convertImageToDataUri failed for:', url);
				}
				self.createSvgEntry(item, url, callback);
			}));
		},
		
		/**
		 * 创建 SVG 条目
		 */
		createSvgEntry: function(item, imageData, callback)
		{
			// 验证 imageData
			if (!imageData)
			{
				if (window.console)
				{
					console.error('[Icons Library API] No imageData provided for item:', item.id);
				}
				if (callback) callback(null);
				return;
			}
			
			// 如果是 data URI，验证格式
			if (imageData.substring(0, 5) === 'data:')
			{
				if (imageData.indexOf(',') === -1)
				{
					if (window.console)
					{
						console.error('[Icons Library API] Invalid data URI format (missing comma):', imageData.substring(0, 50));
					}
					if (callback) callback(null);
					return;
				}
			}
			
			// 构建 tags 字符串（用于搜索索引）
			var tags = (item.title || '') + ' ' + (item.tags ? (Array.isArray(item.tags) ? item.tags.join(' ') : item.tags) : '');
			tags = tags.trim();
			
			// 如果没有 tags，使用 title 或 id
			if (!tags || tags === '')
			{
				tags = item.title || item.id || 'icon';
			}
			
			var entry = {
				data: imageData,
				w: item.width || 100,
				h: item.height || 100,
				title: item.title || item.id || 'Icon',
				tags: tags,  // tags 字符串用于搜索索引
				aspect: 'fixed'
			};
			
			if (window.console)
			{
				// console.log('[Icons Library API] 创建 SVG 条目:', {
				// 	id: item.id,
				// 	title: entry.title,
				// 	tags: entry.tags,
				// 	size: entry.w + 'x' + entry.h
				// });
			}
			
			if (callback)
			{
				callback(entry);
			}
		},
		
		/**
		 * 加载 XML stencil
		 */
		loadXmlStencil: function(item, categoryId, callback)
		{
			var self = this;
			
			// 如果已有 data，直接使用
			if (item.data)
			{
				var xmlData = item.data;
				
				// 如果是 base64，解码
				if (xmlData.substring(0, 5) === 'data:')
				{
					var base64Data = xmlData.substring(xmlData.indexOf(',') + 1);
					xmlData = (window.atob && !mxClient.IS_SF) ? atob(base64Data) : Base64.decode(base64Data, true);
				}
				
				this.processXmlStencil(xmlData, item, categoryId, callback);
				return;
			}
			
			// 否则从 URL 加载
			var url = item.url;
			
			mxUtils.get(url, mxUtils.bind(this, function(req)
			{
				if (req.getStatus() >= 200 && req.getStatus() <= 299)
				{
					self.processXmlStencil(req.getText(), item, categoryId, callback);
				}
				else
				{
					if (window.console)
					{
						console.error('[Material Library API] Failed to load XML stencil:', url);
					}
					if (callback)
					{
						callback(null);
					}
				}
			}), mxUtils.bind(this, function()
			{
				if (window.console)
				{
					console.error('[Material Library API] Network error loading XML stencil:', url);
				}
				if (callback)
				{
					callback(null);
				}
			}));
		},
		
		/**
		 * 处理 XML stencil
		 */
		processXmlStencil: function(xmlText, item, categoryId, callback)
		{
			try
			{
				var doc = mxUtils.parseXml(xmlText);
				var root = doc.documentElement;
				
				// 检查是否是 stencil set 格式 (shapes 或 stencils)
				if (root.nodeName === 'shapes' || root.nodeName === 'stencils')
				{
					// 使用 parseStencilSet 解析
					var tags = (item.title || '') + ' ' + (item.tags ? item.tags.join(' ') : '');
					var templates = [];
					var callCount = 0;
					var expectedCount = 0;
					
					// 先统计 stencil 数量
					var shapeNodes = root.getElementsByTagName('shape');
					expectedCount = shapeNodes.length;
					
					// 如果没有找到 shape 节点，尝试直接解析
					if (expectedCount === 0)
					{
						expectedCount = 1; // 至少一个
					}
					
					mxStencilRegistry.parseStencilSet(root, mxUtils.bind(this, function(packageName, stencilName, displayName, w, h)
					{
						var shapeName = packageName + stencilName.toLowerCase();
						
						// 添加到搜索索引
						var fullTags = tags + ' ' + (displayName || stencilName);
						sidebar.addEntry(fullTags, mxUtils.bind(this, function()
						{
							return sidebar.createVertexTemplate(
								'shape=' + shapeName,
								w || item.width || 100,
								h || item.height || 100,
								'',
								displayName || item.title || item.id,
								true
							);
						}));
						
						// 创建模板元素
						var template = sidebar.createVertexTemplate(
							'shape=' + shapeName,
							w || item.width || 100,
							h || item.height || 100,
							'',
							displayName || item.title || item.id,
							true
						);
						
						templates.push(template);
						callCount++;
						
						// 当所有 stencil 都解析完成后，调用回调
						if (callCount >= expectedCount && callback)
						{
							// 返回所有模板（虽然 callback 只接受一个，但我们可以多次调用）
							for (var i = 0; i < templates.length; i++)
							{
								callback(templates[i]);
							}
						}
					}), true);
					
					// 如果没有解析到任何 stencil，直接调用 callback(null)
					if (expectedCount === 0 && callback)
					{
						setTimeout(function()
						{
							if (templates.length === 0)
							{
								callback(null);
							}
						}, 100);
					}
				}
				else if (root.nodeName === 'mxlibrary')
				{
					// mxlibrary 格式（JSON 格式的库）
					try
					{
						var jsonText = mxUtils.getTextContent(root);
						var libraryData = JSON.parse(jsonText);
						
						// 使用 addEntries 方法添加
						if (libraryData && Array.isArray(libraryData))
						{
							sidebar.setCurrentSearchEntryLibrary('icons', 'icons');
							sidebar.addEntries(libraryData);
							sidebar.setCurrentSearchEntryLibrary();
							
							// 为每个条目创建模板
							for (var i = 0; i < libraryData.length; i++)
							{
								var libItem = libraryData[i];
								
								if (libItem.xml)
								{
									var cells = editorUi.stringToCells((libItem.xml.charAt(0) == '<') ?
										libItem.xml : Graph.decompress(libItem.xml));
									
									if (cells && cells.length > 0)
									{
										var template = sidebar.createVertexTemplateFromCells(
											cells,
											libItem.w || item.width || 100,
											libItem.h || item.height || 100,
											libItem.title || item.title || item.id,
											true,
											false,
											true
										);
										
										if (callback)
										{
											callback(template);
										}
									}
								}
								else if (libItem.data)
								{
									var template = sidebar.createVertexTemplate(
										'shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=' + libItem.data,
										libItem.w || item.width || 100,
										libItem.h || item.height || 100,
										'',
										libItem.title || item.title || item.id,
										true
									);
									
									if (callback)
									{
										callback(template);
									}
								}
							}
						}
					}
					catch (e)
					{
						if (window.console)
						{
							console.error('[Material Library API] Failed to parse mxlibrary:', e);
						}
						if (callback)
						{
							callback(null);
						}
					}
				}
				else
				{
					// 尝试作为单元格 XML 处理
					var cells = editorUi.stringToCells(xmlText);
					
					if (cells && cells.length > 0)
					{
						var tags = (item.title || '') + ' ' + (item.tags ? item.tags.join(' ') : '');
						
						var template = sidebar.createVertexTemplateFromCells(
							cells,
							item.width || 100,
							item.height || 100,
							item.title || item.id,
							true,
							false,
							true
						);
						
						// 添加到搜索索引
						if (tags)
						{
							sidebar.addEntry(tags, mxUtils.bind(this, function()
							{
								return template;
							}));
						}
						
						if (callback)
						{
							callback(template);
						}
					}
					else
					{
						if (callback)
						{
							callback(null);
						}
					}
				}
			}
			catch (e)
			{
				if (window.console)
				{
					console.error('[Material Library API] Failed to process XML stencil:', e);
				}
				if (callback)
				{
					callback(null);
				}
			}
		}
	};
	
	// ========== 分类管理 ==========
	var categoryData = {};  // 存储分类数据
	var loadingCategories = {};  // 正在加载的分类
	
	/**
	 * 加载分类素材
	 */
	function loadCategoryItems(categoryId, categoryInfo, contentDiv, callback)
	{
		// 检查是否正在加载
		if (loadingCategories[categoryId])
		{
			if (callback) callback();
			return;
		}
		
		// 检查缓存
		var cached = CacheManager.get(categoryId, categoryInfo.version);
		if (cached)
		{
			renderCategoryItems(cached, contentDiv);
			if (callback) callback();
			return;
		}
		
		// 标记为加载中
		loadingCategories[categoryId] = true;
		
		// 显示加载状态
		var loadingDiv = document.createElement('div');
		loadingDiv.style.padding = '10px';
		loadingDiv.style.textAlign = 'center';
		loadingDiv.style.color = '#999';
		loadingDiv.textContent = mxResources.get('loading') || '加载中...';
		contentDiv.appendChild(loadingDiv);
		
		// 从 API 加载
		ApiClient.getCategoryItems(categoryId, categoryInfo.version, mxUtils.bind(this, function(data)
		{
			loadingCategories[categoryId] = false;
			
			// 移除加载提示
			if (loadingDiv.parentNode)
			{
				loadingDiv.parentNode.removeChild(loadingDiv);
			}
			
			// 保存到缓存
			CacheManager.set(categoryId, categoryInfo.version, data);
			
			// 渲染素材
			renderCategoryItems(data, contentDiv);
			
			if (callback) callback();
		}), mxUtils.bind(this, function(error)
		{
			loadingCategories[categoryId] = false;
			
			// 移除加载提示
			if (loadingDiv.parentNode)
			{
				loadingDiv.parentNode.removeChild(loadingDiv);
			}
			
			// 显示错误信息
			var errorDiv = document.createElement('div');
			errorDiv.style.padding = '10px';
			errorDiv.style.textAlign = 'center';
			errorDiv.style.color = '#f00';
			errorDiv.textContent = (mxResources.get('error') || '错误') + ': ' + (error.message || '加载失败');
			contentDiv.appendChild(errorDiv);
			
			if (callback) callback();
		}));
	}
	
	/**
	 * 渲染分类素材
	 */
	function renderCategoryItems(data, contentDiv)
	{
		if (!data || !data.items || data.items.length === 0)
		{
			var emptyDiv = document.createElement('div');
			emptyDiv.style.padding = '10px';
			emptyDiv.style.textAlign = 'center';
			emptyDiv.style.color = '#999';
			emptyDiv.textContent = '暂无图标';
			contentDiv.appendChild(emptyDiv);
			return;
		}
		
		var items = data.items;
		
		// 设置当前搜索库（在整个加载过程中保持）
		sidebar.setCurrentSearchEntryLibrary('icons', 'icons');
		
		// 跟踪加载完成的数量
		var loadedCount = 0;
		var totalCount = items.length;
		
		// 加载每个素材
		for (var i = 0; i < items.length; i++)
		{
			(mxUtils.bind(this, function(item)
			{
				if (item.type === 'svg' || item.format === 'svg')
				{
					// 加载 SVG
					MaterialLoader.loadSvg(item, mxUtils.bind(this, function(entry)
					{
						if (entry && entry.data)
						{
							// 确保搜索库设置仍然有效
							sidebar.setCurrentSearchEntryLibrary('icons', 'icons');
							
							// 确保 entry 有 tags，否则 addEntries 不会添加
							if (!entry.tags || entry.tags.trim() === '')
							{
								entry.tags = entry.title || item.id || 'icon';
							}
							
							if (window.console)
							{
								// console.log('[Icons Library API] 添加条目:', {
								// 	title: entry.title,
								// 	tags: entry.tags,
								// 	hasData: !!entry.data
								// });
							}
							
							sidebar.addEntries([entry]);
							
							// 创建模板并添加到内容区
							// 使用 convertDataUri 移除 data URI 中的分号（避免 style 字符串解析错误）
							var imageData = entry.data;
							
							// 如果是 data URI，确保格式正确并使用 convertDataUri
							if (imageData.substring(0, 5) === 'data:')
							{
								// 确保 data URI 包含完整的数据部分
								var commaIndex = imageData.indexOf(',');
								if (commaIndex === -1)
								{
									// 如果没有逗号，说明格式不正确，跳过
									if (window.console)
									{
										console.error('[Icons Library API] Invalid data URI format (missing comma):', imageData.substring(0, 50));
									}
									return;
								}
								
								// 使用 convertDataUri 移除分号，避免 style 字符串解析错误
								// convertDataUri 会将 data:image/svg+xml;base64,... 转换为 data:image/svg+xml,...
								if (editorUi && editorUi.convertDataUri)
								{
									try
									{
										imageData = editorUi.convertDataUri(imageData);
										// 验证转换后的结果仍然包含逗号
										if (imageData.indexOf(',') === -1)
										{
											if (window.console)
											{
												console.error('[Icons Library API] convertDataUri returned invalid result:', imageData.substring(0, 50));
											}
											return;
										}
									}
									catch (e)
									{
										if (window.console)
										{
											console.error('[Icons Library API] Error in convertDataUri:', e);
										}
										return;
									}
								}
								else
								{
									// 如果没有 convertDataUri，手动移除分号
									var semiIndex = imageData.indexOf(';');
									if (semiIndex > 0 && commaIndex > semiIndex)
									{
										imageData = imageData.substring(0, semiIndex) + imageData.substring(commaIndex);
									}
								}
							}
							
							var template = sidebar.createVertexTemplate(
								'shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=' + imageData,
								entry.w,
								entry.h,
								'',
								entry.title,
								true
							);
							
							if (template)
							{
								contentDiv.appendChild(template);
							}
							
							// 更新加载计数
							loadedCount++;
							if (loadedCount >= totalCount)
							{
								// 所有项加载完成后才清除搜索库设置
								sidebar.setCurrentSearchEntryLibrary();
								
								// 不需要更新高度，CSS已设置固定高度
							}
						}
						else
						{
							loadedCount++;
							if (loadedCount >= totalCount)
							{
								sidebar.setCurrentSearchEntryLibrary();
							}
						}
					}));
				}
				else if (item.type === 'xml' || item.format === 'stencil')
				{
					// 加载 XML stencil
					MaterialLoader.loadXmlStencil(item, data.categoryId, mxUtils.bind(this, function(template)
					{
						if (template && template.nodeType)
						{
							contentDiv.appendChild(template);
						}
						
						// 更新加载计数
						loadedCount++;
						if (loadedCount >= totalCount)
						{
							sidebar.setCurrentSearchEntryLibrary();
							
							// 不需要更新高度，CSS已设置固定高度
						}
					}));
				}
				else
				{
					// 未知类型，也计数
					loadedCount++;
					if (loadedCount >= totalCount)
					{
						sidebar.setCurrentSearchEntryLibrary();
						
						// 延迟更新滚动容器高度
						setTimeout(function()
						{
							if (window.geIconsLibraryScrollContainer)
							{
								var scrollHeight = window.geIconsLibraryScrollContainer.scrollHeight;
								var availableHeight = sidebar.container ? sidebar.container.clientHeight : window.innerHeight;
								var maxHeight = Math.max(400, availableHeight - 100);
								window.geIconsLibraryScrollContainer.style.setProperty('max-height', Math.min(scrollHeight + 50, maxHeight) + 'px', 'important');
							}
						}, 100);
					}
				}
			}))(items[i]);
		}
		
		// 如果没有需要加载的项，立即清除搜索库设置
		if (totalCount === 0)
		{
			sidebar.setCurrentSearchEntryLibrary();
		}
	}
	
	// ========== 搜索功能 ==========
	var searchTerm = '';
	var searchResults = [];
	
	/**
	 * 执行搜索
	 */
	function performSearch(term)
	{
		searchTerm = term.toLowerCase();
		searchResults = [];
		
		if (!term || term.length === 0)
		{
			// 清除搜索，显示所有分类
			updateSearchResults();
			return;
		}
		
		// 遍历所有已加载的分类，搜索匹配的素材
		// 注意：这里需要从搜索索引中查找，实际的搜索功能由 sidebar 的搜索系统处理
		updateSearchResults();
	}
	
	/**
	 * 更新搜索结果
	 */
	function updateSearchResults()
	{
		// 实际的搜索过滤由 sidebar 的搜索系统处理
		// 这里只需要触发搜索更新
		if (sidebar.updateSearchResults)
		{
			sidebar.updateSearchResults(searchTerm);
		}
	}
	
	// ========== 主入口 ==========
	
	/**
	 * 初始化图标库
	 */
	function initMaterialLibrary()
	{
		// 移除现有调色板
		if (sidebar.palettes['icons'])
		{
			sidebar.removePalette('icons');
		}
		
		// 创建调色板
		sidebar.addPalette('icons', '图标库', true, function(content)
		{
			// 注入CSS样式以支持滚动
			if (!document.getElementById('geIconsLibraryScrollStyle'))
			{
				var style = document.createElement('style');
				style.id = 'geIconsLibraryScrollStyle';
				style.textContent = 
					'.geIconsLibraryScrollContainer { ' +
					'	overflow-y: auto !important; ' +
					'	overflow-x: hidden !important; ' +
					'	max-height: 600px !important; ' +
					'	height: auto !important; ' +
					'	-webkit-overflow-scrolling: touch !important; ' +
					'	min-height: 200px !important; ' +
					'} ' +
					'#geIconsPalette .geSidebar { ' +
					'	overflow: visible !important; ' +
					'} ' +
					'#geIconsPalette { ' +
					'	overflow: visible !important; ' +
					'}';
				document.head.appendChild(style);
			}
			
			// 为content添加ID以便CSS选择器使用
			if (content.id === '')
			{
				content.id = 'geIconsPalette';
			}
			
			// 覆盖 .geSidebar 的 overflow: hidden 样式
			content.style.setProperty('overflow', 'visible', 'important');
			content.style.setProperty('overflow-y', 'visible', 'important');
			content.style.setProperty('overflow-x', 'visible', 'important');
			
			// 创建一个内部滚动容器
			var scrollContainer = document.createElement('div');
			scrollContainer.className = 'geIconsLibraryScrollContainer';
			// CSS 已经设置了样式，这里只设置必要的属性
			scrollContainer.style.position = 'relative';
			
			// 添加搜索框容器（固定在顶部）
			var searchContainer = document.createElement('div');
			searchContainer.style.position = 'sticky';
			searchContainer.style.top = '0';
			searchContainer.style.backgroundColor = 'var(--geBackgroundColor, #fff)';
			searchContainer.style.zIndex = '10';
			searchContainer.style.borderBottom = '1px solid var(--gePrimaryBorderColor, #e0e0e0)';
			
			// 添加搜索框
			var searchDiv = document.createElement('div');
			searchDiv.style.padding = '10px';
			
			var searchInput = document.createElement('input');
			searchInput.type = 'text';
			searchInput.placeholder = mxResources.get('search') || '搜索图标...';
			searchInput.style.width = '100%';
			searchInput.style.padding = '5px';
			searchInput.style.boxSizing = 'border-box';
			searchInput.style.border = '1px solid var(--gePrimaryBorderColor, #e0e0e0)';
			searchInput.style.borderRadius = '3px';
			
			var searchHandler = function()
			{
				performSearch(searchInput.value);
			};
			
			mxEvent.addListener(searchInput, 'input', searchHandler);
			mxEvent.addListener(searchInput, 'keypress', function(e)
			{
				if (e.keyCode == 13)
				{
					searchHandler();
				}
			});
			
			searchDiv.appendChild(searchInput);
			searchContainer.appendChild(searchDiv);
			scrollContainer.appendChild(searchContainer);
			
			// 加载分类列表
			var loadingDiv = document.createElement('div');
			loadingDiv.style.padding = '10px';
			loadingDiv.style.textAlign = 'center';
			loadingDiv.style.color = '#999';
			loadingDiv.textContent = mxResources.get('loading') || '加载中...';
			scrollContainer.appendChild(loadingDiv);
			
			ApiClient.getLibraries(mxUtils.bind(this, function(libraries)
			{
				// 移除加载提示
				if (loadingDiv.parentNode)
				{
					loadingDiv.parentNode.removeChild(loadingDiv);
				}
				
				if (!libraries || libraries.length === 0)
				{
					var emptyDiv = document.createElement('div');
					emptyDiv.style.padding = '10px';
					emptyDiv.style.textAlign = 'center';
					emptyDiv.style.color = '#999';
					emptyDiv.textContent = '暂无图标库';
					scrollContainer.appendChild(emptyDiv);
					content.appendChild(scrollContainer);
					return;
				}
				
				// 保存分类数据
				for (var i = 0; i < libraries.length; i++)
				{
					categoryData[libraries[i].id] = libraries[i];
				}
				
				// 按 order 排序
				libraries.sort(function(a, b)
				{
					return (a.order || 999) - (b.order || 999);
				});
				
				// 创建分类面板
				for (var i = 0; i < libraries.length; i++)
				{
					var category = libraries[i];
					
					var categoryTitle = sidebar.createTitle(category.title || category.id);
					var categoryDiv = document.createElement('div');
					categoryDiv.className = 'geSidebar';
					categoryDiv.style.display = 'none';
					// 允许分类内容区域滚动（覆盖 .geSidebar 的 overflow: hidden）
					categoryDiv.style.overflowY = 'auto';
					categoryDiv.style.overflowX = 'hidden';
					categoryDiv.style.maxHeight = '400px'; // 限制分类内容区域的最大高度
					categoryDiv.style.overflow = 'auto'; // 确保可以滚动
					categoryDiv.style.position = 'relative'; // 确保定位正确
					
					// 添加折叠处理
					sidebar.addFoldingHandler(categoryTitle, categoryDiv, function(catId, catInfo)
					{
						return function(content)
						{
							loadCategoryItems(catId, catInfo, content);
						};
					}(category.id, category));
					
					var categoryOuter = document.createElement('div');
					categoryOuter.appendChild(categoryTitle);
					categoryOuter.appendChild(categoryDiv);
					scrollContainer.appendChild(categoryOuter);
				}
				
				// 将滚动容器添加到内容区域
				content.appendChild(scrollContainer);
				
				// 保存 scrollContainer 的引用，以便后续更新
				window.geIconsLibraryScrollContainer = scrollContainer;
				
				// CSS 已经设置了固定高度，不需要动态更新
				// 只需要确保 overflow-y 始终是 auto
				scrollContainer.style.setProperty('overflow-y', 'auto', 'important');
				
				// 预加载常用分类
				if (config.preload.enabled)
				{
					setTimeout(function()
					{
						for (var i = 0; i < libraries.length; i++)
						{
							var category = libraries[i];
							if (category.preload)
							{
								// 后台预加载
								var tempDiv = document.createElement('div');
								tempDiv.style.display = 'none';
								loadCategoryItems(category.id, category, tempDiv);
							}
						}
					}, config.preload.delay);
				}
			}), mxUtils.bind(this, function(error)
			{
				// 移除加载提示
				if (loadingDiv.parentNode)
				{
					loadingDiv.parentNode.removeChild(loadingDiv);
				}
				
				// 显示错误信息
				var errorDiv = document.createElement('div');
				errorDiv.style.padding = '10px';
				errorDiv.style.textAlign = 'center';
				errorDiv.style.color = '#f00';
				errorDiv.textContent = (mxResources.get('error') || '错误') + ': ' + (error.message || '加载失败');
				scrollContainer.appendChild(errorDiv);
				content.appendChild(scrollContainer);
			}));
		});
	}
	
	// 初始化
	initMaterialLibrary();
	
	// 处理侧边栏重新初始化
	var originalInit = sidebar.init;
	sidebar.init = function()
	{
		originalInit.apply(this, arguments);
		initMaterialLibrary();
	};
	
	// 导出配置和工具函数（可选，用于调试）
	if (window.console)
	{
		window.iconsLibraryApi = {
			config: config,
			cache: CacheManager,
			api: ApiClient,
			reload: initMaterialLibrary
		};
		console.log('[Icons Library API] Plugin loaded');
	}
});

