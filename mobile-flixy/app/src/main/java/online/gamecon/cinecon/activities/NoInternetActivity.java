package online.gamecon.cinecon.activities;

import android.content.Intent;
import android.os.Bundle;

import androidx.databinding.DataBindingUtil;

import online.gamecon.cinecon.R;
import online.gamecon.cinecon.databinding.ActivityNoInternetBinding;

public class NoInternetActivity extends BaseActivity {
    ActivityNoInternetBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = DataBindingUtil.setContentView(this, R.layout.activity_no_internet);


        binding.btnGoToDownloads.setOnClickListener(v -> {
            startActivity(new Intent(this, DownloadsActivity.class));

        });
    }
}