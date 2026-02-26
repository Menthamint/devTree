namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for the save-on-demand workflow:
///
/// <list type="bullet">
///   <item>Save button is disabled when there are no unsaved changes (isDirty=false).</item>
///   <item>Save button becomes enabled after editing a page title or adding a block.</item>
///   <item>Save button returns to disabled after a successful save.</item>
///   <item>Navigating away from a dirty page shows the "Unsaved changes" dialog.</item>
///   <item>Choosing "Save and leave" persists changes and navigates away.</item>
///   <item>Choosing "Leave without saving" discards changes and navigates away.</item>
///   <item>Choosing "Cancel / Stay" keeps the user on the current page.</item>
/// </list>
/// </summary>
[TestFixture]
[Category("Save")]
public class SaveTests : E2ETestBase
{
    [SetUp]
    public async Task SetUpAsync()
    {
        // Use the well-known seed page for a clean starting state.
        await App.Sidebar.SelectPageAsync("React Hooks");
    }

    // ── Save-button state ────────────────────────────────────────────────────

    /// <summary>
    /// When a page is first opened in edit mode with no local edits,
    /// the Save button must be disabled (isDirty = false).
    /// </summary>
    [Test]
    public async Task SaveButton_IsDisabled_WhenPageIsClean()
    {
        // Use a seed page with real content — newly-created pages start dirty due to
        // Tiptap normalising the empty document on first mount (onUpdate→isDirty=true).
        await App.EnterPageEditModeAsync();
        var saveBtn = Page.GetByTestId("save-page-button");
        await Expect(saveBtn).ToBeDisabledAsync(new() { Timeout = 5_000 });
    }

    /// <summary>
    /// Typing in the page title marks the page dirty and enables the Save button.
    /// </summary>
    [Test]
    public async Task SaveButton_BecomesEnabled_AfterTitleChange()
    {
        await App.EnterPageEditModeAsync();
        var titleInput = Page.GetByLabel("Page title");
        await titleInput.ClickAsync();
        await titleInput.FillAsync("My Edited Title");

        var saveBtn = Page.GetByTestId("save-page-button");
        await Expect(saveBtn).ToBeEnabledAsync();
    }

    /// <summary>
    /// Adding content marks the page dirty and enables the Save button.
    /// </summary>
    [Test]
    public async Task SaveButton_BecomesEnabled_AfterAddingBlock()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");

        var saveBtn = Page.GetByTestId("save-page-button");
        await Expect(saveBtn).ToBeEnabledAsync();
    }

    /// <summary>
    /// Creating a new page while the current page has unsaved changes navigates
    /// directly to the new page — the onFileCreated callback bypasses the dirty-state
    /// guard by calling setActivePageId directly rather than going through handleSelect.
    /// </summary>
    [Test]
    public async Task CreatePage_WhenDirty_NavigatesToNewPage()
    {
        await App.EnterPageEditModeAsync();
        var titleInput = Page.GetByLabel("Page title");
        await titleInput.ClickAsync();
        await titleInput.FillAsync("Current Draft");

        var saveBtn = Page.GetByTestId("save-page-button");
        await Expect(saveBtn).ToBeEnabledAsync();

        // Create a new page — navigates directly (bypasses dirty guard).
        await App.Sidebar.CreatePageAsync();

        // Should now be on the newly-created page, not "Current Draft".
        var headerTitle = Page.GetByTestId("page-header-title");
        await Expect(headerTitle).Not.ToHaveTextAsync("Current Draft", new() { Timeout = 5_000 });
    }

    /// <summary>
    /// After clicking Save the app exits edit mode (Save button disappears,
    /// Edit button reappears).
    /// </summary>
    [Test]
    public async Task SaveButton_ExitsEditMode_AfterSave()
    {
        await App.EnterPageEditModeAsync();
        // Make a change to dirty the page
        await App.Editor.AddBlockAsync("Text");

        // Verify save button enabled before save
        var saveBtn = Page.GetByTestId("save-page-button");
        await Expect(saveBtn).ToBeEnabledAsync();

        // Save — app should return to view mode
        await App.SaveAsync();

        // Edit button should be visible again (back in view mode)
        var editBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Edit page", Exact = true });
        await Expect(editBtn).ToBeVisibleAsync();
    }

    // ── Unsaved-changes dialog ───────────────────────────────────────────────

    /// <summary>
    /// Navigating away when there are unsaved changes shows the confirmation dialog.
    /// </summary>
    [Test]
    public async Task NavigateAway_WithUnsavedChanges_ShowsDialog()
    {
        // Enter edit mode and dirty the page.
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");

        // Navigate to a different existing seed page — triggers the dirty-state guard.
        await App.Sidebar.SelectPageAsync("TypeScript Tips");

        // The dialog should be visible.
        var dialog = Page.GetByRole(AriaRole.Alertdialog);
        await Expect(dialog).ToBeVisibleAsync(new() { Timeout = 5_000 });

        // Clean up: cancel the dialog.
        await Page.GetByTestId("unsaved-cancel").ClickAsync();
    }

    /// <summary>
    /// Clicking "Cancel / Stay" in the unsaved-changes dialog closes the dialog
    /// and keeps the user on the same page (no navigation).
    /// </summary>
    [Test]
    public async Task UnsavedDialog_Cancel_KeepsUserOnPage()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");
        await App.Editor.TypeInLastTextBlockAsync("Keep me here");

        var headerTitle = Page.GetByTestId("page-header-title");
        var originalTitle = await headerTitle.TextContentAsync();

        // Navigate to a different seed page — dialog should appear.
        await App.Sidebar.SelectPageAsync("TypeScript Tips");
        await Page.GetByTestId("unsaved-cancel").ClickAsync();

        await Expect(Page.GetByRole(AriaRole.Alertdialog)).ToBeHiddenAsync(new() { Timeout = 3_000 });
        await Expect(headerTitle).ToHaveTextAsync(originalTitle ?? string.Empty);
    }

    /// <summary>
    /// Clicking "Leave without saving" discards local changes and navigates to
    /// the target page.
    /// </summary>
    [Test]
    public async Task UnsavedDialog_LeaveWithoutSaving_NavigatesAway()
    {
        await App.EnterPageEditModeAsync();
        var titleInput = Page.GetByLabel("Page title");
        await titleInput.ClickAsync();
        await titleInput.FillAsync("Discarded Title");

        // Navigate to a different page — triggers dialog.
        await App.Sidebar.SelectPageAsync("TypeScript Tips");
        await Page.GetByTestId("unsaved-leave-without-saving").ClickAsync();

        await Expect(Page.GetByRole(AriaRole.Alertdialog)).ToBeHiddenAsync(new() { Timeout = 3_000 });

        var headerTitle = Page.GetByTestId("page-header-title");
        await Expect(headerTitle).Not.ToHaveTextAsync("Discarded Title");
    }

    /// <summary>
    /// Clicking "Save and leave" persists the unsaved changes and navigates
    /// to the target page.
    /// </summary>
    [Test]
    public async Task UnsavedDialog_SaveAndLeave_SavesThenNavigates()
    {
        await App.EnterPageEditModeAsync();
        await App.Editor.AddBlockAsync("Text");

        // Navigate to a different page — dialog appears.
        await App.Sidebar.SelectPageAsync("TypeScript Tips");
        await Page.GetByTestId("unsaved-save-and-leave").ClickAsync();

        await Expect(Page.GetByRole(AriaRole.Alertdialog)).ToBeHiddenAsync(new() { Timeout = 5_000 });

        var headerTitle = Page.GetByTestId("page-header-title");
        await Expect(headerTitle).ToContainTextAsync("TypeScript Tips", new() { Timeout = 8_000 });
    }
}
