/**
 * ============================================================
 * HOKM MASTER - Ranking Manager
 * سیستم رتبه‌بندی و Leaderboard
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم رتبه‌بندی بازیکنان است.
 * شامل محاسبه رتبه، Leaderboard با فیلترهای مختلف، سیستم
 * ELO Rating، تغییرات Rating، رتبه‌بندی بر اساس معیارهای
 * مختلف، تاریخچه رتبه‌ها، و آمار رتبه‌بندی.
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

class RankingManager {

    constructor() {
        /**
         * Leaderboard جهانی
         * @type {Array<Object>}
         */
        this.globalLeaderboard = [];

        /**
         * Leaderboard لیگ فعلی
         * @type {Array<Object>}
         */
        this.leagueLeaderboard = [];

        /**
         * Leaderboard دوستان
         * @type {Array<Object>}
         */
        this.friendsLeaderboard = [];

        /**
         * Leaderboard فصل
         * @type {Array<Object>}
         */
        this.seasonLeaderboard = [];

        /**
         * رتبه بازیکن فعلی
         * @type {Object}
         */
        this.playerRank = {
            global: 0,
            league: 0,
            friends: 0,
            season: 0,
            totalGlobal: 0,
            totalLeague: 0,
            totalFriends: 0,
            totalSeason: 0
        };

        /**
         * تاریخچه رتبه‌های بازیکن
         * @type {Array<Object>}
         */
        this.rankHistory = [];

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
         * آمار رتبه‌بندی
         * @type {Object}
         */
        this.stats = {
            totalRankedPlayers: 0,
            totalRatingUpdates: 0,
            averageRating: 0,
            highestRating: 0,
            lowestRating: 0,
            ratingDistribution: {
                bronze: 0,
                silver: 0,
                gold: 0,
                platinum: 0,
                diamond: 0,
                master: 0
            }
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

        // ایجاد Leaderboard نمونه اگر خالی است
        if (this.globalLeaderboard.length === 0) {
            this._generateSampleLeaderboard();
        }

        // محاسبه رتبه بازیکن فعلی
        this._calculatePlayerRank();

        if (this.debug) {
            console.log(' RankingManager initialized');
            console.log('  Global Rank:', this.playerRank.global);
            console.log('  Total Players:', this.globalLeaderboard.length);
        }
    }

    // ============================================================
    // بخش ۱: مدیریت Leaderboard
    // ============================================================

    /**
     * دریافت Leaderboard جهانی
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getGlobalLeaderboard(options = {}) {
        const {
            tier = null,
            limit = 100,
            offset = 0,
            sortBy = 'rating'
        } = options;

        let leaderboard = [...this.globalLeaderboard];

        if (tier) {
            leaderboard = leaderboard.filter(p => p.tier === tier);
        }

        // مرتب‌سازی
        leaderboard.sort((a, b) => {
            if (sortBy === 'rating') return b.rating - a.rating;
            if (sortBy === 'wins') return b.wins - a.wins;
            if (sortBy === 'winRate') return b.winRate - a.winRate;
            if (sortBy === 'gamesPlayed') return b.gamesPlayed - a.gamesPlayed;
            return 0;
        });

        return leaderboard.slice(offset, offset + limit);
    }

    /**
     * دریافت Leaderboard لیگ
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getLeagueLeaderboard(options = {}) {
        const {
            tier = null,
            limit = 100,
            offset = 0
        } = options;

        let leaderboard = [...this.leagueLeaderboard];

        if (tier) {
            leaderboard = leaderboard.filter(p => p.tier === tier);
        }

        leaderboard.sort((a, b) => b.rating - a.rating);

        return leaderboard.slice(offset, offset + limit);
    }

    /**
     * دریافت Leaderboard دوستان
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getFriendsLeaderboard(options = {}) {
        const {
            limit = 50,
            offset = 0
        } = options;

        const leaderboard = [...this.friendsLeaderboard];
        leaderboard.sort((a, b) => b.rating - a.rating);

        return leaderboard.slice(offset, offset + limit);
    }

    /**
     * دریافت Leaderboard فصل
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getSeasonLeaderboard(options = {}) {
        const {
            limit = 100,
            offset = 0
        } = options;

        const leaderboard = [...this.seasonLeaderboard];
        leaderboard.sort((a, b) => b.points - a.points);

        return leaderboard.slice(offset, offset + limit);
    }

    /**
     * به‌روزرسانی Leaderboard
     * @param {Object} playerData - داده بازیکن
     * @returns {Object} نتیجه
     */
    updateLeaderboard(playerData) {
        const {
            id,
            username,
            rating,
            tier,
            wins,
            losses,
            gamesPlayed,
            winRate
        } = playerData;

        // به‌روزرسانی Leaderboard جهانی
        const globalIndex = this.globalLeaderboard.findIndex(p => p.id === id);
        
        if (globalIndex !== -1) {
            this.globalLeaderboard[globalIndex] = {
                ...this.globalLeaderboard[globalIndex],
                rating: rating || this.globalLeaderboard[globalIndex].rating,
                tier: tier || this.globalLeaderboard[globalIndex].tier,
                wins: wins || this.globalLeaderboard[globalIndex].wins,
                losses: losses || this.globalLeaderboard[globalIndex].losses,
                gamesPlayed: gamesPlayed || this.globalLeaderboard[globalIndex].gamesPlayed,
                winRate: winRate || this.globalLeaderboard[globalIndex].winRate,
                updatedAt: Date.now()
            };
        } else {
            this.globalLeaderboard.push({
                id,
                username,
                rating: rating || 1000,
                tier: tier || 'bronze',
                wins: wins || 0,
                losses: losses || 0,
                gamesPlayed: gamesPlayed || 0,
                winRate: winRate || 0,
                joinedAt: Date.now(),
                updatedAt: Date.now()
            });
        }

        // مرتب‌سازی
        this.globalLeaderboard.sort((a, b) => b.rating - a.rating);

        // به‌روزرسانی آمار
        this.stats.totalRankedPlayers = this.globalLeaderboard.length;
        this._updateRatingStats();

        // محاسبه رتبه بازیکن
        this._calculatePlayerRank();

        // ذخیره
        this._saveData();

        this._emit('leaderboard-updated', {
            player: playerData,
            rank: this.playerRank
        });

        if (this.debug) {
            console.log(` Leaderboard updated for: ${username}`);
        }

        return {
            success: true,
            rank: this.playerRank
        };
    }

    /**
     * به‌روزرسانی آمار Rating
     * @private
     */
    _updateRatingStats() {
        if (this.globalLeaderboard.length === 0) return;

        const ratings = this.globalLeaderboard.map(p => p.rating);
        this.stats.averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        this.stats.highestRating = Math.max(...ratings);
        this.stats.lowestRating = Math.min(...ratings);

        // توزیع Rating
        this.stats.ratingDistribution = {
            bronze: this.globalLeaderboard.filter(p => p.tier === 'bronze').length,
            silver: this.globalLeaderboard.filter(p => p.tier === 'silver').length,
            gold: this.globalLeaderboard.filter(p => p.tier === 'gold').length,
            platinum: this.globalLeaderboard.filter(p => p.tier === 'platinum').length,
            diamond: this.globalLeaderboard.filter(p => p.tier === 'diamond').length,
            master: this.globalLeaderboard.filter(p => p.tier === 'master').length
        };
    }

    // ============================================================
    // بخش ۲: محاسبه رتبه
    // ============================================================

    /**
     * محاسبه رتبه بازیکن فعلی
     * @private
     */
    _calculatePlayerRank() {
        const user = authManager?.getCurrentUser();
        if (!user) return;

        const playerId = user.id;

        // رتبه جهانی
        const globalIndex = this.globalLeaderboard.findIndex(p => p.id === playerId);
        this.playerRank.global = globalIndex !== -1 ? globalIndex + 1 : 0;
        this.playerRank.totalGlobal = this.globalLeaderboard.length;

        // رتبه لیگ
        const leagueIndex = this.leagueLeaderboard.findIndex(p => p.id === playerId);
        this.playerRank.league = leagueIndex !== -1 ? leagueIndex + 1 : 0;
        this.playerRank.totalLeague = this.leagueLeaderboard.length;

        // رتبه دوستان
        const friendsIndex = this.friendsLeaderboard.findIndex(p => p.id === playerId);
        this.playerRank.friends = friendsIndex !== -1 ? friendsIndex + 1 : 0;
        this.playerRank.totalFriends = this.friendsLeaderboard.length;

        // رتبه فصل
        const seasonIndex = this.seasonLeaderboard.findIndex(p => p.id === playerId);
        this.playerRank.season = seasonIndex !== -1 ? seasonIndex + 1 : 0;
        this.playerRank.totalSeason = this.seasonLeaderboard.length;

        // ذخیره در تاریخچه
        this._addToRankHistory();
    }

    /**
     * اضافه کردن به تاریخچه رتبه
     * @private
     */
    _addToRankHistory() {
        const user = authManager?.getCurrentUser();
        if (!user) return;

        const player = this.globalLeaderboard.find(p => p.id === user.id);
        if (!player) return;

        this.rankHistory.push({
            timestamp: Date.now(),
            rank: this.playerRank.global,
            rating: player.rating,
            tier: player.tier,
            wins: player.wins,
            losses: player.losses
        });

        // محدود کردن تاریخچه به 100 مورد
        if (this.rankHistory.length > 100) {
            this.rankHistory.shift();
        }
    }

    /**
     * دریافت رتبه بازیکن
     * @returns {Object}
     */
    getPlayerRank() {
        return { ...this.playerRank };
    }

    /**
     * دریافت تاریخچه رتبه
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getRankHistory(limit = 50) {
        return this.rankHistory.slice(-limit).reverse();
    }

    // ============================================================
    // بخش ۳: سیستم ELO Rating
    // ============================================================

    /**
     * محاسبه تغییر Rating با سیستم ELO
     * @param {Object} player1 - بازیکن اول
     * @param {Object} player2 - بازیکن دوم
     * @param {boolean} player1Won - آیا بازیکن اول برد
     * @returns {Object} تغییرات Rating
     */
    calculateEloChange(player1, player2, player1Won) {
        const rating1 = player1.rating || 1000;
        const rating2 = player2.rating || 1000;

        // محاسبه Expected Score
        const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
        const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));

        // Actual Score
        const actual1 = player1Won ? 1 : 0;
        const actual2 = player1Won ? 0 : 1;

        // K Factor بر اساس Rating
        const kFactor1 = this._getKFactor(rating1);
        const kFactor2 = this._getKFactor(rating2);

        // محاسبه تغییر
        const change1 = Math.round(kFactor1 * (actual1 - expected1));
        const change2 = Math.round(kFactor2 * (actual2 - expected2));

        return {
            player1: {
                oldRating: rating1,
                newRating: Math.max(0, rating1 + change1),
                change: change1,
                expected: expected1,
                actual: actual1
            },
            player2: {
                oldRating: rating2,
                newRating: Math.max(0, rating2 + change2),
                change: change2,
                expected: expected2,
                actual: actual2
            }
        };
    }

    /**
     * دریافت K Factor بر اساس Rating
     * @param {number} rating - Rating
     * @returns {number}
     * @private
     */
    _getKFactor(rating) {
        if (rating < 1200) return 40;
        if (rating < 1600) return 32;
        if (rating < 2000) return 24;
        if (rating < 2400) return 16;
        return 8;
    }

    /**
     * اعمال تغییر Rating
     * @param {string} playerId - شناسه بازیکن
     * @param {number} ratingChange - تغییر Rating
     * @returns {Object} نتیجه
     */
    applyRatingChange(playerId, ratingChange) {
        const playerIndex = this.globalLeaderboard.findIndex(p => p.id === playerId);

        if (playerIndex === -1) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن یافت نشد'
            };
        }

        const player = this.globalLeaderboard[playerIndex];
        const oldRating = player.rating;
        const newRating = Math.max(0, oldRating + ratingChange);

        player.rating = newRating;
        player.tier = this._getTierFromRating(newRating);
        player.updatedAt = Date.now();

        this.stats.totalRatingUpdates++;

        // مرتب‌سازی مجدد
        this.globalLeaderboard.sort((a, b) => b.rating - a.rating);

        // به‌روزرسانی رتبه
        this._calculatePlayerRank();

        this._emit('rating-changed', {
            playerId,
            oldRating,
            newRating,
            change: ratingChange
        });

        if (this.debug) {
            console.log(`📈 Rating changed: ${oldRating} → ${newRating} (${ratingChange > 0 ? '+' : ''}${ratingChange})`);
        }

        return {
            success: true,
            oldRating,
            newRating,
            change: ratingChange
        };
    }

    /**
     * دریافت Tier از Rating
     * @param {number} rating - Rating
     * @returns {string}
     * @private
     */
    _getTierFromRating(rating) {
        if (rating >= 3000) return 'master';
        if (rating >= 2500) return 'diamond';
        if (rating >= 2000) return 'platinum';
        if (rating >= 1500) return 'gold';
        if (rating >= 1000) return 'silver';
        return 'bronze';
    }

    // ============================================================
    // بخش ۴: جستجو و فیلتر
    // ============================================================

    /**
     * جستجوی بازیکن در Leaderboard
     * @param {string} query - عبارت جستجو
     * @returns {Array<Object>}
     */
    searchPlayer(query) {
        if (!query || query.length < 2) {
            return [];
        }

        const lowerQuery = query.toLowerCase();

        return this.globalLeaderboard.filter(p =>
            p.username.toLowerCase().includes(lowerQuery)
        ).slice(0, 20);
    }

    /**
     * دریافت بازیکن بر اساس شناسه
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object|null}
     */
    getPlayerById(playerId) {
        return this.globalLeaderboard.find(p => p.id === playerId) || null;
    }

    /**
     * دریافت بازیکن بر اساس نام
     * @param {string} username - نام کاربری
     * @returns {Object|null}
     */
    getPlayerByUsername(username) {
        return this.globalLeaderboard.find(p => p.username === username) || null;
    }

    /**
     * دریافت بازیکنان برتر
     * @param {number} count - تعداد
     * @returns {Array<Object>}
     */
    getTopPlayers(count = 10) {
        return this.globalLeaderboard.slice(0, count);
    }

    /**
     * دریافت بازیکنان اطراف بازیکن فعلی
     * @param {number} range - محدوده
     * @returns {Object}
     */
    getPlayersAround(range = 5) {
        const user = authManager?.getCurrentUser();
        if (!user) return { above: [], below: [] };

        const playerIndex = this.globalLeaderboard.findIndex(p => p.id === user.id);
        if (playerIndex === -1) return { above: [], below: [] };

        const above = this.globalLeaderboard.slice(
            Math.max(0, playerIndex - range),
            playerIndex
        );

        const below = this.globalLeaderboard.slice(
            playerIndex + 1,
            playerIndex + 1 + range
        );

        return { above, below };
    }

    // ============================================================
    // بخش ۵: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل رتبه‌بندی
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            playerRank: this.playerRank,
            rankHistoryLength: this.rankHistory.length
        };
    }

    /**
     * دریافت توزیع Rating
     * @returns {Object}
     */
    getRatingDistribution() {
        return { ...this.stats.ratingDistribution };
    }

    /**
     * دریافت میانگین Rating
     * @returns {number}
     */
    getAverageRating() {
        return this.stats.averageRating;
    }

    /**
     * دریافت بالاترین Rating
     * @returns {number}
     */
    getHighestRating() {
        return this.stats.highestRating;
    }

    /**
     * دریافت پایین‌ترین Rating
     * @returns {number}
     */
    getLowestRating() {
        return this.stats.lowestRating;
    }

    /**
     * دریافت درصد بازیکن
     * @param {string} playerId - شناسه بازیکن
     * @returns {number} درصد
     */
    getPlayerPercentile(playerId) {
        const playerIndex = this.globalLeaderboard.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return 0;

        return ((this.globalLeaderboard.length - playerIndex) / this.globalLeaderboard.length) * 100;
    }

    // ============================================================
    // بخش ۶: Leaderboard دوستان
    // ============================================================

    /**
     * به‌روزرسانی Leaderboard دوستان
     * @param {Array<string>} friendIds - شناسه دوستان
     * @returns {void}
     */
    updateFriendsLeaderboard(friendIds) {
        this.friendsLeaderboard = this.globalLeaderboard.filter(p =>
            friendIds.includes(p.id)
        );

        this.friendsLeaderboard.sort((a, b) => b.rating - a.rating);

        this._calculatePlayerRank();

        if (this.debug) {
            console.log(`👥 Friends leaderboard updated: ${this.friendsLeaderboard.length} players`);
        }
    }

    /**
     * دریافت رتبه بازیکن در بین دوستان
     * @returns {number}
     */
    getFriendsRank() {
        return this.playerRank.friends;
    }

    // ============================================================
    // بخش ۷: Leaderboard فصل
    // ============================================================

    /**
     * به‌روزرسانی Leaderboard فصل
     * @param {Array<Object>} participants - شرکت‌کنندگان فصل
     * @returns {void}
     */
    updateSeasonLeaderboard(participants) {
        this.seasonLeaderboard = participants.map(p => ({
            ...p,
            points: p.points || 0
        }));

        this.seasonLeaderboard.sort((a, b) => b.points - a.points);

        this._calculatePlayerRank();

        if (this.debug) {
            console.log(`📅 Season leaderboard updated: ${this.seasonLeaderboard.length} players`);
        }
    }

    /**
     * دریافت رتبه بازیکن در فصل
     * @returns {number}
     */
    getSeasonRank() {
        return this.playerRank.season;
    }

    // ============================================================
    // بخش : نمونه Leaderboard
    // ============================================================

    /**
     * ایجاد Leaderboard نمونه
     * @private
     */
    _generateSampleLeaderboard() {
        const samplePlayers = [
            { id: 'p1', username: 'ProPlayer1', rating: 2800, tier: 'diamond', wins: 150, losses: 50, gamesPlayed: 200, winRate: 75 },
            { id: 'p2', username: 'MasterGamer', rating: 2600, tier: 'diamond', wins: 120, losses: 60, gamesPlayed: 180, winRate: 67 },
            { id: 'p3', username: 'ElitePlayer', rating: 2400, tier: 'platinum', wins: 100, losses: 70, gamesPlayed: 170, winRate: 59 },
            { id: 'p4', username: 'SkilledOne', rating: 2200, tier: 'platinum', wins: 90, losses: 80, gamesPlayed: 170, winRate: 53 },
            { id: 'p5', username: 'GoodPlayer', rating: 2000, tier: 'platinum', wins: 80, losses: 90, gamesPlayed: 170, winRate: 47 },
            { id: 'p6', username: 'AverageJoe', rating: 1800, tier: 'gold', wins: 70, losses: 100, gamesPlayed: 170, winRate: 41 },
            { id: 'p7', username: 'CasualGamer', rating: 1600, tier: 'gold', wins: 60, losses: 110, gamesPlayed: 170, winRate: 35 },
            { id: 'p8', username: 'NewPlayer1', rating: 1400, tier: 'silver', wins: 50, losses: 120, gamesPlayed: 170, winRate: 29 },
            { id: 'p9', username: 'NewPlayer2', rating: 1200, tier: 'silver', wins: 40, losses: 130, gamesPlayed: 170, winRate: 24 },
            { id: 'p10', username: 'Beginner1', rating: 1000, tier: 'bronze', wins: 30, losses: 140, gamesPlayed: 170, winRate: 18 }
        ];

        this.globalLeaderboard = samplePlayers;
        this.leagueLeaderboard = [...samplePlayers];

        // اضافه کردن بازیکن فعلی
        const user = authManager?.getCurrentUser();
        if (user) {
            this.updateLeaderboard({
                id: user.id,
                username: user.username,
                rating: 1000,
                tier: 'bronze',
                wins: 0,
                losses: 0,
                gamesPlayed: 0,
                winRate: 0
            });
        }

        this._updateRatingStats();
    }

    // ============================================================
    // بخش ۹: ذخیره و بارگذاری
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('ranking_global', this.globalLeaderboard);
            storage.set('ranking_league', this.leagueLeaderboard);
            storage.set('ranking_friends', this.friendsLeaderboard);
            storage.set('ranking_season', this.seasonLeaderboard);
            storage.set('ranking_player', this.playerRank);
            storage.set('ranking_history', this.rankHistory);
            storage.set('ranking_stats', this.stats);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const global = storage.get('ranking_global');
            if (global) this.globalLeaderboard = global;

            const league = storage.get('ranking_league');
            if (league) this.leagueLeaderboard = league;

            const friends = storage.get('ranking_friends');
            if (friends) this.friendsLeaderboard = friends;

            const season = storage.get('ranking_season');
            if (season) this.seasonLeaderboard = season;

            const player = storage.get('ranking_player');
            if (player) this.playerRank = { ...this.playerRank, ...player };

            const history = storage.get('ranking_history');
            if (history) this.rankHistory = history;

            const stats = storage.get('ranking_stats');
            if (stats) this.stats = { ...this.stats, ...stats };
        }
    }

    // ============================================================
    // بخش ۱۰: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.globalLeaderboard = [];
        this.leagueLeaderboard = [];
        this.friendsLeaderboard = [];
        this.seasonLeaderboard = [];

        this.playerRank = {
            global: 0,
            league: 0,
            friends: 0,
            season: 0,
            totalGlobal: 0,
            totalLeague: 0,
            totalFriends: 0,
            totalSeason: 0
        };

        this.rankHistory = [];

        this.stats = {
            totalRankedPlayers: 0,
            totalRatingUpdates: 0,
            averageRating: 0,
            highestRating: 0,
            lowestRating: 0,
            ratingDistribution: {
                bronze: 0,
                silver: 0,
                gold: 0,
                platinum: 0,
                diamond: 0,
                master: 0
            }
        };

        this._generateSampleLeaderboard();
        this._saveData();

        if (this.debug) {
            console.log('🔄 RankingManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();

        console.log('📊 RankingManager Status:');
        console.log('  Global Rank:', this.playerRank.global, '/', this.playerRank.totalGlobal);
        console.log('  League Rank:', this.playerRank.league, '/', this.playerRank.totalLeague);
        console.log('  Friends Rank:', this.playerRank.friends, '/', this.playerRank.totalFriends);
        console.log('  Season Rank:', this.playerRank.season, '/', this.playerRank.totalSeason);
        console.log('  Total Players:', stats.totalRankedPlayers);
        console.log('  Average Rating:', stats.averageRating.toFixed(0));
        console.log('  Highest Rating:', stats.highestRating);
        console.log('  Lowest Rating:', stats.lowestRating);
        console.log('  Rating Updates:', stats.totalRatingUpdates);
    }

    // ============================================================
    // بخش ۱۱: Event System
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
                    console.error(`❌ Ranking event listener error:`, error);
                }
            });
        }

        eventBus.emit(`ranking:${event}`, data);
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
const rankingManager = new RankingManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RankingManager, rankingManager };
} else {
    window.RankingManager = RankingManager;
    window.rankingManager = rankingManager;
}

console.log('✅ RankingManager loaded');
