/**
 * ============================================================
 * HOKM MASTER - Turn Manager
 * مدیریت نوبت بازیکنان در بازی حکم
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم نوبت در بازی حکم است.
 * شامل تعیین نوبت بازیکنان، مدیریت تایمر، تشخیص AFK،
 * مدیریت Timeout، و انتقال نوبت بین بازیکنان.
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

class TurnManager {

    constructor() {
        /**
         * لیست بازیکنان به ترتیب نوبت
         * @type {Array<Object>}
         */
        this.players = [];

        /**
         * ایندکس بازیکن فعلی
         * @type {number}
         */
        this.currentPlayerIndex = -1;

        /**
         * وضعیت نوبت
         * @type {string} 'idle' | 'waiting' | 'active' | 'timeout' | 'ended'
         */
        this.status = 'idle';

        /**
         * تایمر نوبت
         * @type {number|null}
         */
        this.turnTimer = null;

        /**
         * زمان باقی‌مانده نوبت (ثانیه)
         * @type {number}
         */
        this.timeRemaining = 0;

        /**
         * زمان شروع نوبت
         * @type {number}
         */
        this.turnStartTime = 0;

        /**
         * مدت زمان نوبت (ثانیه)
         * @type {number}
         */
        this.turnDuration = CONFIG.GAME.TIMER.TURN_SECONDS;

        /**
         * زمان هشدار (ثانیه)
         * @type {number}
         */
        this.warningTime = CONFIG.GAME.TIMER.TURN_WARNING_SECONDS;

        /**
         * آیا هشدار ارسال شده
         * @type {boolean}
         */
        this.warningSent = false;

        /**
         * تعداد Timeout های هر بازیکن
         * @type {Object} { playerId: count }
         */
        this.timeoutCounts = {};

        /**
         * حداکثر Timeout قبل از اخراج
         * @type {number}
         */
        this.maxTimeouts = 3;

        /**
         * تاریخچه نوبت‌ها
         * @type {Array}
         */
        this.turnHistory = [];

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
         * آمار نوبت
         * @type {Object}
         */
        this.stats = {
            totalTurns: 0,
            totalTimeouts: 0,
            averageTurnTime: 0,
            fastestTurn: Infinity,
            slowestTurn: 0,
            totalAfkKicks: 0
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        if (this.debug) {
            console.log('⏱️ TurnManager initialized');
        }
    }

    // ============================================================
    // بخش ۱: راه‌اندازی نوبت
    // ============================================================

    /**
     * راه‌اندازی نوبت با لیست بازیکنان
     * @param {Array<Object>} players - لیست بازیکنان
     * @param {number} startingIndex - ایندکس شروع
     * @returns {Object} نتیجه
     */
    setup(players, startingIndex = 0) {
        if (!players || players.length === 0) {
            return {
                success: false,
                error: 'NO_PLAYERS',
                message: 'لیست بازیکنان خالی است'
            };
        }

        if (startingIndex < 0 || startingIndex >= players.length) {
            return {
                success: false,
                error: 'INVALID_START_INDEX',
                message: 'ایندکس شروع نامعتبر است'
            };
        }

        this.players = players.map((player, index) => ({
            ...player,
            turnIndex: index,
            timeoutCount: 0,
            totalTurnTime: 0,
            turnsPlayed: 0
        }));

        this.currentPlayerIndex = startingIndex;
        this.status = 'waiting';
        this.turnDuration = CONFIG.GAME.TIMER.TURN_SECONDS;
        this.warningTime = CONFIG.GAME.TIMER.TURN_WARNING_SECONDS;

        this._emit('turn-setup', {
            players: this.players,
            startingIndex
        });

        if (this.debug) {
            console.log(`⏱️ Turn setup: ${players.length} players, starting at ${startingIndex}`);
        }

        return {
            success: true,
            currentPlayer: this.getCurrentPlayer(),
            totalPlayers: this.players.length
        };
    }

    /**
     * شروع نوبت
     * @returns {Object} نتیجه
     */
    startTurn() {
        if (this.status === 'active') {
            return {
                success: false,
                error: 'TURN_ALREADY_ACTIVE',
                message: 'نوبت قبلاً فعال است'
            };
        }

        if (this.players.length === 0) {
            return {
                success: false,
                error: 'NO_PLAYERS',
                message: 'بازیکنی وجود ندارد'
            };
        }

        const currentPlayer = this.getCurrentPlayer();

        if (!currentPlayer) {
            return {
                success: false,
                error: 'NO_CURRENT_PLAYER',
                message: 'بازیکن فعلی مشخص نیست'
            };
        }

        this.status = 'active';
        this.turnStartTime = Date.now();
        this.timeRemaining = this.turnDuration;
        this.warningSent = false;

        this.stats.totalTurns++;

        // شروع تایمر
        this._startTurnTimer();

        this._emit('turn-started', {
            player: currentPlayer,
            playerIndex: this.currentPlayerIndex,
            timeRemaining: this.timeRemaining
        });

        if (this.debug) {
            console.log(`️ Turn started: Player ${this.currentPlayerIndex} (${currentPlayer.name || currentPlayer.username})`);
        }

        return {
            success: true,
            currentPlayer,
            timeRemaining: this.timeRemaining
        };
    }

    /**
     * پایان نوبت
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    endTurn(options = {}) {
        const {
            moveToNext = true,
            reason = 'normal'
        } = options;

        if (this.status !== 'active') {
            return {
                success: false,
                error: 'TURN_NOT_ACTIVE',
                message: 'نوبت فعال نیست'
            };
        }

        // محاسبه زمان صرف شده
        const turnDuration = (Date.now() - this.turnStartTime) / 1000;
        const currentPlayer = this.getCurrentPlayer();

        // به‌روزرسانی آمار بازیکن
        if (currentPlayer) {
            currentPlayer.totalTurnTime += turnDuration;
            currentPlayer.turnsPlayed++;
        }

        // به‌روزرسانی آمار کلی
        this.stats.averageTurnTime = 
            (this.stats.averageTurnTime * 0.7) + (turnDuration * 0.3);

        if (turnDuration < this.stats.fastestTurn) {
            this.stats.fastestTurn = turnDuration;
        }

        if (turnDuration > this.stats.slowestTurn) {
            this.stats.slowestTurn = turnDuration;
        }

        // ذخیره در تاریخچه
        this.turnHistory.push({
            playerIndex: this.currentPlayerIndex,
            player: currentPlayer,
            duration: turnDuration,
            reason,
            timestamp: Date.now()
        });

        // محدود کردن تاریخچه
        if (this.turnHistory.length > 100) {
            this.turnHistory.shift();
        }

        // توقف تایمر
        this._stopTurnTimer();

        this.status = 'ended';

        this._emit('turn-ended', {
            player: currentPlayer,
            duration: turnDuration,
            reason
        });

        if (this.debug) {
            console.log(`⏱️ Turn ended: Player ${this.currentPlayerIndex} (${turnDuration.toFixed(2)}s)`);
        }

        // رفتن به نوبت بعدی
        if (moveToNext) {
            return this.nextTurn();
        }

        return {
            success: true,
            duration: turnDuration,
            player: currentPlayer
        };
    }

    // ============================================================
    // بخش ۲: مدیریت تایمر
    // ============================================================

    /**
     * شروع تایمر نوبت
     * @private
     */
    _startTurnTimer() {
        this._stopTurnTimer();

        this.turnTimer = setInterval(() => {
            this.timeRemaining--;

            // بررسی هشدار
            if (this.timeRemaining <= this.warningTime && !this.warningSent) {
                this.warningSent = true;
                this._emit('turn-warning', {
                    player: this.getCurrentPlayer(),
                    timeRemaining: this.timeRemaining
                });

                if (this.debug) {
                    console.log(`⚠️ Turn warning: ${this.timeRemaining}s remaining`);
                }
            }

            // بررسی اتمام وقت
            if (this.timeRemaining <= 0) {
                this._handleTimeout();
            }

            // انتشار رویداد به‌روزرسانی زمان
            this._emit('turn-time-update', {
                timeRemaining: this.timeRemaining,
                player: this.getCurrentPlayer()
            });

        }, 1000);
    }

    /**
     * توقف تایمر نوبت
     * @private
     */
    _stopTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    }

    /**
     * مدیریت Timeout
     * @private
     */
    _handleTimeout() {
        this._stopTurnTimer();
        this.status = 'timeout';

        const currentPlayer = this.getCurrentPlayer();
        this.stats.totalTimeouts++;

        // افزایش شمارنده Timeout
        if (currentPlayer) {
            currentPlayer.timeoutCount = (currentPlayer.timeoutCount || 0) + 1;
            this.timeoutCounts[currentPlayer.id] = currentPlayer.timeoutCount;
        }

        this._emit('turn-timeout', {
            player: currentPlayer,
            playerIndex: this.currentPlayerIndex,
            timeoutCount: currentPlayer?.timeoutCount || 0
        });

        if (this.debug) {
            console.log(`⏰ Turn timeout: Player ${this.currentPlayerIndex}`);
        }

        // بررسی اخراج
        if (currentPlayer && currentPlayer.timeoutCount >= this.maxTimeouts) {
            this._handleAfkKick(currentPlayer);
        } else {
            // بازی خودکار
            this._emit('auto-play-required', {
                player: currentPlayer
            });
        }
    }

    /**
     * مدیریت اخراج AFK
     * @param {Object} player - بازیکن
     * @private
     */
    _handleAfkKick(player) {
        this.stats.totalAfkKicks++;

        this._emit('player-kicked-afk', {
            player,
            reason: 'max_timeouts',
            timeoutCount: player.timeoutCount
        });

        if (this.debug) {
            console.log(` Player ${player.id} kicked for AFK`);
        }

        // حذف بازیکن و ادامه بازی
        this.removePlayer(player.id);
    }

    /**
     * تمدید زمان نوبت
     * @param {number} seconds - ثانیه‌های اضافه
     * @returns {Object} نتیجه
     */
    extendTime(seconds) {
        if (this.status !== 'active') {
            return {
                success: false,
                error: 'TURN_NOT_ACTIVE',
                message: 'نوبت فعال نیست'
            };
        }

        this.timeRemaining += seconds;
        this.warningSent = false;

        this._emit('turn-time-extended', {
            player: this.getCurrentPlayer(),
            addedTime: seconds,
            newTimeRemaining: this.timeRemaining
        });

        if (this.debug) {
            console.log(`️ Time extended: +${seconds}s`);
        }

        return {
            success: true,
            newTimeRemaining: this.timeRemaining
        };
    }

    /**
     * توقف موقت تایمر (Pause)
     * @returns {Object} نتیجه
     */
    pauseTimer() {
        if (this.status !== 'active') {
            return {
                success: false,
                error: 'TURN_NOT_ACTIVE',
                message: 'نوبت فعال نیست'
            };
        }

        this._stopTurnTimer();
        this.status = 'waiting';

        this._emit('turn-paused', {
            player: this.getCurrentPlayer(),
            timeRemaining: this.timeRemaining
        });

        return {
            success: true,
            timeRemaining: this.timeRemaining
        };
    }

    /**
     * ادامه تایمر (Resume)
     * @returns {Object} نتیجه
     */
    resumeTimer() {
        if (this.status !== 'waiting') {
            return {
                success: false,
                error: 'TURN_NOT_PAUSED',
                message: 'نوبت متوقف نشده است'
            };
        }

        this.status = 'active';
        this._startTurnTimer();

        this._emit('turn-resumed', {
            player: this.getCurrentPlayer(),
            timeRemaining: this.timeRemaining
        });

        return {
            success: true,
            timeRemaining: this.timeRemaining
        };
    }

    // ============================================================
    // بخش ۳: مدیریت نوبت
    // ============================================================

    /**
     * رفتن به نوبت بعدی
     * @returns {Object} نتیجه
     */
    nextTurn() {
        if (this.players.length === 0) {
            return {
                success: false,
                error: 'NO_PLAYERS',
                message: 'بازیکنی وجود ندارد'
            };
        }

        // پیدا کردن بازیکن بعدی (که حذف نشده باشد)
        let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
        let attempts = 0;

        while (attempts < this.players.length) {
            const nextPlayer = this.players[nextIndex];
            if (nextPlayer && !nextPlayer.removed) {
                break;
            }
            nextIndex = (nextIndex + 1) % this.players.length;
            attempts++;
        }

        if (attempts >= this.players.length) {
            return {
                success: false,
                error: 'NO_ACTIVE_PLAYERS',
                message: 'بازیکن فعالی وجود ندارد'
            };
        }

        this.currentPlayerIndex = nextIndex;
        this.status = 'waiting';

        this._emit('turn-changed', {
            previousPlayer: this.players[(nextIndex - 1 + this.players.length) % this.players.length],
            currentPlayer: this.getCurrentPlayer(),
            playerIndex: nextIndex
        });

        if (this.debug) {
            console.log(`⏱️ Next turn: Player ${nextIndex}`);
        }

        return {
            success: true,
            currentPlayer: this.getCurrentPlayer(),
            playerIndex: nextIndex
        };
    }

    /**
     * پرش به نوبت بازیکن خاص
     * @param {number} playerIndex - ایندکس بازیکن
     * @returns {Object} نتیجه
     */
    skipToPlayer(playerIndex) {
        if (playerIndex < 0 || playerIndex >= this.players.length) {
            return {
                success: false,
                error: 'INVALID_PLAYER_INDEX',
                message: 'ایندکس بازیکن نامعتبر است'
            };
        }

        const player = this.players[playerIndex];
        if (player.removed) {
            return {
                success: false,
                error: 'PLAYER_REMOVED',
                message: 'بازیکن حذف شده است'
            };
        }

        this.currentPlayerIndex = playerIndex;
        this.status = 'waiting';

        this._emit('turn-skipped', {
            player,
            playerIndex
        });

        return {
            success: true,
            currentPlayer: player
        };
    }

    /**
     * دریافت بازیکن فعلی
     * @returns {Object|null}
     */
    getCurrentPlayer() {
        if (this.currentPlayerIndex < 0 || this.currentPlayerIndex >= this.players.length) {
            return null;
        }
        return this.players[this.currentPlayerIndex];
    }

    /**
     * دریافت ایندکس بازیکن فعلی
     * @returns {number}
     */
    getCurrentPlayerIndex() {
        return this.currentPlayerIndex;
    }

    /**
     * آیا نوبت بازیکن خاص است
     * @param {number|string} playerId - شناسه بازیکن
     * @returns {boolean}
     */
    isPlayerTurn(playerId) {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer) return false;

        return currentPlayer.id === playerId || currentPlayer.turnIndex === playerId;
    }

    // ============================================================
    // بخش ۴: مدیریت بازیکنان
    // ============================================================

    /**
     * اضافه کردن بازیکن
     * @param {Object} player - بازیکن
     * @returns {Object} نتیجه
     */
    addPlayer(player) {
        if (!player || !player.id) {
            return {
                success: false,
                error: 'INVALID_PLAYER',
                message: 'بازیکن نامعتبر است'
            };
        }

        // بررسی تکراری نبودن
        if (this.players.some(p => p.id === player.id)) {
            return {
                success: false,
                error: 'PLAYER_EXISTS',
                message: 'بازیکن قبلاً اضافه شده است'
            };
        }

        player.turnIndex = this.players.length;
        player.timeoutCount = 0;
        player.totalTurnTime = 0;
        player.turnsPlayed = 0;
        player.removed = false;

        this.players.push(player);

        this._emit('player-added', {
            player,
            totalPlayers: this.players.length
        });

        return {
            success: true,
            player,
            totalPlayers: this.players.length
        };
    }

    /**
     * حذف بازیکن
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     */
    removePlayer(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);

        if (playerIndex === -1) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن یافت نشد'
            };
        }

        const player = this.players[playerIndex];
        player.removed = true;

        this._emit('player-removed', {
            player,
            playerIndex
        });

        // اگر بازیکن حذف شده نوبت فعلی است، برو به بعدی
        if (playerIndex === this.currentPlayerIndex) {
            this.nextTurn();
        }

        return {
            success: true,
            player,
            remainingPlayers: this.players.filter(p => !p.removed).length
        };
    }

    /**
     * دریافت تعداد بازیکنان فعال
     * @returns {number}
     */
    getActivePlayerCount() {
        return this.players.filter(p => !p.removed).length;
    }

    /**
     * دریافت لیست بازیکنان فعال
     * @returns {Array}
     */
    getActivePlayers() {
        return this.players.filter(p => !p.removed);
    }

    // ============================================================
    // بخش ۵: تشخیص AFK
    // ============================================================

    /**
     * بررسی وضعیت AFK بازیکن
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     */
    checkAfkStatus(playerId) {
        const player = this.players.find(p => p.id === playerId);

        if (!player) {
            return {
                isAfk: false,
                reason: 'PLAYER_NOT_FOUND'
            };
        }

        const timeoutCount = player.timeoutCount || 0;
        const isAfk = timeoutCount >= this.maxTimeouts;

        return {
            isAfk,
            playerId,
            timeoutCount,
            maxTimeouts: this.maxTimeouts,
            remainingTimeouts: this.maxTimeouts - timeoutCount
        };
    }

    /**
     * ریست شمارنده Timeout بازیکن
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     */
    resetTimeoutCount(playerId) {
        const player = this.players.find(p => p.id === playerId);

        if (!player) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن یافت نشد'
            };
        }

        const oldCount = player.timeoutCount;
        player.timeoutCount = 0;
        this.timeoutCounts[playerId] = 0;

        this._emit('timeout-count-reset', {
            player,
            oldCount
        });

        return {
            success: true,
            player,
            oldCount
        };
    }

    // ============================================================
    // بخش : اطلاعات و آمار
    // ============================================================

    /**
     * دریافت وضعیت کامل نوبت
     * @returns {Object}
     */
    getTurnState() {
        return {
            status: this.status,
            currentPlayer: this.getCurrentPlayer(),
            currentPlayerIndex: this.currentPlayerIndex,
            timeRemaining: this.timeRemaining,
            turnDuration: this.turnDuration,
            warningTime: this.warningTime,
            totalPlayers: this.players.length,
            activePlayers: this.getActivePlayerCount(),
            players: this.players.map(p => ({
                id: p.id,
                name: p.name || p.username,
                turnIndex: p.turnIndex,
                timeoutCount: p.timeoutCount || 0,
                totalTurnTime: p.totalTurnTime || 0,
                turnsPlayed: p.turnsPlayed || 0,
                removed: p.removed || false
            }))
        };
    }

    /**
     * دریافت آمار نوبت
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            turnHistoryLength: this.turnHistory.length,
            currentTurnDuration: this.status === 'active' ? 
                (Date.now() - this.turnStartTime) / 1000 : 0
        };
    }

    /**
     * دریافت تاریخچه نوبت
     * @param {number} limit - تعداد
     * @returns {Array}
     */
    getTurnHistory(limit = 20) {
        return this.turnHistory.slice(-limit).reverse();
    }

    /**
     * دریافت آمار بازیکن
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object|null}
     */
    getPlayerStats(playerId) {
        const player = this.players.find(p => p.id === playerId);

        if (!player) return null;

        return {
            id: player.id,
            name: player.name || player.username,
            turnsPlayed: player.turnsPlayed || 0,
            totalTurnTime: player.totalTurnTime || 0,
            averageTurnTime: player.turnsPlayed > 0 ? 
                player.totalTurnTime / player.turnsPlayed : 0,
            timeoutCount: player.timeoutCount || 0,
            isRemoved: player.removed || false
        };
    }

    // ============================================================
    // بخش : تنظیمات
    // ============================================================

    /**
     * تنظیم مدت زمان نوبت
     * @param {number} seconds - ثانیه
     * @returns {Object} نتیجه
     */
    setTurnDuration(seconds) {
        if (seconds < 5 || seconds > 300) {
            return {
                success: false,
                error: 'INVALID_DURATION',
                message: 'مدت زمان باید بین 5 تا 300 ثانیه باشد'
            };
        }

        this.turnDuration = seconds;

        this._emit('turn-duration-changed', {
            duration: seconds
        });

        return {
            success: true,
            duration: seconds
        };
    }

    /**
     * تنظیم زمان هشدار
     * @param {number} seconds - ثانیه
     * @returns {Object} نتیجه
     */
    setWarningTime(seconds) {
        if (seconds < 1 || seconds >= this.turnDuration) {
            return {
                success: false,
                error: 'INVALID_WARNING_TIME',
                message: 'زمان هشدار نامعتبر است'
            };
        }

        this.warningTime = seconds;

        return {
            success: true,
            warningTime: seconds
        };
    }

    /**
     * تنظیم حداکثر Timeout
     * @param {number} max - حداکثر
     * @returns {Object} نتیجه
     */
    setMaxTimeouts(max) {
        if (max < 1 || max > 10) {
            return {
                success: false,
                error: 'INVALID_MAX_TIMEOUTS',
                message: 'حداکثر Timeout باید بین 1 تا 10 باشد'
            };
        }

        this.maxTimeouts = max;

        return {
            success: true,
            maxTimeouts: max
        };
    }

    // ============================================================
    // بخش : ریست و پاکسازی
    // ============================================================

    /**
     * ریست کامل Turn Manager
     * @returns {void}
     */
    reset() {
        this._stopTurnTimer();

        this.players = [];
        this.currentPlayerIndex = -1;
        this.status = 'idle';
        this.timeRemaining = 0;
        this.turnStartTime = 0;
        this.warningSent = false;
        this.timeoutCounts = {};
        this.turnHistory = [];

        this.stats = {
            totalTurns: 0,
            totalTimeouts: 0,
            averageTurnTime: 0,
            fastestTurn: Infinity,
            slowestTurn: 0,
            totalAfkKicks: 0
        };

        this._emit('turn-reset');

        if (this.debug) {
            console.log('🔄 TurnManager reset');
        }
    }

    /**
     * پاکسازی کامل
     * @returns {void}
     */
    destroy() {
        this.reset();
        this.clearListeners();

        if (this.debug) {
            console.log('🗑️ TurnManager destroyed');
        }
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
                    console.error(` Turn event listener error:`, error);
                }
            });
        }

        // انتشار در eventBus اصلی
        eventBus.emit(`turn:${event}`, data);
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
        const state = this.getTurnState();
        const stats = this.getStats();

        console.log('⏱️ TurnManager Status:');
        console.log('  Status:', state.status);
        console.log('  Current Player:', state.currentPlayer?.name || 'None');
        console.log('  Time Remaining:', state.timeRemaining + 's');
        console.log('  Total Players:', state.totalPlayers);
        console.log('  Active Players:', state.activePlayers);
        console.log('  Total Turns:', stats.totalTurns);
        console.log('  Total Timeouts:', stats.totalTimeouts);
        console.log('  Average Turn Time:', stats.averageTurnTime.toFixed(2) + 's');
        console.log('  Fastest Turn:', stats.fastestTurn === Infinity ? 'N/A' : stats.fastestTurn.toFixed(2) + 's');
        console.log('  Slowest Turn:', stats.slowestTurn.toFixed(2) + 's');
        console.log('  Total AFK Kicks:', stats.totalAfkKicks);
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const turnManager = new TurnManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TurnManager, turnManager };
} else {
    window.TurnManager = TurnManager;
    window.turnManager = turnManager;
}

console.log('✅ TurnManager loaded');
