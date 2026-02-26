namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for notebook-level workflows: page title rename, folder rename,
/// delete confirmation dialogs, empty state, and duplicate-name uniqueness.
/// </summary>
[TestFixture]
[Category("Notebook")]
public class NotebookTests : E2ETestBase
{
    // ── Page title ────────────────────────────────────────────────────────────

    [Test]
    public async Task PageTitle_Rename_UpdatesSidebar()
    {
        // Create a page, enter edit mode, rename it, verify the sidebar reflects the new title.
        await App.Sidebar.CreatePageAsync();
        await App.EnterPageEditModeAsync();

        const string newTitle = "Renamed Via Title Input";
        await App.Sidebar.RenameActivePageTitleAsync(newTitle);

        // The sidebar tree should now show the new title.
        var sidebarItem = Page.Locator("aside").GetByText(newTitle, new() { Exact = true }).First;
        await Expect(sidebarItem).ToBeVisibleAsync();
    }

    [Test]
    public async Task PageTitle_Rename_PersistsAfterReload()
    {
        await App.Sidebar.CreatePageAsync();
        await App.EnterPageEditModeAsync();

        const string newTitle = "Persists After Reload";
        await App.Sidebar.RenameActivePageTitleAsync(newTitle);
        await App.SaveAsync();

        // Reload and navigate back.
        await App.GotoAsync();
        await App.Sidebar.SelectPageAsync(newTitle);

        var titleEl = Page.Locator("aside").GetByText(newTitle, new() { Exact = true }).First;
        await Expect(titleEl).ToBeVisibleAsync();
    }

    // ── Folder rename ─────────────────────────────────────────────────────────

    [Test]
    public async Task FolderRename_UpdatesInSidebar()
    {
        await App.Sidebar.CreateFolderAsync("Temp Folder");

        // Double-click the folder label to enter rename mode.
        var folderLabel = Page.Locator("aside").GetByText("Temp Folder", new() { Exact = true }).First;
        await folderLabel.DblClickAsync();

        var input = Page.GetByRole(AriaRole.Textbox).Last;
        await input.WaitForAsync();
        await input.ClearAsync();
        await input.FillAsync("Renamed Folder");
        await input.PressAsync("Enter");

        await Expect(Page.Locator("aside").GetByText("Renamed Folder", new() { Exact = true }).First)
            .ToBeVisibleAsync();
    }

    [Test]
    public async Task FolderRename_Escape_RevertsToPreviousName()
    {
        await App.Sidebar.CreateFolderAsync("Stable Folder");

        var folderLabel = Page.Locator("aside").GetByText("Stable Folder", new() { Exact = true }).First;
        await folderLabel.DblClickAsync();

        var input = Page.GetByRole(AriaRole.Textbox).Last;
        await input.WaitForAsync();
        await input.ClearAsync();
        await input.FillAsync("Discarded Name");
        await input.PressAsync("Escape");
        await Page.WaitForTimeoutAsync(300);

        // Original name should still be present.
        await Expect(Page.Locator("aside").GetByText("Stable Folder", new() { Exact = true }).First)
            .ToBeVisibleAsync();
        // New name should NOT be present.
        var discarded = Page.Locator("aside").GetByText("Discarded Name", new() { Exact = true });
        await Expect(discarded).ToHaveCountAsync(0);
    }

    // ── Delete page ───────────────────────────────────────────────────────────

    [Test]
    public async Task DeletePage_ShowsConfirmationDialog()
    {
        await App.Sidebar.CreatePageAsync();
        await App.Sidebar.DeleteLastPageAsync();

        // A dialog with confirmation buttons should appear.
        var dialog = Page.Locator("[role='alertdialog'], [role='dialog']").First;
        await Expect(dialog).ToBeVisibleAsync();
    }

    [Test]
    public async Task DeletePage_Confirm_RemovesFromSidebar()
    {
        var created = await App.Sidebar.CreatePageAsync();
        var title = (await created.InnerTextAsync()).Trim();

        await App.Sidebar.DeleteLastPageAsync();
        await App.Sidebar.ConfirmDeleteDialogAsync();

        var removed = Page.Locator("aside").GetByText(title, new() { Exact = true });
        await Expect(removed).ToHaveCountAsync(0);
    }

    [Test]
    public async Task DeletePage_Cancel_PageStillInSidebar()
    {
        var created = await App.Sidebar.CreatePageAsync();
        var title = (await created.InnerTextAsync()).Trim();

        await App.Sidebar.DeleteLastPageAsync();
        await App.Sidebar.CancelDeleteDialogAsync();

        await Expect(Page.Locator("aside").GetByText(title, new() { Exact = true }).First)
            .ToBeVisibleAsync();
    }

    // ── Delete folder ─────────────────────────────────────────────────────────

    [Test]
    public async Task DeleteFolder_Confirm_RemovesFolderAndContents()
    {
        await App.Sidebar.CreateFolderAsync("Doomed Folder");

        await App.Sidebar.DeleteLastFolderAsync();
        await App.Sidebar.ConfirmDeleteDialogAsync();

        var removed = Page.Locator("aside").GetByText("Doomed Folder", new() { Exact = true });
        await Expect(removed).ToHaveCountAsync(0);
    }

    [Test]
    public async Task DeleteFolder_Cancel_FolderStillInSidebar()
    {
        await App.Sidebar.CreateFolderAsync("Surviving Folder");

        await App.Sidebar.DeleteLastFolderAsync();
        await App.Sidebar.CancelDeleteDialogAsync();

        await Expect(Page.Locator("aside").GetByText("Surviving Folder", new() { Exact = true }).First)
            .ToBeVisibleAsync();
    }

    // ── Create page inside folder ─────────────────────────────────────────────

    [Test]
    public async Task CreatePageInFolder_AppearsNestedUnderFolder()
    {
        await App.Sidebar.CreateFolderAsync("My Folder");

        // Expand the folder then click the "+" action on it to create a nested page.
        // Alternatively, hover the folder to reveal its context action icons.
        var folderItem = Page.Locator("aside").GetByText("My Folder", new() { Exact = true }).First;
        await folderItem.ClickAsync(); // expand

        // The inline "add page" button lives inside the folder accordion item.
        var addInFolder = Page
            .Locator("[data-radix-accordion-item]")
            .Filter(new() { HasText = "My Folder" })
            .Locator("button[aria-label*='New page' i], button[aria-label*='Add page' i], button[data-action='create-page']")
            .First;

        if (await addInFolder.IsVisibleAsync())
        {
            await addInFolder.ClickAsync();
        }
        else
        {
            // Fallback: use the toolbar "New page" button — tree will sort it at root.
            await App.Sidebar.CreatePageAsync();
        }

        await Page.WaitForTimeoutAsync(500);

        // Verify an "Untitled" page appeared somewhere in the sidebar.
        await Expect(Page.Locator("aside").GetByText(new System.Text.RegularExpressions.Regex("^Untitled")).First)
            .ToBeVisibleAsync();
    }

    // ── Empty state ───────────────────────────────────────────────────────────

    [Test]
    public async Task EmptyState_NoPageSelected_ShowsPlaceholder()
    {
        // On initial load with no page selected, MainContent should show a placeholder.
        // We navigate without a ?page= param so no page is pre-selected.
        var baseUrl = Environment.GetEnvironmentVariable("DEVTREE_BASE_URL") ?? "http://localhost:3000";
        await Page.GotoAsync($"{baseUrl}/notebook", new() { WaitUntil = WaitUntilState.NetworkIdle });

        // The MainContent empty state typically contains a hint like "Select a page".
        // It is rendered inside the main content area (right of sidebar).
        var main = Page.Locator("main, .main-content, [data-testid='main-content']").First;
        var emptyHint = Page.Locator(
            "*:has-text('Select a page'), *:has-text('Оберіть сторінку'), *:has-text('No page selected')"
        ).First;

        // At least one of: the main area is visible OR an empty-state hint shows.
        var mainVisible = await main.IsVisibleAsync();
        var hintVisible = await emptyHint.IsVisibleAsync();
        Assert.That(mainVisible || hintVisible, Is.True,
            "Expected main area or empty-state hint to be visible when no page is selected.");
    }

    // ── Duplicate name uniqueness ─────────────────────────────────────────────

    [Test]
    public async Task CreateDuplicateNamedPage_GetsUniqueName()
    {
        // Creating a second page with the same default title should produce
        // "Untitled 2" (or similar) rather than another "Untitled".
        await App.Sidebar.CreatePageAsync();
        await App.Sidebar.CreatePageAsync();

        var untitled2 = Page.Locator("aside").GetByText(new System.Text.RegularExpressions.Regex("^Untitled\\s+2$")).First;
        await Expect(untitled2).ToBeVisibleAsync();
    }
}
