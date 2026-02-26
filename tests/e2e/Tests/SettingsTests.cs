namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for the Settings dialog: theme switching and language switching.
/// </summary>
[TestFixture]
[Category("Settings")]
public class SettingsTests : E2ETestBase
{
    [SetUp]
    public async Task PrepareActivePageAsync()
    {
        await App.Sidebar.SelectPageAsync("React Hooks");
    }

    // ── Open / close ─────────────────────────────────────────────────────────

    [Test]
    public async Task OpenSettings_DialogAppears()
    {
        await App.OpenSettingsAsync();

        Assert.That(await App.Settings.IsVisibleAsync(), Is.True);
    }

    [Test]
    public async Task CloseSettings_ViaXButton_DialogDisappears()
    {
        await App.OpenSettingsAsync();
        await App.Settings.CloseAsync();
        await App.Settings.WaitForCloseAsync();

        Assert.That(await App.Settings.IsVisibleAsync(), Is.False);
    }

    [Test]
    public async Task CloseSettings_ViaEscapeKey_DialogDisappears()
    {
        await App.OpenSettingsAsync();
        await Page.Keyboard.PressAsync("Escape");
        await App.Settings.WaitForCloseAsync();

        Assert.That(await App.Settings.IsVisibleAsync(), Is.False);
    }

    // ── Theme ─────────────────────────────────────────────────────────────────

    [Test]
    public async Task SwitchToDarkTheme_AppliesDarkClass()
    {
        await App.OpenSettingsAsync();
        await App.Settings.SetThemeAsync("Dark");

        var html = Page.Locator("html");
        await Expect(html).ToHaveClassAsync(new System.Text.RegularExpressions.Regex("dark"));
    }

    [Test]
    public async Task SwitchToLightTheme_RemovesDarkClass()
    {
        // First switch to dark
        await App.OpenSettingsAsync();
        await App.Settings.SetThemeAsync("Dark");
        await App.Settings.CloseAsync();

        // Then switch back to light
        await App.OpenSettingsAsync();
        await App.Settings.SetThemeAsync("Light");

        var html = Page.Locator("html");
        await Expect(html).Not.ToHaveClassAsync(new System.Text.RegularExpressions.Regex("dark"));
    }

    [Test]
    [TestCase("Light")]
    [TestCase("Dark")]
    [TestCase("System")]
    public async Task ThemeButtons_AllPresent(string themeName)
    {
        await App.OpenSettingsAsync();
        var appearanceTab = Page.GetByRole(AriaRole.Dialog).Locator("button:has-text('Appearance'), button:has-text('Зовнішній вигляд')").First;
        await appearanceTab.ClickAsync();

        var themeSelector = themeName switch
        {
            "Light" => "button:has-text('Light'), button:has-text('Світла')",
            "Dark" => "button:has-text('Dark'), button:has-text('Темна')",
            "System" => "button:has-text('System'), button:has-text('Системна')",
            _ => $"button:has-text('{themeName}')",
        };
        var btn = Page.GetByRole(AriaRole.Dialog).Locator(themeSelector).First;
        await Expect(btn).ToBeVisibleAsync();
    }

    // ── Language ──────────────────────────────────────────────────────────────

    [Test]
    public async Task SwitchToUkrainian_TranslatesUI()
    {
        await App.OpenSettingsAsync();
        await App.Settings.SetLanguageAsync("Ukrainian");
        await App.Settings.CloseAsync();

        // Enter edit mode — the Save button in Ukrainian should be visible
        await App.EnterPageEditModeAsync();
        var saveBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Зберегти" });
        await Expect(saveBtn).ToBeVisibleAsync();
    }

    [Test]
    public async Task SwitchBackToEnglish_RestoresEnglishUI()
    {
        // Switch to Ukrainian first
        await App.OpenSettingsAsync();
        await App.Settings.SetLanguageAsync("Ukrainian");
        await App.Settings.CloseAsync();

        // Then switch back to English
        await App.OpenSettingsAsync();
        await App.Settings.SetLanguageAsync("Англійська"); // "English" in Ukrainian
        await App.Settings.CloseAsync();

        // Enter edit mode — the Save button in English should be visible
        await App.EnterPageEditModeAsync();
        var saveBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Save" });
        await Expect(saveBtn).ToBeVisibleAsync();
    }

    [Test]
    [TestCase("English")]
    [TestCase("Ukrainian")]
    public async Task LanguageButtons_AllPresent(string language)
    {
        await App.OpenSettingsAsync();
        var appearanceTab = Page.GetByRole(AriaRole.Dialog).Locator("button:has-text('Appearance'), button:has-text('Зовнішній вигляд')").First;
        await appearanceTab.ClickAsync();

        var languageSelector = language switch
        {
            "English" => "button:has-text('English'), button:has-text('Англійська')",
            "Ukrainian" => "button:has-text('Ukrainian'), button:has-text('Українська')",
            _ => $"button:has-text('{language}')",
        };
        var btn = Page.GetByRole(AriaRole.Dialog).Locator(languageSelector).First;
        await Expect(btn).ToBeVisibleAsync();
    }

    // ── Statistics toggles ──────────────────────────────────────────────────

    [Test]
    public async Task StatisticsTab_TrackingToggles_AreVisibleAndInteractive()
    {
        await App.OpenSettingsAsync();
        await App.Settings.OpenStatisticsTabAsync();

        // Indexes on Statistics tab: 0=global, 1=session, 2=page, 3=content.
        var sessionBefore = await App.Settings.IsSwitchCheckedAsync(1);
        await App.Settings.ToggleSwitchByIndexAsync(1);
        var sessionAfter = await App.Settings.IsSwitchCheckedAsync(1);
        Assert.That(sessionAfter, Is.Not.EqualTo(sessionBefore));

        var contentBefore = await App.Settings.IsSwitchCheckedAsync(3);
        await App.Settings.ToggleSwitchByIndexAsync(3);
        var contentAfter = await App.Settings.IsSwitchCheckedAsync(3);
        Assert.That(contentAfter, Is.Not.EqualTo(contentBefore));
    }
}
