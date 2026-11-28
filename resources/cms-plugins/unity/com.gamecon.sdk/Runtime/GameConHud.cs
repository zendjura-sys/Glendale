// Готовий HUD GameCon для Unity: кнопка «Увійти через GameCon» (код пристрою + посилання),
// капсула «друзі онлайн» і список друзів за хоткеєм (F9). Без префабів — додайте компонент на будь-який об’єкт.
using System;
using UnityEngine;

namespace GameCon
{
    public class GameConHud : MonoBehaviour
    {
        [Tooltip("Client ID з gamecon.online/developers (публічний застосунок, без секрету).")]
        public string clientId = "";
        public KeyCode toggleKey = KeyCode.F9;
        [Tooltip("Статус у грі для друзів, напр. «У меню». Змінюйте з коду: Hud.Presence = \"В матчі\".")]
        public string Presence = "У грі";

        GameConClient client;
        DeviceCode pending;
        Friend[] friends = new Friend[0];
        string error;
        bool open;
        float nextRefresh;

        void Awake() => client = new GameConClient(clientId);

        async void Update()
        {
            if (Input.GetKeyDown(toggleKey)) open = !open;
            if (!client.SignedIn || Time.unscaledTime < nextRefresh) return;
            nextRefresh = Time.unscaledTime + 60f;
            try
            {
                await client.SetPresence(Presence);
                friends = await client.GetFriendsOnline();
                error = null;
            }
            catch (Exception e) { error = e.Message; }
        }

        async void SignIn()
        {
            try
            {
                pending = await client.StartDeviceLogin();
                Application.OpenURL(pending.verification_uri_complete);
                await client.WaitForLogin(pending);
                pending = null;
                nextRefresh = 0;
            }
            catch (Exception e) { error = e.Message; pending = null; }
        }

        void OnGUI()
        {
            var glass = new GUIStyle(GUI.skin.box) { padding = new RectOffset(12, 12, 10, 10), alignment = TextAnchor.UpperLeft, fontSize = 13 };
            if (!client.SignedIn)
            {
                if (pending != null)
                {
                    GUI.Box(new Rect(Screen.width - 330, 16, 314, 96), $"Вхід через GameCon\nВідкрийте {pending.verification_uri}\nі введіть код:  {pending.user_code}", glass);
                }
                else if (GUI.Button(new Rect(Screen.width - 230, 16, 214, 34), "Увійти через GameCon")) SignIn();
                if (error != null) GUI.Label(new Rect(Screen.width - 330, 116, 314, 40), error);
                return;
            }
            var online = 0;
            foreach (var f in friends) if (f.online) online++;
            if (GUI.Button(new Rect(Screen.width - 200, 16, 184, 30), $"GameCon · друзі онлайн: {online}")) open = !open;
            if (!open) return;
            var height = Mathf.Min(40 + friends.Length * 22, Screen.height - 80);
            GUILayout.BeginArea(new Rect(Screen.width - 300, 52, 284, height), glass);
            if (friends.Length == 0) GUILayout.Label("Поки ніхто з друзів не онлайн.");
            foreach (var f in friends)
                GUILayout.Label($"{(f.online ? "●" : "○")} {f.name}{(f.presence != null && !string.IsNullOrEmpty(f.presence.status) ? " — " + f.presence.status : "")}");
            GUILayout.EndArea();
        }
    }
}
