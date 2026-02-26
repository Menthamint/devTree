namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for the tag system:
/// adding, removing, filtering by tag, and tag search.
/// </summary>
[TestFixture]
[Category("Tags")]
public class TagTests : E2ETestBase
{
    [SetUp]
    public async Task NavigateToPageAsync()
    {
        await App.Sidebar.SelectPageAsync("React Hooks");
    }

    // ── Tag bar visibility ────────────────────────────────────────────────────

    [Test]
    public async Task TagBar_ShowsChipsInReadMode()
    {
        // React Hooks page has tags — they should be visible as read-only chips
        // without entering edit mode.
        await Expect(Page.GetByText("react").First).ToBeVisibleAsync();
    }

    [Test]
    public async Task TagBar_InputVisibleInEditMode()
    {
        await App.EnterPageEditModeAsync();
        var tagInput = Page.GetByTestId("page-tag-input");
        await Expect(tagInput).ToBeVisibleAsync();
    }

    [Test]
    public async Task SamplePage_ShowsPreloadedTags()
    {
        // React Hooks sample page ships with tags: react, hooks, frontend
        await Expect(Page.GetByText("react").First).ToBeVisibleAsync();
        await Expect(Page.GetByText("hooks").First).ToBeVisibleAsync();
    }

    // ── Adding tags ───────────────────────────────────────────────────────────

    [Test]
    public async Task AddTag_AppearsAsChip()
    {
        await App.EnterPageEditModeAsync();
        var tagInput = Page.GetByTestId("page-tag-input");
        await tagInput.ClickAsync();
        await tagInput.FillAsync("algorithms");
        await tagInput.PressAsync("Enter");

        // The new tag chip should appear
        await Expect(Page.GetByText("algorithms").First).ToBeVisibleAsync();
    }

    [Test]
    public async Task AddTag_IsCasedToLowercase()
    {
        await App.EnterPageEditModeAsync();
        var tagInput = Page.GetByTestId("page-tag-input");
        await tagInput.ClickAsync();
        await tagInput.FillAsync("TypeScript");
        await tagInput.PressAsync("Enter");

        await Expect(Page.GetByText("typescript").First).ToBeVisibleAsync();
    }

    [Test]
    public async Task AddTag_ByCommaDelimiter()
    {
        // Navigate to a fresh page with no tags
        await App.Sidebar.CreatePageAsync();
        await Page.WaitForTimeoutAsync(300);

        await App.EnterPageEditModeAsync();
        var tagInput = Page.GetByTestId("page-tag-input");
        await tagInput.ClickAsync();
        await tagInput.FillAsync("performance");
        // Simulate comma key — should commit the tag
        await tagInput.PressAsync(",");

        await Expect(Page.GetByText("performance").First).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    // ── Removing tags ─────────────────────────────────────────────────────────

    [Test]
    public async Task RemoveTag_ChipDisappearsAfterClick()
    {
        await App.EnterPageEditModeAsync();
        // "react" is a pre-loaded tag on the React Hooks page
        var removeBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Remove tag react" });
        await removeBtn.ClickAsync();

        await Expect(Page.GetByRole(AriaRole.Button, new() { Name = "Remove tag react" }))
            .Not.ToBeVisibleAsync(new() { Timeout = 2_000 });
    }

    // ── Sidebar tag cloud ─────────────────────────────────────────────────────

    [Test]
    public async Task TagCloud_ShowsAllUniqueTagsInSidebar()
    {
        // Sample pages include "react" and "typescript" tags
        // They should appear as filter chips in the sidebar tag cloud
        var sidebar = Page.Locator("aside");
        await Expect(sidebar.GetByRole(AriaRole.Button, new() { Name = "react" }))
            .ToBeVisibleAsync();
        await Expect(sidebar.GetByRole(AriaRole.Button, new() { Name = "frontend" }))
            .ToBeVisibleAsync();
    }

    [Test]
    public async Task ClickTagFilter_ShowsOnlyMatchingPages()
    {
        // Click the "typescript" tag in the sidebar tag cloud
        var sidebar = Page.Locator("aside");
        await sidebar.GetByRole(AriaRole.Button, new() { Name = "typescript" }).ClickAsync();

        // The search results should contain "TypeScript Tips" but not show the full tree
        await Expect(Page.GetByText("TypeScript Tips").First).ToBeVisibleAsync();
    }

    [Test]
    public async Task ClearTagFilter_ReturnsToFullTree()
    {
        var sidebar = Page.Locator("aside");

        // Activate tag filter
        await sidebar.GetByRole(AriaRole.Button, new() { Name = "typescript" }).ClickAsync();

        // The active tag shows as an indigo chip — click × to clear
        var clearBtn = sidebar.Locator("button.rounded-full.bg-indigo-600");
        await clearBtn.ClickAsync();

        // Full tree should be visible again
        await Expect(Page.GetByText("React Hooks").First).ToBeVisibleAsync();
    }
}
