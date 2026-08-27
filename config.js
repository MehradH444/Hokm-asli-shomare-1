/**
 * ============================================================
 * HOKM MASTER - Configuration File
 * فایل تنظیمات اصلی پروژه
 * ============================================================
 * 
 * این فایل شامل تمام تنظیمات ثابت پروژه است که در سایر
 * فایل‌ها مورد استفاده قرار می‌گیرد.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * ============================================================
 */

const CONFIG = Object.freeze({

    // ============================================================
    // 1. اطلاعات اپلیکیشن
    // ============================================================
    APP: Object.freeze({
        NAME: 'حکم مستر',
        NAME_EN: 'Hokm Master',
        VERSION: '1.0.0',
        BUILD: 2011,
        DESCRIPTION: 'بازی کلاسیک کارت ایرانی',
        AUTHOR: 'Hokm Team',
        WEBSITE: 'https://hokm-master.ir',
        SUPPORT_EMAIL: 'support@hokm-master.ir',
        MIN_APP_VERSION: '1.0.0',
        STORE_URL: 'https://myket.ir/app/hokm-master',
        PRIVACY_URL: 'https://hokm-master.ir/privacy',
        TERMS_URL: 'https://hokm-master.ir/terms',
        HELP_URL: 'https://hokm-master.ir/help',
        REPORT_URL: 'https://hokm-master.ir/report'
    }),

    // ============================================================
    // 2. تنظیمات API و شبکه
    // ============================================================
    API: Object.freeze({
        BASE_URL: 'https://api.hokm-master.ir/v1',
        WS_URL: 'wss://ws.hokm-master.ir',
        TIMEOUT: 15000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        KEEP_ALIVE_INTERVAL: 30000,
        MAX_RECONNECT_ATTEMPTS: 10,
        RECONNECT_DELAY: 2000,
        RECONNECT_BACKOFF: 1.5,
        MAX_RECONNECT_DELAY: 30000,
        PING_INTERVAL: 25000,
        PONG_TIMEOUT: 10000
    }),

    // ============================================================
    // 3. تنظیمات احراز هویت
    // ============================================================
    AUTH: Object.freeze({
        OTP: Object.freeze({
            LENGTH: 6,
            EXPIRY_SECONDS: 600,
            EXPIRY_MS: 600000,
            RESEND_COOLDOWN_SECONDS: 60,
            RESEND_COOLDOWN_MS: 60000,
            MAX_ATTEMPTS: 5,
            MAX_ATTEMPTS_WINDOW_MS: 300000,
            LOCKOUT_DURATION_MS: 900000
        }),
        SESSION: Object.freeze({
            EXPIRY_DAYS: 30,
            EXPIRY_MS: 2592000000,
            REFRESH_THRESHOLD_MS: 86400000,
            TOKEN_PREFIX: 'hokm_sess_',
            MAX_DEVICES: 3
        }),
        GUEST: Object.freeze({
            PREFIX: 'guest_',
            EXPIRY_DAYS: 7,
            EXPIRY_MS: 604800000,
            MAX_GUEST_GAMES: 10,
            CONVERSION_BONUS_COINS: 500,
            CONVERSION_BONUS_XP: 100
        }),
        PASSWORD: Object.freeze({
            MIN_LENGTH: 8,
            MAX_LENGTH: 128,
            REQUIRE_UPPERCASE: true,
            REQUIRE_LOWERCASE: true,
            REQUIRE_NUMBER: true,
            REQUIRE_SPECIAL: false
        }),
        USERNAME: Object.freeze({
            MIN_LENGTH: 3,
            MAX_LENGTH: 30,
            PATTERN: /^[a-zA-Z0-9_\u0600-\u06FF]+$/,
            RESERVED: ['admin', 'system', 'support', 'hokm', 'master']
        })
    }),

    // ============================================================
    // 4. تنظیمات شماره تلفن
    // ============================================================
    PHONE: Object.freeze({
        COUNTRY_CODE: '+98',
        COUNTRY_CODE_NUM: 98,
        MIN_LENGTH: 10,
        MAX_LENGTH: 11,
        PATTERN: /^09\d{9}$/,
        INTERNATIONAL_PATTERN: /^\+989\d{9}$/,
        OPERATORS: Object.freeze({
            '0910': 'همراه اول',
            '0911': 'همراه اول',
            '0912': 'همراه اول',
            '0913': 'همراه اول',
            '0914': 'همراه اول',
            '0915': 'همراه اول',
            '0916': 'همراه اول',
            '0917': 'همراه اول',
            '0918': 'همراه اول',
            '0919': 'همراه اول',
            '0901': 'همراه اول',
            '0902': 'همراه اول',
            '0903': 'همراه اول',
            '0930': 'ایرانسل',
            '0933': 'ایرانسل',
            '0935': 'ایرانسل',
            '0936': 'ایرانسل',
            '0937': 'ایرانسل',
            '0938': 'ایرانسل',
            '0939': 'ایرانسل',
            '0900': 'ایرانسل',
            '0920': 'رایتل',
            '0921': 'رایتل',
            '0922': 'رایتل'
        })
    }),

    // ============================================================
    // 5. کلیدهای ذخیره‌سازی
    // ============================================================
    STORAGE_KEYS: Object.freeze({
        USER: 'hokm_user',
        SESSION: 'hokm_session',
        TOKEN: 'hokm_token',
        REFRESH_TOKEN: 'hokm_refresh_token',
        PROFILE: 'hokm_profile',
        SETTINGS: 'hokm_settings',
        PREFERENCES: 'hokm_preferences',
        CURRENCY: 'hokm_currency',
        INVENTORY: 'hokm_inventory',
        EQUIPMENT: 'hokm_equipment',
        MISSIONS: 'hokm_missions',
        ACHIEVEMENTS: 'hokm_achievements',
        FRIENDS: 'hokm_friends',
        BLOCKED: 'hokm_blocked',
        CHAT: 'hokm_chat',
        NOTIFICATIONS: 'hokm_notifications',
        MATCH_HISTORY: 'hokm_match_history',
        STATISTICS: 'hokm_statistics',
        LEAGUE: 'hokm_league',
        SEASON: 'hokm_season',
        TOURNAMENT: 'hokm_tournament',
        EVENTS: 'hokm_events',
        DAILY_REWARD: 'hokm_daily_reward',
        TUTORIAL: 'hokm_tutorial',
        ONBOARDING: 'hokm_onboarding',
        LAST_LOGIN: 'hokm_last_login',
        APP_STATE: 'hokm_app_state',
        CACHE: 'hokm_cache',
        TEMP: 'hokm_temp',
        TEMP_OTP: 'hokm_temp_otp',
        ANALYTICS: 'hokm_analytics',
        AUDIO: 'hokm_audio',
        GRAPHICS: 'hokm_graphics'
    }),

    // ============================================================
    // 6. تنظیمات رابط کاربری
    // ============================================================
    UI: Object.freeze({
        TOAST: Object.freeze({
            DURATION: 3000,
            MAX_VISIBLE: 3,
            ANIMATION_DURATION: 300
        }),
        ANIMATION: Object.freeze({
            DEFAULT_DURATION: 300,
            FAST_DURATION: 150,
            SLOW_DURATION: 500,
            ENABLED_BY_DEFAULT: true,
            REDUCED_MOTION_THRESHOLD: 100
        }),
        MODAL: Object.freeze({
            CLOSE_ON_BACKDROP: true,
            CLOSE_ON_ESCAPE: true,
            ANIMATION_DURATION: 250
        }),
        NAVIGATION: Object.freeze({
            TRANSITION_DURATION: 300,
            ENABLE_SWIPE_BACK: true,
            MAX_HISTORY: 50
        }),
        SCROLL: Object.freeze({
            BEHAVIOR: 'smooth',
            THROTTLE_MS: 16
        }),
        LOADING: Object.freeze({
            MIN_DURATION: 500,
            MAX_DURATION: 30000,
            SPINNER_SIZE: 40
        }),
        MAX_CONTENT_WIDTH: 600,
        HEADER_HEIGHT: 70,
        BOTTOM_NAV_HEIGHT: 75,
        SAFE_AREA_PADDING: 20
    }),

    // ============================================================
    // 7. تنظیمات بازی حکم
    // ============================================================
    GAME: Object.freeze({
        PLAYERS: Object.freeze({
            MIN: 2,
            MAX: 4,
            DEFAULT: 4,
            TEAMS: 2,
            PLAYERS_PER_TEAM: 2
        }),
        CARDS: Object.freeze({
            TOTAL: 52,
            PER_PLAYER: 13,
            SUITS: Object.freeze({
                SPADES: 'spades',
                HEARTS: 'hearts',
                DIAMONDS: 'diamonds',
                CLUBS: 'clubs'
            }),
            SUIT_SYMBOLS: Object.freeze({
                spades: '♠',
                hearts: '♥',
                diamonds: '♦',
                clubs: '♣'
            }),
            SUIT_COLORS: Object.freeze({
                spades: '#000000',
                hearts: '#dc2626',
                diamonds: '#dc2626',
                clubs: '#000000'
            }),
            RANKS: Object.freeze([
                '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
            ]),
            RANK_VALUES: Object.freeze({
                '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
                '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
            }),
            TRUMP_RANK_VALUES: Object.freeze({
                '2': 15, '3': 16, '4': 17, '5': 18, '6': 19, '7': 20,
                '8': 21, '9': 22, '10': 23, 'J': 24, 'Q': 25, 'K': 26, 'A': 27
            }),
            SHUFFLE_ALGORITHM: 'fisher-yates',
            DEAL_ANIMATION_DURATION: 1500
        }),
        SCORING: Object.freeze({
            WINNING_SCORE: 7,
            KOT_THRESHOLD: 7,
            KOT_BONUS: 1,
            TRICK_VALUE: 1,
            ROUND_BONUS: 0,
            MATCH_BONUS: 0,
            FIRST_TO_WIN_ROUNDS: 2
        }),
        TIMER: Object.freeze({
            TURN_SECONDS: 30,
            TURN_WARNING_SECONDS: 10,
            READY_SECONDS: 60,
            RECONNECT_WINDOW_SECONDS: 300,
            AFK_KICK_SECONDS: 120,
            MATCH_TIMEOUT_SECONDS: 1800
        }),
        RULES: Object.freeze({
            MUST_FOLLOW_SUIT: true,
            TRUMP_BEATS_ALL: true,
            HAKEM_CHOOSES_TRUMP: true,
            DEALER_ROTATES: true,
            KOT_ALLOWED: true,
            DOUBLE_KOT_ALLOWED: false
        })
    }),

    // ============================================================
    // 8. تنظیمات هوش مصنوعی
    // ============================================================
    AI: Object.freeze({
        LEVELS: Object.freeze({
            BEGINNER: Object.freeze({
                ID: 'beginner',
                NAME: 'مبتدی',
                DIFFICULTY: 1,
                ERROR_RATE: 0.4,
                STRATEGY_DEPTH: 1,
                TRUMP_USAGE: 0.2,
                PARTNER_AWARENESS: 0.0,
                BLUFF_RATE: 0.0
            }),
            EASY: Object.freeze({
                ID: 'easy',
                NAME: 'آسان',
                DIFFICULTY: 2,
                ERROR_RATE: 0.25,
                STRATEGY_DEPTH: 1,
                TRUMP_USAGE: 0.4,
                PARTNER_AWARENESS: 0.1,
                BLUFF_RATE: 0.05
            }),
            NORMAL: Object.freeze({
                ID: 'normal',
                NAME: 'معمولی',
                DIFFICULTY: 3,
                ERROR_RATE: 0.15,
                STRATEGY_DEPTH: 2,
                TRUMP_USAGE: 0.6,
                PARTNER_AWARENESS: 0.3,
                BLUFF_RATE: 0.1
            }),
            HARD: Object.freeze({
                ID: 'hard',
                NAME: 'سخت',
                DIFFICULTY: 4,
                ERROR_RATE: 0.08,
                STRATEGY_DEPTH: 3,
                TRUMP_USAGE: 0.75,
                PARTNER_AWARENESS: 0.5,
                BLUFF_RATE: 0.15
            }),
            EXPERT: Object.freeze({
                ID: 'expert',
                NAME: 'حرفه‌ای',
                DIFFICULTY: 5,
                ERROR_RATE: 0.03,
                STRATEGY_DEPTH: 4,
                TRUMP_USAGE: 0.85,
                PARTNER_AWARENESS: 0.7,
                BLUFF_RATE: 0.2
            }),
            MASTER: Object.freeze({
                ID: 'master',
                NAME: 'استاد',
                DIFFICULTY: 6,
                ERROR_RATE: 0.01,
                STRATEGY_DEPTH: 5,
                TRUMP_USAGE: 0.95,
                PARTNER_AWARENESS: 0.9,
                BLUFF_RATE: 0.25
            })
        }),
        DEFAULT_LEVEL: 'normal',
        THINKING_DELAY_MS: 800,
        THINKING_DELAY_VARIANCE_MS: 400
    }),

    // ============================================================
    // 9. تنظیمات ارز و اقتصاد
    // ============================================================
    CURRENCY: Object.freeze({
        COINS: Object.freeze({
            ID: 'coins',
            NAME: 'سکه',
            SYMBOL: '🪙',
            INITIAL_AMOUNT: 1000,
            MIN_AMOUNT: 0,
            MAX_AMOUNT: 999999999,
            ICON: '$'
        }),
        GEMS: Object.freeze({
            ID: 'gems',
            NAME: 'الماس',
            SYMBOL: '💎',
            INITIAL_AMOUNT: 0,
            MIN_AMOUNT: 0,
            MAX_AMOUNT: 99999999,
            ICON: '💎'
        }),
        TICKETS: Object.freeze({
            ID: 'tickets',
            NAME: 'بلیت',
            SYMBOL: '🎫',
            INITIAL_AMOUNT: 0,
            MIN_AMOUNT: 0,
            MAX_AMOUNT: 99999,
            ICON: '🎟'
        }),
        EVENT_TOKENS: Object.freeze({
            ID: 'event_tokens',
            NAME: 'توکن رویداد',
            SYMBOL: '🎁',
            INITIAL_AMOUNT: 0,
            MIN_AMOUNT: 0,
            MAX_AMOUNT: 999999,
            ICON: '🎯'
        }),
        TRANSACTION_LIMITS: Object.freeze({
            MIN_TRANSFER: 100,
            MAX_TRANSFER: 100000,
            DAILY_TRANSFER_LIMIT: 1000000,
            MAX_TRANSACTIONS_PER_MINUTE: 10
        })
    }),

    // ============================================================
    // 10. تنظیمات لیگ
    // ============================================================
    LEAGUE: Object.freeze({
        TIERS: Object.freeze([
            Object.freeze({
                ID: 'bronze',
                NAME: 'برنز',
                ICON: '🥉',
                COLOR: '#cd7f32',
                MIN_RATING: 0,
                MAX_RATING: 999,
                PROMOTION_RATING: 1000,
                DEMOTION_RATING: 0,
                REWARDS: Object.freeze({ COINS: 500, XP: 50 })
            }),
            Object.freeze({
                ID: 'silver',
                NAME: 'نقره',
                ICON: '🥈',
                COLOR: '#c0c0c0',
                MIN_RATING: 1000,
                MAX_RATING: 1499,
                PROMOTION_RATING: 1500,
                DEMOTION_RATING: 800,
                REWARDS: Object.freeze({ COINS: 1000, XP: 100, FRAME_ID: 2 })
            }),
            Object.freeze({
                ID: 'gold',
                NAME: 'طلا',
                ICON: '',
                COLOR: '#ffd700',
                MIN_RATING: 1500,
                MAX_RATING: 1999,
                PROMOTION_RATING: 2000,
                DEMOTION_RATING: 1200,
                REWARDS: Object.freeze({ COINS: 2000, XP: 200, FRAME_ID: 3 })
            }),
            Object.freeze({
                ID: 'platinum',
                NAME: 'پلاتین',
                ICON: '💠',
                COLOR: '#e5e4e2',
                MIN_RATING: 2000,
                MAX_RATING: 2499,
                PROMOTION_RATING: 2500,
                DEMOTION_RATING: 1700,
                REWARDS: Object.freeze({ COINS: 5000, XP: 500, GEMS: 100, FRAME_ID: 4 })
            }),
            Object.freeze({
                ID: 'diamond',
                NAME: 'الماس',
                ICON: '💎',
                COLOR: '#b9f2ff',
                MIN_RATING: 2500,
                MAX_RATING: 2999,
                PROMOTION_RATING: 3000,
                DEMOTION_RATING: 2200,
                REWARDS: Object.freeze({ COINS: 10000, XP: 1000, GEMS: 250, FRAME_ID: 5 })
            }),
            Object.freeze({
                ID: 'master',
                NAME: 'مستر',
                ICON: '👑',
                COLOR: '#9370db',
                MIN_RATING: 3000,
                MAX_RATING: 99999,
                PROMOTION_RATING: 99999,
                DEMOTION_RATING: 2700,
                REWARDS: Object.freeze({ COINS: 25000, XP: 2500, GEMS: 500, FRAME_ID: 6, TITLE_ID: 1 })
            })
        ]),
        DEFAULT_TIER: 'bronze',
        DEFAULT_RATING: 1000,
        RATING_CHANGE: Object.freeze({
            WIN_BASE: 25,
            LOSS_BASE: -15,
            STREAK_BONUS: 5,
            MAX_STREAK_BONUS: 25,
            KOT_BONUS: 10,
            UPSET_BONUS: 15
        }),
        SEASON: Object.freeze({
            DURATION_DAYS: 30,
            DURATION_MS: 2592000000,
            RESET_GRACE_PERIOD_DAYS: 7,
            REWARDS_DISTRIBUTION_DELAY_MS: 86400000
        })
    }),

    // ============================================================
    // 11. تنظیمات تورنمنت
    // ============================================================
    TOURNAMENT: Object.freeze({
        TYPES: Object.freeze({
            KNOCKOUT: 'knockout',
            SWISS: 'swiss',
            ROUND_ROBIN: 'round_robin',
            GROUP_STAGE: 'group_stage'
        }),
        SIZES: Object.freeze([8, 16, 32, 64, 128]),
        DEFAULT_SIZE: 16,
        REGISTRATION: Object.freeze({
            MIN_PLAYERS: 8,
            MAX_PLAYERS: 128,
            EARLY_BIRD_BONUS: 100,
            CANCELLATION_REFUND_PERCENT: 50,
            CANCELLATION_DEADLINE_HOURS: 24
        }),
        MATCH: Object.freeze({
            BEST_OF: 1,
            TIME_LIMIT_SECONDS: 600
        }),
        REWARDS: Object.freeze({
            1: Object.freeze({ COINS: 10000, GEMS: 500, TITLE_ID: 10 }),
            2: Object.freeze({ COINS: 5000, GEMS: 250 }),
            3: Object.freeze({ COINS: 2500, GEMS: 100 }),
            4: Object.freeze({ COINS: 1000, GEMS: 50 }),
            8: Object.freeze({ COINS: 500 }),
            16: Object.freeze({ COINS: 250 })
        })
    }),

    // ============================================================
    // 12. تنظیمات مأموریت‌ها
    // ============================================================
    MISSIONS: Object.freeze({
        DAILY: Object.freeze({
            RESET_HOUR: 0,
            RESET_MINUTE: 0,
            MAX_ACTIVE: 5,
            REFRESH_COUNT: 3,
            REFRESH_COST_COINS: 100
        }),
        WEEKLY: Object.freeze({
            RESET_DAY: 1,
            RESET_HOUR: 0,
            MAX_ACTIVE: 7,
            REFRESH_COUNT: 2,
            REFRESH_COST_COINS: 300
        }),
        MONTHLY: Object.freeze({
            RESET_DAY: 1,
            MAX_ACTIVE: 10
        }),
        TYPES: Object.freeze({
            PLAY_GAMES: 'play_games',
            WIN_GAMES: 'win_games',
            WIN_TRICKS: 'win_tricks',
            EARN_COINS: 'earn_coins',
            PLAY_RANKED: 'play_ranked',
            PLAY_WITH_FRIEND: 'play_with_friend',
            LOGIN: 'login',
            COMPLETE_MISSIONS: 'complete_missions',
            USE_TRUMP: 'use_trump',
            WIN_STREAK: 'win_streak'
        })
    }),

    // ============================================================
    // 13. تنظیمات دستاوردها
    // ============================================================
    ACHIEVEMENTS: Object.freeze({
        CATEGORIES: Object.freeze({
            FIRST_TIME: 'first_time',
            MILESTONES: 'milestones',
            SOCIAL: 'social',
            COMPETITIVE: 'competitive',
            COLLECTION: 'collection',
            SPECIAL: 'special'
        }),
        TOTAL_COUNT: 50,
        REWARD_MULTIPLIER: 1.0
    }),

    // ============================================================
    // 14. تنظیمات جایزه روزانه
    // ============================================================
    DAILY_REWARD: Object.freeze({
        CYCLE_DAYS: 7,
        REWARDS: Object.freeze([
            Object.freeze({ DAY: 1, COINS: 50, XP: 10 }),
            Object.freeze({ DAY: 2, COINS: 100, XP: 20 }),
            Object.freeze({ DAY: 3, COINS: 250, XP: 40 }),
            Object.freeze({ DAY: 4, COINS: 400, XP: 60 }),
            Object.freeze({ DAY: 5, COINS: 600, XP: 80 }),
            Object.freeze({ DAY: 6, COINS: 1000, XP: 100 }),
            Object.freeze({ DAY: 7, COINS: 2000, XP: 200, GEMS: 10 })
        ]),
        STREAK_BONUS: Object.freeze({
            ENABLED: true,
            MULTIPLIER_PER_DAY: 0.1,
            MAX_MULTIPLIER: 2.0
        }),
        MISS_RESET: true,
        CLAIM_WINDOW_HOURS: 24
    }),

    // ============================================================
    // 15. تنظیمات فروشگاه
    // ============================================================
    SHOP: Object.freeze({
        CATEGORIES: Object.freeze({
            FEATURED: 'featured',
            CARDS: 'cards',
            CARD_BACKS: 'card_backs',
            TABLES: 'tables',
            AVATARS: 'avatars',
            FRAMES: 'frames',
            BADGES: 'badges',
            TITLES: 'titles',
            EMOTES: 'emotes',
            EFFECTS: 'effects',
            BUNDLES: 'bundles',
            VIP: 'vip',
            LIMITED: 'limited',
            EVENT: 'event'
        }),
        RARITY: Object.freeze({
            COMMON: Object.freeze({ ID: 'common', NAME: 'معمولی', COLOR: '#9ca3af', MULTIPLIER: 1.0 }),
            RARE: Object.freeze({ ID: 'rare', NAME: 'کمیاب', COLOR: '#3b82f6', MULTIPLIER: 1.5 }),
            EPIC: Object.freeze({ ID: 'epic', NAME: 'حماسی', COLOR: '#8b5cf6', MULTIPLIER: 2.0 }),
            LEGENDARY: Object.freeze({ ID: 'legendary', NAME: 'افسانه‌ای', COLOR: '#f59e0b', MULTIPLIER: 3.0 }),
            MYTHIC: Object.freeze({ ID: 'mythic', NAME: 'اسطوره‌ای', COLOR: '#ef4444', MULTIPLIER: 5.0 })
        }),
        REFUND: Object.freeze({
            ENABLED: true,
            WINDOW_MINUTES: 5,
            USED_ITEMS_NON_REFUNDABLE: true
        }),
        VIP: Object.freeze({
            PLANS: Object.freeze({
                DAY: Object.freeze({ ID: 'day', DAYS: 1, PRICE_COINS: 1000, BONUS_PERCENT: 10 }),
                WEEK: Object.freeze({ ID: 'week', DAYS: 7, PRICE_COINS: 6000, BONUS_PERCENT: 15 }),
                MONTH: Object.freeze({ ID: 'month', DAYS: 30, PRICE_COINS: 20000, BONUS_PERCENT: 25 })
            }),
            BENEFITS: Object.freeze({
                CHAT_UNLOCK: true,
                NAME_CHANGE: true,
                REWARD_BONUS_PERCENT: 10,
                SHOP_DISCOUNT_PERCENT: 10,
                EXCLUSIVE_ITEMS: true,
                NO_ADS: true
            })
        })
    }),

    // ============================================================
    // 16. تنظیمات دوستان
    // ============================================================
    FRIENDS: Object.freeze({
        MAX_FRIENDS: 100,
        MAX_PENDING_REQUESTS: 20,
        MAX_BLOCKED: 50,
        REQUEST_EXPIRY_HOURS: 72,
        INVITE_COOLDOWN_SECONDS: 300,
        SEARCH_MIN_LENGTH: 3,
        SEARCH_MAX_RESULTS: 20
    }),

    // ============================================================
    // 17. تنظیمات چت
    // ============================================================
    CHAT: Object.freeze({
        MAX_MESSAGE_LENGTH: 250,
        MIN_MESSAGE_LENGTH: 1,
        RATE_LIMIT: Object.freeze({
            MESSAGES_PER_MINUTE: 20,
            MESSAGES_PER_HOUR: 200,
            COOLDOWN_AFTER_SPAM_SECONDS: 60
        }),
        PROFANITY_FILTER: Object.freeze({
            ENABLED: true,
            REPLACE_CHARACTER: '*',
            AUTO_MODERATE: true
        }),
        EMOJI: Object.freeze({
            ENABLED: true,
            MAX_PER_MESSAGE: 10,
            VIP_EXCLUSIVE: true
        }),
        QUICK_MESSAGES: Object.freeze([
            'سلام',
            'خسته نباشید',
            'دستت درد نکنه',
            'ایول!',
            'بازی خوبی بود',
            'دوباره؟',
            'موفق باشی',
            'GG'
        ]),
        RETENTION_DAYS: 30
    }),

    // ============================================================
    // 18. تنظیمات اعلان‌ها
    // ============================================================
    NOTIFICATIONS: Object.freeze({
        TYPES: Object.freeze({
            FRIEND_REQUEST: 'friend_request',
            GAME_INVITE: 'game_invite',
            REWARD: 'reward',
            MISSION: 'mission',
            LEAGUE: 'league',
            TOURNAMENT: 'tournament',
            EVENT: 'event',
            SHOP: 'shop',
            SYSTEM: 'system',
            MAINTENANCE: 'maintenance',
            UPDATE: 'update'
        }),
        MAX_STORED: 100,
        RETENTION_DAYS: 30,
        PUSH: Object.freeze({
            ENABLED: true,
            QUIET_HOURS_START: 23,
            QUIET_HOURS_END: 8,
            MAX_PER_DAY: 10
        })
    }),

    // ============================================================
    // 19. تنظیمات رتبه‌بندی
    // ============================================================
    LEADERBOARD: Object.freeze({
        TYPES: Object.freeze({
            GLOBAL: 'global',
            LEAGUE: 'league',
            FRIENDS: 'friends',
            WEEKLY: 'weekly',
            MONTHLY: 'monthly',
            SEASON: 'season',
            TOURNAMENT: 'tournament',
            EVENT: 'event'
        }),
        PAGE_SIZE: 50,
        UPDATE_INTERVAL_SECONDS: 300,
        CACHE_TTL_SECONDS: 60,
        TOP_PLAYERS_DISPLAY: 100
    }),

    // ============================================================
    // 20. تنظیمات آمار
    // ============================================================
    STATISTICS: Object.freeze({
        TRACK: Object.freeze([
            'total_games',
            'wins',
            'losses',
            'win_rate',
            'tricks_won',
            'kot_count',
            'best_streak',
            'current_streak',
            'total_play_time',
            'average_game_duration',
            'favorite_suit',
            'games_by_mode',
            'games_by_league',
            'coins_earned',
            'coins_spent',
            'xp_earned',
            'missions_completed',
            'achievements_unlocked',
            'tournaments_won',
            'friends_added'
        ]),
        HISTORY_RETENTION_DAYS: 365,
        MAX_MATCH_HISTORY: 100
    }),

    // ============================================================
    // 21. تنظیمات شخصی‌سازی
    // ============================================================
    CUSTOMIZATION: Object.freeze({
        AVATARS: Object.freeze({
            TOTAL: 50,
            DEFAULT_ID: 1,
            CATEGORIES: ['default', 'premium', 'event', 'vip', 'legendary']
        }),
        FRAMES: Object.freeze({
            TOTAL: 20,
            DEFAULT_ID: 1
        }),
        CARD_BACKS: Object.freeze({
            TOTAL: 15,
            DEFAULT_ID: 1
        }),
        TABLES: Object.freeze({
            TOTAL: 8,
            DEFAULT_ID: 1,
            THEMES: ['classic', 'persian', 'royal', 'wood', 'dark', 'seasonal', 'premium']
        }),
        TITLES: Object.freeze({
            TOTAL: 30,
            DEFAULT_ID: 1
        }),
        EMOTES: Object.freeze({
            TOTAL: 25,
            DEFAULT_ID: 1,
            VIP_REQUIRED: true
        }),
        EFFECTS: Object.freeze({
            TOTAL: 10,
            DEFAULT_ID: 1
        })
    }),

    // ============================================================
    // 22. تنظیمات صدا
    // ============================================================
    AUDIO: Object.freeze({
        MUSIC: Object.freeze({
            VOLUME_DEFAULT: 0.5,
            VOLUME_MIN: 0,
            VOLUME_MAX: 1,
            FADE_DURATION: 500,
            PRELOAD: true
        }),
        SFX: Object.freeze({
            VOLUME_DEFAULT: 0.7,
            VOLUME_MIN: 0,
            VOLUME_MAX: 1,
            MAX_CONCURRENT: 5
        }),
        VIBRATION: Object.freeze({
            ENABLED_DEFAULT: true,
            PATTERNS: Object.freeze({
                LIGHT: [10],
                MEDIUM: [20],
                HEAVY: [30],
                SUCCESS: [10, 50, 20],
                ERROR: [30, 50, 30],
                NOTIFICATION: [10, 100, 10]
            })
        }),
        FILES: Object.freeze({
            CARD_PLAY: 'sfx/card_play.mp3',
            CARD_DEAL: 'sfx/card_deal.mp3',
            TRICK_WIN: 'sfx/trick_win.mp3',
            MATCH_WIN: 'sfx/match_win.mp3',
            MATCH_LOSE: 'sfx/match_lose.mp3',
            BUTTON_CLICK: 'sfx/button_click.mp3',
            NOTIFICATION: 'sfx/notification.mp3',
            COIN_EARN: 'sfx/coin_earn.mp3',
            LEVEL_UP: 'sfx/level_up.mp3',
            ACHIEVEMENT: 'sfx/achievement.mp3',
            MUSIC_MENU: 'music/menu.mp3',
            MUSIC_GAME: 'music/game.mp3',
            MUSIC_WIN: 'music/win.mp3'
        })
    }),

    // ============================================================
    // 23. تنظیمات گرافیک
    // ============================================================
    GRAPHICS: Object.freeze({
        QUALITY_LEVELS: Object.freeze({
            LOW: Object.freeze({ ID: 'low', NAME: 'پایین', PARTICLES: false, SHADOWS: false, ANIMATIONS: 'reduced' }),
            MEDIUM: Object.freeze({ ID: 'medium', NAME: 'متوسط', PARTICLES: true, SHADOWS: false, ANIMATIONS: 'normal' }),
            HIGH: Object.freeze({ ID: 'high', NAME: 'بالا', PARTICLES: true, SHADOWS: true, ANIMATIONS: 'full' })
        }),
        DEFAULT_QUALITY: 'medium',
        TARGET_FPS: 60,
        MAX_FPS: 60,
        PARTICLES: Object.freeze({
            MAX_COUNT: 50,
            ENABLED_DEFAULT: true
        }),
        SHADOWS: Object.freeze({
            ENABLED_DEFAULT: false
        })
    }),

    // ============================================================
    // 24. تنظیمات امنیت
    // ============================================================
    SECURITY: Object.freeze({
        RATE_LIMIT: Object.freeze({
            API_REQUESTS_PER_MINUTE: 60,
            LOGIN_ATTEMPTS_PER_HOUR: 10,
            OTP_ATTEMPTS_PER_HOUR: 20,
            PURCHASE_ATTEMPTS_PER_MINUTE: 10
        }),
        ENCRYPTION: Object.freeze({
            ALGORITHM: 'AES-256-GCM',
            KEY_LENGTH: 256,
            IV_LENGTH: 12,
            TAG_LENGTH: 128
        }),
        VALIDATION: Object.freeze({
            SANITIZE_INPUT: true,
            MAX_INPUT_LENGTH: 10000,
            ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
            MAX_FILE_SIZE_BYTES: 2097152
        }),
        SESSION: Object.freeze({
            IP_CHECK: true,
            DEVICE_FINGERPRINT: true,
            CONCURRENT_SESSIONS: 3,
            IDLE_TIMEOUT_MS: 1800000
        })
    }),

    // ============================================================
    // 25. تنظیمات تحلیل و آمار
    // ============================================================
    ANALYTICS: Object.freeze({
        ENABLED: true,
        TRACK: Object.freeze({
            APP_OPEN: true,
            APP_CLOSE: true,
            SCREEN_VIEW: true,
            BUTTON_CLICK: true,
            MATCH_START: true,
            MATCH_END: true,
            PURCHASE: true,
            ERROR: true,
            NETWORK: true
        }),
        BATCH_SIZE: 10,
        FLUSH_INTERVAL_MS: 30000,
        RETENTION_DAYS: 90,
        PRIVACY: Object.freeze({
            ANONYMIZE: true,
            COLLECT_PII: false,
            COLLECT_LOCATION: false
        })
    }),

    // ============================================================
    // 26. تنظیمات حالت آفلاین
    // ============================================================
    OFFLINE: Object.freeze({
        ENABLED: true,
        FEATURES: Object.freeze({
            AI_MATCH: true,
            TUTORIAL: true,
            SETTINGS: true,
            VIEW_PROFILE: true,
            VIEW_HISTORY: true
        }),
        DISABLED_FEATURES: Object.freeze([
            'multiplayer',
            'chat',
            'shop_purchase',
            'leaderboard',
            'tournament'
        ]),
        QUEUE_ACTIONS: true,
        SYNC_ON_RECONNECT: true,
        MAX_OFFLINE_DAYS: 30
    }),

    // ============================================================
    // 27. تنظیمات آموزش
    // ============================================================
    TUTORIAL: Object.freeze({
        ENABLED: true,
        STEPS: Object.freeze([
            Object.freeze({ ID: 'welcome', TITLE: 'خوش آمدید', DURATION: 5000 }),
            Object.freeze({ ID: 'cards', TITLE: 'آشنایی با کارت‌ها', DURATION: 8000 }),
            Object.freeze({ ID: 'rules', TITLE: 'قوانین حکم', DURATION: 10000 }),
            Object.freeze({ ID: 'trump', TITLE: 'انتخاب حکم', DURATION: 7000 }),
            Object.freeze({ ID: 'teams', TITLE: 'تیم‌ها', DURATION: 6000 }),
            Object.freeze({ ID: 'scoring', TITLE: 'امتیازدهی', DURATION: 7000 }),
            Object.freeze({ ID: 'league', TITLE: 'سیستم لیگ', DURATION: 6000 }),
            Object.freeze({ ID: 'rewards', TITLE: 'جوایز', DURATION: 5000 })
        ]),
        SKIP_ALLOWED: true,
        REWATCH_ALLOWED: true,
        REWARD_ON_COMPLETE: Object.freeze({ COINS: 200, XP: 50 })
    }),

    // ============================================================
    // 28. تنظیمات گزارش و پشتیبانی
    // ============================================================
    REPORT: Object.freeze({
        REASONS: Object.freeze([
            'inappropriate_behavior',
            'cheating',
            'spam',
            'harassment',
            'bug',
            'other'
        ]),
        MAX_DESCRIPTION_LENGTH: 500,
        COOLDOWN_HOURS: 24,
        MAX_REPORTS_PER_DAY: 10,
        AUTO_RESPONSE_ENABLED: true
    }),

    // ============================================================
    // 29. تنظیمات اتصال مجدد
    // ============================================================
    RECONNECT: Object.freeze({
        ENABLED: true,
        WINDOW_SECONDS: 300,
        MAX_ATTEMPTS: 5,
        DELAY_MS: 2000,
        BACKOFF_MULTIPLIER: 1.5,
        MAX_DELAY_MS: 30000,
        PRESERVE_GAME_STATE: true,
        NOTIFY_OPPONENTS: true
    }),

    // ============================================================
    // 30. تنظیمات بهینه‌سازی عملکرد
    // ============================================================
    PERFORMANCE: Object.freeze({
        LAZY_LOADING: Object.freeze({
            ENABLED: true,
            THRESHOLD: 200
        }),
        CACHING: Object.freeze({
            ENABLED: true,
            MAX_SIZE_MB: 50,
            TTL_SECONDS: 3600
        }),
        MEMORY: Object.freeze({
            MAX_CACHE_ITEMS: 100,
            GC_INTERVAL_MS: 60000,
            WARNING_THRESHOLD_MB: 100
        }),
        NETWORK: Object.freeze({
            COMPRESSION: true,
            MINIMIZE_PAYLOAD: true,
            BATCH_REQUESTS: true
        })
    }),

    // ============================================================
    // 31. تنظیمات دسترس‌پذیری
    // ============================================================
    ACCESSIBILITY: Object.freeze({
        FONT_SCALE_OPTIONS: Object.freeze([0.8, 0.9, 1.0, 1.1, 1.2, 1.3]),
        DEFAULT_FONT_SCALE: 1.0,
        HIGH_CONTRAST: Object.freeze({
            ENABLED: false,
            CONTRAST_RATIO: 7.0
        }),
        REDUCED_MOTION: Object.freeze({
            ENABLED: false,
            RESPECT_SYSTEM_PREFERENCE: true
        }),
        HAPTIC_FEEDBACK: Object.freeze({
            ENABLED: true,
            INTENSITY: 'medium'
        }),
        SCREEN_READER: Object.freeze({
            ENABLED: true,
            ANNOUNCE_CHANGES: true
        })
    }),

    // ============================================================
    // 32. تنظیمات زبان
    // ============================================================
    LANGUAGE: Object.freeze({
        DEFAULT: 'fa',
        SUPPORTED: Object.freeze([
            Object.freeze({ CODE: 'fa', NAME: 'فارسی', NAME_EN: 'Persian', RTL: true, FLAG: '🇮' }),
            Object.freeze({ CODE: 'en', NAME: 'English', NAME_EN: 'English', RTL: false, FLAG: '🇬' })
        ]),
        FALLBACK: 'fa'
    }),

    // ============================================================
    // 33. تنظیمات حالت توسعه
    // ============================================================
    DEBUG: Object.freeze({
        ENABLED: false,
        LOG_LEVEL: 'info',
        SHOW_FPS: false,
        SHOW_MEMORY: false,
        MOCK_API: false,
        MOCK_AI: false,
        SKIP_AUTH: false,
        DEV_TOOLS: false,
        CHEAT_CODES: false
    }),

    // ============================================================
    // 34. تنظیمات نگهداری
    // ============================================================
    MAINTENANCE: Object.freeze({
        ENABLED: false,
        MESSAGE: 'بازی در حال به‌روزرسانی است. لطفاً بعداً مراجعه کنید.',
        ESTIMATED_DURATION_MINUTES: 30,
        ALLOW_PREMIUM_USERS: false
    }),

    // ============================================================
    // 35. تنظیمات به‌روزرسانی
    // ============================================================
    UPDATE: Object.freeze({
        CHECK_INTERVAL_MS: 3600000,
        FORCE_UPDATE_BELOW_VERSION: '0.9.0',
        UPDATE_URL: 'https://myket.ir/app/hokm-master',
        SHOW_RELEASE_NOTES: true
    })

});

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}

console.log('✅ CONFIG loaded - Version:', CONFIG.APP.VERSION);
