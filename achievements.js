/**
 * ============================================================
 * HOKM MASTER - Achievements Manager
 * سیستم مدیریت دستاوردهای بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم دستاوردها است. شامل
 * دسته‌بندی‌های مختلف، سیستم پیشرفت، unlock خودکار، پاداش‌ها،
 * کمیابی‌ها، تاریخچه، و آمار کامل دستاوردها.
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

class AchievementsManager {

    constructor() {
        /**
         * تعریف تمام دستاوردهای بازی
         * @type {Array<Object>}
         */
        this.achievements = this._defineAllAchievements();

        /**
         * دستاوردهای باز شده بازیکن
         * @type {Array<Object>}
         */
        this.unlockedAchievements = [];

        /**
         * دستاوردهای در حال پیشرفت
         * @type {Array<Object>}
         */
        this.inProgressAchievements = [];

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
         * آمار دستاوردها
         * @type {Object}
         */
        this.stats = {
            totalAchievements: 0,
            unlockedCount: 0,
            inProgressCount: 0,
            lockedCount: 0,
            completionPercentage: 0,
            totalRewardsClaimed: 0,
            totalCoinsEarned: 0,
            totalGemsEarned: 0,
            totalXpEarned: 0,
            rarestAchievement: null,
            lastUnlockedAt: null
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

        // محاسبه آمار اولیه
        this._calculateStats();

        // بررسی دستاوردهای قابل باز شدن
        this._checkUnlocks();

        if (this.debug) {
            console.log(' AchievementsManager initialized');
            console.log('  Total:', this.achievements.length);
            console.log('  Unlocked:', this.unlockedAchievements.length);
            console.log('  In Progress:', this.inProgressAchievements.length);
        }
    }

    // ============================================================
    // بخش : تعریف دستاوردها
    // ============================================================

    /**
     * تعریف تمام دستاوردهای بازی
     * @returns {Array<Object>}
     * @private
     */
    _defineAllAchievements() {
        return [
            // ===== دسته‌بندی: اولین بار (First Time) =====
            {
                id: 'first_win',
                name: 'اولین پیروزی',
                nameEn: 'First Victory',
                category: 'first_time',
                rarity: 'common',
                icon: '',
                description: 'اولین بازی خود را ببر',
                objective: 'win_games',
                target: 1,
                reward: { coins: 100, xp: 50, gems: 0 },
                hidden: false
            },
            {
                id: 'first_kot',
                name: 'اولین کت',
                nameEn: 'First Kot',
                category: 'first_time',
                rarity: 'rare',
                icon: '',
                description: 'اولین کت خود را ثبت کن',
                objective: 'kot_count',
                target: 1,
                reward: { coins: 500, xp: 200, gems: 10 },
                hidden: false
            },
            {
                id: 'first_ranked',
                name: 'اولین بازی رقابتی',
                nameEn: 'First Ranked',
                category: 'first_time',
                rarity: 'common',
                icon: '⚔️',
                description: 'اولین بازی Ranked خود را انجام بده',
                objective: 'ranked_played',
                target: 1,
                reward: { coins: 200, xp: 100, gems: 5 },
                hidden: false
            },
            {
                id: 'first_friend',
                name: 'اولین دوست',
                nameEn: 'First Friend',
                category: 'first_time',
                rarity: 'common',
                icon: '👥',
                description: 'اولین دوست خود را اضافه کن',
                objective: 'friend_added',
                target: 1,
                reward: { coins: 150, xp: 75, gems: 0 },
                hidden: false
            },
            {
                id: 'first_tournament',
                name: 'اولین تورنمنت',
                nameEn: 'First Tournament',
                category: 'first_time',
                rarity: 'rare',
                icon: '🏆',
                description: 'در اولین تورنمنت شرکت کن',
                objective: 'tournament_entered',
                target: 1,
                reward: { coins: 1000, xp: 500, gems: 25 },
                hidden: false
            },

            // ===== دسته‌بندی: نقاط عطف (Milestones) =====
            {
                id: 'win_10',
                name: '10 پیروزی',
                nameEn: '10 Wins',
                category: 'milestones',
                rarity: 'common',
                icon: '🎯',
                description: '10 بازی ببر',
                objective: 'win_games',
                target: 10,
                reward: { coins: 500, xp: 250, gems: 10 },
                hidden: false
            },
            {
                id: 'win_50',
                name: '50 پیروزی',
                nameEn: '50 Wins',
                category: 'milestones',
                rarity: 'rare',
                icon: '🎯',
                description: '50 بازی ببر',
                objective: 'win_games',
                target: 50,
                reward: { coins: 2000, xp: 1000, gems: 50 },
                hidden: false
            },
            {
                id: 'win_100',
                name: '100 پیروزی',
                nameEn: '100 Wins',
                category: 'milestones',
                rarity: 'epic',
                icon: '',
                description: '100 بازی ببر',
                objective: 'win_games',
                target: 100,
                reward: { coins: 5000, xp: 2500, gems: 100 },
                hidden: false
            },
            {
                id: 'win_500',
                name: '500 پیروزی',
                nameEn: '500 Wins',
                category: 'milestones',
                rarity: 'legendary',
                icon: '🎯',
                description: '500 بازی ببر',
                objective: 'win_games',
                target: 500,
                reward: { coins: 20000, xp: 10000, gems: 500, title: 'استاد پیروزی' },
                hidden: false
            },
            {
                id: 'win_1000',
                name: '1000 پیروزی',
                nameEn: '1000 Wins',
                category: 'milestones',
                rarity: 'mythic',
                icon: '👑',
                description: '1000 بازی ببر',
                objective: 'win_games',
                target: 1000,
                reward: { coins: 100000, xp: 50000, gems: 2000, title: 'افسانه حکم', badge: 'legend' },
                hidden: false
            },
            {
                id: 'games_100',
                name: '100 بازی',
                nameEn: '100 Games',
                category: 'milestones',
                rarity: 'common',
                icon: '🎮',
                description: '100 بازی انجام بده',
                objective: 'play_games',
                target: 100,
                reward: { coins: 1000, xp: 500, gems: 25 },
                hidden: false
            },
            {
                id: 'games_500',
                name: '500 بازی',
                nameEn: '500 Games',
                category: 'milestones',
                rarity: 'rare',
                icon: '🎮',
                description: '500 بازی انجام بده',
                objective: 'play_games',
                target: 500,
                reward: { coins: 3000, xp: 1500, gems: 75 },
                hidden: false
            },
            {
                id: 'games_1000',
                name: '1000 بازی',
                nameEn: '1000 Games',
                category: 'milestones',
                rarity: 'epic',
                icon: '🎮',
                description: '1000 بازی انجام بده',
                objective: 'play_games',
                target: 1000,
                reward: { coins: 10000, xp: 5000, gems: 250 },
                hidden: false
            },
            {
                id: 'kot_10',
                name: '10 کت',
                nameEn: '10 Kots',
                category: 'milestones',
                rarity: 'rare',
                icon: '💥',
                description: '10 کت ثبت کن',
                objective: 'kot_count',
                target: 10,
                reward: { coins: 2000, xp: 1000, gems: 50 },
                hidden: false
            },
            {
                id: 'kot_50',
                name: '50 کت',
                nameEn: '50 Kots',
                category: 'milestones',
                rarity: 'epic',
                icon: '💥',
                description: '50 کت ثبت کن',
                objective: 'kot_count',
                target: 50,
                reward: { coins: 10000, xp: 5000, gems: 250 },
                hidden: false
            },
            {
                id: 'streak_5',
                name: '5 برد متوالی',
                nameEn: '5 Win Streak',
                category: 'milestones',
                rarity: 'rare',
                icon: '🔥',
                description: '5 بازی متوالی ببر',
                objective: 'win_streak',
                target: 5,
                reward: { coins: 1500, xp: 750, gems: 35 },
                hidden: false
            },
            {
                id: 'streak_10',
                name: '10 برد متوالی',
                nameEn: '10 Win Streak',
                category: 'milestones',
                rarity: 'epic',
                icon: '🔥',
                description: '10 بازی متوالی ببر',
                objective: 'win_streak',
                target: 10,
                reward: { coins: 5000, xp: 2500, gems: 125 },
                hidden: false
            },
            {
                id: 'streak_25',
                name: '25 برد متوالی',
                nameEn: '25 Win Streak',
                category: 'milestones',
                rarity: 'legendary',
                icon: '🔥',
                description: '25 بازی متوالی ببر',
                objective: 'win_streak',
                target: 25,
                reward: { coins: 25000, xp: 12500, gems: 625, title: 'شعله‌ور' },
                hidden: false
            },

            // ===== دسته‌بندی: اجتماعی (Social) =====
            {
                id: 'friends_5',
                name: '5 دوست',
                nameEn: '5 Friends',
                category: 'social',
                rarity: 'common',
                icon: '👥',
                description: '5 دوست اضافه کن',
                objective: 'friend_added',
                target: 5,
                reward: { coins: 500, xp: 250, gems: 10 },
                hidden: false
            },
            {
                id: 'friends_20',
                name: '20 دوست',
                nameEn: '20 Friends',
                category: 'social',
                rarity: 'rare',
                icon: '👥',
                description: '20 دوست اضافه کن',
                objective: 'friend_added',
                target: 20,
                reward: { coins: 2000, xp: 1000, gems: 50 },
                hidden: false
            },
            {
                id: 'friends_50',
                name: '50 دوست',
                nameEn: '50 Friends',
                category: 'social',
                rarity: 'epic',
                icon: '',
                description: '50 دوست اضافه کن',
                objective: 'friend_added',
                target: 50,
                reward: { coins: 5000, xp: 2500, gems: 125 },
                hidden: false
            },
            {
                id: 'chat_100',
                name: '100 پیام',
                nameEn: '100 Messages',
                category: 'social',
                rarity: 'common',
                icon: '💬',
                description: '100 پیام در چت بفرست',
                objective: 'chat_messages',
                target: 100,
                reward: { coins: 300, xp: 150, gems: 5 },
                hidden: false
            },
            {
                id: 'chat_1000',
                name: '1000 پیام',
                nameEn: '1000 Messages',
                category: 'social',
                rarity: 'rare',
                icon: '💬',
                description: '1000 پیام در چت بفرست',
                objective: 'chat_messages',
                target: 1000,
                reward: { coins: 1500, xp: 750, gems: 35 },
                hidden: false
            },

            // ===== دسته‌بندی: رقابتی (Competitive) =====
            {
                id: 'ranked_10',
                name: '10 بازی رقابتی',
                nameEn: '10 Ranked Games',
                category: 'competitive',
                rarity: 'common',
                icon: '⚔️',
                description: '10 بازی Ranked انجام بده',
                objective: 'ranked_played',
                target: 10,
                reward: { coins: 1000, xp: 500, gems: 25 },
                hidden: false
            },
            {
                id: 'ranked_50',
                name: '50 بازی رقابتی',
                nameEn: '50 Ranked Games',
                category: 'competitive',
                rarity: 'rare',
                icon: '⚔️',
                description: '50 بازی Ranked انجام بده',
                objective: 'ranked_played',
                target: 50,
                reward: { coins: 3000, xp: 1500, gems: 75 },
                hidden: false
            },
            {
                id: 'ranked_200',
                name: '200 بازی رقابتی',
                nameEn: '200 Ranked Games',
                category: 'competitive',
                rarity: 'epic',
                icon: '⚔️',
                description: '200 بازی Ranked انجام بده',
                objective: 'ranked_played',
                target: 200,
                reward: { coins: 10000, xp: 5000, gems: 250 },
                hidden: false
            },
            {
                id: 'reach_silver',
                name: 'رسیدن به نقره',
                nameEn: 'Reach Silver',
                category: 'competitive',
                rarity: 'rare',
                icon: '🥈',
                description: 'به لیگ نقره برس',
                objective: 'reach_tier',
                target: 'silver',
                reward: { coins: 2000, xp: 1000, gems: 50, frame: 2 },
                hidden: false
            },
            {
                id: 'reach_gold',
                name: 'رسیدن به طلا',
                nameEn: 'Reach Gold',
                category: 'competitive',
                rarity: 'epic',
                icon: '🥇',
                description: 'به لیگ طلا برس',
                objective: 'reach_tier',
                target: 'gold',
                reward: { coins: 5000, xp: 2500, gems: 125, frame: 3 },
                hidden: false
            },
            {
                id: 'reach_platinum',
                name: 'رسیدن به پلاتین',
                nameEn: 'Reach Platinum',
                category: 'competitive',
                rarity: 'epic',
                icon: '',
                description: 'به لیگ پلاتین برس',
                objective: 'reach_tier',
                target: 'platinum',
                reward: { coins: 10000, xp: 5000, gems: 250, frame: 4 },
                hidden: false
            },
            {
                id: 'reach_diamond',
                name: 'رسیدن به الماس',
                nameEn: 'Reach Diamond',
                category: 'competitive',
                rarity: 'legendary',
                icon: '💎',
                description: 'به لیگ الماس برس',
                objective: 'reach_tier',
                target: 'diamond',
                reward: { coins: 25000, xp: 12500, gems: 625, frame: 5, title: 'الماس' },
                hidden: false
            },
            {
                id: 'reach_master',
                name: 'رسیدن به مستر',
                nameEn: 'Reach Master',
                category: 'competitive',
                rarity: 'mythic',
                icon: '👑',
                description: 'به لیگ مستر برس',
                objective: 'reach_tier',
                target: 'master',
                reward: { coins: 100000, xp: 50000, gems: 2500, frame: 6, title: 'استاد', badge: 'master' },
                hidden: false
            },
            {
                id: 'tournament_win',
                name: 'قهرمان تورنمنت',
                nameEn: 'Tournament Champion',
                category: 'competitive',
                rarity: 'legendary',
                icon: '🏆',
                description: 'یک تورنمنت را ببر',
                objective: 'tournament_won',
                target: 1,
                reward: { coins: 50000, xp: 25000, gems: 1250, title: 'قهرمان', badge: 'champion' },
                hidden: false
            },

            // ===== دسته‌بندی: مجموعه (Collection) =====
            {
                id: 'collect_5_avatars',
                name: '5 آواتار',
                nameEn: '5 Avatars',
                category: 'collection',
                rarity: 'common',
                icon: '',
                description: '5 آواتار مختلف جمع کن',
                objective: 'collect_avatars',
                target: 5,
                reward: { coins: 500, xp: 250, gems: 10 },
                hidden: false
            },
            {
                id: 'collect_10_avatars',
                name: '10 آواتار',
                nameEn: '10 Avatars',
                category: 'collection',
                rarity: 'rare',
                icon: '🎭',
                description: '10 آواتار مختلف جمع کن',
                objective: 'collect_avatars',
                target: 10,
                reward: { coins: 2000, xp: 1000, gems: 50 },
                hidden: false
            },
            {
                id: 'collect_5_frames',
                name: '5 فریم',
                nameEn: '5 Frames',
                category: 'collection',
                rarity: 'rare',
                icon: '️',
                description: '5 فریم مختلف جمع کن',
                objective: 'collect_frames',
                target: 5,
                reward: { coins: 1500, xp: 750, gems: 35 },
                hidden: false
            },
            {
                id: 'collect_5_cardbacks',
                name: '5 پشت کارت',
                nameEn: '5 Card Backs',
                category: 'collection',
                rarity: 'rare',
                icon: '🃏',
                description: '5 پشت کارت مختلف جمع کن',
                objective: 'collect_cardbacks',
                target: 5,
                reward: { coins: 1500, xp: 750, gems: 35 },
                hidden: false
            },

            // ===== دسته‌بندی: ویژه (Special) =====
            {
                id: 'perfect_game',
                name: 'بازی کامل',
                nameEn: 'Perfect Game',
                category: 'special',
                rarity: 'epic',
                icon: '✨',
                description: 'یک بازی را بدون باختن هیچ دستی ببر',
                objective: 'perfect_game',
                target: 1,
                reward: { coins: 5000, xp: 2500, gems: 125, badge: 'perfect' },
                hidden: false
            },
            {
                id: 'comeback_win',
                name: 'بازگشت بزرگ',
                nameEn: 'Great Comeback',
                category: 'special',
                rarity: 'rare',
                icon: '🔄',
                description: 'بعد از عقب بودن 10 امتیازی، بازی را ببر',
                objective: 'comeback_win',
                target: 1,
                reward: { coins: 2000, xp: 1000, gems: 50 },
                hidden: false
            },
            {
                id: 'daily_login_7',
                name: '7 روز متوالی',
                nameEn: '7 Day Streak',
                category: 'special',
                rarity: 'rare',
                icon: '📅',
                description: '7 روز متوالی وارد بازی شو',
                objective: 'daily_login_streak',
                target: 7,
                reward: { coins: 1000, xp: 500, gems: 25 },
                hidden: false
            },
            {
                id: 'daily_login_30',
                name: '30 روز متوالی',
                nameEn: '30 Day Streak',
                category: 'special',
                rarity: 'epic',
                icon: '',
                description: '30 روز متوالی وارد بازی شو',
                objective: 'daily_login_streak',
                target: 30,
                reward: { coins: 5000, xp: 2500, gems: 125, badge: 'loyal' },
                hidden: false
            },
            {
                id: 'daily_login_365',
                name: '365 روز متوالی',
                nameEn: '365 Day Streak',
                category: 'special',
                rarity: 'mythic',
                icon: '',
                description: '365 روز متوالی وارد بازی شو',
                objective: 'daily_login_streak',
                target: 365,
                reward: { coins: 100000, xp: 50000, gems: 2500, title: 'وفادار', badge: 'legend' },
                hidden: false
            },
            {
                id: 'coins_100000',
                name: 'ثروتمند',
                nameEn: 'Wealthy',
                category: 'special',
                rarity: 'rare',
                icon: '💰',
                description: '100000 سکه جمع کن',
                objective: 'total_coins_earned',
                target: 100000,
                reward: { coins: 2000, xp: 1000, gems: 50 },
                hidden: false
            },
            {
                id: 'coins_1000000',
                name: 'میلیونر',
                nameEn: 'Millionaire',
                category: 'special',
                rarity: 'epic',
                icon: '',
                description: '1000000 سکه جمع کن',
                objective: 'total_coins_earned',
                target: 1000000,
                reward: { coins: 10000, xp: 5000, gems: 250, badge: 'rich' },
                hidden: false
            }
        ];
    }

    // ============================================================
    // بخش ۲: دریافت دستاوردها
    // ============================================================

    /**
     * دریافت تمام دستاوردها
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getAllAchievements(options = {}) {
        const {
            category = null,
            rarity = null,
            status = null,
            limit = 100,
            offset = 0
        } = options;

        let achievements = [...this.achievements];

        if (category) {
            achievements = achievements.filter(a => a.category === category);
        }

        if (rarity) {
            achievements = achievements.filter(a => a.rarity === rarity);
        }

        if (status) {
            if (status === 'unlocked') {
                achievements = achievements.filter(a =>
                    this.unlockedAchievements.some(u => u.id === a.id)
                );
            } else if (status === 'in_progress') {
                achievements = achievements.filter(a =>
                    this.inProgressAchievements.some(p => p.id === a.id)
                );
            } else if (status === 'locked') {
                achievements = achievements.filter(a =>
                    !this.unlockedAchievements.some(u => u.id === a.id) &&
                    !this.inProgressAchievements.some(p => p.id === a.id)
                );
            }
        }

        return achievements.slice(offset, offset + limit);
    }

    /**
     * دریافت دستاوردهای باز شده
     * @returns {Array<Object>}
     */
    getUnlockedAchievements() {
        return this.unlockedAchievements;
    }

    /**
     * دریافت دستاوردهای در حال پیشرفت
     * @returns {Array<Object>}
     */
    getInProgressAchievements() {
        return this.inProgressAchievements;
    }

    /**
     * دریافت دستاوردهای قفل
     * @returns {Array<Object>}
     */
    getLockedAchievements() {
        return this.achievements.filter(a =>
            !this.unlockedAchievements.some(u => u.id === a.id) &&
            !this.inProgressAchievements.some(p => p.id === a.id)
        );
    }

    /**
     * دریافت جزئیات یک دستاورد
     * @param {string} achievementId - شناسه دستاورد
     * @returns {Object|null}
     */
    getAchievementDetails(achievementId) {
        const achievement = this.achievements.find(a => a.id === achievementId);
        if (!achievement) return null;

        const unlocked = this.unlockedAchievements.find(u => u.id === achievementId);
        const inProgress = this.inProgressAchievements.find(p => p.id === achievementId);

        return {
            ...achievement,
            status: unlocked ? 'unlocked' : (inProgress ? 'in_progress' : 'locked'),
            progress: inProgress?.progress || 0,
            unlockedAt: unlocked?.unlockedAt || null,
            claimedAt: unlocked?.claimedAt || null
        };
    }

    // ============================================================
    // بخش ۳: سیستم پیشرفت
    // ============================================================

    /**
     * به‌روزرسانی پیشرفت دستاورد
     * @param {string} eventType - نوع رویداد
     * @param {Object} eventData - داده رویداد
     * @returns {Array<Object>} دستاوردهای باز شده
     */
    updateProgress(eventType, eventData) {
        const newlyUnlocked = [];

        this.achievements.forEach(achievement => {
            if (achievement.objective !== eventType) return;
            if (this.unlockedAchievements.some(u => u.id === achievement.id)) return;

            const currentProgress = this._getAchievementProgress(achievement, eventData);
            
            if (currentProgress >= achievement.target) {
                // باز کردن دستاورد
                this._unlockAchievement(achievement);
                newlyUnlocked.push(achievement);
            } else {
                // به‌روزرسانی پیشرفت
                this._updateInProgress(achievement, currentProgress);
            }
        });

        if (newlyUnlocked.length > 0) {
            this._emit('achievements-unlocked', {
                achievements: newlyUnlocked
            });
        }

        return newlyUnlocked;
    }

    /**
     * دریافت پیشرفت دستاورد
     * @param {Object} achievement - دستاورد
     * @param {Object} eventData - داده رویداد
     * @returns {number}
     * @private
     */
    _getAchievementProgress(achievement, eventData) {
        const user = authManager?.getCurrentUser();
        if (!user) return 0;

        const stats = user.profile?.stats || {};

        switch (achievement.objective) {
            case 'win_games':
                return stats.wins || 0;
            case 'play_games':
                return stats.totalGames || 0;
            case 'kot_count':
                return stats.kotCount || 0;
            case 'win_streak':
                return stats.currentStreak || 0;
            case 'friend_added':
                return stats.friendsAdded || 0;
            case 'chat_messages':
                return stats.chatMessages || 0;
            case 'ranked_played':
                return stats.rankedGames || 0;
            case 'tournament_won':
                return stats.tournamentsWon || 0;
            case 'collect_avatars':
                return user.profile?.inventory?.avatars?.length || 0;
            case 'collect_frames':
                return user.profile?.inventory?.frames?.length || 0;
            case 'collect_cardbacks':
                return user.profile?.inventory?.cardBacks?.length || 0;
            case 'perfect_game':
                return stats.perfectGames || 0;
            case 'comeback_win':
                return stats.comebackWins || 0;
            case 'daily_login_streak':
                return stats.loginStreak || 0;
            case 'total_coins_earned':
                return stats.totalCoinsEarned || 0;
            case 'reach_tier':
                const currentTier = user.profile?.league?.tier || 'bronze';
                const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
                const targetIndex = tierOrder.indexOf(achievement.target);
                const currentIndex = tierOrder.indexOf(currentTier);
                return currentIndex >= targetIndex ? 1 : 0;
            default:
                return 0;
        }
    }

    /**
     * باز کردن دستاورد
     * @param {Object} achievement - دستاورد
     * @private
     */
    _unlockAchievement(achievement) {
        const unlocked = {
            ...achievement,
            unlockedAt: Date.now(),
            claimedAt: null
        };

        this.unlockedAchievements.push(unlocked);

        // حذف از in_progress
        const inProgressIndex = this.inProgressAchievements.findIndex(p => p.id === achievement.id);
        if (inProgressIndex !== -1) {
            this.inProgressAchievements.splice(inProgressIndex, 1);
        }

        this._calculateStats();

        if (this.debug) {
            console.log(`🏆 Achievement unlocked: ${achievement.name}`);
        }
    }

    /**
     * به‌روزرسانی در حال پیشرفت
     * @param {Object} achievement - دستاورد
     * @param {number} progress - پیشرفت
     * @private
     */
    _updateInProgress(achievement, progress) {
        const existing = this.inProgressAchievements.find(p => p.id === achievement.id);

        if (existing) {
            existing.progress = progress;
            existing.updatedAt = Date.now();
        } else {
            this.inProgressAchievements.push({
                id: achievement.id,
                progress,
                startedAt: Date.now(),
                updatedAt: Date.now()
            });
        }
    }

    // ============================================================
    // بخش ۴: بررسی باز شدن
    // ============================================================

    /**
     * بررسی دستاوردهای قابل باز شدن
     * @private
     */
    _checkUnlocks() {
        const user = authManager?.getCurrentUser();
        if (!user) return;

        this.achievements.forEach(achievement => {
            if (this.unlockedAchievements.some(u => u.id === achievement.id)) return;

            const progress = this._getAchievementProgress(achievement, {});
            
            if (progress >= achievement.target) {
                this._unlockAchievement(achievement);
            } else if (progress > 0) {
                this._updateInProgress(achievement, progress);
            }
        });
    }

    // ============================================================
    // بخش ۵: Claim پاداش
    // ============================================================

    /**
     * دریافت پاداش دستاورد
     * @param {string} achievementId - شناسه دستاورد
     * @returns {Object} نتیجه
     */
    claimAchievementReward(achievementId) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای دریافت پاداش باید وارد شوید'
            };
        }

        const unlocked = this.unlockedAchievements.find(u => u.id === achievementId);
        if (!unlocked) {
            return {
                success: false,
                error: 'NOT_UNLOCKED',
                message: 'دستاورد باز نشده است'
            };
        }

        if (unlocked.claimedAt) {
            return {
                success: false,
                error: 'ALREADY_CLAIMED',
                message: 'پاداش قبلاً دریافت شده است'
            };
        }

        // اعطای پاداش
        const reward = unlocked.reward;
        this._awardReward(user, reward);

        unlocked.claimedAt = Date.now();

        this.stats.totalRewardsClaimed++;
        this.stats.totalCoinsEarned += reward.coins || 0;
        this.stats.totalGemsEarned += reward.gems || 0;
        this.stats.totalXpEarned += reward.xp || 0;

        this._emit('achievement-reward-claimed', {
            achievement: unlocked,
            reward
        });

        if (this.debug) {
            console.log(`💰 Achievement reward claimed: ${unlocked.name}`);
        }

        return {
            success: true,
            achievement: unlocked,
            reward
        };
    }

    /**
     * دریافت تمام پاداش‌های قابل دریافت
     * @returns {Array<Object>}
     */
    getClaimableRewards() {
        return this.unlockedAchievements.filter(a => !a.claimedAt);
    }

    /**
     * دریافت تمام پاداش‌ها
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
        const claimedAchievements = [];

        claimable.forEach(achievement => {
            const reward = achievement.reward;
            this._awardReward(user, reward);
            achievement.claimedAt = Date.now();

            totalReward.coins += reward.coins || 0;
            totalReward.gems += reward.gems || 0;
            totalReward.xp += reward.xp || 0;

            claimedAchievements.push(achievement);
        });

        this.stats.totalRewardsClaimed += claimedAchievements.length;
        this.stats.totalCoinsEarned += totalReward.coins;
        this.stats.totalGemsEarned += totalReward.gems;
        this.stats.totalXpEarned += totalReward.xp;

        this._emit('all-achievement-rewards-claimed', {
            achievements: claimedAchievements,
            totalReward
        });

        if (this.debug) {
            console.log(`💰 All achievement rewards claimed: ${claimedAchievements.length}`);
        }

        return {
            success: true,
            claimedCount: claimedAchievements.length,
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

        if (reward.title) {
            if (!user.profile.inventory) user.profile.inventory = {};
            if (!user.profile.inventory.titles) user.profile.inventory.titles = [];
            if (!user.profile.inventory.titles.includes(reward.title)) {
                user.profile.inventory.titles.push(reward.title);
            }
        }

        if (reward.badge) {
            if (!user.profile.inventory) user.profile.inventory = {};
            if (!user.profile.inventory.badges) user.profile.inventory.badges = [];
            if (!user.profile.inventory.badges.includes(reward.badge)) {
                user.profile.inventory.badges.push(reward.badge);
            }
        }

        if (reward.frame) {
            if (!user.profile.inventory) user.profile.inventory = {};
            if (!user.profile.inventory.frames) user.profile.inventory.frames = [];
            if (!user.profile.inventory.frames.includes(reward.frame)) {
                user.profile.inventory.frames.push(reward.frame);
            }
        }

        if (storage) {
            storage.saveUserProfile(user);
        }
    }

    // ============================================================
    // بخش ۶: آمار و تحلیل
    // ============================================================

    /**
     * محاسبه آمار
     * @private
     */
    _calculateStats() {
        const total = this.achievements.length;
        const unlocked = this.unlockedAchievements.length;
        const inProgress = this.inProgressAchievements.length;
        const locked = total - unlocked - inProgress;

        this.stats.totalAchievements = total;
        this.stats.unlockedCount = unlocked;
        this.stats.inProgressCount = inProgress;
        this.stats.lockedCount = locked;
        this.stats.completionPercentage = total > 0 ? (unlocked / total) * 100 : 0;

        // پیدا کردن کمیاب‌ترین دستاورد باز شده
        const rarityOrder = ['common', 'rare', 'epic', 'legendary', 'mythic'];
        let rarest = null;
        let rarestIndex = -1;

        this.unlockedAchievements.forEach(a => {
            const index = rarityOrder.indexOf(a.rarity);
            if (index > rarestIndex) {
                rarestIndex = index;
                rarest = a;
            }
        });

        this.stats.rarestAchievement = rarest;
        this.stats.lastUnlockedAt = this.unlockedAchievements.length > 0 ?
            this.unlockedAchievements[this.unlockedAchievements.length - 1].unlockedAt : null;
    }

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * دریافت پیشرفت کلی
     * @returns {Object}
     */
    getOverallProgress() {
        return {
            total: this.achievements.length,
            unlocked: this.unlockedAchievements.length,
            inProgress: this.inProgressAchievements.length,
            locked: this.achievements.length - this.unlockedAchievements.length - this.inProgressAchievements.length,
            percentage: this.stats.completionPercentage
        };
    }

    /**
     * دریافت آمار بر اساس دسته‌بندی
     * @returns {Object}
     */
    getStatsByCategory() {
        const categories = {};

        this.achievements.forEach(a => {
            if (!categories[a.category]) {
                categories[a.category] = { total: 0, unlocked: 0, inProgress: 0 };
            }
            categories[a.category].total++;

            if (this.unlockedAchievements.some(u => u.id === a.id)) {
                categories[a.category].unlocked++;
            } else if (this.inProgressAchievements.some(p => p.id === a.id)) {
                categories[a.category].inProgress++;
            }
        });

        return categories;
    }

    /**
     * دریافت آمار بر اساس کمیابی
     * @returns {Object}
     */
    getStatsByRarity() {
        const rarities = {};

        this.achievements.forEach(a => {
            if (!rarities[a.rarity]) {
                rarities[a.rarity] = { total: 0, unlocked: 0 };
            }
            rarities[a.rarity].total++;

            if (this.unlockedAchievements.some(u => u.id === a.id)) {
                rarities[a.rarity].unlocked++;
            }
        });

        return rarities;
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
            storage.set('achievements_unlocked', this.unlockedAchievements);
            storage.set('achievements_in_progress', this.inProgressAchievements);
            storage.set('achievements_stats', this.stats);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const unlocked = storage.get('achievements_unlocked');
            if (unlocked) this.unlockedAchievements = unlocked;

            const inProgress = storage.get('achievements_in_progress');
            if (inProgress) this.inProgressAchievements = inProgress;

            const stats = storage.get('achievements_stats');
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
        this.unlockedAchievements = [];
        this.inProgressAchievements = [];

        this.stats = {
            totalAchievements: this.achievements.length,
            unlockedCount: 0,
            inProgressCount: 0,
            lockedCount: this.achievements.length,
            completionPercentage: 0,
            totalRewardsClaimed: 0,
            totalCoinsEarned: 0,
            totalGemsEarned: 0,
            totalXpEarned: 0,
            rarestAchievement: null,
            lastUnlockedAt: null
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 AchievementsManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const progress = this.getOverallProgress();

        console.log(' AchievementsManager Status:');
        console.log('  Total:', stats.totalAchievements);
        console.log('  Unlocked:', stats.unlockedCount);
        console.log('  In Progress:', stats.inProgressCount);
        console.log('  Locked:', stats.lockedCount);
        console.log('  Completion:', progress.percentage.toFixed(1) + '%');
        console.log('  Total Rewards:', stats.totalRewardsClaimed);
        console.log('  Rarest:', stats.rarestAchievement?.name || 'None');
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
                    console.error(`❌ Achievements event listener error:`, error);
                }
            });
        }

        eventBus.emit(`achievements:${event}`, data);
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
const achievementsManager = new AchievementsManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AchievementsManager, achievementsManager };
} else {
    window.AchievementsManager = AchievementsManager;
    window.achievementsManager = achievementsManager;
}

console.log('✅ AchievementsManager loaded - 50 achievements defined');
