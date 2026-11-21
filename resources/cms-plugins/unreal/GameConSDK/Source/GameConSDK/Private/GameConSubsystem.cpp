#include "GameConSubsystem.h"

#include "Dom/JsonObject.h"
#include "Engine/GameInstance.h"
#include "GenericPlatform/GenericPlatformHttp.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/ConfigCacheIni.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "TimerManager.h"

static const TCHAR* GStore = TEXT("GameCon");

void UGameConSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	// Токени — у Saved/Config (GameUserSettings.ini), секції GameCon.
	GConfig->GetString(GStore, TEXT("Access"), AccessToken, GGameUserSettingsIni);
	GConfig->GetString(GStore, TEXT("Refresh"), RefreshToken, GGameUserSettingsIni);
	FString Expires;
	GConfig->GetString(GStore, TEXT("Expires"), Expires, GGameUserSettingsIni);
	ExpiresAt = FCString::Atoi64(*Expires);
}

FString UGameConSubsystem::Form(const TMap<FString, FString>& Fields)
{
	TArray<FString> Parts;
	for (const auto& Pair : Fields)
	{
		Parts.Add(Pair.Key + TEXT("=") + FGenericPlatformHttp::UrlEncode(Pair.Value));
	}
	return FString::Join(Parts, TEXT("&"));
}

static TSharedPtr<FJsonObject> ParseJson(const FHttpResponsePtr& Response)
{
	TSharedPtr<FJsonObject> Json;
	if (Response.IsValid())
	{
		FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Response->GetContentAsString()), Json);
	}
	return Json;
}

void UGameConSubsystem::StartDeviceLogin()
{
	auto Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(BaseUrl + TEXT("/oauth/device"));
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/x-www-form-urlencoded"));
	Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
	Request->SetContentAsString(Form({{TEXT("client_id"), ClientId}, {TEXT("scope"), Scope}}));
	Request->OnProcessRequestComplete().BindWeakLambda(this, [this](FHttpRequestPtr, FHttpResponsePtr Response, bool bOk)
	{
		const auto Json = ParseJson(Response);
		if (!bOk || !Json.IsValid() || !Json->HasField(TEXT("device_code")))
		{
			OnLoginDone.Broadcast(false, TEXT("GameCon не видав код входу."));
			return;
		}
		Pending.DeviceCode = Json->GetStringField(TEXT("device_code"));
		Pending.UserCode = Json->GetStringField(TEXT("user_code"));
		Pending.VerificationUri = Json->GetStringField(TEXT("verification_uri"));
		Pending.VerificationUriComplete = Json->GetStringField(TEXT("verification_uri_complete"));
		Pending.Interval = FMath::Max(5, static_cast<int32>(Json->GetNumberField(TEXT("interval"))));
		Pending.ExpiresIn = static_cast<int32>(Json->GetNumberField(TEXT("expires_in")));
		OnLoginCode.Broadcast(Pending);
		GetGameInstance()->GetTimerManager().SetTimer(PollTimer, this, &UGameConSubsystem::Poll, Pending.Interval, true);
	});
	Request->ProcessRequest();
}

void UGameConSubsystem::Poll()
{
	auto Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(BaseUrl + TEXT("/oauth/token"));
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/x-www-form-urlencoded"));
	Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
	Request->SetContentAsString(Form({
		{TEXT("grant_type"), TEXT("urn:ietf:params:oauth:grant-type:device_code")},
		{TEXT("device_code"), Pending.DeviceCode},
		{TEXT("client_id"), ClientId},
	}));
	Request->OnProcessRequestComplete().BindWeakLambda(this, [this](FHttpRequestPtr, FHttpResponsePtr Response, bool)
	{
		const auto Json = ParseJson(Response);
		const FString Error = Json.IsValid() ? Json->GetStringField(TEXT("error")) : TEXT("network");
		if (Error == TEXT("authorization_pending") || Error == TEXT("slow_down") || Error == TEXT("network"))
		{
			return; // Чекаємо далі (таймер).
		}
		GetGameInstance()->GetTimerManager().ClearTimer(PollTimer);
		if (!Error.IsEmpty())
		{
			OnLoginDone.Broadcast(false, Json->GetStringField(TEXT("error_description")));
			return;
		}
		SaveTokens(Json);
		OnLoginDone.Broadcast(true, FString());
	});
	Request->ProcessRequest();
}

void UGameConSubsystem::SaveTokens(const TSharedPtr<FJsonObject>& Json)
{
	AccessToken = Json->GetStringField(TEXT("access_token"));
	FString Refresh;
	if (Json->TryGetStringField(TEXT("refresh_token"), Refresh))
	{
		RefreshToken = Refresh;
	}
	ExpiresAt = FDateTime::UtcNow().ToUnixTimestamp() + static_cast<int64>(Json->GetNumberField(TEXT("expires_in")));
	Persist();
}

void UGameConSubsystem::Persist() const
{
	GConfig->SetString(GStore, TEXT("Access"), *AccessToken, GGameUserSettingsIni);
	GConfig->SetString(GStore, TEXT("Refresh"), *RefreshToken, GGameUserSettingsIni);
	GConfig->SetString(GStore, TEXT("Expires"), *FString::Printf(TEXT("%lld"), ExpiresAt), GGameUserSettingsIni);
	GConfig->Flush(false, GGameUserSettingsIni);
}

void UGameConSubsystem::SignOut()
{
	AccessToken.Empty();
	RefreshToken.Empty();
	ExpiresAt = 0;
	Persist();
}

void UGameConSubsystem::WithFreshToken(TFunction<void()> Then)
{
	if (!IsSignedIn())
	{
		return;
	}
	if (FDateTime::UtcNow().ToUnixTimestamp() < ExpiresAt - 60)
	{
		Then();
		return;
	}
	auto Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(BaseUrl + TEXT("/oauth/token"));
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/x-www-form-urlencoded"));
	Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
	Request->SetContentAsString(Form({{TEXT("grant_type"), TEXT("refresh_token")}, {TEXT("refresh_token"), RefreshToken}, {TEXT("client_id"), ClientId}}));
	Request->OnProcessRequestComplete().BindWeakLambda(this, [this, Then](FHttpRequestPtr, FHttpResponsePtr Response, bool)
	{
		const auto Json = ParseJson(Response);
		if (!Json.IsValid() || Json->HasField(TEXT("error")))
		{
			SignOut(); // Сесію відкликано — гравець увійде знову.
			return;
		}
		SaveTokens(Json);
		Then();
	});
	Request->ProcessRequest();
}

void UGameConSubsystem::Api(const FString& Verb, const FString& Path, const FString& Json, TFunction<void(TSharedPtr<FJsonObject>)> Done)
{
	WithFreshToken([this, Verb, Path, Json, Done]()
	{
		auto Request = FHttpModule::Get().CreateRequest();
		Request->SetURL(BaseUrl + TEXT("/api/developer/v1") + Path);
		Request->SetVerb(Verb);
		Request->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + AccessToken);
		Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
		if (!Json.IsEmpty())
		{
			Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
			Request->SetContentAsString(Json);
		}
		Request->OnProcessRequestComplete().BindWeakLambda(this, [Done](FHttpRequestPtr, FHttpResponsePtr Response, bool)
		{
			if (Done)
			{
				Done(ParseJson(Response));
			}
		});
		Request->ProcessRequest();
	});
}

void UGameConSubsystem::LoadFriendsOnline()
{
	Api(TEXT("GET"), TEXT("/friends/online"), FString(), [this](TSharedPtr<FJsonObject> Json)
	{
		TArray<FGameConFriend> Friends;
		const TArray<TSharedPtr<FJsonValue>>* Data = nullptr;
		if (Json.IsValid() && Json->TryGetArrayField(TEXT("data"), Data))
		{
			for (const auto& Value : *Data)
			{
				const auto Item = Value->AsObject();
				FGameConFriend Friend;
				Friend.Id = static_cast<int32>(Item->GetNumberField(TEXT("id")));
				Friend.Username = Item->GetStringField(TEXT("username"));
				Friend.Name = Item->GetStringField(TEXT("name"));
				Item->TryGetStringField(TEXT("avatar_url"), Friend.AvatarUrl);
				Item->TryGetBoolField(TEXT("online"), Friend.bOnline);
				const TSharedPtr<FJsonObject>* Presence = nullptr;
				if (Item->TryGetObjectField(TEXT("presence"), Presence))
				{
					(*Presence)->TryGetStringField(TEXT("status"), Friend.Presence);
				}
				Friends.Add(Friend);
			}
		}
		OnFriendsLoaded.Broadcast(Friends);
	});
}

static FString JsonOf(const TMap<FString, FString>& Fields)
{
	const auto Object = MakeShared<FJsonObject>();
	for (const auto& Pair : Fields)
	{
		if (!Pair.Value.IsEmpty())
		{
			Object->SetStringField(Pair.Key, Pair.Value);
		}
	}
	FString Out;
	FJsonSerializer::Serialize(Object, TJsonWriterFactory<>::Create(&Out));
	return Out;
}

void UGameConSubsystem::SetPresence(const FString& Status, const FString& Lobby)
{
	Api(TEXT("PUT"), TEXT("/presence"), JsonOf({{TEXT("status"), Status}, {TEXT("lobby"), Lobby}}));
}

void UGameConSubsystem::UnlockAchievement(const FString& Key)
{
	Api(TEXT("POST"), TEXT("/achievements/") + FGenericPlatformHttp::UrlEncode(Key) + TEXT("/unlock"), TEXT("{}"));
}

void UGameConSubsystem::SubmitScore(const FString& Board, int64 Score)
{
	Api(TEXT("POST"), TEXT("/leaderboards/") + FGenericPlatformHttp::UrlEncode(Board) + TEXT("/scores"), FString::Printf(TEXT("{\"score\":%lld}"), Score));
}

FString UGameConSubsystem::OverlayUrl(const FString& Modules) const
{
	return FString::Printf(TEXT("%s/embed/overlay?client_id=%s&modules=%s&token=%s"), *BaseUrl,
		*FGenericPlatformHttp::UrlEncode(ClientId), *Modules, *FGenericPlatformHttp::UrlEncode(AccessToken));
}
