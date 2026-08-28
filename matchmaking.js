/**
 * ============================================================
 * HOKM MASTER - Matchmaking Manager
 * سیستم جستجو و تطابق بازیکنان
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل فرآیند Matchmaking است. شامل
 * جستجوی بازیکنان بر اساس Skill، League، Region، مدیریت صف
 * انتظار، تطابق بهینه، Timeout، Cancel، و Reconnection.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - storage (از فایل storage.js)
 * - wsManager (از فایل websocket.js)
 * - roomManager (از فایل room.js)
 * 
 * ============================================================
 */

class MatchmakingManager {

    constructor() {
        /**
         * وضعیت فعلی matchmaking
         * @type {string} 'idle' | 'searching' | 'matched' | 'cancelled' | 'timeout'
         */
        this.status = 'idle';

        /**
         * شناسه بازیکن فعلی
         * @type {string|null}
         */
        this.playerId = null;

        /**
         * پروفایل بازیکن فعلی
         * @type {Object|null}
         */
        this.playerProfile = null;

        /**
         * تنظیمات جستجوی فعلی
         * @type {Object|null}
         */
        this.searchCriteria = null;

        /**
         * زمان شروع جستجو
         * @type {number|null}
         */
        this.searchStartTime = null;

        /**
         * زمان باقی‌مانده تا timeout
         * @type {number}
         */
        this.timeRemaining = 0;

        /**
         * حداکثر زمان جستجو (ثانیه)
         * @type {number}
         */
        this.maxSearchTime = 120;

        /**
         * تایمر جستجو
         * @type {number|null}
         */
        this.searchTimer = null;

        /**
         * تایمر به‌روزرسانی زمان
         * @type {number|null}
         */
        this.countdownTimer = null;

        /**
         * بازیکنان یافت شده
         * @type {Array<Object>}
         */
        this.matchedPlayers = [];

        /**
         * اتاق ساخته شده
         * @type {Object|null}
         */
        this.matchedRoom = null;

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
         * آمار matchmaking
         * @type {Object}
         */
        this.stats = {
            totalSearches: 0,
            successfulMatches: 0,
            cancelledSearches: 0,
            timeoutSearches: 0,
            averageSearchTime: 0,
            averageWaitTime: 0
        };

        /**
         * تاریخچه جستجوها
         * @type {Array}
         */
        this.searchHistory = [];

        /**
         * ضرایب تطابق
         * @type {Object}
         */
        this.matchingWeights = {
            rating: 0.40,
            league: 0.30,
            level: 0.15,
            region: 0.10,
            winRate: 0.05
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری پروفایل بازیکن
        const user = storage.getUserProfile();
        if (user) {
            this.playerId = user.id;
            this.playerProfile = user.profile;
        }

        if (this.debug) {
            console.log(' MatchmakingManager initialized');
        }
    }

    // ============================================================
    // بخش ۱: شروع جستجو
    // ============================================================

    /**
     * شروع جستجوی بازی
     * @param {Object} criteria - معیارهای جستجو
     * @returns {Object} نتیجه
     */
    startSearch(criteria = {}) {
        if (this.status === 'searching') {
            return {
                success: false,
                error: 'ALREADY_SEARCHING',
                message: 'شما قبلاً در حال جستجو هستید'
            };
        }

        const {
            gameMode = 'quick',
            level = 'normal',
            region = 'iran',
            maxRatingDiff = 200,
            maxLeagueDiff = 1,
            allowCrossRegion = false,
            timeout = 120
        } = criteria;

        // اعتبارسنجی
        if (!this.playerId) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای جستجو باید وارد شوید'
            };
        }

        // ذخیره معیارها
        this.searchCriteria = {
            gameMode,
            level,
            region,
            maxRatingDiff,
            maxLeagueDiff,
            allowCrossRegion,
            timeout
        };

        // تغییر وضعیت
        this.status = 'searching';
        this.searchStartTime = Date.now();
        this.timeRemaining = timeout;
        this.maxSearchTime = timeout;
        this.matchedPlayers = [];
        this.matchedRoom = null;

        this.stats.totalSearches++;

        // شروع تایمرها
        this._startSearchTimer();
        this._startCountdownTimer();

        this._emit('search-started', {
            criteria: this.searchCriteria,
            playerId: this.playerId
        });

        if (this.debug) {
            console.log('🔍 Search started:', this.searchCriteria);
        }

        // شبیه‌سازی پیدا کردن بازیکن (در production از سرور)
        this._simulateMatchmaking();

        return {
            success: true,
            criteria: this.searchCriteria,
            timeRemaining: this.timeRemaining
        };
    }

    /**
     * شروع تایمر جستجو
     * @private
     */
    _startSearchTimer() {
        this._stopSearchTimer();

        this.searchTimer = setTimeout(() => {
            this._handleTimeout();
        }, this.maxSearchTime * 1000);
    }

    /**
     * توقف تایمر جستجو
     * @private
     */
    _stopSearchTimer() {
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
            this.searchTimer = null;
        }
    }

    /**
     * شروع تایمر شمارش معکوس
     * @private
     */
    _startCountdownTimer() {
        this._stopCountdownTimer();

        this.countdownTimer = setInterval(() => {
            this.timeRemaining--;

            this._emit('search-time-update', {
                timeRemaining: this.timeRemaining,
                maxTime: this.maxSearchTime
            });

            if (this.timeRemaining <= 0) {
                this._stopCountdownTimer();
            }
        }, 1000);
    }

    /**
     * توقف تایمر شمارش معکوس
     * @private
     */
    _stopCountdownTimer() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }

    // ============================================================
    // بخش : شبیه‌سازی Matchmaking
    // ============================================================

    /**
     * شبیه‌سازی فرآیند matchmaking
     * @private
     */
    _simulateMatchmaking() {
        // در production، این بخش از سرور WebSocket دریافت می‌شود
        // اینجا شبیه‌سازی می‌کنیم

        const searchDuration = Utils.randomInt(3000, 8000); // 3-8 ثانیه

        setTimeout(() => {
            if (this.status === 'searching') {
                this._simulateMatchFound();
            }
        }, searchDuration);
    }

    /**
     * شبیه‌سازی پیدا شدن بازیکنان
     * @private
     */
    _simulateMatchFound() {
        // تولید بازیکنان تصادفی
        const opponents = this._generateRandomOpponents();

        this.matchedPlayers = opponents;
        this.status = 'matched';

        // ساخت اتاق
        this.matchedRoom = this._createMatchedRoom(opponents);

        // محاسبه زمان جستجو
        const searchTime = (Date.now() - this.searchStartTime) / 1000;
        this.stats.successfulMatches++;
        this.stats.averageSearchTime = 
            ((this.stats.averageSearchTime * (this.stats.successfulMatches - 1)) + searchTime) / 
            this.stats.successfulMatches;

        // توقف تایمرها
        this._stopSearchTimer();
        this._stopCountdownTimer();

        this._emit('match-found', {
            players: this.matchedPlayers,
            room: this.matchedRoom,
            searchTime
        });

        if (this.debug) {
            console.log('✅ Match found:', this.matchedPlayers.length, 'players');
        }

        // ذخیره در تاریخچه
        this._addToHistory('matched', {
            searchTime,
            players: this.matchedPlayers
        });
    }

    /**
     * تولید حریفان تصادفی
     * @returns {Array<Object>}
     * @private
     */
    _generateRandomOpponents() {
        const opponents = [];
        const playerRating = this.playerProfile?.rating || 1000;
        const playerLeague = this.playerProfile?.league?.tier || 'bronze';

        for (let i = 0; i < 3; i++) {
            const ratingDiff = Utils.randomInt(-150, 150);
            const opponentRating = Math.max(500, playerRating + ratingDiff);

            opponents.push({
                id: Utils.generateUUID(),
                username: `Player${Utils.randomInt(1000, 9999)}`,
                rating: opponentRating,
                league: this._getLeagueFromRating(opponentRating),
                level: Utils.randomInt(1, 50),
                winRate: Utils.randomInt(30, 70),
                avatar: Utils.randomInt(1, 50),
                isAI: Math.random() > 0.7 // 30% احتمال AI
            });
        }

        return opponents;
    }

    /**
     * دریافت لیگ بر اساس Rating
     * @param {number} rating - امتیاز
     * @returns {string} لیگ
     * @private
     */
    _getLeagueFromRating(rating) {
        if (rating >= 3000) return 'master';
        if (rating >= 2500) return 'diamond';
        if (rating >= 2000) return 'platinum';
        if (rating >= 1500) return 'gold';
        if (rating >= 1000) return 'silver';
        return 'bronze';
    }

    /**
     * ساخت اتاق از بازیکنان یافت شده
     * @param {Array<Object>} players - بازیکنان
     * @returns {Object} اتاق
     * @private
     */
    _createMatchedRoom(players) {
        const allPlayers = [
            {
                id: this.playerId,
                username: this.playerProfile?.username || 'Player',
                rating: this.playerProfile?.rating || 1000,
                league: this.playerProfile?.league?.tier || 'bronze',
                level: this.playerProfile?.level || 1,
                isHost: true
            },
            ...players
        ];

        return {
            id: Utils.generateUUID(),
            code: this._generateRoomCode(),
            players: allPlayers,
            gameMode: this.searchCriteria.gameMode,
            level: this.searchCriteria.level,
            createdAt: Date.now(),
            status: 'ready'
        };
    }

    /**
     * تولید کد اتاق
     * @returns {string}
     * @private
     */
    _generateRoomCode() {
        const digits = '0123456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += digits.charAt(Math.floor(Math.random() * digits.length));
        }
        return code;
    }

    // ============================================================
    // بخش ۳: مدیریت وضعیت‌ها
    // ============================================================

    /**
     * قبول Match
     * @returns {Object} نتیجه
     */
    acceptMatch() {
        if (this.status !== 'matched') {
            return {
                success: false,
                error: 'NOT_MATCHED',
                message: 'شما Match نشده‌اید'
            };
        }

        this._emit('match-accepted', {
            room: this.matchedRoom,
            players: this.matchedPlayers
        });

        if (this.debug) {
            console.log('✅ Match accepted');
        }

        return {
            success: true,
            room: this.matchedRoom
        };
    }

    /**
     * رد Match
     * @returns {Object} نتیجه
     */
    declineMatch() {
        if (this.status !== 'matched') {
            return {
                success: false,
                error: 'NOT_MATCHED',
                message: 'شما Match نشده‌اید'
            };
        }

        this.status = 'cancelled';
        this.stats.cancelledSearches++;

        this._emit('match-declined', {
            room: this.matchedRoom
        });

        if (this.debug) {
            console.log('❌ Match declined');
        }

        return {
            success: true
        };
    }

    /**
     * انصراف از جستجو
     * @returns {Object} نتیجه
     */
    cancelSearch() {
        if (this.status !== 'searching') {
            return {
                success: false,
                error: 'NOT_SEARCHING',
                message: 'شما در حال جستجو نیستید'
            };
        }

        this.status = 'cancelled';
        this.stats.cancelledSearches++;

        // توقف تایمرها
        this._stopSearchTimer();
        this._stopCountdownTimer();

        this._emit('search-cancelled', {
            searchTime: (Date.now() - this.searchStartTime) / 1000
        });

        if (this.debug) {
            console.log('🚫 Search cancelled');
        }

        this._addToHistory('cancelled', {
            searchTime: (Date.now() - this.searchStartTime) / 1000
        });

        return {
            success: true
        };
    }

    /**
     * مدیریت Timeout
     * @private
     */
    _handleTimeout() {
        this.status = 'timeout';
        this.stats.timeoutSearches++;

        this._stopCountdownTimer();

        this._emit('search-timeout', {
            maxTime: this.maxSearchTime
        });

        if (this.debug) {
            console.log('⏰ Search timeout');
        }

        this._addToHistory('timeout', {
            maxTime: this.maxSearchTime
        });
    }

    // ============================================================
    // بخش ۴: الگوریتم تطابق
    // ============================================================

    /**
     * محاسبه امتیاز تطابق بین دو بازیکن
     * @param {Object} player1 - بازیکن اول
     * @param {Object} player2 - بازیکن دوم
     * @returns {number} امتیاز تطابق (0-100)
     */
    calculateMatchScore(player1, player2) {
        let score = 0;

        // تطابق Rating (40%)
        const ratingDiff = Math.abs(player1.rating - player2.rating);
        const maxRatingDiff = 500;
        const ratingScore = Math.max(0, 100 - (ratingDiff / maxRatingDiff) * 100);
        score += ratingScore * this.matchingWeights.rating;

        // تطابق League (30%)
        const leagueOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
        const league1Index = leagueOrder.indexOf(player1.league);
        const league2Index = leagueOrder.indexOf(player2.league);
        const leagueDiff = Math.abs(league1Index - league2Index);
        const leagueScore = Math.max(0, 100 - (leagueDiff / 5) * 100);
        score += leagueScore * this.matchingWeights.league;

        // تطابق Level (15%)
        const levelDiff = Math.abs(player1.level - player2.level);
        const levelScore = Math.max(0, 100 - (levelDiff / 50) * 100);
        score += levelScore * this.matchingWeights.level;

        // تطابق Region (10%)
        const regionScore = player1.region === player2.region ? 100 : 50;
        score += regionScore * this.matchingWeights.region;

        // تطابق Win Rate (5%)
        const winRateDiff = Math.abs(player1.winRate - player2.winRate);
        const winRateScore = Math.max(0, 100 - winRateDiff);
        score += winRateScore * this.matchingWeights.winRate;

        return Math.round(score);
    }

    /**
     * بررسی آیا دو بازیکن می‌توانند Match شوند
     * @param {Object} player1 - بازیکن اول
     * @param {Object} player2 - بازیکن دوم
     * @param {Object} criteria - معیارها
     * @returns {boolean}
     */
    canMatch(player1, player2, criteria = {}) {
        const {
            maxRatingDiff = 200,
            maxLeagueDiff = 1,
            allowCrossRegion = false
        } = criteria;

        // بررسی Rating
        const ratingDiff = Math.abs(player1.rating - player2.rating);
        if (ratingDiff > maxRatingDiff) {
            return false;
        }

        // بررسی League
        const leagueOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
        const league1Index = leagueOrder.indexOf(player1.league);
        const league2Index = leagueOrder.indexOf(player2.league);
        const leagueDiff = Math.abs(league1Index - league2Index);
        if (leagueDiff > maxLeagueDiff) {
            return false;
        }

        // بررسی Region
        if (!allowCrossRegion && player1.region !== player2.region) {
            return false;
        }

        return true;
    }

    /**
     * یافتن بهترین Match از لیست بازیکنان
     * @param {Array<Object>} players - لیست بازیکنان
     * @param {Object} criteria - معیارها
     * @returns {Array<Object>} بازیکنان Match شده
     */
    findBestMatch(players, criteria = {}) {
        const scored = players.map(player => ({
            player,
            score: this.calculateMatchScore(this.playerProfile, player)
        }));

        // مرتب‌سازی بر اساس امتیاز
        scored.sort((a, b) => b.score - a.score);

        // انتخاب 3 بازیکن برتر
        return scored.slice(0, 3).map(s => s.player);
    }

    // ============================================================
    // بخش ۵: دریافت اطلاعات
    // ============================================================

    /**
     * دریافت وضعیت فعلی
     * @returns {Object}
     */
    getStatus() {
        return {
            status: this.status,
            searchCriteria: this.searchCriteria,
            timeRemaining: this.timeRemaining,
            maxSearchTime: this.maxSearchTime,
            matchedPlayers: this.matchedPlayers,
            matchedRoom: this.matchedRoom,
            searchStartTime: this.searchStartTime
        };
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            searchHistoryLength: this.searchHistory.length
        };
    }

    /**
     * دریافت تاریخچه جستجوها
     * @param {number} limit - تعداد
     * @returns {Array}
     */
    getSearchHistory(limit = 20) {
        return this.searchHistory.slice(-limit).reverse();
    }

    /**
     * دریافت زمان جستجوی میانگین
     * @returns {number} ثانیه
     */
    getAverageSearchTime() {
        return this.stats.averageSearchTime;
    }

    // ============================================================
    // بخش ۶: تنظیمات
    // ============================================================

    /**
     * تنظیم حداکثر زمان جستجو
     * @param {number} seconds - ثانیه
     * @returns {Object} نتیجه
     */
    setMaxSearchTime(seconds) {
        if (seconds < 30 || seconds > 300) {
            return {
                success: false,
                error: 'INVALID_TIME',
                message: 'زمان باید بین 30 تا 300 ثانیه باشد'
            };
        }

        this.maxSearchTime = seconds;

        return {
            success: true,
            maxSearchTime: seconds
        };
    }

    /**
     * تنظیم ضرایب تطابق
     * @param {Object} weights - ضرایب جدید
     * @returns {Object} نتیجه
     */
    setMatchingWeights(weights) {
        const total = Object.values(weights).reduce((sum, w) => sum + w, 0);

        if (Math.abs(total - 1) > 0.01) {
            return {
                success: false,
                error: 'INVALID_WEIGHTS',
                message: 'مجموع ضرایب باید 1 باشد'
            };
        }

        this.matchingWeights = weights;

        return {
            success: true,
            weights
        };
    }

    // ============================================================
    // بخش ۷: توابع کمکی
    // ============================================================

    /**
     * اضافه کردن به تاریخچه
     * @param {string} result - نتیجه
     * @param {Object} data - داده
     * @private
     */
    _addToHistory(result, data) {
        this.searchHistory.push({
            result,
            timestamp: Date.now(),
            criteria: this.searchCriteria,
            ...data
        });

        // محدود کردن تاریخچه
        if (this.searchHistory.length > 100) {
            this.searchHistory.shift();
        }
    }

    /**
     * ریست کامل
     */
    reset() {
        this.status = 'idle';
        this.searchCriteria = null;
        this.searchStartTime = null;
        this.timeRemaining = 0;
        this.matchedPlayers = [];
        this.matchedRoom = null;

        this._stopSearchTimer();
        this._stopCountdownTimer();

        if (this.debug) {
            console.log('🔄 MatchmakingManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const status = this.getStatus();
        const stats = this.getStats();

        console.log('🔍 Matchmaking Status:');
        console.log('  Status:', status.status);
        console.log('  Time Remaining:', status.timeRemaining + 's');
        console.log('  Matched Players:', status.matchedPlayers.length);
        console.log('  Total Searches:', stats.totalSearches);
        console.log('  Successful Matches:', stats.successfulMatches);
        console.log('  Cancelled:', stats.cancelledSearches);
        console.log('  Timeouts:', stats.timeoutSearches);
        console.log('  Avg Search Time:', stats.averageSearchTime.toFixed(2) + 's');
    }

    // ============================================================
    // بخش ۸: Event System
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
                    console.error(`❌ Matchmaking event listener error:`, error);
                }
            });
        }

        eventBus.emit(`matchmaking:${event}`, data);
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
const matchmakingManager = new MatchmakingManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MatchmakingManager, matchmakingManager };
} else {
    window.MatchmakingManager = MatchmakingManager;
    window.matchmakingManager = matchmakingManager;
}

console.log('✅ MatchmakingManager loaded');
