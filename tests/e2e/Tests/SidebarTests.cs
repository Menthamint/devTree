namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for the sidebar / file-explorer panel:
/// page creation, folder creation, navigation, hide/show, rename.
/// </summary>
[TestFixture]
[Category("Sidebar")]
public class SidebarTests : E2ETestBase
{
    // ── App loads ───────────────────────────────────────────────────────────

    [Test]
    public async Task App_LoadsSuccessfully_ShowsSidebar()
    {
        // Wait for sidebar to be visible
        await App.Sidebar.WaitForVisibleAsync();
        Assert.That(await App.Sidebar.IsVisibleAsync(), Is.True,
            "Sidebar should be visible on initial load.");
    }

    [Test]
    public async Task App_LoadsSuccessfully_ShowsSamplePages()
    {
        // Verify sidebar is fully interactive on load even if seed data is absent.
        await Expect(Page.GetByTestId("sidebar-new-page")).ToBeVisibleAsync();
        await Expect(Page.GetByTestId("sidebar-new-folder")).ToBeVisibleAsync();
        await Expect(Page.GetByTestId("sidebar-search-input")).ToBeVisibleAsync();
    }

    [Test]
    public async Task App_Title_IsLearningTree()
    {
        // The sidebar header shows the rebranded app name
        await Expect(Page.Locator("h1").First).ToContainTextAsync("Learning Tree");
    }

    // ── Search ────────────────────────────────────────────────────────────────

    [Test]
    public async Task SearchBox_FiltersPagesByTitle()
    {
        var searchInput = Page.GetByTestId("sidebar-search-input");
        await searchInput.FillAsync("TypeScript");

        await Expect(Page.GetByText("TypeScript Tips").First).ToBeVisibleAsync();
    }

    [Test]
    public async Task SearchBox_ClearButton_RestoresFullTree()
    {
        var searchInput = Page.GetByTestId("sidebar-search-input");
        await searchInput.FillAsync("React");

        var clearBtn = Page.GetByTestId("sidebar-clear-search");
        await Expect(clearBtn).ToBeVisibleAsync();
        await clearBtn.ClickAsync();

        await Expect(searchInput).ToBeEmptyAsync();
    }

    // ── Page creation ────────────────────────────────────────────────────────

    [Test]
    public async Task CreatePage_AppearsInSidebar()
    {
        // Pages are always created with "Untitled" name in the sidebar.
        // Renaming a page is done via the editor's PageTitle component, not in the sidebar.
        await App.Sidebar.CreatePageAsync();

        var item = Page.GetByText("Untitled").First;
        await Expect(item).ToBeVisibleAsync();
    }

    [Test]
    public async Task CreateMultiplePages_AllAppearInSidebar()
    {
        // Create two pages; second one gets unique default name.
        await App.Sidebar.CreatePageAsync();
        await App.Sidebar.CreatePageAsync();

        await Expect(Page.GetByText("Untitled").First).ToBeVisibleAsync();
        await Expect(Page.GetByText("Untitled 2").First).ToBeVisibleAsync();
    }

    // ── Folder creation ──────────────────────────────────────────────────────

    [Test]
    public async Task CreateFolder_AppearsInSidebar()
    {
        await App.Sidebar.CreateFolderAsync();

        var item = Page.GetByText("New folder").First;
        await Expect(item).ToBeVisibleAsync();
    }

    // ── Navigation ───────────────────────────────────────────────────────────

    [Test]
    public async Task SelectPage_DisplaysPageTitleInHeader()
    {
        await App.Sidebar.SelectPageAsync("React Hooks");

        var header = Page.GetByTestId("page-header-title");
        await Expect(header).ToContainTextAsync("React Hooks");
    }

    [Test]
    public async Task SelectPage_DisplaysBlocksInEditor()
    {
        await App.Sidebar.SelectPageAsync("React Hooks");

        // The React Hooks sample page has blocks
        var blockCount = await App.Editor.BlockCountAsync();
        Assert.That(blockCount, Is.GreaterThan(0),
            "React Hooks page should have at least one block.");
    }

    // ── Hide / Show sidebar ──────────────────────────────────────────────────

    [Test]
    public async Task HideSidebar_SidebarDisappears()
    {
        await App.Sidebar.HideAsync();

        Assert.That(await App.Sidebar.IsVisibleAsync(), Is.False,
            "Sidebar should be hidden after clicking Hide.");
    }

    [Test]
    public async Task HideAndShowSidebar_SidebarReappears()
    {
        await App.Sidebar.HideAsync();
        await App.Sidebar.ShowAsync();

        Assert.That(await App.Sidebar.IsVisibleAsync(), Is.True,
            "Sidebar should be visible again after clicking Show.");
    }
}
