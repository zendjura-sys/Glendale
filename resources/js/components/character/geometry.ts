/**
 * Геометрія персонажа в стилі Stereo (простір 300×320, голова «пливе», без шиї).
 * Контури з макетів узято дослівно — їх тут не змінюємо. Позначені «власні» — домальовані
 * в тій самій системі координат для пунктів, до яких макет не дав контурів.
 */

export type SkinPalette = {
    id: string;
    name: string;
    base: string;
    shadow: string;
    deep: string;
    highlight: string;
    lip: string;
};

export const SKIN_PALETTES: SkinPalette[] = [
    // власні: світліші тони
    {
        id: 'porcelain',
        name: 'Порцеляна',
        base: '#FBE3D3',
        shadow: '#EDCBB6',
        deep: '#D7AE97',
        highlight: '#FFF1E8',
        lip: '#E09486',
    },
    {
        id: 'light_rose',
        name: 'Рожевувата',
        base: '#F6D0BC',
        shadow: '#E5B7A0',
        deep: '#CB9880',
        highlight: '#FFE2D2',
        lip: '#D97F72',
    },
    {
        id: 'fair_peach',
        name: 'Персикова',
        base: '#F3C6A8',
        shadow: '#E0AE8E',
        deep: '#C58E6E',
        highlight: '#FCD9C2',
        lip: '#D68272',
    },
    {
        id: 'golden_olive',
        name: 'Оливкова',
        base: '#DFB18B',
        shadow: '#C99872',
        deep: '#AD7B56',
        highlight: '#ECC3A1',
        lip: '#BD745E',
    },
    // власна
    {
        id: 'honey',
        name: 'Медова',
        base: '#D9A06E',
        shadow: '#C2885A',
        deep: '#A46D43',
        highlight: '#E8B484',
        lip: '#B86A50',
    },
    {
        id: 'warm_tan',
        name: 'Засмагла',
        base: '#D48B5C',
        shadow: '#BD7346',
        deep: '#9E5A31',
        highlight: '#E39D70',
        lip: '#B56345',
    },
    // власна
    {
        id: 'caramel',
        name: 'Карамельна',
        base: '#B87348',
        shadow: '#9F5E36',
        deep: '#824826',
        highlight: '#C9865A',
        lip: '#985036',
    },
    {
        id: 'deep_bronze',
        name: 'Бронзова',
        base: '#9C5B36',
        shadow: '#824726',
        deep: '#663418',
        highlight: '#B06C46',
        lip: '#7D3F2A',
    },
    {
        id: 'espresso',
        name: 'Еспресо',
        base: '#613620',
        shadow: '#4D2815',
        deep: '#381B0C',
        highlight: '#75452D',
        lip: '#4F271D',
    },
    // власна
    {
        id: 'ebony',
        name: 'Чорне дерево',
        base: '#4A2A1A',
        shadow: '#3A1F12',
        deep: '#29150B',
        highlight: '#5C3A28',
        lip: '#3D2017',
    },
];

export type HeadShape = {
    id: string;
    name: string;
    head: string;
    chinShadow: string;
};

export const HEAD_SHAPES: HeadShape[] = [
    {
        id: 'oval_classic',
        name: 'Овальна',
        head: 'M 150 44 C 84 44, 62 84, 64 148 C 66 202, 92 246, 128 262 C 142 268, 158 268, 172 262 C 208 246, 234 202, 236 148 C 238 84, 216 44, 150 44 Z',
        chinShadow: 'M 116 254 Q 150 266 184 254 Q 150 269 116 254 Z',
    },
    {
        id: 'round_soft',
        name: 'Кругла',
        head: 'M 150 46 C 80 46, 58 90, 60 154 C 62 212, 96 254, 134 264 C 144 267, 156 267, 166 264 C 204 254, 238 212, 240 154 C 242 90, 220 46, 150 46 Z',
        chinShadow: 'M 118 256 Q 150 266 182 256 Q 150 268 118 256 Z',
    },
    {
        id: 'angular_jaw',
        name: 'Гостра',
        head: 'M 150 44 C 84 44, 62 82, 64 146 L 74 210 C 78 228, 114 252, 136 263 C 145 267, 155 267, 164 263 C 186 252, 222 228, 226 210 L 236 146 C 238 82, 216 44, 150 44 Z',
        chinShadow: 'M 124 255 L 150 265 L 176 255 L 150 267 Z',
    },
    // власні
    {
        id: 'wide_jaw',
        name: 'Широка щелепа',
        head: 'M 150 44 C 84 44, 59 83, 62 145 C 63 196, 75 232, 107 254 C 125 266, 175 266, 193 254 C 225 232, 237 196, 238 145 C 241 83, 216 44, 150 44 Z',
        chinShadow: 'M 120 256 Q 150 268 180 256 Q 150 270 120 256 Z',
    },
    {
        id: 'heart',
        name: 'Сердечко',
        head: 'M 150 46 C 82 46, 59 85, 64 140 C 69 190, 98 236, 134 260 C 143 266, 157 266, 166 260 C 202 236, 231 190, 236 140 C 241 85, 218 46, 150 46 Z',
        chinShadow: 'M 128 256 Q 150 266 172 256 Q 150 268 128 256 Z',
    },
];

export const EARS_GEOMETRY = {
    leftOuter: 'M 67 142 C 52 138, 48 156, 54 176 C 58 188, 65 192, 70 186 Z',
    leftInner: 'M 65 150 C 57 149, 55 160, 59 172 C 61 178, 65 180, 67 176 Z',
    rightOuter:
        'M 233 142 C 248 138, 252 156, 246 176 C 242 188, 235 192, 230 186 Z',
    rightInner:
        'M 235 150 C 243 149, 245 160, 241 172 C 239 178, 235 180, 233 176 Z',
};

export type NosePreset = {
    id: string;
    name: string;
    bridgeShadow: string;
    bridgeHighlight: string;
    tipShadow: string;
    nostrils: string;
};

export const NOSE_PRESETS: NosePreset[] = [
    {
        id: 'stereo_button',
        name: 'Кнопка',
        bridgeShadow:
            'M 144 152 Q 142 172 136 184 L 144 186 Q 147 170 146 152 Z',
        bridgeHighlight: 'M 150 150 L 149 180 L 152 180 L 151 150 Z',
        tipShadow:
            'M 134 186 C 134 194, 143 197, 150 197 C 157 197, 166 194, 166 186 C 161 191, 155 192, 150 192 C 145 192, 139 191, 134 186 Z',
        nostrils: 'M 138 190 Q 142 188 145 191 M 162 190 Q 158 188 155 191',
    },
    {
        id: 'stereo_narrow',
        name: 'Прямий вузький',
        bridgeShadow: 'M 145 148 L 139 185 L 145 187 L 147 148 Z',
        bridgeHighlight: 'M 150 146 L 149 183 L 152 183 L 151 146 Z',
        tipShadow: 'M 138 186 Q 150 196 162 186 Q 150 192 138 186 Z',
        nostrils: 'M 140 189 Q 144 188 146 190 M 160 189 Q 156 188 154 190',
    },
    {
        id: 'stereo_wide',
        name: 'Широкий',
        bridgeShadow:
            'M 142 154 Q 139 172 131 184 L 141 187 Q 145 172 145 154 Z',
        bridgeHighlight:
            'M 150 154 C 148 168, 147 178, 150 183 C 153 178, 152 168, 150 154 Z',
        tipShadow:
            'M 129 185 C 129 195, 141 198, 150 198 C 159 198, 171 195, 171 185 C 165 191, 156 193, 150 193 C 144 193, 135 191, 129 185 Z',
        nostrils: 'M 134 190 Q 139 187 143 191 M 166 190 Q 161 187 157 191',
    },
    // власні
    {
        id: 'roman_hooked',
        name: 'Римський',
        bridgeShadow:
            'M 145 146 C 142 160, 137 172, 134 184 L 143 187 C 146 172, 148 160, 148 146 Z',
        bridgeHighlight:
            'M 150 146 C 149 160, 148 172, 149 182 L 152 182 C 152 170, 152 158, 151 146 Z',
        tipShadow:
            'M 134 185 C 136 196, 146 199, 152 198 C 160 197, 166 192, 164 184 C 158 190, 152 192, 146 192 C 140 192, 136 189, 134 185 Z',
        nostrils: 'M 138 190 Q 142 188 145 191 M 162 190 Q 158 188 155 191',
    },
    {
        id: 'upturned_cute',
        name: 'Кирпатий',
        bridgeShadow:
            'M 145 156 Q 143 170 139 180 L 145 182 Q 147 170 147 156 Z',
        bridgeHighlight: 'M 150 156 L 150 178 L 152 178 L 151 156 Z',
        tipShadow:
            'M 138 182 C 139 190, 145 192, 150 192 C 155 192, 161 190, 162 182 C 157 186, 154 187, 150 187 C 146 187, 143 186, 138 182 Z',
        nostrils: 'M 141 186 Q 144 184 146 187 M 159 186 Q 156 184 154 187',
    },
];

export type MouthPreset = {
    id: string;
    name: string;
    upperLip: string;
    lowerLip: string;
    centerLine: string;
    chinDimple: string;
    /** Кільце пірсингу (власне). */
    ring?: string;
};

export const MOUTH_PRESETS: MouthPreset[] = [
    {
        id: 'full_natural',
        name: 'Повні',
        upperLip:
            'M 128 218 C 135 211, 144 210, 150 213 C 156 210, 165 211, 172 218 C 162 220, 155 219, 150 219 C 145 219, 138 220, 128 218 Z',
        lowerLip:
            'M 128 218 C 136 229, 164 229, 172 218 C 162 220, 138 220, 128 218 Z',
        centerLine: 'M 127 218 Q 150 221 173 218',
        chinDimple: 'M 142 232 Q 150 236 158 232',
    },
    {
        id: 'soft_smile',
        name: 'Усмішка',
        upperLip:
            'M 125 216 C 134 210, 144 210, 150 213 C 156 210, 166 210, 175 216 C 164 220, 136 220, 125 216 Z',
        lowerLip:
            'M 126 216 C 136 229, 164 229, 174 216 C 162 220, 138 220, 126 216 Z',
        centerLine: 'M 124 215 Q 150 222 176 215',
        chinDimple: 'M 143 231 Q 150 235 157 231',
    },
    {
        id: 'matte_minimal',
        name: 'Тонкі',
        upperLip:
            'M 132 218 Q 142 213 150 215 Q 158 213 168 218 Q 150 220 132 218 Z',
        lowerLip: 'M 132 218 Q 150 226 168 218 Z',
        centerLine: 'M 131 218 Q 150 219 169 218',
        chinDimple: 'M 144 229 Q 150 232 156 229',
    },
    // власні
    {
        id: 'smirk',
        name: 'Ухмилка',
        upperLip:
            'M 130 219 C 136 213, 145 212, 150 214 C 156 211, 166 209, 174 212 C 164 217, 156 218, 150 218 C 144 219, 138 220, 130 219 Z',
        lowerLip:
            'M 130 219 C 140 228, 162 226, 174 212 C 164 217, 140 220, 130 219 Z',
        centerLine: 'M 129 219 Q 152 219 175 211',
        chinDimple: 'M 143 232 Q 150 235 157 232',
    },
    {
        id: 'cat_mouth',
        name: 'Котячий :3',
        upperLip: '',
        lowerLip: '',
        centerLine: 'M 132 214 Q 141 224 150 216 Q 159 224 168 214',
        chinDimple: '',
    },
    {
        id: 'pierced',
        name: 'З пірсингом',
        upperLip:
            'M 128 218 C 135 211, 144 210, 150 213 C 156 210, 165 211, 172 218 C 162 220, 155 219, 150 219 C 145 219, 138 220, 128 218 Z',
        lowerLip:
            'M 128 218 C 136 229, 164 229, 172 218 C 162 220, 138 220, 128 218 Z',
        centerLine: 'M 127 218 Q 150 221 173 218',
        chinDimple: 'M 142 232 Q 150 236 158 232',
        ring: 'M 157 225 A 4.5 4.5 0 1 0 163 229',
    },
];

/** Відтінки губ: перший — природний (з палітри шкіри). */
export const LIP_TINTS = [
    'natural',
    '#C2546B',
    '#B91C1C',
    '#7E2A55',
    '#D9A08B',
    '#3F1D2B',
];

export type HairPreset = {
    id: string;
    name: string;
    back: string;
    front: string;
};

export const HAIR_PRESETS: HairPreset[] = [
    { id: 'bald', name: 'Без волосся', back: '', front: '' },
    {
        id: 'buzz_fade',
        name: 'Їжак',
        back: '',
        front: 'M 74 134 C 70 80, 96 44, 150 44 C 204 44, 230 80, 226 134 C 220 96, 198 76, 150 76 C 102 76, 80 96, 74 134 Z',
    },
    {
        id: 'top_bun',
        name: 'Гулька',
        back: 'M 122 50 C 122 20, 178 20, 178 50 Z',
        front: 'M 73 140 C 68 82, 95 44, 150 44 C 205 44, 232 82, 227 140 C 218 96, 192 74, 150 72 C 108 74, 82 96, 73 140 Z',
    },
    {
        id: 'twin_braids',
        name: 'Дві коси',
        back: 'M 82 200 C 74 235, 72 270, 80 295 C 90 295, 94 265, 94 215 Z M 218 200 C 226 235, 228 270, 220 295 C 210 295, 206 265, 206 215 Z',
        front: 'M 72 146 C 68 80, 96 42, 150 42 C 204 42, 232 80, 228 146 C 214 96, 178 74, 150 64 C 122 74, 86 96, 72 146 Z',
    },
    {
        id: 'side_wave_bob',
        name: 'Хвилясте каре',
        back: 'M 68 120 C 44 165, 46 245, 74 268 L 110 260 L 190 260 L 226 268 C 254 245, 256 165, 232 120 Z',
        front: 'M 68 156 C 62 84, 94 38, 152 38 C 210 38, 238 84, 232 165 C 218 112, 198 82, 132 76 C 98 84, 80 116, 68 156 Z',
    },
    {
        id: 'sleek_tucked',
        name: 'За вуха',
        back: 'M 72 150 C 58 205, 62 258, 82 276 L 218 276 C 238 258, 242 205, 228 150 Z',
        front: 'M 73 142 C 68 80, 96 42, 150 42 C 204 42, 232 80, 227 142 C 216 94, 190 74, 150 74 C 110 74, 84 94, 73 142 Z',
    },
    {
        id: 'center_part_curtain',
        name: 'Шторки',
        back: 'M 64 130 C 48 185, 52 252, 78 274 L 222 274 C 248 252, 252 185, 236 130 Z',
        front: 'M 68 172 C 62 90, 94 40, 150 40 C 206 40, 238 90, 232 172 C 216 122, 184 86, 150 68 C 116 86, 84 122, 68 172 Z',
    },
    {
        id: 'short_quiff',
        name: 'Кок',
        back: '',
        front: 'M 72 138 C 66 78, 92 34, 150 32 C 208 34, 234 78, 228 138 C 218 96, 194 78, 150 78 C 106 78, 82 96, 72 138 Z',
    },
    {
        id: 'puffy_curls',
        name: 'Об’ємні кучері',
        back: 'M 54 120 C 30 165, 34 250, 72 276 L 228 276 C 266 250, 270 165, 246 120 C 252 65, 206 28, 150 28 C 94 28, 48 65, 54 120 Z',
        front: 'M 66 154 C 60 88, 94 42, 150 42 C 206 42, 240 88, 234 154 C 212 108, 178 82, 150 68 C 122 82, 88 108, 66 154 Z',
    },
    // власні
    {
        id: 'anime_spiky',
        name: 'Аніме-шипи',
        back: '',
        front: 'M 70 150 L 62 112 L 80 118 L 74 76 L 100 96 L 104 50 L 128 82 L 150 36 L 166 80 L 196 48 L 198 94 L 226 74 L 220 118 L 238 112 L 230 150 C 218 108, 192 86, 150 84 C 108 86, 82 108, 70 150 Z',
    },
    {
        id: 'ponytail',
        name: 'Хвіст',
        back: 'M 196 70 C 250 80, 262 150, 246 214 C 240 236, 226 246, 218 238 C 236 200, 236 132, 204 96 Z',
        front: 'M 73 140 C 68 80, 96 42, 150 42 C 204 42, 232 80, 227 140 C 216 96, 190 74, 150 72 C 110 74, 84 96, 73 140 Z',
    },
    {
        id: 'dreadlocks',
        name: 'Дреди',
        back: 'M 66 120 C 52 170, 56 250, 72 280 L 92 280 L 90 200 L 106 284 L 124 284 L 118 210 Z M 234 120 C 248 170, 244 250, 228 280 L 208 280 L 210 200 L 194 284 L 176 284 L 182 210 Z',
        front: 'M 70 150 C 64 84, 96 40, 150 40 C 204 40, 236 84, 230 150 C 222 118, 210 98, 196 88 L 190 112 L 178 84 L 168 106 L 158 78 L 148 104 L 136 80 L 128 106 L 116 86 L 108 110 L 102 90 C 86 102, 76 124, 70 150 Z',
    },
];

export const HAIR_COLORS = [
    { name: 'Чорний', hex: '#141210' },
    { name: 'Темно-каштановий', hex: '#2C1B12' },
    { name: 'Каштановий', hex: '#4E2E1E' },
    { name: 'Мідний', hex: '#7B4425' },
    { name: 'Золотистий', hex: '#C68B3E' },
    { name: 'Блонд', hex: '#E6C786' },
    { name: 'Платиновий', hex: '#E2E8F0' },
    { name: 'Багряний', hex: '#991B1B' },
    { name: 'Рожевий', hex: '#F43F5E' },
    { name: 'Фіолетовий', hex: '#A855F7' },
    { name: 'Кібер-синій', hex: '#2563EB' },
    { name: 'Смарагдовий', hex: '#10B981' },
    // власні
    { name: 'Рудий', hex: '#C2410C' },
    { name: 'Сивий', hex: '#9CA3AF' },
];

/** Форми очей у рідних координатах лівого ока (центр 95, 155); на голові — масштаб і зсув. */
export type EyeShape = {
    id: string;
    name: string;
    sclera: string;
    upperShadow: string;
    upperLash: string;
    lashSpikes: string;
    lowerLash: string;
    eyelidCrease: string;
    irisRx: number;
    irisRy: number;
    irisCy: number;
};

export const EYE_SHAPES: EyeShape[] = [
    // власна: класичне око Stereo
    {
        id: 'classic_stereo',
        name: 'Класичні',
        sclera: 'M 66 157 C 74 141, 112 140, 124 154 C 116 168, 84 170, 66 157 Z',
        upperShadow:
            'M 66 157 C 74 141, 112 140, 124 154 C 112 150, 84 149, 66 157 Z',
        upperLash:
            'M 62 158 C 72 138, 114 136, 128 152 C 124 154, 122 154, 121 153 C 108 143, 76 144, 66 157 Z',
        lashSpikes: '',
        lowerLash:
            'M 76 165 C 90 170, 108 168, 118 160 C 108 166, 90 168, 76 165 Z',
        eyelidCrease: 'M 72 140 C 88 132, 108 133, 120 141',
        irisRx: 15,
        irisRy: 17,
        irisCy: 155,
    },
    {
        id: 'female_winged',
        name: 'З крильцями',
        sclera: 'M 58 158 C 66 136, 108 134, 128 150 C 122 169, 98 174, 72 168 C 64 165, 60 162, 58 158 Z',
        upperShadow:
            'M 58 158 C 66 136, 108 134, 128 150 C 125 156, 105 148, 85 149 C 70 150, 62 155, 58 158 Z',
        upperLash:
            'M 54 160 C 62 133, 106 130, 136 144 C 131 148, 127 149, 129 153 C 110 139, 70 140, 58 159 Z',
        lashSpikes:
            'M 118 138 L 132 132 L 125 142 Z M 102 134 L 111 128 L 108 136 Z',
        lowerLash:
            'M 68 168 C 86 175, 112 172, 125 156 C 112 169, 86 172, 68 168 Z',
        eyelidCrease: 'M 64 134 C 82 125, 108 126, 124 136',
        irisRx: 19,
        irisRy: 21,
        irisCy: 154,
    },
    {
        id: 'female_round',
        name: 'Круглі',
        sclera: 'M 60 159 C 66 133, 108 132, 126 152 C 121 172, 98 176, 72 170 C 64 167, 61 163, 60 159 Z',
        upperShadow:
            'M 60 159 C 66 133, 108 132, 126 152 C 122 158, 104 147, 84 148 C 70 149, 63 155, 60 159 Z',
        upperLash:
            'M 56 160 C 63 129, 109 128, 133 148 C 128 151, 125 152, 126 155 C 108 137, 70 138, 60 160 Z',
        lashSpikes:
            'M 115 136 L 128 129 L 122 141 Z M 98 131 L 105 124 L 104 133 Z',
        lowerLash:
            'M 70 170 C 88 177, 112 174, 123 158 C 110 171, 88 174, 70 170 Z',
        eyelidCrease: 'M 66 131 C 84 122, 108 123, 122 134',
        irisRx: 21,
        irisRy: 23,
        irisCy: 155,
    },
    {
        id: 'female_fierce',
        name: 'Рішучі',
        sclera: 'M 56 154 C 68 140, 106 142, 128 156 C 120 170, 96 173, 70 165 C 62 162, 58 158, 56 154 Z',
        upperShadow:
            'M 56 154 C 68 140, 106 142, 128 156 C 118 158, 98 150, 78 150 C 66 150, 60 152, 56 154 Z',
        upperLash:
            'M 50 151 C 66 136, 108 138, 135 156 C 129 157, 126 158, 128 160 C 106 145, 68 143, 56 155 Z',
        lashSpikes: 'M 58 144 L 46 139 L 54 149 Z',
        lowerLash:
            'M 68 165 C 88 173, 112 170, 125 159 C 112 167, 88 170, 68 165 Z',
        eyelidCrease: 'M 64 136 C 84 132, 108 135, 124 144',
        irisRx: 18,
        irisRy: 19,
        irisCy: 155,
    },
    {
        id: 'male_sharp',
        name: 'Гострі',
        sclera: 'M 56 156 L 68 144 L 116 145 L 128 155 L 114 166 L 74 166 Z',
        upperShadow:
            'M 56 156 L 68 144 L 116 145 L 128 155 L 118 155 L 66 154 Z',
        upperLash:
            'M 51 157 L 65 140 L 118 141 L 132 154 L 127 159 L 124 154 L 115 146 L 68 145 L 56 157 Z',
        lashSpikes: '',
        lowerLash: 'M 72 166 L 114 166 L 125 157 L 113 164 L 72 164 Z',
        eyelidCrease: 'M 66 136 L 114 137',
        irisRx: 16,
        irisRy: 17,
        irisCy: 154,
    },
    {
        id: 'male_narrow',
        name: 'Лисячі',
        sclera: 'M 54 156 C 68 146, 108 146, 130 155 C 114 164, 82 164, 54 156 Z',
        upperShadow:
            'M 54 156 C 68 146, 108 146, 130 155 C 110 153, 76 153, 54 156 Z',
        upperLash:
            'M 48 156 C 66 142, 110 142, 136 155 C 128 156, 122 156, 128 155 C 108 147, 68 147, 54 156 Z',
        lashSpikes: '',
        lowerLash:
            'M 64 161 C 86 165, 112 163, 126 156 C 110 161, 86 163, 64 161 Z',
        eyelidCrease: 'M 64 140 C 86 136, 110 138, 124 144',
        irisRx: 14,
        irisRy: 15,
        irisCy: 154,
    },
    // власні
    {
        id: 'sleepy',
        name: 'Сонні',
        sclera: 'M 60 158 C 72 150, 110 148, 128 154 C 118 168, 92 172, 70 166 C 64 164, 61 161, 60 158 Z',
        upperShadow:
            'M 60 158 C 72 150, 110 148, 128 154 C 112 156, 84 156, 60 158 Z',
        upperLash:
            'M 56 159 C 70 146, 112 144, 133 153 C 129 156, 126 156, 127 158 C 108 151, 74 152, 60 160 Z',
        lashSpikes: '',
        lowerLash:
            'M 70 166 C 88 172, 112 170, 124 160 C 112 168, 88 170, 70 166 Z',
        eyelidCrease: 'M 64 144 C 84 138, 108 138, 124 146',
        irisRx: 18,
        irisRy: 20,
        irisCy: 157,
    },
    {
        id: 'wide_innocent',
        name: 'Наївні',
        sclera: 'M 60 157 C 64 128, 112 126, 128 152 C 124 176, 96 182, 72 172 C 64 168, 61 163, 60 157 Z',
        upperShadow:
            'M 60 157 C 64 128, 112 126, 128 152 C 120 150, 100 142, 82 143 C 70 145, 63 150, 60 157 Z',
        upperLash:
            'M 55 158 C 60 122, 114 120, 134 150 C 129 152, 126 153, 127 156 C 110 130, 70 132, 60 158 Z',
        lashSpikes: 'M 120 133 L 133 128 L 126 140 Z',
        lowerLash:
            'M 70 172 C 88 180, 114 176, 124 160 C 112 173, 88 176, 70 172 Z',
        eyelidCrease: 'M 64 126 C 84 116, 110 118, 124 130',
        irisRx: 22,
        irisRy: 24,
        irisCy: 156,
    },
    {
        id: 'droopy',
        name: 'Сумні',
        sclera: 'M 58 152 C 70 138, 108 140, 128 160 C 118 170, 92 172, 70 164 C 63 160, 60 156, 58 152 Z',
        upperShadow:
            'M 58 152 C 70 138, 108 140, 128 160 C 116 154, 96 148, 78 148 C 68 148, 62 150, 58 152 Z',
        upperLash:
            'M 53 152 C 68 134, 110 136, 134 162 C 129 163, 126 163, 127 165 C 106 144, 70 141, 58 153 Z',
        lashSpikes: '',
        lowerLash:
            'M 70 164 C 88 171, 112 170, 125 162 C 112 168, 88 169, 70 164 Z',
        eyelidCrease: 'M 62 136 C 82 128, 108 132, 126 146',
        irisRx: 18,
        irisRy: 20,
        irisCy: 155,
    },
    {
        id: 'monolid',
        name: 'Без складки',
        sclera: 'M 58 157 C 70 146, 108 145, 128 153 C 118 166, 92 168, 70 164 C 63 161, 60 159, 58 157 Z',
        upperShadow:
            'M 58 157 C 70 146, 108 145, 128 153 C 110 152, 80 152, 58 157 Z',
        upperLash:
            'M 54 158 C 68 142, 110 140, 133 152 C 129 155, 126 155, 127 157 C 108 148, 72 149, 58 158 Z',
        lashSpikes: '',
        lowerLash:
            'M 70 164 C 88 169, 110 168, 122 159 C 110 165, 88 167, 70 164 Z',
        eyelidCrease: '',
        irisRx: 17,
        irisRy: 19,
        irisCy: 156,
    },
    {
        id: 'happy_closed',
        name: 'Щасливі',
        sclera: '',
        upperShadow: '',
        upperLash:
            'M 60 160 C 74 142, 114 142, 130 160 C 126 160, 124 160, 122 158 C 108 148, 80 148, 66 160 Z',
        lashSpikes: '',
        lowerLash: '',
        eyelidCrease: '',
        irisRx: 0,
        irisRy: 0,
        irisCy: 155,
    },
];

export const PUPILS = [
    { id: 'round', name: 'Звичайна' },
    { id: 'slit', name: 'Котяча щілина' },
    { id: 'ringed', name: 'Кільця' },
    { id: 'cyber_ring', name: 'Кібер-HUD' },
    { id: 'star', name: 'Зірка' },
    { id: 'heart', name: 'Сердечко' },
];

export type EyeColor = {
    id: string;
    name: string;
    top: string;
    mid: string;
    bot: string;
    rim: string;
};

export const EYE_COLOR_PALETTES: EyeColor[] = [
    {
        id: 'warm_brown',
        name: 'Карі',
        top: '#270E05',
        mid: '#6B2D14',
        bot: '#B45309',
        rim: '#140702',
    },
    {
        id: 'amber_gold',
        name: 'Бурштин',
        top: '#B45309',
        mid: '#F59E0B',
        bot: '#FEF08A',
        rim: '#451A03',
    },
    {
        id: 'cyber_blue',
        name: 'Крижані',
        top: '#0F172A',
        mid: '#2563EB',
        bot: '#7DD3FC',
        rim: '#020617',
    },
    {
        id: 'azure_sky',
        name: 'Блакитні',
        top: '#1E3A8A',
        mid: '#0284C7',
        bot: '#67E8F9',
        rim: '#0F172A',
    },
    {
        id: 'emerald',
        name: 'Смарагд',
        top: '#064E3B',
        mid: '#10B981',
        bot: '#A7F3D0',
        rim: '#022C22',
    },
    {
        id: 'crimson_red',
        name: 'Багряні',
        top: '#4C0519',
        mid: '#E11D48',
        bot: '#FDA4AF',
        rim: '#1F020A',
    },
    {
        id: 'amethyst',
        name: 'Аметист',
        top: '#3B0764',
        mid: '#9333EA',
        bot: '#F0ABFC',
        rim: '#1E0338',
    },
    {
        id: 'silver_grey',
        name: 'Сріблясті',
        top: '#334155',
        mid: '#94A3B8',
        bot: '#F1F5F9',
        rim: '#0F172A',
    },
    {
        id: 'obsidian',
        name: 'Обсидіан',
        top: '#09090B',
        mid: '#27272A',
        bot: '#71717A',
        rim: '#000000',
    },
    {
        id: 'olive_dark',
        name: 'Оливкові',
        top: '#1A1C16',
        mid: '#3F4238',
        bot: '#787C6E',
        rim: '#0D0E0B',
    },
    // власні
    {
        id: 'neon_cyan',
        name: 'Неон',
        top: '#083344',
        mid: '#06B6D4',
        bot: '#A5F3FC',
        rim: '#042F2E',
    },
    {
        id: 'rose_pink',
        name: 'Рожеві',
        top: '#831843',
        mid: '#EC4899',
        bot: '#FBCFE8',
        rim: '#500724',
    },
];

/** Брови (власні) — ліва брова в просторі голови; права — дзеркально. */
export const BROW_PRESETS = [
    {
        id: 'natural_arch',
        name: 'Природні',
        path: 'M 64 132 C 78 120, 104 118, 122 126 C 104 124, 80 126, 66 135 Z',
        notch: '',
    },
    {
        id: 'thick_flat',
        name: 'Густі прямі',
        path: 'M 62 131 C 70 123, 104 121, 124 125 L 123 132 C 104 129, 74 131, 64 136 Z',
        notch: '',
    },
    {
        id: 'angled_fierce',
        name: 'Насуплені',
        path: 'M 62 124 C 80 122, 106 128, 124 138 L 121 141 C 104 133, 80 128, 64 129 Z',
        notch: '',
    },
    {
        id: 'slit_brow',
        name: 'З насічкою',
        path: 'M 64 132 C 78 120, 104 118, 122 126 C 104 124, 80 126, 66 135 Z',
        notch: 'M 95 116 L 100 116 L 99 132 L 94 132 Z',
    },
    {
        id: 'thin_high',
        name: 'Тонкі високі',
        path: 'M 66 128 C 80 112, 106 110, 122 120 C 106 115, 82 117, 68 130 Z',
        notch: '',
    },
    {
        id: 'soft_worried',
        name: 'Здивовані',
        path: 'M 64 128 C 78 126, 100 124, 122 116 C 104 124, 82 130, 66 132 Z',
        notch: '',
    },
];

export const FACIAL_HAIR_PRESETS = [
    { id: 'none', name: 'Без бороди', path: '', opacity: 0 },
    {
        id: 'stubble',
        name: 'Щетина',
        opacity: 0.22,
        path: 'M 76 182 C 80 232, 118 264, 150 264 C 182 264, 220 232, 224 182 C 216 208, 192 212, 174 206 C 164 202, 136 202, 126 206 C 108 212, 84 208, 76 182 Z',
    },
    {
        id: 'goatee',
        name: 'Цапина й вуса',
        opacity: 0.9,
        path: 'M 124 209 C 136 203, 145 203, 150 206 C 155 203, 164 203, 176 209 C 164 212, 156 210, 150 210 C 144 210, 136 212, 124 209 Z M 130 242 C 136 262, 164 262, 170 242 C 162 252, 138 252, 130 242 Z',
    },
    // власний
    {
        id: 'mustache',
        name: 'Вуса',
        opacity: 0.9,
        path: 'M 124 209 C 136 203, 145 203, 150 206 C 155 203, 164 203, 176 209 C 164 212, 156 210, 150 210 C 144 210, 136 212, 124 209 Z',
    },
    {
        id: 'full_beard',
        name: 'Борода',
        opacity: 0.95,
        path: 'M 74 172 C 74 228, 106 268, 150 268 C 194 268, 226 228, 226 172 L 216 172 C 212 204, 192 212, 176 207 C 162 202, 138 202, 124 207 C 108 212, 88 204, 84 172 Z M 126 208 Q 150 202 174 208 Q 178 222 172 232 Q 150 238 128 232 Q 122 222 126 208 Z',
    },
    // власний
    {
        id: 'chin_strap',
        name: 'Шкіпер',
        opacity: 0.9,
        path: 'M 76 176 C 80 228, 116 266, 150 266 C 184 266, 220 228, 224 176 L 218 178 C 214 222, 182 258, 150 258 C 118 258, 86 222, 82 178 Z',
    },
];

export type Accessory = {
    id: string;
    name: string;
    frame?: string;
    stroke?: string;
    strokeWidth?: number;
    lensFill?: string;
};

/** Аксесуари: окуляри з макета + власні (візор, сережки, гарнітура). */
export const ACCESSORIES: Accessory[] = [
    { id: 'none', name: 'Без аксесуарів' },
    {
        id: 'round_wire',
        name: 'Круглі окуляри',
        frame: 'M 58 154 A 34 34 0 1 0 126 154 A 34 34 0 1 0 58 154 Z M 174 154 A 34 34 0 1 0 242 154 A 34 34 0 1 0 174 154 Z M 126 150 Q 150 144 174 150',
        stroke: '#D4AF37',
        strokeWidth: 2.5,
        lensFill: 'rgba(255,255,255,0.08)',
    },
    {
        id: 'rect_smart',
        name: 'Прямокутні',
        frame: 'M 54 136 L 130 138 L 126 172 L 58 170 Z M 170 138 L 246 136 L 242 170 L 174 172 Z M 130 144 L 170 144',
        stroke: '#1E293B',
        strokeWidth: 4,
        lensFill: 'rgba(56,189,248,0.08)',
    },
    {
        id: 'shades_dark',
        name: 'Темні окуляри',
        frame: 'M 50 134 L 134 138 L 126 176 C 105 180, 65 178, 54 166 Z M 166 138 L 250 134 L 246 166 C 235 178, 195 180, 174 176 Z M 132 140 L 168 140',
        stroke: '#09090B',
        strokeWidth: 4.5,
        lensFill: 'rgba(9,9,11,0.82)',
    },
    { id: 'cyber_visor', name: 'Кібер-візор' },
    { id: 'gold_hoops', name: 'Сережки-кільця' },
    { id: 'cross_studs', name: 'Сережки-хрестики' },
    { id: 'headset', name: 'Гарнітура' },
];

export type OutfitPreset = {
    id: string;
    name: string;
    /** Тіло й плечі — найнижчий шар, до нижнього краю (y=320). */
    body: string;
    /** Комір / капюшон — поверх шиї, шия «заходить» в одяг. */
    hoodCollar: string;
    strings: string;
    hasHood: boolean;
};

export const OUTFIT_PRESETS: OutfitPreset[] = [
    {
        id: 'hoodie',
        name: 'Худі',
        body: 'M 32 320 C 40 260, 84 245, 150 245 C 216 245, 260 260, 268 320 Z',
        hoodCollar:
            'M 78 244 C 70 270, 78 302, 122 312 L 150 316 L 178 312 C 222 302, 230 270, 222 244 C 204 268, 180 278, 150 278 C 120 278, 96 268, 78 244 Z',
        strings: 'M 132 290 L 130 319 M 168 290 L 170 319',
        hasHood: true,
    },
    {
        id: 'tshirt',
        name: 'Футболка',
        body: 'M 36 320 C 44 262, 88 248, 150 248 C 212 248, 256 262, 264 320 Z',
        hoodCollar:
            'M 98 248 C 114 284, 186 284, 202 248 C 184 272, 116 272, 98 248 Z',
        strings: '',
        hasHood: false,
    },
    {
        id: 'tactical',
        name: 'Тактична',
        body: 'M 32 320 C 38 258, 82 242, 150 242 C 218 242, 262 258, 268 320 Z',
        hoodCollar:
            'M 92 244 C 104 278, 196 278, 208 244 C 190 266, 110 266, 92 244 Z',
        strings: 'M 118 298 L 182 298',
        hasHood: false,
    },
    {
        id: 'suit',
        name: 'Костюм і сорочка',
        body: 'M 30 320 C 36 256, 80 240, 150 240 C 220 240, 264 256, 270 320 Z',
        hoodCollar: 'M 96 242 L 150 290 L 204 242 C 182 270, 118 270, 96 242 Z',
        strings: 'M 150 280 L 150 318',
        hasHood: false,
    },
];

export const OUTFIT_COLORS = [
    '#2A3550',
    '#4F6BFF',
    '#E2475B',
    '#2BB673',
    '#F2A33A',
    '#7C4DFF',
    '#E9EDF2',
    '#1F2430',
    '#F4B6C2',
];

export const BG_COLORS = [
    '#121214',
    '#1D2A44',
    '#4F6BFF',
    '#22D3EE',
    '#A855F7',
    '#F97316',
    '#10B981',
    '#E11D48',
    '#E5E7EB',
];
