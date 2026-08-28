/**
 * ============================================================
 * HOKM MASTER - Missions Manager
 * سیستم مدیریت مأموریت‌های بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم مأموریت‌ها است. شامل
 * مأموریت‌های روزانه، هفتگی، ماهانه، ویژه و محدود، سیستم
 * پیشرفت، claim پاداش، refresh مأموریت، و آمار مأموریت‌ها.
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
 * 
 * ============================================================
 */

class MissionsManager {

    constructor() {
        /**
         * مأموریت‌های فعال
         * @type {Array<Object>}
         */
        this.activeMissions = [];

        /**
         * مأموریت‌های تکمیل شده
         * @type {Array<Object>}
         */
        this.completedMissions = [];

        /**
         * مأموریت‌های در دسترس (قابل دریافت)
         * @type {Array<Object>}
         */
        this.availableMissions = [];

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
         * آمار مأموریت‌ها
         * @type {Object}
         */
        this.stats = {
            totalMissionsCompleted: 0,
            totalRewardsClaimed: 0,
            totalCoinsEarned: 0,
            totalGemsEarned: 0,
            totalXpEarned: 0,
            dailyMissionsCompleted: 0,
            weeklyMissionsCompleted: 0,
            monthlyMissionsCompleted: 0,
            specialMissionsCompleted: 0,
            currentStreak: 0,
            bestStreak: 0
        };

        /**
         * زمان آخرین reset روزانه
         * @type {number}
         */
        this.lastDailyReset = null;

        /**
         * زمان آخرین reset هفتگی
         * @type {number}
         */
        this.lastWeeklyReset = null;

        /**
         * زمان آخرین reset ماهانه
         * @type {number}
         */
        this.lastMonthlyReset = null;

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

        // بررسی reset ها
        this._checkResets();

        // ایجاد مأموریت‌های پیش‌فرض اگر خالی است
        if (this.activeMissions.length === 0) {
            this._generateDefaultMissions();
        }

        if (this.debug) {
            console.log('🎯 MissionsManager initialized');
            console.log('  Active Missions:', this.activeMissions.length);
            console.log('  Completed Missions:', this.completedMissions.length);
        }
    }

    // ============================================================
    // بخش ۱: تعریف مأموریت‌ها
    // ============================================================

    /**
     * دریافت مأموریت‌های فعال
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getActiveMissions(options = {}) {
        const {
            type = null,
            difficulty = null,
            limit = 50,
            offset = 0
        } = options;

        let missions = [...this.activeMissions];

        if (type) {
            missions = missions.filter(m => m.type === type);
        }

        if (difficulty) {
            missions = missions.filter(m => m.difficulty === difficulty);
        }

        return missions.slice(offset, offset + limit);
    }

    /**
     * دریافت مأموریت‌های روزانه
     * @returns {Array<Object>}
     */
    getDailyMissions() {
        return this.getActiveMissions({ type: 'daily' });
    }

    /**
     * دریافت مأموریت‌های هفتگی
     * @returns {Array<Object>}
     */
    getWeeklyMissions() {
        return this.getActiveMissions({ type: 'weekly' });
    }

    /**
     * دریافت مأموریت‌های ماهانه
     * @returns {Array<Object>}
     */
    getMonthlyMissions() {
        return this.getActiveMissions({ type: 'monthly' });
    }

    /**
     * دریافت مأموریت‌های ویژه
     * @returns {Array<Object>}
     */
    getSpecialMissions() {
        return this.getActiveMissions({ type: 'special' });
    }

    /**
     * دریافت مأموریت‌های تکمیل شده
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getCompletedMissions(limit = 50) {
        return this.completedMissions.slice(-limit).reverse();
    }

    /**
     * دریافت جزئیات مأموریت
     * @param {string} missionId - شناسه مأموریت
     * @returns {Object|null}
     */
    getMissionDetails(missionId) {
        const allMissions = [
            ...this.activeMissions,
            ...this.completedMissions,
            ...this.availableMissions
        ];
        return allMissions.find(m => m.id === missionId) || null;
    }

    /**
     * ایجاد مأموریت جدید
     * @param {Object} missionData - داده مأموریت
     * @returns {Object} نتیجه
     */
    createMission(missionData) {
        const {
            name,
            nameEn,
            type = 'daily',
            difficulty = 'normal',
            description,
            objective,
            target,
            reward,
            timeLimit,
            category,
            tags
        } = missionData;

        const mission = {
            id: Utils.generateUUID(),
            name,
            nameEn: nameEn || name,
            type,
            difficulty,
            description,
            objective,
            target: target || 1,
            progress: 0,
            reward: reward || this._getDefaultReward(type, difficulty),
            timeLimit: timeLimit || this._getDefaultTimeLimit(type),
            category: category || 'general',
            tags: tags || [],
            status: 'active', // active, completed, failed, expired
            createdAt: Date.now(),
            startedAt: Date.now(),
            completedAt: null,
            claimedAt: null
        };

        this.activeMissions.push(mission);

        this._emit('mission-created', { mission });

        if (this.debug) {
            console.log(` Mission created: ${name}`);
        }

        return {
            success: true,
            mission
        };
    }

    /**
     * دریافت پاداش پیش‌فرض
     * @param {string} type - نوع مأموریت
     * @param {string} difficulty - سختی
     * @returns {Object}
     * @private
     */
    _getDefaultReward(type, difficulty) {
        const baseRewards = {
            daily: { coins: 100, xp: 25, gems: 0 },
            weekly: { coins: 500, xp: 100, gems: 10 },
            monthly: { coins: 2000, xp: 500, gems: 50 },
            special: { coins: 1000, xp: 200, gems: 25 }
        };

        const difficultyMultipliers = {
            easy: 0.8,
            normal: 1.0,
            hard: 1.5,
            expert: 2.0,
            master: 3.0
        };

        const base = baseRewards[type] || baseRewards.daily;
        const multiplier = difficultyMultipliers[difficulty] || 1.0;

        return {
            coins: Math.floor(base.coins * multiplier),
            xp: Math.floor(base.xp * multiplier),
            gems: Math.floor(base.gems * multiplier)
        };
    }

    /**
     * دریافت محدودیت زمانی پیش‌فرض
     * @param {string} type - نوع مأموریت
     * @returns {number} میلی‌ثانیه
     * @private
     */
    _getDefaultTimeLimit(type) {
        const limits = {
            daily: 24 * 60 * 60 * 1000,
            weekly: 7 * 24 * 60 * 60 * 1000,
            monthly: 30 * 24 * 60 * 60 * 1000,
            special: 3 * 24 * 60 * 60 * 1000
        };
        return limits[type] || limits.daily;
    }

    // ============================================================
    // بخش : سیستم پیشرفت
    // ============================================================

    /**
     * به‌روزرسانی پیشرفت مأموریت
     * @param {string} missionId - شناسه مأموریت
     * @param {number} progress - میزان پیشرفت
     * @returns {Object} نتیجه
     */
    updateMissionProgress(missionId, progress = 1) {
        const mission = this.activeMissions.find(m => m.id === missionId);

        if (!mission) {
            return {
                success: false,
                error: 'MISSION_NOT_FOUND',
                message: 'مأموریت یافت نشد'
            };
        }

        if (mission.status !== 'active') {
            return {
                success: false,
                error: 'MISSION_NOT_ACTIVE',
                message: 'مأموریت فعال نیست'
            };
        }

        // بررسی انقضا
        if (this._isMissionExpired(mission)) {
            mission.status = 'expired';
            return {
                success: false,
                error: 'MISSION_EXPIRED',
                message: 'مأموریت منقضی شده است'
            };
        }

        // به‌روزرسانی پیشرفت
        mission.progress = Math.min(mission.target, mission.progress + progress);

        // بررسی تکمیل
        const isCompleted = mission.progress >= mission.target;

        if (isCompleted && mission.status === 'active') {
            mission.status = 'completed';
            mission.completedAt = Date.now();

            // انتقال به لیست تکمیل شده
            const index = this.activeMissions.findIndex(m => m.id === missionId);
            if (index !== -1) {
                this.activeMissions.splice(index, 1);
                this.completedMissions.push(mission);
            }

            this.stats.totalMissionsCompleted++;
            this._updateTypeStats(mission.type);

            this._emit('mission-completed', {
                mission,
                reward: mission.reward
            });

            if (this.debug) {
                console.log(`✅ Mission completed: ${mission.name}`);
            }
        }

        this._emit('mission-progress-updated', {
            mission,
            progress: mission.progress,
            target: mission.target,
            isCompleted
        });

        return {
            success: true,
            mission,
            isCompleted,
            progress: mission.progress,
            target: mission.target,
            percentage: (mission.progress / mission.target) * 100
        };
    }

    /**
     * بررسی انقضای مأموریت
     * @param {Object} mission - مأموریت
     * @returns {boolean}
     * @private
     */
    _isMissionExpired(mission) {
        const elapsed = Date.now() - mission.startedAt;
        return elapsed > mission.timeLimit;
    }

    /**
     * به‌روزرسانی آمار بر اساس نوع
     * @param {string} type - نوع
     * @private
     */
    _updateTypeStats(type) {
        switch (type) {
            case 'daily':
                this.stats.dailyMissionsCompleted++;
                break;
            case 'weekly':
                this.stats.weeklyMissionsCompleted++;
                break;
            case 'monthly':
                this.stats.monthlyMissionsCompleted++;
                break;
            case 'special':
                this.stats.specialMissionsCompleted++;
                break;
        }
    }

    /**
     * به‌روزرسانی خودکار پیشرفت بر اساس رویداد
     * @param {string} eventType - نوع رویداد
     * @param {Object} eventData - داده رویداد
     * @returns {void}
     */
    handleGameEvent(eventType, eventData) {
        const missionMap = {
            'game_won': 'win_games',
            'game_played': 'play_games',
            'trick_won': 'win_tricks',
            'coins_earned': 'earn_coins',
            'ranked_played': 'play_ranked',
            'friend_added': 'add_friend',
            'daily_login': 'login'
        };

        const missionType = missionMap[eventType];
        if (!missionType) return;

        // پیدا کردن مأموریت‌های مرتبط
        const relatedMissions = this.activeMissions.filter(m =>
            m.objective === missionType && m.status === 'active'
        );

        relatedMissions.forEach(mission => {
            const progress = this._calculateEventProgress(eventType, eventData, mission);
            this.updateMissionProgress(mission.id, progress);
        });
    }

    /**
     * محاسبه پیشرفت بر اساس رویداد
     * @param {string} eventType - نوع رویداد
     * @param {Object} eventData - داده
     * @param {Object} mission - مأموریت
     * @returns {number}
     * @private
     */
    _calculateEventProgress(eventType, eventData, mission) {
        switch (eventType) {
            case 'game_won':
                return eventData.isWinner ? 1 : 0;
            case 'game_played':
                return 1;
            case 'trick_won':
                return 1;
            case 'coins_earned':
                return eventData.coins || 0;
            case 'ranked_played':
                return 1;
            case 'friend_added':
                return 1;
            case 'daily_login':
                return 1;
            default:
                return 0;
        }
    }

    // ============================================================
    // بخش ۳: Claim پاداش
    // ============================================================

    /**
     * دریافت پاداش مأموریت
     * @param {string} missionId - شناسه مأموریت
     * @returns {Object} نتیجه
     */
    claimMissionReward(missionId) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای دریافت پاداش باید وارد شوید'
            };
        }

        const mission = this.completedMissions.find(m => m.id === missionId);
        if (!mission) {
            return {
                success: false,
                error: 'MISSION_NOT_FOUND',
                message: 'مأموریت یافت نشد'
            };
        }

        if (mission.status !== 'completed') {
            return {
                success: false,
                error: 'MISSION_NOT_COMPLETED',
                message: 'مأموریت تکمیل نشده است'
            };
        }

        if (mission.claimedAt) {
            return {
                success: false,
                error: 'ALREADY_CLAIMED',
                message: 'پاداش قبلاً دریافت شده است'
            };
        }

        // اعطای پاداش
        const reward = mission.reward;
        this._awardReward(user, reward);

        mission.claimedAt = Date.now();

        this.stats.totalRewardsClaimed++;
        this.stats.totalCoinsEarned += reward.coins || 0;
        this.stats.totalGemsEarned += reward.gems || 0;
        this.stats.totalXpEarned += reward.xp || 0;

        this._emit('mission-reward-claimed', {
            mission,
            reward
        });

        if (this.debug) {
            console.log(`💰 Mission reward claimed: ${mission.name}`);
        }

        return {
            success: true,
            mission,
            reward
        };
    }

    /**
     * دریافت تمام پاداش‌های قابل دریافت
     * @returns {Array<Object>}
     */
    getClaimableRewards() {
        return this.completedMissions.filter(m =>
            m.status === 'completed' && !m.claimedAt
        );
    }

    /**
     * دریافت تمام پاداش‌های قابل دریافت
     * @returns {Object} نتیجه
     */
    claimAllRewards() {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای دریافت پاداش باید وارد شوید'
            };
        }

        const claimable = this.getClaimableRewards();
        if (claimable.length === 0) {
            return {
                success: false,
                error: 'NO_REWARDS',
                message: 'پاداشی برای دریافت وجود ندارد'
            };
        }

        let totalReward = { coins: 0, gems: 0, xp: 0 };
        const claimedMissions = [];

        claimable.forEach(mission => {
            const reward = mission.reward;
            this._awardReward(user, reward);
            mission.claimedAt = Date.now();

            totalReward.coins += reward.coins || 0;
            totalReward.gems += reward.gems || 0;
            totalReward.xp += reward.xp || 0;

            claimedMissions.push(mission);
        });

        this.stats.totalRewardsClaimed += claimedMissions.length;
        this.stats.totalCoinsEarned += totalReward.coins;
        this.stats.totalGemsEarned += totalReward.gems;
        this.stats.totalXpEarned += totalReward.xp;

        this._emit('all-rewards-claimed', {
            missions: claimedMissions,
            totalReward
        });

        if (this.debug) {
            console.log(`💰 All rewards claimed: ${claimedMissions.length} missions`);
        }

        return {
            success: true,
            claimedCount: claimedMissions.length,
            totalReward
        };
    }

    /**
     * اعطای پاداش به کاربر
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

        if (reward.items && reward.items.length > 0) {
            if (!user.profile.inventory) user.profile.inventory = {};

            reward.items.forEach(item => {
                const key = item.type + 's';
                if (!user.profile.inventory[key]) {
                    user.profile.inventory[key] = [];
                }
                if (!user.profile.inventory[key].includes(item.id)) {
                    user.profile.inventory[key].push(item.id);
                }
            });
        }

        if (storage) {
            storage.saveUserProfile(user);
        }
    }

    // ============================================================
    // بخش ۴: Refresh مأموریت
    // ============================================================

    /**
     * refresh مأموریت (تعویض با مأموریت جدید)
     * @param {string} missionId - شناسه مأموریت
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    refreshMission(missionId, options = {}) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای refresh باید وارد شوید'
            };
        }

        const missionIndex = this.activeMissions.findIndex(m => m.id === missionId);
        if (missionIndex === -1) {
            return {
                success: false,
                error: 'MISSION_NOT_FOUND',
                message: 'مأموریت یافت نشد'
            };
        }

        const mission = this.activeMissions[missionIndex];

        // بررسی هزینه refresh
        const refreshCost = options.cost || this._getRefreshCost(mission.type);
        if (user.profile.coins < refreshCost) {
            return {
                success: false,
                error: 'INSUFFICIENT_FUNDS',
                message: 'سکه کافی ندارید',
                cost: refreshCost
            };
        }

        // کسر هزینه
        user.profile.coins -= refreshCost;
        if (storage) {
            storage.saveUserProfile(user);
        }

        // حذف مأموریت قدیمی
        this.activeMissions.splice(missionIndex, 1);

        // ایجاد مأموریت جدید
        const newMission = this._generateRandomMission(mission.type, mission.difficulty);
        this.activeMissions.push(newMission);

        this._emit('mission-refreshed', {
            oldMission: mission,
            newMission,
            cost: refreshCost
        });

        if (this.debug) {
            console.log(`🔄 Mission refreshed: ${mission.name} → ${newMission.name}`);
        }

        return {
            success: true,
            oldMission: mission,
            newMission,
            cost: refreshCost
        };
    }

    /**
     * دریافت هزینه refresh
     * @param {string} type - نوع مأموریت
     * @returns {number}
     * @private
     */
    _getRefreshCost(type) {
        const costs = {
            daily: 50,
            weekly: 200,
            monthly: 500,
            special: 300
        };
        return costs[type] || 100;
    }

    /**
     * تولید مأموریت تصادفی
     * @param {string} type - نوع
     * @param {string} difficulty - سختی
     * @returns {Object}
     * @private
     */
    _generateRandomMission(type, difficulty) {
        const missionTemplates = {
            daily: [
                { name: 'برنده شدن در 3 بازی', objective: 'win_games', target: 3 },
                { name: 'بازی کردن 5 بازی', objective: 'play_games', target: 5 },
                { name: 'بردن 10 دست', objective: 'win_tricks', target: 10 },
                { name: 'کسب 500 سکه', objective: 'earn_coins', target: 500 },
                { name: 'بازی Ranked', objective: 'play_ranked', target: 1 }
            ],
            weekly: [
                { name: 'برنده شدن در 20 بازی', objective: 'win_games', target: 20 },
                { name: 'بازی کردن 50 بازی', objective: 'play_games', target: 50 },
                { name: 'بردن 100 دست', objective: 'win_tricks', target: 100 },
                { name: 'کسب 5000 سکه', objective: 'earn_coins', target: 5000 },
                { name: 'بازی 10 Ranked', objective: 'play_ranked', target: 10 }
            ],
            monthly: [
                { name: 'برنده شدن در 100 بازی', objective: 'win_games', target: 100 },
                { name: 'بازی کردن 200 بازی', objective: 'play_games', target: 200 },
                { name: 'بردن 500 دست', objective: 'win_tricks', target: 500 },
                { name: 'کسب 20000 سکه', objective: 'earn_coins', target: 20000 },
                { name: 'بازی 50 Ranked', objective: 'play_ranked', target: 50 }
            ]
        };

        const templates = missionTemplates[type] || missionTemplates.daily;
        const template = templates[Math.floor(Math.random() * templates.length)];

        return {
            id: Utils.generateUUID(),
            name: template.name,
            nameEn: template.name,
            type,
            difficulty: difficulty || 'normal',
            description: `${template.name} (${type})`,
            objective: template.objective,
            target: template.target,
            progress: 0,
            reward: this._getDefaultReward(type, difficulty || 'normal'),
            timeLimit: this._getDefaultTimeLimit(type),
            category: 'general',
            tags: [type],
            status: 'active',
            createdAt: Date.now(),
            startedAt: Date.now(),
            completedAt: null,
            claimedAt: null
        };
    }

    // ============================================================
    // بخش ۵: Reset مأموریت‌ها
    // ============================================================

    /**
     * بررسی reset ها
     * @private
     */
    _checkResets() {
        const now = Date.now();

        // Reset روزانه (هر 24 ساعت)
        if (!this.lastDailyReset || now - this.lastDailyReset >= 24 * 60 * 60 * 1000) {
            this._resetDailyMissions();
            this.lastDailyReset = now;
        }

        // Reset هفتگی (هر 7 روز)
        if (!this.lastWeeklyReset || now - this.lastWeeklyReset >= 7 * 24 * 60 * 60 * 1000) {
            this._resetWeeklyMissions();
            this.lastWeeklyReset = now;
        }

        // Reset ماهانه (هر 30 روز)
        if (!this.lastMonthlyReset || now - this.lastMonthlyReset >= 30 * 24 * 60 * 60 * 1000) {
            this._resetMonthlyMissions();
            this.lastMonthlyReset = now;
        }
    }

    /**
     * Reset مأموریت‌های روزانه
     * @private
     */
    _resetDailyMissions() {
        // انتقال مأموریت‌های روزانه تکمیل نشده به failed
        this.activeMissions.forEach(mission => {
            if (mission.type === 'daily' && mission.status === 'active') {
                mission.status = 'expired';
                this.completedMissions.push(mission);
            }
        });

        // حذف از active
        this.activeMissions = this.activeMissions.filter(m => m.type !== 'daily');

        // ایجاد مأموریت‌های روزانه جدید
        this._generateDailyMissions();

        // Reset streak اگر بیشتر از 2 روز گذشته
        const user = authManager?.getCurrentUser();
        if (user) {
            const lastLogin = storage?.get('last_login');
            if (lastLogin && now - lastLogin > 2 * 24 * 60 * 60 * 1000) {
                this.stats.currentStreak = 0;
            }
        }

        this._emit('daily-missions-reset');

        if (this.debug) {
            console.log('🔄 Daily missions reset');
        }
    }

    /**
     * Reset مأموریت‌های هفتگی
     * @private
     */
    _resetWeeklyMissions() {
        this.activeMissions.forEach(mission => {
            if (mission.type === 'weekly' && mission.status === 'active') {
                mission.status = 'expired';
                this.completedMissions.push(mission);
            }
        });

        this.activeMissions = this.activeMissions.filter(m => m.type !== 'weekly');
        this._generateWeeklyMissions();

        this._emit('weekly-missions-reset');

        if (this.debug) {
            console.log('🔄 Weekly missions reset');
        }
    }

    /**
     * Reset مأموریت‌های ماهانه
     * @private
     */
    _resetMonthlyMissions() {
        this.activeMissions.forEach(mission => {
            if (mission.type === 'monthly' && mission.status === 'active') {
                mission.status = 'expired';
                this.completedMissions.push(mission);
            }
        });

        this.activeMissions = this.activeMissions.filter(m => m.type !== 'monthly');
        this._generateMonthlyMissions();

        this._emit('monthly-missions-reset');

        if (this.debug) {
            console.log('🔄 Monthly missions reset');
        }
    }

    // ============================================================
    // بخش ۶: تولید مأموریت‌های پیش‌فرض
    // ============================================================

    /**
     * تولید مأموریت‌های پیش‌فرض
     * @private
     */
    _generateDefaultMissions() {
        this._generateDailyMissions();
        this._generateWeeklyMissions();
        this._generateMonthlyMissions();
    }

    /**
     * تولید مأموریت‌های روزانه
     * @private
     */
    _generateDailyMissions() {
        const dailyMissions = [
            { name: 'برنده شدن در 3 بازی', objective: 'win_games', target: 3, difficulty: 'easy' },
            { name: 'بازی کردن 5 بازی', objective: 'play_games', target: 5, difficulty: 'easy' },
            { name: 'بردن 10 دست', objective: 'win_tricks', target: 10, difficulty: 'normal' },
            { name: 'کسب 500 سکه', objective: 'earn_coins', target: 500, difficulty: 'normal' },
            { name: 'بازی Ranked', objective: 'play_ranked', target: 1, difficulty: 'easy' }
        ];

        // انتخاب 3 مأموریت تصادفی
        const selected = this._selectRandomMissions(dailyMissions, 3);

        selected.forEach(template => {
            const mission = {
                id: Utils.generateUUID(),
                name: template.name,
                nameEn: template.name,
                type: 'daily',
                difficulty: template.difficulty,
                description: `${template.name} (روزانه)`,
                objective: template.objective,
                target: template.target,
                progress: 0,
                reward: this._getDefaultReward('daily', template.difficulty),
                timeLimit: this._getDefaultTimeLimit('daily'),
                category: 'general',
                tags: ['daily'],
                status: 'active',
                createdAt: Date.now(),
                startedAt: Date.now(),
                completedAt: null,
                claimedAt: null
            };

            this.activeMissions.push(mission);
        });
    }

    /**
     * تولید مأموریت‌های هفتگی
     * @private
     */
    _generateWeeklyMissions() {
        const weeklyMissions = [
            { name: 'برنده شدن در 20 بازی', objective: 'win_games', target: 20, difficulty: 'normal' },
            { name: 'بازی کردن 50 بازی', objective: 'play_games', target: 50, difficulty: 'normal' },
            { name: 'بردن 100 دست', objective: 'win_tricks', target: 100, difficulty: 'hard' },
            { name: 'کسب 5000 سکه', objective: 'earn_coins', target: 5000, difficulty: 'normal' },
            { name: 'بازی 10 Ranked', objective: 'play_ranked', target: 10, difficulty: 'hard' }
        ];

        const selected = this._selectRandomMissions(weeklyMissions, 3);

        selected.forEach(template => {
            const mission = {
                id: Utils.generateUUID(),
                name: template.name,
                nameEn: template.name,
                type: 'weekly',
                difficulty: template.difficulty,
                description: `${template.name} (هفتگی)`,
                objective: template.objective,
                target: template.target,
                progress: 0,
                reward: this._getDefaultReward('weekly', template.difficulty),
                timeLimit: this._getDefaultTimeLimit('weekly'),
                category: 'general',
                tags: ['weekly'],
                status: 'active',
                createdAt: Date.now(),
                startedAt: Date.now(),
                completedAt: null,
                claimedAt: null
            };

            this.activeMissions.push(mission);
        });
    }

    /**
     * تولید مأموریت‌های ماهانه
     * @private
     */
    _generateMonthlyMissions() {
        const monthlyMissions = [
            { name: 'برنده شدن در 100 بازی', objective: 'win_games', target: 100, difficulty: 'hard' },
            { name: 'بازی کردن 200 بازی', objective: 'play_games', target: 200, difficulty: 'hard' },
            { name: 'بردن 500 دست', objective: 'win_tricks', target: 500, difficulty: 'expert' },
            { name: 'کسب 20000 سکه', objective: 'earn_coins', target: 20000, difficulty: 'hard' },
            { name: 'بازی 50 Ranked', objective: 'play_ranked', target: 50, difficulty: 'expert' }
        ];

        const selected = this._selectRandomMissions(monthlyMissions, 2);

        selected.forEach(template => {
            const mission = {
                id: Utils.generateUUID(),
                name: template.name,
                nameEn: template.name,
                type: 'monthly',
                difficulty: template.difficulty,
                description: `${template.name} (ماهانه)`,
                objective: template.objective,
                target: template.target,
                progress: 0,
                reward: this._getDefaultReward('monthly', template.difficulty),
                timeLimit: this._getDefaultTimeLimit('monthly'),
                category: 'general',
                tags: ['monthly'],
                status: 'active',
                createdAt: Date.now(),
                startedAt: Date.now(),
                completedAt: null,
                claimedAt: null
            };

            this.activeMissions.push(mission);
        });
    }

    /**
     * انتخاب مأموریت‌های تصادفی
     * @param {Array} missions - لیست مأموریت‌ها
     * @param {number} count - تعداد
     * @returns {Array}
     * @private
     */
    _selectRandomMissions(missions, count) {
        const shuffled = [...missions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    // ============================================================
    // بخش ۷: آمار و تاریخچه
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            activeMissionsCount: this.activeMissions.length,
            completedMissionsCount: this.completedMissions.length,
            claimableRewardsCount: this.getClaimableRewards().length
        };
    }

    /**
     * دریافت پیشرفت کلی
     * @returns {Object}
     */
    getOverallProgress() {
        const totalMissions = this.activeMissions.length + this.completedMissions.length;
        const completedMissions = this.completedMissions.filter(m => m.claimedAt).length;

        return {
            total: totalMissions,
            completed: completedMissions,
            active: this.activeMissions.length,
            percentage: totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0
        };
    }

    /**
     * دریافت مأموریت‌ها بر اساس دسته‌بندی
     * @param {string} category - دسته‌بندی
     * @returns {Array<Object>}
     */
    getMissionsByCategory(category) {
        return this.activeMissions.filter(m => m.category === category);
    }

    /**
     * دریافت مأموریت‌ها بر اساس تگ
     * @param {string} tag - تگ
     * @returns {Array<Object>}
     */
    getMissionsByTag(tag) {
        return this.activeMissions.filter(m => m.tags.includes(tag));
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
            storage.set('missions_active', this.activeMissions);
            storage.set('missions_completed', this.completedMissions);
            storage.set('missions_available', this.availableMissions);
            storage.set('missions_stats', this.stats);
            storage.set('missions_last_daily_reset', this.lastDailyReset);
            storage.set('missions_last_weekly_reset', this.lastWeeklyReset);
            storage.set('missions_last_monthly_reset', this.lastMonthlyReset);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const active = storage.get('missions_active');
            if (active) this.activeMissions = active;

            const completed = storage.get('missions_completed');
            if (completed) this.completedMissions = completed;

            const available = storage.get('missions_available');
            if (available) this.availableMissions = available;

            const stats = storage.get('missions_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            this.lastDailyReset = storage.get('missions_last_daily_reset');
            this.lastWeeklyReset = storage.get('missions_last_weekly_reset');
            this.lastMonthlyReset = storage.get('missions_last_monthly_reset');
        }
    }

    // ============================================================
    // بخش ۹: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.activeMissions = [];
        this.completedMissions = [];
        this.availableMissions = [];

        this.stats = {
            totalMissionsCompleted: 0,
            totalRewardsClaimed: 0,
            totalCoinsEarned: 0,
            totalGemsEarned: 0,
            totalXpEarned: 0,
            dailyMissionsCompleted: 0,
            weeklyMissionsCompleted: 0,
            monthlyMissionsCompleted: 0,
            specialMissionsCompleted: 0,
            currentStreak: 0,
            bestStreak: 0
        };

        this.lastDailyReset = null;
        this.lastWeeklyReset = null;
        this.lastMonthlyReset = null;

        this._generateDefaultMissions();
        this._saveData();

        if (this.debug) {
            console.log('🔄 MissionsManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const progress = this.getOverallProgress();

        console.log('🎯 MissionsManager Status:');
        console.log('  Active Missions:', stats.activeMissionsCount);
        console.log('  Completed Missions:', stats.completedMissionsCount);
        console.log('  Claimable Rewards:', stats.claimableRewardsCount);
        console.log('  Total Completed:', stats.totalMissionsCompleted);
        console.log('  Total Rewards:', stats.totalRewardsClaimed);
        console.log('  Overall Progress:', progress.percentage.toFixed(1) + '%');
        console.log('  Daily Completed:', stats.dailyMissionsCompleted);
        console.log('  Weekly Completed:', stats.weeklyMissionsCompleted);
        console.log('  Monthly Completed:', stats.monthlyMissionsCompleted);
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
                    console.error(`❌ Missions event listener error:`, error);
                }
            });
        }

        eventBus.emit(`missions:${event}`, data);
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
const missionsManager = new MissionsManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MissionsManager, missionsManager };
} else {
    window.MissionsManager = MissionsManager;
    window.missionsManager = missionsManager;
}

console.log('✅ MissionsManager loaded');
