/**
 * ============================================================
 * HOKM MASTER - Spectator Manager
 * سیستم مدیریت تماشاگر در بازی‌های چند نفره
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم تماشاگر است. شامل پیوستن
 * به عنوان تماشاگر، دریافت وضعیت بازی به صورت real-time،
 * چت تماشاگر، محدودیت‌های تماشاگر، آمار تماشا، و مدیریت
 * لیست تماشاگران.
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
 * - gameSyncManager (از فایل sync.js)
 * 
 * ============================================================
 */

class SpectatorManager {

    constructor() {
        /**
         * شناسه تماشاگر فعلی
         * @type {string|null}
         */
        this.spectatorId = null;

        /**
         * شناسه بازی در حال تماشا
         * @type {string|null}
         */
        this.watchingGameId = null;

        /**
         * شناسه اتاق در حال تماشا
         * @type {string|null}
         */
        this.watchingRoomId = null;

        /**
         * وضعیت بازی در حال تماشا
         * @type {Object|null}
         */
        this.gameState = null;

        /**
         * لیست تماشاگران فعلی
         * @type {Array<Object>}
         */
        this.spectators = [];

        /**
         * آیا در حال تماشا هستیم
         * @type {boolean}
         */
        this.isSpectating = false;

        /**
         * زمان شروع تماشا
         * @type {number|null}
         */
        this.spectatingStartTime = null;

        /**
         * مدت زمان تماشا (ثانیه)
         * @type {number}
         */
        this.spectatingDuration = 0;

        /**
         * تایمر به‌روزرسانی مدت زمان
         * @type {number|null}
         */
        this.durationTimer = null;

        /**
         * پیام‌های چت تماشاگران
         * @type {Array<Object>}
         */
        this.chatMessages = [];

        /**
         * حداکثر پیام‌های چت
         * @type {number}
         */
        this.maxChatMessages = 100;

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
         * آمار تماشا
         * @type {Object}
         */
        this.stats = {
            totalSpectatingSessions: 0,
            totalSpectatingTime: 0,
            gamesWatched: 0,
            chatMessagesSent: 0,
            chatMessagesReceived: 0
        };

        /**
         * محدودیت‌های تماشاگر
         * @type {Object}
         */
        this.restrictions = {
            canPlay: false,
            canSeeHiddenCards: false,
            canInterfere: false,
            maxChatLength: 200,
            chatCooldown: 3000
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری شناسه تماشاگر
        const user = storage.getUserProfile();
        if (user) {
            this.spectatorId = user.id;
        }

        if (this.debug) {
            console.log('👁️ SpectatorManager initialized');
        }
    }

    // ============================================================
    // بخش ۱: پیوستن به عنوان تماشاگر
    // ============================================================

    /**
     * پیوستن به بازی به عنوان تماشاگر
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    joinAsSpectator(options = {}) {
        const {
            gameId,
            roomId,
            roomCode
        } = options;

        // بررسی ورود
        if (!this.spectatorId) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای تماشا باید وارد شوید'
            };
        }

        // بررسی آیا قبلاً در حال تماشا هستیم
        if (this.isSpectating) {
            return {
                success: false,
                error: 'ALREADY_SPECTATING',
                message: 'شما قبلاً در حال تماشای یک بازی هستید'
            };
        }

        // پیدا کردن اتاق
        let room = null;

        if (roomId) {
            room = roomManager?.getRoomInfo(roomId);
        } else if (roomCode) {
            const rooms = roomManager?.getPublicRooms() || [];
            room = rooms.find(r => r.code === roomCode);
        }

        if (!room) {
            return {
                success: false,
                error: 'ROOM_NOT_FOUND',
                message: 'اتاق یافت نشد'
            };
        }

        // بررسی اجازه تماشا
        if (!room.allowSpectators) {
            return {
                success: false,
                error: 'SPECTATORS_NOT_ALLOWED',
                message: 'این اتاق اجازه تماشاگر نمی‌دهد'
            };
        }

        // بررسی وضعیت بازی
        if (room.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        // بررسی ظرفیت تماشاگران
        const maxSpectators = room.maxSpectators || 10;
        if (room.spectators?.length >= maxSpectators) {
            return {
                success: false,
                error: 'SPECTATOR_LIMIT_REACHED',
                message: 'ظرفیت تماشاگران پر است'
            };
        }

        // بررسی تکراری نبودن
        if (room.spectators?.some(s => s.id === this.spectatorId)) {
            return {
                success: false,
                error: 'ALREADY_IN_SPECTATORS',
                message: 'شما قبلاً در لیست تماشاگران هستید'
            };
        }

        // ایجاد رکورد تماشاگر
        const spectatorRecord = {
            id: this.spectatorId,
            name: this._getSpectatorName(),
            joinedAt: Date.now(),
            level: this._getSpectatorLevel(),
            avatar: this._getSpectatorAvatar()
        };

        // اضافه کردن به لیست تماشاگران اتاق
        if (!room.spectators) {
            room.spectators = [];
        }
        room.spectators.push(spectatorRecord);

        // به‌روزرسانی وضعیت محلی
        this.isSpectating = true;
        this.watchingGameId = room.gameId || gameId;
        this.watchingRoomId = room.id;
        this.spectatingStartTime = Date.now();
        this.spectators = room.spectators;
        this.gameState = room.gameState || null;

        this.stats.totalSpectatingSessions++;

        // شروع تایمر مدت زمان
        this._startDurationTimer();

        // درخواست وضعیت کامل بازی
        this._requestGameState();

        this._emit('spectator-joined', {
            room,
            spectator: spectatorRecord
        });

        if (this.debug) {
            console.log(`👁️ Joined as spectator: ${room.code}`);
        }

        return {
            success: true,
            room,
            spectator: spectatorRecord
        };
    }

    /**
     * درخواست وضعیت بازی از سرور
     * @private
     */
    _requestGameState() {
        if (!this.watchingGameId || !wsManager) return;

        const request = {
            type: 'spectator_request_state',
            gameId: this.watchingGameId,
            spectatorId: this.spectatorId,
            timestamp: Date.now()
        };

        wsManager.send('spectator', request);

        if (this.debug) {
            console.log(' Requested game state');
        }
    }

    /**
     * دریافت وضعیت بازی از سرور
     * @param {Object} data - داده
     * @returns {void}
     */
    handleGameStateUpdate(data) {
        const { gameState, spectators } = data;

        if (gameState) {
            this.gameState = gameState;
        }

        if (spectators) {
            this.spectators = spectators;
        }

        this._emit('game-state-updated', {
            gameState: this.gameState
        });

        if (this.debug) {
            console.log('📥 Game state updated');
        }
    }

    // ============================================================
    // بخش ۲: ترک تماشا
    // ============================================================

    /**
     * ترک تماشای بازی
     * @returns {Object} نتیجه
     */
    leaveSpectating() {
        if (!this.isSpectating) {
            return {
                success: false,
                error: 'NOT_SPECTATING',
                message: 'شما در حال تماشای بازی نیستید'
            };
        }

        const roomId = this.watchingRoomId;
        const duration = this.spectatingDuration;

        // حذف از لیست تماشاگران اتاق
        if (roomManager) {
            const room = roomManager.getRoomInfo(roomId);
            if (room && room.spectators) {
                room.spectators = room.spectators.filter(
                    s => s.id !== this.spectatorId
                );
            }
        }

        // ارسال ترک به سرور
        if (wsManager && this.watchingGameId) {
            const leaveMessage = {
                type: 'spectator_leave',
                gameId: this.watchingGameId,
                spectatorId: this.spectatorId,
                timestamp: Date.now()
            };

            wsManager.send('spectator', leaveMessage);
        }

        // به‌روزرسانی آمار
        this.stats.totalSpectatingTime += duration;
        this.stats.gamesWatched++;

        // ریست وضعیت
        this.isSpectating = false;
        this.watchingGameId = null;
        this.watchingRoomId = null;
        this.gameState = null;
        this.spectators = [];
        this.chatMessages = [];

        // توقف تایمر
        this._stopDurationTimer();

        this._emit('spectator-left', {
            roomId,
            duration
        });

        if (this.debug) {
            console.log('👁️ Left spectating');
        }

        return {
            success: true,
            duration
        };
    }

    // ============================================================
    // بخش ۳: دریافت اطلاعات بازی
    // ============================================================

    /**
     * دریافت وضعیت فعلی تماشا
     * @returns {Object}
     */
    getSpectatingStatus() {
        return {
            isSpectating: this.isSpectating,
            watchingGameId: this.watchingGameId,
            watchingRoomId: this.watchingRoomId,
            gameState: this.gameState,
            spectators: this.spectators,
            duration: this.spectatingDuration,
            startTime: this.spectatingStartTime
        };
    }

    /**
     * دریافت لیست تماشاگران
     * @returns {Array<Object>}
     */
    getSpectators() {
        return [...this.spectators];
    }

    /**
     * دریافت تعداد تماشاگران
     * @returns {number}
     */
    getSpectatorCount() {
        return this.spectators.length;
    }

    /**
     * دریافت اطلاعات بازی در حال تماشا
     * @returns {Object|null}
     */
    getGameInfo() {
        if (!this.gameState) return null;

        return {
            gameId: this.watchingGameId,
            roomId: this.watchingRoomId,
            players: this.gameState.players || [],
            scores: this.gameState.scores || { team1: 0, team2: 0 },
            trump: this.gameState.trump,
            currentPlayer: this.gameState.currentPlayerIndex,
            status: this.gameState.status
        };
    }

    // ============================================================
    // بخش : چت تماشاگران
    // ============================================================

    /**
     * ارسال پیام چت
     * @param {string} message - پیام
     * @returns {Object} نتیجه
     */
    sendChatMessage(message) {
        if (!this.isSpectating) {
            return {
                success: false,
                error: 'NOT_SPECTATING',
                message: 'شما در حال تماشای بازی نیستید'
            };
        }

        // بررسی محدودیت طول
        if (message.length > this.restrictions.maxChatLength) {
            return {
                success: false,
                error: 'MESSAGE_TOO_LONG',
                message: `پیام نباید بیشتر از ${this.restrictions.maxChatLength} کاراکتر باشد`
            };
        }

        // بررسی خالی نبودن
        if (!message.trim()) {
            return {
                success: false,
                error: 'EMPTY_MESSAGE',
                message: 'پیام نمی‌تواند خالی باشد'
            };
        }

        // بررسی cooldown
        const lastMessage = this.chatMessages[this.chatMessages.length - 1];
        if (lastMessage && lastMessage.senderId === this.spectatorId) {
            const timeDiff = Date.now() - lastMessage.timestamp;
            if (timeDiff < this.restrictions.chatCooldown) {
                const remaining = Math.ceil((this.restrictions.chatCooldown - timeDiff) / 1000);
                return {
                    success: false,
                    error: 'CHAT_COOLDOWN',
                    message: `لطفاً ${remaining} ثانیه صبر کنید`,
                    cooldown: remaining
                };
            }
        }

        // ایجاد پیام
        const chatMessage = {
            id: Utils.generateUUID(),
            senderId: this.spectatorId,
            senderName: this._getSpectatorName(),
            senderAvatar: this._getSpectatorAvatar(),
            message: message.trim(),
            timestamp: Date.now(),
            type: 'spectator_chat'
        };

        // اضافه به لیست محلی
        this.chatMessages.push(chatMessage);
        this.stats.chatMessagesSent++;

        // محدود کردن تعداد پیام‌ها
        if (this.chatMessages.length > this.maxChatMessages) {
            this.chatMessages.shift();
        }

        // ارسال به سرور
        if (wsManager && this.watchingGameId) {
            const sendPayload = {
                type: 'spectator_chat',
                gameId: this.watchingGameId,
                message: chatMessage,
                timestamp: Date.now()
            };

            wsManager.send('spectator', sendPayload);
        }

        this._emit('chat-message-sent', {
            message: chatMessage
        });

        if (this.debug) {
            console.log('💬 Chat message sent:', message);
        }

        return {
            success: true,
            message: chatMessage
        };
    }

    /**
     * دریافت پیام چت از سرور
     * @param {Object} data - داده
     * @returns {void}
     */
    handleChatMessage(data) {
        const { message } = data;

        if (!message) return;

        // اضافه به لیست محلی
        this.chatMessages.push(message);
        this.stats.chatMessagesReceived++;

        // محدود کردن تعداد پیام‌ها
        if (this.chatMessages.length > this.maxChatMessages) {
            this.chatMessages.shift();
        }

        this._emit('chat-message-received', {
            message
        });

        if (this.debug) {
            console.log('💬 Chat message received:', message.message);
        }
    }

    /**
     * دریافت تاریخچه چت
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getChatHistory(limit = 50) {
        return this.chatMessages.slice(-limit).reverse();
    }

    /**
     * پاک کردن چت محلی
     * @returns {void}
     */
    clearChat() {
        this.chatMessages = [];

        this._emit('chat-cleared');

        if (this.debug) {
            console.log('🗑️ Chat cleared');
        }
    }

    // ============================================================
    // بخش ۵: محدودیت‌های تماشاگر
    // ============================================================

    /**
     * بررسی آیا تماشاگر می‌تواند کاری انجام دهد
     * @param {string} action - اقدام
     * @returns {Object} نتیجه
     */
    canPerformAction(action) {
        const restrictions = {
            play_card: {
                allowed: false,
                reason: 'تماشاگران نمی‌توانند کارت بازی کنند'
            },
            select_trump: {
                allowed: false,
                reason: 'تماشاگران نمی‌توانند حکم انتخاب کنند'
            },
            send_chat: {
                allowed: true,
                reason: null
            },
            view_cards: {
                allowed: true,
                reason: null,
                limitation: 'فقط کارت‌های بازی شده قابل مشاهده است'
            },
            view_hidden_cards: {
                allowed: this.restrictions.canSeeHiddenCards,
                reason: this.restrictions.canSeeHiddenCards ? 
                    null : 'تماشاگران نمی‌توانند کارت‌های مخفی را ببینند'
            },
            interfere_game: {
                allowed: this.restrictions.canInterfere,
                reason: this.restrictions.canInterfere ? 
                    null : 'تماشاگران نمی‌توانند در بازی دخالت کنند'
            }
        };

        return restrictions[action] || {
            allowed: false,
            reason: 'اقدام نامعتبر است'
        };
    }

    /**
     * دریافت محدودیت‌های تماشاگر
     * @returns {Object}
     */
    getRestrictions() {
        return { ...this.restrictions };
    }

    /**
     * به‌روزرسانی محدودیت‌ها (فقط admin)
     * @param {Object} newRestrictions - محدودیت‌های جدید
     * @returns {Object} نتیجه
     */
    updateRestrictions(newRestrictions) {
        // بررسی دسترسی admin
        if (!this._isAdmin()) {
            return {
                success: false,
                error: 'NOT_ADMIN',
                message: 'فقط ادمین می‌تواند محدودیت‌ها را تغییر دهد'
            };
        }

        this.restrictions = {
            ...this.restrictions,
            ...newRestrictions
        };

        this._emit('restrictions-updated', {
            restrictions: this.restrictions
        });

        return {
            success: true,
            restrictions: this.restrictions
        };
    }

    /**
     * بررسی آیا کاربر admin است
     * @returns {boolean}
     * @private
     */
    _isAdmin() {
        const user = storage.getUserProfile();
        return user?.role === 'admin' || user?.role === 'moderator';
    }

    // ============================================================
    // بخش ۶: آمار تماشا
    // ============================================================

    /**
     * دریافت آمار تماشا
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            currentSession: {
                isSpectating: this.isSpectating,
                duration: this.spectatingDuration,
                messagesSent: this.chatMessages.filter(
                    m => m.senderId === this.spectatorId
                ).length
            }
        };
    }

    /**
     * دریافت مدت زمان تماشا
     * @returns {number} ثانیه
     */
    getSpectatingDuration() {
        return this.spectatingDuration;
    }

    /**
     * فرمت مدت زمان تماشا
     * @returns {string}
     */
    getFormattedDuration() {
        const minutes = Math.floor(this.spectatingDuration / 60);
        const seconds = this.spectatingDuration % 60;

        if (minutes > 0) {
            return `${Utils.toPersianNumber(minutes)} دقیقه و ${Utils.toPersianNumber(seconds)} ثانیه`;
        }

        return `${Utils.toPersianNumber(seconds)} ثانیه`;
    }

    // ============================================================
    // بخش ۷: توابع کمکی
    // ============================================================

    /**
     * دریافت نام تماشاگر
     * @returns {string}
     * @private
     */
    _getSpectatorName() {
        const user = storage.getUserProfile();
        return user?.username || 'Spectator';
    }

    /**
     * دریافت سطح تماشاگر
     * @returns {number}
     * @private
     */
    _getSpectatorLevel() {
        const user = storage.getUserProfile();
        return user?.profile?.level || 1;
    }

    /**
     * دریافت آواتار تماشاگر
     * @returns {number}
     * @private
     */
    _getSpectatorAvatar() {
        const user = storage.getUserProfile();
        return user?.profile?.avatar || 1;
    }

    /**
     * شروع تایمر مدت زمان
     * @private
     */
    _startDurationTimer() {
        this._stopDurationTimer();

        this.durationTimer = setInterval(() => {
            if (this.spectatingStartTime) {
                this.spectatingDuration = Math.floor(
                    (Date.now() - this.spectatingStartTime) / 1000
                );

                this._emit('duration-updated', {
                    duration: this.spectatingDuration
                });
            }
        }, 1000);
    }

    /**
     * توقف تایمر مدت زمان
     * @private
     */
    _stopDurationTimer() {
        if (this.durationTimer) {
            clearInterval(this.durationTimer);
            this.durationTimer = null;
        }
    }

    /**
     * ریست کامل
     */
    reset() {
        this.leaveSpectating();

        this.stats = {
            totalSpectatingSessions: 0,
            totalSpectatingTime: 0,
            gamesWatched: 0,
            chatMessagesSent: 0,
            chatMessagesReceived: 0
        };

        if (this.debug) {
            console.log('🔄 SpectatorManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const status = this.getSpectatingStatus();
        const stats = this.getStats();

        console.log('👁️ SpectatorManager Status:');
        console.log('  Is Spectating:', status.isSpectating);
        console.log('  Watching Game:', status.watchingGameId || 'None');
        console.log('  Duration:', this.getFormattedDuration());
        console.log('  Spectators:', status.spectators.length);
        console.log('  Chat Messages:', this.chatMessages.length);
        console.log('  Total Sessions:', stats.totalSpectatingSessions);
        console.log('  Total Time:', stats.totalSpectatingTime + 's');
        console.log('  Games Watched:', stats.gamesWatched);
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
                    console.error(`❌ Spectator event listener error:`, error);
                }
            });
        }

        eventBus.emit(`spectator:${event}`, data);
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
const spectatorManager = new SpectatorManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpectatorManager, spectatorManager };
} else {
    window.SpectatorManager = SpectatorManager;
    window.spectatorManager = spectatorManager;
}

console.log('✅ SpectatorManager loaded');
