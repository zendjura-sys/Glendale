using Android.App;
using Android.Content;
using Android.Content.Res;
using Android.Graphics;
using Android.Views;
using Android.Widget;
using Java.Lang;
using Q.Rorbin.Badgeview;
using WoWonder.Activities.Chat.MsgTabbes;
using WoWonder.Helpers.Ads;
using WoWonder.Helpers.Utils;
using WoWonderClient.Classes.Call;
using Exception = System.Exception;

namespace WoWonder.Helpers.Chat
{
    public class BottomNavigationTabChat : Object, View.IOnClickListener
    {
        private readonly ChatTabbedMainActivity MainActivity;

        private LinearLayout Tab, ChatLayout, CallLayout, AddLayout;
        private ImageView ImageChat, ImageCall;

        private ImageView FloatingActionImageView;

        private readonly Color UnSelectColor = Color.ParseColor("#dddddd");

        public BottomNavigationTabChat(ChatTabbedMainActivity activity)
        {
            try
            {
                MainActivity = activity;

                Initialize();
            }
            catch (Exception e)
            {
                Methods.DisplayReportResultTrack(e);
            }
        }

        private void Initialize()
        {
            try
            {
                Tab = MainActivity.FindViewById<LinearLayout>(Resource.Id.bottomnavigationtab);
                Tab.BackgroundTintList = ColorStateList.ValueOf(WoWonderTools.IsTabDark() ? Color.Black : Color.White);

                ChatLayout = MainActivity.FindViewById<LinearLayout>(Resource.Id.llChat);
                ImageChat = MainActivity.FindViewById<ImageView>(Resource.Id.ivChat);

                AddLayout = MainActivity.FindViewById<LinearLayout>(Resource.Id.llAdd);
                FloatingActionImageView = MainActivity.FindViewById<ImageView>(Resource.Id.Image);

                CallLayout = MainActivity.FindViewById<LinearLayout>(Resource.Id.llCall);
                ImageCall = MainActivity.FindViewById<ImageView>(Resource.Id.ivCall);

                ChatLayout?.SetOnClickListener(this);
                AddLayout?.SetOnClickListener(this);
                CallLayout?.SetOnClickListener(this);

                float weightSum = 3;

                var videoCall = ChatTools.CheckAllowedCall(TypeCall.Video);
                var audioCall = ChatTools.CheckAllowedCall(TypeCall.Audio);

                if (!videoCall && !audioCall)
                {
                    CallLayout.Visibility = ViewStates.Gone;
                    weightSum--;
                }

                Tab.WeightSum = weightSum;
            }
            catch (Exception e)
            {
                Methods.DisplayReportResultTrack(e);
            }
        }

        public void SelectItem(int index)
        {
            try
            {
                ImageChat.SetColorFilter(UnSelectColor);
                ImageCall.SetColorFilter(UnSelectColor);

                switch (index)
                {
                    //Chat
                    case 0:
                        {
                            ImageChat.SetColorFilter(Color.ParseColor(AppSettings.MainColor));

                            MainActivity.ViewPager.SetCurrentItem(0, false);

                            AdsGoogle.Ad_Interstitial(MainActivity);
                            break;
                        }
                    //Call
                    case 1:
                        ImageCall.SetColorFilter(Color.ParseColor(AppSettings.MainColor));
                        MainActivity.ViewPager.SetCurrentItem(1, false);

                        AdsGoogle.Ad_RewardedVideo(MainActivity);

                        break;
                    //More
                    case 3:

                        break;
                }
            }
            catch (Exception e)
            {
                Methods.DisplayReportResultTrack(e);
            }
        }

        public void ShowBadge(int id, int count, bool showBadge)
        {
            try
            {
                if (id < 0) return;

                if (showBadge)
                {
                    if (id == 0)
                        ShowOrHideBadgeViewIcon(MainActivity, ChatLayout, count, true);
                    else if (id == 1)
                        ShowOrHideBadgeViewIcon(MainActivity, CallLayout, count, true);
                }
                else if (id == 0)
                {
                    ShowOrHideBadgeViewIcon(MainActivity, ChatLayout);
                }
                else if (id == 1)
                {
                    ShowOrHideBadgeViewIcon(MainActivity, CallLayout);
                }
            }
            catch (Exception e)
            {
                Methods.DisplayReportResultTrack(e);
            }
        }


        private QBadgeView BadgeStory, BadgeCall;
        private void ShowOrHideBadgeViewIcon(Activity mainActivity, LinearLayout linearLayoutImage, int count = 0, bool show = false)
        {
            try
            {
                mainActivity?.RunOnUiThread(() =>
                {
                    try
                    {
                        if (show)
                        {
                            if (linearLayoutImage != null)
                            {
                                if (linearLayoutImage.Id == CallLayout.Id)
                                {
                                    BadgeCall = new QBadgeView(mainActivity);
                                    int gravity = (int)(GravityFlags.End | GravityFlags.Top);
                                    BadgeCall.BindTarget(linearLayoutImage);
                                    BadgeCall.SetBadgeNumber(count);
                                    BadgeCall.SetBadgeGravity(gravity);
                                    BadgeCall.SetBadgeBackgroundColor(Color.ParseColor(AppSettings.MainColor));
                                    BadgeCall.SetGravityOffset(10, true);
                                }
                            }
                        }
                        else
                        {
                            if (linearLayoutImage?.Id == CallLayout.Id)
                                BadgeCall?.BindTarget(linearLayoutImage).Hide(true);
                        }
                    }
                    catch (Exception e)
                    {
                        Methods.DisplayReportResultTrack(e);
                    }
                });
            }
            catch (Exception e)
            {
                Methods.DisplayReportResultTrack(e);
            }
        }

        public void OnClick(View v)
        {
            try
            {
                if (v.Id == ChatLayout.Id)
                {
                    SelectItem(0);
                }
                else if (v.Id == CallLayout?.Id)
                {
                    SelectItem(1);

                    //ShowBadge(1, 0, false); 
                }
                else if (v.Id == AddLayout?.Id)
                {
                    var intent = new Intent(MainActivity, typeof(AddNewChatActivity));
                    MainActivity.StartActivity(intent);
                }
            }
            catch (Exception e)
            {
                Methods.DisplayReportResultTrack(e);
            }
        }
    }
}