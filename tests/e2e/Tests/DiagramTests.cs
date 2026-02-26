namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for the Diagram block — powered by Excalidraw (replaced the old
/// Mermaid text-editor in the "diagram imp" commit).
///
/// What we verify:
///   - The Excalidraw canvas element renders on a page that has a diagram block.
///   - Adding a new diagram block enters edit mode and shows the Excalidraw toolbar.
///   - The fullscreen toggle button is visible in edit mode.
///   - Exiting edit mode switches to view mode (no toolbar).
/// </summary>
[TestFixture]
[Category("Diagram")]
public class DiagramTests : E2ETestBase
{
    // ── Canvas renders ────────────────────────────────────────────────────────

    [Test]
    public async Task DiagramBlock_RendersExcalidrawCanvas()
    {
        // Create a fresh page, add a diagram block, save it, then reload to
        // verify the Excalidraw canvas renders in VIEW mode (not just edit mode).
        await App.Sidebar.CreatePageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Diagram");

        // Wait for canvas to appear in edit mode first.
        var canvas = Page.Locator(".excalidraw canvas").Last;
        await Expect(canvas).ToBeVisibleAsync(new() { Timeout = 15_000 });

        // Save and exit edit mode to verify view-mode rendering.
        await App.SaveAsync();

        // Canvas should still be visible in view mode.
        var viewCanvas = Page.Locator(".excalidraw canvas").First;
        await Expect(viewCanvas).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    // ── Add a new diagram block ───────────────────────────────────────────────

    [Test]
    public async Task AddDiagramBlock_RendersExcalidrawCanvasInEditMode()
    {
        await App.Sidebar.CreatePageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Diagram");

        // After adding (new blocks auto-start in edit mode), the Excalidraw
        // canvas must be visible within reasonable time (dynamic import + render).
        var canvas = Page.Locator(".excalidraw canvas").Last;
        await Expect(canvas).ToBeVisibleAsync(new() { Timeout = 15_000 });
    }

    [Test]
    public async Task AddDiagramBlock_EditModeShowsExcalidrawToolbar()
    {
        await App.Sidebar.CreatePageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Diagram");

        // In edit mode (viewModeEnabled=false) the Excalidraw App-toolbar is visible.
        var toolbar = Page.Locator(".excalidraw .App-toolbar").Last;
        await Expect(toolbar).ToBeVisibleAsync(new() { Timeout = 15_000 });
    }

    // ── Fullscreen toggle ─────────────────────────────────────────────────────

    [Test]
    public async Task ViewMode_FullscreenButtonIsVisible()
    {
        // Create page with a diagram block, save, then verify the fullscreen
        // button is visible in view mode (always present in the BlockHeader).
        await App.Sidebar.CreatePageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Diagram");

        var canvas = Page.Locator(".excalidraw canvas").Last;
        await Expect(canvas).ToBeVisibleAsync(new() { Timeout = 15_000 });

        // Save → enters view mode
        await App.SaveAsync();

        // The fullscreen toggle button is always visible in the canvas BlockHeader
        var fullscreenBtn = Page.GetByTestId("canvas-fullscreen-toggle").First;
        await Expect(fullscreenBtn).ToBeVisibleAsync(new() { Timeout = 15_000 });
    }

    [Test]
    public async Task EditMode_FullscreenButtonIsVisible()
    {
        await App.Sidebar.CreatePageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Diagram");

        // The fullscreen toggle button is visible in the canvas BlockHeader in edit mode too
        var fullscreenBtn = Page.GetByTestId("canvas-fullscreen-toggle").Last;
        await Expect(fullscreenBtn).ToBeVisibleAsync(new() { Timeout = 15_000 });
    }

    [Test]
    public async Task FullscreenButton_TogglesFullscreenOverlay()
    {
        await App.Sidebar.CreatePageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Diagram");

        // Enter fullscreen
        var fullscreenBtn = Page.GetByTestId("canvas-fullscreen-toggle").Last;
        await Expect(fullscreenBtn).ToBeVisibleAsync(new() { Timeout = 15_000 });
        await fullscreenBtn.ClickAsync();

        // The fullscreen overlay portal should be visible
        var overlay = Page.GetByTestId("canvas-fullscreen-overlay");
        await Expect(overlay).ToBeVisibleAsync(new() { Timeout = 5_000 });

        // Exit fullscreen via the minimize button in the overlay
        var minimizeBtn = Page.GetByTestId("canvas-fullscreen-toggle").Last;
        await minimizeBtn.ClickAsync();
        await Expect(overlay).Not.ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    // ── View mode ─────────────────────────────────────────────────────────────

    [Test]
    public async Task ExitingEditMode_HidesExcalidrawToolbar()
    {
        await App.Sidebar.CreatePageAsync();
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Diagram");

        // Wait for canvas to appear in edit mode
        var canvas = Page.Locator(".excalidraw canvas").Last;
        await Expect(canvas).ToBeVisibleAsync(new() { Timeout = 15_000 });

        // Exit page-level edit mode by saving
        await App.SaveAsync();

        // In view mode (viewModeEnabled=true) the Excalidraw toolbar is hidden.
        var toolbar = Page.Locator(".excalidraw .App-toolbar").Last;
        await Expect(toolbar).Not.ToBeVisibleAsync(new() { Timeout = 5_000 });
    }
}
