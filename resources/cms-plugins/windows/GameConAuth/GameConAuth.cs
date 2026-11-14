// «Увійти через GameCon» для Windows (.NET 8: WPF, WinForms, MAUI, консоль).
// Системний браузер + loopback (http://127.0.0.1:{порт}/callback), PKCE S256, без секрету.
// Зареєструйте в застосунку GameCon адресу http://127.0.0.1/callback (порт будь-який).
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;

namespace GameCon;

public sealed record GameConProfile(
    [property: JsonPropertyName("sub")] string Sub,
    [property: JsonPropertyName("preferred_username")] string Username,
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("email")] string? Email,
    [property: JsonPropertyName("picture")] string? Picture);

public sealed class GameConAuth(string clientId, string baseUrl = "https://gamecon.online")
{
    private static readonly HttpClient Http = new();

    public async Task<GameConProfile> SignInAsync(string scope = "profile email", CancellationToken ct = default)
    {
        var verifier = Random(48);
        var state = Random(24);
        var port = FreePort();
        var redirect = $"http://127.0.0.1:{port}/callback";
        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://127.0.0.1:{port}/");
        listener.Start();

        var url = $"{baseUrl}/oauth/authorize?response_type=code&client_id={Uri.EscapeDataString(clientId)}"
            + $"&redirect_uri={Uri.EscapeDataString(redirect)}&scope={Uri.EscapeDataString(scope)}&state={state}"
            + $"&code_challenge={B64(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)))}&code_challenge_method=S256";
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });

        var context = await listener.GetContextAsync().WaitAsync(TimeSpan.FromMinutes(5), ct);
        var query = context.Request.QueryString;
        var ok = query["state"] == state && query["code"] is not null;
        var page = Encoding.UTF8.GetBytes(ok ? "<h2>Готово — поверніться до застосунку.</h2>" : "<h2>Вхід скасовано.</h2>");
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.OutputStream.WriteAsync(page, ct);
        context.Response.Close();
        if (!ok) throw new InvalidOperationException(query["error_description"] ?? "Вхід не завершено.");

        var token = await Http.PostAsync($"{baseUrl}/oauth/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code", ["code"] = query["code"]!, ["redirect_uri"] = redirect,
            ["client_id"] = clientId, ["code_verifier"] = verifier,
        }), ct);
        var access = (await token.Content.ReadFromJsonAsync<Dictionary<string, object>>(cancellationToken: ct))?["access_token"]?.ToString()
            ?? throw new InvalidOperationException("GameCon не видав токен.");

        using var me = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/api/developer/v1/userinfo");
        me.Headers.Authorization = new("Bearer", access);
        var profile = await (await Http.SendAsync(me, ct)).Content.ReadFromJsonAsync<GameConProfile>(cancellationToken: ct);
        return profile ?? throw new InvalidOperationException("GameCon не повернув профіль.");
    }

    private static int FreePort()
    {
        var l = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0);
        l.Start();
        var port = ((IPEndPoint)l.LocalEndpoint).Port;
        l.Stop();
        return port;
    }

    private static string Random(int bytes) => B64(RandomNumberGenerator.GetBytes(bytes));

    private static string B64(byte[] data) => Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
