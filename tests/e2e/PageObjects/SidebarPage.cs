namespace DevTree.E2E.PageObjects;

using System.Text.RegularExpressions;

/// <summary>
/// Page object for the left sidebar / file-explorer panel.
/// </summary>
public class SidebarPage(IPage page)
{
    private readonly IPage _page = page;
    private static readonly Regex UntitledPattern = new("^Untitled(?:\\s+\\d+)?$", RegexOptions.Compiled);

    // ── Selectors ──────────────────────────────────────────────────────────

    private ILocator NewPageBtn   => _page.GetByTestId("sidebar-new-page").First;
    private ILocator NewFolderBtn => _page.GetByTestId("sidebar-new-folder").First;
    private ILocator HideBtn      => _page.Locator("button[aria-label='Hide sidebar'], button[aria-label='Сховати бічну панель']").First;
    private ILocator ShowBtn      => _page.Locator("button[aria-label='Show sidebar'], button[aria-label='Показати бічну панель']").First;

    // ── Actions ────────────────────────────────────────────────────────────

    private async Task<HashSet<string>> GetUntitledTitlesAsync()
    {
        var titles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var matches = _page.Locator("aside").GetByText(UntitledPattern);
        var count = await matches.CountAsync();
        for (var index = 0; index < count; index++)
        {
            var text = (await matches.Nth(index).InnerTextAsync()).Trim();
            if (!string.IsNullOrWhiteSpace(text))
            {
                titles.Add(text);
            }
        }

        return titles;
    }

    /// <summary>Creates a new page and returns its title locator.</summary>
    public async Task<ILocator> CreatePageAsync(string title = "")
    {
        // Record the URL before creating so we can detect navigation to the new page.
        var urlBeforeCreate = _page.Url;

        // Wait for the sidebar to be fully loaded.
        var sidebar = _page.Locator("aside");
        try
        {
            await sidebar.WaitForAsync(new() { Timeout = 15_000 });
        }
        catch
        {
            await _page.WaitForTimeoutAsync(2000);
        }

        // Click the "New page" button with retries.
        var newPageBtn = NewPageBtn;
        for (int i = 0; i < 3; i++)
        {
            try
            {
                await newPageBtn.ClickAsync(new() { Timeout = 5_000 });
                break;
            }
            catch when (i < 2)
            {
                await _page.WaitForTimeoutAsync(500);
            }
        }

        // Wait for the URL to change (new page navigation occurred).
        for (var attempt = 0; attempt < 40; attempt++)
        {
            if (_page.Url != urlBeforeCreate) break;
            await _page.WaitForTimeoutAsync(250);
        }

        // After "New page" is clicked, the app calls onFileCreated which sets
        // isEditMode=true automatically. So the app will be in EDIT MODE after creation.
        // We wait for either the Save button (edit mode) or the Edit button (view mode)
        // to become visible — indicating a stable state.
        //
        // IMPORTANT: The app first navigates to a temp page ID (optimistic), then the
        // API call completes and replaces the temp ID with a real DB ID. We must wait
        // for this transition to complete before returning, otherwise the editor
        // will be unmounted. We detect stability by waiting for the Tiptap editor
        // container (.page-editor-content) to appear.

        var saveBtn = _page.GetByTestId("save-page-button");
        var editPageBtn = _page.GetByRole(AriaRole.Button, new() { Name = "Edit page", Exact = true });
        var leaveBtn = _page.GetByTestId("unsaved-leave-without-saving");

        // Phase 1: wait for any stable header button (edit mode or view mode)
        for (var attempt = 0; attempt < 30; attempt++)
        {
            // Dismiss unsaved dialog if visible (handles dirty-state transitions)
            if (await leaveBtn.IsVisibleAsync())
            {
                await leaveBtn.ClickAsync();
                await _page.WaitForTimeoutAsync(500);
                continue;
            }

            // Stable header button visible
            if (await saveBtn.IsVisibleAsync() || await editPageBtn.IsVisibleAsync())
                break;

            await _page.WaitForTimeoutAsync(300);
        }

        // Phase 2: wait for the Tiptap editor container to appear, which confirms the
        // page has fully loaded (temp ID → real DB ID transition completed).
        try
        {
            await _page.Locator(".page-editor-content").WaitForAsync(new() { Timeout = 15_000 });
        }
        catch
        {
            // Editor didn't appear — fall through; test will handle the failure.
        }

        // Extract the page title from the page header for the return locator.
        var headerTitle = _page.GetByTestId("page-header-title");
        string pageTitle;
        try
        {
            pageTitle = (await headerTitle.InnerTextAsync(new() { Timeout = 3_000 })).Trim();
        }
        catch
        {
            pageTitle = string.Empty;
        }

        // Return the sidebar locator matching the active page title.
        if (!string.IsNullOrWhiteSpace(pageTitle))
        {
            return _page.Locator("aside").GetByText(pageTitle, new() { Exact = true }).First;
        }
        return _page.Locator("aside [aria-selected='true']").First;
    }

    /// <summary>Creates a new folder and optionally renames it.</summary>
    public async Task<ILocator> CreateFolderAsync(string name = "")
    {
        // Capture any pre-existing "New folder*" names so we can identify the newly created one.
        var existingNewFolders = await GetExistingNewFolderNamesAsync();

        var createFolderResponse = _page.WaitForResponseAsync(
            r => r.Url.Contains("/api/folders") && r.Request.Method == "POST" && r.Ok);
        await NewFolderBtn.ClickAsync();
        await createFolderResponse;

        // Wait for a new "New folder*" item to appear that wasn't there before.
        ILocator? newFolderLocator = null;
        for (var attempt = 0; attempt < 30; attempt++)
        {
            await _page.WaitForTimeoutAsync(300);
            var candidates = _page.Locator("aside").GetByText(new System.Text.RegularExpressions.Regex(@"^New folder(\s+\d+)?$"));
            var count = await candidates.CountAsync();
            for (var i = 0; i < count; i++)
            {
                var text = (await candidates.Nth(i).InnerTextAsync()).Trim();
                if (!existingNewFolders.Contains(text))
                {
                    newFolderLocator = candidates.Nth(i);
                    break;
                }
            }
            if (newFolderLocator != null) break;
        }

        if (newFolderLocator == null)
        {
            // Fallback: just grab the first "New folder" item
            newFolderLocator = _page.Locator("aside").GetByText(new System.Text.RegularExpressions.Regex(@"^New folder(\s+\d+)?$")).First;
            await newFolderLocator.WaitForAsync(new() { Timeout = 10_000 });
        }

        if (!string.IsNullOrEmpty(name))
        {
            await RenameNewFolderAsync(newFolderLocator, name);
            // After rename, explicitly wait for the renamed text to appear
            var locator = _page.Locator("aside").GetByText(name, new() { Exact = true }).First;
            await locator.WaitForAsync(new() { Timeout = 15_000 });
            return locator;
        }
        else
        {
            return newFolderLocator;
        }
    }

    private async Task<HashSet<string>> GetExistingNewFolderNamesAsync()
    {
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var matches = _page.Locator("aside").GetByText(new System.Text.RegularExpressions.Regex(@"^New folder(\s+\d+)?$"));
        var count = await matches.CountAsync();
        for (var i = 0; i < count; i++)
        {
            var text = (await matches.Nth(i).InnerTextAsync()).Trim();
            names.Add(text);
        }
        return names;
    }

    /// <summary>Double-clicks a specific folder locator to enter rename mode and types a new name.</summary>
    private async Task RenameNewFolderAsync(ILocator folderLocator, string newName)
    {
        await folderLocator.ScrollIntoViewIfNeededAsync();
        await folderLocator.DblClickAsync();

        // Wait for the inline rename input to appear
        var input = _page.GetByRole(AriaRole.Textbox).Last;
        await input.WaitForAsync();

        await input.ClearAsync();
        await input.PressSequentiallyAsync(newName);
        await _page.WaitForTimeoutAsync(150);
        await input.PressAsync("Enter");
        await _page.WaitForTimeoutAsync(500);
    }

    /// <summary>Double-clicks the last tree item to enter rename mode and types a name.</summary>
    public async Task RenameLastItemAsync(string newName)
    {
        // The last row in the accordion gets an inline rename input on double-click.
        // Note: with sorted tree, the last item may not be the most recently created one.
        // Use RenameNewFolderAsync for newly created folders instead.
        var items = _page.Locator("[data-radix-accordion-item]");
        var count = await items.CountAsync();
        if (count == 0) return;

        var lastItem = items.Nth(count - 1);

        await lastItem.ScrollIntoViewIfNeededAsync();
        await lastItem.DblClickAsync();

        var input = _page.GetByRole(AriaRole.Textbox).Last;
        await input.WaitForAsync();

        await input.ClearAsync();
        await input.PressSequentiallyAsync(newName);
        await _page.WaitForTimeoutAsync(150);
        await input.PressAsync("Enter");
        await _page.WaitForTimeoutAsync(500);
    }

    /// <summary>Clicks a tree item by its visible text.</summary>
    public async Task SelectPageAsync(string title)
    {
        var sidebar = _page.Locator("aside");
        await sidebar.WaitForAsync(new() { Timeout = 15_000 });

        var locator = sidebar.GetByText(title, new() { Exact = true }).First;

        try
        {
            await locator.WaitForAsync(new() { Timeout = 3_000 });
        }
        catch (TimeoutException)
        {
            var searchInput = _page.GetByTestId("sidebar-search-input");
            await searchInput.WaitForAsync(new() { Timeout = 5_000 });
            await searchInput.FillAsync(title);
            await locator.WaitForAsync(new() { Timeout = 10_000 });
        }

        await locator.ClickAsync();

        var clearSearchButton = _page.GetByTestId("sidebar-clear-search");
        if (await clearSearchButton.IsVisibleAsync())
        {
            await clearSearchButton.ClickAsync();
        }

        // Wait for the URL to update with ?page= parameter (URL is updated via React Effect after click)
        var urlBefore = _page.Url;
        for (var attempt = 0; attempt < 20; attempt++)
        {
            if (_page.Url.Contains("?page=") && _page.Url != urlBefore) break;
            await _page.WaitForTimeoutAsync(300);
        }
        // If the URL never had ?page=, it means we were on the home page — just wait briefly
        if (!_page.Url.Contains("?page="))
        {
            await _page.WaitForTimeoutAsync(500);
        }
    }

    /// <summary>Clicks the last tree item with the given visible text.</summary>
    public async Task SelectLastPageAsync(string title)
    {
        var sidebar = _page.Locator("aside");
        await sidebar.WaitForAsync(new() { Timeout = 15_000 });

        var matches = sidebar.GetByText(title, new() { Exact = true });
        var count = await matches.CountAsync();
        if (count == 0)
        {
            var searchInput = _page.GetByTestId("sidebar-search-input");
            await searchInput.WaitForAsync(new() { Timeout = 5_000 });
            await searchInput.FillAsync(title);

            matches = sidebar.GetByText(title, new() { Exact = true });
            count = await matches.CountAsync();
            if (count == 0)
            {
                throw new InvalidOperationException($"No sidebar item found with title '{title}'.");
            }
        }

        var last = matches.Nth(count - 1);
        await last.ClickAsync();
        await _page.WaitForTimeoutAsync(500);
    }

    /// <summary>Collapses the sidebar.</summary>
    public Task HideAsync() => HideBtn.ClickAsync();

    /// <summary>Expands the sidebar from the collapsed strip.</summary>
    public Task ShowAsync() => ShowBtn.ClickAsync();

    /// <summary>Returns true when the sidebar panel is visible.</summary>
    public async Task<bool> IsVisibleAsync() =>
        await _page.Locator("aside").IsVisibleAsync();

    /// <summary>Waits for the sidebar to be visible.</summary>
    public async Task WaitForVisibleAsync()
    {
        await _page.Locator("aside").WaitForAsync(new() { Timeout = 10_000 });
        await _page.Locator("aside").IsVisibleAsync();
    }

    // ── Delete helpers ─────────────────────────────────────────────────────

    /// <summary>
    /// Hovers the last page item in the sidebar and clicks its inline "Delete"
    /// action button. For file nodes (pages) the delete action renders inline
    /// as a <span role="button" aria-label="Delete"> — NOT in a dropdown.
    /// </summary>
    public async Task DeleteLastPageAsync()
    {
        var items = _page.Locator("aside [data-radix-accordion-item]");
        var count = await items.CountAsync();
        if (count == 0) throw new InvalidOperationException("No tree items found in sidebar.");

        var last = items.Nth(count - 1);
        await last.ScrollIntoViewIfNeededAsync();
        await last.HoverAsync();

        // Pages have exactly 1 action (delete) so it renders inline, not in a dropdown.
        // The button is <span role="button" aria-label="Delete"> — use ARIA role selector.
        var deleteBtn = last.GetByRole(AriaRole.Button, new() { Name = "Delete", Exact = true });
        await deleteBtn.WaitForAsync(new() { Timeout = 5_000 });
        await deleteBtn.ClickAsync();
    }

    /// <summary>
    /// Hovers a folder item by name, opens "More actions" dropdown, and clicks "Delete".
    /// Folders show 4 actions (delete, rename, newFile, newFolder) → rendered inside a Radix DropdownMenu.
    /// </summary>
    public async Task DeleteFolderByNameAsync(string folderName)
    {
        var folderItem = _page.Locator("aside").GetByText(folderName, new() { Exact = true }).First;
        await folderItem.WaitForAsync(new() { Timeout = 10_000 });
        await folderItem.ScrollIntoViewIfNeededAsync();
        await folderItem.HoverAsync();

        // Folders have 4 actions → overflow dropdown with "More actions" trigger.
        var folderTrigger = _page.Locator("aside [data-radix-accordion-item] > h3 > button")
            .Filter(new LocatorFilterOptions
            {
                Has = _page.GetByText(folderName, new() { Exact = true }),
            })
            .First;
        var moreBtn = folderTrigger.GetByRole(AriaRole.Button, new() { Name = "More actions", Exact = true });
        await moreBtn.WaitForAsync(new() { Timeout = 5_000 });
        await moreBtn.ClickAsync();

        var deleteItem = _page.GetByRole(AriaRole.Menuitem, new() { Name = "Delete", Exact = true });
        await deleteItem.WaitForAsync(new() { Timeout = 5_000 });
        await deleteItem.ClickAsync();
    }

    /// <summary>
    /// Hovers the last folder item in the sidebar, opens "More actions" dropdown,
    /// and clicks "Delete". Folders show 4 actions → they use the overflow dropdown.
    /// </summary>
    public async Task DeleteLastFolderAsync()
    {
        var folders = _page.Locator("aside [data-radix-accordion-item]");
        var count = await folders.CountAsync();
        if (count == 0) throw new InvalidOperationException("No folder items found in sidebar.");

        // Walk backwards to find the last item that is a folder (has children / accordion content)
        var last = folders.Nth(count - 1);
        await last.ScrollIntoViewIfNeededAsync();
        await last.HoverAsync();

        // Folders have 4 actions (delete, rename, newFile, newFolder) → rendered
        // inside a Radix DropdownMenu with trigger <span role="button" aria-label="More actions">.
        var moreBtn = last.GetByRole(AriaRole.Button, new() { Name = "More actions", Exact = true });
        await moreBtn.WaitForAsync(new() { Timeout = 5_000 });
        await moreBtn.ClickAsync();

        // Wait for dropdown portal to appear and click the Delete menuitem.
        var deleteItem = _page.GetByRole(AriaRole.Menuitem, new() { Name = "Delete", Exact = true });
        await deleteItem.WaitForAsync(new() { Timeout = 5_000 });
        await deleteItem.ClickAsync();
    }

    /// <summary>
    /// Clicks the "Delete" confirm button in the delete-confirmation dialog.
    /// Uses the data-testid added to DeleteConfirmDialog for reliability.
    /// </summary>
    public async Task ConfirmDeleteDialogAsync()
    {
        var confirmBtn = _page.GetByTestId("confirm-delete-confirm");
        await confirmBtn.WaitForAsync(new() { Timeout = 5_000 });
        await confirmBtn.ClickAsync();
        // Wait for the dialog to close and tree to update
        await _page.WaitForTimeoutAsync(500);
    }

    /// <summary>
    /// Clicks the "Cancel" button in the delete-confirmation dialog.
    /// </summary>
    public async Task CancelDeleteDialogAsync()
    {
        var cancelBtn = _page.GetByTestId("confirm-delete-cancel");
        await cancelBtn.WaitForAsync(new() { Timeout = 5_000 });
        await cancelBtn.ClickAsync();
        await _page.WaitForTimeoutAsync(300);
    }

    /// <summary>
    /// Renames the currently active page via the main-content PageTitle input.
    /// Requires the page to be in EDIT MODE (the input is only editable then).
    /// </summary>
    public async Task RenameActivePageTitleAsync(string newTitle)
    {
        // PageTitle renders an <input aria-label="Page title"> in edit mode.
        var titleInput = _page.GetByRole(AriaRole.Textbox, new() { Name = "Page title", Exact = true });
        await titleInput.WaitForAsync(new() { Timeout = 5_000 });
        await titleInput.ClearAsync();
        await titleInput.FillAsync(newTitle);
        await titleInput.BlurAsync();
        await _page.WaitForTimeoutAsync(500);
    }
}
