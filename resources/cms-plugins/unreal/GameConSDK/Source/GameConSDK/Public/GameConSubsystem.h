// GameCon SDK для Unreal Engine 5: вхід кодом пристрою (RFC 8628) — гравець вводить код на
// gamecon.online/link з телефона; у грі не треба браузера. Публічний клієнт, без секрету.
// Усе доступне з Blueprint: Get Game Instance → Get Subsystem (GameCon).
#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "GameConSubsystem.generated.h"

USTRUCT(BlueprintType)
struct FGameConDeviceCode
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) FString UserCode;
	UPROPERTY(BlueprintReadOnly) FString VerificationUri;
	UPROPERTY(BlueprintReadOnly) FString VerificationUriComplete;
	FString DeviceCode;
	int32 Interval = 5;
	int32 ExpiresIn = 600;
};

USTRUCT(BlueprintType)
struct FGameConFriend
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) int32 Id = 0;
	UPROPERTY(BlueprintReadOnly) FString Username;
	UPROPERTY(BlueprintReadOnly) FString Name;
	UPROPERTY(BlueprintReadOnly) FString AvatarUrl;
	UPROPERTY(BlueprintReadOnly) bool bOnline = false;
	/** Статус у вашій грі («В матчі · Dust2»), якщо друг зараз у ній. */
	UPROPERTY(BlueprintReadOnly) FString Presence;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGameConLoginCode, const FGameConDeviceCode&, Code);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGameConLoginDone, bool, bSuccess, const FString&, Error);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGameConFriendsLoaded, const TArray<FGameConFriend>&, Friends);

UCLASS(Config = Game)
class GAMECONSDK_API UGameConSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	/** Client ID з gamecon.online/developers (DefaultGame.ini: [/Script/GameConSDK.GameConSubsystem] ClientId=...). */
	UPROPERTY(Config, BlueprintReadWrite, Category = "GameCon") FString ClientId;
	UPROPERTY(Config, BlueprintReadWrite, Category = "GameCon") FString BaseUrl = TEXT("https://gamecon.online");
	UPROPERTY(Config, BlueprintReadWrite, Category = "GameCon") FString Scope = TEXT("profile friends presence invites achievements");

	UPROPERTY(BlueprintAssignable, Category = "GameCon") FGameConLoginCode OnLoginCode;
	UPROPERTY(BlueprintAssignable, Category = "GameCon") FGameConLoginDone OnLoginDone;
	UPROPERTY(BlueprintAssignable, Category = "GameCon") FGameConFriendsLoaded OnFriendsLoaded;

	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	UFUNCTION(BlueprintPure, Category = "GameCon") bool IsSignedIn() const { return !RefreshToken.IsEmpty() || !AccessToken.IsEmpty(); }
	/** Почати вхід: OnLoginCode покаже код і адресу, далі опитування само до OnLoginDone. */
	UFUNCTION(BlueprintCallable, Category = "GameCon") void StartDeviceLogin();
	UFUNCTION(BlueprintCallable, Category = "GameCon") void SignOut();
	UFUNCTION(BlueprintCallable, Category = "GameCon") void LoadFriendsOnline();
	UFUNCTION(BlueprintCallable, Category = "GameCon") void SetPresence(const FString& Status, const FString& Lobby);
	UFUNCTION(BlueprintCallable, Category = "GameCon") void UnlockAchievement(const FString& Key);
	UFUNCTION(BlueprintCallable, Category = "GameCon") void SubmitScore(const FString& Board, int64 Score);
	/** Повний оверлей GameCon для віджета Web Browser (прозорий фон): паті, чат, сім’я/клан, крапля з панеллю. */
	UFUNCTION(BlueprintPure, Category = "GameCon") FString OverlayUrl(const FString& Modules = TEXT("hud,party,chat,drop")) const;

private:
	FString AccessToken;
	FString RefreshToken;
	int64 ExpiresAt = 0;
	FGameConDeviceCode Pending;
	FTimerHandle PollTimer;

	void Poll();
	void Api(const FString& Verb, const FString& Path, const FString& Json, TFunction<void(TSharedPtr<FJsonObject>)> Done = nullptr);
	void WithFreshToken(TFunction<void()> Then);
	void SaveTokens(const TSharedPtr<FJsonObject>& Json);
	void Persist() const;
	static FString Form(const TMap<FString, FString>& Fields);
};
