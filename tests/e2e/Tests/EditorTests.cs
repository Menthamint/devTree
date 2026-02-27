using System.Text.RegularExpressions;

namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for the block editor:
/// adding, editing, and deleting blocks of every type.
/// </summary>
[TestFixture]
[Category("Editor")]
public class EditorTests : E2ETestBase
{
    [SetUp]
    public async Task NavigateToPageAsync()
    {
        // Start each test on a fresh page created by the test itself.
        // CreatePageAsync returns the newly created unique "Untitled*" row,
        // which we click directly to avoid ambiguity with existing pages.
        await App.Sidebar.CreatePageAsync();
    }

    // ── Block count baseline ─────────────────────────────────────────────────

    [Test]
    public async Task NewPage_StartsWithNoBlocks()
    {
        var count = await App.Editor.BlockCountAsync();
        Assert.That(count, Is.LessThanOrEqualTo(1));
    }

    // ── Add blocks ───────────────────────────────────────────────────────────

    [Test]
    public async Task AddTextBlock_AppearsInEditor()
    {
        await App.EnterPageEditModeAsync();
        var beforeCount = await App.Editor.BlockCountAsync();

        await App.Editor.AddBlockAsync("Text");

        var afterCount = await App.Editor.BlockCountAsync();
        Assert.That(afterCount, Is.GreaterThan(beforeCount));
    }

    [Test]
    public async Task AddTextBlock_CanTypeContent()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("Hello from E2E test");

        var proseMirror = Page.Locator(".ProseMirror").Last;
        await Expect(proseMirror).ToContainTextAsync("Hello from E2E test");
    }

    [Test]
    public async Task AddCodeBlock_RendersMonacoEditor()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Code");

        await Expect(App.Editor.LastCodeEditor).ToBeVisibleAsync();
    }

    [Test]
    public async Task AddCodeBlock_CanChangeLanguage()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Code");
        await App.Editor.SetCodeLanguageAsync("typescript");

        // The CodeBlock uses a <select> element; check its current value.
        var langSelect = Page.Locator("select").Last;
        await Expect(langSelect).ToHaveValueAsync("typescript");
    }

    [Test]
    public async Task AddTableBlock_ShowsDefaultColumns()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Table");

        // In edit mode the headers render as inputs — verify their values
        var headers = Page.Locator("table thead input");
        await Expect(headers.First).ToHaveValueAsync("Column 1");
        await Expect(headers.Nth(1)).ToHaveValueAsync("Column 2");
    }

    [Test]
    public async Task AddTableBlock_CanFillCells()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Table");
        await App.Editor.FillTableHeaderAsync(0, "Name");
        await App.Editor.FillTableCellAsync(0, 0, "Alice");

        // Verify via ToHaveValueAsync rather than display-value selector
        var firstCell = Page.Locator("table tbody tr").First.Locator("input").First;
        await Expect(firstCell).ToHaveValueAsync("Alice");
    }

    [Test]
    public async Task AddTableBlock_CanAddRow()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Table");
        var initialRows = await Page.Locator("table tbody tr").CountAsync();

        await App.Editor.AddTableRowAsync();

        var afterRows = await Page.Locator("table tbody tr").CountAsync();
        Assert.That(afterRows, Is.EqualTo(initialRows + 1));
    }

    [Test]
    public async Task AddTableBlock_CanAddColumn()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Table");
        var initialCols = await Page.Locator("table thead th").CountAsync();

        await App.Editor.AddTableColumnAsync();

        var afterCols = await Page.Locator("table thead th").CountAsync();
        // +1 for new column, the "+" button column stays
        Assert.That(afterCols, Is.EqualTo(initialCols + 1));
    }

    [Test]
    public async Task AddChecklistBlock_ShowsAddItemButton()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Checklist");

        await Expect(Page.GetByRole(AriaRole.Button, new() { Name = "Add item" }).Last).ToBeVisibleAsync();
    }

    [Test]
    public async Task AddChecklistBlock_CanAddAndCheckItem()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Checklist");
        await App.Editor.TypeAgendaItemAsync("Learn Playwright");

        // Verify the text input has the expected value
        var agendaInputs = Page.Locator("input[placeholder='Item\u2026']");
        await Expect(agendaInputs.Last).ToHaveValueAsync("Learn Playwright");

        // Checkbox is a sibling of the text input inside the same flex row
        var checkbox = agendaInputs.Last.Locator("xpath=../input[@type='checkbox']");
        await checkbox.ClickAsync();
        await Expect(checkbox).ToBeCheckedAsync();
    }

    [Test]
    public async Task AddImageBlock_ShowsEmptyForm()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Image");

        await Expect(Page.GetByPlaceholder("Image URL\u2026")).ToBeVisibleAsync();
    }

    [Test]
    public async Task AddImageBlock_CanSetUrl()
    {
        await App.EnterPageEditModeAsync();
        const string imgUrl =
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/512px-Typescript_logo_2020.svg.png";

        await App.Editor.AddBlockAsync("Image");
        await App.Editor.SetImageUrlAsync(imgUrl);

        // After saving, the image element should appear
        var img = Page.Locator("img[src*='Typescript']");
        await Expect(img).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    [Test]
    public async Task AddVideoBlock_ShowsEmptyForm()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Video");

        await Expect(Page.GetByPlaceholder("YouTube or video URL\u2026")).ToBeVisibleAsync();
    }

    [Test]
    public async Task AddVideoBlock_CanRenderYoutubeEmbed()
    {
        await App.EnterPageEditModeAsync();
        const string videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

        await App.Editor.AddBlockAsync("Video");
        await App.Editor.SetVideoUrlAsync(videoUrl);

        var iframe = Page.GetByTestId("video-block-iframe").Last;
        await Expect(iframe).ToBeVisibleAsync();
        await Expect(iframe).ToHaveAttributeAsync("src", new Regex("youtube\\.com/embed/dQw4w9WgXcQ", RegexOptions.IgnoreCase));
    }

    // ── Delete blocks ────────────────────────────────────────────────────────

    [Test]
    public async Task DeleteBlock_RemovesItFromEditor()
    {
        // Add a fresh text block so we know exactly which one to delete
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        var beforeCount = await App.Editor.BlockCountAsync();

        await App.Editor.DeleteBlockAsync(beforeCount - 1);

        var afterCount = await App.Editor.BlockCountAsync();
        Assert.That(afterCount, Is.EqualTo(beforeCount - 1));
    }

    // ── Save ─────────────────────────────────────────────────────────────────

    [Test]
    public async Task SaveButton_ShowsSavedFeedback()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("dirty");

        var saveBtn = Page.GetByTestId("save-page-button");
        await Expect(saveBtn).ToBeEnabledAsync();

        await App.SaveAsync();

        // After save, edit mode exits — "Edit page" button reappears
        var editBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Edit page" });
        await Expect(editBtn).ToBeVisibleAsync();
    }

    [Test]
    public async Task Toolbar_AddLink_AppliesAnchorToSelection()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.TypeInLastTextBlockAsync("LinkMe");

        var editor = Page.Locator(".page-editor-content").Last;
        await editor.ClickAsync();
        await Page.Keyboard.PressAsync("Meta+A");

        await App.Editor.ClickToolbarButtonAsync("Add link");

        var urlInput = Page.GetByPlaceholder("https://").First;
        await Expect(urlInput).ToBeVisibleAsync();
        await urlInput.FillAsync("https://example.com");
        await Page.GetByRole(AriaRole.Button, new() { Name = "Apply" }).First.ClickAsync(new() { Force = true });

        var linkedAnchor = Page.Locator(".page-editor-content a[href='https://example.com']").First;
        await Expect(linkedAnchor).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task Toolbar_AddBookmark_AppliesMarkToSelection()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.TypeInLastTextBlockAsync("AnnotateMe");

        var editor = Page.Locator(".page-editor-content").Last;
        await editor.ClickAsync();
        await Page.Keyboard.PressAsync("Meta+A");

        await App.Editor.ClickToolbarButtonAsync("Bookmarks");

        await Expect(Page.GetByText("No bookmarks. Select text and click 🔖 to add one.")).ToBeVisibleAsync();
    }
}
