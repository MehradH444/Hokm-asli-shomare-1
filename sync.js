/**
 * ============================================================
 * HOKM MASTER - Game Sync Manager
 * همگام‌سازی وضعیت بازی چند نفره
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل همگام‌سازی وضعیت بازی بین
 * تمام بازیکنان در یک اتاق است. شامل sync کارت‌ها، امتیازات،
 * نوبت، reconnect، conflict resolution، و بهینه‌سازی شبکه.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - wsManager (از فایل websocket.js)
 * - roomManager (از فایل room.js)
 * - hokmEngine (از فایل engine.js)
 * 
 * ============================================================
 */

class GameSyncManager {

    constructor() {
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
         * شناسه بازیکن فعلی
         * @type {string|null}
         */
        this.playerId = null;

        /**
         * وضعیت محلی بازی
         * @type {Object}
         */
        this.localState = {
            players: [],
            scores: { team1: 0, team2: 0 },
            currentTrick: [],
            trump: null,
            leadSuit: null,
            currentPlayerIndex: 0,
            trickNumber: 0,
            roundNumber: 1,
            status: 'waiting'
        };

        /**
         * وضعیت سرور (آخرین وضعیت دریافتی)
         * @type {Object}
         */
        this.serverState = null;

        /**
         * صف عملیات در انتظار تأیید
         * @type {Array}
         */
        this.pendingOperations = [];

        /**
         * تاریخچه وضعیت‌ها (برای rollback)
         * @type {Array}
         */
        this.stateHistory = [];

        /**
         * حداکثر تاریخچه
         * @type {number}
         */
        this.maxHistorySize = 50;

        /**
         * شماره نسخه وضعیت
         * @type {number}
         */
        this.stateVersion = 0;

        /**
         * آیا در حال reconnect است
         * @type {boolean}
         */
        this.isReconnecting = false;

        /**
         * تایمر heartbeat
         * @type {number|null}
         */
        this.heartbeatTimer = null;

        /**
         * فاصله heartbeat (میلی‌ثانیه)
         * @type {number}
         */
        this.heartbeatInterval = 5000;

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
         * آمار sync
         * @type {Object}
         */
        this.stats = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            conflictsResolved: 0,
            reconnects: 0,
            averageLatency: 0,
            totalDataSent: 0,
            totalDataReceived: 0
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
        const user = storage.getUserProfile();
        if (user) {
            this.playerId = user.id;
        }

        if (this.debug) {
            console.log('🔄 GameSyncManager initialized');
        }
    }

    // ============================================================
    // بخش ۱: شروع همگام‌سازی
    // ============================================================

    /**
     * شروع همگام‌سازی برای یک بازی
     * @param {Object} gameInfo - اطلاعات بازی
     * @returns {Object} نتیجه
     */
    startSync(gameInfo) {
        const {
            gameId,
            roomId,
            initialState
        } = gameInfo;

        if (!gameId || !roomId) {
            return {
                success: false,
                error: 'INVALID_GAME_INFO',
                message: 'اطلاعات بازی نامعتبر است'
            };
        }

        this.gameId = gameId;
        this.roomId = roomId;

        // تنظیم وضعیت اولیه
        if (initialState) {
            this.localState = { ...initialState };
            this.serverState = { ...initialState };
        }

        this.stateVersion = 0;
        this.stateHistory = [];
        this.pendingOperations = [];

        // شروع heartbeat
        this._startHeartbeat();

        this._emit('sync-started', {
            gameId,
            roomId,
            playerId: this.playerId
        });

        if (this.debug) {
            console.log(` Sync started for game: ${gameId}`);
        }

        return {
            success: true,
            gameId,
            roomId
        };
    }

    /**
     * شروع heartbeat
     * @private
     */
    _startHeartbeat() {
        this._stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            this._sendHeartbeat();
        }, this.heartbeatInterval);
    }

    /**
     * توقف heartbeat
     * @private
     */
    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * ارسال heartbeat
     * @private
     */
    _sendHeartbeat() {
        if (!this.gameId) return;

        const heartbeat = {
            type: 'heartbeat',
            gameId: this.gameId,
            playerId: this.playerId,
            timestamp: Date.now(),
            stateVersion: this.stateVersion
        };

        this._sendToServer(heartbeat);

        if (this.debug) {
            console.log('💓 Heartbeat sent');
        }
    }

    // ============================================================
    // بخش ۲: همگام‌سازی وضعیت
    // ============================================================

    /**
     * همگام‌سازی وضعیت محلی با سرور
     * @param {Object} newState - وضعیت جدید
     * @returns {Object} نتیجه
     */
    syncState(newState) {
        this.stats.totalSyncs++;

        // ذخیره وضعیت قبلی در تاریخچه
        this._saveStateToHistory();

        // افزایش نسخه
        this.stateVersion++;

        // ادغام وضعیت جدید
        const mergedState = this._mergeStates(this.localState, newState);

        // بررسی conflict
        if (this.serverState && this._hasConflict(mergedState, this.serverState)) {
            return this._resolveConflict(mergedState, this.serverState, newState);
        }

        // به‌روزرسانی وضعیت محلی
        this.localState = mergedState;
        this.serverState = { ...mergedState };

        this.stats.successfulSyncs++;

        this._emit('state-synced', {
            state: mergedState,
            version: this.stateVersion
        });

        if (this.debug) {
            console.log(`🔄 State synced (v${this.stateVersion})`);
        }

        return {
            success: true,
            state: mergedState,
            version: this.stateVersion
        };
    }

    /**
     * ادغام دو وضعیت
     * @param {Object} local - وضعیت محلی
     * @param {Object} remote - وضعیت دور
     * @returns {Object} وضعیت ادغام شده
     * @private
     */
    _mergeStates(local, remote) {
        return {
            players: remote.players || local.players,
            scores: remote.scores || local.scores,
            currentTrick: remote.currentTrick || local.currentTrick,
            trump: remote.trump || local.trump,
            leadSuit: remote.leadSuit || local.leadSuit,
            currentPlayerIndex: remote.currentPlayerIndex !== undefined ? 
                remote.currentPlayerIndex : local.currentPlayerIndex,
            trickNumber: remote.trickNumber !== undefined ? 
                remote.trickNumber : local.trickNumber,
            roundNumber: remote.roundNumber !== undefined ? 
                remote.roundNumber : local.roundNumber,
            status: remote.status || local.status,
            lastUpdated: Date.now()
        };
    }

    /**
     * بررسی وجود conflict
     * @param {Object} state1 - وضعیت اول
     * @param {Object} state2 - وضعیت دوم
     * @returns {boolean}
     * @private
     */
    _hasConflict(state1, state2) {
        if (!state1 || !state2) return false;

        // بررسی تفاوت در امتیازات
        if (state1.scores.team1 !== state2.scores.team1 ||
            state1.scores.team2 !== state2.scores.team2) {
            return true;
        }

        // بررسی تفاوت در کارت‌های بازی شده
        if (JSON.stringify(state1.currentTrick) !== JSON.stringify(state2.currentTrick)) {
            return true;
        }

        // بررسی تفاوت در نوبت
        if (state1.currentPlayerIndex !== state2.currentPlayerIndex) {
            return true;
        }

        return false;
    }

    /**
     * حل conflict
     * @param {Object} localState - وضعیت محلی
     * @param {Object} serverState - وضعیت سرور
     * @param {Object} newState - وضعیت جدید
     * @returns {Object} نتیجه
     * @private
     */
    _resolveConflict(localState, serverState, newState) {
        this.stats.conflictsResolved++;

        // استراتژی: سرور همیشه درست است (server-authoritative)
        const resolvedState = { ...serverState };

        // به‌روزرسانی وضعیت محلی
        this.localState = resolvedState;

        this._emit('conflict-resolved', {
            localState,
            serverState,
            resolvedState
        });

        if (this.debug) {
            console.log('⚔️ Conflict resolved (server authority)');
        }

        return {
            success: true,
            state: resolvedState,
            conflictResolved: true
        };
    }

    /**
     * ذخیره وضعیت در تاریخچه
     * @private
     */
    _saveStateToHistory() {
        this.stateHistory.push({
            state: { ...this.localState },
            version: this.stateVersion,
            timestamp: Date.now()
        });

        // محدود کردن تاریخچه
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }
    }

    // ============================================================
    // بخش ۳: همگام‌سازی کارت
    // ============================================================

    /**
     * ارسال کارت بازی شده به سرور
     * @param {Object} card - کارت
     * @returns {Object} نتیجه
     */
    syncCardPlay(card) {
        if (!this.gameId) {
            return {
                success: false,
                error: 'NO_GAME',
                message: 'بازی فعال نیست'
            };
        }

        const operation = {
            type: 'card_play',
            gameId: this.gameId,
            playerId: this.playerId,
            card,
            timestamp: Date.now(),
            stateVersion: this.stateVersion
        };

        // اضافه به صف عملیات
        this.pendingOperations.push(operation);

        // ارسال به سرور
        const result = this._sendToServer(operation);

        if (result.success) {
            // به‌روزرسانی وضعیت محلی
            this.localState.currentTrick.push({
                card,
                playerId: this.playerId,
                timestamp: operation.timestamp
            });

            this._emit('card-synced', {
                card,
                playerId: this.playerId
            });

            if (this.debug) {
                console.log(`🃏 Card synced: ${card.nameFa}`);
            }
        }

        return result;
    }

    /**
     * دریافت کارت بازی شده از سرور
     * @param {Object} data - داده
     * @returns {void}
     */
    handleCardPlayed(data) {
        const {
            card,
            playerId,
            timestamp
        } = data;

        // به‌روزرسانی وضعیت محلی
        this.localState.currentTrick.push({
            card,
            playerId,
            timestamp
        });

        this._emit('card-received', {
            card,
            playerId,
            timestamp
        });

        if (this.debug) {
            console.log(` Card received from player ${playerId}`);
        }
    }

    // ============================================================
    // بخش ۴: همگام‌سازی امتیاز
    // ============================================================

    /**
     * همگام‌سازی امتیاز
     * @param {Object} scores - امتیازات جدید
     * @returns {Object} نتیجه
     */
    syncScores(scores) {
        if (!this.gameId) {
            return {
                success: false,
                error: 'NO_GAME',
                message: 'بازی فعال نیست'
            };
        }

        const operation = {
            type: 'score_update',
            gameId: this.gameId,
            scores,
            timestamp: Date.now(),
            stateVersion: this.stateVersion
        };

        const result = this._sendToServer(operation);

        if (result.success) {
            this.localState.scores = scores;

            this._emit('scores-synced', {
                scores
            });

            if (this.debug) {
                console.log(`📊 Scores synced: ${scores.team1}-${scores.team2}`);
            }
        }

        return result;
    }

    /**
     * دریافت به‌روزرسانی امتیاز از سرور
     * @param {Object} data - داده
     * @returns {void}
     */
    handleScoreUpdate(data) {
        const { scores } = data;

        this.localState.scores = scores;

        this._emit('scores-received', {
            scores
        });
    }

    // ============================================================
    // بخش ۵: همگام‌سازی نوبت
    // ============================================================

    /**
     * همگام‌سازی تغییر نوبت
     * @param {number} currentPlayerIndex - ایندکس بازیکن فعلی
     * @returns {Object} نتیجه
     */
    syncTurnChange(currentPlayerIndex) {
        if (!this.gameId) {
            return {
                success: false,
                error: 'NO_GAME',
                message: 'بازی فعال نیست'
            };
        }

        const operation = {
            type: 'turn_change',
            gameId: this.gameId,
            currentPlayerIndex,
            timestamp: Date.now(),
            stateVersion: this.stateVersion
        };

        const result = this._sendToServer(operation);

        if (result.success) {
            this.localState.currentPlayerIndex = currentPlayerIndex;

            this._emit('turn-synced', {
                currentPlayerIndex
            });

            if (this.debug) {
                console.log(`🔄 Turn synced: Player ${currentPlayerIndex}`);
            }
        }

        return result;
    }

    /**
     * دریافت تغییر نوبت از سرور
     * @param {Object} data - داده
     * @returns {void}
     */
    handleTurnChange(data) {
        const { currentPlayerIndex } = data;

        this.localState.currentPlayerIndex = currentPlayerIndex;

        this._emit('turn-received', {
            currentPlayerIndex
        });
    }

    // ============================================================
    // بخش ۶: Reconnect
    // ============================================================

    /**
     * شروع reconnect
     * @returns {Object} نتیجه
     */
    startReconnect() {
        if (this.isReconnecting) {
            return {
                success: false,
                error: 'ALREADY_RECONNECTING',
                message: 'در حال reconnect هستید'
            };
        }

        this.isReconnecting = true;
        this.stats.reconnects++;

        this._emit('reconnect-started', {
            gameId: this.gameId
        });

        // درخواست وضعیت کامل از سرور
        const result = this._requestFullState();

        if (result.success) {
            this.isReconnecting = false;

            this._emit('reconnect-success', {
                state: this.localState
            });

            if (this.debug) {
                console.log('✅ Reconnect successful');
            }
        } else {
            this.isReconnecting = false;

            this._emit('reconnect-failed', {
                error: result.error
            });

            if (this.debug) {
                console.log('❌ Reconnect failed');
            }
        }

        return result;
    }

    /**
     * درخواست وضعیت کامل از سرور
     * @returns {Object} نتیجه
     * @private
     */
    _requestFullState() {
        const request = {
            type: 'request_full_state',
            gameId: this.gameId,
            playerId: this.playerId,
            timestamp: Date.now()
        };

        return this._sendToServer(request);
    }

    /**
     * دریافت وضعیت کامل از سرور
     * @param {Object} data - داده
     * @returns {void}
     */
    handleFullState(data) {
        const { state } = data;

        // به‌روزرسانی وضعیت محلی
        this.localState = state;
        this.serverState = { ...state };

        // پاک کردن عملیات در انتظار
        this.pendingOperations = [];

        this._emit('full-state-received', {
            state
        });

        if (this.debug) {
            console.log('📥 Full state received');
        }
    }

    // ============================================================
    // بخش ۷: ارسال به سرور
    // ============================================================

    /**
     * ارسال داده به سرور
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     * @private
     */
    _sendToServer(data) {
        if (!wsManager || !wsManager.isConnected) {
            return {
                success: false,
                error: 'NOT_CONNECTED',
                message: 'متصل به سرور نیستید'
            };
        }

        const startTime = Date.now();

        try {
            // فشرده‌سازی داده
            const compressed = this._compressData(data);

            // ارسال
            const result = wsManager.send('game_sync', compressed);

            const latency = Date.now() - startTime;
            this._updateLatency(latency);

            // به‌روزرسانی آمار
            this.stats.totalDataSent += JSON.stringify(data).length;

            if (result.success) {
                return {
                    success: true,
                    latency
                };
            } else {
                return {
                    success: false,
                    error: 'SEND_FAILED',
                    message: 'ارسال ناموفق بود'
                };
            }

        } catch (error) {
            console.error('❌ Send to server failed:', error);
            this.stats.failedSyncs++;

            return {
                success: false,
                error: 'SEND_ERROR',
                message: error.message
            };
        }
    }

    /**
     * فشرده‌سازی داده
     * @param {Object} data - داده
     * @returns {Object} داده فشرده
     * @private
     */
    _compressData(data) {
        // حذف فیلدهای غیرضروری
        const compressed = { ...data };

        // فشرده‌سازی کارت‌ها
        if (compressed.card) {
            compressed.card = {
                id: compressed.card.id,
                s: compressed.card.suit[0], // فقط حرف اول
                r: compressed.card.rank
            };
        }

        return compressed;
    }

    /**
     * به‌روزرسانی latency
     * @param {number} latency - میلی‌ثانیه
     * @private
     */
    _updateLatency(latency) {
        this.stats.averageLatency = 
            (this.stats.averageLatency * 0.7) + (latency * 0.3);
    }

    // ============================================================
    // بخش ۸: دریافت از سرور
    // ============================================================

    /**
     * مدیریت پیام دریافتی از سرور
     * @param {Object} message - پیام
     * @returns {void}
     */
    handleMessage(message) {
        const { type, data } = message;

        switch (type) {
            case 'card_played':
                this.handleCardPlayed(data);
                break;

            case 'score_update':
                this.handleScoreUpdate(data);
                break;

            case 'turn_change':
                this.handleTurnChange(data);
                break;

            case 'full_state':
                this.handleFullState(data);
                break;

            case 'game_ended':
                this.handleGameEnded(data);
                break;

            case 'player_disconnected':
                this.handlePlayerDisconnected(data);
                break;

            case 'player_reconnected':
                this.handlePlayerReconnected(data);
                break;

            default:
                if (this.debug) {
                    console.log('📥 Unknown message type:', type);
                }
        }
    }

    /**
     * مدیریت پایان بازی
     * @param {Object} data - داده
     * @returns {void}
     */
    handleGameEnded(data) {
        this.localState.status = 'finished';

        this._emit('game-ended', {
            result: data.result
        });

        // توقف heartbeat
        this._stopHeartbeat();

        if (this.debug) {
            console.log('🏁 Game ended');
        }
    }

    /**
     * مدیریت قطع اتصال بازیکن
     * @param {Object} data - داده
     * @returns {void}
     */
    handlePlayerDisconnected(data) {
        const { playerId } = data;

        this._emit('player-disconnected', {
            playerId
        });

        if (this.debug) {
            console.log(`🔌 Player disconnected: ${playerId}`);
        }
    }

    /**
     * مدیریت reconnect بازیکن
     * @param {Object} data - داده
     * @returns {void}
     */
    handlePlayerReconnected(data) {
        const { playerId } = data;

        this._emit('player-reconnected', {
            playerId
        });

        if (this.debug) {
            console.log(`🔌 Player reconnected: ${playerId}`);
        }
    }

    // ============================================================
    // بخش ۹: Rollback
    // ============================================================

    /**
     * بازگشت به وضعیت قبلی
     * @param {number} versions - تعداد نسخه‌های بازگشت
     * @returns {Object} نتیجه
     */
    rollback(versions = 1) {
        if (this.stateHistory.length < versions) {
            return {
                success: false,
                error: 'NOT_ENOUGH_HISTORY',
                message: 'تاریخچه کافی نیست'
            };
        }

        const targetIndex = this.stateHistory.length - versions;
        const targetState = this.stateHistory[targetIndex];

        // بازگشت به وضعیت هدف
        this.localState = { ...targetState.state };
        this.stateVersion = targetState.version;

        // حذف تاریخچه بعد از نقطه بازگشت
        this.stateHistory = this.stateHistory.slice(0, targetIndex);

        this._emit('state-rolled-back', {
            state: this.localState,
            version: this.stateVersion,
            versions
        });

        if (this.debug) {
            console.log(`⏪ Rolled back ${versions} version(s)`);
        }

        return {
            success: true,
            state: this.localState,
            version: this.stateVersion
        };
    }

    // ============================================================
    // بخش ۱۰: دریافت اطلاعات
    // ============================================================

    /**
     * دریافت وضعیت فعلی
     * @returns {Object}
     */
    getState() {
        return {
            ...this.localState,
            version: this.stateVersion,
            isReconnecting: this.isReconnecting
        };
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            stateVersion: this.stateVersion,
            historySize: this.stateHistory.length,
            pendingOperations: this.pendingOperations.length
        };
    }

    /**
     * دریافت تاریخچه وضعیت
     * @param {number} limit - تعداد
     * @returns {Array}
     */
    getStateHistory(limit = 10) {
        return this.stateHistory.slice(-limit).reverse();
    }

    // ============================================================
    // بخش ۱۱: توقف و پاکسازی
    // ============================================================

    /**
     * توقف همگام‌سازی
     * @returns {void}
     */
    stopSync() {
        this._stopHeartbeat();

        this.gameId = null;
        this.roomId = null;
        this.localState = {
            players: [],
            scores: { team1: 0, team2: 0 },
            currentTrick: [],
            trump: null,
            leadSuit: null,
            currentPlayerIndex: 0,
            trickNumber: 0,
            roundNumber: 1,
            status: 'waiting'
        };
        this.serverState = null;
        this.pendingOperations = [];
        this.stateHistory = [];
        this.stateVersion = 0;
        this.isReconnecting = false;

        this._emit('sync-stopped');

        if (this.debug) {
            console.log('🛑 Sync stopped');
        }
    }

    /**
     * ریست کامل
     */
    reset() {
        this.stopSync();

        this.stats = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            conflictsResolved: 0,
            reconnects: 0,
            averageLatency: 0,
            totalDataSent: 0,
            totalDataReceived: 0
        };

        if (this.debug) {
            console.log('🔄 GameSyncManager reset');
        }
    }

    // ============================================================
    // بخش ۱۲: Event System
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
                    console.error(`❌ Sync event listener error:`, error);
                }
            });
        }

        eventBus.emit(`sync:${event}`, data);
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
        const state = this.getState();
        const stats = this.getStats();

        console.log('🔄 GameSyncManager Status:');
        console.log('  Game ID:', state.gameId || 'None');
        console.log('  State Version:', state.version);
        console.log('  Status:', state.status);
        console.log('  Scores:', `${state.scores.team1}-${state.scores.team2}`);
        console.log('  Current Player:', state.currentPlayerIndex);
        console.log('  Is Reconnecting:', state.isReconnecting);
        console.log('  Total Syncs:', stats.totalSyncs);
        console.log('  Successful:', stats.successfulSyncs);
        console.log('  Failed:', stats.failedSyncs);
        console.log('  Conflicts:', stats.conflictsResolved);
        console.log('  Reconnects:', stats.reconnects);
        console.log('  Avg Latency:', stats.averageLatency.toFixed(2) + 'ms');
        console.log('  History Size:', stats.historySize);
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const gameSyncManager = new GameSyncManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameSyncManager, gameSyncManager };
} else {
    window.GameSyncManager = GameSyncManager;
    window.gameSyncManager = gameSyncManager;
}

console.log('✅ GameSyncManager loaded');
