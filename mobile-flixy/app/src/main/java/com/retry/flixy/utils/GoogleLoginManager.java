package com.retry.flixy.utils;

import android.app.Activity;
import android.content.Intent;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;


public class GoogleLoginManager {

    public static final int RC_SIGN_IN = 100;
    private final GoogleSignInClient mGoogleSignInClient;
    private final Activity context;
    public OnSignOut onSignOut;

    public GoogleLoginManager(Activity context) {
        this.context = context;
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .build();
        mGoogleSignInClient = GoogleSignIn.getClient(context, gso);
    }

    public void onLogin() {
        Intent signInIntent = mGoogleSignInClient.getSignInIntent();
        context.startActivityForResult(signInIntent, RC_SIGN_IN);

    }

    public void onClickLogOut() {

        mGoogleSignInClient.signOut().addOnCompleteListener(context, task -> {
            onSignOut.onSignOutSuccess();
        });

    }

    public interface OnSignOut {
        void onSignOutSuccess();
    }
}
