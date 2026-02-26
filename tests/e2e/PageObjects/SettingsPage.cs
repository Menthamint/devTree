namespace DevTree.E2E.PageObjects;

/// <summary>
/// Page object for the Settings dialog.
/// </summary>
public class SettingsPage(IPage page)
{
    private readonly IPage _page = page;

    private ILocator Dialog      => _page.GetByRole(AriaRole.Dialog);
    private ILocator CloseBtn    => Dialog.GetByRole(AriaRole.Button, new() { Name = "Close" });
    private ILocator AppearanceTab => Dialog.Locator("button:has-text('Appearance'), button:has-text('Зовнішній вигляд')").First;
    private ILocator StatisticsTab => Dialog.Locator("button:has-text('Statistics'), button:has-text('Статистика')").First;

    private static string[] ThemeLabels(string theme) => theme switch
    {
        "Light" => ["Light", "Світла"],
        "Dark" => ["Dark", "Темна"],
        "System" => ["System", "Системна"],
        _ => [theme],
    };

    private static string[] LanguageLabels(string language) => language switch
    {
        "English" => ["English", "Англійська"],
        "Ukrainian" => ["Ukrainian", "Українська"],
        _ => [language],
    };

    private ILocator DialogButtonByAnyLabel(params string[] labels)
    {
        var selector = string.Join(", ", labels.Select(label => $"button:has-text('{label}')"));
        return Dialog.Locator(selector).First;
    }

    // ── Waits ──────────────────────────────────────────────────────────────

    public Task WaitForAsync() =>
        Dialog.WaitForAsync(new() { Timeout = 5_000 });

    public Task WaitForCloseAsync() =>
        Dialog.WaitForAsync(new() { State = WaitForSelectorState.Hidden, Timeout = 5_000 });

    // ── Actions ────────────────────────────────────────────────────────────

    public Task CloseAsync() => CloseBtn.ClickAsync();

    private async Task OpenAppearanceTabAsync()
    {
        var lightOrUkrainianLight = DialogButtonByAnyLabel("Light", "Світла");
        if (await lightOrUkrainianLight.IsVisibleAsync())
            return;

        await AppearanceTab.ClickAsync();
        await lightOrUkrainianLight.WaitForAsync(new() { Timeout = 5_000 });
    }

    /// <summary>Clicks the theme option button (Light | Dark | System).</summary>
    public async Task SetThemeAsync(string theme)
    {
        await OpenAppearanceTabAsync();
        await DialogButtonByAnyLabel(ThemeLabels(theme)).ClickAsync();
    }

    /// <summary>Clicks the language option button (English | Ukrainian).</summary>
    public async Task SetLanguageAsync(string language)
    {
        await OpenAppearanceTabAsync();
        await DialogButtonByAnyLabel(LanguageLabels(language)).ClickAsync();
    }

    public async Task OpenStatisticsTabAsync()
    {
        var firstSwitch = Dialog.GetByRole(AriaRole.Switch).First;
        if (await firstSwitch.IsVisibleAsync())
            return;

        await StatisticsTab.ClickAsync();
        await firstSwitch.WaitForAsync(new() { Timeout = 5_000 });
    }

    public Task ToggleSwitchByLabelAsync(string label) =>
        Dialog.GetByRole(AriaRole.Switch, new() { Name = label }).First.ClickAsync();

    public Task ToggleSwitchByIndexAsync(int index) =>
        Dialog.GetByRole(AriaRole.Switch).Nth(index).ClickAsync();

    public async Task<bool> IsSwitchCheckedAsync(string label)
    {
        var value = await Dialog.GetByRole(AriaRole.Switch, new() { Name = label }).First.GetAttributeAsync("aria-checked");
        return value == "true";
    }

    public async Task<bool> IsSwitchCheckedAsync(int index)
    {
        var value = await Dialog.GetByRole(AriaRole.Switch).Nth(index).GetAttributeAsync("aria-checked");
        return value == "true";
    }

    // ── Queries ────────────────────────────────────────────────────────────

    public Task<bool> IsVisibleAsync() => Dialog.IsVisibleAsync();

    public Task<bool> IsThemeActiveAsync(string theme) =>
        Dialog.GetByRole(AriaRole.Button, new() { Name = theme })
              .Locator("xpath=self::*[contains(@class,'bg-indigo')]")
              .IsVisibleAsync();
}
