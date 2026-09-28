package com.retry.flixy.utils;

import com.retry.flixy.model.HomePage;
import com.retry.flixy.model.UserRegistration;

public interface CallBacks {

    public interface OnRegisterApi {

        void onSubscribe();

        void onTerminate();

        void onError(Throwable throwable);

        void onSuccess(UserRegistration.Data data);
    }

    public interface GetHomePageData {

        void onSubscribe();

        void onTerminate();

        void onError(Throwable throwable);

        void onSuccess(HomePage homePage);
    }
}
