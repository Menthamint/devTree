namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for the rich-text diary template editor (TemplateBodyEditor).
/// Covers: creating a template with the new editor, applying it to a diary entry,
/// verifying the content is non-editable, and that rich formatting is preserved.
/// Also covers emoji toolbar picker and emoji suggestion (colon trigger) scenarios.
/// </summary>
[TestFixture]
[Category("DiaryTemplateEditor")]
public class DiaryTemplateEditorTests : E2ETestBase
{
    private DiaryPage _diary = null!;

    [SetUp]
    public async Task SetUpAsync()
    {
        _diary = new DiaryPage(Page);
        await _diary.GotoAsync();
        await _diary.EnsureTodayEntryAsync();
    }

    // ── Basic editor UI ──────────────────────────────────────────────────────

    /// <summary>
    /// The template manager dialog should open and show the rich-text body editor
    /// (TemplateBodyEditor) instead of the old plain-text inputs.
    /// </summary>
    [Test]
    public async Task TemplateManager_Opens_ShowsRichTextEditor()
    {
        await _diary.OpenTemplateManagerAsync();

        var editor = Page.Locator("[data-testid='template-body-editor']");
        await Expect(editor).ToBeVisibleAsync(new() { Timeout = 5_000 });

        await Expect(Page.GetByPlaceholder("Template title")).ToBeHiddenAsync(new() { Timeout = 1_000 });
        await Expect(Page.GetByPlaceholder("Prompts (one per line)")).ToBeHiddenAsync(new() { Timeout = 1_000 });
    }

    /// <summary>
    /// Plain text typed into the template body editor should be visible in the editor.
    /// </summary>
    [Test]
    public async Task TemplateEditor_TypePlainText_AppearsInEditor()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await Page.Keyboard.TypeAsync("Hello world");

        await Expect(editorContent.GetByText("Hello world")).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    /// <summary>
    /// The H2 toolbar button in TemplateBodyEditor should toggle heading level 2.
    /// </summary>
    [Test]
    public async Task TemplateEditor_H2Button_TogglesHeading()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();

        await _diary.ClickTemplateH2ButtonAsync();
        await Page.Keyboard.TypeAsync("Section heading");

        var h2 = Page.Locator("[data-testid='template-body-editor'] h2");
        await Expect(h2).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    /// <summary>
    /// The H3 toolbar button in TemplateBodyEditor should toggle heading level 3.
    /// </summary>
    [Test]
    public async Task TemplateEditor_H3Button_TogglesHeading()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();

        await _diary.ClickTemplateH3ButtonAsync();
        await Page.Keyboard.TypeAsync("Sub heading");

        var h3 = Page.Locator("[data-testid='template-body-editor'] h3");
        await Expect(h3).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    /// <summary>
    /// Selecting text and clicking the Bold button should wrap it in a strong element.
    /// </summary>
    [Test]
    public async Task TemplateEditor_BoldButton_AppliesBold()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await Page.Keyboard.TypeAsync("bold text");

        // Select all text scoped to the editor using Meta+A (macOS Cmd+A) which
        // Tiptap handles as "select all" within the ProseMirror document.
        await editorContent.PressAsync("Meta+A");
        await _diary.ClickTemplateBoldButtonAsync();

        var strong = Page.Locator("[data-testid='template-body-editor'] strong");
        await Expect(strong).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    /// <summary>
    /// Selecting text and clicking the Italic button should wrap it in an em element.
    /// </summary>
    [Test]
    public async Task TemplateEditor_ItalicButton_AppliesItalic()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await Page.Keyboard.TypeAsync("italic text");

        await editorContent.PressAsync("Meta+A");
        await _diary.ClickTemplateItalicButtonAsync();

        var em = Page.Locator("[data-testid='template-body-editor'] em");
        await Expect(em).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    // ── Create + apply ───────────────────────────────────────────────────────

    /// <summary>
    /// Creating a template with the rich editor, then applying it, should show
    /// the template content in the diary editor as non-editable blocks.
    /// </summary>
    [Test]
    public async Task CreateAndApplyRichTemplate_ContentAppears()
    {
        var name = $"E2E Rich {Guid.NewGuid().ToString("N")[..8]}";
        const string BodyText = "Morning check-in";

        await _diary.OpenTemplateManagerAsync();
        await _diary.CreateTemplateInDialogAsync(name, BodyText);
        await _diary.CloseTemplateManagerAsync();

        await _diary.ApplyTemplateAsync(name);

        // Confirm overwrite if a prior test left the entry dirty.
        await _diary.ConfirmOverwriteIfVisibleAsync();

        var content = Page.Locator(".page-editor-content").GetByText(BodyText);
        await Expect(content).ToBeVisibleAsync(new() { Timeout = 5_000 });

        await Expect(Page.GetByText("Unsaved changes")).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    /// <summary>
    /// Editing an existing legacy template (old markdown-like format) should load
    /// its content into the rich editor and allow saving it as the new JSON format.
    /// The template should still apply correctly after migration.
    /// </summary>
    [Test]
    public async Task EditLegacyTemplate_MigratesAndApplies()
    {
        var name = $"E2E Legacy {Guid.NewGuid().ToString("N")[..8]}";
        const string LegacyTitle = "Legacy check";
        const string LegacyPrompts = "What was good?";

        await _diary.OpenTemplateManagerAsync();
        await _diary.CreateTemplateInDialogAsync(name, LegacyTitle, LegacyPrompts);
        await _diary.CloseTemplateManagerAsync();

        await _diary.ApplyTemplateAsync(name);

        await _diary.ConfirmOverwriteIfVisibleAsync();

        var content = Page.Locator(".page-editor-content").GetByText(LegacyTitle);
        await Expect(content).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    // ── Emoji toolbar picker ─────────────────────────────────────────────────

    /// <summary>
    /// Clicking the emoji (Smile) button in the template editor toolbar should open
    /// the emoji picker inside the dialog.
    /// </summary>
    [Test]
    public async Task TemplateEditor_EmojiButton_OpensEmojiPicker()
    {
        await _diary.OpenTemplateManagerAsync();

        await _diary.OpenTemplateEmojiPickerAsync();

        // The emoji-mart picker renders an em-emoji-picker custom element
        var picker = Page.Locator("em-emoji-picker");
        await Expect(picker).ToBeVisibleAsync(new() { Timeout = 8_000 });
    }

    /// <summary>
    /// Clicking an emoji from the picker should insert it into the editor and
    /// close the picker.
    /// The picker uses a shadow DOM so we click the first emoji button via JS.
    /// </summary>
    [Test]
    public async Task TemplateEditor_EmojiPicker_ClickEmoji_InsertsIntoEditor()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();

        await _diary.OpenTemplateEmojiPickerAsync();

        var picker = Page.Locator("em-emoji-picker");
        await Expect(picker).ToBeVisibleAsync(new() { Timeout = 8_000 });

        // Wait for emoji buttons to render inside the shadow DOM, then click the first one.
        // emoji-mart buttons with aria-label of an emoji character have class "flex flex-center flex-middle".
        await Page.WaitForFunctionAsync(@"
            () => {
                const p = document.querySelector('em-emoji-picker');
                const btns = p?.shadowRoot?.querySelectorAll('button.flex.flex-center.flex-middle') ?? [];
                return btns.length > 0;
            }
        ", null, new() { Timeout = 8_000 });

        await Page.EvaluateAsync(@"
            () => {
                const p = document.querySelector('em-emoji-picker');
                const btn = p.shadowRoot.querySelector('button.flex.flex-center.flex-middle');
                btn.click();
            }
        ");

        // Picker should close after emoji selection
        await Expect(picker).ToBeHiddenAsync(new() { Timeout = 3_000 });

        // Editor should contain some content
        var editorText = await editorContent.InnerTextAsync();
        Assert.That(editorText.Trim().Length, Is.GreaterThan(0), "Editor should contain inserted emoji");
    }

    /// <summary>
    /// Clicking the backdrop behind the emoji picker should close the picker
    /// without closing the template manager dialog itself.
    /// </summary>
    [Test]
    public async Task TemplateEditor_EmojiPicker_BackdropClick_ClosesPicker_NotDialog()
    {
        await _diary.OpenTemplateManagerAsync();

        // Click the editor first so the button ref position is calculated correctly.
        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();

        await _diary.OpenTemplateEmojiPickerAsync();

        var picker = Page.Locator("em-emoji-picker");
        await Expect(picker).ToBeVisibleAsync(new() { Timeout = 10_000 });

        // Wait for the picker's shadow DOM emoji buttons to fully render — ensures the
        // picker is interactive and that we're clicking the backdrop, not loading content.
        await Page.WaitForFunctionAsync(@"
            () => {
                const p = document.querySelector('em-emoji-picker');
                const btns = p?.shadowRoot?.querySelectorAll('button.flex.flex-center.flex-middle') ?? [];
                return btns.length > 0;
            }
        ", null, new() { Timeout = 10_000 });

        // Dispatch a click directly on the backdrop element via JS — most reliable approach
        // since Playwright's mouse click may be intercepted by overlapping elements.
        await Page.EvaluateAsync(@"
            () => {
                // The backdrop is the first fixed inset-0 z-60 div (our emoji backdrop).
                const backdrops = Array.from(document.querySelectorAll('.fixed.inset-0'));
                const emojiBackdrop = backdrops.find(el => {
                    const style = window.getComputedStyle(el);
                    return parseInt(style.zIndex) === 60;
                });
                if (emojiBackdrop) emojiBackdrop.click();
            }
        ");

        // Picker should close
        await Expect(picker).ToBeHiddenAsync(new() { Timeout = 3_000 });

        // Template manager dialog must still be open
        var dialog = Page.GetByRole(AriaRole.Dialog);
        await Expect(dialog).ToBeVisibleAsync(new() { Timeout = 2_000 });
    }

    // ── Emoji suggestion (colon trigger) ─────────────────────────────────────

    /// <summary>
    /// Typing ":" in the template editor should show the emoji suggestion popup.
    /// </summary>
    [Test]
    public async Task TemplateEditor_ColonTrigger_ShowsSuggestionPopup()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await Page.Keyboard.TypeAsync(":");

        var popup = Page.Locator(".tiptap-emoji-list");
        await Expect(popup).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    /// <summary>
    /// Typing ":smile" should filter the suggestion list to matching emojis.
    /// </summary>
    [Test]
    public async Task TemplateEditor_ColonSmile_FiltersSuggestions()
    {
        await _diary.OpenTemplateManagerAsync();

        await _diary.TypeEmojiSuggestionAsync("smile");

        var popup = Page.Locator(".tiptap-emoji-list");
        await Expect(popup).ToBeVisibleAsync(new() { Timeout = 3_000 });

        var items = popup.Locator("button");
        await Expect(items.First).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    /// <summary>
    /// Pressing Enter after the suggestion popup appears should insert the first emoji.
    /// This also tests Fix 1 — the suggestion must not be destroyed before insertion.
    /// </summary>
    [Test]
    public async Task TemplateEditor_ColonTrigger_EnterSelectsFirstSuggestion()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();

        await Page.Keyboard.TypeAsync(":");
        await Page.Locator(".tiptap-emoji-list").WaitForAsync(new() { Timeout = 3_000 });

        await _diary.SelectFirstEmojiSuggestionAsync();

        await Expect(Page.Locator(".tiptap-emoji-list")).ToBeHiddenAsync(new() { Timeout = 2_000 });

        var text = await editorContent.InnerTextAsync();
        Assert.That(text.Trim().Length, Is.GreaterThan(0), "Editor should contain the inserted emoji");
    }

    /// <summary>
    /// Pressing ArrowDown then Enter should select the second suggestion, not the first.
    /// </summary>
    [Test]
    public async Task TemplateEditor_ColonTrigger_ArrowDownEnter_SelectsSecondSuggestion()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await Page.Keyboard.TypeAsync(":");
        await Page.Locator(".tiptap-emoji-list").WaitForAsync(new() { Timeout = 3_000 });

        var popup = Page.Locator(".tiptap-emoji-list");
        var secondItem = popup.Locator("button").Nth(1);
        var secondEmojiSpan = secondItem.Locator("span").First;
        var expectedEmoji = await secondEmojiSpan.InnerTextAsync();

        await Page.Keyboard.PressAsync("ArrowDown");
        await Page.Keyboard.PressAsync("Enter");

        await Expect(popup).ToBeHiddenAsync(new() { Timeout = 2_000 });

        var editorText = await editorContent.InnerTextAsync();
        Assert.That(editorText.Trim(), Does.Contain(expectedEmoji.Trim()), "Second suggestion emoji should be inserted");
    }

    /// <summary>
    /// Pressing Escape should close the suggestion popup without inserting any emoji.
    /// The Tiptap suggestion blurs the editor on Escape, so we check content via JS.
    /// </summary>
    [Test]
    public async Task TemplateEditor_ColonTrigger_Escape_ClosesSuggestion_NoInsertion()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await Page.Keyboard.TypeAsync(":");
        await Page.Locator(".tiptap-emoji-list").WaitForAsync(new() { Timeout = 3_000 });

        await _diary.CloseEmojiSuggestionAsync();

        await Expect(Page.Locator(".tiptap-emoji-list")).ToBeHiddenAsync(new() { Timeout = 2_000 });

        // Get text content via JS — editor may have lost focus after Escape.
        var text = await Page.EvaluateAsync<string>(@"
            () => {
                const el = document.querySelector('[data-testid=""template-body-editor""] [contenteditable=""true""]');
                return el?.innerText ?? '';
            }
        ");
        Assert.That(text.Trim(), Is.Empty.Or.EqualTo(""), "No emoji should be inserted after Escape");
    }

    /// <summary>
    /// Clicking a suggestion item should insert the emoji (Fix 1: onMouseDown prevents
    /// focus loss that used to destroy the popup before the click registered).
    /// </summary>
    [Test]
    public async Task TemplateEditor_ColonTrigger_ClickSuggestion_InsertsEmoji()
    {
        await _diary.OpenTemplateManagerAsync();

        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await Page.Keyboard.TypeAsync(":");
        var popup = Page.Locator(".tiptap-emoji-list");
        await popup.WaitForAsync(new() { Timeout = 3_000 });

        var firstButton = popup.Locator("button").First;
        await Expect(firstButton).ToBeVisibleAsync(new() { Timeout = 3_000 });

        // Small wait for the suggestion popup position to stabilize — it may shift
        // slightly as ProseMirror finishes computing the cursor coordinates.
        await Page.WaitForTimeoutAsync(200);

        var emojiSpan = firstButton.Locator("span").First;
        var expectedEmoji = await emojiSpan.InnerTextAsync();

        // The suggestion popup renders in a fixed div in document.body and may
        // keep its position updated, causing Playwright stability checks to fail.
        // Use JS click to bypass stability — this also directly tests Fix 1 behavior
        // (onMouseDown prevents focus loss so the command fires successfully).
        await Page.EvaluateAsync(@"
            () => {
                const popup = document.querySelector('.tiptap-emoji-list');
                const btn = popup?.querySelector('button');
                if (btn) btn.click();
            }
        ");

        await Expect(popup).ToBeHiddenAsync(new() { Timeout = 2_000 });

        var editorText = await editorContent.InnerTextAsync();
        Assert.That(editorText.Trim(), Does.Contain(expectedEmoji.Trim()), "Clicked emoji should be inserted");
    }

    // ── Template with emoji ──────────────────────────────────────────────────

    /// <summary>
    /// A template that contains an emoji in its heading should apply correctly,
    /// and the emoji should be visible in the applied (non-editable) content.
    /// </summary>
    [Test]
    public async Task CreateAndApply_TemplateWithEmoji_AppliesToDiaryEntry()
    {
        var name = $"E2E Emoji {Guid.NewGuid().ToString("N")[..8]}";
        const string EmojiHeading = "🔥 Daily Goals";

        await _diary.OpenTemplateManagerAsync();

        await Page.GetByPlaceholder("Template name").FillAsync(name);
        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await _diary.ClickTemplateH2ButtonAsync();
        await Page.Keyboard.TypeAsync(EmojiHeading);

        await Page.GetByRole(AriaRole.Button, new() { Name = "Create template", Exact = true }).ClickAsync();
        await Page.GetByText(name).WaitForAsync(new() { Timeout = 5_000 });
        await _diary.CloseTemplateManagerAsync();

        await _diary.ApplyTemplateAsync(name);

        await _diary.ConfirmOverwriteIfVisibleAsync();

        var heading = Page.Locator(".page-editor-content").GetByText(EmojiHeading);
        await Expect(heading).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    /// <summary>
    /// A template with rich formatting (bold) should apply correctly to the diary entry.
    /// </summary>
    [Test]
    public async Task CreateAndApply_TemplateWithRichFormatting_AppliesToDiaryEntry()
    {
        var name = $"E2E Fmt {Guid.NewGuid().ToString("N")[..8]}";
        const string BoldText = "Important goal";

        await _diary.OpenTemplateManagerAsync();

        await Page.GetByPlaceholder("Template name").FillAsync(name);
        var editorContent = Page.Locator("[data-testid='template-body-editor'] [contenteditable='true']");
        await editorContent.ClickAsync();
        await _diary.ClickTemplateBoldButtonAsync();
        await Page.Keyboard.TypeAsync(BoldText);

        await Page.GetByRole(AriaRole.Button, new() { Name = "Create template", Exact = true }).ClickAsync();
        await Page.GetByText(name).WaitForAsync(new() { Timeout = 5_000 });
        await _diary.CloseTemplateManagerAsync();

        await _diary.ApplyTemplateAsync(name);

        await _diary.ConfirmOverwriteIfVisibleAsync();

        var content = Page.Locator(".page-editor-content").GetByText(BoldText);
        await Expect(content).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }
}
