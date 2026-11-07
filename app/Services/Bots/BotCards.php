<?php

namespace App\Services\Bots;

use App\Models\Clan;
use App\Models\ClanEvent;
use App\Models\ClanMember;
use App\Models\Community;
use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Models\FamilyMember;
use App\Models\ListenParty;
use App\Models\MusicStatus;
use App\Models\Post;
use App\Models\User;
use App\Services\Music\ListenRooms;
use App\Services\MusicService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * Картки бота — одна розмітка для Telegram і Discord: заголовок, рядки, поля, кнопки.
 * Кнопка — або дія (action, ≤ 64 байт для Telegram), або посилання (url).
 *
 * Дії: home | ev (події) | e (подія) | r (піду/не піду) | mb (склад) | ps (пости) | me (я) | mu (музика).
 * Формат: «дія:тип:id[:аргумент[:аргумент]]», тип — f (сім’я), c (клан), m (спільнота).
 */
class BotCards
{
    public const COLOR = 0x6D5DFC;

    private const TZ = 'Europe/Kyiv';

    /**
     * @return array{0: string, 1: int}
     */
    public static function key(Family|Clan|Community $owner): array
    {
        return [match (true) {
            $owner instanceof Family => 'f',
            $owner instanceof Clan => 'c',
            default => 'm',
        }, $owner->id];
    }

    public static function name(Family|Clan|Community $owner): string
    {
        return match (true) {
            $owner instanceof Family => "🏠 [{$owner->tag}] {$owner->name}",
            $owner instanceof Clan => "⚔️ {$owner->display_name}",
            default => "🛡️ {$owner->name}",
        };
    }

    public static function url(Family|Clan|Community $owner, string $suffix = ''): string
    {
        return URL::to(match (true) {
            $owner instanceof Family => '/f/'.$owner->slug,
            $owner instanceof Clan => '/clans/'.$owner->slug,
            default => '/c/'.$owner->slug,
        }.$suffix);
    }

    private static function act(Family|Clan|Community $owner, string $action, string ...$args): string
    {
        [$type, $id] = self::key($owner);

        return implode(':', [$action, $type, $id, ...$args]);
    }

    /**
     * @return array{label: string, action: string, style: string}
     */
    private static function back(Family|Clan|Community $owner): array
    {
        return ['label' => '⬅️ Меню', 'action' => self::act($owner, 'home'), 'style' => 'secondary'];
    }

    private static function when(\DateTimeInterface $at): string
    {
        $local = Carbon::createFromTimestamp($at->getTimestamp(), self::TZ);
        $local->locale('uk');

        return $local->translatedFormat('j F, D · H:i');
    }

    /**
     * Головна панель групи: коротко про групу й кнопки розділів.
     *
     * @return array<string, mixed>
     */
    public function panel(Family|Clan|Community $owner): array
    {
        $members = $owner->activeMembers()->count();
        $events = $this->upcoming($owner)->count();
        $lines = [];
        $description = trim((string) ($owner->description ?? ''));
        if ($description !== '') {
            $lines[] = Str::limit($description, 220);
        }
        $fields = [['👥 Учасники', (string) $members]];
        if (! $owner instanceof Community) {
            $fields[] = ['📅 Найближчі події', (string) $events];
        }

        $row = $owner instanceof Community
            ? [['label' => '📰 Пости', 'action' => self::act($owner, 'ps'), 'style' => 'primary']]
            : [['label' => '📅 Події', 'action' => self::act($owner, 'ev'), 'style' => 'primary']];
        $row[] = ['label' => '👥 Склад', 'action' => self::act($owner, 'mb'), 'style' => 'secondary'];
        $row[] = ['label' => '🙋 Я', 'action' => self::act($owner, 'me'), 'style' => 'secondary'];
        $row[] = ['label' => '🎧 Музика', 'action' => self::act($owner, 'mu'), 'style' => 'secondary'];

        return [
            'title' => self::name($owner),
            'lines' => $lines,
            'fields' => $fields,
            'thumb' => $this->logo($owner),
            'footer' => 'GameCon · натисніть кнопку нижче',
            'buttons' => [$row, [['label' => '🌐 Відкрити на GameCon', 'url' => self::url($owner)]]],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function events(Family|Clan|Community $owner): array
    {
        $events = $this->upcoming($owner)->limit(5)->get();
        $lines = [];
        $buttons = [];
        foreach ($events as $event) {
            $lines[] = '📅 **'.$event->title.'** — '.self::when($event->starts_at).' · ✅ '.$this->goingCount($event);
            $buttons[] = [['label' => Str::limit($event->title, 60), 'action' => self::act($owner, 'e', (string) $event->id), 'style' => 'secondary']];
        }
        if ($lines === []) {
            $lines[] = 'Найближчим часом подій немає. Створіть подію на GameCon — вона з’явиться тут.';
        }
        $buttons[] = [self::back($owner), ['label' => '➕ Нова подія', 'url' => self::url($owner, $owner instanceof Family ? '/events' : '')]];

        return ['title' => '📅 Події · '.self::name($owner), 'lines' => $lines, 'buttons' => $buttons];
    }

    /**
     * Картка події з кнопками «Піду» / «Не піду».
     *
     * @return array<string, mixed>
     */
    public function event(Family|Clan $owner, FamilyEvent|ClanEvent $event, bool $withBack = true): array
    {
        $lines = [];
        if (trim((string) $event->description) !== '') {
            $lines[] = Str::limit((string) $event->description, 600);
        }
        $going = $this->goingCount($event);
        $seats = $event instanceof FamilyEvent && $event->capacity ? "{$going} / {$event->capacity}" : (string) $going;
        $buttons = [[
            ['label' => '✅ Піду', 'action' => self::act($owner, 'r', (string) $event->id, '1'), 'style' => 'success'],
            ['label' => '❌ Не піду', 'action' => self::act($owner, 'r', (string) $event->id, '0'), 'style' => 'danger'],
        ], [['label' => '🔗 Відкрити', 'url' => self::url($owner, $owner instanceof Family ? '/events' : '')]]];
        if ($withBack) {
            array_unshift($buttons[1], ['label' => '⬅️ Події', 'action' => self::act($owner, 'ev'), 'style' => 'secondary']);
        }

        return [
            'title' => '📅 '.$event->title,
            'lines' => $lines,
            'fields' => [['🕒 Коли', self::when($event->starts_at)], ['✅ Йдуть', $seats], ['🏷️ Хто', self::name($owner)]],
            'timestamp' => $event->starts_at,
            'buttons' => $buttons,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function reminder(Family|Clan $owner, FamilyEvent|ClanEvent $event): array
    {
        $card = $this->event($owner, $event, withBack: false);
        $card['title'] = '⏰ Скоро: '.$event->title;
        array_unshift($card['lines'], 'Починається за ~'.max(1, (int) now()->diffInMinutes($event->starts_at)).' хв.');

        return $card;
    }

    /**
     * @return array<string, mixed>
     */
    public function members(Family|Clan|Community $owner): array
    {
        $lines = [];
        if ($owner instanceof Family) {
            foreach ($owner->activeMembers()->orderByDesc('rank')->limit(15)->get() as $m) {
                /** @var FamilyMember $m */
                $lines[] = ($m->rank >= Family::LEADER_RANK ? '👑 ' : '• ').$m->rp_nickname.' — '.$owner->rankTitle($m->rank);
            }
        } elseif ($owner instanceof Clan) {
            foreach ($owner->activeMembers()->with('user')->orderByDesc('rank')->limit(15)->get() as $m) {
                /** @var ClanMember $m */
                $lines[] = ($m->rank >= Clan::LEADER_RANK ? '👑 ' : '• ').($m->nickname ?: $m->user?->name).' — '.$owner->rankTitle($m->rank);
            }
        } else {
            foreach ($owner->activeMembers()->with('user')->latest('id')->limit(15)->get() as $m) {
                $lines[] = ($m->isManager() ? '⭐ ' : '• ').$m->user?->name;
            }
        }
        $total = $owner->activeMembers()->count();
        if ($total > 15) {
            $lines[] = '…і ще '.($total - 15);
        }

        return [
            'title' => '👥 Склад · '.self::name($owner),
            'lines' => $lines === [] ? ['Поки нікого.'] : $lines,
            'buttons' => [[self::back($owner), ['label' => '🌐 Увесь склад', 'url' => self::url($owner, $owner instanceof Family ? '/members' : '')]]],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function posts(Community $community): array
    {
        $posts = Post::query()->with('author')->where('wall_type', 'community')->where('wall_id', $community->id)
            ->where('is_draft', false)->where('is_pending', false)
            ->where(fn ($q) => $q->whereNull('publish_at')->orWhere('publish_at', '<=', now()))
            ->latest('id')->limit(5)->get();
        $lines = [];
        $buttons = [];
        foreach ($posts as $post) {
            $lines[] = '📰 **'.($post->as_community ? $community->name : $post->author?->name).'**: '.Str::limit(trim((string) $post->body) ?: '(медіа)', 140);
        }
        foreach ($posts->take(3) as $i => $post) {
            $buttons[] = ['label' => '🔗 '.($i + 1), 'url' => URL::to('/posts/'.$post->id)];
        }

        return [
            'title' => '📰 Пости · '.self::name($community),
            'lines' => $lines === [] ? ['Записів поки немає.'] : $lines,
            'buttons' => array_values(array_filter([$buttons, [self::back($community)]])),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function post(Community $community, Post $post): array
    {
        $post->loadMissing('author');

        return [
            'title' => '📰 '.($post->as_community ? $community->name : (string) $post->author?->name),
            'lines' => [$post->spoiler ? '🙈 Спойлер — відкрийте на GameCon.' : Str::limit((string) $post->body, 1500)],
            'thumb' => $this->logo($community),
            'footer' => self::name($community),
            'buttons' => [[['label' => '💬 Коментувати', 'url' => URL::to('/posts/'.$post->id)]]],
        ];
    }

    /**
     * «Що слухає група»: учасники, які зараз слухають музику (крім тих, хто це приховав), і кімната «Слухати разом».
     *
     * @return array<string, mixed>
     */
    public function music(Family|Clan|Community $owner): array
    {
        $ids = $owner->activeMembers()->pluck('user_id')->all();
        $listening = MusicStatus::query()->with('user')->whereIn('user_id', $ids)->where('expires_at', '>', now())->latest('updated_at')->limit(30)->get();
        $music = app(MusicService::class);
        $lines = [];
        foreach ($listening as $status) {
            $now = $status->user ? $music->currentFor($status->user) : null;
            if ($now === null) {
                continue;
            }
            $lines[] = '🎧 **'.$status->user->name.'** — '.Str::limit(trim(($now['title'] ?? '').' · '.($now['artist'] ?? ''), ' ·'), 90);
            if (count($lines) >= 10) {
                break;
            }
        }
        $room = app(ListenRooms::class)->active(self::roomType($owner), $owner->id);
        if ($room !== null) {
            array_unshift($lines, '🔴 Відкрита кімната «'.$room->title.'» — заходьте слухати разом.');
        }

        return [
            'title' => '🎧 Музика · '.self::name($owner),
            'lines' => $lines === [] ? ['Зараз ніхто не слухає музику.'] : $lines,
            'buttons' => [[self::back($owner), ['label' => $room ? '🎧 Приєднатися' : '🎧 Слухати разом', 'url' => URL::to($room ? '/listen/'.$room->code : '/music/rooms')]]],
        ];
    }

    /**
     * Оголошення в чат: у групі відкрили кімнату «Слухати разом».
     *
     * @return array<string, mixed>
     */
    public function listenRoom(Family|Clan|Community $owner, ListenParty $party, User $host): array
    {
        return [
            'title' => '🎧 Слухаємо разом · '.self::name($owner),
            'lines' => ['**'.$host->name.'** відкрив(-ла) кімнату «'.$party->title.'». Музика грає синхронно в усіх — приєднуйтесь із сайту чи застосунку GameCon.'],
            'buttons' => [[['label' => '🎧 Приєднатися', 'url' => URL::to('/listen/'.$party->code)]]],
        ];
    }

    /** Тип групи в кімнатах «Слухати разом». */
    public static function roomType(Family|Clan|Community $owner): string
    {
        return match (true) {
            $owner instanceof Family => 'family',
            $owner instanceof Clan => 'clan',
            default => 'community',
        };
    }

    /**
     * Особиста картка: хто ви в групі. Якщо акаунт не прив’язано — як це зробити.
     *
     * @return array<string, mixed>
     */
    public function me(Family|Clan|Community $owner, ?User $user, string $platform): array
    {
        if ($user === null) {
            return $this->unlinked($platform);
        }
        $fields = [];
        if ($owner instanceof Family) {
            $m = $owner->activeMembers()->where('user_id', $user->id)->first();
            if ($m instanceof FamilyMember) {
                $fields = [['🎭 Нік', $m->rp_nickname], ['🎖️ Ранг', $owner->rankTitle($m->rank)], ['💰 Баланс', number_format((int) $m->balance, 0, ',', ' ').' ₴']];
            }
        } elseif ($owner instanceof Clan) {
            $m = $owner->activeMembers()->where('user_id', $user->id)->first();
            if ($m instanceof ClanMember) {
                $fields = [['🎭 Нік', $m->nickname ?: $user->name], ['🎖️ Ранг', $owner->rankTitle($m->rank)]];
            }
        } else {
            $m = $owner->membershipFor($user);
            if ($m?->isActive()) {
                $fields = [['🎖️ Роль', $m->isManager() ? 'Керівник' : 'Учасник']];
            }
        }

        return [
            'title' => '🙋 '.$user->name,
            'lines' => $fields === [] ? ['Ви не в складі цієї групи на GameCon.'] : [],
            'fields' => $fields,
            'thumb' => $user->avatar_url,
            'buttons' => [[self::back($owner), ['label' => '👤 Мій профіль', 'url' => URL::to('/'.$user->username)]]],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function unlinked(string $platform): array
    {
        return [
            'title' => '🔗 Прив’яжіть акаунт GameCon',
            'lines' => [$platform === 'telegram'
                ? 'Відкрийте Налаштування → Акаунт на GameCon і натисніть «Прив’язати Telegram». Після цього кнопки бота працюватимуть від вашого імені.'
                : 'Увійдіть на GameCon через Discord або прив’яжіть Discord у профілі — і кнопки бота працюватимуть від вашого імені.'],
            'buttons' => [[['label' => '⚙️ Відкрити налаштування', 'url' => URL::to('/settings/account')]]],
        ];
    }

    /**
     * @return Builder<FamilyEvent>|Builder<ClanEvent>
     */
    public function upcoming(Family|Clan|Community $owner)
    {
        return match (true) {
            $owner instanceof Family => FamilyEvent::query()->where('family_id', $owner->id)->where('status', FamilyEvent::STATUS_PLANNED)->where('starts_at', '>=', now()->subHour())->orderBy('starts_at'),
            $owner instanceof Clan => ClanEvent::query()->where('clan_id', $owner->id)->where('starts_at', '>=', now()->subHour())->orderBy('starts_at'),
            default => FamilyEvent::query()->whereRaw('1 = 0'),
        };
    }

    public function goingCount(FamilyEvent|ClanEvent $event): int
    {
        return $event instanceof FamilyEvent
            ? FamilyEventAttendance::query()->where('event_id', $event->id)->whereIn('status', [FamilyEventAttendance::STATUS_GOING, FamilyEventAttendance::STATUS_ATTENDED])->count()
            : $event->going()->count();
    }

    private function logo(Family|Clan|Community $owner): ?string
    {
        $url = match (true) {
            $owner instanceof Family, $owner instanceof Clan => $owner->logo_url,
            default => $owner->avatar_url,
        };

        return is_string($url) && str_starts_with($url, 'http') ? $url : null;
    }
}
