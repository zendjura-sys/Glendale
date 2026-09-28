# Date: 26 February, 2025

## Summary

- Add Embedded video link & Update Dependencies

#### Added Files

None
#### Updated Files

-[activity_player_new.xml](app/src/main/res/layout/activity_player_new.xml)
-[build.gradle](build.gradle)
-[PlayerNewActivity.java](app/src/main/java/com/retry/flixy/activities/PlayerNewActivity.java)

#### Deleted Files

None

====================================================================

# Date: 22 January, 2025

## Summary

- Solved Issues:-

1) Subtitle not worked

#### Added Files

-[SRTDownloader.java](app/src/main/java/com/retry/flixy/utils/subtitle/SRTDownloader.java)
-[SubtitleDisplay.java](app/src/main/java/com/retry/flixy/utils/subtitle/SubtitleDisplay.java)
-[SubtitleParser.java](app/src/main/java/com/retry/flixy/utils/subtitle/SubtitleParser.java)

#### Updated Files

-[activity_player_new.xml](app/src/main/res/layout/activity_player_new.xml)
-[build.gradle](build.gradle)
-[gradle-wrapper.properties](gradle/wrapper/gradle-wrapper.properties)
-[PlayerNewActivity.java](app/src/main/java/com/retry/flixy/activities/PlayerNewActivity.java)
-[PlayerViewModel.java](app/src/main/java/com/retry/flixy/viewmodel/PlayerViewModel.java)

#### Deleted Files

None

====================================================================

# Date: 13 January, 2025

## Summary

- Solved Issues:-

1) Home Page data duplicate

#### Added Files

None

#### Updated Files

-[HomeFragment.java](app/src/main/java/com/retry/flixy/fragments/HomeFragment.java)
-[MovieDetailActivity.java](app/src/main/java/com/retry/flixy/activities/MovieDetailActivity.java)

#### Deleted Files

None

====================================================================

# Date: 31 December, 2024

## Summary

- Solved Issues:-

1) Add Recently Watched
2) Add Pull to Refresh
3) If user clicks on the content's notification, they will be redirect to content details screen.

#### Added Files

-[MovieHistory.kt](app/src/main/java/com/retry/flixy/model/history/MovieHistory.kt)
-[MovieHistoryAdapter.kt](app/src/main/java/com/retry/flixy/adapters/MovieHistoryAdapter.kt)
-[ic_info.xml](app/src/main/res/drawable/ic_info.xml)
-[item_movie_history.xml](app/src/main/res/layout/item_movie_history.xml)

#### Updated Files

-[activity_content_by_genre.xml](app/src/main/res/layout/activity_content_by_genre.xml)
-[activity_downloades.xml](app/src/main/res/layout/activity_downloades.xml)
-[activity_main.xml](app/src/main/res/layout/activity_main.xml)
-[AndroidManifest.xml](app/src/main/AndroidManifest.xml)
-[build.gradle](app/build.gradle)
-[build.gradle](build.gradle)
-[Const.java](app/src/main/java/com/retry/flixy/utils/Const.java)
-[ContentByGenreActivity.java](app/src/main/java/com/retry/flixy/activities/ContentByGenreActivity.java)
-[ContentDetail.java](app/src/main/java/com/retry/flixy/model/ContentDetail.java)
-[ContentDetailSourceAdapter.java](app/src/main/java/com/retry/flixy/adapters/ContentDetailSourceAdapter.java)
-[DownloadAdapter.java](app/src/main/java/com/retry/flixy/adapters/DownloadAdapter.java)
-[Downloads.java](app/src/main/java/com/retry/flixy/model/Downloads.java)
-[DownloadSeriesAdapter.java](app/src/main/java/com/retry/flixy/adapters/DownloadSeriesAdapter.java)
-[fragment_home.xml](app/src/main/res/layout/fragment_home.xml)
-[HomeCatNameAdapter.java](app/src/main/java/com/retry/flixy/adapters/HomeCatNameAdapter.java)
-[HomeFeaturedAdapter.java](app/src/main/java/com/retry/flixy/adapters/HomeFeaturedAdapter.java)
-[HomeFragment.java](app/src/main/java/com/retry/flixy/fragments/HomeFragment.java)
-[HomeTopItemsAdapter.java](app/src/main/java/com/retry/flixy/adapters/HomeTopItemsAdapter.java)
-[HomeWatchlistAdapter.java](app/src/main/java/com/retry/flixy/adapters/HomeWatchlistAdapter.java)
-[item_content_source.xml](app/src/main/res/layout/item_content_source.xml)
-[item_download.xml](app/src/main/res/layout/item_download.xml)
-[MainActivity.java](app/src/main/java/com/retry/flixy/activities/MainActivity.java)
-[MainViewModel.java](app/src/main/java/com/retry/flixy/viewmodel/MainViewModel.java)
-[MovieDetailActivity.java](app/src/main/java/com/retry/flixy/activities/MovieDetailActivity.java)
-[MyFirebaseMessagingService.java](app/src/main/java/com/retry/flixy/utils/MyFirebaseMessagingService.java)
-[MyInterstitialAds.java](app/src/main/java/com/retry/flixy/utils/adds/MyInterstitialAds.java)
-[PlayerNewActivity.java](app/src/main/java/com/retry/flixy/activities/PlayerNewActivity.java)
-[PlayerViewModel.java](app/src/main/java/com/retry/flixy/viewmodel/PlayerViewModel.java)
-[SessionManager.java](app/src/main/java/com/retry/flixy/utils/SessionManager.java)
-[SplashActivity.java](app/src/main/java/com/retry/flixy/activities/SplashActivity.java)
-[strings.xml](app/src/main/res/values/strings.xml)
-[strings.xml](app/src/main/res/values-ar/strings.xml)
-[strings.xml](app/src/main/res/values-da/strings.xml)
-[strings.xml](app/src/main/res/values-de/strings.xml)
-[strings.xml](app/src/main/res/values-el/strings.xml)
-[strings.xml](app/src/main/res/values-en/strings.xml)
-[strings.xml](app/src/main/res/values-es/strings.xml)
-[strings.xml](app/src/main/res/values-fr/strings.xml)
-[strings.xml](app/src/main/res/values-hi/strings.xml)
-[strings.xml](app/src/main/res/values-in/strings.xml)
-[strings.xml](app/src/main/res/values-it/strings.xml)
-[strings.xml](app/src/main/res/values-ja/strings.xml)
-[strings.xml](app/src/main/res/values-ko/strings.xml)
-[strings.xml](app/src/main/res/values-nb/strings.xml)
-[strings.xml](app/src/main/res/values-nl/strings.xml)
-[strings.xml](app/src/main/res/values-pl/strings.xml)
-[strings.xml](app/src/main/res/values-pt/strings.xml)
-[strings.xml](app/src/main/res/values-ru/strings.xml)
-[strings.xml](app/src/main/res/values-sv/strings.xml)
-[strings.xml](app/src/main/res/values-th/strings.xml)
-[strings.xml](app/src/main/res/values-tr/strings.xml)
-[strings.xml](app/src/main/res/values-vi/strings.xml)
-[strings.xml](app/src/main/res/values-zh/strings.xml)

#### Deleted Files

None

====================================================================

# Date: 15 October, 2024

## Summary

- Solved Issues:-

1) Dialogue Blur issue solved
2) Android 14 Compatible

#### Updated Files

-[ChannelByCategoriesActivity.java](app/src/main/java/com/retry/flixy/activities/ChannelByCategoriesActivity.java)
-[DownloadsActivity.java](app/src/main/java/com/retry/flixy/activities/DownloadsActivity.java)
-[DownloadsSeriesActivity.java](app/src/main/java/com/retry/flixy/activities/DownloadsSeriesActivity.java)
-[MovieDetailActivity.java](app/src/main/java/com/retry/flixy/activities/MovieDetailActivity.java)
-[ProfileActivity.java](app/src/main/java/com/retry/flixy/activities/ProfileActivity.java)
-[SearchLiveTvActivity.java](app/src/main/java/com/retry/flixy/activities/SearchLiveTvActivity.java)

-[LiveTvFragment.java](app/src/main/java/com/retry/flixy/fragments/LiveTvFragment.java)

-[CustomDialogBuilder.java](app/src/main/java/com/retry/flixy/utils/CustomDialogBuilder.java)

-[PlayerViewModel.java](app/src/main/java/com/retry/flixy/viewmodel/PlayerViewModel.java)

-[activity_player_new.xml](app/src/main/res/layout/activity_player_new.xml)

-[build.gradle](app/build.gradle)

-[strings.xml](app/src/main/res/values/strings.xml)
-[strings.xml](app/src/main/res/values-ar/strings.xml)
-[strings.xml](app/src/main/res/values-da/strings.xml)
-[strings.xml](app/src/main/res/values-de/strings.xml)
-[strings.xml](app/src/main/res/values-el/strings.xml)
-[strings.xml](app/src/main/res/values-en/strings.xml)
-[strings.xml](app/src/main/res/values-es/strings.xml)
-[strings.xml](app/src/main/res/values-fr/strings.xml)
-[strings.xml](app/src/main/res/values-hi/strings.xml)
-[strings.xml](app/src/main/res/values-in/strings.xml)
-[strings.xml](app/src/main/res/values-it/strings.xml)
-[strings.xml](app/src/main/res/values-ja/strings.xml)
-[strings.xml](app/src/main/res/values-ko/strings.xml)
-[strings.xml](app/src/main/res/values-nb/strings.xml)
-[strings.xml](app/src/main/res/values-nl/strings.xml)
-[strings.xml](app/src/main/res/values-pl/strings.xml)
-[strings.xml](app/src/main/res/values-pt/strings.xml)
-[strings.xml](app/src/main/res/values-ru/strings.xml)
-[strings.xml](app/src/main/res/values-sv/strings.xml)
-[strings.xml](app/src/main/res/values-th/strings.xml)
-[strings.xml](app/src/main/res/values-tr/strings.xml)
-[strings.xml](app/src/main/res/values-vi/strings.xml)
-[strings.xml](app/src/main/res/values-zh/strings.xml)

-[AndroidManifest.xml](app/src/main/AndroidManifest.xml)

#### Added Files

None

#### Deleted Files

None

====================================================================

# Date: 30 Aug, 2024

## Summary

- Solved Issues:-

1) .m3u8 player
2) Crash of home page

#### Updated Files

-[PlayerNewActivity.java](app/src/main/java/com/retry/flixy/activities/PlayerNewActivity.java)
-[HomeFragment.java](app/src/main/java/com/retry/flixy/fragments/HomeFragment.java)
-[activity_player_new.xml](app/src/main/res/layout/activity_player_new.xml)

#### Added Files

None

#### Deleted Files

None

====================================================================

====================================================================

# Date: 12 Aug, 2024

## Summary

- project updated, all files have been changed

#### Updated Files

#### Added Files

#### Deleted Files

====================================================================

