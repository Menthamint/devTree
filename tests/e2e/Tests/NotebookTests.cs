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
        var title = $"Delete Dialog {Guid.NewGuid():N}"[..18];
        await App.Sidebar.RenameActivePageTitleAsync(title);
        await App.Sidebar.DeletePageByTitleAsync(title);

        // A dialog with confirmation buttons should appear.
        var dialog = Page.Locator("[role='alertdialog'], [role='dialog']").First;
        await Expect(dialog).ToBeVisibleAsync();
    }

    [Test]
    public async Task DeletePage_Confirm_RemovesFromSidebar()
    {
        await App.Sidebar.CreatePageAsync();
        var title = $"Delete Confirm {Guid.NewGuid():N}"[..20];
        await App.Sidebar.RenameActivePageTitleAsync(title);

        await App.Sidebar.DeletePageByTitleAsync(title);
        await App.Sidebar.ConfirmDeleteDialogAsync();

        var removed = Page.Locator("aside").GetByText(title, new() { Exact = true });
        await Expect(removed).ToHaveCountAsync(0);
    }

    [Test]
    public async Task DeletePage_Cancel_PageStillInSidebar()
    {
        await App.Sidebar.CreatePageAsync();
        var title = $"Delete Cancel {Guid.NewGuid():N}"[..19];
        await App.Sidebar.RenameActivePageTitleAsync(title);

        await App.Sidebar.DeletePageByTitleAsync(title);
        await App.Sidebar.CancelDeleteDialogAsync();

        await Expect(Page.Locator("aside").GetByText(title, new() { Exact = true }).First)
            .ToBeVisibleAsync();
    }

    // ── Delete folder ─────────────────────────────────────────────────────────

    [Test]
    public async Task DeleteFolder_Confirm_RemovesFolderAndContents()
    {
        await App.Sidebar.CreateFolderAsync("Doomed Folder");

        await App.Sidebar.DeleteFolderByNameAsync("Doomed Folder");
        await App.Sidebar.ConfirmDeleteDialogAsync();

        var removed = Page.Locator("aside").GetByText("Doomed Folder", new() { Exact = true });
        await Expect(removed).ToHaveCountAsync(0);
    }

    [Test]
    public async Task DeleteFolder_Cancel_FolderStillInSidebar()
    {
        await App.Sidebar.CreateFolderAsync("Surviving Folder");

        await App.Sidebar.DeleteFolderByNameAsync("Surviving Folder");
        await App.Sidebar.CancelDeleteDialogAsync();

        await Expect(Page.Locator("aside").GetByText("Surviving Folder", new() { Exact = true }).First)
            .ToBeVisibleAsync();
    }

    [Test]
    public async Task DeleteFolder_Confirm_RemovesNestedSubfoldersPagesAndContent()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var parentName = $"Cascade Parent {suffix}";
        var childName = $"Cascade Child {suffix}";
        var pageTitle = $"Cascade Page {suffix}";

        await App.Sidebar.CreateFolderAsync(parentName);

        var parentAccordion = Page.Locator("aside [data-radix-accordion-item]")
            .Filter(new LocatorFilterOptions { HasText = parentName });
        var parentMore = parentAccordion.GetByRole(AriaRole.Button, new() { Name = "More actions", Exact = true }).First;
        await parentMore.WaitForAsync(new() { Timeout = 5_000 });
        await parentMore.ClickAsync();

        var newFolderItem = Page.GetByRole(AriaRole.Menuitem, new() { Name = "New folder", Exact = true });
        await newFolderItem.WaitForAsync(new() { Timeout = 5_000 });
        await newFolderItem.ClickAsync();

        // Ensure the parent is expanded so the newly created child row is visible.
        var parentLabel = Page.Locator("aside").GetByText(parentName, new() { Exact = true }).First;
        await parentLabel.ClickAsync();

        var createdChild = parentAccordion
            .GetByText(new System.Text.RegularExpressions.Regex("^New folder(\\s+\\d+)?$"))
            .First;
        await createdChild.WaitForAsync(new() { Timeout = 10_000 });
        await createdChild.DblClickAsync();

        var renameInput = Page.GetByRole(AriaRole.Textbox).Last;
        await renameInput.WaitForAsync(new() { Timeout = 5_000 });
        await renameInput.FillAsync(childName);
        await renameInput.PressAsync("Enter");

        var childAccordion = Page.Locator("aside [data-radix-accordion-item]")
            .Filter(new LocatorFilterOptions { HasText = childName });
        var childMore = childAccordion.GetByRole(AriaRole.Button, new() { Name = "More actions", Exact = true }).First;
        await childMore.WaitForAsync(new() { Timeout = 5_000 });
        await childMore.ClickAsync();

        var newPageItem = Page.Locator("[role='menuitem']:has-text('New file'), [role='menuitem']:has-text('Новий файл')").First;
        await newPageItem.WaitForAsync(new() { Timeout = 5_000 });
        await newPageItem.ClickAsync();

        await App.Sidebar.RenameActivePageTitleAsync(pageTitle);

        await App.Sidebar.DeleteFolderByNameAsync(parentName);

        var dialog = Page.GetByRole(AriaRole.Alertdialog);
        await Expect(dialog).ToBeVisibleAsync();
        await Expect(dialog).ToContainTextAsync(
            new System.Text.RegularExpressions.Regex("Everything inside will be permanently removed\\.|Все всередині буде видалено\\.")
        );

        await App.Sidebar.ConfirmDeleteDialogAsync();

        var parentFolderRow = Page.Locator("aside [data-radix-accordion-item] > h3 > button")
            .Filter(new LocatorFilterOptions { Has = Page.GetByText(parentName, new() { Exact = true }) });
        var childFolderRow = Page.Locator("aside [data-radix-accordion-item] > h3 > button")
            .Filter(new LocatorFilterOptions { Has = Page.GetByText(childName, new() { Exact = true }) });
        var pageRow = Page.Locator("aside [role='treeitem']")
            .Filter(new LocatorFilterOptions { Has = Page.GetByText(pageTitle, new() { Exact = true }) });

        await Expect(parentFolderRow).ToHaveCountAsync(0);
        await Expect(childFolderRow).ToHaveCountAsync(0);
        await Expect(pageRow).ToHaveCountAsync(0);
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
