Draw.loadPlugin(function(ui)
{
	window.editorUi = ui;
	if (window.console && console.log)
	{
		console.log('[ExposeEditorUi] editorUi instance registered');
	}
});

