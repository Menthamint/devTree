namespace DevTree.E2E.Tests;

/// <summary>
/// E2E tests for the login/register page (email/password only; OAuth omitted).
/// </summary>
[TestFixture]
[Category("Login")]
public class LoginTests : E2ETestBase
{
    private LoginPage Login => new(Page);

    [SetUp]
    public async Task EnsureOnLoginPageAsync()
    {
        // Base SetUp already ran (GotoAsync → redirect to /login when not authenticated)
        if (!await Login.IsOnLoginPageAsync())
            await Login.GotoLoginAsync();
    }

    // ── Page load ───────────────────────────────────────────────────────────

    [Test]
    public async Task LoginPage_Loads_ShowsSignInForm()
    {
        Assert.That(await Login.IsSignInButtonVisibleAsync(), Is.True);
        await Expect(Page.GetByTestId("auth-email")).ToBeVisibleAsync();
        await Expect(Page.GetByTestId("auth-password")).ToBeVisibleAsync();
    }

    [Test]
    public async Task LoginPage_ShowsForgotPasswordLink()
    {
        var link = Page.GetByTestId("login-forgot-link");
        await Expect(link).ToBeVisibleAsync();
        await Expect(link).ToHaveAttributeAsync("href", "/forgot-password");
    }

    [Test]
    public async Task ForgotPasswordPage_SubmitEmail_ShowsSuccessNotice()
    {
        var link = Page.GetByTestId("login-forgot-link");
        await link.ClickAsync();

        await Expect(Page).ToHaveURLAsync(new System.Text.RegularExpressions.Regex("/forgot-password"));

        await Page.GetByTestId("forgot-email").FillAsync("unknown-user@devtree.local");
        await Page.GetByTestId("forgot-submit").ClickAsync();

        await Expect(Page.GetByTestId("forgot-password-notice")).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    [Test]
    public async Task LoginPage_ShowsSignUpSwitch()
    {
        await Expect(Page.GetByTestId("auth-switch-register")).ToBeVisibleAsync();
    }

    // ── Switch to register ──────────────────────────────────────────────────

    [Test]
    public async Task LoginPage_SwitchToRegister_ShowsCreateAccountForm()
    {
        await Login.SwitchToRegisterAsync();
        Assert.That(await Login.IsCreateAccountVisibleAsync(), Is.True);
        await Expect(Page.GetByTestId("auth-name")).ToBeVisibleAsync();
    }

    [Test]
    public async Task LoginPage_SwitchToRegisterAndBack_ShowsSignInAgain()
    {
        await Login.SwitchToRegisterAsync();
        await Login.SwitchToLoginAsync();
        Assert.That(await Login.IsSignInButtonVisibleAsync(), Is.True);
    }

    // ── Invalid credentials ─────────────────────────────────────────────────

    [Test]
    public async Task LoginPage_InvalidCredentials_ShowsError()
    {
        await Login.SubmitLoginAsync("wrong@example.com", "wrongpassword");

        await Expect(Page.GetByRole(AriaRole.Alert).First).ToBeVisibleAsync(new() { Timeout = 5_000 });
    }

    // ── Language toggle ─────────────────────────────────────────────────────

    [Test]
    public async Task LoginPage_SwitchToUkrainian_UpdatesUI()
    {
        await Login.SetLanguageAsync("UA");
        await Page.WaitForTimeoutAsync(500);
        // After switching to UK, the Sign in button should show Ukrainian label
        var signInBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Увійти" });
        await Expect(signInBtn).ToBeVisibleAsync(new() { Timeout = 3_000 });
    }

    [Test]
    public async Task LoginPage_LanguageToggle_EN_And_UA_Visible()
    {
        await Expect(Page.GetByRole(AriaRole.Button).Filter(new() { HasText = "EN" })).ToBeVisibleAsync();
        await Expect(Page.GetByRole(AriaRole.Button).Filter(new() { HasText = "UA" })).ToBeVisibleAsync();
    }

    // ── Valid login (self-registered deterministic account) ─────────────────

    [Test]
    public async Task LoginPage_ValidCredentials_RedirectsToApp()
    {
        var email = $"e2e.login.{Guid.NewGuid():N}@devtree.local";
        const string password = "E2E!Passw0rd123";

        await Login.SubmitRegisterAsync(email, password, "E2E Login User");
        await Login.SubmitLoginAsync(email, password);

        await Expect(Page).ToHaveURLAsync(new System.Text.RegularExpressions.Regex("^(?!.*/login)"), new() { Timeout = 10_000 });
        await Expect(Page.Locator("button[aria-label='User menu'], button[aria-label='Меню користувача']").First)
            .ToBeVisibleAsync(new() { Timeout = 5_000 });
    }
}
