using UnrealBuildTool;

public class GameConSDK : ModuleRules
{
	public GameConSDK(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "HTTP", "Json", "JsonUtilities" });
	}
}
