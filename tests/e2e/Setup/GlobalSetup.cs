namespace DevTree.E2E.Setup;

/// <summary>
/// Assembly-level setup that runs once before any E2E tests.
/// Seeds the database to a clean, known state before the test suite begins.
/// </summary>
[SetUpFixture]
public class GlobalSetup
{
    private static readonly string ProjectRoot = Path.GetFullPath(
        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "..", ".."));

    [OneTimeSetUp]
    public async Task BeforeAllTestsAsync()
    {
        await SeedDatabaseAsync();
    }

    private static async Task SeedDatabaseAsync()
    {
        try
        {
            var envFile = Path.Combine(ProjectRoot, ".env.development");
            var databaseUrl = ReadEnvVar(envFile, "DATABASE_URL")
                ?? "postgresql://devtree:devtree@localhost:5432/devtree";

            Console.WriteLine("[GlobalSetup] Seeding database for E2E tests...");

            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "npx",
                Arguments = "prisma db seed",
                WorkingDirectory = ProjectRoot,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            psi.Environment["DATABASE_URL"] = databaseUrl;

            using var proc = System.Diagnostics.Process.Start(psi)!;
            var stdout = await proc.StandardOutput.ReadToEndAsync();
            var stderr = await proc.StandardError.ReadToEndAsync();
            await proc.WaitForExitAsync();

            if (proc.ExitCode == 0)
            {
                // Print only the meaningful lines
                foreach (var line in stdout.Split('\n'))
                {
                    var trimmed = line.Trim();
                    if (!string.IsNullOrEmpty(trimmed) && !trimmed.StartsWith("warn") && !trimmed.StartsWith("┌") 
                        && !trimmed.StartsWith("│") && !trimmed.StartsWith("└") && !trimmed.Contains("pris.ly"))
                        Console.WriteLine($"[GlobalSetup] {trimmed}");
                }
            }
            else
            {
                Console.WriteLine($"[GlobalSetup] Seed failed (exit {proc.ExitCode}): {stderr}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GlobalSetup] Seed exception: {ex.Message}");
        }
    }

    /// <summary>Reads a key=value pair from the given .env-style file.</summary>
    private static string? ReadEnvVar(string filePath, string key)
    {
        if (!File.Exists(filePath)) return null;
        foreach (var line in File.ReadAllLines(filePath))
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith('#') || !trimmed.Contains('=')) continue;
            var idx = trimmed.IndexOf('=');
            if (string.Equals(trimmed[..idx].Trim(), key, StringComparison.OrdinalIgnoreCase))
            {
                return trimmed[(idx + 1)..].Trim().Trim('"');
            }
        }
        return null;
    }
}
