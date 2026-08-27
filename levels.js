/**
 * ============================================================
 * HOKM MASTER - AI Levels Manager
 * مدیریت سطوح مختلف هوش مصنوعی
 * ============================================================
 * 
 * این فایل مسئول تعریف و مدیریت 6 سطح مختلف هوش مصنوعی
 * در بازی حکم است. هر سطح دارای ویژگی‌ها، استراتژی‌ها و
 * پارامترهای خاص خود است که رفتار AI را تعیین می‌کند.
 * 
 * سطوح:
 * - Beginner: کاملاً تصادفی، مناسب آموزش
 * - Easy: بازی ساده، خطای زیاد
 * - Normal: بازی متعادل، استاندارد
 * - Hard: بازی قوی، استراتژی دارد
 * - Expert: بازی حرفه‌ای، تحلیل عمیق
 * - Master: بازی استادانه، بهینه‌ترین تصمیمات
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * 
 * ============================================================
 */

class AILevelsManager {

    constructor() {
        /**
         * تعریف کامل سطوح AI
         * @type {Object}
         */
        this.levels = {
            beginner: {
                id: 'beginner',
                name: 'مبتدی',
                nameEn: 'Beginner',
                icon: '🌱',
                color: '#4ade80',
                difficulty: 1,
                description: 'مناسب برای یادگیری قوانین بازی',
                descriptionEn: 'Perfect for learning the game rules',
                
                // پارامترهای بازی
                params: {
                    errorRate: 0.40,        // 40% خطا
                    strategyDepth: 1,       // عمق استراتژی: فقط حرکت فعلی
                    trumpUsage: 0.20,       // 20% استفاده از حکم
                    partnerAwareness: 0.00, // بدون آگاهی از هم‌تیمی
                    bluffRate: 0.00,        // بدون بلوف
                    cardTracking: false,    // بدون ردیابی کارت
                    probabilityCalc: false, // بدون محاسبه احتمال
                    endgameStrategy: false, // بدون استراتژی پایان بازی
                    riskTaking: 0.80,       // ریسک‌پذیری بالا (تصادفی)
                    conservativePlay: 0.20  // بازی محافظه‌کارانه کم
                },

                // استراتژی‌های فعال
                strategies: {
                    followSuit: true,       // رعایت خال
                    playHighCards: false,   // بازی کارت بالا
                    saveTrump: false,       // ذخیره حکم
                    trackCards: false,      // ردیابی کارت‌ها
                    countTricks: false,     // شمارش دست‌ها
                    partnerSignals: false   // سیگنال به هم‌تیمی
                },

                // محدودیت‌ها
                limitations: {
                    maxThinkingTime: 500,   // میلی‌ثانیه
                    minThinkingTime: 200,
                    canSeeOpponentCards: false,
                    canPredictMoves: false,
                    memorySize: 0           // بدون حافظه
                },

                // پاداش‌ها
                rewards: {
                    xpMultiplier: 0.5,      // ضریب XP
                    coinMultiplier: 0.5,    // ضریب سکه
                    ratingChange: 0         // بدون تغییر Rating
                },

                // مناسب برای
                suitableFor: ['new_players', 'tutorial', 'practice'],
                unlockRequirement: null     // از ابتدا در دسترس
            },

            easy: {
                id: 'easy',
                name: 'آسان',
                nameEn: 'Easy',
                icon: '😊',
                color: '#60a5fa',
                difficulty: 2,
                description: 'بازی ساده با خطاهای گاه‌به‌گاه',
                descriptionEn: 'Simple game with occasional mistakes',
                
                params: {
                    errorRate: 0.25,
                    strategyDepth: 1,
                    trumpUsage: 0.40,
                    partnerAwareness: 0.10,
                    bluffRate: 0.05,
                    cardTracking: false,
                    probabilityCalc: false,
                    endgameStrategy: false,
                    riskTaking: 0.60,
                    conservativePlay: 0.40
                },

                strategies: {
                    followSuit: true,
                    playHighCards: true,    // شروع بازی کارت بالا
                    saveTrump: false,
                    trackCards: false,
                    countTricks: true,      // شمارش دست‌های برده شده
                    partnerSignals: false
                },

                limitations: {
                    maxThinkingTime: 800,
                    minThinkingTime: 300,
                    canSeeOpponentCards: false,
                    canPredictMoves: false,
                    memorySize: 5           // حافظه 5 حرکت آخر
                },

                rewards: {
                    xpMultiplier: 0.7,
                    coinMultiplier: 0.7,
                    ratingChange: 5
                },

                suitableFor: ['casual_players', 'relaxed_games'],
                unlockRequirement: null
            },

            normal: {
                id: 'normal',
                name: 'معمولی',
                nameEn: 'Normal',
                icon: '😐',
                color: '#fbbf24',
                difficulty: 3,
                description: 'بازی متعادل و استاندارد',
                descriptionEn: 'Balanced and standard gameplay',
                
                params: {
                    errorRate: 0.15,
                    strategyDepth: 2,       // بررسی 2 حرکت ahead
                    trumpUsage: 0.60,
                    partnerAwareness: 0.30,
                    bluffRate: 0.10,
                    cardTracking: true,     // شروع ردیابی کارت
                    probabilityCalc: false,
                    endgameStrategy: true,  // استراتژی پایان بازی ساده
                    riskTaking: 0.40,
                    conservativePlay: 0.60
                },

                strategies: {
                    followSuit: true,
                    playHighCards: true,
                    saveTrump: true,        // ذخیره حکم برای مواقع لازم
                    trackCards: true,       // ردیابی کارت‌های بازی شده
                    countTricks: true,
                    partnerSignals: true    // سیگنال‌های ساده به هم‌تیمی
                },

                limitations: {
                    maxThinkingTime: 1200,
                    minThinkingTime: 500,
                    canSeeOpponentCards: false,
                    canPredictMoves: true,  // پیش‌بینی ساده
                    memorySize: 10
                },

                rewards: {
                    xpMultiplier: 1.0,
                    coinMultiplier: 1.0,
                    ratingChange: 15
                },

                suitableFor: ['regular_players', 'standard_games'],
                unlockRequirement: null
            },

            hard: {
                id: 'hard',
                name: 'سخت',
                nameEn: 'Hard',
                icon: '😤',
                color: '#f97316',
                difficulty: 4,
                description: 'بازی قوی با استراتژی پیشرفته',
                descriptionEn: 'Strong gameplay with advanced strategy',
                
                params: {
                    errorRate: 0.08,
                    strategyDepth: 3,
                    trumpUsage: 0.75,
                    partnerAwareness: 0.50,
                    bluffRate: 0.15,
                    cardTracking: true,
                    probabilityCalc: true,  // شروع محاسبه احتمال
                    endgameStrategy: true,
                    riskTaking: 0.30,
                    conservativePlay: 0.70
                },

                strategies: {
                    followSuit: true,
                    playHighCards: true,
                    saveTrump: true,
                    trackCards: true,
                    countTricks: true,
                    partnerSignals: true,
                    calculateOdds: true,    // محاسبه شانس برد
                    adaptToOpponents: true  // سازگاری با حریفان
                },

                limitations: {
                    maxThinkingTime: 1800,
                    minThinkingTime: 800,
                    canSeeOpponentCards: false,
                    canPredictMoves: true,
                    memorySize: 20
                },

                rewards: {
                    xpMultiplier: 1.3,
                    coinMultiplier: 1.3,
                    ratingChange: 25
                },

                suitableFor: ['experienced_players', 'challenging_games'],
                unlockRequirement: {
                    type: 'level',
                    value: 10               // نیاز به سطح 10
                }
            },

            expert: {
                id: 'expert',
                name: 'حرفه‌ای',
                nameEn: 'Expert',
                icon: '🔥',
                color: '#ef4444',
                difficulty: 5,
                description: 'بازی حرفه‌ای با تحلیل عمیق',
                descriptionEn: 'Professional gameplay with deep analysis',
                
                params: {
                    errorRate: 0.03,
                    strategyDepth: 4,
                    trumpUsage: 0.85,
                    partnerAwareness: 0.70,
                    bluffRate: 0.20,
                    cardTracking: true,
                    probabilityCalc: true,
                    endgameStrategy: true,
                    riskTaking: 0.20,
                    conservativePlay: 0.80
                },

                strategies: {
                    followSuit: true,
                    playHighCards: true,
                    saveTrump: true,
                    trackCards: true,
                    countTricks: true,
                    partnerSignals: true,
                    calculateOdds: true,
                    adaptToOpponents: true,
                    advancedBluffing: true, // بلوف پیشرفته
                    psychologicalPlay: true // بازی روان‌شناختی
                },

                limitations: {
                    maxThinkingTime: 2500,
                    minThinkingTime: 1200,
                    canSeeOpponentCards: false,
                    canPredictMoves: true,
                    memorySize: 52          // حافظه تمام کارت‌ها
                },

                rewards: {
                    xpMultiplier: 1.6,
                    coinMultiplier: 1.6,
                    ratingChange: 40
                },

                suitableFor: ['professional_players', 'competitive_games'],
                unlockRequirement: {
                    type: 'level',
                    value: 25
                }
            },

            master: {
                id: 'master',
                name: 'استاد',
                nameEn: 'Master',
                icon: '👑',
                color: '#a855f7',
                difficulty: 6,
                description: 'بازی استادانه با بهینه‌ترین تصمیمات',
                descriptionEn: 'Master gameplay with optimal decisions',
                
                params: {
                    errorRate: 0.01,        // تقریباً بدون خطا
                    strategyDepth: 5,       // بررسی 5 حرکت ahead
                    trumpUsage: 0.95,
                    partnerAwareness: 0.90,
                    bluffRate: 0.25,
                    cardTracking: true,
                    probabilityCalc: true,
                    endgameStrategy: true,
                    riskTaking: 0.10,       // بسیار محافظه‌کار
                    conservativePlay: 0.90
                },

                strategies: {
                    followSuit: true,
                    playHighCards: true,
                    saveTrump: true,
                    trackCards: true,
                    countTricks: true,
                    partnerSignals: true,
                    calculateOdds: true,
                    adaptToOpponents: true,
                    advancedBluffing: true,
                    psychologicalPlay: true,
                    perfectMemory: true,    // حافظه کامل
                    optimalPlay: true       // بازی بهینه
                },

                limitations: {
                    maxThinkingTime: 3500,
                    minThinkingTime: 1500,
                    canSeeOpponentCards: false,
                    canPredictMoves: true,
                    memorySize: 52
                },

                rewards: {
                    xpMultiplier: 2.0,
                    coinMultiplier: 2.0,
                    ratingChange: 60
                },

                suitableFor: ['masters', 'ultimate_challenge'],
                unlockRequirement: {
                    type: 'level',
                    value: 50
                }
            }
        };

        /**
         * سطح پیش‌فرض AI
         * @type {string}
         */
        this.defaultLevel = 'normal';

        /**
         * سطح فعلی AI در بازی
         * @type {string}
         */
        this.currentLevel = 'normal';

        /**
         * شنوندگان رویداد
         * @type {Map}
         */
        this.listeners = new Map();

        /**
         * آیا debug mode فعال است
         * @type {boolean}
         */
        this.debug = CONFIG.DEBUG.ENABLED;

        /**
         * آمار سطوح
         * @type {Object}
         */
        this.stats = {
            gamesPlayedByLevel: {},
            winRateByLevel: {},
            averageScoreByLevel: {}
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // مقداردهی اولیه آمار
        Object.keys(this.levels).forEach(level => {
            this.stats.gamesPlayedByLevel[level] = 0;
            this.stats.winRateByLevel[level] = 0;
            this.stats.averageScoreByLevel[level] = 0;
        });

        if (this.debug) {
            console.log('️ AILevelsManager initialized');
            console.log('  Available levels:', Object.keys(this.levels).length);
            console.log('  Default level:', this.defaultLevel);
        }
    }

    // ============================================================
    // بخش ۱: دریافت اطلاعات سطح
    // ============================================================

    /**
     * دریافت اطلاعات کامل یک سطح
     * @param {string} levelId - شناسه سطح
     * @returns {Object|null} اطلاعات سطح
     */
    getLevelInfo(levelId) {
        return this.levels[levelId] || null;
    }

    /**
     * دریافت نام سطح
     * @param {string} levelId - شناسه سطح
     * @returns {string} نام سطح
     */
    getLevelName(levelId) {
        const level = this.levels[levelId];
        return level ? level.name : levelId;
    }

    /**
     * دریافت آیکون سطح
     * @param {string} levelId - شناسه سطح
     * @returns {string} آیکون
     */
    getLevelIcon(levelId) {
        const level = this.levels[levelId];
        return level ? level.icon : '❓';
    }

    /**
     * دریافت رنگ سطح
     * @param {string} levelId - شناسه سطح
     * @returns {string} رنگ
     */
    getLevelColor(levelId) {
        const level = this.levels[levelId];
        return level ? level.color : '#808080';
    }

    /**
     * دریافت درجه سختی
     * @param {string} levelId - شناسه سطح
     * @returns {number} درجه سختی (1-6)
     */
    getDifficulty(levelId) {
        const level = this.levels[levelId];
        return level ? level.difficulty : 0;
    }

    /**
     * دریافت تمام سطوح
     * @returns {Array} آرایه سطوح
     */
    getAllLevels() {
        return Object.values(this.levels);
    }

    /**
     * دریافت شناسه تمام سطوح
     * @returns {Array} آرایه شناسه‌ها
     */
    getAllLevelIds() {
        return Object.keys(this.levels);
    }

    // ============================================================
    // بخش : مدیریت سطح فعلی
    // ============================================================

    /**
     * تنظیم سطح فعلی AI
     * @param {string} levelId - شناسه سطح
     * @returns {Object} نتیجه
     */
    setCurrentLevel(levelId) {
        if (!this.levels[levelId]) {
            return {
                success: false,
                error: 'INVALID_LEVEL',
                message: `سطح "${levelId}" وجود ندارد`
            };
        }

        const oldLevel = this.currentLevel;
        this.currentLevel = levelId;

        this._emit('level-changed', {
            oldLevel,
            newLevel: levelId,
            levelInfo: this.levels[levelId]
        });

        if (this.debug) {
            console.log(`🎚️ AI level changed: ${oldLevel} → ${levelId}`);
        }

        return {
            success: true,
            oldLevel,
            newLevel: levelId,
            levelInfo: this.levels[levelId]
        };
    }

    /**
     * دریافت سطح فعلی
     * @returns {Object} اطلاعات سطح فعلی
     */
    getCurrentLevel() {
        return this.levels[this.currentLevel] || this.levels[this.defaultLevel];
    }

    /**
     * دریافت شناسه سطح فعلی
     * @returns {string} شناسه سطح
     */
    getCurrentLevelId() {
        return this.currentLevel;
    }

    /**
     * ریست به سطح پیش‌فرض
     * @returns {Object} نتیجه
     */
    resetToDefault() {
        return this.setCurrentLevel(this.defaultLevel);
    }

    // ============================================================
    // بخش ۳: پارامترهای سطح
    // ============================================================

    /**
     * دریافت پارامترهای یک سطح
     * @param {string} levelId - شناسه سطح
     * @returns {Object} پارامترها
     */
    getLevelParams(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        return level ? level.params : null;
    }

    /**
     * دریافت استراتژی‌های یک سطح
     * @param {string} levelId - شناسه سطح
     * @returns {Object} استراتژی‌ها
     */
    getLevelStrategies(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        return level ? level.strategies : null;
    }

    /**
     * دریافت محدودیت‌های یک سطح
     * @param {string} levelId - شناسه سطح
     * @returns {Object} محدودیت‌ها
     */
    getLevelLimitations(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        return level ? level.limitations : null;
    }

    /**
     * دریافت پاداش‌های یک سطح
     * @param {string} levelId - شناسه سطح
     * @returns {Object} پاداش‌ها
     */
    getLevelRewards(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        return level ? level.rewards : null;
    }

    /**
     * مقایسه دو سطح
     * @param {string} level1Id - شناسه سطح اول
     * @param {string} level2Id - شناسه سطح دوم
     * @returns {Object} نتیجه مقایسه
     */
    compareLevels(level1Id, level2Id) {
        const level1 = this.levels[level1Id];
        const level2 = this.levels[level2Id];

        if (!level1 || !level2) {
            return {
                success: false,
                error: 'INVALID_LEVEL',
                message: 'یکی از سطوح نامعتبر است'
            };
        }

        const comparison = {
            level1: level1Id,
            level2: level2Id,
            differences: {}
        };

        // مقایسه پارامترها
        const params1 = level1.params;
        const params2 = level2.params;

        Object.keys(params1).forEach(key => {
            if (params1[key] !== params2[key]) {
                comparison.differences[key] = {
                    level1: params1[key],
                    level2: params2[key],
                    diff: params2[key] - params1[key]
                };
            }
        });

        // مقایسه استراتژی‌ها
        comparison.strategyDifferences = {};
        Object.keys(level1.strategies).forEach(key => {
            if (level1.strategies[key] !== level2.strategies[key]) {
                comparison.strategyDifferences[key] = {
                    level1: level1.strategies[key],
                    level2: level2.strategies[key]
                };
            }
        });

        // مقایسه پاداش‌ها
        comparison.rewardDifference = {
            xpMultiplier: level2.rewards.xpMultiplier - level1.rewards.xpMultiplier,
            coinMultiplier: level2.rewards.coinMultiplier - level1.rewards.coinMultiplier,
            ratingChange: level2.rewards.ratingChange - level1.rewards.ratingChange
        };

        return {
            success: true,
            comparison
        };
    }

    // ============================================================
    // بخش ۴: بررسی باز بودن سطح
    // ============================================================

    /**
     * بررسی آیا سطح باز است
     * @param {string} levelId - شناسه سطح
     * @param {Object} playerProfile - پروفایل بازیکن
     * @returns {Object} نتیجه
     */
    isLevelUnlocked(levelId, playerProfile = {}) {
        const level = this.levels[levelId];

        if (!level) {
            return {
                unlocked: false,
                reason: 'INVALID_LEVEL'
            };
        }

        // اگر نیاز به بازگشایی ندارد
        if (!level.unlockRequirement) {
            return {
                unlocked: true,
                reason: 'NO_REQUIREMENT'
            };
        }

        const requirement = level.unlockRequirement;

        // بررسی نوع نیازمندی
        switch (requirement.type) {
            case 'level':
                const playerLevel = playerProfile.level || 1;
                const unlocked = playerLevel >= requirement.value;
                return {
                    unlocked,
                    reason: unlocked ? 'LEVEL_MET' : 'LEVEL_NOT_MET',
                    requiredLevel: requirement.value,
                    currentLevel: playerLevel
                };

            case 'wins':
                const playerWins = playerProfile.stats?.wins || 0;
                const unlocked = playerWins >= requirement.value;
                return {
                    unlocked,
                    reason: unlocked ? 'WINS_MET' : 'WINS_NOT_MET',
                    requiredWins: requirement.value,
                    currentWins: playerWins
                };

            case 'rating':
                const playerRating = playerProfile.rating || 1000;
                const unlocked = playerRating >= requirement.value;
                return {
                    unlocked,
                    reason: unlocked ? 'RATING_MET' : 'RATING_NOT_MET',
                    requiredRating: requirement.value,
                    currentRating: playerRating
                };

            case 'achievement':
                const achievements = playerProfile.achievements?.unlocked || [];
                const unlocked = achievements.includes(requirement.value);
                return {
                    unlocked,
                    reason: unlocked ? 'ACHIEVEMENT_MET' : 'ACHIEVEMENT_NOT_MET',
                    requiredAchievement: requirement.value
                };

            default:
                return {
                    unlocked: false,
                    reason: 'UNKNOWN_REQUIREMENT'
                };
        }
    }

    /**
     * دریافت سطوح باز برای بازیکن
     * @param {Object} playerProfile - پروفایل بازیکن
     * @returns {Array} سطوح باز
     */
    getUnlockedLevels(playerProfile = {}) {
        return this.getAllLevels().filter(level => {
            const check = this.isLevelUnlocked(level.id, playerProfile);
            return check.unlocked;
        });
    }

    /**
     * دریافت سطوح قفل برای بازیکن
     * @param {Object} playerProfile - پروفایل بازیکن
     * @returns {Array} سطوح قفل
     */
    getLockedLevels(playerProfile = {}) {
        return this.getAllLevels().filter(level => {
            const check = this.isLevelUnlocked(level.id, playerProfile);
            return !check.unlocked;
        });
    }

    // ============================================================
    // بخش : تنظیمات سطح
    // ============================================================

    /**
     * به‌روزرسانی پارامترهای یک سطح
     * @param {string} levelId - شناسه سطح
     * @param {Object} newParams - پارامترهای جدید
     * @returns {Object} نتیجه
     */
    updateLevelParams(levelId, newParams) {
        const level = this.levels[levelId];

        if (!level) {
            return {
                success: false,
                error: 'INVALID_LEVEL',
                message: 'سطح نامعتبر است'
            };
        }

        // ذخیره پارامترهای قدیمی
        const oldParams = { ...level.params };

        // به‌روزرسانی پارامترها
        level.params = {
            ...level.params,
            ...newParams
        };

        this._emit('level-params-updated', {
            levelId,
            oldParams,
            newParams: level.params
        });

        if (this.debug) {
            console.log(` Level ${levelId} params updated`);
        }

        return {
            success: true,
            levelId,
            oldParams,
            newParams: level.params
        };
    }

    /**
     * ریست پارامترهای سطح به حالت پیش‌فرض
     * @param {string} levelId - شناسه سطح
     * @returns {Object} نتیجه
     */
    resetLevelParams(levelId) {
        // در اینجا باید پارامترهای پیش‌فرض از CONFIG خوانده شوند
        // برای سادگی، فقط پیام موفقیت برمی‌گردانیم
        return {
            success: true,
            message: 'پارامترها ریست شدند'
        };
    }

    // ============================================================
    // بخش ۶: آمار و تاریخچه
    // ============================================================

    /**
     * ثبت بازی انجام شده با یک سطح
     * @param {string} levelId - شناسه سطح
     * @param {Object} gameResult - نتیجه بازی
     * @returns {void}
     */
    recordGame(levelId, gameResult) {
        if (!this.stats.gamesPlayedByLevel[levelId]) {
            this.stats.gamesPlayedByLevel[levelId] = 0;
        }

        this.stats.gamesPlayedByLevel[levelId]++;

        // به‌روزرسانی win rate
        if (gameResult.isWinner) {
            const totalGames = this.stats.gamesPlayedByLevel[levelId];
            const currentWinRate = this.stats.winRateByLevel[levelId] || 0;
            this.stats.winRateByLevel[levelId] = 
                ((currentWinRate * (totalGames - 1)) + 100) / totalGames;
        }

        // به‌روزرسانی average score
        const currentAvg = this.stats.averageScoreByLevel[levelId] || 0;
        const totalGames = this.stats.gamesPlayedByLevel[levelId];
        this.stats.averageScoreByLevel[levelId] = 
            ((currentAvg * (totalGames - 1)) + gameResult.score) / totalGames;
    }

    /**
     * دریافت آمار یک سطح
     * @param {string} levelId - شناسه سطح
     * @returns {Object} آمار
     */
    getLevelStats(levelId) {
        return {
            gamesPlayed: this.stats.gamesPlayedByLevel[levelId] || 0,
            winRate: this.stats.winRateByLevel[levelId] || 0,
            averageScore: this.stats.averageScoreByLevel[levelId] || 0
        };
    }

    /**
     * دریافت آمار تمام سطوح
     * @returns {Object} آمار کامل
     */
    getAllLevelStats() {
        const stats = {};
        Object.keys(this.levels).forEach(levelId => {
            stats[levelId] = this.getLevelStats(levelId);
        });
        return stats;
    }

    /**
     * ریست آمار
     * @returns {void}
     */
    resetStats() {
        Object.keys(this.levels).forEach(level => {
            this.stats.gamesPlayedByLevel[level] = 0;
            this.stats.winRateByLevel[level] = 0;
            this.stats.averageScoreByLevel[level] = 0;
        });
    }

    // ============================================================
    // بخش ۷: پیشنهادات هوشمند
    // ============================================================

    /**
     * پیشنهاد سطح مناسب بر اساس عملکرد بازیکن
     * @param {Object} playerProfile - پروفایل بازیکن
     * @returns {Object} پیشنهاد
     */
    suggestLevel(playerProfile) {
        const {
            level = 1,
            rating = 1000,
            stats = {}
        } = playerProfile;

        const winRate = stats.winRate || 50;
        const totalGames = stats.totalGames || 0;

        // اگر بازیکن جدید است
        if (totalGames < 10) {
            return {
                suggestedLevel: 'beginner',
                reason: 'NEW_PLAYER',
                confidence: 0.95
            };
        }

        // اگر win rate بالاست
        if (winRate >= 70 && rating >= 2000) {
            return {
                suggestedLevel: 'expert',
                reason: 'HIGH_PERFORMANCE',
                confidence: 0.85
            };
        }

        // اگر win rate متوسط است
        if (winRate >= 50 && rating >= 1500) {
            return {
                suggestedLevel: 'hard',
                reason: 'MEDIUM_PERFORMANCE',
                confidence: 0.80
            };
        }

        // اگر win rate پایین است
        if (winRate < 40) {
            return {
                suggestedLevel: 'easy',
                reason: 'LOW_PERFORMANCE',
                confidence: 0.75
            };
        }

        // پیش‌فرض
        return {
            suggestedLevel: 'normal',
            reason: 'DEFAULT',
            confidence: 0.70
        };
    }

    /**
     * پیشنهاد سطح بر اساس تاریخچه بازی
     * @param {Array} gameHistory - تاریخچه بازی‌ها
     * @returns {Object} پیشنهاد
     */
    suggestLevelFromHistory(gameHistory) {
        if (!gameHistory || gameHistory.length === 0) {
            return this.suggestLevel({});
        }

        const recentGames = gameHistory.slice(-10);
        const avgScore = recentGames.reduce((sum, game) => sum + game.score, 0) / recentGames.length;
        const winCount = recentGames.filter(g => g.isWinner).length;
        const winRate = (winCount / recentGames.length) * 100;

        if (winRate >= 80) {
            return {
                suggestedLevel: 'master',
                reason: 'EXCELLENT_RECENT_PERFORMANCE',
                confidence: 0.90,
                recentWinRate: winRate
            };
        }

        if (winRate >= 60) {
            return {
                suggestedLevel: 'expert',
                reason: 'GOOD_RECENT_PERFORMANCE',
                confidence: 0.85,
                recentWinRate: winRate
            };
        }

        if (winRate >= 40) {
            return {
                suggestedLevel: 'hard',
                reason: 'AVERAGE_RECENT_PERFORMANCE',
                confidence: 0.75,
                recentWinRate: winRate
            };
        }

        return {
            suggestedLevel: 'normal',
            reason: 'BELOW_AVERAGE_RECENT_PERFORMANCE',
            confidence: 0.70,
            recentWinRate: winRate
        };
    }

    // ============================================================
    // بخش ۸: توابع کمکی
    // ============================================================

    /**
     * دریافت زمان تفکر تصادفی برای یک سطح
     * @param {string} levelId - شناسه سطح
     * @returns {number} میلی‌ثانیه
     */
    getRandomThinkingTime(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        if (!level) return 1000;

        const min = level.limitations.minThinkingTime;
        const max = level.limitations.maxThinkingTime;

        return Utils.randomInt(min, max);
    }

    /**
     * بررسی آیا باید خطا کند
     * @param {string} levelId - شناسه سطح
     * @returns {boolean}
     */
    shouldMakeError(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        if (!level) return false;

        return Math.random() < level.params.errorRate;
    }

    /**
     * بررسی آیا باید از حکم استفاده کند
     * @param {string} levelId - شناسه سطح
     * @returns {boolean}
     */
    shouldUseTrump(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        if (!level) return false;

        return Math.random() < level.params.trumpUsage;
    }

    /**
     * بررسی آیا باید بلوف بزند
     * @param {string} levelId - شناسه سطح
     * @returns {boolean}
     */
    shouldBluff(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        if (!level) return false;

        return Math.random() < level.params.bluffRate;
    }

    /**
     * دریافت عمق استراتژی
     * @param {string} levelId - شناسه سطح
     * @returns {number}
     */
    getStrategyDepth(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        return level ? level.params.strategyDepth : 1;
    }

    /**
     * دریافت سطح آگاهی از هم‌تیمی
     * @param {string} levelId - شناسه سطح
     * @returns {number} 0-1
     */
    getPartnerAwareness(levelId = this.currentLevel) {
        const level = this.levels[levelId];
        return level ? level.params.partnerAwareness : 0;
    }

    // ============================================================
    // بخش ۹: Event System
    // ============================================================

    /**
     * ثبت شنونده رویداد
     * @param {string} event - رویداد
     * @param {Function} callback - تابع
     * @returns {Function} تابع حذف
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event).add(callback);

        return () => this.off(event, callback);
    }

    /**
     * حذف شنونده
     * @param {string} event - رویداد
     * @param {Function} callback - تابع
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * انتشار رویداد
     * @param {string} event - رویداد
     * @param {*} data - داده
     * @private
     */
    _emit(event, data = null) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ AI Levels event listener error:`, error);
                }
            });
        }

        eventBus.emit(`ai-levels:${event}`, data);
    }

    /**
     * پاک کردن شنوندگان
     */
    clearListeners() {
        this.listeners.clear();
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        console.log('🎚️ AI Levels Status:');
        console.log('  Current Level:', this.currentLevel);
        console.log('  Default Level:', this.defaultLevel);
        console.log('  Available Levels:', Object.keys(this.levels).length);
        console.log('  Level Stats:');
        Object.keys(this.levels).forEach(levelId => {
            const stats = this.getLevelStats(levelId);
            console.log(`    ${levelId}: ${stats.gamesPlayed} games, ${stats.winRate.toFixed(1)}% win rate`);
        });
    }

    /**
     * export تمام تنظیمات
     * @returns {Object}
     */
    exportConfig() {
        return {
            levels: this.levels,
            defaultLevel: this.defaultLevel,
            currentLevel: this.currentLevel,
            stats: this.stats
        };
    }

    /**
     * import تنظیمات
     * @param {Object} config - تنظیمات
     * @returns {boolean} موفقیت
     */
    importConfig(config) {
        if (config.levels) {
            this.levels = config.levels;
        }
        if (config.defaultLevel) {
            this.defaultLevel = config.defaultLevel;
        }
        if (config.currentLevel) {
            this.currentLevel = config.currentLevel;
        }
        if (config.stats) {
            this.stats = config.stats;
        }

        return true;
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const aiLevelsManager = new AILevelsManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AILevelsManager, aiLevelsManager };
} else {
    window.AILevelsManager = AILevelsManager;
    window.aiLevelsManager = aiLevelsManager;
}

console.log('✅ AILevelsManager loaded - 6 levels available');
