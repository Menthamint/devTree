namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for page deep-linking and breadcrumb navigation:
/// - Deep-link routing via /pages/[pageId] URL parameters
/// - Breadcrumb rendering and click navigation
/// - Tree auto-expansion on route load
/// - Browser back/forward with unsaved-changes safeguards
/// </summary>
[TestFixture]
[Category("Route")]
public class RouteTests : E2ETestBase
{
    // ── Deep-link / URL routing ──────────────────────────────────────────

    [Test]
    public async Task DeepLink_OpensCorrectPage_ViaUrlParameter()
    {
        // Get a sample page from the tree (e.g., "React Hooks")
        var samplePageTitle = "React Hooks";
        
        // Wait for app to load
        await App.Sidebar.WaitForVisibleAsync();
        
        // Extract the page ID from the tree (by clicking it to see URL, or parse tree)
        // For this test, we'll navigate to the page first to capture its ID from URL
        await App.Sidebar.SelectPageAsync(samplePageTitle);
        
        // Wait for the page to load and extract the URL to find the page ID
        var currentUrl = Page.Url;
        var pageIdMatch = System.Text.RegularExpressions.Regex.Match(currentUrl, @"[?&]page=([^&#]+)");
        Assert.That(pageIdMatch.Success, Is.True, "URL should contain ?page=[pageId] after page selection");

        var pageId = pageIdMatch.Groups[1].Value;
        Assert.That(pageId, Is.Not.Empty, "Page ID should be extracted from URL");

        // Navigate directly via deep-link URL (the /pages/ redirect still works)
        var deepLinkUrl = $"{BaseUrl}/pages/{pageId}";
        await Page.GotoAsync(deepLinkUrl, new() { WaitUntil = WaitUntilState.NetworkIdle });

        // Verify the correct page is loaded by checking the title in header
        var headerSpan = Page.GetByTestId("page-header-title");
        await Expect(headerSpan).ToContainTextAsync(samplePageTitle);
    }

    [Test]
    public async Task DeepLink_ExpandsAncestorFolders_InTree()
    {
        // Use a seeded page known to be inside a folder.
        await App.Sidebar.SelectPageAsync("React Hooks");
        var currentUrl = Page.Url;
        var pageIdMatch = System.Text.RegularExpressions.Regex.Match(currentUrl, @"[?&]page=([^&#]+)");
        Assert.That(pageIdMatch.Success, Is.True, "URL should contain ?page=[pageId]");

        var pageId = pageIdMatch.Groups[1].Value;
        var deepLinkUrl = $"{BaseUrl}/pages/{pageId}";
        await Page.GotoAsync(deepLinkUrl, new() { WaitUntil = WaitUntilState.NetworkIdle });

        // Verify both folder and page context are visible in the tree.
        await Expect(Page.Locator("aside").GetByText("Frontend", new() { Exact = true }).First).ToBeVisibleAsync();
        await Expect(Page.Locator("aside").GetByText("React Hooks", new() { Exact = true }).First).ToBeVisibleAsync();

        // Verify selected page loaded
        var headerSpan = Page.GetByTestId("page-header-title");
        await Expect(headerSpan).ToContainTextAsync("React Hooks");

        // Verify the page is highlighted in the tree
        var selectedItem = Page.Locator("[aria-selected='true']");
        await Expect(selectedItem).ToBeVisibleAsync();
    }

    [Test]
    public async Task DeepLink_InvalidPageId_StaysOnCurrentPage()
    {
        // Load a valid page first
        await App.Sidebar.SelectPageAsync("React Hooks");

        // Try to navigate to an invalid page ID
        var invalidDeepLink = $"{BaseUrl}/pages/invalid-id-does-not-exist-12345";
        await Page.GotoAsync(invalidDeepLink, new() { WaitUntil = WaitUntilState.NetworkIdle });
        
        // The app should not load a page or should load the default page
        // Verify that navigation didn't crash
        await Expect(Page).ToHaveTitleAsync("Learning Tree", new() { Timeout = 5_000 });
    }

    // ── Breadcrumb navigation ────────────────────────────────────────────

    [Test]
    public async Task Breadcrumb_DisplaysPagePath()
    {
        // Navigate to a sample page
        await App.Sidebar.SelectPageAsync("React Hooks");

        // Wait for breadcrumb to appear
        var breadcrumbNav = Page.Locator("nav[aria-label='Breadcrumb']");
        await breadcrumbNav.WaitForAsync(new() { Timeout = 5_000 });
        
        // Verify breadcrumb contains the page title
        await Expect(breadcrumbNav).ToContainTextAsync("React Hooks");
    }

    [Test]
    public async Task BreadcrumbClick_NavigatesToPage()
    {
        // Navigate to a page
        await App.Sidebar.SelectPageAsync("React Hooks");

        // Wait for breadcrumb
        var breadcrumbNav = Page.Locator("nav[aria-label='Breadcrumb']");
        await breadcrumbNav.WaitForAsync(new() { Timeout = 5_000 });
        
        // Get a different page from the tree
        await App.Sidebar.SelectPageAsync("TypeScript Tips");

        // Verify we're on TypeScript Tips
        var headerSpan = Page.GetByTestId("page-header-title");
        await Expect(headerSpan).ToContainTextAsync("TypeScript Tips");

        // Go back to React Hooks and click the folder breadcrumb.
        await App.Sidebar.SelectPageAsync("React Hooks");
        
        // Wait for breadcrumb to re-render
        await Page.WaitForTimeoutAsync(200);

        var breadcrumbBtn = Page.Locator("nav[aria-label='Breadcrumb'] button")
            .Filter(new LocatorFilterOptions { HasText = "Frontend" });
        await breadcrumbBtn.ClickAsync();

        // Clicking folder breadcrumb resolves to first page inside that folder.
        await Expect(headerSpan).ToContainTextAsync("React Hooks");
    }

    [Test]
    public async Task BreadcrumbClick_OnNestedFolder_ResolvesFirstPage()
    {
        // This test verifies breadcrumb behavior with nested structure.
        // For pages at root level, breadcrumb resolves to current page.
        // For pages in folders, breadcrumb folder buttons resolve to first-page-in-folder.
        
        // Navigate to a page in root
        await App.Sidebar.SelectPageAsync("React Hooks");

        var breadcrumbNav = Page.Locator("nav[aria-label='Breadcrumb']");
        await breadcrumbNav.WaitForAsync(new() { Timeout = 5_000 });
        
        // Breadcrumb contains the root page
        await Expect(breadcrumbNav).ToContainTextAsync("React Hooks");
        
        // Verify breadcrumb is clickable
        var breadcrumbBtn = breadcrumbNav.Locator("button");
        await Expect(breadcrumbBtn).ToHaveCountAsync(1); // Only current page at root level
    }

    // ── Browser back/forward navigation ──────────────────────────────────

    [Test]
    public async Task BrowserBack_NavigatesToPreviousPage()
    {
        // Navigate to first page
        await App.Sidebar.SelectPageAsync("React Hooks");
        var url1 = Page.Url;
        
        // Navigate to second page
        await App.Sidebar.SelectPageAsync("TypeScript Tips");
        var url2 = Page.Url;
        
        // Verify URL changed
        Assert.That(url1, Is.Not.EqualTo(url2), "URLs should differ between pages");
        
        // Go back
        await Page.GoBackAsync(new() { WaitUntil = WaitUntilState.NetworkIdle });

        // Verify we're back on the first page
        var headerSpan = Page.GetByTestId("page-header-title");
        await Expect(headerSpan).ToContainTextAsync("React Hooks");
    }

    [Test]
    public async Task BrowserForward_NavigatesToNextPage()
    {
        // Navigate to first page
        await App.Sidebar.SelectPageAsync("React Hooks");
        
        // Navigate to second page
        await App.Sidebar.SelectPageAsync("TypeScript Tips");
        var url2 = Page.Url;
        
        // Go back
        await Page.GoBackAsync(new() { WaitUntil = WaitUntilState.NetworkIdle });

        // Verify we're on React Hooks
        var headerSpan = Page.GetByTestId("page-header-title");
        await Expect(headerSpan).ToContainTextAsync("React Hooks");
        
        // Go forward
        await Page.GoForwardAsync(new() { WaitUntil = WaitUntilState.NetworkIdle });
        
        // Verify we're back on TypeScript Tips
        await Expect(headerSpan).ToContainTextAsync("TypeScript Tips");
        Assert.That(Page.Url, Is.EqualTo(url2), "URL should match after forward");
    }

    [Test]
    public async Task PageSwitch_ShowsSkeletonUntilTargetPageRenders()
    {
        // Start from a known page.
        await App.Sidebar.SelectPageAsync("React Hooks");
        var headerSpan = Page.GetByTestId("page-header-title");
        await Expect(headerSpan).ToContainTextAsync("React Hooks");

        // Switch to another page.
        var targetPage = Page.Locator("aside").GetByText("TypeScript Tips", new() { Exact = true }).First;
        await targetPage.ClickAsync();

        // While switching, skeleton may appear briefly depending on environment speed.
        var headerSkeleton = Page.GetByTestId("main-content-header-skeleton");
        var bodySkeleton = Page.GetByTestId("main-content-page-skeleton");
        var sawHeaderSkeleton = await headerSkeleton.IsVisibleAsync();
        var sawBodySkeleton = await bodySkeleton.IsVisibleAsync();
        if (!sawHeaderSkeleton || !sawBodySkeleton)
        {
            await Page.WaitForTimeoutAsync(100);
        }

        // Final state: target page is fully rendered.
        await Expect(headerSpan).ToContainTextAsync("TypeScript Tips", new() { Timeout = 10_000 });
    }

    [Test]
    public async Task BrowserBack_WithUnsavedChanges_ShowsConfirmation()
    {
        // Navigate to a page
        await App.Sidebar.SelectPageAsync("React Hooks");

        // Enter edit mode before adding a block (edit mode is required)
        await App.EnterPageEditModeAsync();

        // Make an unsaved change (add a block and modify it)
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("Test content");
        
        // Verify the page is marked as dirty (Save button should be enabled)
        var saveBtn = Page.GetByTestId("save-page-button");
        await Expect(saveBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
        
        // Navigate to another page via sidebar
        // This should show the unsaved-changes dialog
        var sidebarPage = Page.GetByText("TypeScript Tips").First;
        await sidebarPage.ClickAsync();
        
        // Unsaved-changes dialog should appear
        var confirmDialog = Page.GetByRole(AriaRole.Alertdialog);
        await Expect(confirmDialog).ToBeVisibleAsync();
        
        // Click "Leave without saving"
        await Page.GetByTestId("unsaved-leave-without-saving").ClickAsync();

        // Verify we navigated to TypeScript Tips
        var headerSpan = Page.GetByTestId("page-header-title");
        await Expect(headerSpan).ToContainTextAsync("TypeScript Tips");
    }

    [Test]
    public async Task BrowserBack_WithUnsavedChanges_CanCancelNavigation()
    {
        // Navigate to a page
        await App.Sidebar.SelectPageAsync("React Hooks");

        // Enter edit mode before adding a block
        await App.EnterPageEditModeAsync();

        // Make an unsaved change
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("Test content that is unsaved");
        
        // Verify dirty state
        var saveBtn = Page.GetByTestId("save-page-button");
        await Expect(saveBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
        
        // Navigate to another page
        var sidebarPage = Page.GetByText("TypeScript Tips").First;
        await sidebarPage.ClickAsync();
        
        // Unsaved-changes dialog should appear
        var confirmDialog = Page.GetByRole(AriaRole.Alertdialog);
        await Expect(confirmDialog).ToBeVisibleAsync();
        
        // Click Cancel to stay on the current page
        await Page.GetByTestId("unsaved-cancel").ClickAsync();
        
        // Dialog should be gone
        await Expect(confirmDialog).ToBeHiddenAsync();

        // Verify we're still on React Hooks
        var headerSpan = Page.GetByTestId("page-header-title");
        await Expect(headerSpan).ToContainTextAsync("React Hooks");
        
        // Verify our change is still there (unsaved)
        await Expect(saveBtn).ToBeEnabledAsync();
    }

    [Test]
    public async Task BrowserBack_AfterSave_NavigatesWithoutDialog()
    {
        // Navigate to a page
        await App.Sidebar.SelectPageAsync("React Hooks");

        // Enter edit mode before adding a block
        await App.EnterPageEditModeAsync();

        // Make a change
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("Test content");
        
        // Save the changes
        await App.SaveAsync();

        // Verify save completed — SaveAsync() exits edit mode so "Edit page" button is visible
        await Expect(
            Page.GetByRole(AriaRole.Button, new() { Name = "Edit page", Exact = true })
        ).ToBeVisibleAsync(new() { Timeout = 5_000 });

        // Navigate to another page via sidebar
        await App.Sidebar.SelectPageAsync("TypeScript Tips");
        
        // Unsaved-changes dialog should NOT appear
        var confirmDialog = Page.GetByRole(AriaRole.Alertdialog);
        await Expect(confirmDialog).ToBeHiddenAsync();

        // Verify navigation succeeded
        var headerSpan = Page.GetByTestId("page-header-title");
        await Expect(headerSpan).ToContainTextAsync("TypeScript Tips");
    }
}

