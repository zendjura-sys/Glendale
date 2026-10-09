<?php

/**
 * Збирає українські рядки серверного коду для каталогу перекладів.
 * Рядок із підстановками («Вас заглушено до {$until}», 'Сума: '.$x) стає шаблоном «Вас заглушено до {0}».
 * Друкує JSON-масив ключів. Запуск: php scripts/i18n/extract-php.php app routes
 */
const CYR = '/[А-Яа-яЁёІіЇїЄєҐґ]/u';

$dirs = array_slice($argv, 1) ?: ['app', 'routes'];
$keys = [];

foreach ($dirs as $dir) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        if (str_ends_with($file->getFilename(), '.php')) {
            foreach (extractFile((string) file_get_contents($file->getPathname())) as $key) {
                $keys[$key] = true;
            }
        }
    }
}

$keys = array_keys($keys);
sort($keys);
echo json_encode($keys, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), "\n";

/** @return list<string> */
function extractFile(string $code): array
{
    $tokens = array_values(array_filter(token_get_all($code), fn ($t) => ! is_array($t) || ! in_array($t[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)));
    $out = [];
    $done = [];
    $n = count($tokens);
    for ($i = 0; $i < $n; $i++) {
        // Службові списки (корені мату для фільтра) — не інтерфейс.
        if (is_array($tokens[$i]) && $tokens[$i][0] === T_CONST && is_array($tokens[$i + 1] ?? null) && in_array($tokens[$i + 1][1], ['ROOTS'], true)) {
            while ($i < $n && $tokens[$i] !== ';') {
                $i++;
            }

            continue;
        }
        if (isset($done[$i])) {
            continue;
        }
        $t = $tokens[$i];
        $isLiteral = is_array($t) && $t[0] === T_CONSTANT_ENCAPSED_STRING && preg_match(CYR, $t[1]) === 1;
        $isEncapsed = $t === '"' && hasCyrillicEncapsed($tokens, $i);
        if (! $isLiteral && ! $isEncapsed) {
            continue;
        }
        [$start, $end] = bounds($tokens, $i);
        $operands = splitConcat($tokens, $start, $end);
        $key = '';
        $index = 0;
        $literalOnly = true;
        foreach ($operands as [$a, $b]) {
            if ($a === $b && is_array($tokens[$a]) && $tokens[$a][0] === T_CONSTANT_ENCAPSED_STRING) {
                $key .= unquote($tokens[$a][1]);
                $done[$a] = true;
            } elseif ($tokens[$a] === '"' && $tokens[$b] === '"') {
                $literalOnly = false;
                $key .= encapsed($tokens, $a, $b, $index);
                for ($k = $a; $k <= $b; $k++) {
                    $done[$k] = true;
                }
            } else {
                $literalOnly = false;
                $key .= '{'.$index++.'}';
            }
        }
        // sprintf('… %s …', …) → шаблон.
        if ($literalOnly && preg_match('/%[sd]/', $key) === 1 && isSprintfArg($tokens, $start)) {
            $k = 0;
            $key = (string) preg_replace_callback('/%[sd]/', function () use (&$k) {
                return '{'.$k++.'}';
            }, $key);
        }
        if (preg_match(CYR, $key) !== 1 || looksLikeRegex($key)) {
            continue;
        }
        $out[] = $key;
    }

    return $out;
}

function hasCyrillicEncapsed(array $tokens, int $i): bool
{
    for ($k = $i + 1; $k < count($tokens) && $tokens[$k] !== '"'; $k++) {
        if (is_array($tokens[$k]) && $tokens[$k][0] === T_ENCAPSED_AND_WHITESPACE && preg_match(CYR, $tokens[$k][1]) === 1) {
            return true;
        }
    }

    return false;
}

/** Межі виразу навколо рядка: до коми, дужки, «=», «=>», «?», «:», «;» на тому ж рівні вкладеності. */
function bounds(array $tokens, int $i): array
{
    $stops = [',', ';', '=', '?', ':', '{', '}', '[', '(', ']', ')'];
    $stopTypes = [T_DOUBLE_ARROW, T_RETURN, T_ECHO, T_COALESCE, T_BOOLEAN_AND, T_BOOLEAN_OR, T_IS_EQUAL, T_IS_IDENTICAL, T_IS_NOT_EQUAL, T_IS_NOT_IDENTICAL, T_THROW, T_CONCAT_EQUAL, T_PRINT, T_YIELD, T_CASE];
    $isStop = fn ($t) => is_string($t) ? in_array($t, $stops, true) : in_array($t[0], $stopTypes, true);
    $end = closing($tokens, $i);
    $start = $i;
    // Вліво: оператор «.» і операнд перед ним.
    while (true) {
        $p = $start - 1;
        if ($p < 0 || $tokens[$p] !== '.') {
            break;
        }
        $q = $p - 1;
        $depth = 0;
        while ($q >= 0) {
            $t = $tokens[$q];
            if ($t === ')' || $t === ']' || $t === '}') {
                $depth++;
            } elseif ($t === '(' || $t === '[' || $t === '{' || (is_array($t) && in_array($t[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) {
                if ($depth === 0) {
                    break;
                }
                $depth--;
            } elseif ($depth === 0 && ($t === '.' || $isStop($t))) {
                break;
            } elseif ($depth === 0 && $t === '"' && $q !== $p - 1) {
                // кінець попереднього "..." — шукаємо його початок
            }
            $q--;
        }
        $start = $q + 1;
    }
    // Вправо.
    while (true) {
        $p = $end + 1;
        if ($p >= count($tokens) || $tokens[$p] !== '.') {
            break;
        }
        $q = $p + 1;
        $depth = 0;
        while ($q < count($tokens)) {
            $t = $tokens[$q];
            if ($t === '"' && $depth === 0) {
                $q = closing($tokens, $q) + 1;

                continue;
            }
            if ($t === '(' || $t === '[' || $t === '{' || (is_array($t) && in_array($t[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) {
                $depth++;
            } elseif ($t === ')' || $t === ']' || $t === '}') {
                if ($depth === 0) {
                    break;
                }
                $depth--;
            } elseif ($depth === 0 && ($t === '.' || $isStop($t))) {
                break;
            }
            $q++;
        }
        $end = $q - 1;
    }

    return [$start, $end];
}

/** Кінець рядкового токена (для "..." — закривальні лапки). */
function closing(array $tokens, int $i): int
{
    if ($tokens[$i] !== '"') {
        return $i;
    }
    for ($k = $i + 1; $k < count($tokens); $k++) {
        if ($tokens[$k] === '"') {
            return $k;
        }
    }

    return $i;
}

/** Операнди конкатенації в межах [start, end]: список пар [від, до]. */
function splitConcat(array $tokens, int $start, int $end): array
{
    $out = [];
    $depth = 0;
    $from = $start;
    for ($k = $start; $k <= $end; $k++) {
        $t = $tokens[$k];
        if ($t === '"') {
            $k = closing($tokens, $k);

            continue;
        }
        if ($t === '(' || $t === '[' || $t === '{' || (is_array($t) && in_array($t[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) {
            $depth++;
        } elseif ($t === ')' || $t === ']' || $t === '}') {
            $depth--;
        } elseif ($t === '.' && $depth === 0) {
            $out[] = [$from, $k - 1];
            $from = $k + 1;
        }
    }
    $out[] = [$from, $end];

    return $out;
}

/** "Текст {$a} і $b" → «Текст {0} і {1}». */
function encapsed(array $tokens, int $a, int $b, int &$index): string
{
    $out = '';
    $depth = 0;
    for ($k = $a + 1; $k < $b; $k++) {
        $t = $tokens[$k];
        if (is_array($t) && $t[0] === T_ENCAPSED_AND_WHITESPACE && $depth === 0) {
            $out .= stripcslashes(str_replace(['\\$', '\\"'], ['$', '"'], $t[1]));

            continue;
        }
        if (is_array($t) && in_array($t[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true)) {
            if ($depth === 0) {
                $out .= '{'.$index++.'}';
            }
            $depth++;

            continue;
        }
        if ($t === '}' && $depth > 0) {
            $depth--;

            continue;
        }
        if ($depth === 0 && is_array($t) && $t[0] === T_VARIABLE) {
            $out .= '{'.$index++.'}';
            // $user->name / $a['x'] у простому синтаксисі — частина тієї самої підстановки.
            while (isset($tokens[$k + 1]) && (
                (is_array($tokens[$k + 1]) && in_array($tokens[$k + 1][0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR], true))
                || $tokens[$k + 1] === '['
            )) {
                if ($tokens[$k + 1] === '[') {
                    while ($k < $b && $tokens[$k] !== ']') {
                        $k++;
                    }
                } else {
                    $k += 2;
                }
            }
        }
    }

    return $out;
}

function unquote(string $literal): string
{
    $q = $literal[0];
    $body = substr($literal, 1, -1);

    return $q === "'" ? str_replace(["\\'", '\\\\'], ["'", '\\'], $body) : stripcslashes(str_replace('\\$', '$', $body));
}

function isSprintfArg(array $tokens, int $start): bool
{
    return $start >= 2 && $tokens[$start - 1] === '(' && is_array($tokens[$start - 2]) && in_array(strtolower($tokens[$start - 2][1]), ['sprintf', 'printf'], true);
}

function looksLikeRegex(string $s): bool
{
    return preg_match('{^([/#~]).+\1[imsuxUD]*$}s', $s) === 1 || str_contains($s, '(?') || str_contains($s, '\\p{');
}
