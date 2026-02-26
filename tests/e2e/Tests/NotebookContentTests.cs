using System.Text.RegularExpressions;

namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for notebook page content — the main editing and viewing area.
///
/// Coverage areas:
///   - Page rendering in view mode (title, blocks, controls)
///   - Edit-mode toggle (Edit → Save → back to view)
///   - Editor toolbar visibility and formatting (Bold, Italic, Heading)
///   - Content persistence across save + reload for all major block types
///   - Export Markdown button presence
///   - Link Card block (insert, URL input, rendered card)
///   - Audio block (insert, URL input, audio player element)
///   - Keyboard shortcut Ctrl+S to save
///   - Block actions drag-handle menu (visible, Delete option present)
/// </summary>
[TestFixture]
[Category("NotebookContent")]
public class NotebookContentTests : E2ETestBase
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Creates a fresh page and returns its sidebar title.
    /// <see cref="SidebarPage.CreatePageAsync"/> now handles the full lifecycle:
    /// waits for the server ID assignment, clicks the sidebar item to navigate
    /// to the page in view mode, and waits for the "Edit page" button before returning.
    /// </summary>
    private async Task<string> CreateAndOpenNewPageAsync()
    {
        var created = await App.Sidebar.CreatePageAsync();
        return (await created.InnerTextAsync()).Trim();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 1. PAGE RENDERING — VIEW MODE
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task ReadMode_ShowsPageTitle()
    {
        // Open the well-known React Hooks seed page and verify the title is displayed.
        await App.Sidebar.SelectPageAsync("React Hooks");

        // PageTitle renders an <h1> with text-3xl class inside the main content area.
        // Scope to <main> so we don't accidentally match the sidebar "Learning Tree" <h1>.
        var heading = Page.Locator("main h1").First;
        await Expect(heading).ToContainTextAsync("React Hooks");
    }

    [Test]
    public async Task ReadMode_ShowsPageEditorContent()
    {
        // A page with existing blocks should render at least one editor child.
        await App.Sidebar.SelectPageAsync("React Hooks");

        // Wait for the Tiptap editor to be present in the DOM.
        var editorContent = Page.Locator(".page-editor-content");
        await Expect(editorContent.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    [Test]
    public async Task ReadMode_AddBlockButton_IsNotVisible()
    {
        // "Add block" appears only in edit mode.
        await App.Sidebar.SelectPageAsync("React Hooks");

        var addBlockBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Add block", Exact = true });
        await Expect(addBlockBtn).Not.ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    [Test]
    public async Task ReadMode_EditPageButton_IsVisible()
    {
        // Use the well-known seed page so we start directly in view mode.
        await App.Sidebar.SelectPageAsync("React Hooks");

        var editBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Edit page", Exact = true });
        await Expect(editBtn).ToBeVisibleAsync();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 2. EDIT MODE TOGGLE
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task EditMode_EnteringEditMode_ShowsSaveButton()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        var saveBtn = Page.GetByTestId("save-page-button");
        await Expect(saveBtn).ToBeVisibleAsync();
    }

    [Test]
    public async Task EditMode_EnteringEditMode_HidesEditButton()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        var editBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Edit page", Exact = true });
        await Expect(editBtn).Not.ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    [Test]
    public async Task EditMode_TitleInput_IsEditable()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        // PageTitle switches from <h1> to <input> when editing.
        var titleInput = Page.GetByLabel("Page title");
        await Expect(titleInput).ToBeVisibleAsync();
        await Expect(titleInput).ToBeEditableAsync();
    }

    [Test]
    public async Task EditMode_AddBlockButton_IsVisible()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        var addBlockBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Add block", Exact = true });
        await Expect(addBlockBtn).ToBeVisibleAsync();
    }

    [Test]
    public async Task EditMode_CancelButton_ReturnsToViewMode()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        var cancelBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Cancel editing" });
        await Expect(cancelBtn).ToBeVisibleAsync();
        await cancelBtn.ClickAsync();

        // When a new page has dirty state (Tiptap normalizes empty doc → isDirty),
        // canceling triggers UnsavedChangesDialog — click "Leave without saving".
        var leaveBtn = Page.GetByTestId("unsaved-leave-without-saving");
        try
        {
            await leaveBtn.WaitForAsync(new() { Timeout = 1_500, State = WaitForSelectorState.Visible });
            await leaveBtn.ClickAsync();
        }
        catch (TimeoutException) { /* dialog didn't appear — page was clean */ }

        // After cancel (with or without dialog), the Edit button should reappear.
        var editBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Edit page", Exact = true });
        await Expect(editBtn).ToBeVisibleAsync(new() { Timeout = 8_000 });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3. EDITOR TOOLBAR
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task EditorToolbar_IsVisible_InEditMode()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        // Add a text block so Tiptap fully initialises and exposes the editor toolbar.
        await App.Editor.AddBlockAsync("Text");

        // The Bold button serves as a reliable proxy for the toolbar being rendered.
        var boldBtn = Page.Locator("button[title='Bold (Ctrl+B)']").First;
        await Expect(boldBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task EditorToolbar_IsNotVisible_InViewMode()
    {
        await App.Sidebar.SelectPageAsync("React Hooks");

        // In view mode (isEditMode=false) EditorToolbar is not rendered at all.
        var boldBtn = Page.Locator("button[title='Bold (Ctrl+B)']").First;
        await Expect(boldBtn).Not.ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    [Test]
    public async Task EditorToolbar_Bold_MakesSelectionBold()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("BoldMe");

        // Ensure the editor has focus, then select all text.
        // On macOS, Tiptap's select-all shortcut is Meta+A (Cmd+A).
        var editor = Page.Locator(".page-editor-content").Last;
        await editor.ClickAsync();
        await Page.Keyboard.PressAsync("Meta+A");
        await App.Editor.ClickToolbarButtonAsync("Bold (Ctrl+B)");

        // Tiptap wraps the selection in <strong>.
        var strong = Page.Locator(".page-editor-content strong").Last;
        await Expect(strong).ToBeVisibleAsync(new() { Timeout = 5_000 });
        await Expect(strong).ToContainTextAsync("BoldMe");
    }

    [Test]
    public async Task EditorToolbar_Italic_MakesSelectionItalic()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("ItalicMe");

        // Ensure the editor has focus, then select all text.
        // On macOS, Tiptap's select-all shortcut is Meta+A (Cmd+A).
        var editor = Page.Locator(".page-editor-content").Last;
        await editor.ClickAsync();
        await Page.Keyboard.PressAsync("Meta+A");
        await App.Editor.ClickToolbarButtonAsync("Italic (Ctrl+I)");

        var em = Page.Locator(".page-editor-content em").Last;
        await Expect(em).ToBeVisibleAsync(new() { Timeout = 5_000 });
        await Expect(em).ToContainTextAsync("ItalicMe");
    }

    [Test]
    public async Task EditorToolbar_Heading2_AppliesH2()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("My Heading");

        // Click somewhere in the block first to focus it, then apply Heading 2.
        var proseMirror = Page.Locator(".page-editor-content").Last;
        await proseMirror.ClickAsync();
        await App.Editor.ClickToolbarButtonAsync("Heading 2");

        var h2 = Page.Locator(".page-editor-content h2").Last;
        await Expect(h2).ToBeVisibleAsync(new() { Timeout = 3_000 });
        await Expect(h2).ToContainTextAsync("My Heading");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 4. CONTENT PERSISTENCE
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task TextContent_PersistsAfterSaveAndReload()
    {
        var pageTitle = await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("Persistent text content");
        await App.SaveAsync();

        // Reload and navigate back to the same page.
        await App.GotoAsync();
        await App.Sidebar.SelectPageAsync(pageTitle);

        var content = Page.Locator(".page-editor-content");
        await Expect(content.First).ToContainTextAsync("Persistent text content");
    }

    [Test]
    public async Task CodeContent_PersistsAfterSaveAndReload()
    {
        var pageTitle = await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Code");

        // Set language to TypeScript.
        await App.Editor.SetCodeLanguageAsync("typescript");
        await App.SaveAsync();

        await App.GotoAsync();
        await App.Sidebar.SelectPageAsync(pageTitle);

        // Re-enter edit mode: the language <select> is only rendered when the
        // editor is editable (isEditable=true). In view mode a plain <span> is shown.
        await App.EnterPageEditModeAsync();
        var langSelect = Page.Locator("select")
            .Filter(new() { Has = Page.Locator("option[value='typescript']") })
            .Last;
        await Expect(langSelect).ToHaveValueAsync("typescript", new() { Timeout = 8_000 });
    }

    [Test]
    public async Task TableContent_PersistsAfterSaveAndReload()
    {
        var pageTitle = await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Table");
        await App.Editor.FillTableHeaderAsync(0, "Name");
        await App.Editor.FillTableCellAsync(0, 0, "Alice");
        await App.SaveAsync();

        await App.GotoAsync();
        await App.Sidebar.SelectPageAsync(pageTitle);

        // Re-enter edit mode so the inputs are rendered again.
        await App.EnterPageEditModeAsync();
        var headerInput = Page.Locator("table thead input").First;
        await Expect(headerInput).ToHaveValueAsync("Name");
        var cellInput = Page.Locator("table tbody tr").First.Locator("input").First;
        await Expect(cellInput).ToHaveValueAsync("Alice");
    }

    [Test]
    public async Task ChecklistContent_PersistsAfterSaveAndReload()
    {
        var pageTitle = await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Checklist");
        await App.Editor.TypeAgendaItemAsync("Learn Playwright");
        await App.SaveAsync();

        await App.GotoAsync();
        await App.Sidebar.SelectPageAsync(pageTitle);

        // Re-enter edit mode to reveal the inputs.
        await App.EnterPageEditModeAsync();
        var itemInput = Page.Locator("input[placeholder='Item\u2026']").Last;
        await Expect(itemInput).ToHaveValueAsync("Learn Playwright");
    }

    [Test]
    public async Task PageTitle_PersistsAfterSaveAndReload()
    {
        var pageTitle = await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        const string newTitle = "Persisted Title E2E";
        var titleInput = Page.GetByLabel("Page title");
        await titleInput.ClickAsync();
        await titleInput.FillAsync(newTitle);
        await App.SaveAsync();

        // Reload - the page should still be navigable by the new title.
        await App.GotoAsync();
        await App.Sidebar.SelectPageAsync(newTitle);

        var heading = Page.Locator("main h1").First;
        await Expect(heading).ToContainTextAsync(newTitle);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 5. EXPORT MARKDOWN
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task ExportMarkdown_Button_IsVisibleInViewMode()
    {
        await App.Sidebar.SelectPageAsync("React Hooks");

        // Wait for the page to fully load (Edit page button confirms {page} is truthy).
        var editBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Edit page", Exact = true });
        await Expect(editBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });

        // The export button renders with aria-label="Export MD" and title="Export MD".
        var exportBtn = Page.GetByTestId("export-markdown-button");
        await Expect(exportBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task ExportMarkdown_Button_IsVisibleInEditMode()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        // In edit mode the export button is also in the header (always visible when page != null).
        var exportBtn = Page.GetByTestId("export-markdown-button");
        await Expect(exportBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 6. LINK CARD BLOCK
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task AddLinkCardBlock_ShowsUrlInput()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Link");

        // Link card edit mode shows a URL input and a label input.
        var urlInput = Page.GetByPlaceholder("URL\u2026").Last;
        await Expect(urlInput).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task AddLinkCardBlock_ShowsLabelInput()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Link");

        var labelInput = Page.GetByPlaceholder("Label (optional)\u2026").Last;
        await Expect(labelInput).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task AddLinkCardBlock_RendersCardAfterUrlSet()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Link");
        await App.Editor.SetLinkCardUrlAsync("https://github.com");

        // Save to exit edit mode; in view mode the card renders as an <a>.
        await App.SaveAsync();

        var link = Page.Locator("a[href='https://github.com']").Last;
        await Expect(link).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task AddLinkCardBlock_RenderedCard_HasSecureAttributes()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Link");
        await App.Editor.SetLinkCardUrlAsync("https://example.com");
        await App.SaveAsync();

        var link = Page.Locator("a[href='https://example.com']").Last;
        await Expect(link).ToHaveAttributeAsync("target", "_blank");
        await Expect(link).ToHaveAttributeAsync("rel", new Regex("noopener"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 7. AUDIO BLOCK
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task AddAudioBlock_ShowsUrlInput()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Audio");

        var urlInput = Page.GetByPlaceholder("Audio URL (mp3, ogg, etc.)\u2026").Last;
        await Expect(urlInput).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task AddAudioBlock_ShowsEmptyStatePlaceholder()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Audio");

        // Without a URL, the block shows a dashed placeholder.
        var placeholder = Page.GetByText("Enter an audio URL above").Last;
        await Expect(placeholder).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task AddAudioBlock_RendersAudioPlayerAfterUrlSet()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Audio");

        const string audioUrl =
            "https://upload.wikimedia.org/wikipedia/commons/f/f6/Goose_Canada_Sound.ogg";
        await App.Editor.SetAudioUrlAsync(audioUrl);

        // Once a URL is entered, Tiptap renders an <audio> element.
        var audioEl = Page.Locator("audio").Last;
        await Expect(audioEl).ToBeVisibleAsync(new() { Timeout = 5_000 });
        await Expect(audioEl).ToHaveAttributeAsync("src", audioUrl);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 8. KEYBOARD SHORTCUTS
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task KeyboardShortcut_CtrlS_SavesPage()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("Keyboard save test");

        // Verify dirty state — Save button is enabled.
        await Expect(Page.GetByTestId("save-page-button")).ToBeEnabledAsync();

        // Trigger Ctrl+S (or Cmd+S on macOS — Playwright handles both with Control+s on macOS too).
        await Page.Keyboard.PressAsync("Meta+s");
        // Fallback: if Meta+s doesn't work in the test environment, try Control+s.

        // Success: Edit button returns (view mode re-appears).
        var editBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Edit page", Exact = true });
        await Expect(editBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 9. BLOCK ACTIONS MENU
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task BlockActionsMenu_GripButton_IsVisibleOnHover()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");

        // Hover the block to reveal the drag handle.
        var block = Page.Locator(".page-editor-content > *").Last;
        await block.HoverAsync();
        await Page.WaitForTimeoutAsync(200);

        var gripBtn = Page.Locator("button[aria-label='Block actions']");
        await Expect(gripBtn).ToBeVisibleAsync(new() { Timeout = 4_000 });
    }

    [Test]
    public async Task BlockActionsMenu_Contains_DeleteOption()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");

        // Open the block actions menu using the editor page helper.
        var count = await App.Editor.BlockCountAsync();
        // Hover to reveal grip handle.
        var block = Page.Locator(".page-editor-content > *").Nth(count - 1);
        await block.HoverAsync();
        await Page.WaitForTimeoutAsync(200);

        var gripBtn = Page.Locator("button[aria-label='Block actions']");
        await gripBtn.WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 4_000 });
        await gripBtn.ClickAsync();

        // The dropdown menu should contain "Delete block".
        var deleteItem = Page.GetByRole(AriaRole.Menuitem, new() { Name = "Delete block" });
        await Expect(deleteItem).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    [Test]
    public async Task BlockActionsMenu_DeleteBlock_RemovesBlock()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        var countBefore = await App.Editor.BlockCountAsync();

        await App.Editor.DeleteBlockAsync(countBefore - 1);

        var countAfter = await App.Editor.BlockCountAsync();
        Assert.That(countAfter, Is.EqualTo(countBefore - 1));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 10. MULTIPLE BLOCK TYPES ON ONE PAGE
    // ══════════════════════════════════════════════════════════════════════════

    [Test]
    public async Task MultipleBlockTypes_AllRenderOnSamePage()
    {
        await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("Text block content");

        await App.Editor.AddBlockAsync("Code");
        await App.Editor.AddBlockAsync("Image");

        var blockCount = await App.Editor.BlockCountAsync();
        Assert.That(blockCount, Is.GreaterThanOrEqualTo(3),
            "Page should have at least 3 blocks after adding Text, Code, and Image.");
    }

    [Test]
    public async Task MixedContent_PersistsAfterSave()
    {
        var pageTitle = await CreateAndOpenNewPageAsync();
        await App.EnterPageEditModeAsync();

        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("Mixed page text");
        await App.Editor.AddBlockAsync("Code");
        await App.SaveAsync();

        await App.GotoAsync();
        await App.Sidebar.SelectPageAsync(pageTitle);

        // Verify the text block survived.
        var editorContent = Page.Locator(".page-editor-content");
        await Expect(editorContent.First).ToContainTextAsync("Mixed page text");

        // Verify the monaco editor (code block) survived.
        var monacoEditor = Page.Locator(".monaco-editor").First;
        await Expect(monacoEditor).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }
}
