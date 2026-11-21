// GameCon SDK для Unity: вхід кодом пристрою (RFC 8628) — гравець вводить код на gamecon.online/link
// з телефона, у грі не треба браузера. Публічний клієнт: без секрету. Токени — у PlayerPrefs,
// оновлюються самі (refresh_token).
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace GameCon
{
    [Serializable] public class DeviceCode { public string device_code; public string user_code; public string verification_uri; public string verification_uri_complete; public int interval = 5; public int expires_in; }
    [Serializable] public class TokenSet { public string access_token; public string refresh_token; public int expires_in; public string error; public string error_description; }
    [Serializable] public class Me { public int id; public string username; public string name; public string avatar_url; }
    [Serializable] public class Presence { public string status; public string lobby; }
    [Serializable] public class Friend { public int id; public string username; public string name; public string avatar_url; public bool online; public Presence presence; }
    [Serializable] class FriendList { public Friend[] data; }
    [Serializable] class MeEnvelope { public Me data; }

    public class GameConException : Exception { public GameConException(string message) : base(message) { } }

    public class GameConClient
    {
        public readonly string ClientId;
        public readonly string Base;
        public string Scope = "profile friends presence invites achievements";

        const string AccessKey = "gamecon.access", RefreshKey = "gamecon.refresh", ExpiresKey = "gamecon.expires";

        public GameConClient(string clientId, string baseUrl = "https://gamecon.online")
        {
            ClientId = clientId;
            Base = baseUrl.TrimEnd('/');
        }

        public bool SignedIn => !string.IsNullOrEmpty(PlayerPrefs.GetString(RefreshKey, PlayerPrefs.GetString(AccessKey, "")));
        public string AccessToken => PlayerPrefs.GetString(AccessKey, "");

        /// <summary>Крок 1: отримати код. Покажіть гравцю UserCode і VerificationUri (або QR з VerificationUriComplete).</summary>
        public async Task<DeviceCode> StartDeviceLogin()
        {
            var json = await Send("POST", "/oauth/device", Form(("client_id", ClientId), ("scope", Scope)), null);
            return JsonUtility.FromJson<DeviceCode>(json);
        }

        /// <summary>Крок 2: чекати підтвердження на gamecon.online/link (опитування з інтервалом сервера).</summary>
        public async Task WaitForLogin(DeviceCode code)
        {
            var interval = Math.Max(5, code.interval);
            var deadline = DateTime.UtcNow.AddSeconds(code.expires_in > 0 ? code.expires_in : 600);
            while (DateTime.UtcNow < deadline)
            {
                await Task.Delay(interval * 1000);
                var tokens = await Token(Form(("grant_type", "urn:ietf:params:oauth:grant-type:device_code"), ("device_code", code.device_code), ("client_id", ClientId)), allowError: true);
                if (tokens.error == "authorization_pending") continue;
                if (tokens.error == "slow_down") { interval += 5; continue; }
                if (!string.IsNullOrEmpty(tokens.error)) throw new GameConException(tokens.error_description ?? tokens.error);
                Save(tokens);
                return;
            }
            throw new GameConException("Код прострочено — почніть вхід заново.");
        }

        public void SignOut()
        {
            PlayerPrefs.DeleteKey(AccessKey);
            PlayerPrefs.DeleteKey(RefreshKey);
            PlayerPrefs.DeleteKey(ExpiresKey);
        }

        // ——— API (/api/developer/v1) ———
        public async Task<Me> GetMe() => JsonUtility.FromJson<MeEnvelope>(await Api("GET", "/me")).data;
        public async Task<Friend[]> GetFriendsOnline() => JsonUtility.FromJson<FriendList>(await Api("GET", "/friends/online")).data ?? new Friend[0];
        /// <summary>«В матчі · Dust2» — бачать друзі в GameCon і у вашій грі. Оновлюйте раз на кілька хвилин.</summary>
        public Task SetPresence(string status, string lobby = null) => Api("PUT", "/presence", Json(("status", status), ("lobby", lobby)));
        public Task Invite(string username, string lobby) => Api("POST", "/invites", Json(("username", username), ("lobby", lobby)));
        public Task UnlockAchievement(string key) => Api("POST", "/achievements/" + UnityWebRequest.EscapeURL(key) + "/unlock", "{}");
        public Task SubmitScore(string board, long score) => Api("POST", "/leaderboards/" + UnityWebRequest.EscapeURL(board) + "/scores", "{\"score\":" + score + "}");
        /// <summary>Сира відповідь JSON для решти методів API (чат, голос, групи, музика).</summary>
        public Task<string> Call(string method, string path, string json = null) => Api(method, path, json);

        /// <summary>Готовий оверлей GameCon для вбудованого браузера (WebView-плагін, CEF): прозорий фон, кліки проходять у гру.</summary>
        public string OverlayUrl(string modules = "hud,party,chat,drop") =>
            $"{Base}/embed/overlay?client_id={UnityWebRequest.EscapeURL(ClientId)}&modules={modules}&token={UnityWebRequest.EscapeURL(AccessToken)}";

        // ——— Внутрішнє ———
        async Task<string> Api(string method, string path, string json = null)
        {
            await EnsureFresh();
            var body = await Send(method, "/api/developer/v1" + path, null, json, AccessToken);
            return body;
        }

        async Task EnsureFresh()
        {
            if (!SignedIn) throw new GameConException("Спершу увійдіть через GameCon.");
            var expires = long.Parse(PlayerPrefs.GetString(ExpiresKey, "0"));
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() < expires - 60) return;
            var tokens = await Token(Form(("grant_type", "refresh_token"), ("refresh_token", PlayerPrefs.GetString(RefreshKey, "")), ("client_id", ClientId)), allowError: true);
            if (!string.IsNullOrEmpty(tokens.error)) { SignOut(); throw new GameConException("Сесія завершилась — увійдіть знову."); }
            Save(tokens);
        }

        async Task<TokenSet> Token(WWWForm form, bool allowError)
        {
            var json = await Send("POST", "/oauth/token", form, null, null, allowError);
            return JsonUtility.FromJson<TokenSet>(json);
        }

        void Save(TokenSet tokens)
        {
            PlayerPrefs.SetString(AccessKey, tokens.access_token);
            if (!string.IsNullOrEmpty(tokens.refresh_token)) PlayerPrefs.SetString(RefreshKey, tokens.refresh_token);
            PlayerPrefs.SetString(ExpiresKey, (DateTimeOffset.UtcNow.ToUnixTimeSeconds() + tokens.expires_in).ToString());
            PlayerPrefs.Save();
        }

        async Task<string> Send(string method, string path, WWWForm form, string json, string bearer = null, bool allowError = false)
        {
            using var req = form != null ? UnityWebRequest.Post(Base + path, form) : new UnityWebRequest(Base + path, method);
            if (form == null)
            {
                req.downloadHandler = new DownloadHandlerBuffer();
                if (json != null) { req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json)); req.SetRequestHeader("Content-Type", "application/json"); }
            }
            req.SetRequestHeader("Accept", "application/json");
            if (bearer != null) req.SetRequestHeader("Authorization", "Bearer " + bearer);
            var op = req.SendWebRequest();
            while (!op.isDone) await Task.Yield();
            if (req.result == UnityWebRequest.Result.ConnectionError) throw new GameConException("Немає з’єднання з GameCon.");
            if (req.responseCode >= 400 && !allowError) throw new GameConException($"GameCon відповів {req.responseCode}: {req.downloadHandler.text}");
            return req.downloadHandler.text;
        }

        static WWWForm Form(params (string key, string value)[] fields)
        {
            var form = new WWWForm();
            foreach (var (key, value) in fields) if (value != null) form.AddField(key, value);
            return form;
        }

        static string Json(params (string key, string value)[] fields)
        {
            var parts = new List<string>();
            foreach (var (key, value) in fields) if (value != null) parts.Add($"\"{key}\":\"{value.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"");
            return "{" + string.Join(",", parts) + "}";
        }
    }
}
