/**
 * ============================================================
 * HOKM MASTER - Scoring Engine
 * موتور امتیازدهی و پاداش بازی حکم
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم امتیازدهی، پاداش‌ها،
 * محاسبه XP، سکه، Level Up، و تمام جنبه‌های اقتصادی بازی
 * است. این موتور با RulesEngine و HokmEngine همکاری می‌کند
 * تا امتیازات دقیق و عادلانه‌ای محاسبه کند.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - storage (از فایل storage.js)
 * 
 * ============================================================
 */

class ScoringEngine {

    constructor() {
        /**
         * ضرایب پایه امتیاز
         * @type {Object}
         */
        this.baseMultipliers = {
            quickMatch: 1.0,
            classic: 1.0,
            ranked: 1.5,
            private: 0.8,
            ai: 0.7,
            practice: 0.0,
            tournament: 2.0,
            league: 1.8
        };

        /**
         * ضرایب سطح بازی
         * @type {Object}
         */
        this.levelMultipliers = {
            normal: 1.0,
            advanced: 1.5,
            legendary: 3.0
        };

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
         * تاریخچه امتیازات
         * @type {Array}
         */
        this.scoreHistory = [];

        /**
         * آمار امتیازدهی
         * @type {Object}
         */
        this.stats = {
            totalGamesScored: 0,
            totalCoinsDistributed: 0,
            totalXpDistributed: 0,
            totalLevelUps: 0,
            totalKotBonuses: 0,
            totalStreakBonuses: 0,
            averageGameScore: 0
        };

        /**
         * کش محاسبات برای بهینه‌سازی
         * @type {Map}
         */
        this.calculationCache = new Map();

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        if (this.debug) {
            console.log('💰 ScoringEngine initialized');
        }
    }

    // ============================================================
    // بخش ۱: محاسبه امتیاز پایه بازی
    // ============================================================

    /**
     * محاسبه امتیاز پایه بازی
     * @param {Object} gameResult - نتیجه بازی
     * @returns {Object} امتیاز پایه
     */
    calculateBaseScore(gameResult) {
        const {
            mode = 'classic',
            level = 'normal',
            isWinner = false,
            tricksWon = 0,
            totalTricks = 26,
            isKot = false,
            isDoubleKot = false,
            roundDuration = 0,
            playerCount = 4
        } = gameResult;

        // امتیاز پایه برای برد/باخت
        const baseWinScore = isWinner ? 100 : 20;

        // ضریب حالت بازی
        const modeMultiplier = this.baseMultipliers[mode] || 1.0;

        // ضریب سطح
        const levelMultiplier = this.levelMultipliers[level] || 1.0;

        // محاسبه امتیاز
        let score = baseWinScore * modeMultiplier * levelMultiplier;

        // پاداش تعداد Trick های برده شده
        const trickRatio = tricksWon / totalTricks;
        score += trickRatio * 50 * modeMultiplier;

        // پاداش Kot
        if (isKot) {
            score += 100 * modeMultiplier;
            this.stats.totalKotBonuses++;
        }

        // پاداش Double Kot
        if (isDoubleKot) {
            score += 250 * modeMultiplier;
        }

        // پاداش سرعت (بازی سریع‌تر = امتیاز بیشتر)
        if (roundDuration > 0 && roundDuration < 600) {
            const speedBonus = Math.max(0, (600 - roundDuration) / 600) * 30;
            score += speedBonus * modeMultiplier;
        }

        // محدود کردن امتیاز
        score = Math.round(Math.max(0, Math.min(score, 10000)));

        return {
            baseScore: score,
            breakdown: {
                winScore: baseWinScore,
                modeMultiplier,
                levelMultiplier,
                trickBonus: trickRatio * 50 * modeMultiplier,
                kotBonus: isKot ? 100 * modeMultiplier : 0,
                doubleKotBonus: isDoubleKot ? 250 * modeMultiplier : 0,
                speedBonus: roundDuration > 0 && roundDuration < 600 ? 
                    Math.max(0, (600 - roundDuration) / 600) * 30 * modeMultiplier : 0
            },
            isWinner,
            mode,
            level
        };
    }

    // ============================================================
    // بخش : محاسبه سکه (Coins)
    // ============================================================

    /**
     * محاسبه سکه‌های کسب شده
     * @param {Object} gameResult - نتیجه بازی
     * @param {Object} playerProfile - پروفایل بازیکن
     * @returns {Object} جزئیات سکه
     */
    calculateCoins(gameResult, playerProfile = {}) {
        const {
            mode = 'classic',
            level = 'normal',
            isWinner = false,
            tricksWon = 0,
            totalTricks = 26,
            isKot = false,
            roundDuration = 0,
            hasVip = false,
            hasDoubleCoinBooster = false,
            dailyMissionBonus = 0
        } = gameResult;

        const {
            vipBonusPercent = 0,
            currentStreak = 0
        } = playerProfile;

        // سکه پایه
        const baseCoins = isWinner ? 100 : 25;

        // ضریب حالت بازی
        const modeMultiplier = this.baseMultipliers[mode] || 1.0;

        // ضریب سطح
        const levelMultiplier = this.levelMultipliers[level] || 1.0;

        // محاسبه سکه
        let coins = baseCoins * modeMultiplier * levelMultiplier;

        // پاداش Trick
        const trickRatio = tricksWon / totalTricks;
        coins += trickRatio * 50 * modeMultiplier;

        // پاداش Kot
        if (isKot) {
            coins += 75 * modeMultiplier;
        }

        // پاداش Streak (برد متوالی)
        let streakBonus = 0;
        if (currentStreak > 0 && isWinner) {
            streakBonus = Math.min(currentStreak * 10, 100);
            coins += streakBonus;
            this.stats.totalStreakBonuses++;
        }

        // پاداش VIP
        let vipBonus = 0;
        if (hasVip || vipBonusPercent > 0) {
            const vipPercent = vipBonusPercent || CONFIG.SHOP.VIP.BENEFITS.REWARD_BONUS_PERCENT;
            vipBonus = coins * (vipPercent / 100);
            coins += vipBonus;
        }

        // پاداش Double Coin Booster
        let boosterBonus = 0;
        if (hasDoubleCoinBooster) {
            boosterBonus = coins;
            coins *= 2;
        }

        // پاداش مأموریت روزانه
        coins += dailyMissionBonus;

        // محدود کردن سکه
        coins = Math.round(Math.max(0, Math.min(coins, 1000000)));

        return {
            totalCoins: coins,
            breakdown: {
                baseCoins,
                modeMultiplier,
                levelMultiplier,
                trickBonus: trickRatio * 50 * modeMultiplier,
                kotBonus: isKot ? 75 * modeMultiplier : 0,
                streakBonus,
                vipBonus,
                boosterBonus,
                dailyMissionBonus
            },
            isWinner,
            mode,
            level
        };
    }

    // ============================================================
    // بخش ۳: محاسبه XP (تجربه)
    // ============================================================

    /**
     * محاسبه XP کسب شده
     * @param {Object} gameResult - نتیجه بازی
     * @param {Object} playerProfile - پروفایل بازیکن
     * @returns {Object} جزئیات XP
     */
    calculateXP(gameResult, playerProfile = {}) {
        const {
            mode = 'classic',
            level = 'normal',
            isWinner = false,
            tricksWon = 0,
            totalTricks = 26,
            isKot = false,
            roundDuration = 0,
            hasDoubleXpBooster = false,
            dailyMissionBonus = 0
        } = gameResult;

        const {
            currentStreak = 0,
            league = { tier: 'bronze' }
        } = playerProfile;

        // XP پایه
        const baseXP = isWinner ? 50 : 10;

        // ضریب حالت بازی
        const modeMultiplier = this.baseMultipliers[mode] || 1.0;

        // ضریب سطح
        const levelMultiplier = this.levelMultipliers[level] || 1.0;

        // محاسبه XP
        let xp = baseXP * modeMultiplier * levelMultiplier;

        // پاداش Trick
        const trickRatio = tricksWon / totalTricks;
        xp += trickRatio * 25 * modeMultiplier;

        // پاداش Kot
        if (isKot) {
            xp += 50 * modeMultiplier;
        }

        // پاداش Streak
        let streakBonus = 0;
        if (currentStreak > 0 && isWinner) {
            streakBonus = Math.min(currentStreak * 5, 50);
            xp += streakBonus;
        }

        // پاداش لیگ (لیگ بالاتر = XP بیشتر)
        const leagueMultiplier = this._getLeagueMultiplier(league.tier);
        xp *= leagueMultiplier;

        // پاداش Double XP Booster
        let boosterBonus = 0;
        if (hasDoubleXpBooster) {
            boosterBonus = xp;
            xp *= 2;
        }

        // پاداش مأموریت روزانه
        xp += dailyMissionBonus;

        // محدود کردن XP
        xp = Math.round(Math.max(0, Math.min(xp, 100000)));

        return {
            totalXP: xp,
            breakdown: {
                baseXP,
                modeMultiplier,
                levelMultiplier,
                trickBonus: trickRatio * 25 * modeMultiplier,
                kotBonus: isKot ? 50 * modeMultiplier : 0,
                streakBonus,
                leagueMultiplier,
                boosterBonus,
                dailyMissionBonus
            },
            isWinner,
            mode,
            level
        };
    }

    /**
     * دریافت ضریب لیگ
     * @param {string} tier - سطح لیگ
     * @returns {number} ضریب
     * @private
     */
    _getLeagueMultiplier(tier) {
        const multipliers = {
            bronze: 1.0,
            silver: 1.2,
            gold: 1.4,
            platinum: 1.6,
            diamond: 1.8,
            master: 2.0
        };
        return multipliers[tier] || 1.0;
    }

    // ============================================================
    // بخش ۴: محاسبه Rating (ELO)
    // ============================================================

    /**
     * محاسبه تغییر Rating
     * @param {Object} gameResult - نتیجه بازی
     * @param {Object} playerProfile - پروفایل بازیکن
     * @param {Object} opponentProfile - پروفایل حریف (میانگین تیم)
     * @returns {Object} جزئیات Rating
     */
    calculateRatingChange(gameResult, playerProfile, opponentProfile = {}) {
        const {
            mode = 'classic',
            isWinner = false,
            isKot = false,
            isUpset = false
        } = gameResult;

        const {
            rating = 1000,
            currentStreak = 0
        } = playerProfile;

        const {
            rating: opponentRating = 1000
        } = opponentProfile;

        // فقط در حالت Ranked Rating تغییر می‌کند
        if (mode !== 'ranked' && mode !== 'league') {
            return {
                ratingChange: 0,
                newRating: rating,
                reason: 'NOT_RANKED_MODE'
            };
        }

        // محاسبه Expected Score (فرمول ELO)
        const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));

        // Actual Score
        const actualScore = isWinner ? 1 : 0;

        // K Factor (ضریب تغییر)
        let kFactor = 32;
        if (rating < 1200) kFactor = 40;
        else if (rating < 1600) kFactor = 32;
        else if (rating < 2000) kFactor = 24;
        else kFactor = 16;

        // محاسبه تغییر Rating
        let ratingChange = Math.round(kFactor * (actualScore - expectedScore));

        // پاداش Kot
        if (isKot && isWinner) {
            ratingChange += CONFIG.LEAGUE.RATING_CHANGE.KOT_BONUS;
        }

        // پاداش Upset (برد مقابل بازیکن قوی‌تر)
        if (isUpset && isWinner) {
            ratingChange += CONFIG.LEAGUE.RATING_CHANGE.UPSET_BONUS;
        }

        // پاداش Streak
        let streakBonus = 0;
        if (currentStreak > 0 && isWinner) {
            streakBonus = Math.min(currentStreak * CONFIG.LEAGUE.RATING_CHANGE.STREAK_BONUS, 
                                  CONFIG.LEAGUE.RATING_CHANGE.MAX_STREAK_BONUS);
            ratingChange += streakBonus;
        }

        // محدود کردن تغییر Rating
        const maxChange = 50;
        ratingChange = Math.max(-maxChange, Math.min(maxChange, ratingChange));

        // اگر باخت، حداقل تغییر
        if (!isWinner && ratingChange > -10) {
            ratingChange = -10;
        }

        const newRating = Math.max(0, rating + ratingChange);

        return {
            ratingChange,
            newRating,
            oldRating: rating,
            breakdown: {
                expectedScore,
                actualScore,
                kFactor,
                kotBonus: isKot && isWinner ? CONFIG.LEAGUE.RATING_CHANGE.KOT_BONUS : 0,
                upsetBonus: isUpset && isWinner ? CONFIG.LEAGUE.RATING_CHANGE.UPSET_BONUS : 0,
                streakBonus
            },
            isWinner,
            mode
        };
    }

    // ============================================================
    // بخش ۵: محاسبه Level Up
    // ============================================================

    /**
     * بررسی و محاسبه Level Up
     * @param {number} currentLevel - سطح فعلی
     * @param {number} currentXP - XP فعلی
     * @param {number} xpGained - XP کسب شده
     * @returns {Object} نتیجه
     */
    calculateLevelUp(currentLevel, currentXP, xpGained) {
        const newTotalXP = currentXP + xpGained;
        const xpForNextLevel = this._getXPForLevel(currentLevel);

        let newLevel = currentLevel;
        let remainingXP = newTotalXP;
        let leveledUp = false;
        let levelsGained = 0;

        // بررسی Level Up های متوالی
        while (remainingXP >= xpForNextLevel && newLevel < 100) {
            remainingXP -= xpForNextLevel;
            newLevel++;
            levelsGained++;
            leveledUp = true;
            this.stats.totalLevelUps++;

            // محاسبه XP مورد نیاز برای سطح بعدی
            const nextXpForLevel = this._getXPForLevel(newLevel);
            if (remainingXP < nextXpForLevel) {
                break;
            }
        }

        return {
            leveledUp,
            levelsGained,
            oldLevel: currentLevel,
            newLevel,
            oldXP: currentXP,
            newXP: remainingXP,
            xpForNextLevel: this._getXPForLevel(newLevel),
            totalXP: newTotalXP,
            rewards: leveledUp ? this._calculateLevelUpRewards(newLevel) : null
        };
    }

    /**
     * دریافت XP مورد نیاز برای یک سطح
     * @param {number} level - سطح
     * @returns {number} XP مورد نیاز
     * @private
     */
    _getXPForLevel(level) {
        // فرمول: 100 * level^1.5
        return Math.floor(100 * Math.pow(level, 1.5));
    }

    /**
     * محاسبه پاداش‌های Level Up
     * @param {number} newLevel - سطح جدید
     * @returns {Object} پاداش‌ها
     * @private
     */
    _calculateLevelUpRewards(newLevel) {
        const rewards = {
            coins: 0,
            gems: 0,
            items: []
        };

        // پاداش سکه
        rewards.coins = 100 * newLevel;

        // پاداش الماس (هر 5 سطح)
        if (newLevel % 5 === 0) {
            rewards.gems = 10 * (newLevel / 5);
        }

        // پاداش آیتم (هر 10 سطح)
        if (newLevel % 10 === 0) {
            rewards.items.push({
                type: 'avatar',
                id: newLevel / 10
            });
        }

        // پاداش ویژه سطح 25، 50، 75، 100
        if ([25, 50, 75, 100].includes(newLevel)) {
            rewards.items.push({
                type: 'frame',
                id: newLevel / 25
            });
            rewards.gems += 50;
            rewards.coins += 5000;
        }

        return rewards;
    }

    // ============================================================
    // بخش ۶: محاسبه پاداش‌های ویژه
    // ============================================================

    /**
     * محاسبه پاداش کامل بازی
     * @param {Object} gameResult - نتیجه بازی
     * @param {Object} playerProfile - پروفایل بازیکن
     * @returns {Object} پاداش کامل
     */
    calculateFullReward(gameResult, playerProfile = {}) {
        // محاسبه تمام اجزا
        const baseScore = this.calculateBaseScore(gameResult);
        const coins = this.calculateCoins(gameResult, playerProfile);
        const xp = this.calculateXP(gameResult, playerProfile);
        const rating = this.calculateRatingChange(gameResult, playerProfile);

        // محاسبه Level Up
        const levelUp = this.calculateLevelUp(
            playerProfile.level || 1,
            playerProfile.xp || 0,
            xp.totalXP
        );

        // پاداش‌های ویژه
        const specialRewards = this._calculateSpecialRewards(gameResult, playerProfile);

        // مجموع پاداش
        const totalReward = {
            score: baseScore.baseScore,
            coins: coins.totalCoins,
            xp: xp.totalXP,
            rating: rating.ratingChange,
            newRating: rating.newRating,
            levelUp: levelUp.leveledUp ? levelUp : null,
            specialRewards,
            breakdown: {
                baseScore: baseScore.breakdown,
                coins: coins.breakdown,
                xp: xp.breakdown,
                rating: rating.breakdown
            },
            summary: {
                isWinner: gameResult.isWinner,
                mode: gameResult.mode,
                level: gameResult.level,
                totalEarned: {
                    coins: coins.totalCoins,
                    xp: xp.totalXP,
                    rating: rating.ratingChange
                }
            }
        };

        // به‌روزرسانی آمار
        this.stats.totalGamesScored++;
        this.stats.totalCoinsDistributed += coins.totalCoins;
        this.stats.totalXpDistributed += xp.totalXP;

        // ذخیره در تاریخچه
        this.scoreHistory.push({
            timestamp: Date.now(),
            reward: totalReward,
            gameResult
        });

        // محدود کردن تاریخچه
        if (this.scoreHistory.length > 100) {
            this.scoreHistory.shift();
        }

        this._emit('reward-calculated', totalReward);

        if (this.debug) {
            console.log(' Reward calculated:', totalReward.summary);
        }

        return totalReward;
    }

    /**
     * محاسبه پاداش‌های ویژه
     * @param {Object} gameResult - نتیجه بازی
     * @param {Object} playerProfile - پروفایل بازیکن
     * @returns {Array} پاداش‌های ویژه
     * @private
     */
    _calculateSpecialRewards(gameResult, playerProfile) {
        const rewards = [];

        // پاداش اولین برد روزانه
        if (gameResult.isFirstWinOfDay && gameResult.isWinner) {
            rewards.push({
                type: 'first_win_daily',
                coins: 200,
                xp: 50,
                description: 'اولین برد روزانه'
            });
        }

        // پاداش Streak خاص
        if (gameResult.streak === 5) {
            rewards.push({
                type: 'streak_5',
                coins: 500,
                gems: 10,
                description: '۵ برد متوالی'
            });
        } else if (gameResult.streak === 10) {
            rewards.push({
                type: 'streak_10',
                coins: 1000,
                gems: 25,
                description: '۱۰ برد متوالی'
            });
        }

        // پاداش Perfect Game (همه Trick ها)
        if (gameResult.isPerfectGame) {
            rewards.push({
                type: 'perfect_game',
                coins: 1000,
                gems: 50,
                description: 'بازی کامل (همه Trick ها)'
            });
        }

        // پاداش Comeback (برد بعد از عقب بودن)
        if (gameResult.isComeback) {
            rewards.push({
                type: 'comeback',
                coins: 300,
                xp: 100,
                description: 'بازگشت عالی'
            });
        }

        return rewards;
    }

    // ============================================================
    // بخش ۷: محاسبه پاداش تورنمنت
    // ============================================================

    /**
     * محاسبه پاداش تورنمنت
     * @param {Object} tournamentResult - نتیجه تورنمنت
     * @returns {Object} پاداش
     */
    calculateTournamentReward(tournamentResult) {
        const {
            position = 0,
            totalPlayers = 16,
            entryFee = 0,
            prizePool = 0
        } = tournamentResult;

        // محاسبه پاداش بر اساس موقعیت
        let coins = 0;
        let gems = 0;
        let tickets = 0;

        if (position === 1) {
            coins = prizePool * 0.5;
            gems = 100;
            tickets = 5;
        } else if (position === 2) {
            coins = prizePool * 0.3;
            gems = 50;
            tickets = 3;
        } else if (position === 3) {
            coins = prizePool * 0.15;
            gems = 25;
            tickets = 2;
        } else if (position <= 8) {
            coins = prizePool * 0.05;
            tickets = 1;
        } else {
            // بازگشت ورودی
            coins = entryFee * 0.5;
        }

        coins = Math.round(coins);

        return {
            position,
            coins,
            gems,
            tickets,
            totalPlayers,
            prizePool,
            profit: coins - entryFee,
            isProfitable: coins > entryFee
        };
    }

    // ============================================================
    // بخش ۸: محاسبه پاداش لیگ
    // ============================================================

    /**
     * محاسبه پاداش پایان فصل لیگ
     * @param {Object} seasonResult - نتیجه فصل
     * @returns {Object} پاداش
     */
    calculateLeagueSeasonReward(seasonResult) {
        const {
            finalTier = 'bronze',
            finalRank = 100,
            gamesPlayed = 0,
            winRate = 0
        } = seasonResult;

        // پاداش پایه بر اساس Tier
        const tierRewards = {
            bronze: { coins: 500, xp: 50 },
            silver: { coins: 1000, xp: 100, frame: 2 },
            gold: { coins: 2000, xp: 200, frame: 3 },
            platinum: { coins: 5000, xp: 500, gems: 100, frame: 4 },
            diamond: { coins: 10000, xp: 1000, gems: 250, frame: 5 },
            master: { coins: 25000, xp: 2500, gems: 500, frame: 6, title: 1 }
        };

        const baseReward = tierRewards[finalTier] || tierRewards.bronze;

        // پاداش رتبه (Top 10, Top 50, Top 100)
        let rankBonus = { coins: 0, gems: 0 };
        if (finalRank <= 10) {
            rankBonus = { coins: 5000, gems: 200 };
        } else if (finalRank <= 50) {
            rankBonus = { coins: 2000, gems: 100 };
        } else if (finalRank <= 100) {
            rankBonus = { coins: 1000, gems: 50 };
        }

        // پاداش Win Rate
        let winRateBonus = 0;
        if (winRate >= 70) {
            winRateBonus = 2000;
        } else if (winRate >= 60) {
            winRateBonus = 1000;
        } else if (winRate >= 50) {
            winRateBonus = 500;
        }

        return {
            finalTier,
            finalRank,
            coins: baseReward.coins + rankBonus.coins + winRateBonus,
            xp: baseReward.xp,
            gems: baseReward.gems + rankBonus.gems,
            frame: baseReward.frame,
            title: baseReward.title,
            breakdown: {
                baseReward,
                rankBonus,
                winRateBonus
            }
        };
    }

    // ============================================================
    // بخش ۹: محاسبه پاداش مأموریت
    // ============================================================

    /**
     * محاسبه پاداش مأموریت
     * @param {Object} mission - مأموریت
     * @returns {Object} پاداش
     */
    calculateMissionReward(mission) {
        const {
            type = 'daily',
            difficulty = 'normal',
            baseReward = { coins: 100, xp: 25 }
        } = mission;

        // ضریب نوع مأموریت
        const typeMultipliers = {
            daily: 1.0,
            weekly: 3.0,
            monthly: 10.0,
            special: 5.0
        };

        // ضریب سختی
        const difficultyMultipliers = {
            easy: 0.8,
            normal: 1.0,
            hard: 1.5,
            expert: 2.0
        };

        const typeMultiplier = typeMultipliers[type] || 1.0;
        const difficultyMultiplier = difficultyMultipliers[difficulty] || 1.0;

        return {
            coins: Math.round(baseReward.coins * typeMultiplier * difficultyMultiplier),
            xp: Math.round(baseReward.xp * typeMultiplier * difficultyMultiplier),
            type,
            difficulty
        };
    }

    // ============================================================
    // بخش ۱۰: محاسبه پاداش دستاورد
    // ============================================================

    /**
     * محاسبه پاداش دستاورد
     * @param {Object} achievement - دستاورد
     * @returns {Object} پاداش
     */
    calculateAchievementReward(achievement) {
        const {
            rarity = 'common',
            baseReward = { coins: 100, xp: 50 }
        } = achievement;

        // ضریب کمیابی
        const rarityMultipliers = {
            common: 1.0,
            rare: 2.0,
            epic: 5.0,
            legendary: 10.0,
            mythic: 25.0
        };

        const multiplier = rarityMultipliers[rarity] || 1.0;

        return {
            coins: Math.round(baseReward.coins * multiplier),
            xp: Math.round(baseReward.xp * multiplier),
            badge: rarity !== 'common',
            title: rarity === 'legendary' || rarity === 'mythic',
            rarity
        };
    }

    // ============================================================
    // بخش ۱۱: محاسبه پاداش جایزه روزانه
    // ============================================================

    /**
     * محاسبه پاداش جایزه روزانه
     * @param {number} day - روز (1-7)
     * @param {number} streak - تعداد روزهای متوالی
     * @returns {Object} پاداش
     */
    calculateDailyReward(day, streak = 0) {
        const rewards = CONFIG.DAILY_REWARD.REWARDS;
        const reward = rewards[(day - 1) % rewards.length] || rewards[0];

        // پاداش Streak
        let streakMultiplier = 1.0;
        if (streak >= 7) {
            streakMultiplier = 2.0;
        } else if (streak >= 5) {
            streakMultiplier = 1.5;
        } else if (streak >= 3) {
            streakMultiplier = 1.2;
        }

        return {
            coins: Math.round(reward.COINS * streakMultiplier),
            xp: Math.round(reward.XP * streakMultiplier),
            gems: reward.GEMS || 0,
            day,
            streak,
            streakMultiplier,
            isStreakBonus: streakMultiplier > 1.0
        };
    }

    // ============================================================
    // بخش ۱۲: آمار و تاریخچه
    // ============================================================

    /**
     * دریافت آمار امتیازدهی
     * @returns {Object} آمار
     */
    getStats() {
        return {
            ...this.stats,
            averageGameScore: this.stats.totalGamesScored > 0 ? 
                this.stats.totalCoinsDistributed / this.stats.totalGamesScored : 0,
            historyLength: this.scoreHistory.length
        };
    }

    /**
     * دریافت تاریخچه امتیازات
     * @param {number} limit - تعداد
     * @returns {Array} تاریخچه
     */
    getHistory(limit = 20) {
        return this.scoreHistory.slice(-limit).reverse();
    }

    /**
     * دریافت خلاصه بازی اخیر
     * @param {number} gameId - شناسه بازی
     * @returns {Object|null}
     */
    getGameSummary(gameId) {
        return this.scoreHistory.find(h => h.gameResult?.gameId === gameId) || null;
    }

    /**
     * ریست آمار
     */
    resetStats() {
        this.stats = {
            totalGamesScored: 0,
            totalCoinsDistributed: 0,
            totalXpDistributed: 0,
            totalLevelUps: 0,
            totalKotBonuses: 0,
            totalStreakBonuses: 0,
            averageGameScore: 0
        };
    }

    /**
     * ریست تاریخچه
     */
    clearHistory() {
        this.scoreHistory = [];
    }

    // ============================================================
    // بخش ۱۳: توابع کمکی
    // ============================================================

    /**
     * فرمت کردن عدد بزرگ
     * @param {number} num - عدد
     * @returns {string}
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    /**
     * مقایسه دو پاداش
     * @param {Object} reward1 - پاداش اول
     * @param {Object} reward2 - پاداش دوم
     * @returns {Object} تفاوت
     */
    compareRewards(reward1, reward2) {
        return {
            coinsDiff: (reward1.coins || 0) - (reward2.coins || 0),
            xpDiff: (reward1.xp || 0) - (reward2.xp || 0),
            gemsDiff: (reward1.gems || 0) - (reward2.gems || 0),
            isBetter: (reward1.coins || 0) + (reward1.xp || 0) > 
                     (reward2.coins || 0) + (reward2.xp || 0)
        };
    }

    /**
     * محاسبه ارزش کل پاداش
     * @param {Object} reward - پاداش
     * @returns {number} ارزش کل
     */
    calculateTotalValue(reward) {
        return (reward.coins || 0) + 
               (reward.xp || 0) * 0.5 + 
               (reward.gems || 0) * 10;
    }

    // ============================================================
    // بخش ۱۴: Event System
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
                    console.error(`❌ Scoring event listener error:`, error);
                }
            });
        }

        eventBus.emit(`scoring:${event}`, data);
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
        const stats = this.getStats();

        console.log(' ScoringEngine Status:');
        console.log('  Total Games Scored:', stats.totalGamesScored);
        console.log('  Total Coins Distributed:', this.formatNumber(stats.totalCoinsDistributed));
        console.log('  Total XP Distributed:', this.formatNumber(stats.totalXpDistributed));
        console.log('  Total Level Ups:', stats.totalLevelUps);
        console.log('  Total Kot Bonuses:', stats.totalKotBonuses);
        console.log('  Total Streak Bonuses:', stats.totalStreakBonuses);
        console.log('  Average Game Score:', stats.averageGameScore.toFixed(2));
        console.log('  History Length:', stats.historyLength);
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const scoringEngine = new ScoringEngine();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScoringEngine, scoringEngine };
} else {
    window.ScoringEngine = ScoringEngine;
    window.scoringEngine = scoringEngine;
}

console.log('✅ ScoringEngine loaded');
