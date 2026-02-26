namespace DevTree.E2E.PageObjects;

/// <summary>
/// Page object for the main content / block editor area.
/// </summary>
public class EditorPage(IPage page)
{
    private readonly IPage _page = page;

    // ── Block-type mapping: old label → slash-command title ──────────────────────
    private static readonly Dictionary<string, string> BlockLabelToSlashTitle = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Text"] = "Paragraph",
        ["Code"] = "Code Block",
        ["Table"] = "Table",
        ["Link"] = "Link Card",
        ["Checklist"] = "Checklist",
        ["Image"] = "Image",
        ["Video"] = "Video",
        ["Audio"] = "Audio",
        ["Diagram"] = "Canvas",
        ["Whiteboard"] = "Canvas",
        ["Canvas"] = "Canvas",
    };

    // ── Selectors ─────────────────────────────────────────────────────

    private ILocator TiptapEditor => _page.Locator(".page-editor-content").First;

    // ── Block picker via "Add block" button ─────────────────────────────────

    /// <summary>
    /// Inserts a block via the "Add block" button at the bottom of the editor.
    /// Uses the block-picker search to reliably find and click the correct item,
    /// avoiding timing problems associated with the slash-command approach.
    /// Assumes the page is already in edit mode.
    /// </summary>
    public async Task AddBlockAsync(string blockLabel)
    {
        if (!BlockLabelToSlashTitle.TryGetValue(blockLabel, out var slashTitle))
            throw new ArgumentException($"Unsupported block label: {blockLabel}", nameof(blockLabel));

        // Click the "Add block" button in the editor footer.
        var addBlockBtn = _page.GetByRole(AriaRole.Button, new() { Name = "Add block", Exact = true });
        await addBlockBtn.ClickAsync();

        // Wait for the block picker to appear.
        var picker = _page.Locator("[role='menu'][aria-label='Insert block']");
        await picker.WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 5_000 });

        // Type the full title into the search box to filter the list.
        var searchInput = picker.Locator("input[aria-label='Search block types']");
        await searchInput.FillAsync(slashTitle);
        await _page.WaitForTimeoutAsync(200);

        // Click the first matching item.
        var item = picker.Locator("button").Filter(new() { HasText = slashTitle }).First;
        await item.ClickAsync(new() { Timeout = 5_000 });
        await _page.WaitForTimeoutAsync(300);
    }

    /// <summary>
    /// No-op in the unified Tiptap editor (edit mode is page-wide, not per-block).
    /// Kept for API compatibility with existing tests.
    /// </summary>
    public Task EnterEditModeForLastBlockAsync() => Task.CompletedTask;

    /// <summary>Exits page-level edit mode by pressing Escape (or Cancel).</summary>
    public async Task ExitEditModeAsync()
    {
        await _page.Keyboard.PressAsync("Escape");
        await _page.WaitForTimeoutAsync(150);
    }


    // ── Text block ─────────────────────────────────────────────────────────

    /// <summary>Types text into the Tiptap editor (at current cursor position).</summary>
    public async Task TypeInLastTextBlockAsync(string text)
    {
        var editor = _page.Locator(".page-editor-content").Last;
        await editor.ClickAsync();
        await editor.PressSequentiallyAsync(text);
    }

    // ── Code block ─────────────────────────────────────────────────────────

    /// <summary>Returns the Monaco editor container for the last code block.</summary>
    public ILocator LastCodeEditor =>
        _page.Locator(".monaco-editor").Last;

    /// <summary>Changes the language of the last code block via the language &lt;select&gt;.</summary>
    public async Task SetCodeLanguageAsync(string language)
    {
        // CodeBlockNode renders a plain <select> element containing an <option> for each language.
        var langSelect = _page.Locator("select")
            .Filter(new() { Has = _page.Locator($"option[value='{language}']") })
            .Last;
        await langSelect.SelectOptionAsync(language);
    }

    // ── Table block ────────────────────────────────────────────────────────

    /// <summary>Fills a specific table cell (0-based row and column).</summary>
    public async Task FillTableCellAsync(int row, int col, string value)
    {
        // Table body inputs: row 0 = first body row
        var rows = _page.Locator("table tbody tr");
        var cells = rows.Nth(row).Locator("input");
        await cells.Nth(col).FillAsync(value);
    }

    /// <summary>Fills a header cell at the given column index.</summary>
    public async Task FillTableHeaderAsync(int col, string value)
    {
        var headers = _page.Locator("table thead input");
        await headers.Nth(col).FillAsync(value);
    }

    /// <summary>Clicks the "Add row" button of the last table block.</summary>
    public Task AddTableRowAsync() =>
        _page.GetByRole(AriaRole.Button, new() { Name = "Add row" }).Last.ClickAsync();

    /// <summary>Clicks the "Add column" button in the last table block header.</summary>
    public Task AddTableColumnAsync() =>
        _page.GetByRole(AriaRole.Button, new() { Name = "Add column" }).Last.ClickAsync();

    // ── Agenda block ───────────────────────────────────────────────────────

    /// <summary>Clicks the "Add item" button in the last agenda block.</summary>
    public Task AddAgendaItemAsync() =>
        _page.GetByRole(AriaRole.Button, new() { Name = "Add item" }).Last.ClickAsync();

    /// <summary>Types text into the last agenda text input.
    /// Automatically clicks "Add item" first if no item inputs exist yet.</summary>
    public async Task TypeAgendaItemAsync(string text)
    {
        // A fresh Checklist block has no item rows — click "Add item" to create one.
        await _page.GetByRole(AriaRole.Button, new() { Name = "Add item" }).Last.ClickAsync();

        var inputs = _page.Locator("input[placeholder='Item\u2026']");
        await inputs.Last.WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 5_000 });
        await inputs.Last.FillAsync(text);
    }

    /// <summary>Toggles the checkbox at the given index (0-based).</summary>
    public async Task ToggleAgendaItemAsync(int index)
    {
        var checkboxes = _page.Locator("input[type='checkbox']");
        await checkboxes.Nth(index).ClickAsync();
    }

    // ── Image block ────────────────────────────────────────────────────────

    /// <summary>Fills the URL input of the last image block. The image updates in real-time.</summary>
    public async Task SetImageUrlAsync(string url)
    {
        var urlInput = _page.GetByPlaceholder("Image URL\u2026").Last;
        await urlInput.FillAsync(url);
        await _page.WaitForTimeoutAsync(300);
    }

    // ── Video block ────────────────────────────────────────────────────────

    /// <summary>Fills the URL input of the last video block. The embed updates in real-time.</summary>
    public async Task SetVideoUrlAsync(string url)
    {
        var urlInput = _page.GetByPlaceholder("YouTube or video URL\u2026").Last;
        await urlInput.FillAsync(url);
        await _page.WaitForTimeoutAsync(500);
    }

    // ── Block controls ─────────────────────────────────────────────────────

    /// <summary>
    /// Deletes a block by index by hovering to reveal the drag handle, clicking
    /// "Block actions", and selecting "Delete block" from the dropdown menu.
    /// </summary>
    public async Task DeleteBlockAsync(int index)
    {
        var blocks = _page.Locator(".page-editor-content > *");
        var block = blocks.Nth(index);

        // Hover to reveal the drag handle (the library shows it on mouse move).
        await block.HoverAsync();
        await _page.WaitForTimeoutAsync(200);

        // Click the grip / "Block actions" button that appears in the drag handle.
        var gripBtn = _page.Locator("button[aria-label='Block actions']");
        await gripBtn.WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 4_000 });
        await gripBtn.ClickAsync();

        // Click "Delete block" in the dropdown (rendered as role="menuitem").
        var deleteBtn = _page.GetByRole(AriaRole.Menuitem, new() { Name = "Delete block" });
        await deleteBtn.WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 3_000 });
        await deleteBtn.ClickAsync();
    }

    // ── Queries ──────────────────────────────────────────────────────

    /// <summary>
    /// Returns the number of top-level block elements currently rendered by the Tiptap editor.
    /// Counts paragraph, heading, blockquote, hr, ul, ol, and custom node-view wrappers.
    /// Waits for the editor container to appear before counting (handles async Tiptap initialisation).
    /// </summary>
    public async Task<int> BlockCountAsync()
    {
        var container = _page.Locator(".page-editor-content");
        try
        {
            await container.WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 10_000 });
        }
        catch
        {
            // Container never appeared — return 0.
            return 0;
        }
        // Give Tiptap a brief moment to render content into the container.
        await _page.WaitForTimeoutAsync(500);
        return await _page.Locator(".page-editor-content > *").CountAsync();
    }

    // ── Link Card block ────────────────────────────────────────────────────────

    /// <summary>Fills the URL input of the last link card block.</summary>
    public async Task SetLinkCardUrlAsync(string url)
    {
        var urlInput = _page.GetByPlaceholder("URL\u2026").Last;
        await urlInput.FillAsync(url);
        await _page.WaitForTimeoutAsync(300);
    }

    // ── Audio block ────────────────────────────────────────────────────────────

    /// <summary>Fills the URL input of the last audio block.</summary>
    public async Task SetAudioUrlAsync(string url)
    {
        var urlInput = _page.GetByPlaceholder("Audio URL (mp3, ogg, etc.)\u2026").Last;
        await urlInput.FillAsync(url);
        await _page.WaitForTimeoutAsync(300);
    }

    // ── Toolbar helpers ────────────────────────────────────────────────────────

    /// <summary>Returns the formatting toolbar container (only visible in edit mode).</summary>
    public ILocator Toolbar =>
        _page.Locator("button[title='Bold (Ctrl+B)']").Locator("xpath=ancestor::div[contains(@class,'border-b')]").First;

    /// <summary>Clicks a toolbar button by its exact title attribute value.</summary>
    public async Task ClickToolbarButtonAsync(string title)
    {
        var btn = _page.Locator($"button[title='{title}']").First;
        await btn.WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 5_000 });
        await btn.ClickAsync();
        await _page.WaitForTimeoutAsync(150);
    }

    /// <summary>Returns true when the Bold toolbar button is visible (i.e. the toolbar is rendered).</summary>
    public Task<bool> IsToolbarVisibleAsync() =>
        _page.Locator("button[title='Bold (Ctrl+B)']").First.IsVisibleAsync();
}
