package online.gamecon.cinecon.activities;

import static online.gamecon.cinecon.utils.GoogleLoginManager.RC_SIGN_IN;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;

import androidx.annotation.Nullable;
import androidx.databinding.DataBindingUtil;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import online.gamecon.cinecon.R;
import online.gamecon.cinecon.databinding.ActivitySignInBinding;
import online.gamecon.cinecon.model.UserRegistration;
import online.gamecon.cinecon.utils.CallBacks;
import online.gamecon.cinecon.utils.Const;
import online.gamecon.cinecon.utils.Global;
import online.gamecon.cinecon.utils.GoogleLoginManager;
import online.gamecon.cinecon.utils.SessionManager;
import online.gamecon.cinecon.utils.ViewModelFactory;
import online.gamecon.cinecon.viewmodel.BaseViewModel;

import java.util.HashMap;
import java.util.Objects;

import okhttp3.MediaType;
import okhttp3.RequestBody;

public class SignInActivity extends BaseActivity {
    ActivitySignInBinding binding;
    SessionManager sessionManager;
    BaseViewModel viewModel;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = DataBindingUtil.setContentView(this, R.layout.activity_sign_in);
        viewModel = new ViewModelProvider(this, new ViewModelFactory(new BaseViewModel()).createFor()).get(BaseViewModel.class);
        initialization();
        Global.createNotificationChannels(this);
        binding.progress.setOnClickListener(v -> {

        });
        binding.btnGoogle.setOnClickListener(v -> {
            GoogleLoginManager googleLoginManager = new GoogleLoginManager(this);
            googleLoginManager.onLogin();

        });


        binding.btnEmail.setOnClickListener(v -> {

            Intent intent = new Intent(this, EmailLoginActivity.class);
            startActivity(intent);

        });

    }

    private void initialization() {

        sessionManager = new SessionManager(this);


    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable @org.jetbrains.annotations.Nullable Intent data) {
//        faceBookLoginManager.callbackManager.onActivityResult(requestCode, resultCode, data);
        super.onActivityResult(requestCode, resultCode, data);


        if (resultCode == RESULT_OK && requestCode == RC_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            handleSignInResult(task);
        }
    }


    private void handleSignInResult(Task<GoogleSignInAccount> task) {

        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);

            if (account != null) {

                HashMap<String, RequestBody> hashMap = new HashMap<>();

                hashMap.put(Const.ApiKey.fullname, RequestBody.create(Objects.requireNonNull(account.getDisplayName()), MediaType.parse("text/plain")));
                hashMap.put(Const.ApiKey.email, RequestBody.create(Objects.requireNonNull(account.getEmail()), MediaType.parse("text/plain")));
                hashMap.put(Const.ApiKey.login_type, RequestBody.create(String.valueOf(1), MediaType.parse("text/plain")));
                hashMap.put(Const.ApiKey.identity, RequestBody.create(Objects.requireNonNull(account.getEmail()), MediaType.parse("text/plain")));
                hashMap.put(Const.ApiKey.device_token, RequestBody.create(sessionManager.getFireBaseToken() == null ? "123" : sessionManager.getFireBaseToken(), MediaType.parse("text/plain")));
                hashMap.put(Const.ApiKey.device_type, RequestBody.create(String.valueOf(1), MediaType.parse("text/plain")));

                callRegistrationApi(hashMap);
            }
        } catch (ApiException ignored) {
            Log.d("TAG", "");
        }
    }

    private void callRegistrationApi(HashMap<String, RequestBody> hashMap) {

        viewModel.registerUser(hashMap, new CallBacks.OnRegisterApi() {
            @Override
            public void onSubscribe() {
                binding.progress.setVisibility(View.VISIBLE);

            }

            @Override
            public void onTerminate() {
                binding.progress.setVisibility(View.GONE);

            }

            @Override
            public void onError(Throwable throwable) {
                if (throwable.getMessage() != null) {
                    Log.i("TAG", "callRegistrationApi: " + throwable.getMessage());
                }

            }

            @Override
            public void onSuccess(UserRegistration.Data data) {

                sessionManager.saveUser(data);
                loginRevenueCat();



                startActivity(new Intent(SignInActivity.this, MainActivity.class));
                        finish();

            }
        });


    }


}