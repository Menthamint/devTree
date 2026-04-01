using Microsoft.Playwright.NUnit;

namespace DevTree.E2E.Setup;

/// <summary>
/// Base class for all E2E tests. Configures Playwright with sensible defaults
/// and provides a ready-to-use <see cref="AppPage"/> for each test.
/// </summary>
[TestFixture]
[Parallelizable(ParallelScope.None)]
public abstract class E2ETestBase : PageTest
{
    private const string FallbackE2EPassword = "E2E!Passw0rd123";
    private const string FallbackE2EEmail = "demo@devtree.local";

    /// <summary>The base URL of the running DevTree app.</summary>
    protected static string BaseUrl =>
        Environment.GetEnvironmentVariable("DEVTREE_BASE_URL") ?? "http://localhost:3000";

    protected AppPage App { get; private set; } = null!;

    [SetUp]
    public async Task SetUpPageAsync()
    {
        App = new AppPage(Page);

        // Auth bootstrap only runs for non-Login test categories.
        // Login tests run against the unauthenticated page and handle their own login flow.
        var currentTest = TestContext.CurrentContext.Test;
        var categories = currentTest.Properties.ContainsKey("Category")
            ? currentTest.Properties["Category"] as System.Collections.IList
            : null;
        var isLoginTest = categories != null && categories.Count > 0 && categories[0]?.ToString() == "Login";

        if (isLoginTest)
        {
            await App.GotoAsync();
            return; // Skip auth bootstrap for login tests
        }

        // For non-login tests, navigate to /login first so the auth check is reliable.
        // The root "/" redirects to "/notebook" even for unauthenticated users, so checking
        // Page.Url after GotoAsync("/") cannot distinguish authenticated from unauthenticated.
        await Page.GotoAsync($"{BaseUrl}/login", new() { WaitUntil = WaitUntilState.Load });

        // If /login immediately redirects to a non-login page, the session is already valid.
        var alreadyAuthed = !Page.Url.Contains("/login");
        if (!alreadyAuthed)
        {
            try
            {
                var email = Environment.GetEnvironmentVariable("DEVTREE_E2E_EMAIL");
                var password = Environment.GetEnvironmentVariable("DEVTREE_E2E_PASSWORD");
                var hasProvidedCredentials = !string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(password);

                var effectiveEmail = hasProvidedCredentials
                    ? email!
                    : FallbackE2EEmail;
                var effectivePassword = hasProvidedCredentials
                    ? password!
                    : FallbackE2EPassword;

                await EnsureAuthenticatedAsync(effectiveEmail, effectivePassword, hasProvidedCredentials);
            }
            catch (Exception ex)
            {
                throw new AssertionException($"Auth setup failed: {ex.Message}");
            }
        }

        await App.GotoAsync();

        // The Next.js dev-mode overlay (nextjs-portal) can intercept pointer events
        await Page.EvaluateAsync(@"
            document.querySelectorAll('nextjs-portal').forEach(el => {
                el.style.pointerEvents = 'none';
                el.style.display = 'none';
            });
        ");
    }

    /// <summary>
    /// After every test restore the user's locale to English so locale-changing
    /// tests (e.g. SwitchToUkrainian_TranslatesUI) don't bleed state into
    /// subsequent tests that expect English UI strings.
    /// </summary>
    [TearDown]
    public async Task TearDownResetLocaleAsync()
    {
        try
        {
            await Page.EvaluateAsync(@"
                (async () => {
                    try {
                        await fetch('/api/user/preferences', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ locale: 'en' })
                        });
                    } catch (_) {}
                })()
            ");
        }
        catch
        {
            // Best-effort — ignore errors (e.g. page already navigated away).
        }
    }

    private async Task EnsureAuthenticatedAsync(string email, string password, bool hasProvidedCredentials)
    {
        var loginPage = new LoginPage(Page);
        var shouldTryLoginFirst = hasProvidedCredentials ||
                                  string.Equals(email, FallbackE2EEmail, StringComparison.OrdinalIgnoreCase);

        // Try login first when explicit credentials were provided OR when using
        // the default seeded demo account.
        if (shouldTryLoginFirst)
        {
            try
            {
                await loginPage.SubmitLoginAsync(email, password);
                if (await WaitUntilLoggedInAsync(timeoutMs: 8_000))
                    return;
            }
            catch (PlaywrightException)
            {
                // Continue to register flow
            }
        }

        // Register a user and then sign in. Retry once with a new email if needed.
        for (var attempt = 0; attempt < 2; attempt++)
        {
            string registerEmail;
            if (hasProvidedCredentials)
            {
                registerEmail = attempt == 0 ? email : $"e2e.{Guid.NewGuid():N}@devtree.local";
            }
            else
            {
                registerEmail = attempt == 0 ? FallbackE2EEmail : $"e2e.{Guid.NewGuid():N}@devtree.local";
            }

            try
            {
                await loginPage.SubmitRegisterAsync(registerEmail, password, "E2E User");
                await loginPage.SubmitLoginAsync(registerEmail, password);
                if (await WaitUntilLoggedInAsync(timeoutMs: 12_000))
                    return;
            }
            catch (PlaywrightException)
            {
                // Try the next attempt.
            }
        }

        throw new PlaywrightException("Unable to authenticate in E2E setup.");
    }

    private async Task<bool> WaitUntilLoggedInAsync(float timeoutMs)
    {
        try
        {
            await Page.WaitForURLAsync(
                url => !url.Contains("/login"),
                new() { Timeout = timeoutMs }
            );
            return true;
        }
        catch (TimeoutException)
        {
            return false;
        }
        catch (PlaywrightException)
        {
            return false;
        }
    }

    // ── Playwright browser options ──────────────────────────────────────────

    public override BrowserNewContextOptions ContextOptions() =>
        new()
        {
            ViewportSize = new ViewportSize { Width = 1440, Height = 900 },
            Locale      = "en-US",
            TimezoneId  = "UTC",
        };
}
