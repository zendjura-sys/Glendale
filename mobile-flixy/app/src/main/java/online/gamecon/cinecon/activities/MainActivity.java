package online.gamecon.cinecon.activities;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.View;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.databinding.DataBindingUtil;
import androidx.databinding.ObservableInt;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;
import androidx.viewpager2.widget.ViewPager2;

import com.google.gson.Gson;
import online.gamecon.cinecon.R;
import online.gamecon.cinecon.adapters.ViewPagerAdapter;
import online.gamecon.cinecon.databinding.ActivityMainBinding;
import online.gamecon.cinecon.model.Downloads;
import online.gamecon.cinecon.utils.BindingAdapters;
import online.gamecon.cinecon.utils.Const;
import online.gamecon.cinecon.utils.SessionManager;
import online.gamecon.cinecon.utils.ViewModelFactory;
import online.gamecon.cinecon.viewmodel.MainViewModel;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

import io.reactivex.disposables.CompositeDisposable;

public class MainActivity extends BaseActivity {
    ActivityMainBinding binding;
    SessionManager sessionManager;

    CompositeDisposable disposable;
    ObservableInt currentPosition = new ObservableInt(0);


    MainViewModel viewModel;

    private ActivityResultLauncher<String> requestPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), result -> {

                Log.i("TAG", ": " + result);
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        binding = DataBindingUtil.setContentView(this, R.layout.activity_main);
        viewModel = new ViewModelProvider(this, new ViewModelFactory(new MainViewModel()).createFor()).get(MainViewModel.class);
        initialization();
        setListeners();
        checkNotificationPermission();
        binding.setCurrentPosition(currentPosition);
        checkDownloads();


    }

    private void checkDownloads() {

        List<Downloads> list = sessionManager.getPendings();
        List<Downloads> listNew = new ArrayList<>();
        Log.i("TAG", " onnnn checkDownloads: ");
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).getDownloadStatus() == Const.DownloadStatus.START
                    || list.get(i).getDownloadStatus() == Const.DownloadStatus.PROGRESSING) {
                listNew.add(list.get(i));
            }
        }
        for (int i = 0; i < listNew.size(); i++) {
            sessionManager.changePendingStatus(listNew.get(i), Const.DownloadStatus.PAUSED, listNew.get(i).getProgress());

        }
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                if (downloadService != null && downloadService.getMyDownloader() != null && !sessionManager.getBooleanValue(Const.DataKey.IS_DOWNLOAD_PAUSED)) {
                    downloadService.getMyDownloader().checkForPending();
                }
            }
        }, 2000);

    }

    private void checkNotificationPermission() {


        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {

            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);


            }
        }

    }


    private void setListeners() {
        binding.progress.setOnClickListener(v -> {

        });

        binding.btnSearch.setOnClickListener(v -> {
            startActivity(new Intent(this, SearchLiveTvActivity.class));
        });
        getOnBackPressedDispatcher().addCallback(new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (currentPosition.get() != 0) {
                    if (viewModel.hideTopBar.getValue() != null && viewModel.hideTopBar.getValue()) {
                        viewModel.hideBottomSheet.setValue(true);
                        return;
                    }
                    binding.viewPager.setCurrentItem(0, false);
                    currentPosition.set(0);

                } else {
                    finish();
                }
            }
        });

        viewModel.blurScreen.observe(this, new Observer<Boolean>() {
            @Override
            public void onChanged(Boolean aBoolean) {
                if (aBoolean) {
                    Log.i("TAG", "onChanged: true ");
//                    setBlur(binding.blurView, binding.rootLout, 20f);
                    binding.topBar.setVisibility(View.VISIBLE);
                } else {
//                    removeBlur(binding.blurView, binding.rootLout);
                    binding.topBar.setVisibility(View.GONE);

                }
            }
        });
        viewModel.hideTopBar.observe(this, new Observer<Boolean>() {
            @Override
            public void onChanged(Boolean aBoolean) {
                if (aBoolean) {
                    Log.i("TAG", "onChanged: true ");
//                    binding.blurView.setVisibility(View.GONE);
                    binding.bottomBar.setVisibility(View.GONE);
                    binding.topBar.setVisibility(View.GONE);
                } else {
//                    binding.blurView.setVisibility(View.VISIBLE);
                    binding.topBar.setVisibility(View.VISIBLE);
                    binding.bottomBar.setVisibility(View.VISIBLE);


                }
            }
        });


        if (sessionManager.getBranchData() != null) {

            String data = sessionManager.getBranchData();
            JSONObject linkProperties = new Gson().fromJson(data, JSONObject.class);
            if (linkProperties != null) {

                furtherProcess(linkProperties);


            }


        }

        binding.viewPager.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback() {
            @Override
            public void onPageScrolled(int position, float positionOffset, int positionOffsetPixels) {
                super.onPageScrolled(position, positionOffset, positionOffsetPixels);
                currentPosition.set(position);
                if (position == 0) {
                    if (viewModel.blurScreen.getValue()) {
                        Log.i("TAG", "onChanged: true ");
//                        setBlur(binding.blurView, binding.rootLout, 20f);
                        binding.topBar.setVisibility(View.VISIBLE);
                    } else {
//                        removeBlur(binding.blurView, binding.rootLout);
                        binding.topBar.setVisibility(View.GONE);

                    }
                } else {
                    binding.topBar.setVisibility(View.VISIBLE);

                }
            }
        });


        binding.imgProfile.setOnClickListener(v -> {
            startActivity(new Intent(this, ProfileActivity.class));
        });


        binding.btnHome.setOnClickListener(v -> binding.viewPager.setCurrentItem(0, false));


        binding.btnDiscover.setOnClickListener(v -> binding.viewPager.setCurrentItem(1, false));

        binding.btnTv.setOnClickListener(v -> binding.viewPager.setCurrentItem(2, false));


        binding.btnWatch.setOnClickListener(v -> binding.viewPager.setCurrentItem(3, false));


    }


    private void furtherProcess(JSONObject linkProperties) {
        try {

            startActivity(new Intent(this, MovieDetailActivity.class)
                    .putExtra(Const.DataKey.CONTENT_ID, Integer.parseInt(linkProperties.getString(Const.DataKey.CONTENT_ID)))
                    .putExtra(Const.DataKey.IS_BRANCH_LINK, true));


            sessionManager.removeBranchData();
            finish();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    public void openWatchList() {
        binding.viewPager.setCurrentItem(3);
    }


    private void initialization() {

        sessionManager = new SessionManager(this);

        disposable = new CompositeDisposable();

        if (sessionManager.getAppSettings().getSettings().getLiveTvEnable() == 0) {
            binding.btnTv.setVisibility(View.GONE);


        } else {
            binding.btnTv.setVisibility(View.VISIBLE);

        }

        binding.viewPager.setAdapter(new ViewPagerAdapter(getSupportFragmentManager(), getLifecycle(), this));
        binding.viewPager.setUserInputEnabled(false);

        if (sessionManager.getUser() != null && !sessionManager.getUser().getProfileImage().isEmpty()) {
            binding.imgPic.setVisibility(View.VISIBLE);
            binding.imgUser.setVisibility(View.GONE);
            BindingAdapters.loadImage(binding.imgPic, sessionManager.getUser().getProfileImage());

        } else {
            binding.imgPic.setVisibility(View.GONE);
            binding.imgUser.setVisibility(View.VISIBLE);
        }

    }


    @Override
    protected void onDestroy() {
        Log.i("TAG", "onDestroy: mainActivity ");

        super.onDestroy();
    }
}