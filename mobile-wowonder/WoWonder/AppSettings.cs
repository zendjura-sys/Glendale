//##############################################
//Cᴏᴘʏʀɪɢʜᴛ 2020 DᴏᴜɢʜᴏᴜᴢLɪɢʜᴛ Codecanyon Item 19703216
//Elin Doughouz >> https://www.facebook.com/Elindoughouz
//====================================================

//For the accuracy of the icon and logo, please use this website " https://appicon.co " and add images according to size in folders " mipmap " 

using System.Collections.Generic;
using SocketIOClient.Transport;
using WoWonder.Helpers.Model;
using WoWonderClient;
using static WoWonder.Activities.NativePost.Extra.WRecyclerView;

namespace WoWonder
{
    internal static class AppSettings
    {
        /// <summary>
        /// Deep Links To App Content
        /// you should add your website without http in the analytic.xml file >> ../values/analytic.xml .. line 5
        /// <string name="ApplicationUrlWeb">demo.wowonder.com</string>
        /// </summary>
        public static readonly string TripleDesAppServiceProvider = "1AyC1ApTze+hNZz3RU9a1qFYs6rMtXY9xky1ztO29fkId/khKlQS5MK0MjHovWDbfQEHPGioGzpK9Emon5S/y+U+/NtAmGN1znhhfNsnjpTLOmxWjh3vWwfcnmgdv4124AV9sLil/4UO4n+Q9aImLdqp4lUC3jrFS+QsRNXUbzTqs6eOs12dob5QJ5tnH3Fy2JGI46Qz1unx19ACzMoLHUCWQNpyvKPmVv59ZI+DxjKv8a+OhdMuExrxP47lnyIhBw5c5xkFMwZK0TwRpB4jFPYk2pgdprmJ3cMm3qS5d0leKV7ZN4G2WOGOghi2hdChRzmnVeXv6lszSKsd17CxzZ+zFCYl2ODhlutc8akHRpHc3PdDGIOw+UyEomUJctih2EaUjcHtLtw+q2cyKhK7S/0vZcCJ9ZV/cj0rC3bxbG9PdMP9AraoRSHGjNJ4Q5HX98Bbqk1ErX7MuX5I4r9J48YZTXYCAoT8764z9nmYW897cjKbSV6hYdcZlnvX4kpTM950gAoANc6syM0F0oxQEnldYQMzqHU2jReNJhxLDkGIn9Jw1Hz5WivcY8w/DwLAsThRpcw7ByrYi+56+uivMWoAhPlw0MVcURKqMr6FZFnMj+R8lKni0iqdQCmpbnc8oVVYuntdoNI0yKh2OnmdCPzKEJXrl6jQSPqaCOEnjyP5XKemcRF8QpZmqZsetXkhwVD1fp/5BvCUHWtoaXnynWiUC+gmtXG9Y/t47aN5L9sr4FTZyhPLZrsAR6lB3OhiqTq+X9zWxC2JTzKIJyjcmPsI0N4LOTPEOU3+LUxm5dbfg1NiELjImOmeH19dB8UqU/iqUaDxBzyF/W95Vi9yBgV414CdNgBQPk94++R74zC7XBjmcY9nNmVpyfyhDYj5XVOquEjD9BOUMa6i7SPjFk7lVKmq+bNyBfEpJF5kuOQppMQEP76/+OTjdRPY6zWECG+dE7lK2MsEa2ucJgn6G7gtX4R+/lzL9iPJTtitMNl3Yx7ETR7+60mMZG0q+38ISK9/V8ofpM24i8goYaNVY3IU2ondiHS/d0lf/j74C7Nci9zQqD05uBUmosiPFBxTXtyjEoEH9P872bSz5iseaONR67+IM4scJcK3yeAHiiEtlVUgHM+BL0b/J1fUWanuTqoWbJoEYraHocr6SqTwRpEubmS+E9wUpjZiN50+EYf02vng3Czrdn9qKXbQT4fe0W33qgiaHUVllz0QIE8mBT5g9IocfzLMsZ9lEoHF4yLdLcTdrZG8glvB2A/Q6ZsTHrIMmEWLOZC7M6tUTgfGdyMXTwI+pqPDuLR+RT1BgXWS14ccEshkjzkz8cPG/f1Ls/cWPujpBXiv+qfipRjA8tq5XM2y6VutwhHvYeWWha+64NMFmDPg95+yPMe8gYhPSNRfbSF8de/5CvLNxxuaI07enFiUnFdLx5FsfTxdy6TIKtkufGQd4vaI7gcnqIempvsBkzjh1vw1Ryr/YfZPUwgp6LgXnECGg0Jd/dpNHLDXVXPqN9QCckLghxMDvlzqr9vKC2HgtNoFsONmzK9yE4rmQC4IX9M/+/U2qzKlmesYnd0Wv7qbGcT/LThENQgL9TV5ZAZ50FUQ58KZH4oFoG746GyeBczJNK24emmGEz/nRZyT8Irywla3MDWLZCEWJh970CF753tk6xhVJr7S0g==";

        //Main Settings >>>>>
        //*********************************************************
        public static string Version = "4.6";
        public static readonly string ApplicationName = "WoWonder Combined";
        public static readonly string DatabaseName = "WowonderSocial";

        // Friend system = 0 , follow system = 1
        public static readonly int ConnectivitySystem = 1;

        /// <summary>
        /// When you select the application mode type.. some settings will be changed and some features will be deactivated..
        /// ==============================================
        /// AppMode.Default : (Facebook) Mode
        /// AppMode.LinkedIn : (Jobs) Mode
        /// 
        /// AppMode.Instagram >> #Next Version 
        /// ==============================================
        /// </summary>
        public static readonly AppMode AppMode = AppMode.Default;

        //Main Colors >>
        //*********************************************************
        public static readonly string MainColor = "#A52729";
         
        //Language Settings >> http://www.lingoes.net/en/translator/langcode.htm
        //*********************************************************
        public static bool FlowDirectionRightToLeft = false;
        public static string Lang = ""; //Default language ar

        //Set Language User on site from phone 
        public static readonly bool SetLangUser = false;

        public static readonly Dictionary<string, string> LanguageList = new Dictionary<string, string>()
        {
            {"en", "English"},
            {"ar", "Arabic"},
        };

        //Error Report Mode
        //*********************************************************
        public static readonly bool SetApisReportMode = false;

        //Notification Settings >>
        //*********************************************************
        public static bool ShowNotification = true;
        public static string OneSignalAppId = "64974c58-9993-40ed-b782-0814edc401ea";
        public static string MsgOneSignalAppId = "64974c58-9993-40ed-b782-0814edc401ea";

        // WalkThrough Settings >>
        //*********************************************************
        public static readonly bool ShowWalkTroutPage = true;

        //Main Messenger settings
        //*********************************************************
        public static readonly bool MessengerIntegration = true;
        public static readonly bool ShowDialogAskOpenMessenger = false;
        public static readonly string MessengerPackageName = "com.wowonderandroid.messenger"; //APK name on Google Play

        //AdMob >> Please add the code ad in the Here and analytic.xml 
        //*********************************************************
        public static readonly ShowAds ShowAds = ShowAds.AllUsers;

        public static readonly bool RewardedAdvertisingSystem = true;

        //Three times after entering the ad is displayed
        public static readonly int ShowAdInterstitialCount = 5;
        public static readonly int ShowAdRewardedVideoCount = 5;
        public static readonly int ShowAdNativeCount = 40;
        public static readonly int ShowAdNativeCommentCount = 7;
        public static readonly int ShowAdNativeReelsCount = 4;
        public static readonly int ShowAdAppOpenCount = 3;

        public static readonly bool ShowAdMobBanner = true;
        public static readonly bool ShowAdMobInterstitial = true;
        public static readonly bool ShowAdMobRewardVideo = true;
        public static readonly bool ShowAdMobNative = true;
        public static readonly bool ShowAdMobNativePost = true;
        public static readonly bool ShowAdMobAppOpen = true;
        public static readonly bool ShowAdMobRewardedInterstitial = true;

        public static readonly string AdInterstitialKey = "ca-app-pub-5135691635931982/3584502890";
        public static readonly string AdRewardVideoKey = "ca-app-pub-5135691635931982/2518408206";
        public static readonly string AdAdMobNativeKey = "ca-app-pub-5135691635931982/2280543246";
        public static readonly string AdAdMobAppOpenKey = "ca-app-pub-5135691635931982/2813560515";
        public static readonly string AdRewardedInterstitialKey = "ca-app-pub-5135691635931982/7842669101";

        //FaceBook Ads >> Please add the code ad in the Here and analytic.xml 
        //*********************************************************
        public static readonly bool ShowFbBannerAds = false;
        public static readonly bool ShowFbInterstitialAds = false;
        public static readonly bool ShowFbRewardVideoAds = false;
        public static readonly bool ShowFbNativeAds = false;

        //YOUR_PLACEMENT_ID
        public static readonly string AdsFbBannerKey = "250485588986218_554026418632132";
        public static readonly string AdsFbInterstitialKey = "250485588986218_554026125298828";
        public static readonly string AdsFbRewardVideoKey = "250485588986218_554072818627492";
        public static readonly string AdsFbNativeKey = "250485588986218_554706301897477";

        //Ads AppLovin >> Please add the code ad in the Here 
        //*********************************************************  
        public static readonly bool ShowAppLovinBannerAds = false;
        public static readonly bool ShowAppLovinInterstitialAds = false;
        public static readonly bool ShowAppLovinRewardAds = false;

        public static readonly string AdsAppLovinBannerId = "93a37dd25bd3f699";
        public static readonly string AdsAppLovinInterstitialId = "5fec6909ce79fb49";
        public static readonly string AdsAppLovinRewardedId = "3fdddf11aca6ce57";
        //********************************************************* 

        public static readonly bool EnableRegisterSystem = true;

        public static readonly bool ShowBirthdayInRegister = false;

        /// <summary>
        /// true => Only over 18 years old
        /// false => all 
        /// </summary>
        public static readonly bool IsUserYearsOld = true;
        public static readonly bool AddAllInfoPorfileAfterRegister = true;

        //Set Theme Full Screen App
        //*********************************************************
        public static readonly bool EnableFullScreenApp = false;

        //Code Time Zone (true => Get from Internet , false => Get From #CodeTimeZone )
        //*********************************************************
        public static readonly bool AutoCodeTimeZone = true;
        public static readonly string CodeTimeZone = "UTC";

        //Social Logins >>
        //If you want login with facebook or google you should change id key in the analytic.xml file 
        //Facebook >> ../values/analytic.xml .. line 10-11 
        //Google >> ../values/analytic.xml .. line 15 
        //*********************************************************
        public static readonly bool EnableSmartLockForPasswords = false;

        public static readonly bool ShowFacebookLogin = true;
        public static readonly bool ShowGoogleLogin = true;

        public static readonly string ClientId = "657181382689-ubjs94kivnge4isi0im9s1iq382ujsvq.apps.googleusercontent.com";

        //########################### 

        //Main Slider settings
        //*********************************************************
        public static readonly PostButtonSystem PostButton = PostButtonSystem.Reaction;
        public static readonly ToastTheme ToastTheme = ToastTheme.Default;

        /// <summary>
        /// None : To disable Reels video on the app 
        /// </summary>
        public static readonly ReelsPosition ReelsPosition = ReelsPosition.Tab;
        public static readonly bool ShowYouTubeReels = true;
        public static readonly bool ShowUsernameReels = false;


        public static readonly bool ShowBottomAddOnTab = true;

        public static readonly long RefreshAppAPiSeconds = 30000;

        public static readonly bool ShowAlbum = true;
        public static bool ShowArticles = true;
        public static bool ShowPokes = true;
        public static bool ShowCommunitiesGroups = true;
        public static bool ShowCommunitiesPages = true;
        public static bool ShowMarket = true;
        public static readonly bool ShowPopularPosts = true;
        /// <summary>
        /// if selected false will remove boost post and get list Boosted Posts
        /// </summary>
        public static readonly bool ShowBoostedPosts = true;
        public static readonly bool ShowBoostedPages = true;
        public static bool ShowMovies = true;
        public static readonly bool ShowNearBy = true;
        public static bool ShowStory = true;
        public static readonly bool ShowSavedPost = true;
        public static readonly bool ShowUserContacts = true;
        public static bool ShowJobs = true;
        public static bool ShowCommonThings = true;
        public static bool ShowFundings = true;
        public static readonly bool ShowMyPhoto = true;
        public static readonly bool ShowMyVideo = true;
        public static bool ShowGames = true;
        public static bool ShowMemories = true;
        public static readonly bool ShowOffers = true;
        public static readonly bool ShowNearbyShops = true;

        public static readonly bool ShowSuggestedPage = true;
        public static readonly bool ShowSuggestedGroup = true;
        public static readonly bool ShowSuggestedUser = true;

        public static readonly bool ShowCommentImage = true;
        public static readonly bool ShowCommentRecordVoice = true;

        //count times after entering the Suggestion is displayed
        public static readonly int ShowSuggestedPageCount = 90;
        public static readonly int ShowSuggestedGroupCount = 70;
        public static readonly int ShowSuggestedUserCount = 50;

        //allow download or not when share
        public static readonly bool AllowDownloadMedia = true;

        public static readonly bool ShowAdvertise = true;

        /// <summary>
        /// https://rapidapi.com/api-sports/api/covid-193
        /// you can get api key and host from here https://prnt.sc/wngxfc 
        /// </summary>
        public static readonly bool ShowInfoCoronaVirus = false;
        public static readonly string KeyCoronaVirus = "164300ef98msh0911b69bed3814bp131c76jsneaca9364e61f";
        public static readonly string HostCoronaVirus = "covid-193.p.rapidapi.com";

        public static readonly bool ShowLive = true;
        public static readonly string AppIdAgoraLive = "7f1cb06a3b4d4e84965ea6d3b3e16a8a";
       
        //Events settings
        //*********************************************************  
        public static bool ShowEvents = true;
        public static readonly bool ShowEventGoing = true;
        public static readonly bool ShowEventInvited = true;
        public static readonly bool ShowEventInterested = true;
        public static readonly bool ShowEventPast = true;

        // Story >>
        //*********************************************************
        //Set a story duration >> Sec
        public static readonly long StoryImageDuration = 7;
        public static readonly long StoryVideoDuration = 30;

        /// <summary>
        /// If it is false, it will appear only for the specified time in the value of the StoryVideoDuration
        /// </summary>
        public static readonly bool ShowFullVideo = false;

        public static readonly bool EnableStorySeenList = true;
        public static readonly bool EnableReplyStory = true;

        /// <summary>
        /// https://dashboard.stipop.io/
        /// you can get api key from here https://prnt.sc/26ofmq9
        /// </summary>
        public static readonly string StickersApikey = "950a22e795ca1f047842854e3305a5df";

        //*********************************************************

        /// <summary>
        ///  Currency
        /// CurrencyStatic = true : get currency from app not api 
        /// CurrencyStatic = false : get currency from api (default)
        /// </summary>
        public static readonly bool CurrencyStatic = false;
        public static readonly string CurrencyIconStatic = "$";
        public static readonly string CurrencyCodeStatic = "USD";
        public static readonly string CurrencyFundingPriceStatic = "$";

        //Profile settings
        //*********************************************************
        public static readonly bool ShowGift = true;
        public static readonly bool ShowWallet = true;
        public static readonly bool ShowGoPro = true;
        public static readonly bool ShowAddToFamily = true;

        public static readonly bool ShowUserGroup = false;
        public static readonly bool ShowUserPage = false;
        public static readonly bool ShowUserImage = true;
        public static readonly bool ShowUserSocialLinks = false;

        public static readonly CoverImageStyle CoverImageStyle = CoverImageStyle.CenterCrop;

        /// <summary>
        /// The default value comes from the site .. in case it is not available, it is taken from these values
        /// </summary>
        public static readonly string WeeklyPrice = "3";
        public static readonly string MonthlyPrice = "8";
        public static readonly string YearlyPrice = "89";
        public static readonly string LifetimePrice = "259";

        //Native Post settings
        //********************************************************* 
        public static readonly bool ShowTextWithSpace = true;

        public static readonly bool ShowTextShareButton = false;
        public static readonly bool ShowShareButton = true;

        public static readonly int AvatarPostSize = 60;
        public static readonly int ImagePostSize = 200;
        public static readonly string PostApiLimitOnScroll = "8";

        public static readonly string PostApiLimitOnBackground = "10";

        public static readonly bool AutoPlayVideo = true;

        public static readonly bool EmbedDeepSoundPostType = true;
        public static readonly VideoPostTypeSystem EmbedFacebookVideoPostType = VideoPostTypeSystem.EmbedVideo;
        public static readonly VideoPostTypeSystem EmbedVimeoVideoPostType = VideoPostTypeSystem.EmbedVideo;
        public static readonly VideoPostTypeSystem EmbedPlayTubeVideoPostType = VideoPostTypeSystem.EmbedVideo;
        public static readonly VideoPostTypeSystem EmbedTikTokVideoPostType = VideoPostTypeSystem.Link;
        public static readonly VideoPostTypeSystem EmbedTwitterPostType = VideoPostTypeSystem.Link;
        public static readonly bool ShowSearchForPosts = true;
        public static readonly bool EmbedLivePostType = true;

        public static readonly string PlayTubeShortUrlSite = "https://ptub.app/";

        //new posts users have to scroll back to top
        public static readonly bool ShowNewPostOnNewsFeed = true;
        public static readonly bool ShowAddPostOnNewsFeed = false;
        public static readonly bool ShowCountSharePost = true;

        /// <summary>
        /// Post Privacy
        /// ShowPostPrivacyForAllUser = true : all posts user have icon Privacy 
        /// ShowPostPrivacyForAllUser = false : just my posts have icon Privacy (default)
        /// </summary>
        public static readonly bool ShowPostPrivacyForAllUser = false;

        public static readonly bool EnableVideoCompress = true;
        public static readonly bool EnableFitchOgLink = true;

        /// <summary>
        /// On : if the length of the text is more than 50 characters will be text is bigger
        /// Off : all text same size
        /// </summary>
        public static readonly VolumeState TextSizeDescriptionPost = VolumeState.On;

        //Trending page
        //*********************************************************   
        public static readonly bool ShowTrendingPage = true;

        public static readonly bool ShowProUsersMembers = true;
        public static readonly bool ShowPromotedPages = true;
        public static readonly bool ShowTrendingHashTags = true;
        public static readonly bool ShowLastActivities = true;
        public static readonly bool ShowShortcuts = true;
        public static readonly bool ShowFriendsBirthday = true;
        public static readonly bool ShowAnnouncement = true;

        /// <summary>
        /// https://www.weatherapi.com
        /// </summary>
        public static readonly WeatherType WeatherType = WeatherType.Celsius;
        public static readonly bool ShowWeather = true;
        public static readonly string KeyWeatherApi = "a413d0bf31a44369a16140106221804";

        /// <summary>
        /// https://openexchangerates.org
        /// #Currency >> Your currency
        /// #Currencies >> you can use just 3 from those : USD,EUR,DKK,GBP,SEK,NOK,CAD,JPY,TRY,EGP,SAR,JOD,KWD,IQD,BHD,DZD,LYD,AED,QAR,LBP,OMR,AFN,ALL,ARS,AMD,AUD,BYN,BRL,BGN,CLP,CNY,MYR,MAD,ILS,TND,YER
        /// </summary>
        public static readonly bool ShowExchangeCurrency = false;
        public static readonly string KeyCurrencyApi = "644761ef2ba94ea5aa84767109d6cf7b";
        public static readonly string ExCurrency = "USD";
        public static readonly string ExCurrencies = "EUR,GBP,TRY";
        public static readonly List<string> ExCurrenciesIcons = new List<string> { "€", "£", "₺" };

        //********************************************************* 

        /// <summary>
        /// you can edit video using FFMPEG 
        /// </summary>
        public static readonly bool EnableVideoEditor = true;


        public static readonly bool ShowUserPoint = true;

        //Add Post
        public static readonly AddPostSystem AddPostSystem = AddPostSystem.AllUsers;

        public static readonly bool ShowGalleryImage = true;
        public static readonly bool ShowGalleryVideo = true;
        public static readonly bool ShowMention = true;
        public static readonly bool ShowLocation = true;
        public static readonly bool ShowFeelingActivity = true;
        public static readonly bool ShowFeeling = true;
        public static readonly bool ShowListening = true;
        public static readonly bool ShowPlaying = true;
        public static readonly bool ShowWatching = true;
        public static readonly bool ShowTraveling = true;
        public static readonly bool ShowGif = true;
        public static readonly bool ShowFile = true;
        public static readonly bool ShowMusic = true;
        public static readonly bool ShowPolls = true;
        public static readonly bool ShowColor = true;
        public static readonly bool ShowVoiceRecord = true;

        public static readonly bool ShowAnonymousPrivacyPost = true;

        //Advertising 
        public static readonly bool ShowAdvertisingPost = true;

        //Settings Page >> General Account
        public static readonly bool ShowSettingsGeneralAccount = true;
        public static readonly bool ShowSettingsAccount = true;
        public static readonly bool ShowSettingsSocialLinks = true;
        public static readonly bool ShowSettingsPassword = true;
        public static readonly bool ShowSettingsBlockedUsers = true;
        public static readonly bool ShowSettingsDeleteAccount = true;
        public static readonly bool ShowSettingsTwoFactor = true;
        public static readonly bool ShowSettingsManageSessions = true;
        public static readonly bool ShowSettingsVerification = true;

        public static readonly bool ShowSettingsSocialLinksFacebook = true;
        public static readonly bool ShowSettingsSocialLinksTwitter = true;
        public static readonly bool ShowSettingsSocialLinksGoogle = true;
        public static readonly bool ShowSettingsSocialLinksVkontakte = true;
        public static readonly bool ShowSettingsSocialLinksLinkedin = true;
        public static readonly bool ShowSettingsSocialLinksInstagram = true;
        public static readonly bool ShowSettingsSocialLinksYouTube = true;

        //Settings Page >> Privacy
        public static readonly bool ShowSettingsPrivacy = true;
        public static readonly bool ShowSettingsNotification = true;

        //Settings Page >> Tell a Friends (Earnings)
        public static readonly bool ShowSettingsInviteFriends = true;

        public static readonly bool ShowSettingsShare = true;
        public static readonly bool ShowSettingsMyAffiliates = true;
        public static readonly bool ShowWithdrawals = true;

        /// <summary>
        /// if you want this feature enabled go to Properties -> AndroidManefist.xml and remove comments from below code
        /// Just replace it with this 5 lines of code
        /// <uses-permission android:name="android.permission.READ_CONTACTS" />
        /// <uses-permission android:name="android.permission.READ_PHONE_NUMBERS" />
        /// </summary>
        public static readonly bool InvitationSystem = true;

        //Settings Page >> Help && Support
        public static readonly bool ShowSettingsHelpSupport = true;

        public static readonly bool ShowSettingsHelp = true;
        public static readonly bool ShowSettingsReportProblem = true;
        public static readonly bool ShowSettingsAbout = true;
        public static readonly bool ShowSettingsPrivacyPolicy = true;
        public static readonly bool ShowSettingsTermsOfUse = true;

        public static readonly bool ShowSettingsRateApp = true;
        public static readonly int ShowRateAppCount = 5;

        public static readonly bool ShowSettingsUpdateManagerApp = true;

        public static readonly bool ShowSettingsInvitationLinks = true;
        public static readonly bool ShowSettingsMyInformation = true;

        public static readonly bool ShowSuggestedUsersOnRegister = true;


        public static readonly bool ShowAddress = true;

        //Set Theme Tab
        //*********************************************************
        public static TabTheme SetTabDarkTheme = TabTheme.Light;
        public static readonly MoreTheme MoreTheme = MoreTheme.Grid;

        //Bypass Web Errors  
        //*********************************************************
        public static readonly bool TurnTrustFailureOnWebException = true;
        public static readonly bool TurnSecurityProtocolType3072On = true;

        //Payment System
        //*********************************************************
        /// <summary>
        /// if you want this feature enabled go to Properties -> AndroidManefist.xml and remove comments from below code
        /// <uses-permission android:name="com.android.vending.BILLING" />
        /// </summary>
        public static readonly bool ShowInAppBilling = true;

        /// <summary>
        /// Paypal and google pay using Braintree Gateway https://www.braintreepayments.com/
        /// 
        /// Add info keys in Payment Methods : https://prnt.sc/1z5bffc - https://prnt.sc/1z5b0yj
        /// To find your merchant ID :  https://prnt.sc/1z59dy8
        ///
        /// Tokenization Keys : https://prnt.sc/1z59smv
        /// </summary>
        public static readonly bool ShowPaypal = true;
        public static readonly string MerchantAccountId = "test";

        public static readonly string SandboxTokenizationKey = "sandbox_cs5chhwp_hf4ccmn4t******";
        public static readonly string ProductionTokenizationKey = "production_t2wns2y2_dfy45jdj3dxkmz5m";

        public static readonly bool ShowCreditCard = true;
        public static readonly bool ShowBankTransfer = true;

        public static readonly bool ShowCashFree = true;
        /// <summary>
        /// Currencies : http://prntscr.com/u600ok
        /// </summary>
        public static readonly string CashFreeCurrency = "INR";

        /// <summary>
        /// If you want RazorPay you should change id key in the analytic.xml file
        /// razorpay_api_Key >> .. line 28 
        /// </summary>
        public static readonly bool ShowRazorPay = true;
        /// <summary>
        /// Currencies : https://razorpay.com/accept-international-payments
        /// </summary>
        public static readonly string RazorPayCurrency = "INR";

        public static readonly bool ShowAuthorizeNet = true;
        public static readonly bool ShowSecurionPay = true;
        public static readonly bool ShowIyziPay = true;
        public static readonly bool ShowPayStack = true;
        public static readonly bool ShowPaySera = true;
        public static readonly bool ShowAamarPay = true;

        /// <summary>
        /// FlutterWave get Api Keys From https://app.flutterwave.com/dashboard/settings/apis/live
        /// </summary>
        public static readonly bool ShowFlutterWave = true;
        public static readonly string FlutterWaveCurrency = "NGN";
        public static readonly string FlutterWavePublicKey = "FLWPUBK_TEST-9c877b3110438191127e631c8*****";
        public static readonly string FlutterWaveEncryptionKey = "FLWSECK_TEST298f1****";
        //********************************************************* 

        //########################################### 
        //Chat
        //*********************************************************  
        public static readonly InitializeWoWonder.ConnectionType ConnectionTypeChat = InitializeWoWonder.ConnectionType.Socket;
        public static readonly string PortSocketServer = "449";
        public static readonly TransportProtocol Transport = TransportProtocol.Polling;

        //Chat Window Activity >>
        //*********************************************************
        //if you want this feature enabled go to Properties -> AndroidManefist.xml and remove comments from below code
        //Just replace it with this 5 lines of code
        /*
         <uses-permission android:name="android.permission.READ_CONTACTS" />
         <uses-permission android:name="android.permission.READ_PHONE_NUMBERS" /> 
         */
        public static readonly bool ShowButtonContact = true;
        /////////////////////////////////////

        public static readonly ChatTheme ChatTheme = ChatTheme.Default;

        public static readonly bool ShowButtonCamera = true;
        public static readonly bool ShowButtonImage = true;
        public static readonly bool ShowButtonVideo = true;
        public static readonly bool ShowButtonAttachFile = true;
        public static readonly bool ShowButtonColor = true;
        public static readonly bool ShowButtonStickers = true;
        public static readonly bool ShowButtonMusic = true;
        public static readonly bool ShowButtonGif = true;
        public static readonly bool ShowButtonLocation = true;

        public static readonly bool OpenVideoFromApp = true;
        public static readonly bool OpenImageFromApp = true;

        //Record Sound Style & Text 
        public static readonly bool ShowButtonRecordSound = true;

        // Options List Message
        public static readonly bool EnableReplyMessageSystem = true;
        public static readonly bool EnableForwardMessageSystem = true;
        public static readonly bool EnableFavoriteMessageSystem = true;
        public static readonly bool EnablePinMessageSystem = true;
        public static readonly bool EnableReactionMessageSystem = true;

        public static readonly bool ShowNotificationWithUpload = true;

        public static readonly bool EnableSuggestionMessage = true;
        public static readonly bool ShowSearchForMessage = true;

        //List Chat >>
        //*********************************************************
        public static readonly bool EnableChatPage = false; //>> Next update 
        public static readonly bool EnableChatGroup = true;
        public static readonly bool EnableBroadcast = true;

        // Options List Chat
        public static readonly bool EnableChatArchive = true;
        public static readonly bool EnableChatPin = true;
        public static readonly bool EnableChatMute = true;
        public static readonly bool EnableChatMakeAsRead = true;


        // Video/Audio Call Settings >>
        //*********************************************************
        public static readonly EnableCall EnableCall = EnableCall.AudioAndVideo;
        public static readonly SystemCall UseLibrary = SystemCall.Agora;

        //Last Messages Page >>
        //*********************************************************
        public static readonly bool ShowOnlineOfflineMessage = true;

        public static readonly int MessageRequestSpeed = 4000; // 3 Seconds

        public static readonly ColorMessageTheme ColorMessageTheme = ColorMessageTheme.Default;

        //Settings Page >> General Account
        public static readonly bool ShowSettingsWallpaper = true;

        //Options chat heads (Bubbles) 
        //*********************************************************
        public static readonly bool ShowChatHeads = true;
        public static readonly bool ShowSettingsFingerprintLock = true;

        //Always , Hide , FullScreen
        public static readonly string DisplayModeSettings = "Always";

        //Default , Left  , Right , Nearest , Fix , Thrown
        public static readonly string MoveDirectionSettings = "Right";

        //Circle , Rectangle
        public static readonly string ShapeSettings = "Circle";

        // Last position
        public static readonly bool IsUseLastPosition = true;

    }
}