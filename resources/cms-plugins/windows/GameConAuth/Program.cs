using GameCon;

var profile = await new GameConAuth("ВАШ_CLIENT_ID").SignInAsync();
Console.WriteLine($"Привіт, {profile.Name ?? profile.Username}!");
