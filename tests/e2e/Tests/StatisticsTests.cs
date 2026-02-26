namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for the Statistics page:
/// - Navigation from notebook to statistics and back
/// - Statistics page renders correctly when authenticated
/// - Settings dialog is accessible from the statistics page header
/// - Unauthenticated access redirects to login
/// </summary>
[TestFixture]
[Category("Statistics")]
public class StatisticsTests : E2ETestBase
{
    // ── Navigation ───────────────────────────────────────────────────────────

    [Test]
    public async Task NavigateToStatistics_ActivityBarItemOpensPage()
    {
        // Click the Statistics item in the ActivityBar
        var statsBtn = Page.Locator("nav[aria-label='Application sections'] button[aria-label='Statistics']").First;
        await statsBtn.ClickAsync();

        // Wait for the statistics page header to appear
        await Expect(Page.Locator("h1").GetByText("Statistics").First).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task NavigateBackToNotebook_ActivityBarItemOpensNotebook()
    {
        // Go to statistics first
        var statsBtn = Page.Locator("nav[aria-label='Application sections'] button[aria-label='Statistics']").First;
        await statsBtn.ClickAsync();
        await Expect(Page.Locator("h1").GetByText("Statistics").First).ToBeVisibleAsync(new() { Timeout = 5_000 });

        // Click the Notebook item in the ActivityBar
        var notebookBtn = Page.Locator("nav[aria-label='Application sections'] button[aria-label='Notebook']").First;
        await notebookBtn.ClickAsync();

        // Verify we're on the notebook by checking for the sidebar
        await Expect(Page.Locator("aside")).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task NavigateBackToNotebook_RestoresLastOpenedPage()
    {
        // Ensure we are on notebook route where sidebar is available.
        await Page.GotoAsync($"{BaseUrl}/notebook", new() { WaitUntil = WaitUntilState.NetworkIdle });

        // Select a known page in notebook first.
        await App.Sidebar.SelectPageAsync("React Hooks");
        var headerTitle = Page.GetByTestId("page-header-title");
        await Expect(headerTitle).ToContainTextAsync("React Hooks");

        // Navigate away to statistics.
        var statsBtn = Page.Locator("nav[aria-label='Application sections'] button[aria-label='Statistics']").First;
        await statsBtn.ClickAsync();
        await Expect(Page.Locator("h1").GetByText("Statistics").First).ToBeVisibleAsync(new() { Timeout = 5_000 });

        // Return to notebook.
        var notebookBtn = Page.Locator("nav[aria-label='Application sections'] button[aria-label='Notebook']").First;
        await notebookBtn.ClickAsync();

        // Last opened page should be restored.
        await Expect(Page.Locator("aside")).ToBeVisibleAsync(new() { Timeout = 5_000 });
        await Expect(headerTitle).ToContainTextAsync("React Hooks");
        Assert.That(Page.Url, Does.Contain("/notebook?page="), "Notebook URL should include the restored page query parameter.");
    }

    [Test]
    public async Task StatisticsPage_HasUserMenu()
    {
        // Navigate to statistics
        await Page.GotoAsync($"{BaseUrl}/statistics", new() { WaitUntil = WaitUntilState.NetworkIdle });

        // The UserMenu trigger should be visible in the statistics header
        var userMenuTrigger = Page.Locator(
            "header button[aria-label='User menu'], header button[aria-label='Меню користувача']"
        ).First;
        await Expect(userMenuTrigger).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task StatisticsPage_SettingsDialog_OpensFromActivityBar()
    {
        // Navigate to statistics
        await Page.GotoAsync($"{BaseUrl}/statistics", new() { WaitUntil = WaitUntilState.NetworkIdle });

        // Wait for page to be ready
        await Expect(Page.Locator("h1").GetByText("Statistics").First).ToBeVisibleAsync(new() { Timeout = 5_000 });

        // Click the Settings button in the ActivityBar
        await App.OpenSettingsAsync();

        // Settings dialog should appear
        Assert.That(await App.Settings.IsVisibleAsync(), Is.True);
    }

    [Test]
    public async Task StatisticsPage_NotebookActivityBarItem_IsNotActive()
    {
        // Navigate to statistics
        await Page.GotoAsync($"{BaseUrl}/statistics", new() { WaitUntil = WaitUntilState.NetworkIdle });

        // The Statistics ActivityBar item should be marked as current
        var statsBtn = Page.Locator("nav[aria-label='Application sections'] button[aria-label='Statistics']");
        await Expect(statsBtn.First).ToHaveAttributeAsync("aria-current", "page");

        // The Notebook ActivityBar item should NOT be marked as current
        var notebookBtn = Page.Locator("nav[aria-label='Application sections'] button[aria-label='Notebook']");
        await Expect(notebookBtn.First).Not.ToHaveAttributeAsync("aria-current", "page");
    }

    [Test]
    public async Task NotebookPage_UsesNotebookRoute()
    {
        // The root URL should redirect to /notebook
        await Page.GotoAsync(BaseUrl, new() { WaitUntil = WaitUntilState.NetworkIdle });

        // URL should now be /notebook (after redirect)
        Assert.That(Page.Url, Does.Contain("/notebook"),
            "Root URL should redirect to /notebook");
    }

    [Test]
    public async Task NotebookPage_ActivityBarItem_IsActiveOnNotebookRoute()
    {
        // Navigate to /notebook directly
        await Page.GotoAsync($"{BaseUrl}/notebook", new() { WaitUntil = WaitUntilState.NetworkIdle });

        // The Notebook ActivityBar item should be marked as current
        var notebookBtn = Page.Locator("nav[aria-label='Application sections'] button[aria-label='Notebook']");
        await Expect(notebookBtn.First).ToHaveAttributeAsync("aria-current", "page");
    }
}
