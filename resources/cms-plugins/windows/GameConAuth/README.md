# Увійти через GameCon — Windows (.NET 8)

1. На GameCon створіть застосунок **без секрету**, адреса повернення `http://127.0.0.1/callback` (порт підставляється сам).
2. `dotnet run` — приклад; у своєму застосунку (WPF, WinForms, MAUI) використайте `GameConAuth.cs`:
   ```csharp
   var profile = await new GameConAuth("ВАШ_CLIENT_ID").SignInAsync();
   ```
