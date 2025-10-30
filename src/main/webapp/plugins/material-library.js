/**
 * Material Library Plugin - Subject-based Material Library
 * Provides categorized material library similar to BioRender
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
	
	// Material library categories structure
	var materialCategories = {
		'生物学': {
			id: 'biology',
			subcategories: {
				'细胞': ['cell', 'nucleus', 'mitochondria', 'ribosome'],
				'DNA/RNA': ['dna', 'rna', 'helix', 'strand'],
				'蛋白质': ['protein', 'enzyme', 'antibody'],
				'分子': ['molecule', 'compound', 'atom'],
				'组织': ['tissue', 'organ', 'muscle']
			}
		},
		'化学': {
			id: 'chemistry',
			subcategories: {
				'元素': ['element', 'periodic'],
				'化合物': ['compound', 'molecule'],
				'反应': ['reaction', 'arrow', 'equilibrium'],
				'实验设备': ['beaker', 'flask', 'test-tube', 'bunsen']
			}
		},
		'物理学': {
			id: 'physics',
			subcategories: {
				'力学': ['force', 'momentum', 'friction'],
				'电磁学': ['magnet', 'circuit', 'field'],
				'光学': ['light', 'lens', 'mirror'],
				'原子物理': ['atom', 'electron', 'proton']
			}
		},
		'医学': {
			id: 'medicine',
			subcategories: {
				'人体系统': ['cardiovascular', 'respiratory', 'nervous'],
				'器官': ['heart', 'lung', 'brain', 'liver'],
				'疾病': ['virus', 'bacteria', 'cell-damage'],
				'医疗设备': ['syringe', 'stethoscope', 'x-ray']
			}
		},
		'数学': {
			id: 'mathematics',
			subcategories: {
				'几何': ['circle', 'triangle', 'square', 'polygon'],
				'函数': ['graph', 'function', 'curve'],
				'符号': ['symbol', 'operator', 'equation'],
				'图表': ['chart', 'graph', 'diagram']
			}
		}
	};
	
	// Material data structure
	// In a real implementation, this would be loaded from XML/JSON files or API
	var materialData = {
		// Placeholder - in real implementation, materials would be loaded from files
		'cell': {
			name: 'Cell',
			icon: 'shape=image;image=' + (GRAPH_IMAGE_PATH || '') + '/shapes/bio/cell.png',
			width: 100,
			height: 100,
			tags: 'cell biology'
		},
		'nucleus': {
			name: 'Nucleus',
			icon: 'shape=ellipse;fillColor=#ffcccc;strokeColor=#000000',
			width: 60,
			height: 60,
			tags: 'cell nucleus biology'
		}
		// More materials would be defined here or loaded from external sources
	};
	
	/**
	 * Creates a material entry template
	 */
	function createMaterialEntry(materialId, materialInfo)
	{
		return sidebar.createVertexTemplateEntry(
			materialInfo.icon || 'shape=rect;fillColor=#ffffff;strokeColor=#000000',
			materialInfo.width || 100,
			materialInfo.height || 100,
			'',
			materialInfo.name || materialId,
			true,
			null,
			materialInfo.tags || materialId
		);
	}
	
	/**
	 * Adds a category to the sidebar
	 */
	function addCategory(categoryName, categoryData, parentContent)
	{
		var categoryId = categoryData.id || categoryName.toLowerCase().replace(/\s+/g, '_');
		
		// Create category title (collapsible)
		var categoryTitle = sidebar.createTitle(categoryName);
		var categoryDiv = document.createElement('div');
		categoryDiv.className = 'geSidebar';
		categoryDiv.style.display = 'none';
		
		// Add folding handler
		sidebar.addFoldingHandler(categoryTitle, categoryDiv, function(content)
		{
			// Add subcategories
			if (categoryData.subcategories)
			{
				var subcategoryKeys = Object.keys(categoryData.subcategories);
				
				for (var i = 0; i < subcategoryKeys.length; i++)
				{
					var subcategoryName = subcategoryKeys[i];
					var materialIds = categoryData.subcategories[subcategoryName];
					
					// Create subcategory section
					var subcategoryTitle = sidebar.createTitle(subcategoryName);
					var subcategoryDiv = document.createElement('div');
					subcategoryDiv.className = 'geSidebar';
					subcategoryDiv.style.display = 'none';
					
					// Add folding handler for subcategory
					sidebar.addFoldingHandler(subcategoryTitle, subcategoryDiv, function(subContent)
					{
						// Add materials
						for (var j = 0; j < materialIds.length; j++)
						{
							var materialId = materialIds[j];
							var materialInfo = materialData[materialId];
							
							if (materialInfo)
							{
								var entry = createMaterialEntry(materialId, materialInfo);
								subContent.appendChild(entry(subContent));
							}
							else
							{
								// Create placeholder entry if material not found
								var placeholder = sidebar.createVertexTemplateEntry(
									'shape=rect;fillColor=#e0e0e0;strokeColor=#000000;dashed=1',
									80,
									80,
									'',
									materialId,
									true
								);
								subContent.appendChild(placeholder(subContent));
							}
						}
					});
					
					var subcategoryOuter = document.createElement('div');
					subcategoryOuter.appendChild(subcategoryTitle);
					subcategoryOuter.appendChild(subcategoryDiv);
					content.appendChild(subcategoryOuter);
				}
			}
			
			// If no subcategories, add materials directly
			if (!categoryData.subcategories || Object.keys(categoryData.subcategories).length === 0)
			{
				// Add materials from category data
				var allMaterials = categoryData.materials || [];
				for (var k = 0; k < allMaterials.length; k++)
				{
					var materialId = allMaterials[k];
					var materialInfo = materialData[materialId];
					
					if (materialInfo)
					{
						var entry = createMaterialEntry(materialId, materialInfo);
						content.appendChild(entry(content));
					}
				}
			}
		});
		
		var categoryOuter = document.createElement('div');
		categoryOuter.appendChild(categoryTitle);
		categoryOuter.appendChild(categoryDiv);
		
		if (parentContent)
		{
			parentContent.appendChild(categoryOuter);
		}
		
		return categoryOuter;
	}
	
	/**
	 * Loads material data from external source
	 */
	function loadMaterialData(source, callback)
	{
		// This function can load from XML, JSON, or API
		// For now, use placeholder data
		if (callback)
		{
			callback(materialData);
		}
	}
	
	/**
	 * Adds material library palette to sidebar
	 */
	function addMaterialLibraryPalette()
	{
		// Remove existing palette if it exists
		if (sidebar.palettes['materialLibrary'])
		{
			sidebar.removePalette('materialLibrary');
		}
		
		if (window.console)
		{
			console.log('[Material Library Plugin] Creating palette');
		}
		
		sidebar.addPalette('materialLibrary', '素材库', false, function(content)
		{
			// Add search box (optional)
			var searchDiv = document.createElement('div');
			searchDiv.style.padding = '10px';
			searchDiv.style.borderBottom = '1px solid #e0e0e0';
			
			var searchInput = document.createElement('input');
			searchInput.type = 'text';
			searchInput.placeholder = '搜索素材...';
			searchInput.style.width = '100%';
			searchInput.style.padding = '5px';
			searchInput.style.boxSizing = 'border-box';
			
			// Search functionality (simplified)
			var searchHandler = function()
			{
				var searchTerm = searchInput.value.toLowerCase();
				// Filter materials based on search term
				// Implementation would filter and show matching materials
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
			content.appendChild(searchDiv);
			
			// Add categories
			var categoryKeys = Object.keys(materialCategories);
			
			for (var i = 0; i < categoryKeys.length; i++)
			{
				var categoryName = categoryKeys[i];
				var categoryData = materialCategories[categoryName];
				
				addCategory(categoryName, categoryData, content);
			}
			
			// Load material data (if needed)
			loadMaterialData(null, function(data)
			{
				// Update material data
				if (data)
				{
					materialData = data;
					// Refresh sidebar if needed
				}
			});
		});
	}
	
	// Add palette immediately
	if (window.console)
	{
		console.log('[Material Library Plugin] Adding palette to sidebar');
	}
	addMaterialLibraryPalette();
	
	// Handles reload of sidebar after dark mode change or reinit
	var originalInit = sidebar.init;
	sidebar.init = function()
	{
		originalInit.apply(this, arguments);
		if (window.console)
		{
			console.log('[Material Library Plugin] Sidebar reinit, adding palette again');
		}
		addMaterialLibraryPalette();
	};
});

