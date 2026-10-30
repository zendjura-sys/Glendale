import 'package:flutter/material.dart';

import 'core/theme/arctic_glass_theme.dart';
import 'theme.dart';

/// Скелетони «Arctic Glass», як на сайті: заглушки форми справжнього вмісту з крижаним відблиском,
/// що повільно пробігає зліва направо. Без анімації, якщо в системі вимкнено рух.

/// Спільний відблиск для всіх заглушок усередині — один контролер на екран.
class SkeletonShimmer extends StatefulWidget {
  const SkeletonShimmer({required this.child, super.key});
  final Widget child;

  @override
  State<SkeletonShimmer> createState() => _SkeletonShimmerState();
}

class _SkeletonShimmerState extends State<SkeletonShimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Мерехтіння «Spatial Glass»: скло .03 → крижаний ціан .10 → скло .03.
    final base = palette.isLight ? const Color(0x140A2A55) : AppColors.shimmer[0];
    final shine = palette.isLight ? const Color(0x33FFFFFF) : AppColors.shimmer[1];
    return Semantics(
      label: 'Завантаження',
      child: AnimatedBuilder(
        animation: _c,
        child: widget.child,
        builder: (context, child) => ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (rect) {
            final t = _c.value * 2 - 0.5;
            return LinearGradient(
              begin: Alignment(-1 + t * 2, -0.3),
              end: Alignment(t * 2, 0.3),
              colors: [base, shine, base],
              stops: const [0.2, 0.5, 0.8],
            ).createShader(rect);
          },
          child: child,
        ),
      ),
    );
  }
}

/// Одна заглушка: прямокутник чи коло тієї ж форми, що й вміст.
class Sk extends StatelessWidget {
  const Sk({
    this.width,
    this.height = 12,
    this.radius = 8,
    this.circle = false,
    super.key,
  });
  final double? width;
  final double height;
  final double radius;
  final bool circle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: circle ? height : width,
      height: height,
      decoration: BoxDecoration(
        color: palette.isLight
            ? const Color(0x1A0A2A55)
            : const Color(0x17FFFFFF),
        borderRadius: circle ? null : BorderRadius.circular(radius),
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
      ),
    );
  }
}

/// Скляна картка-заглушка без тіні (як порожнє скло).
class _SkCard extends StatelessWidget {
  const _SkCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: glassGradient,
        borderRadius: BorderRadius.circular(22),
      ),
      child: child,
    );
  }
}

/// Запис стрічки: автор, кілька рядків тексту, медіа й дії.
class PostSkeleton extends StatelessWidget {
  const PostSkeleton({this.media = true, super.key});
  final bool media;

  @override
  Widget build(BuildContext context) {
    return _SkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Sk(height: 42, circle: true),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Sk(width: 140, height: 12),
                    SizedBox(height: 8),
                    Sk(width: 80, height: 10),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Sk(height: 11),
          const SizedBox(height: 8),
          const Sk(height: 11),
          const SizedBox(height: 8),
          const FractionallySizedBox(widthFactor: 0.6, child: Sk(height: 11)),
          if (media) ...[
            const SizedBox(height: 14),
            const AspectRatio(
              aspectRatio: 16 / 10,
              child: Sk(height: double.infinity, radius: 16),
            ),
          ],
          const SizedBox(height: 14),
          const Row(
            children: [
              Sk(width: 64, height: 30, radius: 12),
              SizedBox(width: 8),
              Sk(width: 64, height: 30, radius: 12),
              SizedBox(width: 8),
              Sk(width: 40, height: 30, radius: 12),
            ],
          ),
        ],
      ),
    );
  }
}

/// Стрічка: кілька записів підряд.
class FeedSkeleton extends StatelessWidget {
  const FeedSkeleton({this.count = 3, super.key});
  final int count;

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: Column(
        children: [
          for (var i = 0; i < count; i++) PostSkeleton(media: i.isEven),
        ],
      ),
    );
  }
}

/// Список рядків: аватар/обкладинка й два рядки тексту (люди, чати, треки, сервери).
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({this.rows = 6, this.square = false, super.key});
  final int rows;
  final bool square;

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: _SkCard(
        child: Column(
          children: [
            for (var i = 0; i < rows; i++)
              Padding(
                padding: EdgeInsets.only(bottom: i == rows - 1 ? 0 : 14),
                child: Row(
                  children: [
                    square
                        ? const Sk(width: 48, height: 48, radius: 12)
                        : const Sk(height: 44, circle: true),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          FractionallySizedBox(
                            widthFactor: i.isEven ? 0.7 : 0.5,
                            child: const Sk(height: 12),
                          ),
                          const SizedBox(height: 8),
                          FractionallySizedBox(
                            widthFactor: i.isEven ? 0.4 : 0.6,
                            child: const Sk(height: 10),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Сітка обкладинок (кіно, ігри, альбоми).
class GridSkeleton extends StatelessWidget {
  const GridSkeleton({this.count = 6, this.aspect = 2 / 3, super.key});
  final int count;
  final double aspect;

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: aspect * 0.82,
        children: [
          for (var i = 0; i < count; i++)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Sk(
                    width: double.infinity,
                    height: double.infinity,
                    radius: 14,
                  ),
                ),
                const SizedBox(height: 8),
                const Sk(width: 70, height: 10),
              ],
            ),
        ],
      ),
    );
  }
}

/// Загальний екран, поки вантажаться дані: заголовок-картка й список.
class ScreenSkeleton extends StatelessWidget {
  const ScreenSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    // У списку чи колонці без обмеження висоти — без прокрутки (інакше Flutter не знає висоти).
    return LayoutBuilder(
      builder: (context, constraints) => constraints.hasBoundedHeight
          ? SingleChildScrollView(
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _body(),
            )
          : Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _body(),
            ),
    );
  }

  Widget _body() {
    return SkeletonShimmer(
      child: Column(
        children: [
          _SkCard(
            child: Row(
              children: const [
                Sk(width: 56, height: 56, radius: 16),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Sk(width: 160, height: 14),
                      SizedBox(height: 10),
                      Sk(width: 220, height: 10),
                    ],
                  ),
                ),
              ],
            ),
          ),
          for (var i = 0; i < 4; i++)
            _SkCard(
              child: Row(
                children: [
                  const Sk(height: 40, circle: true),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        FractionallySizedBox(
                          widthFactor: i.isEven ? 0.7 : 0.5,
                          child: const Sk(height: 12),
                        ),
                        const SizedBox(height: 8),
                        const FractionallySizedBox(
                          widthFactor: 0.4,
                          child: Sk(height: 10),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
