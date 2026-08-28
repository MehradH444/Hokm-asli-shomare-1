/**
 * ============================================================
 * HOKM MASTER - League Rewards Manager
 * سیستم مدیریت پاداش‌های لیگ
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم پاداش‌های لیگ است.
 * شامل پاداش‌های Tier-based، پاداش‌های پایان فصل،
 * پاداش‌های روزانه و هفتگی، سیستم claim کردن پاداش،
 * تاریخچه پاداش‌های دریافتی، و آمار پاداش‌ها.
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
 * - leagueManager (از فایل league.js)
 * - seasonManager (از فایل season.js)
 * - scoringEngine (از فایل scoring.js)
 * 
 * ============================================================
 */

class LeagueRewardsManager {

    constructor() {
        /**
         * پاداش‌های Tier-based
         * @type {Object}
         */
        this.tierRewards = {
            bronze: {
                coins: 500,
                xp: 50,
                gems: 0,
                items: [],
                description: 'پاداش سطح برنز'
            },
            silver: {
                coins: 1000,
                xp: 100,
                gems: 0,
                items: [{ type: 'frame', id: 2 }],
                description: 'پاداش سطح نقره'
            },
            gold: {
                coins: 2000,
                xp: 200,
                gems: 0,
                items: [{ type: 'frame', id: 3 }],
                description: 'پاداش سطح طلا'
            },
            platinum: {
                coins: 5000,
                xp: 500,
                gems: 100,
                items: [{ type: 'frame', id: 4 }],
                description: 'پاداش سطح پلاتین'
            },
            diamond: {
                coins: 10000,
                xp: 1000,
                gems: 250,
                items: [{ type: 'frame', id: 5 }],
                description: 'پاداش سطح الماس'
            },
            master: {
                coins: 25000,
                xp: 2500,
                gems: 500,
                items: [
                    { type: 'frame', id: 6 },
                    { type: 'title', id: 1 }
                ],
                description: 'پاداش سطح مستر'
            }
        };

        /**
         * پاداش‌های رتبه‌ای پایان فصل
         * @type {Object}
         */
        this.rankRewards = {
            top1: {
                coins: 100000,
                gems: 1000,
                xp: 10000,
                title: 'قهرمان فصل',
                badge: 'champion',
                description: 'مقام اول فصل'
            },
            top10: {
                coins: 50000,
                gems: 500,
                xp: 5000,
                title: 'برتر فصل',
                description: '10 بازیکن برتر فصل'
            },
            top50: {
                coins: 20000,
                gems: 200,
                xp: 2000,
                description: '50 بازیکن برتر فصل'
            },
            top100: {
                coins: 10000,
                gems: 100,
                xp: 1000,
                description: '100 بازیکن برتر فصل'
            }
        };

        /**
         * پاداش‌های روزانه
         * @type {Array<Object>}
         */
        this.dailyRewards = [
            { day: 1, coins: 100, xp: 20 },
            { day: 2, coins: 150, xp: 30 },
            { day: 3, coins: 200, xp: 40 },
            { day: 4, coins: 300, xp: 50 },
            { day: 5, coins: 400, xp: 60 },
            { day: 6, coins: 500, xp: 80 },
            { day: 7, coins: 1000, xp: 100, gems: 10 }
        ];

        /**
         * پاداش‌های هفتگی
         * @type {Object}
         */
        this.weeklyRewards = {
            coins: 5000,
            gems: 50,
            xp: 500,
            description: 'پاداش هفتگی'
        };

        /**
         * پاداش‌های claim شده
         * @type {Array<Object>}
         */
        this.claimedRewards = [];

        /**
         * وضعیت claim روزانه
         * @type {Object}
         */
        this.dailyClaimStatus = {
            currentDay: 1,
            lastClaimedAt: null,
            streak: 0,
            cycle: 1
        };

        /**
         * وضعیت claim هفتگی
         * @type {Object}
         */
        this.weeklyClaimStatus = {
            lastClaimedAt: null,
            weekNumber: 1
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
         * آمار پاداش‌ها
         * @type {Object}
         */
        this.stats = {
            totalRewardsClaimed: 0,
            totalCoinsEarned: 0,
            totalGemsEarned: 0,
            totalXpEarned: 0,
            dailyRewardsClaimed: 0,
            weeklyRewardsClaimed: 0,
            tierRewardsClaimed: 0,
            seasonRewardsClaimed: 0
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری داده‌ها
        this._loadData();

        // بررسی وضعیت claim روزانه
        this._checkDailyClaimStatus();

        // بررسی وضعیت claim هفتگی
        this._checkWeeklyClaimStatus();

        if (this.debug) {
            console.log('🎁 LeagueRewardsManager initialized');
            console.log('  Daily Day:', this.dailyClaimStatus.currentDay);
            console.log('  Daily Streak:', this.dailyClaimStatus.streak);
        }
    }

    // ============================================================
    // بخش ۱: پاداش‌های Tier-based
    // ============================================================

    /**
     * دریافت پاداش Tier فعلی بازیکن
     * @returns {Object} پاداش
     */
    getCurrentTierReward() {
        const user = authManager?.getCurrentUser();
        if (!user) return null;

        const tier = user.profile?.league?.tier || 'bronze';
        return this.tierRewards[tier] || this.tierRewards.bronze;
    }

    /**
     * claim کردن پاداش Tier
     * @returns {Object} نتیجه
     */
    claimTierReward() {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای دریافت پاداش باید وارد شوید'
            };
        }

        const tier = user.profile?.league?.tier || 'bronze';
        const reward = this.tierRewards[tier];

        if (!reward) {
            return {
                success: false,
                error: 'INVALID_TIER',
                message: 'Tier نامعتبر است'
            };
        }

        // بررسی تکراری نبودن در این فصل
        const seasonNumber = seasonManager?.currentSeason?.number || 1;
        const alreadyClaimed = this.claimedRewards.find(r =>
            r.type === 'tier' &&
            r.tier === tier &&
            r.season === seasonNumber
        );

        if (alreadyClaimed) {
            return {
                success: false,
                error: 'ALREADY_CLAIMED',
                message: 'شما قبلاً این پاداش را در این فصل دریافت کرده‌اید'
            };
        }

        // اعطای پاداش
        this._awardReward(user, reward);

        // ثبت در تاریخچه
        this.claimedRewards.push({
            type: 'tier',
            tier,
            season: seasonNumber,
            reward: { ...reward },
            claimedAt: Date.now()
        });

        this.stats.tierRewardsClaimed++;
        this._updateStats(reward);

        this._emit('tier-reward-claimed', {
            tier,
            reward
        });

        if (this.debug) {
            console.log(` Tier reward claimed: ${tier}`);
        }

        return {
            success: true,
            tier,
            reward
        };
    }

    /**
     * بررسی آیا پاداش Tier قابل دریافت است
     * @returns {Object}
     */
    canClaimTierReward() {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return { canClaim: false, reason: 'NOT_LOGGED_IN' };
        }

        const tier = user.profile?.league?.tier || 'bronze';
        const seasonNumber = seasonManager?.currentSeason?.number || 1;

        const alreadyClaimed = this.claimedRewards.find(r =>
            r.type === 'tier' &&
            r.tier === tier &&
            r.season === seasonNumber
        );

        if (alreadyClaimed) {
            return { canClaim: false, reason: 'ALREADY_CLAIMED' };
        }

        return {
            canClaim: true,
            tier,
            reward: this.tierRewards[tier]
        };
    }

    // ============================================================
    // بخش ۲: پاداش‌های روزانه
    // ============================================================

    /**
     * دریافت پاداش روزانه فعلی
     * @returns {Object} پاداش
     */
    getCurrentDailyReward() {
        const day = this.dailyClaimStatus.currentDay;
        return this.dailyRewards[(day - 1) % this.dailyRewards.length] || this.dailyRewards[0];
    }

    /**
     * claim کردن پاداش روزانه
     * @returns {Object} نتیجه
     */
    claimDailyReward() {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای دریافت پاداش باید وارد شوید'
            };
        }

        // بررسی امکان claim
        if (!this._canClaimDaily()) {
            return {
                success: false,
                error: 'NOT_AVAILABLE',
                message: 'پاداش روزانه در دسترس نیست',
                nextAvailableAt: this._getNextDailyClaimTime()
            };
        }

        const reward = this.getCurrentDailyReward();

        // اعمال streak bonus
        const streakBonus = this._calculateStreakBonus();
        const finalReward = {
            ...reward,
            coins: Math.floor(reward.coins * streakBonus),
            xp: Math.floor(reward.xp * streakBonus),
            streakBonus
        };

        // اعطای پاداش
        this._awardReward(user, finalReward);

        // به‌روزرسانی وضعیت
        this.dailyClaimStatus.lastClaimedAt = Date.now();
        this.dailyClaimStatus.streak++;

        // بررسی تکمیل چرخه
        if (this.dailyClaimStatus.currentDay >= 7) {
            this.dailyClaimStatus.currentDay = 1;
            this.dailyClaimStatus.cycle++;
        } else {
            this.dailyClaimStatus.currentDay++;
        }

        // ثبت در تاریخچه
        this.claimedRewards.push({
            type: 'daily',
            day: this.dailyClaimStatus.currentDay - 1,
            cycle: this.dailyClaimStatus.cycle,
            reward: { ...finalReward },
            claimedAt: Date.now()
        });

        this.stats.dailyRewardsClaimed++;
        this._updateStats(finalReward);

        this._emit('daily-reward-claimed', {
            day: this.dailyClaimStatus.currentDay - 1,
            reward: finalReward,
            streak: this.dailyClaimStatus.streak
        });

        if (this.debug) {
            console.log(`🎁 Daily reward claimed: Day ${this.dailyClaimStatus.currentDay - 1}`);
        }

        return {
            success: true,
            reward: finalReward,
            streak: this.dailyClaimStatus.streak
        };
    }

    /**
     * بررسی امکان claim روزانه
     * @returns {boolean}
     * @private
     */
    _canClaimDaily() {
        if (!this.dailyClaimStatus.lastClaimedAt) {
            return true;
        }

        const lastClaimed = new Date(this.dailyClaimStatus.lastClaimedAt);
        const now = new Date();

        // اگر روز تغییر کرده باشد
        return lastClaimed.toDateString() !== now.toDateString();
    }

    /**
     * دریافت زمان بعدی claim روزانه
     * @returns {number} timestamp
     * @private
     */
    _getNextDailyClaimTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        return tomorrow.getTime();
    }

    /**
     * محاسبه bonus streak
     * @returns {number} ضریب
     * @private
     */
    _calculateStreakBonus() {
        const streak = this.dailyClaimStatus.streak;

        if (streak >= 7) return 2.0;
        if (streak >= 5) return 1.5;
        if (streak >= 3) return 1.2;

        return 1.0;
    }

    /**
     * دریافت وضعیت claim روزانه
     * @returns {Object}
     */
    getDailyClaimStatus() {
        return {
            ...this.dailyClaimStatus,
            currentReward: this.getCurrentDailyReward(),
            canClaim: this._canClaimDaily(),
            streakBonus: this._calculateStreakBonus(),
            nextClaimAt: this._getNextDailyClaimTime()
        };
    }

    /**
     * بررسی وضعیت claim روزانه
     * @private
     */
    _checkDailyClaimStatus() {
        if (!this.dailyClaimStatus.lastClaimedAt) return;

        const lastClaimed = new Date(this.dailyClaimStatus.lastClaimedAt);
        const now = new Date();

        // اگر بیشتر از 2 روز گذشته باشد، streak ریست شود
        const daysDiff = Math.floor((now - lastClaimed) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 2) {
            this.dailyClaimStatus.streak = 0;
            this.dailyClaimStatus.currentDay = 1;
            this.dailyClaimStatus.cycle = 1;

            if (this.debug) {
                console.log('🔄 Daily streak reset');
            }
        }
    }

    // ============================================================
    // بخش ۳: پاداش‌های هفتگی
    // ============================================================

    /**
     * دریافت پاداش هفتگی
     * @returns {Object} پاداش
     */
    getWeeklyReward() {
        return { ...this.weeklyRewards };
    }

    /**
     * claim کردن پاداش هفتگی
     * @returns {Object} نتیجه
     */
    claimWeeklyReward() {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای دریافت پاداش باید وارد شوید'
            };
        }

        // بررسی امکان claim
        if (!this._canClaimWeekly()) {
            return {
                success: false,
                error: 'NOT_AVAILABLE',
                message: 'پاداش هفتگی در دسترس نیست',
                nextAvailableAt: this._getNextWeeklyClaimTime()
            };
        }

        const reward = this.getWeeklyReward();

        // اعطای پاداش
        this._awardReward(user, reward);

        // به‌روزرسانی وضعیت
        this.weeklyClaimStatus.lastClaimedAt = Date.now();
        this.weeklyClaimStatus.weekNumber++;

        // ثبت در تاریخچه
        this.claimedRewards.push({
            type: 'weekly',
            week: this.weeklyClaimStatus.weekNumber - 1,
            reward: { ...reward },
            claimedAt: Date.now()
        });

        this.stats.weeklyRewardsClaimed++;
        this._updateStats(reward);

        this._emit('weekly-reward-claimed', {
            week: this.weeklyClaimStatus.weekNumber - 1,
            reward
        });

        if (this.debug) {
            console.log(` Weekly reward claimed: Week ${this.weeklyClaimStatus.weekNumber - 1}`);
        }

        return {
            success: true,
            reward
        };
    }

    /**
     * بررسی امکان claim هفتگی
     * @returns {boolean}
     * @private
     */
    _canClaimWeekly() {
        if (!this.weeklyClaimStatus.lastClaimedAt) {
            return true;
        }

        const lastClaimed = new Date(this.weeklyClaimStatus.lastClaimedAt);
        const now = new Date();

        // اگر هفته تغییر کرده باشد (7 روز)
        const daysDiff = Math.floor((now - lastClaimed) / (1000 * 60 * 60 * 24));
        return daysDiff >= 7;
    }

    /**
     * دریافت زمان بعدی claim هفتگی
     * @returns {number} timestamp
     * @private
     */
    _getNextWeeklyClaimTime() {
        if (!this.weeklyClaimStatus.lastClaimedAt) {
            return Date.now();
        }

        return this.weeklyClaimStatus.lastClaimedAt + (7 * 24 * 60 * 60 * 1000);
    }

    /**
     * بررسی وضعیت claim هفتگی
     * @private
     */
    _checkWeeklyClaimStatus() {
        // پیاده‌سازی مشابه daily
    }

    /**
     * دریافت وضعیت claim هفتگی
     * @returns {Object}
     */
    getWeeklyClaimStatus() {
        return {
            ...this.weeklyClaimStatus,
            currentReward: this.getWeeklyReward(),
            canClaim: this._canClaimWeekly(),
            nextClaimAt: this._getNextWeeklyClaimTime()
        };
    }

    // ============================================================
    // بخش : پاداش‌های پایان فصل
    // ============================================================

    /**
     * محاسبه پاداش پایان فصل
     * @param {Object} playerData - داده بازیکن
     * @returns {Object} پاداش
     */
    calculateSeasonEndReward(playerData) {
        const {
            tier,
            rank,
            totalPlayers
        } = playerData;

        const rewards = {
            coins: 0,
            gems: 0,
            xp: 0,
            items: [],
            title: null,
            badge: null,
            breakdown: []
        };

        // پاداش Tier
        const tierReward = this.tierRewards[tier];
        if (tierReward) {
            rewards.coins += tierReward.coins;
            rewards.gems += tierReward.gems;
            rewards.xp += tierReward.xp;
            rewards.items.push(...(tierReward.items || []));

            rewards.breakdown.push({
                type: 'tier',
                tier,
                coins: tierReward.coins,
                gems: tierReward.gems,
                xp: tierReward.xp
            });
        }

        // پاداش رتبه
        const percentile = (rank / totalPlayers) * 100;

        if (rank === 1) {
            const rankReward = this.rankRewards.top1;
            rewards.coins += rankReward.coins;
            rewards.gems += rankReward.gems;
            rewards.xp += rankReward.xp;
            rewards.title = rankReward.title;
            rewards.badge = rankReward.badge;

            rewards.breakdown.push({
                type: 'rank',
                rank: 1,
                coins: rankReward.coins,
                gems: rankReward.gems,
                xp: rankReward.xp,
                title: rankReward.title
            });
        } else if (rank <= 10) {
            const rankReward = this.rankRewards.top10;
            rewards.coins += rankReward.coins;
            rewards.gems += rankReward.gems;
            rewards.xp += rankReward.xp;
            rewards.title = rankReward.title;

            rewards.breakdown.push({
                type: 'rank',
                rank,
                coins: rankReward.coins,
                gems: rankReward.gems,
                xp: rankReward.xp
            });
        } else if (rank <= 50) {
            const rankReward = this.rankRewards.top50;
            rewards.coins += rankReward.coins;
            rewards.gems += rankReward.gems;
            rewards.xp += rankReward.xp;

            rewards.breakdown.push({
                type: 'rank',
                rank,
                coins: rankReward.coins,
                gems: rankReward.gems,
                xp: rankReward.xp
            });
        } else if (rank <= 100) {
            const rankReward = this.rankRewards.top100;
            rewards.coins += rankReward.coins;
            rewards.gems += rankReward.gems;
            rewards.xp += rankReward.xp;

            rewards.breakdown.push({
                type: 'rank',
                rank,
                coins: rankReward.coins,
                gems: rankReward.gems,
                xp: rankReward.xp
            });
        }

        return rewards;
    }

    /**
     * claim کردن پاداش پایان فصل
     * @param {Object} playerData - داده بازیکن
     * @returns {Object} نتیجه
     */
    claimSeasonEndReward(playerData) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای دریافت پاداش باید وارد شوید'
            };
        }

        const seasonNumber = seasonManager?.currentSeason?.number || 1;

        // بررسی تکراری نبودن
        const alreadyClaimed = this.claimedRewards.find(r =>
            r.type === 'season_end' &&
            r.season === seasonNumber
        );

        if (alreadyClaimed) {
            return {
                success: false,
                error: 'ALREADY_CLAIMED',
                message: 'شما قبلاً پاداش پایان فصل را دریافت کرده‌اید'
            };
        }

        const reward = this.calculateSeasonEndReward(playerData);

        // اعطای پاداش
        this._awardReward(user, reward);

        // ثبت در تاریخچه
        this.claimedRewards.push({
            type: 'season_end',
            season: seasonNumber,
            rank: playerData.rank,
            tier: playerData.tier,
            reward: { ...reward },
            claimedAt: Date.now()
        });

        this.stats.seasonRewardsClaimed++;
        this._updateStats(reward);

        this._emit('season-end-reward-claimed', {
            season: seasonNumber,
            rank: playerData.rank,
            reward
        });

        if (this.debug) {
            console.log(`🏆 Season end reward claimed: Rank ${playerData.rank}`);
        }

        return {
            success: true,
            reward
        };
    }

    // ============================================================
    // بخش ۵: سیستم claim عمومی
    // ============================================================

    /**
     * اعطای پاداش به بازیکن
     * @param {Object} user - کاربر
     * @param {Object} reward - پاداش
     * @private
     */
    _awardReward(user, reward) {
        if (reward.coins > 0) {
            user.profile.coins = (user.profile.coins || 0) + reward.coins;
        }

        if (reward.gems > 0) {
            user.profile.gems = (user.profile.gems || 0) + reward.gems;
        }

        if (reward.xp > 0) {
            user.profile.xp = (user.profile.xp || 0) + reward.xp;
        }

        // اضافه کردن آیتم‌ها به Inventory
        if (reward.items && reward.items.length > 0) {
            if (!user.profile.inventory) user.profile.inventory = {};

            reward.items.forEach(item => {
                if (!user.profile.inventory[item.type + 's']) {
                    user.profile.inventory[item.type + 's'] = [];
                }

                if (!user.profile.inventory[item.type + 's'].includes(item.id)) {
                    user.profile.inventory[item.type + 's'].push(item.id);
                }
            });
        }

        // اضافه کردن Title
        if (reward.title) {
            if (!user.profile.inventory) user.profile.inventory = {};
            if (!user.profile.inventory.titles) user.profile.inventory.titles = [];

            if (!user.profile.inventory.titles.includes(reward.title)) {
                user.profile.inventory.titles.push(reward.title);
            }
        }

        // اضافه کردن Badge
        if (reward.badge) {
            if (!user.profile.inventory) user.profile.inventory = {};
            if (!user.profile.inventory.badges) user.profile.inventory.badges = [];

            if (!user.profile.inventory.badges.includes(reward.badge)) {
                user.profile.inventory.badges.push(reward.badge);
            }
        }

        if (storage) {
            storage.saveUserProfile(user);
        }
    }

    /**
     * به‌روزرسانی آمار
     * @param {Object} reward - پاداش
     * @private
     */
    _updateStats(reward) {
        this.stats.totalRewardsClaimed++;
        this.stats.totalCoinsEarned += reward.coins || 0;
        this.stats.totalGemsEarned += reward.gems || 0;
        this.stats.totalXpEarned += reward.xp || 0;
    }

    // ============================================================
    // بخش ۶: تاریخچه و آمار
    // ============================================================

    /**
     * دریافت تاریخچه پاداش‌ها
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getClaimHistory(options = {}) {
        const {
            type = null,
            limit = 50,
            offset = 0
        } = options;

        let history = [...this.claimedRewards];

        if (type) {
            history = history.filter(r => r.type === type);
        }

        // مرتب‌سازی بر اساس زمان
        history.sort((a, b) => b.claimedAt - a.claimedAt);

        return history.slice(offset, offset + limit);
    }

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            dailyStatus: this.getDailyClaimStatus(),
            weeklyStatus: this.getWeeklyClaimStatus(),
            totalClaimedRewards: this.claimedRewards.length
        };
    }

    /**
     * دریافت پاداش‌های قابل دریافت
     * @returns {Array<Object>}
     */
    getAvailableRewards() {
        const available = [];

        // پاداش روزانه
        if (this._canClaimDaily()) {
            available.push({
                type: 'daily',
                reward: this.getCurrentDailyReward(),
                canClaim: true
            });
        }

        // پاداش هفتگی
        if (this._canClaimWeekly()) {
            available.push({
                type: 'weekly',
                reward: this.getWeeklyReward(),
                canClaim: true
            });
        }

        // پاداش Tier
        const tierClaimStatus = this.canClaimTierReward();
        if (tierClaimStatus.canClaim) {
            available.push({
                type: 'tier',
                reward: tierClaimStatus.reward,
                canClaim: true
            });
        }

        return available;
    }

    // ============================================================
    // بخش ۷: ذخیره و بارگذاری
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('rewards_claimed', this.claimedRewards);
            storage.set('rewards_daily', this.dailyClaimStatus);
            storage.set('rewards_weekly', this.weeklyClaimStatus);
            storage.set('rewards_stats', this.stats);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const claimed = storage.get('rewards_claimed');
            if (claimed) this.claimedRewards = claimed;

            const daily = storage.get('rewards_daily');
            if (daily) this.dailyClaimStatus = { ...this.dailyClaimStatus, ...daily };

            const weekly = storage.get('rewards_weekly');
            if (weekly) this.weeklyClaimStatus = { ...this.weeklyClaimStatus, ...weekly };

            const stats = storage.get('rewards_stats');
            if (stats) this.stats = { ...this.stats, ...stats };
        }
    }

    // ============================================================
    // بخش ۸: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.claimedRewards = [];
        this.dailyClaimStatus = {
            currentDay: 1,
            lastClaimedAt: null,
            streak: 0,
            cycle: 1
        };
        this.weeklyClaimStatus = {
            lastClaimedAt: null,
            weekNumber: 1
        };

        this.stats = {
            totalRewardsClaimed: 0,
            totalCoinsEarned: 0,
            totalGemsEarned: 0,
            totalXpEarned: 0,
            dailyRewardsClaimed: 0,
            weeklyRewardsClaimed: 0,
            tierRewardsClaimed: 0,
            seasonRewardsClaimed: 0
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 LeagueRewardsManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();

        console.log('🎁 LeagueRewardsManager Status:');
        console.log('  Total Claimed:', stats.totalRewardsClaimed);
        console.log('  Total Coins:', stats.totalCoinsEarned);
        console.log('  Total Gems:', stats.totalGemsEarned);
        console.log('  Total XP:', stats.totalXpEarned);
        console.log('  Daily Day:', this.dailyClaimStatus.currentDay);
        console.log('  Daily Streak:', this.dailyClaimStatus.streak);
        console.log('  Weekly Week:', this.weeklyClaimStatus.weekNumber);
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
                    console.error(`❌ Rewards event listener error:`, error);
                }
            });
        }

        eventBus.emit(`rewards:${event}`, data);
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
const leagueRewardsManager = new LeagueRewardsManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LeagueRewardsManager, leagueRewardsManager };
} else {
    window.LeagueRewardsManager = LeagueRewardsManager;
    window.leagueRewardsManager = leagueRewardsManager;
}

console.log('✅ LeagueRewardsManager loaded');
