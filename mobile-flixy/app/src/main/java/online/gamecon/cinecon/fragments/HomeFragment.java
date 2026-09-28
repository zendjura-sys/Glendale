package online.gamecon.cinecon.fragments;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.databinding.DataBindingUtil;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.PagerSnapHelper;
import androidx.recyclerview.widget.RecyclerView;
import androidx.recyclerview.widget.SnapHelper;

import com.bumptech.glide.Glide;
import com.bumptech.glide.Priority;
import com.bumptech.glide.request.RequestOptions;
import com.google.android.flexbox.AlignItems;
import com.google.android.flexbox.FlexDirection;
import com.google.android.flexbox.FlexboxLayoutManager;
import com.google.android.flexbox.JustifyContent;
import online.gamecon.cinecon.R;
import online.gamecon.cinecon.activities.BaseActivity;
import online.gamecon.cinecon.activities.MainActivity;
import online.gamecon.cinecon.adapters.ContentDetailGenreAdapter;
import online.gamecon.cinecon.adapters.HomeCatNameAdapter;
import online.gamecon.cinecon.adapters.HomeFeaturedAdapter;
import online.gamecon.cinecon.adapters.HomeTopItemsAdapter;
import online.gamecon.cinecon.adapters.HomeWatchlistAdapter;
import online.gamecon.cinecon.adapters.MovieHistoryAdapter;
import online.gamecon.cinecon.databinding.FragmentHomeBinding;
import online.gamecon.cinecon.model.ContentDetail;
import online.gamecon.cinecon.model.HomePage;
import online.gamecon.cinecon.retrofit.RetrofitClient;
import online.gamecon.cinecon.utils.Const;
import online.gamecon.cinecon.utils.Global;
import online.gamecon.cinecon.utils.ViewModelFactory;
import online.gamecon.cinecon.viewmodel.HomeViewModel;
import online.gamecon.cinecon.viewmodel.MainViewModel;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import io.reactivex.android.schedulers.AndroidSchedulers;
import io.reactivex.disposables.CompositeDisposable;
import io.reactivex.schedulers.Schedulers;


public class HomeFragment extends BaseFragment {
    FragmentHomeBinding binding;

    HomeFeaturedAdapter homeFeaturedAdapter;
    HomeWatchlistAdapter homeWatchlistAdapter;
    HomeTopItemsAdapter homeTopItemsAdapter;
    HomeCatNameAdapter homeCatNameAdapter;

    CompositeDisposable disposable;

    List<ContentDetail.DataItem> featuredList = new ArrayList<>();
    List<ContentDetail.DataItem> watchList = new ArrayList<>();
    List<HomePage.TopContentItem> topList = new ArrayList<>();
    List<HomePage.GenreContents> catList = new ArrayList<>();

    MainViewModel mainViewModel;
    HomeViewModel viewModel;
    ContentDetailGenreAdapter genreAdapter;


    private boolean scrolledByUser = false;
    private Handler handler;
    private boolean reversed = false;
    private int scrollingPos = 0;

    public HomeFragment() {
        // Required empty public constructor
    }

    @Override

    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        binding = DataBindingUtil.inflate(inflater, R.layout.fragment_home, container, false);
        mainViewModel = new ViewModelProvider(requireActivity(), new ViewModelFactory(new MainViewModel()).createFor()).get(MainViewModel.class);
        viewModel = new ViewModelProvider(this, new ViewModelFactory(new HomeViewModel()).createFor()).get(HomeViewModel.class);


        initialization();
        initListeners();
        getHomePageData();


        return binding.getRoot();
    }


    ContentDetail.DataItem scrollingItem = null;

    MovieHistoryAdapter movieHistoryAdapter = new MovieHistoryAdapter();
    boolean isFirstTime = true;


    @Override
    public void onPause() {
        super.onPause();
        handler.removeCallbacks(runnable);
    }

    private void initListeners() {

        binding.btnWatchlistMore.setOnClickListener(v -> {

            if (getActivity() instanceof MainActivity) {
                ((MainActivity) getActivity()).openWatchList();
            }
        });

        binding.centerLoader.setOnClickListener(v -> {

        });


        binding.rvFeatured.addOnScrollListener(new RecyclerView.OnScrollListener() {
            @Override
            public void onScrolled(@NonNull RecyclerView recyclerView, int dx, int dy) {
                super.onScrolled(recyclerView, dx, dy);
            }

            @Override
            public void onScrollStateChanged(@NonNull RecyclerView recyclerView, int newState) {
                super.onScrollStateChanged(recyclerView, newState);

                if (newState == RecyclerView.SCROLL_STATE_DRAGGING) {
                    scrolledByUser = true;
                }

                if (newState == RecyclerView.SCROLL_STATE_IDLE) {
                    if (scrolledByUser) {
                        handler.removeCallbacks(runnable);

                        scrollingPos = ((LinearLayoutManager) binding.rvFeatured.getLayoutManager()).findFirstCompletelyVisibleItemPosition();
                        reversed = scrollingPos + 1 > homeFeaturedAdapter.getItemCount() - 1;

                        scrollToPos(true);
                    }
                    scrolledByUser = false;
                }
            }
        });
        binding.swipeRefresh.setOnRefreshListener(() -> {
            getHomePageData();
        });

//        binding.appBar.addOnOffsetChangedListener(new AppBarLayout.BaseOnOffsetChangedListener() {
//            @Override
//            public void onOffsetChanged(AppBarLayout appBarLayout, int verticalOffset) {
//
//
//                boolean collapsed = Math.abs(verticalOffset) - appBarLayout.getTotalScrollRange() > -5;
//                boolean currentValue = mainViewModel.blurScreen.getValue();
//                if (collapsed && !currentValue) {
//                    mainViewModel.blurScreen.setValue(collapsed);
//
//                } else if (!collapsed && currentValue) {
//                    mainViewModel.blurScreen.setValue(collapsed);
//
//                }
//            }
//        });
    }

    private void scrollToPos(boolean fromUser) {
        if (!fromUser && scrollingPos < featuredList.size() && scrollingPos >= 0) {
            binding.rvFeatured.smoothScrollToPosition(scrollingPos);
        }
        setContentData();
        handler.postDelayed(runnable, Const.FEATURED_SCROLL);
    }

    @Override
    public void onResume() {
        super.onResume();
        initHistory();
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
//                refreshFavList();
            }
        }, 1000);

        if (homeFeaturedAdapter.getItemCount() != 0) {

            handler.postDelayed(runnable, Const.FEATURED_SCROLL);
        }
    }

    private void initHistory() {
        movieHistoryAdapter.updateData(sessionManager.getMovieHistories());
        binding.rvHistory.setAdapter(movieHistoryAdapter);
        movieHistoryAdapter.setOnUpdateList(isEmpty -> {
            binding.tvHistory.setVisibility(movieHistoryAdapter.getItemCount() == 0 ? View.GONE : View.VISIBLE);
            binding.rvHistory.setVisibility(movieHistoryAdapter.getItemCount() == 0 ? View.GONE : View.VISIBLE);
        });
        binding.tvHistory.setVisibility(movieHistoryAdapter.getItemCount() == 0 ? View.GONE : View.VISIBLE);
        binding.rvHistory.setVisibility(movieHistoryAdapter.getItemCount() == 0 ? View.GONE : View.VISIBLE);
    }

    private void getHomePageData() {


        disposable.add(RetrofitClient.getService().getHomeData(sessionManager.getUser().getId()).subscribeOn(Schedulers.io())
                .observeOn(AndroidSchedulers.mainThread())
                .unsubscribeOn(Schedulers.io())
                .doOnSubscribe(disposable1 -> {
                    if (isFirstTime) {
                        isFirstTime = false;
                        binding.centerLoader.setVisibility(View.VISIBLE);
                    }
                    binding.loutMain.setVisibility(View.GONE);
                })
                .doOnTerminate(() -> {
                    binding.swipeRefresh.setRefreshing(false);
                    binding.loutMain.setVisibility(View.VISIBLE);
                    binding.centerLoader.setVisibility(View.GONE);

                }).doOnError(throwable -> {
                    binding.swipeRefresh.setRefreshing(false);

//                    binding.centerLoader.setVisibility(View.VISIBLE);
                    binding.loutMain.setVisibility(View.GONE);
                    Log.i("TAG", "getHomePageData: " + throwable.getMessage());
                })
                .subscribe((homePage, throwable) -> {


                    if (homePage != null && !requireActivity().isDestroyed()) {

                        if (homePage.getFeatured() != null && !homePage.getFeatured().isEmpty()) {
                            featuredList = new ArrayList<>();
                            featuredList.addAll(homePage.getFeatured());
                            homeFeaturedAdapter.updateItems(featuredList);
                            setContentData();
                            List<String> dotlist = new ArrayList<>();
                            for (int i = 0; i < homeFeaturedAdapter.getList().size(); i++) {
                                dotlist.add(" ");
                            }
                            handler.removeCallbacks(runnable);
                            handler.postDelayed(runnable, Const.FEATURED_SCROLL);

                        }
                        if (homePage.getWatchlist() != null) {

                            if (!homePage.getWatchlist().isEmpty()) {
                                watchList = new ArrayList<>();
                                watchList.addAll(homePage.getWatchlist());
                                homeWatchlistAdapter.updateItems(watchList);
                            } else {
                                binding.loutWathlist.setVisibility(View.GONE);
                            }
                        }

                        if (homePage.getTopContents() != null) {

                            if (!homePage.getTopContents().isEmpty()) {
                                topList = new ArrayList<>();
                                topList.addAll(homePage.getTopContents());
                                homeTopItemsAdapter.updateItems(topList);
                            } else {
                                binding.loutTop.setVisibility(View.GONE);
                            }
                        }


                        if (homePage.getGenreContents() != null && !homePage.getGenreContents().isEmpty()) {
                            catList = new ArrayList<>();
                            catList.addAll(homePage.getGenreContents().stream().filter(genreContents -> !genreContents.getContent().isEmpty()).collect(Collectors.toList()));
                            homeCatNameAdapter.updateItems(catList);
                        }

                    }
                    binding.swipeRefresh.setRefreshing(false);

                }));
        binding.swipeRefresh.dispatchNestedFling(100, 100, true);

    }

    private void initialization() {

        SnapHelper snapHelper = new PagerSnapHelper();
        snapHelper.attachToRecyclerView(binding.rvFeatured);
        handler = new Handler(Looper.getMainLooper());

        disposable = new CompositeDisposable();

        homeCatNameAdapter = new HomeCatNameAdapter();
        homeWatchlistAdapter = new HomeWatchlistAdapter();
        homeTopItemsAdapter = new HomeTopItemsAdapter();
        homeFeaturedAdapter = new HomeFeaturedAdapter();
        genreAdapter = new ContentDetailGenreAdapter();
        binding.swipeRefresh.setProgressViewOffset(true, 150, 350);

        binding.rvFeatured.setAdapter(homeFeaturedAdapter);
        binding.rvWatchlist.setAdapter(homeWatchlistAdapter);
        binding.rvCat.setAdapter(homeCatNameAdapter);
        binding.rvTop10.setAdapter(homeTopItemsAdapter);


        FlexboxLayoutManager layoutManager = new FlexboxLayoutManager(requireActivity());
        layoutManager.setFlexDirection(FlexDirection.ROW);
        layoutManager.setJustifyContent(JustifyContent.CENTER);
        layoutManager.setAlignItems(AlignItems.CENTER);

        binding.rvGenere.setLayoutManager(layoutManager);

        binding.rvGenere.setAdapter(genreAdapter);

        if (requireActivity() instanceof BaseActivity) {
            ((BaseActivity) requireActivity()).setBlur(binding.blurLout, binding.rootLout, 15f);
        }


    }

    Runnable runnable = new Runnable() {
        @Override
        public void run() {
            if (reversed) {
                if (scrollingPos - 1 < 0) {
                    scrollingPos += 1;
                    reversed = false;
                } else {
                    scrollingPos -= 1;
                }
            } else {
                if (scrollingPos + 1 > homeFeaturedAdapter.getItemCount() - 1) {
                    scrollingPos -= 1;
                    reversed = true;
                } else {
                    scrollingPos += 1;
                    reversed = false;
                }
            }

            scrollToPos(false);
        }
    };

    private void setContentData() {


        if (-1 < scrollingPos && scrollingPos < homeFeaturedAdapter.getList().size()) {

            scrollingItem = homeFeaturedAdapter.getList().get(scrollingPos);
            if (scrollingItem != null && getActivity() != null && !requireActivity().isDestroyed()) {
                binding.setContent(scrollingItem);
                Glide.with(binding.img).load(Const.IMAGE_URL + scrollingItem.getVerticalPoster())
                        .placeholder(binding.img.getDrawable()).apply(
                                new RequestOptions().error(
                                        R.color.transparent
                                ).priority(Priority.HIGH)
                        ).into(binding.img);


                if (scrollingItem.getGenreString().isEmpty()) {
                    List<String> list = Global.getGenreListFromIds(scrollingItem.getGenreIds(), requireActivity());
                    scrollingItem.setGenreList(list);
                    setGenreAdapter(list);

                } else {
                    setGenreAdapter(scrollingItem.getGenreList());

                }
            }
        }

    }


    private void setGenreAdapter(List<String> list) {
        if (list.size() > 8) {
            List<String> newList = list.subList(0, 8);
            Log.i("TAG", "setGenreAdapter: " + newList.size());
            genreAdapter.updateItems(newList);

        } else {
            genreAdapter.updateItems(list);

        }
    }


}