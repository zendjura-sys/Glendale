package online.gamecon.cinecon.utils;

import online.gamecon.cinecon.model.HomePage;
import online.gamecon.cinecon.model.UserRegistration;

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
