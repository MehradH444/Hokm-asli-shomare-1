/**
 * ============================================================
 * HOKM MASTER - Quick Play Mode
 * حالت بازی سریع (Quick Match)
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل حالت بازی سریع است. شامل
 * شروع بازی، اتصال به matchmaking، مدیریت lobby، شروع بازی،
 * مدیریت gameplay، پایان بازی، دریافت پاداش، و بازگشت به
 * صفحه اصلی.
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
 * - matchmakingManager (از فایل matchmaking.js)
 * - roomManager (از فایل room.js)
 * - hokmEngine (از فایل engine.js)
 * - cardEngine (از فایل cards.js)
 * - aiEngine (از فایل ai.js)
 * - scoringEngine (از فایل scoring.js)
 * - validationEngine (از فایل validation.js)
 * 
 * ============================================================
 */

class QuickPlayMode {

    constructor() {
        /**
         * وضعیت فعلی حالت بازی
         * @type {string} 'idle' | 'searching' | 'lobby' | 'playing' | 'finished' | 'reward'
         */
        this.status = 'idle';

        /**
         * شناسه بازی فعلی
         * @type {string|null}
         */
        this.gameId = null;

        /**
         * شناسه اتاق فعلی
         * @type {string|null}
         */
        this.roomId = null;

        /**
         * اطلاعات بازیکن فعلی
         * @type {Object|null}
         */
        this.player = null;

        /**
         * لیست بازیکنان
         * @type {Array<Object>}
         */
        this.players = [];

        /**
         * تیم‌ها
         * @type {Object}
         */
        this.teams = {
            team1: [],
            team2: []
        };

        /**
         * وضعیت بازی
         * @type {Object|null}
         */
        this.gameState = null;

        /**
         * نتیجه بازی
         * @type {Object|null}
         */
        this.gameResult = null;

        /**
         * پاداش بازی
         * @type {Object|null}
         */
        this.reward = null;

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
         * آمار بازی سریع
         * @type {Object}
         */
        this.stats = {
            totalGames: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            averageGameDuration: 0,
            totalCoinsEarned: 0,
            totalXpEarned: 0
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
            this.player = {
                id: user.id,
                username: user.username,
                profile: user.profile
            };
        }

        // ثبت listener برای matchmaking
        if (matchmakingManager) {
            matchmakingManager.on('match-found', (data) => {
                this._handleMatchFound(data);
            });
        }

        if (this.debug) {
            console.log('⚡ QuickPlayMode initialized');
        }
    }

    // ============================================================
    // بخش ۱: شروع بازی سریع
    // ============================================================

    /**
     * شروع بازی سریع
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    startQuickPlay(options = {}) {
        if (this.status !== 'idle') {
            return {
                success: false,
                error: 'GAME_IN_PROGRESS',
                message: 'یک بازی در حال انجام است'
            };
        }

        if (!this.player) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای بازی باید وارد شوید'
            };
        }

        const {
            level = 'normal',
            timeout = 120
        } = options;

        // تغییر وضعیت
        this.status = 'searching';

        this._emit('game-searching', {
            level,
            timeout
        });

        if (this.debug) {
            console.log('⚡ Quick play started');
        }

        // شروع matchmaking
        if (matchmakingManager) {
            const result = matchmakingManager.startSearch({
                gameMode: 'quick',
                level,
                timeout
            });

            if (!result.success) {
                this.status = 'idle';
                return result;
            }
        } else {
            // شبیه‌سازی بدون matchmaking
            this._simulateQuickMatch(level);
        }

        return {
            success: true,
            status: 'searching'
        };
    }

    /**
     * شبیه‌سازی بازی سریع (بدون سرور)
     * @param {string} level - سطح
     * @private
     */
    _simulateQuickMatch(level) {
        // شبیه‌سازی پیدا کردن بازیکنان
        setTimeout(() => {
            if (this.status === 'searching') {
                this._handleMatchFound({
                    players: this._generateAIOpponents(level),
                    room: {
                        id: Utils.generateUUID(),
                        code: Utils.randomString(5)
                    }
                });
            }
        }, Utils.randomInt(2000, 5000));
    }

    /**
     * تولید حریفان AI
     * @param {string} level - سطح
     * @returns {Array<Object>}
     * @private
     */
    _generateAIOpponents(level) {
        const opponents = [];

        for (let i = 0; i < 3; i++) {
            opponents.push({
                id: Utils.generateUUID(),
                username: `AI_${Utils.randomInt(1000, 9999)}`,
                isAI: true,
                aiLevel: level,
                rating: Utils.randomInt(800, 1200),
                avatar: Utils.randomInt(1, 50)
            });
        }

        return opponents;
    }

    /**
     * مدیریت پیدا شدن Match
     * @param {Object} data - داده
     * @private
     */
    _handleMatchFound(data) {
        const { players, room } = data;

        this.roomId = room.id;
        this.players = [
            this.player,
            ...players
        ];

        // تقسیم تیم‌ها
        this._assignTeams();

        // تغییر وضعیت به lobby
        this.status = 'lobby';

        this._emit('match-found', {
            players: this.players,
            room
        });

        if (this.debug) {
            console.log('✅ Match found, entering lobby');
        }

        // شروع خودکار بعد از 3 ثانیه
        setTimeout(() => {
            if (this.status === 'lobby') {
                this._startGame();
            }
        }, 3000);
    }

    /**
     * تقسیم بازیکنان به تیم‌ها
     * @private
     */
    _assignTeams() {
        this.teams = {
            team1: [this.players[0], this.players[2]],
            team2: [this.players[1], this.players[3]]
        };
    }

    // ============================================================
    // بخش ۲: Lobby
    // ============================================================

    /**
     * دریافت اطلاعات Lobby
     * @returns {Object}
     */
    getLobbyInfo() {
        return {
            status: this.status,
            roomId: this.roomId,
            players: this.players,
            teams: this.teams,
            timeToStart: 3
        };
    }

    /**
     * انصراف از Lobby
     * @returns {Object} نتیجه
     */
    leaveLobby() {
        if (this.status !== 'lobby') {
            return {
                success: false,
                error: 'NOT_IN_LOBBY',
                message: 'شما در Lobby نیستید'
            };
        }

        this._cleanup();

        this._emit('lobby-left');

        if (this.debug) {
            console.log('🚪 Left lobby');
        }

        return {
            success: true
        };
    }

    // ============================================================
    // بخش ۳: شروع بازی
    // ============================================================

    /**
     * شروع بازی
     * @private
     */
    _startGame() {
        if (this.status !== 'lobby') {
            return {
                success: false,
                error: 'NOT_IN_LOBBY',
                message: 'شما در Lobby نیستید'
            };
        }

        this.status = 'playing';
        this.gameId = Utils.generateUUID();

        // راه‌اندازی HokmEngine
        if (hokmEngine) {
            const result = hokmEngine.startGame(this.players, {
                mode: 'quick',
                level: 'normal',
                roundsToWin: 2
            });

            if (result.success) {
                this.gameState = hokmEngine.getGameState();

                // ثبت listener برای رویدادهای بازی
                this._setupGameListeners();

                this._emit('game-started', {
                    gameId: this.gameId,
                    players: this.players
                });

                if (this.debug) {
                    console.log('🎮 Game started');
                }
            }
        } else {
            // شبیه‌سازی بازی
            this._simulateGame();
        }

        return {
            success: true,
            gameId: this.gameId
        };
    }

    /**
     * ثبت listener های بازی
     * @private
     */
    _setupGameListeners() {
        if (!hokmEngine) return;

        hokmEngine.on('trump-selected', (data) => {
            this._emit('trump-selected', data);
        });

        hokmEngine.on('card-played', (data) => {
            this._emit('card-played', data);
        });

        hokmEngine.on('trick-won', (data) => {
            this._emit('trick-won', data);
        });

        hokmEngine.on('round-completed', (data) => {
            this._emit('round-completed', data);
        });

        hokmEngine.on('match-completed', (data) => {
            this._handleGameEnd(data);
        });
    }

    /**
     * شبیه‌سازی بازی (بدون engine)
     * @private
     */
    _simulateGame() {
        const duration = Utils.randomInt(300000, 600000); // 5-10 دقیقه

        setTimeout(() => {
            if (this.status === 'playing') {
                this._handleGameEnd({
                    winner: Math.random() > 0.5 ? 'team1' : 'team2',
                    score: {
                        team1: Utils.randomInt(7, 13),
                        team2: Utils.randomInt(7, 13)
                    }
                });
            }
        }, duration);
    }

    // ============================================================
    // بخش : Gameplay
    // ============================================================

    /**
     * بازی کردن کارت
     * @param {Object} card - کارت
     * @returns {Object} نتیجه
     */
    playCard(card) {
        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        if (!hokmEngine) {
            return {
                success: false,
                error: 'NO_ENGINE',
                message: 'موتور بازی در دسترس نیست'
            };
        }

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const result = hokmEngine.playCard(playerIndex, card);

        if (result.success) {
            this.gameState = hokmEngine.getGameState();

            this._emit('card-played', {
                card,
                playerIndex
            });

            if (this.debug) {
                console.log(`🃏 Card played: ${card.nameFa}`);
            }
        }

        return result;
    }

    /**
     * انتخاب حکم
     * @param {string} suit - خال
     * @returns {Object} نتیجه
     */
    selectTrump(suit) {
        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        if (!hokmEngine) {
            return {
                success: false,
                error: 'NO_ENGINE',
                message: 'موتور بازی در دسترس نیست'
            };
        }

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const result = hokmEngine.selectTrump(suit, playerIndex);

        if (result.success) {
            this.gameState = hokmEngine.getGameState();

            this._emit('trump-selected', {
                suit,
                playerIndex
            });

            if (this.debug) {
                console.log(`👑 Trump selected: ${suit}`);
            }
        }

        return result;
    }

    /**
     * دریافت وضعیت بازی
     * @returns {Object}
     */
    getGameState() {
        if (hokmEngine) {
            return hokmEngine.getGameState();
        }

        return this.gameState;
    }

    /**
     * دریافت کارت‌های بازیکن
     * @returns {Array<Object>}
     */
    getPlayerHand() {
        if (!hokmEngine) return [];

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const player = hokmEngine.getPlayerInfo(playerIndex);

        return player?.hand || [];
    }

    // ============================================================
    // بخش ۵: پایان بازی
    // ============================================================

    /**
     * مدیریت پایان بازی
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _handleGameEnd(result) {
        this.status = 'finished';
        this.gameResult = result;

        // محاسبه پاداش
        this._calculateReward(result);

        // به‌روزرسانی آمار
        this._updateStats(result);

        this._emit('game-ended', {
            result,
            reward: this.reward
        });

        if (this.debug) {
            console.log('🏁 Game ended');
        }
    }

    /**
     * محاسبه پاداش
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _calculateReward(result) {
        if (!scoringEngine) {
            this.reward = {
                coins: 100,
                xp: 50
            };
            return;
        }

        const isWinner = result.winner === 'team1';
        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;

        const gameResult = {
            mode: 'quick',
            level: 'normal',
            isWinner: team === result.winner,
            tricksWon: result.score?.[team] || 0,
            totalTricks: 26
        };

        const playerProfile = this.player?.profile || {};

        this.reward = scoringEngine.calculateFullReward(gameResult, playerProfile);

        if (this.debug) {
            console.log('💰 Reward calculated:', this.reward);
        }
    }

    /**
     * به‌روزرسانی آمار
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _updateStats(result) {
        this.stats.totalGames++;

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;
        const isWinner = team === result.winner;

        if (isWinner) {
            this.stats.wins++;
        } else {
            this.stats.losses++;
        }

        this.stats.winRate = (this.stats.wins / this.stats.totalGames) * 100;

        if (this.reward) {
            this.stats.totalCoinsEarned += this.reward.coins || 0;
            this.stats.totalXpEarned += this.reward.xp || 0;
        }
    }

    // ============================================================
    // بخش ۶: دریافت پاداش
    // ============================================================

    /**
     * دریافت پاداش بازی
     * @returns {Object} نتیجه
     */
    claimReward() {
        if (this.status !== 'finished') {
            return {
                success: false,
                error: 'GAME_NOT_FINISHED',
                message: 'بازی تمام نشده است'
            };
        }

        if (!this.reward) {
            return {
                success: false,
                error: 'NO_REWARD',
                message: 'پاداشی وجود ندارد'
            };
        }

        // به‌روزرسانی پروفایل بازیکن
        this._applyRewardToProfile();

        this.status = 'reward';

        this._emit('reward-claimed', {
            reward: this.reward
        });

        if (this.debug) {
            console.log(' Reward claimed');
        }

        return {
            success: true,
            reward: this.reward
        };
    }

    /**
     * اعمال پاداش به پروفایل
     * @private
     */
    _applyRewardToProfile() {
        if (!this.reward || !this.player) return;

        // به‌روزرسانی سکه و XP
        if (this.player.profile) {
            this.player.profile.coins = (this.player.profile.coins || 0) + (this.reward.coins || 0);
            this.player.profile.xp = (this.player.profile.xp || 0) + (this.reward.xp || 0);

            // به‌روزرسانی آمار
            if (this.player.profile.stats) {
                this.player.profile.stats.totalGames++;
                if (this.gameResult?.winner === this.players[this.players.findIndex(p => p.id === this.player.id)]?.team) {
                    this.player.profile.stats.wins++;
                } else {
                    this.player.profile.stats.losses++;
                }
            }

            // ذخیره پروفایل
            if (storage) {
                storage.saveUserProfile(this.player);
            }
        }
    }

    /**
     * دریافت اطلاعات پاداش
     * @returns {Object}
     */
    getRewardInfo() {
        return {
            reward: this.reward,
            gameResult: this.gameResult,
            canClaim: this.status === 'finished' && this.reward !== null
        };
    }

    // ============================================================
    // بخش : بازگشت به Home
    // ============================================================

    /**
     * بازگشت به صفحه اصلی
     * @returns {Object} نتیجه
     */
    returnToHome() {
        this._cleanup();

        this._emit('returned-to-home');

        if (this.debug) {
            console.log('🏠 Returned to home');
        }

        return {
            success: true
        };
    }

    /**
     * بازی مجدد
     * @returns {Object} نتیجه
     */
    playAgain() {
        this._cleanup();

        // شروع بازی جدید
        return this.startQuickPlay({
            level: 'normal'
        });
    }

    // ============================================================
    // بخش ۸: پاکسازی
    // ============================================================

    /**
     * پاکسازی کامل
     * @private
     */
    _cleanup() {
        this.status = 'idle';
        this.gameId = null;
        this.roomId = null;
        this.players = [];
        this.teams = { team1: [], team2: [] };
        this.gameState = null;
        this.gameResult = null;
        this.reward = null;

        // پاک کردن listener های بازی
        if (hokmEngine) {
            hokmEngine.clearListeners();
        }

        // انصراف از matchmaking
        if (matchmakingManager && matchmakingManager.status === 'searching') {
            matchmakingManager.cancelSearch();
        }

        if (this.debug) {
            console.log('🧹 QuickPlayMode cleaned up');
        }
    }

    /**
     * ریست کامل
     */
    reset() {
        this._cleanup();

        this.stats = {
            totalGames: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            averageGameDuration: 0,
            totalCoinsEarned: 0,
            totalXpEarned: 0
        };

        if (this.debug) {
            console.log('🔄 QuickPlayMode reset');
        }
    }

    // ============================================================
    // بخش ۹: دریافت اطلاعات
    // ============================================================

    /**
     * دریافت وضعیت فعلی
     * @returns {Object}
     */
    getStatus() {
        return {
            status: this.status,
            gameId: this.gameId,
            roomId: this.roomId,
            player: this.player,
            players: this.players,
            teams: this.teams,
            gameState: this.gameState,
            gameResult: this.gameResult,
            reward: this.reward
        };
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const status = this.getStatus();
        const stats = this.getStats();

        console.log('⚡ QuickPlayMode Status:');
        console.log('  Status:', status.status);
        console.log('  Game ID:', status.gameId || 'None');
        console.log('  Players:', status.players.length);
        console.log('  Total Games:', stats.totalGames);
        console.log('  Wins:', stats.wins);
        console.log('  Losses:', stats.losses);
        console.log('  Win Rate:', stats.winRate.toFixed(1) + '%');
        console.log('  Total Coins:', stats.totalCoinsEarned);
        console.log('  Total XP:', stats.totalXpEarned);
    }

    // ============================================================
    // بخش ۰: Event System
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
                    console.error(`❌ QuickPlay event listener error:`, error);
                }
            });
        }

        eventBus.emit(`quick-play:${event}`, data);
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
const quickPlayMode = new QuickPlayMode();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuickPlayMode, quickPlayMode };
} else {
    window.QuickPlayMode = QuickPlayMode;
    window.quickPlayMode = quickPlayMode;
}

console.log('✅ QuickPlayMode loaded');
