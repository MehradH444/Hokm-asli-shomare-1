/**
 * ============================================================
 * HOKM MASTER - League Manager
 * مدیریت سیستم لیگ و فصل
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم لیگ است. شامل مدیریت
 * Tier های لیگ، سیستم Promotion/Demotion، محاسبه امتیاز فصل،
 * Leaderboard لیگ، پاداش‌های پایان فصل، تاریخچه فصل‌ها،
 * و آمار کامل لیگ.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - storage (از فایل storage.js)
 * - authManager (از فایل auth.js)
 * - scoringEngine (از فایل scoring.js)
 * 
 * ============================================================
 */

class LeagueManager {

    constructor() {
        /**
         * Tier های لیگ
         * @type {Array<Object>}
         */
        this.tiers = CONFIG.LEAGUE.TIERS;

        /**
         * فصل فعلی
         * @type {Object}
         */
        this.currentSeason = {
            number: 1,
            startDate: Date.now(),
            endDate: Date.now() + CONFIG.LEAGUE.SEASON.DURATION_MS,
            status: 'active',
            participants: []
        };

        /**
         * اطلاعات لیگ بازیکن فعلی
         * @type {Object}
         */
        this.playerLeague = {
            tier: 'bronze',
            division: 1,
            rating: 1000,
            seasonPoints: 0,
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            winRate: 0,
            currentStreak: 0,
            bestStreak: 0,
            rank: 0,
            totalPlayers: 0
        };

        /**
         * Leaderboard لیگ
         * @type {Array<Object>}
         */
        this.leaderboard = [];

        /**
         * تاریخچه فصل‌ها
         * @type {Array<Object>}
         */
        this.seasonHistory = [];

        /**
         * پاداش‌های دریافت شده
         * @type {Array<Object>}
         */
        this.claimedRewards = [];

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
         * آمار لیگ
         * @type {Object}
         */
        this.stats = {
            totalSeasons: 1,
            promotions: 0,
            demotions: 0,
            totalGames: 0,
            totalWins: 0,
            totalLosses: 0,
            highestTier: 'bronze',
            highestRank: 0,
            totalRewardsClaimed: 0
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری اطلاعات بازیکن
        const user = authManager?.getCurrentUser();
        if (user) {
            this.playerLeague.rating = user.profile?.rating || 1000;
            this.playerLeague.tier = user.profile?.league?.tier || 'bronze';
            this.playerLeague.division = user.profile?.league?.division || 1;
        }

        // بارگذاری داده‌های ذخیره شده
        this._loadData();

        // به‌روزرسانی Tier بر اساس Rating
        this._updateTierFromRating();

        // ایجاد Leaderboard نمونه
        this._generateSampleLeaderboard();

        if (this.debug) {
            console.log('🏅 LeagueManager initialized');
            console.log('  Current Tier:', this.playerLeague.tier);
            console.log('  Rating:', this.playerLeague.rating);
        }
    }

    // ============================================================
    // بخش ۱: مدیریت Tier
    // ============================================================

    /**
     * دریافت اطلاعات Tier فعلی
     * @returns {Object}
     */
    getCurrentTierInfo() {
        return this.tiers.find(t => t.ID === this.playerLeague.tier) || this.tiers[0];
    }

    /**
     * دریافت Tier بعدی
     * @returns {Object|null}
     */
    getNextTier() {
        const currentIndex = this.tiers.findIndex(t => t.ID === this.playerLeague.tier);
        if (currentIndex === -1 || currentIndex >= this.tiers.length - 1) {
            return null;
        }
        return this.tiers[currentIndex + 1];
    }

    /**
     * دریافت Tier قبلی
     * @returns {Object|null}
     */
    getPreviousTier() {
        const currentIndex = this.tiers.findIndex(t => t.ID === this.playerLeague.tier);
        if (currentIndex <= 0) {
            return null;
        }
        return this.tiers[currentIndex - 1];
    }

    /**
     * به‌روزرسانی Tier بر اساس Rating
     * @private
     */
    _updateTierFromRating() {
        const rating = this.playerLeague.rating;
        let newTier = 'bronze';

        for (const tier of this.tiers) {
            if (rating >= tier.MIN_RATING) {
                newTier = tier.ID;
            } else {
                break;
            }
        }

        if (newTier !== this.playerLeague.tier) {
            const oldTier = this.playerLeague.tier;
            this.playerLeague.tier = newTier;

            if (this.debug) {
                console.log(`🏅 Tier updated: ${oldTier} → ${newTier}`);
            }
        }
    }

    /**
     * محاسبه پیشرفت به Tier بعدی
     * @returns {Object}
     */
    getTierProgress() {
        const currentTier = this.getCurrentTierInfo();
        const nextTier = this.getNextTier();

        if (!nextTier) {
            return {
                isMaxTier: true,
                currentRating: this.playerLeague.rating,
                progress: 100,
                ratingToNext: 0,
                nextTier: null
            };
        }

        const ratingRange = nextTier.MIN_RATING - currentTier.MIN_RATING;
        const progress = ((this.playerLeague.rating - currentTier.MIN_RATING) / ratingRange) * 100;

        return {
            isMaxTier: false,
            currentRating: this.playerLeague.rating,
            progress: Math.min(100, Math.max(0, progress)),
            ratingToNext: nextTier.MIN_RATING - this.playerLeague.rating,
            nextTier: nextTier,
            currentTier: currentTier
        };
    }

    // ============================================================
    // بخش ۲: سیستم Promotion/Demotion
    // ============================================================

    /**
     * بررسی Promotion
     * @returns {Object} نتیجه
     */
    checkPromotion() {
        const currentTier = this.getCurrentTierInfo();
        const nextTier = this.getNextTier();

        if (!nextTier) {
            return {
                canPromote: false,
                reason: 'MAX_TIER',
                message: 'شما در بالاترین Tier هستید'
            };
        }

        if (this.playerLeague.rating >= nextTier.MIN_RATING) {
            return {
                canPromote: true,
                currentTier: currentTier,
                nextTier: nextTier,
                rating: this.playerLeague.rating,
                message: `تبریک! شما به ${nextTier.NAME} ارتقا یافتید`
            };
        }

        return {
            canPromote: false,
            reason: 'INSUFFICIENT_RATING',
            ratingNeeded: nextTier.MIN_RATING - this.playerLeague.rating,
            currentRating: this.playerLeague.rating,
            nextTier: nextTier
        };
    }

    /**
     * بررسی Demotion
     * @returns {Object} نتیجه
     */
    checkDemotion() {
        const currentTier = this.getCurrentTierInfo();
        const previousTier = this.getPreviousTier();

        if (!previousTier) {
            return {
                canDemote: false,
                reason: 'MIN_TIER',
                message: 'شما در پایین‌ترین Tier هستید'
            };
        }

        if (this.playerLeague.rating < currentTier.DEMOTION_RATING) {
            return {
                canDemote: true,
                currentTier: currentTier,
                previousTier: previousTier,
                rating: this.playerLeague.rating,
                message: `شما به ${previousTier.NAME} سقوط کردید`
            };
        }

        return {
            canDemote: false,
            ratingToDemotion: this.playerLeague.rating - currentTier.DEMOTION_RATING,
            currentRating: this.playerLeague.rating,
            currentTier: currentTier
        };
    }

    /**
     * انجام Promotion
     * @returns {Object} نتیجه
     */
    promote() {
        const promotionCheck = this.checkPromotion();

        if (!promotionCheck.canPromote) {
            return {
                success: false,
                error: promotionCheck.reason,
                message: promotionCheck.message
            };
        }

        const oldTier = this.playerLeague.tier;
        this.playerLeague.tier = promotionCheck.nextTier.ID;
        this.playerLeague.division = 1;
        this.stats.promotions++;

        if (this.tiers.findIndex(t => t.ID === this.playerLeague.tier) > 
            this.tiers.findIndex(t => t.ID === this.stats.highestTier)) {
            this.stats.highestTier = this.playerLeague.tier;
        }

        this._emit('tier-promoted', {
            oldTier,
            newTier: this.playerLeague.tier,
            tierInfo: promotionCheck.nextTier
        });

        this._saveData();

        if (this.debug) {
            console.log(`🎉 Promoted to ${this.playerLeague.tier}`);
        }

        return {
            success: true,
            oldTier,
            newTier: this.playerLeague.tier,
            tierInfo: promotionCheck.nextTier
        };
    }

    /**
     * انجام Demotion
     * @returns {Object} نتیجه
     */
    demote() {
        const demotionCheck = this.checkDemotion();

        if (!demotionCheck.canDemote) {
            return {
                success: false,
                error: demotionCheck.reason,
                message: demotionCheck.message
            };
        }

        const oldTier = this.playerLeague.tier;
        this.playerLeague.tier = demotionCheck.previousTier.ID;
        this.playerLeague.division = 1;
        this.stats.demotions++;

        this._emit('tier-demoted', {
            oldTier,
            newTier: this.playerLeague.tier,
            tierInfo: demotionCheck.previousTier
        });

        this._saveData();

        if (this.debug) {
            console.log(`😔 Demoted to ${this.playerLeague.tier}`);
        }

        return {
            success: true,
            oldTier,
            newTier: this.playerLeague.tier,
            tierInfo: demotionCheck.previousTier
        };
    }

    // ============================================================
    // بخش ۳: مدیریت فصل
    // ============================================================

    /**
     * دریافت اطلاعات فصل فعلی
     * @returns {Object}
     */
    getCurrentSeason() {
        return {
            ...this.currentSeason,
            daysRemaining: Math.ceil((this.currentSeason.endDate - Date.now()) / (1000 * 60 * 60 * 24)),
            hoursRemaining: Math.ceil((this.currentSeason.endDate - Date.now()) / (1000 * 60 * 60)),
            progress: this._getSeasonProgress()
        };
    }

    /**
     * محاسبه پیشرفت فصل
     * @returns {number} درصد
     * @private
     */
    _getSeasonProgress() {
        const totalDuration = this.currentSeason.endDate - this.currentSeason.startDate;
        const elapsed = Date.now() - this.currentSeason.startDate;
        return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    }

    /**
     * بررسی پایان فصل
     * @returns {boolean}
     */
    isSeasonEnded() {
        return Date.now() >= this.currentSeason.endDate;
    }

    /**
     * پایان فصل و شروع فصل جدید
     * @returns {Object} نتیجه
     */
    endSeason() {
        if (!this.isSeasonEnded()) {
            return {
                success: false,
                error: 'SEASON_NOT_ENDED',
                message: 'فصل هنوز تمام نشده است'
            };
        }

        // ذخیره فصل فعلی در تاریخچه
        const seasonRecord = {
            number: this.currentSeason.number,
            startDate: this.currentSeason.startDate,
            endDate: this.currentSeason.endDate,
            finalTier: this.playerLeague.tier,
            finalRating: this.playerLeague.rating,
            finalRank: this.playerLeague.rank,
            gamesPlayed: this.playerLeague.gamesPlayed,
            wins: this.playerLeague.wins,
            losses: this.playerLeague.losses,
            winRate: this.playerLeague.winRate,
            rewards: this._calculateSeasonRewards()
        };

        this.seasonHistory.push(seasonRecord);
        this.stats.totalSeasons++;

        // محاسبه و اعطای پاداش‌ها
        const rewards = this._calculateSeasonRewards();
        this._awardSeasonRewards(rewards);

        // شروع فصل جدید
        this.currentSeason = {
            number: this.currentSeason.number + 1,
            startDate: Date.now(),
            endDate: Date.now() + CONFIG.LEAGUE.SEASON.DURATION_MS,
            status: 'active',
            participants: []
        };

        // ریست آمار فصل
        this.playerLeague.seasonPoints = 0;
        this.playerLeague.gamesPlayed = 0;
        this.playerLeague.wins = 0;
        this.playerLeague.losses = 0;

        this._emit('season-ended', {
            oldSeason: seasonRecord,
            newSeason: this.currentSeason,
            rewards
        });

        this._saveData();

        if (this.debug) {
            console.log(`🏆 Season ${seasonRecord.number} ended. Starting season ${this.currentSeason.number}`);
        }

        return {
            success: true,
            oldSeason: seasonRecord,
            newSeason: this.currentSeason,
            rewards
        };
    }

    /**
     * محاسبه پاداش‌های فصل
     * @returns {Object}
     * @private
     */
    _calculateSeasonRewards() {
        const tierInfo = this.getCurrentTierInfo();
        const rewards = {
            coins: 0,
            gems: 0,
            xp: 0,
            items: [],
            title: null,
            frame: null
        };

        // پاداش پایه بر اساس Tier
        if (tierInfo.REWARDS) {
            rewards.coins = tierInfo.REWARDS.COINS || 0;
            rewards.xp = tierInfo.REWARDS.XP || 0;
            rewards.gems = tierInfo.REWARDS.GEMS || 0;

            if (tierInfo.REWARDS.FRAME_ID) {
                rewards.frame = tierInfo.REWARDS.FRAME_ID;
            }

            if (tierInfo.REWARDS.TITLE_ID) {
                rewards.title = tierInfo.REWARDS.TITLE_ID;
            }
        }

        // پاداش بر اساس Rank
        if (this.playerLeague.rank <= 10) {
            rewards.coins += 5000;
            rewards.gems += 200;
        } else if (this.playerLeague.rank <= 50) {
            rewards.coins += 2000;
            rewards.gems += 100;
        } else if (this.playerLeague.rank <= 100) {
            rewards.coins += 1000;
            rewards.gems += 50;
        }

        // پاداش بر اساس Win Rate
        if (this.playerLeague.winRate >= 70) {
            rewards.coins += 2000;
        } else if (this.playerLeague.winRate >= 60) {
            rewards.coins += 1000;
        } else if (this.playerLeague.winRate >= 50) {
            rewards.coins += 500;
        }

        return rewards;
    }

    /**
     * اعطای پاداش‌های فصل
     * @param {Object} rewards - پاداش‌ها
     * @private
     */
    _awardSeasonRewards(rewards) {
        const user = authManager?.getCurrentUser();
        if (!user) return;

        if (rewards.coins > 0) {
            user.profile.coins = (user.profile.coins || 0) + rewards.coins;
        }

        if (rewards.gems > 0) {
            user.profile.gems = (user.profile.gems || 0) + rewards.gems;
        }

        if (rewards.xp > 0) {
            user.profile.xp = (user.profile.xp || 0) + rewards.xp;
        }

        if (rewards.frame) {
            if (!user.profile.inventory) user.profile.inventory = {};
            if (!user.profile.inventory.frames) user.profile.inventory.frames = [];
            if (!user.profile.inventory.frames.includes(rewards.frame)) {
                user.profile.inventory.frames.push(rewards.frame);
            }
        }

        if (rewards.title) {
            if (!user.profile.inventory) user.profile.inventory = {};
            if (!user.profile.inventory.titles) user.profile.inventory.titles = [];
            if (!user.profile.inventory.titles.includes(rewards.title)) {
                user.profile.inventory.titles.push(rewards.title);
            }
        }

        if (storage) {
            storage.saveUserProfile(user);
        }

        this.stats.totalRewardsClaimed++;

        if (this.debug) {
            console.log('💰 Season rewards awarded:', rewards);
        }
    }

    // ============================================================
    // بخش ۴: Leaderboard
    // ============================================================

    /**
     * دریافت Leaderboard لیگ
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getLeaderboard(options = {}) {
        const {
            tier = null,
            limit = 100,
            offset = 0
        } = options;

        let filtered = [...this.leaderboard];

        if (tier) {
            filtered = filtered.filter(p => p.tier === tier);
        }

        return filtered.slice(offset, offset + limit);
    }

    /**
     * دریافت رتبه بازیکن
     * @returns {number}
     */
    getPlayerRank() {
        const sorted = [...this.leaderboard].sort((a, b) => b.rating - a.rating);
        const index = sorted.findIndex(p => p.id === authManager?.getCurrentUser()?.id);
        return index !== -1 ? index + 1 : 0;
    }

    /**
     * به‌روزرسانی Leaderboard
     * @param {Object} playerData - داده بازیکن
     * @returns {void}
     */
    updateLeaderboard(playerData) {
        const existingIndex = this.leaderboard.findIndex(p => p.id === playerData.id);

        if (existingIndex !== -1) {
            this.leaderboard[existingIndex] = {
                ...this.leaderboard[existingIndex],
                ...playerData,
                updatedAt: Date.now()
            };
        } else {
            this.leaderboard.push({
                ...playerData,
                tier: this.playerLeague.tier,
                joinedAt: Date.now(),
                updatedAt: Date.now()
            });
        }

        // مرتب‌سازی
        this.leaderboard.sort((a, b) => b.rating - a.rating);

        // به‌روزرسانی رتبه بازیکن
        this.playerLeague.rank = this.getPlayerRank();
        this.playerLeague.totalPlayers = this.leaderboard.length;
    }

    /**
     * ایجاد Leaderboard نمونه
     * @private
     */
    _generateSampleLeaderboard() {
        const samplePlayers = [
            { id: 'p1', username: 'ProPlayer1', rating: 2800, tier: 'diamond', wins: 150, losses: 50 },
            { id: 'p2', username: 'MasterGamer', rating: 2600, tier: 'diamond', wins: 120, losses: 60 },
            { id: 'p3', username: 'ElitePlayer', rating: 2400, tier: 'platinum', wins: 100, losses: 70 },
            { id: 'p4', username: 'SkilledOne', rating: 2200, tier: 'platinum', wins: 90, losses: 80 },
            { id: 'p5', username: 'GoodPlayer', rating: 2000, tier: 'platinum', wins: 80, losses: 90 },
            { id: 'p6', username: 'AverageJoe', rating: 1800, tier: 'gold', wins: 70, losses: 100 },
            { id: 'p7', username: 'CasualGamer', rating: 1600, tier: 'gold', wins: 60, losses: 110 },
            { id: 'p8', username: 'NewPlayer1', rating: 1400, tier: 'silver', wins: 50, losses: 120 },
            { id: 'p9', username: 'NewPlayer2', rating: 1200, tier: 'silver', wins: 40, losses: 130 },
            { id: 'p10', username: 'Beginner1', rating: 1000, tier: 'bronze', wins: 30, losses: 140 }
        ];

        this.leaderboard = samplePlayers;

        // اضافه کردن بازیکن فعلی
        const user = authManager?.getCurrentUser();
        if (user) {
            this.updateLeaderboard({
                id: user.id,
                username: user.username,
                rating: this.playerLeague.rating,
                tier: this.playerLeague.tier,
                wins: this.playerLeague.wins,
                losses: this.playerLeague.losses
            });
        }
    }

    // ============================================================
    // بخش ۵: به‌روزرسانی آمار بازی
    // ============================================================

    /**
     * ثبت نتیجه بازی
     * @param {Object} gameResult - نتیجه بازی
     * @returns {Object} نتیجه
     */
    recordGameResult(gameResult) {
        const {
            isWinner,
            ratingChange = 0,
            coinsEarned = 0,
            xpEarned = 0
        } = gameResult;

        // به‌روزرسانی Rating
        this.playerLeague.rating = Math.max(0, this.playerLeague.rating + ratingChange);

        // به‌روزرسانی آمار
        this.playerLeague.gamesPlayed++;
        this.stats.totalGames++;

        if (isWinner) {
            this.playerLeague.wins++;
            this.playerLeague.currentStreak++;
            this.stats.totalWins++;

            if (this.playerLeague.currentStreak > this.playerLeague.bestStreak) {
                this.playerLeague.bestStreak = this.playerLeague.currentStreak;
            }
        } else {
            this.playerLeague.losses++;
            this.playerLeague.currentStreak = 0;
            this.stats.totalLosses++;
        }

        // محاسبه Win Rate
        this.playerLeague.winRate = (this.playerLeague.wins / this.playerLeague.gamesPlayed) * 100;

        // به‌روزرسانی Tier
        this._updateTierFromRating();

        // بررسی Promotion/Demotion
        const promotionCheck = this.checkPromotion();
        const demotionCheck = this.checkDemotion();

        let tierChanged = false;
        if (promotionCheck.canPromote) {
            this.promote();
            tierChanged = true;
        } else if (demotionCheck.canDemote) {
            this.demote();
            tierChanged = true;
        }

        // به‌روزرسانی Leaderboard
        const user = authManager?.getCurrentUser();
        if (user) {
            this.updateLeaderboard({
                id: user.id,
                username: user.username,
                rating: this.playerLeague.rating,
                tier: this.playerLeague.tier,
                wins: this.playerLeague.wins,
                losses: this.playerLeague.losses
            });
        }

        // ذخیره داده‌ها
        this._saveData();

        this._emit('game-recorded', {
            gameResult,
            playerLeague: this.playerLeague,
            tierChanged
        });

        if (this.debug) {
            console.log(`📊 Game recorded: ${isWinner ? 'Win' : 'Loss'}, Rating: ${this.playerLeague.rating}`);
        }

        return {
            success: true,
            playerLeague: this.playerLeague,
            tierChanged,
            promotion: promotionCheck.canPromote ? promotionCheck : null,
            demotion: demotionCheck.canDemote ? demotionCheck : null
        };
    }

    // ============================================================
    // بخش ۶: پاداش‌ها
    // ============================================================

    /**
     * دریافت پاداش‌های قابل دریافت
     * @returns {Array<Object>}
     */
    getAvailableRewards() {
        const rewards = [];

        // پاداش روزانه
        if (this._canClaimDailyReward()) {
            rewards.push({
                type: 'daily',
                coins: 100,
                xp: 50,
                description: 'پاداش ورود روزانه'
            });
        }

        // پاداش برد متوالی
        if (this.playerLeague.currentStreak >= 3) {
            rewards.push({
                type: 'streak',
                coins: this.playerLeague.currentStreak * 50,
                xp: this.playerLeague.currentStreak * 25,
                description: `پاداش ${this.playerLeague.currentStreak} برد متوالی`
            });
        }

        // پاداش Tier
        const tierInfo = this.getCurrentTierInfo();
        if (tierInfo.REWARDS && tierInfo.REWARDS.COINS > 0) {
            rewards.push({
                type: 'tier',
                coins: tierInfo.REWARDS.COINS,
                xp: tierInfo.REWARDS.XP || 0,
                description: `پاداش Tier ${tierInfo.NAME}`
            });
        }

        return rewards;
    }

    /**
     * بررسی امکان دریافت پاداش روزانه
     * @returns {boolean}
     * @private
     */
    _canClaimDailyReward() {
        const lastClaimed = this.claimedRewards.find(r => r.type === 'daily');
        if (!lastClaimed) return true;

        const lastDate = new Date(lastClaimed.claimedAt).toDateString();
        const today = new Date().toDateString();

        return lastDate !== today;
    }

    /**
     * دریافت پاداش
     * @param {string} rewardType - نوع پاداش
     * @returns {Object} نتیجه
     */
    claimReward(rewardType) {
        const availableRewards = this.getAvailableRewards();
        const reward = availableRewards.find(r => r.type === rewardType);

        if (!reward) {
            return {
                success: false,
                error: 'REWARD_NOT_AVAILABLE',
                message: 'این پاداش در دسترس نیست'
            };
        }

        // بررسی تکراری نبودن
        const alreadyClaimed = this.claimedRewards.find(r => 
            r.type === rewardType && 
            new Date(r.claimedAt).toDateString() === new Date().toDateString()
        );

        if (alreadyClaimed) {
            return {
                success: false,
                error: 'ALREADY_CLAIMED',
                message: 'شما قبلاً این پاداش را دریافت کرده‌اید'
            };
        }

        // اعطای پاداش
        const user = authManager?.getCurrentUser();
        if (user) {
            user.profile.coins = (user.profile.coins || 0) + reward.coins;
            user.profile.xp = (user.profile.xp || 0) + reward.xp;

            if (storage) {
                storage.saveUserProfile(user);
            }
        }

        // ثبت پاداش
        this.claimedRewards.push({
            type: rewardType,
            coins: reward.coins,
            xp: reward.xp,
            claimedAt: Date.now()
        });

        this._emit('reward-claimed', {
            rewardType,
            reward
        });

        if (this.debug) {
            console.log(`💰 Reward claimed: ${rewardType}`);
        }

        return {
            success: true,
            reward
        };
    }

    // ============================================================
    // بخش ۷: تاریخچه و آمار
    // ============================================================

    /**
     * دریافت تاریخچه فصل‌ها
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getSeasonHistory(limit = 10) {
        return this.seasonHistory.slice(-limit).reverse();
    }

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            playerLeague: this.playerLeague,
            currentSeason: this.getCurrentSeason(),
            tierProgress: this.getTierProgress()
        };
    }

    /**
     * دریافت اطلاعات کامل لیگ
     * @returns {Object}
     */
    getLeagueInfo() {
        return {
            playerLeague: this.playerLeague,
            currentTier: this.getCurrentTierInfo(),
            nextTier: this.getNextTier(),
            previousTier: this.getPreviousTier(),
            tierProgress: this.getTierProgress(),
            promotion: this.checkPromotion(),
            demotion: this.checkDemotion(),
            currentSeason: this.getCurrentSeason(),
            rank: this.getPlayerRank(),
            totalPlayers: this.leaderboard.length
        };
    }

    // ============================================================
    // بخش ۸: ذخیره و بارگذاری
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('league_player', this.playerLeague);
            storage.set('league_stats', this.stats);
            storage.set('league_season', this.currentSeason);
            storage.set('league_history', this.seasonHistory);
            storage.set('league_rewards', this.claimedRewards);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const savedPlayer = storage.get('league_player');
            if (savedPlayer) {
                this.playerLeague = { ...this.playerLeague, ...savedPlayer };
            }

            const savedStats = storage.get('league_stats');
            if (savedStats) {
                this.stats = { ...this.stats, ...savedStats };
            }

            const savedSeason = storage.get('league_season');
            if (savedSeason) {
                this.currentSeason = { ...this.currentSeason, ...savedSeason };
            }

            const savedHistory = storage.get('league_history');
            if (savedHistory) {
                this.seasonHistory = savedHistory;
            }

            const savedRewards = storage.get('league_rewards');
            if (savedRewards) {
                this.claimedRewards = savedRewards;
            }
        }
    }

    // ============================================================
    // بخش ۹: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.playerLeague = {
            tier: 'bronze',
            division: 1,
            rating: 1000,
            seasonPoints: 0,
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            winRate: 0,
            currentStreak: 0,
            bestStreak: 0,
            rank: 0,
            totalPlayers: 0
        };

        this.stats = {
            totalSeasons: 1,
            promotions: 0,
            demotions: 0,
            totalGames: 0,
            totalWins: 0,
            totalLosses: 0,
            highestTier: 'bronze',
            highestRank: 0,
            totalRewardsClaimed: 0
        };

        this.currentSeason = {
            number: 1,
            startDate: Date.now(),
            endDate: Date.now() + CONFIG.LEAGUE.SEASON.DURATION_MS,
            status: 'active',
            participants: []
        };

        this.seasonHistory = [];
        this.claimedRewards = [];

        this._generateSampleLeaderboard();
        this._saveData();

        if (this.debug) {
            console.log('🔄 LeagueManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const info = this.getLeagueInfo();
        const stats = this.getStats();

        console.log('🏅 LeagueManager Status:');
        console.log('  Current Tier:', info.playerLeague.tier);
        console.log('  Rating:', info.playerLeague.rating);
        console.log('  Rank:', info.rank, '/', info.totalPlayers);
        console.log('  Win Rate:', info.playerLeague.winRate.toFixed(1) + '%');
        console.log('  Current Streak:', info.playerLeague.currentStreak);
        console.log('  Best Streak:', info.playerLeague.bestStreak);
        console.log('  Season:', info.currentSeason.number);
        console.log('  Days Remaining:', info.currentSeason.daysRemaining);
        console.log('  Tier Progress:', info.tierProgress.progress.toFixed(1) + '%');
        console.log('  Total Seasons:', stats.totalSeasons);
        console.log('  Promotions:', stats.promotions);
        console.log('  Demotions:', stats.demotions);
    }

    // ============================================================
    // بخش ۱۰: Event System
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
                    console.error(`❌ League event listener error:`, error);
                }
            });
        }

        eventBus.emit(`league:${event}`, data);
    }

    /**
     * پاک کردن شنوندگان
     */
    clearListeners() {
        this.listeners.clear();
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const leagueManager = new LeagueManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LeagueManager, leagueManager };
} else {
    window.LeagueManager = LeagueManager;
    window.leagueManager = leagueManager;
}

console.log('✅ LeagueManager loaded');
