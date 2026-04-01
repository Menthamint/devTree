namespace DevTree.E2E.PageObjects;

/// <summary>
/// Page object for the DevTree Diary feature (/diary).
/// Encapsulates interactions with the diary header, sidebar, template manager,
/// and editor area.
/// </summary>
public class DiaryPage(IPage page)
{
    private readonly IPage _page = page;

    private static string BaseUrl =>
        Environment.GetEnvironmentVariable("DEVTREE_BASE_URL") ?? "http://localhost:3000";

    // ── Navigation ──────────────────────────────────────────────────────────

    /// <summary>Navigates to the diary page and waits for it to be usable.</summary>
    public async Task GotoAsync()
    {
        await _page.GotoAsync($"{BaseUrl}/diary", new() { WaitUntil = WaitUntilState.Load });

        // Suppress Next.js dev overlay so it doesn't intercept pointer events.
        await _page.EvaluateAsync(@"
            document.querySelectorAll('nextjs-portal').forEach(el => {
                el.style.pointerEvents = 'none';
                el.style.display = 'none';
            });
        ");
    }

    // ── Journal / entry setup ───────────────────────────────────────────────

    /// <summary>
    /// Fetches existing journals via the API and returns the first journal ID,
    /// or empty string if none exist.
    /// </summary>
    public async Task<string> GetFirstJournalIdAsync()
    {
        var ids = await _page.EvaluateAsync<string[]>(@"
            (async () => {
                const res = await fetch('/api/diary/journals');
                if (!res.ok) return [];
                const data = await res.json();
                return Array.isArray(data) ? data.map(j => j.id) : [];
            })()
        ");
        return ids is { Length: > 0 } ? ids[0] : string.Empty;
    }

    /// <summary>
    /// Creates or loads today's diary entry so the editor is visible.
    /// Ensures a journal exists first (the API auto-creates "main" on GET).
    /// </summary>
    public async Task EnsureTodayEntryAsync()
    {
        // If the editor is already visible an entry already exists.
        if (await _page.Locator(".page-editor-content").IsVisibleAsync())
            return;

        // Ensure the "main" journal exists — the GET endpoint auto-creates it.
        await _page.EvaluateAsync<object?>("() => fetch('/api/diary/journals').then(r => r.json())");

        // Reload so the UI picks up the newly created journal.
        await _page.ReloadAsync(new() { WaitUntil = WaitUntilState.Load });

        // Suppress Next.js dev overlay again after reload.
        await _page.EvaluateAsync(@"
            document.querySelectorAll('nextjs-portal').forEach(el => {
                el.style.pointerEvents = 'none';
                el.style.display = 'none';
            });
        ");

        // If the editor is now visible, a pre-existing today entry was already loaded.
        if (await _page.Locator(".page-editor-content").IsVisibleAsync())
            return;

        var createBtn = _page.GetByText("Create today's entry");
        try
        {
            await createBtn.WaitForAsync(new() { Timeout = 8_000 });
            await createBtn.ClickAsync();
        }
        catch
        {
            // Button may be disabled if entry already exists — wait for editor anyway.
        }

        await _page.Locator(".page-editor-content").WaitForAsync(new() { Timeout = 15_000 });
    }

    /// <summary>
    /// Creates a diary entry for the given date via the API (bypasses the UI picker).
    /// Call before navigating to the diary page or after navigating, then reload.
    /// </summary>
    public async Task CreateEntryViaApiAsync(string journalId, string dateOnly)
    {
        await _page.EvaluateAsync<object?>($@"
            (async () => {{
                await fetch('/api/diary/{dateOnly}?journalId={journalId}', {{
                    method: 'PUT',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{
                        content: {{ type: 'doc', content: [{{ type: 'paragraph' }}] }}
                    }})
                }});
            }})()
        ");
    }

    // ── Editor ──────────────────────────────────────────────────────────────

    /// <summary>Clicks into the diary Tiptap editor and types text.</summary>
    public async Task TypeInEditorAsync(string text)
    {
        var editor = _page.Locator(".page-editor-content").First;
        await editor.ClickAsync();
        await editor.PressSequentiallyAsync(text, new() { Delay = 30 });
    }

    /// <summary>Waits for the header to show "Unsaved changes".</summary>
    public async Task WaitForDirtyStateAsync()
    {
        await _page.GetByText("Unsaved changes").WaitForAsync(new() { Timeout = 5_000 });
    }

    // ── Template manager ────────────────────────────────────────────────────

    /// <summary>Opens the template manager dialog via the "Templates" (Edit3) header button.</summary>
    public async Task OpenTemplateManagerAsync()
    {
        // Scope to the diary header (data-testid) to avoid matching the sidebar Templates button.
        var btn = _page.Locator("[data-testid='diary-header']").GetByRole(AriaRole.Button, new() { Name = "Templates", Exact = true });
        await btn.WaitForAsync(new() { Timeout = 5_000 });
        await btn.ClickAsync();
        await _page.GetByRole(AriaRole.Dialog).WaitForAsync(new() { Timeout = 5_000 });
    }

    /// <summary>
    /// Fills in the template creation form and clicks "Create template".
    /// The template manager dialog must be open before calling this.
    /// </summary>
    public async Task CreateTemplateInDialogAsync(string name, string title, string prompts = "")
    {
        await _page.GetByPlaceholder("Template name").FillAsync(name);

        // Click into the new rich-text template body editor and type content
        var editorContent = _page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await editorContent.PressSequentiallyAsync(title, new() { Delay = 30 });

        if (!string.IsNullOrEmpty(prompts))
        {
            await _page.Keyboard.PressAsync("Enter");
            await editorContent.PressSequentiallyAsync(prompts, new() { Delay = 30 });
        }

        await _page.GetByRole(AriaRole.Button, new() { Name = "Create template", Exact = true }).ClickAsync();

        // Wait for the new template to appear in the manager list.
        await _page.GetByText(name).WaitForAsync(new() { Timeout = 5_000 });
    }

    /// <summary>Opens the template manager, creates a rich template with bold formatting, and closes.</summary>
    public async Task CreateRichTemplateAsync(string name, string bodyText)
    {
        await OpenTemplateManagerAsync();
        await _page.GetByPlaceholder("Template name").FillAsync(name);
        var editorContent = _page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await editorContent.PressSequentiallyAsync(bodyText, new() { Delay = 30 });
        await _page.GetByRole(AriaRole.Button, new() { Name = "Create template", Exact = true }).ClickAsync();
        await _page.GetByText(name).WaitForAsync(new() { Timeout = 5_000 });
        await CloseTemplateManagerAsync();
    }

    /// <summary>Clicks the Bold button in the template body editor toolbar.</summary>
    public async Task ClickTemplateBoldButtonAsync()
    {
        await _page.GetByRole(AriaRole.Button, new() { Name = "Bold" }).ClickAsync();
    }

    /// <summary>Clicks the H2 button in the template body editor toolbar.</summary>
    public async Task ClickTemplateH2ButtonAsync()
    {
        // H2/H3 use title= not aria-label, so GetByTitle is the correct locator.
        await _page.GetByTitle("Heading 2").ClickAsync();
    }

    /// <summary>Clicks the H3 button in the template body editor toolbar.</summary>
    public async Task ClickTemplateH3ButtonAsync()
    {
        await _page.GetByTitle("Heading 3").ClickAsync();
    }

    /// <summary>Clicks the Italic button in the template body editor toolbar.</summary>
    public async Task ClickTemplateItalicButtonAsync()
    {
        await _page.GetByRole(AriaRole.Button, new() { Name = "Italic" }).ClickAsync();
    }

    /// <summary>Opens the emoji picker in the template body editor toolbar.</summary>
    public async Task OpenTemplateEmojiPickerAsync()
    {
        var btn = _page.GetByRole(AriaRole.Button, new() { Name = "Emoji", Exact = true });
        await btn.WaitForAsync(new() { Timeout = 5_000 });
        await btn.ClickAsync();
    }

    /// <summary>Types a colon followed by query to trigger emoji suggestion in template editor.</summary>
    public async Task TypeEmojiSuggestionAsync(string query)
    {
        var editorContent = _page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await _page.Keyboard.TypeAsync($":{query}");
        await _page.Locator(".tiptap-emoji-list").WaitForAsync(new() { Timeout = 3_000 });
    }

    /// <summary>Selects the first emoji suggestion by pressing Enter.</summary>
    public async Task SelectFirstEmojiSuggestionAsync()
    {
        await _page.Keyboard.PressAsync("Enter");
    }

    /// <summary>Presses Escape to close the emoji suggestion without selecting.</summary>
    public async Task CloseEmojiSuggestionAsync()
    {
        await _page.Keyboard.PressAsync("Escape");
    }

    /// <summary>Closes the template manager dialog by pressing Escape.</summary>
    public async Task CloseTemplateManagerAsync()
    {
        await _page.Keyboard.PressAsync("Escape");
        await _page.WaitForTimeoutAsync(400);
    }

    // ── Template application ────────────────────────────────────────────────

    /// <summary>
    /// Opens the "Apply template" dropdown in the diary header and clicks
    /// the item matching <paramref name="templateName"/>.
    /// </summary>
    public async Task ApplyTemplateAsync(string templateName)
    {
        var applyBtn = _page.GetByRole(AriaRole.Button, new() { Name = "Apply template", Exact = true });
        await applyBtn.WaitForAsync(new() { Timeout = 5_000 });
        await applyBtn.ClickAsync();

        var item = _page.GetByRole(AriaRole.Button, new() { Name = templateName });
        await item.WaitForAsync(new() { Timeout = 5_000 });
        await item.ClickAsync();
    }

    // ── Overwrite confirmation dialog (from useConfirmation) ────────────────

    /// <summary>The confirm/cancel buttons are rendered by the generic ConfirmationDialog.</summary>
    public ILocator OverwriteDialog => _page.GetByRole(AriaRole.Alertdialog);

    /// <summary>Clicks the primary action button in the overwrite confirmation dialog.</summary>
    public async Task ConfirmOverwriteAsync()
    {
        var btn = _page.GetByTestId("confirm-delete-confirm");
        await btn.WaitForAsync(new() { Timeout = 5_000 });
        await btn.ClickAsync();
    }

    /// <summary>
    /// If the overwrite confirmation dialog is visible, confirms it.
    /// No-op when the entry is clean and no dialog appeared.
    /// </summary>
    public async Task ConfirmOverwriteIfVisibleAsync()
    {
        var btn = _page.GetByTestId("confirm-delete-confirm");
        if (await btn.IsVisibleAsync())
            await btn.ClickAsync();
    }

    /// <summary>Clicks the cancel button in the overwrite confirmation dialog.</summary>
    public async Task CancelOverwriteAsync()
    {
        var btn = _page.GetByTestId("confirm-delete-cancel");
        await btn.WaitForAsync(new() { Timeout = 5_000 });
        await btn.ClickAsync();
    }

    // ── UnsavedChangesDialog (navigation guard) ─────────────────────────────

    /// <summary>Returns the UnsavedChangesDialog alertdialog locator.</summary>
    public ILocator UnsavedDialog => _page.GetByRole(AriaRole.Alertdialog);

    /// <summary>Returns true if the UnsavedChangesDialog is currently open.</summary>
    public async Task<bool> IsUnsavedDialogVisibleAsync() =>
        await _page.GetByTestId("unsaved-cancel").IsVisibleAsync();

    /// <summary>Clicks "Leave without saving" in the UnsavedChangesDialog.</summary>
    public async Task LeaveWithoutSavingAsync()
    {
        await _page.GetByTestId("unsaved-leave-without-saving").ClickAsync();
    }

    /// <summary>Clicks "Stay on page" (cancel) in the UnsavedChangesDialog.</summary>
    public async Task StayOnPageAsync()
    {
        await _page.GetByTestId("unsaved-cancel").ClickAsync();
    }

    // ── Sidebar entry navigation ────────────────────────────────────────────

    /// <summary>
    /// Clicks the Nth entry (0-based) in the diary timeline list.
    /// Entries are sorted newest-first.
    /// </summary>
    public async Task SelectEntryByIndexAsync(int index)
    {
        // Entries are <li> items inside the diary sidebar list.
        var entries = _page.Locator("aside li");
        await entries.Nth(index).WaitForAsync(new() { Timeout = 5_000 });
        await entries.Nth(index).ClickAsync();
        await _page.WaitForTimeoutAsync(400);
    }
}
