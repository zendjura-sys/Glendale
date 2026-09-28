package online.gamecon.cinecon.retrofit;

import online.gamecon.cinecon.model.ActorData;
import online.gamecon.cinecon.model.AllContent;
import online.gamecon.cinecon.model.AppSetting;
import online.gamecon.cinecon.model.ChannelByCategories;
import online.gamecon.cinecon.model.ContentByGenre;
import online.gamecon.cinecon.model.ContentDetail;
import online.gamecon.cinecon.model.HomePage;
import online.gamecon.cinecon.model.LiveTv;
import online.gamecon.cinecon.model.RestResponse;
import online.gamecon.cinecon.model.SearchChannel;
import online.gamecon.cinecon.model.UserRegistration;
import online.gamecon.cinecon.model.ads.CustomAds;
import online.gamecon.cinecon.utils.Const;

import java.util.HashMap;

import io.reactivex.Single;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.http.Field;
import retrofit2.http.FieldMap;
import retrofit2.http.FormUrlEncoded;
import retrofit2.http.Multipart;
import retrofit2.http.POST;
import retrofit2.http.Part;
import retrofit2.http.PartMap;

public interface RetrofitService {


    @POST("fetchSettings")
    Single<AppSetting> getAppSettings();


    @Multipart
    @POST("userRegistration")
    Single<UserRegistration> registerUser(@PartMap HashMap<String, RequestBody> hashMap);


    @FormUrlEncoded
    @POST("fetchHomePageData")
    Single<HomePage> getHomeData(@Field(Const.ApiKey.user_id) int id
    );


    @Multipart
    @POST("updateProfile")
    Single<UserRegistration> updateProfile(@PartMap HashMap<String, RequestBody> hashMap,
                                           @Part MultipartBody.Part image);



    @FormUrlEncoded
    @POST("searchContent")
    Single<AllContent> searchContent(@FieldMap HashMap<String, Object> hashMap);

    @FormUrlEncoded
    @POST("fetchContentsByGenre")
    Single<ContentByGenre> getContentByGenre(@Field(Const.ApiKey.start) int start,
                                             @Field(Const.ApiKey.limit) int limit,
                                             @Field(Const.ApiKey.genre_id) int id);


    @FormUrlEncoded
    @POST("fetchContentDetails")
    Single<ContentDetail> getContentDetail(@Field(Const.ApiKey.user_id) int userId,
                                           @Field(Const.ApiKey.content_id) int contentId);

    @FormUrlEncoded
    @POST("fetchWatchList")
    Single<AllContent> getWatchList(@Field(Const.ApiKey.type) int type,
                                    @Field(Const.ApiKey.user_id) int userId,
                                   @Field(Const.ApiKey.start) int start,
                                   @Field(Const.ApiKey.limit) int limit);



    @FormUrlEncoded
    @POST("fetchTVChannelByCategory")
    Single<ChannelByCategories> getChannelByCategories(@Field(Const.ApiKey.start) int start,
                                                       @Field(Const.ApiKey.limit) int limit,
                                                       @Field(Const.ApiKey.tv_category_id) int tv_category_id);


    @FormUrlEncoded
    @POST("searchTVChannel")
    Single<SearchChannel> searchTVChannel(@FieldMap HashMap<String, Object> hashMap);

    @POST("fetchLiveTVPageData")
    Single<LiveTv> getLiveTvChannel();

    @FormUrlEncoded
    @POST("logOut")
    Single<UserRegistration> logOutUser(@Field(Const.ApiKey.user_id) int id);

    @FormUrlEncoded
    @POST("deleteMyAccount")
    Single<RestResponse> deleteAccount(@Field(Const.ApiKey.user_id) int user_id);



    @FormUrlEncoded
    @POST("increaseContentDownload")
    Single<RestResponse> increaseContentDownload(@Field(Const.ApiKey.content_id) int id
    );

    @FormUrlEncoded
    @POST("increaseContentView")
    Single<RestResponse> increaseContentView(@Field(Const.ApiKey.content_id) int id
    );

    @FormUrlEncoded
    @POST("increaseContentShare")
    Single<RestResponse> increaseContentShare(@Field(Const.ApiKey.content_id) int id
    );

    @FormUrlEncoded
    @POST("increaseTVChannelView")
    Single<RestResponse> increaseTvChannelView(@Field(Const.ApiKey.channel_id) String id
    );

    @FormUrlEncoded
    @POST("fetchCustomAds")
    Single<CustomAds> fetchCustomAds(@Field(Const.ApiKey.is_android) int deviceType);

    @FormUrlEncoded
    @POST("fetchActorDetails")
    Single<ActorData> fetchActorDetails(@Field(Const.ApiKey.actor_id) int actor_id);

    @FormUrlEncoded
    @POST("increaseAdMetric")
    Single<RestResponse> increaseAdMetric(@Field(Const.ApiKey.custom_ad_id) Long custom_ad_id,
                                          @Field(Const.ApiKey.metric) String metric);

}
