/**
 * ============================================================
 * HOKM MASTER - WebSocket Manager
 * مدیریت ارتباط WebSocket با سرور
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل ارتباط WebSocket با سرور بازی است.
 * شامل اتصال، قطع اتصال، ارسال و دریافت پیام‌ها، Reconnection،
 * Ping/Pong، Queue برای پیام‌های در انتظار، و مدیریت وضعیت اتصال.
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

class WebSocketManager {

    constructor() {
        /**
         * نمونه WebSocket
         * @type {WebSocket|null}
         */
        this.socket = null;

        /**
         * آدرس سرور WebSocket
         * @type {string}
         */
        this.url = CONFIG.API.WS_URL;

        /**
         * وضعیت اتصال
         * @type {string} 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
         */
        this.status = 'disconnected';

        /**
         * آیا اتصال برقرار است
         * @type {boolean}
         */
        this.isConnected = false;

        /**
         * Token احراز هویت
         * @type {string|null}
         */
        this.authToken = null;

        /**
         * شناسه کاربر
         * @type {string|null}
         */
        this.userId = null;

        /**
         * شناسه Session
         * @type {string|null}
         */
        this.sessionId = null;

        /**
         * تعداد تلاش‌های Reconnection
         * @type {number}
         */
        this.reconnectAttempts = 0;

        /**
         * حداکثر تلاش‌های Reconnection
         * @type {number}
         */
        this.maxReconnectAttempts = CONFIG.API.MAX_RECONNECT_ATTEMPTS;

        /**
         * تاخیر فعلی Reconnection
         * @type {number}
         */
        this.reconnectDelay = CONFIG.API.RECONNECT_DELAY;

        /**
         * تایمر Reconnection
         * @type {number|null}
         */
        this.reconnectTimer = null;

        /**
         * تایمر Ping
         * @type {number|null}
         */
        this.pingTimer = null;

        /**
         * تایمر Pong Timeout
         * @type {number|null}
         */
        this.pongTimer = null;

        /**
         * آیا Ping ارسال شده و Pong دریافت نشده
         * @type {boolean}
         */
        this.pingPending = false;

        /**
         * آخرین زمان فعالیت
         * @type {number}
         */
        this.lastActivity = Date.now();

        /**
         * صف پیام‌های در انتظار ارسال
         * @type {Array<Object>}
         */
        this.messageQueue = [];

        /**
         * حداکثر اندازه صف
         * @type {number}
         */
        this.maxQueueSize = 100;

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
         * آمار اتصال
         * @type {Object}
         */
        this.stats = {
            totalMessagesSent: 0,
            totalMessagesReceived: 0,
            totalReconnections: 0,
            totalErrors: 0,
            lastPing: null,
            lastPong: null,
            averageLatency: 0,
            connectionUptime: 0,
            connectionStartedAt: null
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
            console.log('🔌 WebSocketManager initialized');
            console.log('  URL:', this.url);
        }

        // بررسی تغییر وضعیت آنلاین/آفلاین
        window.addEventListener('online', () => {
            this._handleOnline();
        });

        window.addEventListener('offline', () => {
            this._handleOffline();
        });

        // بررسی visibility برای Pause/Resume
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this._handleVisibilityChange();
            }
        });
    }

    // ============================================================
    // بخش ۱: اتصال و قطع اتصال
    // ============================================================

    /**
     * اتصال به سرور
     * @param {Object} options - گزینه‌ها
     * @param {string} options.token - Token احراز هویت
     * @param {string} options.userId - شناسه کاربر
     * @param {string} options.sessionId - شناسه Session
     * @returns {Promise<Object>} نتیجه
     */
    async connect(options = {}) {
        const {
            token = null,
            userId = null,
            sessionId = null
        } = options;

        if (this.isConnected) {
            return {
                success: false,
                error: 'ALREADY_CONNECTED',
                message: 'قبلاً متصل هستید'
            };
        }

        if (this.status === 'connecting') {
            return {
                success: false,
                error: 'ALREADY_CONNECTING',
                message: 'در حال اتصال هستید'
            };
        }

        if (token) {
            this.authToken = token;
        }

        if (userId) {
            this.userId = userId;
        }

        if (sessionId) {
            this.sessionId = sessionId;
        }

        this.status = 'connecting';
        this._emit('connecting');

        try {
            // ساخت WebSocket
            this.socket = new WebSocket(this.url);

            // تنظیم event handlers
            this.socket.onopen = () => this._handleOpen();
            this.socket.onmessage = (event) => this._handleMessage(event);
            this.socket.onclose = (event) => this._handleClose(event);
            this.socket.onerror = (error) => this._handleError(error);

            if (this.debug) {
                console.log('🔌 Connecting to:', this.url);
            }

            return {
                success: true,
                message: 'در حال اتصال...'
            };

        } catch (error) {
            console.error(' WebSocket connection failed:', error);
            this.status = 'disconnected';
            this.stats.totalErrors++;

            this._emit('error', { error: error.message });

            return {
                success: false,
                error: 'CONNECTION_FAILED',
                message: 'خطا در اتصال به سرور'
            };
        }
    }

    /**
     * قطع اتصال
     * @param {boolean} intentional - آیا عمدی است
     * @returns {Object} نتیجه
     */
    disconnect(intentional = true) {
        if (!this.socket) {
            return {
                success: false,
                error: 'NO_SOCKET',
                message: 'WebSocket وجود ندارد'
            };
        }

        this._stopPingTimer();
        this._stopPongTimer();
        this._stopReconnectTimer();

        if (intentional) {
            this.socket.close(1000, 'Intentional disconnect');
        } else {
            this.socket.close();
        }

        this.socket = null;
        this.isConnected = false;
        this.status = 'disconnected';

        this._emit('disconnected', { intentional });

        if (this.debug) {
            console.log('🔌 Disconnected');
        }

        return {
            success: true,
            message: 'اتصال قطع شد'
        };
    }

    /**
     * مدیریت باز شدن اتصال
     * @private
     */
    _handleOpen() {
        this.isConnected = true;
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.reconnectDelay = CONFIG.API.RECONNECT_DELAY;

        this.stats.connectionStartedAt = Date.now();
        this.stats.totalReconnections++;

        this._emit('connected');

        if (this.debug) {
            console.log('✅ WebSocket connected');
        }

        // ارسال Authentication
        if (this.authToken) {
            this._sendAuth();
        }

        // شروع Ping/Pong
        this._startPingTimer();

        // ارسال پیام‌های در صف
        this._flushMessageQueue();
    }

    /**
     * مدیریت دریافت پیام
     * @param {MessageEvent} event - رویداد
     * @private
     */
    _handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.stats.totalMessagesReceived++;
            this.lastActivity = Date.now();

            // بررسی Pong
            if (data.type === 'pong') {
                this._handlePong(data);
                return;
            }

            // بررسی پیام‌های سیستمی
            if (data.type === 'system') {
                this._handleSystemMessage(data);
                return;
            }

            // انتشار رویداد بر اساس type
            if (data.type) {
                this._emit(data.type, data.payload || data);
            }

            if (this.debug) {
                console.log('📥 Received:', data.type);
            }

        } catch (error) {
            console.error('❌ Failed to parse message:', error);
            this.stats.totalErrors++;
        }
    }

    /**
     * مدیریت بسته شدن اتصال
     * @param {CloseEvent} event - رویداد
     * @private
     */
    _handleClose(event) {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.status = 'disconnected';

        this._stopPingTimer();
        this._stopPongTimer();

        this._emit('disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });

        if (this.debug) {
            console.log('🔌 WebSocket closed:', event.code, event.reason);
        }

        // تلاش برای Reconnection اگر عمدی نبوده
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this._scheduleReconnect();
        }
    }

    /**
     * مدیریت خطا
     * @param {Event} error - خطا
     * @private
     */
    _handleError(error) {
        console.error('❌ WebSocket error:', error);
        this.stats.totalErrors++;

        this._emit('error', { error });
    }

    // ============================================================
    // بخش ۲: ارسال پیام
    // ============================================================

    /**
     * ارسال پیام به سرور
     * @param {string} type - نوع پیام
     * @param {*} payload - داده
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    send(type, payload = {}, options = {}) {
        const {
            priority = 'normal',
            retry = true,
            timeout = CONFIG.API.TIMEOUT
        } = options;

        const message = {
            type: type,
            payload: payload,
            timestamp: Date.now(),
            id: Utils.generateUUID()
        };

        // اگر متصل نیستیم، در صف قرار بده
        if (!this.isConnected) {
            if (this.messageQueue.length >= this.maxQueueSize) {
                this.messageQueue.shift(); // حذف قدیمی‌ترین
            }

            this.messageQueue.push(message);

            if (this.debug) {
                console.log('📨 Message queued:', type);
            }

            return {
                success: false,
                error: 'NOT_CONNECTED',
                message: 'متصل نیستید. پیام در صف قرار گرفت',
                queued: true
            };
        }

        try {
            const data = JSON.stringify(message);
            this.socket.send(data);

            this.stats.totalMessagesSent++;
            this.lastActivity = Date.now();

            if (this.debug) {
                console.log('📤 Sent:', type);
            }

            return {
                success: true,
                messageId: message.id
            };

        } catch (error) {
            console.error('❌ Failed to send message:', error);
            this.stats.totalErrors++;

            // در صف قرار بده
            if (retry && this.messageQueue.length < this.maxQueueSize) {
                this.messageQueue.push(message);
            }

            return {
                success: false,
                error: 'SEND_FAILED',
                message: 'خطا در ارسال پیام'
            };
        }
    }

    /**
     * ارسال پیام احراز هویت
     * @private
     */
    _sendAuth() {
        const authMessage = {
            type: 'auth',
            payload: {
                token: this.authToken,
                userId: this.userId,
                sessionId: this.sessionId,
                clientVersion: CONFIG.APP.VERSION,
                timestamp: Date.now()
            }
        };

        try {
            this.socket.send(JSON.stringify(authMessage));
            this.stats.totalMessagesSent++;

            if (this.debug) {
                console.log('🔐 Auth sent');
            }

        } catch (error) {
            console.error('❌ Auth send failed:', error);
        }
    }

    /**
     * ارسال پیام‌های در صف
     * @private
     */
    _flushMessageQueue() {
        if (this.messageQueue.length === 0) return;

        const messages = [...this.messageQueue];
        this.messageQueue = [];

        messages.forEach(message => {
            try {
                this.socket.send(JSON.stringify(message));
                this.stats.totalMessagesSent++;

                if (this.debug) {
                    console.log(' Flushed:', message.type);
                }

            } catch (error) {
                console.error('❌ Failed to flush message:', error);
                this.messageQueue.push(message);
            }
        });
    }

    // ============================================================
    // بخش ۳: Ping/Pong
    // ============================================================

    /**
     * شروع تایمر Ping
     * @private
     */
    _startPingTimer() {
        this._stopPingTimer();

        this.pingTimer = setInterval(() => {
            this._sendPing();
        }, CONFIG.API.PING_INTERVAL);
    }

    /**
     * توقف تایمر Ping
     * @private
     */
    _stopPingTimer() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    /**
     * ارسال Ping
     * @private
     */
    _sendPing() {
        if (!this.isConnected) return;

        this.pingPending = true;
        this.stats.lastPing = Date.now();

        const pingMessage = {
            type: 'ping',
            payload: {
                timestamp: Date.now()
            }
        };

        try {
            this.socket.send(JSON.stringify(pingMessage));
            this.stats.totalMessagesSent++;

            // شروع تایمر Pong Timeout
            this._startPongTimer();

            if (this.debug) {
                console.log('🏓 Ping sent');
            }

        } catch (error) {
            console.error('❌ Ping send failed:', error);
        }
    }

    /**
     * شروع تایمر Pong Timeout
     * @private
     */
    _startPongTimer() {
        this._stopPongTimer();

        this.pongTimer = setTimeout(() => {
            if (this.pingPending) {
                console.warn('⚠️ Pong timeout - connection may be lost');
                this._handlePongTimeout();
            }
        }, CONFIG.API.PONG_TIMEOUT);
    }

    /**
     * توقف تایمر Pong Timeout
     * @private
     */
    _stopPongTimer() {
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
    }

    /**
     * مدیریت دریافت Pong
     * @param {Object} data - داده Pong
     * @private
     */
    _handlePong(data) {
        this.pingPending = false;
        this.stats.lastPong = Date.now();

        this._stopPongTimer();

        // محاسبه Latency
        if (data.payload && data.payload.timestamp) {
            const latency = Date.now() - data.payload.timestamp;
            this._updateLatency(latency);
        }

        if (this.debug) {
            console.log(' Pong received');
        }
    }

    /**
     * مدیریت Pong Timeout
     * @private
     */
    _handlePongTimeout() {
        console.error('❌ Pong timeout - reconnecting');
        this.stats.totalErrors++;

        this._emit('connection-weak');

        // قطع اتصال و Reconnection
        if (this.socket) {
            this.socket.close(4000, 'Pong timeout');
        }
    }

    /**
     * به‌روزرسانی Latency
     * @param {number} latency - میلی‌ثانیه
     * @private
     */
    _updateLatency(latency) {
        // Moving average
        this.stats.averageLatency = 
            (this.stats.averageLatency * 0.7) + (latency * 0.3);

        this._emit('latency-updated', {
            latency: latency,
            average: this.stats.averageLatency
        });
    }

    // ============================================================
    // بخش ۴: Reconnection
    // ============================================================

    /**
     * برنامه‌ریزی Reconnection
     * @private
     */
    _scheduleReconnect() {
        this._stopReconnectTimer();

        this.reconnectAttempts++;
        this.status = 'reconnecting';

        this._emit('reconnecting', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts
        });

        if (this.debug) {
            console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        }

        this.reconnectTimer = setTimeout(() => {
            this.connect({
                token: this.authToken,
                userId: this.userId,
                sessionId: this.sessionId
            });
        }, this.reconnectDelay);

        // افزایش تاخیر برای دفعه بعد (Exponential Backoff)
        this.reconnectDelay = Math.min(
            this.reconnectDelay * CONFIG.API.RECONNECT_BACKOFF,
            CONFIG.API.MAX_RECONNECT_DELAY
        );
    }

    /**
     * توقف تایمر Reconnection
     * @private
     */
    _stopReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * تلاش دستی برای Reconnection
     * @returns {Promise<Object>}
     */
    async reconnect() {
        this.reconnectAttempts = 0;
        this.reconnectDelay = CONFIG.API.RECONNECT_DELAY;

        return await this.connect({
            token: this.authToken,
            userId: this.userId,
            sessionId: this.sessionId
        });
    }

    // ============================================================
    // بخش ۵: مدیریت وضعیت آنلاین/آفلاین
    // ============================================================

    /**
     * مدیریت آنلاین شدن
     * @private
     */
    _handleOnline() {
        if (this.debug) {
            console.log('🌐 Online');
        }

        eventBus.emit(EVENTS.APP.ONLINE);

        if (!this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect();
        }
    }

    /**
     * مدیریت آفلاین شدن
     * @private
     */
    _handleOffline() {
        if (this.debug) {
            console.log('🌐 Offline');
        }

        eventBus.emit(EVENTS.APP.OFFLINE);

        if (this.isConnected) {
            this.disconnect(false);
        }
    }

    /**
     * مدیریت تغییر Visibility
     * @private
     */
    _handleVisibilityChange() {
        if (this.debug) {
            console.log('👁️ Visibility changed');
        }

        // بررسی وضعیت اتصال
        if (!this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect();
        }
    }

    // ============================================================
    // بخش ۶: مدیریت پیام‌های سیستمی
    // ============================================================

    /**
     * مدیریت پیام سیستمی
     * @param {Object} data - داده پیام
     * @private
     */
    _handleSystemMessage(data) {
        if (!data.payload) return;

        switch (data.payload.action) {
            case 'maintenance':
                this._handleMaintenance(data.payload);
                break;

            case 'force_update':
                this._handleForceUpdate(data.payload);
                break;

            case 'session_expired':
                this._handleSessionExpired(data.payload);
                break;

            case 'kick':
                this._handleKick(data.payload);
                break;

            default:
                if (this.debug) {
                    console.log('📋 System message:', data.payload.action);
                }
        }
    }

    /**
     * مدیریت نگهداری سرور
     * @param {Object} payload - داده
     * @private
     */
    _handleMaintenance(payload) {
        console.warn('️ Server maintenance:', payload.message);

        this._emit('maintenance', payload);

        eventBus.emit(EVENTS.UI.TOAST_SHOW, {
            message: payload.message || 'سرور در حال به‌روزرسانی است',
            type: 'warning'
        });
    }

    /**
     * مدیریت به‌روزرسانی اجباری
     * @param {Object} payload - داده
     * @private
     */
    _handleForceUpdate(payload) {
        console.warn('⚠️ Force update required');

        this._emit('force_update', payload);

        eventBus.emit(EVENTS.UI.MODAL_OPEN, {
            type: 'force_update',
            data: payload
        });
    }

    /**
     * مدیریت انقضای Session
     * @param {Object} payload - داده
     * @private
     */
    _handleSessionExpired(payload) {
        console.warn('⚠️ Session expired');

        this._emit('session_expired', payload);

        eventBus.emit(EVENTS.AUTH.SESSION_EXPIRED);
    }

    /**
     * مدیریت Kick شدن
     * @param {Object} payload - داده
     * @private
     */
    _handleKick(payload) {
        console.warn('⚠️ Kicked from server:', payload.reason);

        this._emit('kicked', payload);

        this.disconnect(true);
    }

    // ============================================================
    // بخش ۷: اطلاعات و آمار
    // ============================================================

    /**
     * دریافت وضعیت اتصال
     * @returns {Object}
     */
    getConnectionStatus() {
        return {
            status: this.status,
            isConnected: this.isConnected,
            url: this.url,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            queueSize: this.messageQueue.length,
            lastActivity: this.lastActivity,
            uptime: this.stats.connectionStartedAt ? 
                Date.now() - this.stats.connectionStartedAt : 0
        };
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            connectionStatus: this.getConnectionStatus()
        };
    }

    /**
     * دریافت اطلاعات کامل
     * @returns {Object}
     */
    getInfo() {
        return {
            status: this.status,
            isConnected: this.isConnected,
            url: this.url,
            authToken: this.authToken ? '***' : null,
            userId: this.userId,
            sessionId: this.sessionId,
            stats: this.getStats(),
            queue: this.messageQueue.length
        };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const info = this.getInfo();

        console.log('🔌 WebSocket Status:');
        console.log('  Status:', info.status);
        console.log('  Connected:', info.isConnected ? '✅' : '❌');
        console.log('  URL:', info.url);
        console.log('  User:', info.userId || 'N/A');
        console.log('  Messages Sent:', info.stats.totalMessagesSent);
        console.log('  Messages Received:', info.stats.totalMessagesReceived);
        console.log('  Reconnections:', info.stats.totalReconnections);
        console.log('  Errors:', info.stats.totalErrors);
        console.log('  Avg Latency:', info.stats.averageLatency.toFixed(2) + 'ms');
        console.log('  Queue:', info.queue);
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
                    console.error(`❌ WebSocket event listener error:`, error);
                }
            });
        }

        // انتشار در eventBus اصلی
        eventBus.emit(`ws:${event}`, data);
    }

    /**
     * پاک کردن شنوندگان
     */
    clearListeners() {
        this.listeners.clear();
    }

    // ============================================================
    // بخش ۹: Cleanup
    // ============================================================

    /**
     * پاکسازی کامل
     * @returns {void}
     */
    destroy() {
        this.disconnect(true);
        this.clearListeners();
        this.messageQueue = [];

        if (this.debug) {
            console.log('🗑️ WebSocketManager destroyed');
        }
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const wsManager = new WebSocketManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebSocketManager, wsManager };
} else {
    window.WebSocketManager = WebSocketManager;
    window.wsManager = wsManager;
}

console.log('✅ WebSocketManager loaded');
