/**
 * ============================================================
 * HOKM MASTER - Session Manager
 * مدیریت Session و Token
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل Session کاربر است. شامل ایجاد،
 * اعتبارسنجی، تمدید، پاکسازی و مدیریت چند دستگاه. همچنین
 * توکن‌های احراز هویت را مدیریت می‌کند.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - storage (از فایل storage.js)
 * - eventBus, EVENTS (از فایل events.js)
 * 
 * ============================================================
 */

class SessionManager {

    constructor() {
        /**
         * Session فعلی
         * @type {Object|null}
         */
        this.currentSession = null;

        /**
         * Token فعلی
         * @type {string|null}
         */
        this.currentToken = null;

        /**
         * Refresh Token
         * @type {string|null}
         */
        this.refreshToken = null;

        /**
         * آیا Session فعال است
         * @type {boolean}
         */
        this.isActive = false;

        /**
         * زمان آخرین فعالیت
         * @type {number}
         */
        this.lastActivity = 0;

        /**
         * تایبر بررسی انقضا
         * @type {number|null}
         */
        this.expiryCheckTimer = null;

        /**
         * تایبر تمدید خودکار
         * @type {number|null}
         */
        this.refreshTimer = null;

        /**
         * لیست دستگاه‌های فعال
         * @type {Array}
         */
        this.activeDevices = [];

        /**
         * حداکثر تعداد دستگاه‌های همزمان
         * @type {number}
         */
        this.maxDevices = CONFIG.AUTH.SESSION.MAX_DEVICES;

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
         * آیا در حال بررسی Session است
         * @type {boolean}
         */
        this.isChecking = false;

        /**
         * آیا در حال تمدید است
         * @type {boolean}
         */
        this.isRefreshing = false;

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری Session از storage
        this._loadSession();

        // راه‌اندازی بررسی دوره‌ای
        this._startExpiryCheck();

        // راه‌اندازی تمدید خودکار
        this._startAutoRefresh();

        // بررسی فعالیت کاربر
        this._setupActivityTracking();

        if (this.debug) {
            console.log(' SessionManager initialized');
            console.log('  Active:', this.isActive);
            console.log('  Devices:', this.activeDevices.length);
        }
    }

    // ============================================================
    // بخش : بارگذاری و ذخیره
    // ============================================================

    /**
     * بارگذاری Session از storage
     * @private
     */
    _loadSession() {
        try {
            const sessionData = storage.get(CONFIG.STORAGE_KEYS.SESSION, {
                decrypt: true
            });

            const tokenData = storage.get(CONFIG.STORAGE_KEYS.TOKEN, {
                decrypt: true
            });

            const refreshTokenData = storage.get(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, {
                decrypt: true
            });

            if (sessionData) {
                this.currentSession = sessionData;
                this.isActive = true;
                this.lastActivity = sessionData.lastActivity || Date.now();
            }

            if (tokenData) {
                this.currentToken = tokenData;
            }

            if (refreshTokenData) {
                this.refreshToken = refreshTokenData;
            }

            // بررسی انقضا
            if (this.currentSession && this._isExpired(this.currentSession)) {
                console.warn('⚠️ Loaded session is expired');
                this._handleExpiredSession();
            }

        } catch (error) {
            console.error('❌ Failed to load session:', error);
            this._clearSessionData();
        }
    }

    /**
     * ذخیره Session در storage
     * @param {Object} session - Session
     * @returns {boolean} موفقیت
     * @private
     */
    _saveSession(session) {
        try {
            storage.set(CONFIG.STORAGE_KEYS.SESSION, session, {
                encrypt: true
            });

            if (session.token) {
                storage.set(CONFIG.STORAGE_KEYS.TOKEN, session.token, {
                    encrypt: true
                });
            }

            if (session.refreshToken) {
                storage.set(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, session.refreshToken, {
                    encrypt: true
                });
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to save session:', error);
            return false;
        }
    }

    /**
     * پاک کردن داده‌های Session
     * @private
     */
    _clearSessionData() {
        storage.remove(CONFIG.STORAGE_KEYS.SESSION);
        storage.remove(CONFIG.STORAGE_KEYS.TOKEN);
        storage.remove(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);

        this.currentSession = null;
        this.currentToken = null;
        this.refreshToken = null;
        this.isActive = false;
    }

    // ============================================================
    // بخش ۲: ایجاد Session
    // ============================================================

    /**
     * ایجاد Session جدید
     * @param {Object} user - کاربر
     * @param {Object} options - گزینه‌ها
     * @returns {Object} Session ایجاد شده
     */
    createSession(user, options = {}) {
        const {
            deviceInfo = null,
            ipAddress = null,
            rememberMe = true
        } = options;

        // بررسی محدودیت دستگاه
        if (!this._checkDeviceLimit()) {
            throw new Error('MAX_DEVICES_REACHED');
        }

        const session = {
            id: Utils.generateUUID(),
            userId: user.id,
            username: user.username,
            token: this._generateToken(),
            refreshToken: this._generateRefreshToken(),
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiry: this._calculateExpiry(rememberMe),
            device: deviceInfo || this._getDeviceInfo(),
            ipAddress: ipAddress,
            isActive: true,
            isGuest: user.isGuest || false,
            metadata: {
                appVersion: CONFIG.APP.VERSION,
                platform: navigator.platform,
                language: navigator.language
            }
        };

        this.currentSession = session;
        this.currentToken = session.token;
        this.refreshToken = session.refreshToken;
        this.isActive = true;
        this.lastActivity = session.lastActivity;

        // ذخیره
        this._saveSession(session);

        // اضافه کردن به لیست دستگاه‌ها
        this._addDevice(session.device);

        this._emit('created', session);

        if (this.debug) {
            console.log('✅ Session created:', session.id);
        }

        return session;
    }

    /**
     * تولید Token
     * @returns {string}
     * @private
     */
    _generateToken() {
        const prefix = CONFIG.AUTH.SESSION.TOKEN_PREFIX;
        const random = Utils.generateUUID();
        const timestamp = Date.now().toString(36);
        return `${prefix}${random}_${timestamp}`;
    }

    /**
     * تولید Refresh Token
     * @returns {string}
     * @private
     */
    _generateRefreshToken() {
        return 'refresh_' + Utils.generateUUID() + '_' + Date.now().toString(36);
    }

    /**
     * محاسبه زمان انقضا
     * @param {boolean} rememberMe - آیا مرا به خاطر بسپار
     * @returns {number} timestamp انقضا
     * @private
     */
    _calculateExpiry(rememberMe = true) {
        if (rememberMe) {
            return Date.now() + CONFIG.AUTH.SESSION.EXPIRY_MS;
        } else {
            // Session کوتاه‌تر برای "مرا به خاطر بسپار" غیرفعال
            return Date.now() + (24 * 60 * 60 * 1000); // 24 ساعت
        }
    }

    /**
     * دریافت اطلاعات دستگاه
     * @returns {Object}
     * @private
     */
    _getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
            isMobile: Utils.isMobile(),
            isTablet: Utils.isTablet(),
            isDesktop: Utils.isDesktop(),
            browser: this._detectBrowser(),
            os: this._detectOS()
        };
    }

    /**
     * تشخیص مرورگر
     * @returns {string}
     * @private
     */
    _detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('SamsungBrowser')) return 'Samsung';
        if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
        if (ua.includes('Trident')) return 'IE';
        if (ua.includes('Edge')) return 'Edge';
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Safari')) return 'Safari';
        return 'Unknown';
    }

    /**
     * تشخیص سیستم عامل
     * @returns {string}
     * @private
     */
    _detectOS() {
        const ua = navigator.userAgent;
        if (ua.includes('Win')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return 'Unknown';
    }

    // ============================================================
    // بخش ۳: اعتبارسنجی
    // ============================================================

    /**
     * بررسی اعتبار Session
     * @returns {Object} نتیجه بررسی
     */
    validate() {
        if (!this.currentSession) {
            return {
                valid: false,
                reason: 'NO_SESSION',
                message: 'Session یافت نشد'
            };
        }

        if (!this.currentToken) {
            return {
                valid: false,
                reason: 'NO_TOKEN',
                message: 'Token یافت نشد'
            };
        }

        if (this._isExpired(this.currentSession)) {
            return {
                valid: false,
                reason: 'EXPIRED',
                message: 'Session منقضی شده است',
                expiredAt: this.currentSession.expiry
            };
        }

        if (!this.currentSession.isActive) {
            return {
                valid: false,
                reason: 'INACTIVE',
                message: 'Session غیرفعال شده است'
            };
        }

        // بررسی تطابق Token
        if (!this._validateToken(this.currentToken)) {
            return {
                valid: false,
                reason: 'INVALID_TOKEN',
                message: 'Token نامعتبر است'
            };
        }

        // بررسی Idle Timeout
        if (this._isIdle()) {
            return {
                valid: false,
                reason: 'IDLE_TIMEOUT',
                message: 'Session به دلیل عدم فعالیت منقضی شده است',
                lastActivity: this.lastActivity
            };
        }

        return {
            valid: true,
            session: this.currentSession,
            remainingTime: this.getRemainingTime()
        };
    }

    /**
     * بررسی انقضای Session
     * @param {Object} session - Session
     * @returns {boolean}
     * @private
     */
    _isExpired(session) {
        if (!session || !session.expiry) return true;
        return Date.now() > session.expiry;
    }

    /**
     * بررسی Idle بودن
     * @returns {boolean}
     * @private
     */
    _isIdle() {
        const idleTimeout = CONFIG.AUTH.SESSION.IDLE_TIMEOUT_MS;
        if (!idleTimeout) return false;
        
        return (Date.now() - this.lastActivity) > idleTimeout;
    }

    /**
     * اعتبارسنجی Token
     * @param {string} token - Token
     * @returns {boolean}
     * @private
     */
    _validateToken(token) {
        if (!token) return false;
        
        // بررسی ساختار Token
        if (!token.startsWith(CONFIG.AUTH.SESSION.TOKEN_PREFIX)) {
            return false;
        }

        // بررسی طول Token
        if (token.length < 50) {
            return false;
        }

        return true;
    }

    /**
     * دریافت زمان باقی‌مانده
     * @returns {number} میلی‌ثانیه
     */
    getRemainingTime() {
        if (!this.currentSession || !this.currentSession.expiry) {
            return 0;
        }
        return Math.max(0, this.currentSession.expiry - Date.now());
    }

    /**
     * آیا Session به زودی منقضی می‌شود
     * @param {number} threshold - آستانه (میلی‌ثانیه)
     * @returns {boolean}
     */
    isExpiringSoon(threshold = CONFIG.AUTH.SESSION.REFRESH_THRESHOLD_MS) {
        return this.getRemainingTime() < threshold;
    }

    // ============================================================
    // بخش ۴: تمدید Session
    // ============================================================

    /**
     * تمدید Session
     * @returns {Promise<Object>} نتیجه
     */
    async refresh() {
        if (this.isRefreshing) {
            return {
                success: false,
                error: 'ALREADY_REFRESHING',
                message: 'لطفاً صبر کنید'
            };
        }

        if (!this.currentSession) {
            return {
                success: false,
                error: 'NO_SESSION',
                message: 'Session یافت نشد'
            };
        }

        if (!this.refreshToken) {
            return {
                success: false,
                error: 'NO_REFRESH_TOKEN',
                message: 'Refresh Token یافت نشد'
            };
        }

        this.isRefreshing = true;

        try {
            this._emit('refresh-start');

            // در production اینجا API call می‌شود
            // const response = await api.refreshSession(this.refreshToken);
            
            // شبیه‌سازی تمدید
            await Utils.sleep(300);

            // به‌روزرسانی Session
            this.currentSession.expiry = Date.now() + CONFIG.AUTH.SESSION.EXPIRY_MS;
            this.currentSession.lastActivity = Date.now();
            this.currentSession.token = this._generateToken();
            this.currentSession.refreshToken = this._generateRefreshToken();

            this.currentToken = this.currentSession.token;
            this.refreshToken = this.currentSession.refreshToken;
            this.lastActivity = this.currentSession.lastActivity;

            // ذخیره
            this._saveSession(this.currentSession);

            this._emit('refreshed', this.currentSession);

            if (this.debug) {
                console.log('🔄 Session refreshed');
            }

            return {
                success: true,
                session: this.currentSession,
                newExpiry: this.currentSession.expiry
            };

        } catch (error) {
            console.error('❌ Session refresh failed:', error);

            this._emit('refresh-failed', error);

            return {
                success: false,
                error: 'REFRESH_FAILED',
                message: 'خطا در تمدید Session'
            };

        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * تمدید خودکار Session
     * @returns {Promise<boolean>} موفقیت
     */
    async autoRefresh() {
        if (this.isExpiringSoon()) {
            const result = await this.refresh();
            return result.success;
        }
        return true;
    }

    // ============================================================
    // بخش ۵: مدیریت فعالیت
    // ============================================================

    /**
     * به‌روزرسانی زمان آخرین فعالیت
     */
    updateActivity() {
        this.lastActivity = Date.now();

        if (this.currentSession) {
            this.currentSession.lastActivity = this.lastActivity;
        }
    }

    /**
     * راه‌اندازی ردیابی فعالیت
     * @private
     */
    _setupActivityTracking() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        events.forEach(event => {
            document.addEventListener(event, () => {
                this.updateActivity();
            }, { passive: true });
        });

        // بررسی visibility
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.updateActivity();
                this.validate();
            }
        });
    }

    // ============================================================
    // بخش ۶: مدیریت دستگاه‌ها
    // ============================================================

    /**
     * بررسی محدودیت دستگاه
     * @returns {boolean}
     * @private
     */
    _checkDeviceLimit() {
        return this.activeDevices.length < this.maxDevices;
    }

    /**
     * اضافه کردن دستگاه
     * @param {Object} device - اطلاعات دستگاه
     * @private
     */
    _addDevice(device) {
        const deviceEntry = {
            id: Utils.generateUUID(),
            sessionId: this.currentSession?.id,
            device: device,
            addedAt: Date.now(),
            lastActive: Date.now(),
            isActive: true
        };

        this.activeDevices.push(deviceEntry);

        // ذخیره
        storage.set('hokm_active_devices', this.activeDevices);
    }

    /**
     * دریافت لیست دستگاه‌ها
     * @returns {Array}
     */
    getDevices() {
        return this.activeDevices;
    }

    /**
     * حذف دستگاه
     * @param {string} deviceId - شناسه دستگاه
     * @returns {boolean} موفقیت
     */
    removeDevice(deviceId) {
        const index = this.activeDevices.findIndex(d => d.id === deviceId);
        
        if (index === -1) {
            return false;
        }

        const removed = this.activeDevices.splice(index, 1)[0];
        storage.set('hokm_active_devices', this.activeDevices);

        this._emit('device-removed', removed);

        return true;
    }

    /**
     * حذف تمام دستگاه‌ها به جز فعلی
     * @returns {number} تعداد حذف شده
     */
    removeAllOtherDevices() {
        const currentSessionId = this.currentSession?.id;
        const before = this.activeDevices.length;

        this.activeDevices = this.activeDevices.filter(d => d.sessionId === currentSessionId);
        storage.set('hokm_active_devices', this.activeDevices);

        const removed = before - this.activeDevices.length;

        if (removed > 0) {
            this._emit('devices-removed', { count: removed });
        }

        return removed;
    }

    // ============================================================
    // بخش ۷: بررسی دوره‌ای
    // ============================================================

    /**
     * شروع بررسی دوره‌ای انقضا
     * @private
     */
    _startExpiryCheck() {
        this._stopExpiryCheck();

        // بررسی هر 30 ثانیه
        this.expiryCheckTimer = setInterval(() => {
            this._checkExpiry();
        }, 30000);
    }

    /**
     * توقف بررسی دوره‌ای
     * @private
     */
    _stopExpiryCheck() {
        if (this.expiryCheckTimer) {
            clearInterval(this.expiryCheckTimer);
            this.expiryCheckTimer = null;
        }
    }

    /**
     * بررسی انقضا
     * @private
     */
    _checkExpiry() {
        if (!this.currentSession) return;

        if (this._isExpired(this.currentSession)) {
            this._handleExpiredSession();
        } else if (this.isExpiringSoon()) {
            this._emit('expiring-soon', {
                remainingTime: this.getRemainingTime()
            });
        }
    }

    /**
     * مدیریت Session منقضی شده
     * @private
     */
    _handleExpiredSession() {
        console.warn('⚠️ Session expired');

        this._emit('expired', this.currentSession);

        // تلاش برای تمدید با Refresh Token
        if (this.refreshToken) {
            this.refresh().catch(err => {
                console.error('❌ Auto-refresh failed:', err);
                this._clearSession();
            });
        } else {
            this._clearSession();
        }
    }

    /**
     * شروع تمدید خودکار
     * @private
     */
    _startAutoRefresh() {
        this._stopAutoRefresh();

        // بررسی هر 5 دقیقه
        this.refreshTimer = setInterval(() => {
            if (this.isActive && this.isExpiringSoon()) {
                this.autoRefresh();
            }
        }, 300000);
    }

    /**
     * توقف تمدید خودکار
     * @private
     */
    _stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    // ============================================================
    // بخش ۸: پاکسازی
    // ============================================================

    /**
     * پاک کردن Session
     * @returns {void}
     */
    clear() {
        const session = this.currentSession;

        this._clearSessionData();
        this._stopExpiryCheck();
        this._stopAutoRefresh();

        // حذف دستگاه از لیست
        if (session) {
            this.activeDevices = this.activeDevices.filter(d => d.sessionId !== session.id);
            storage.set('hokm_active_devices', this.activeDevices);
        }

        this._emit('cleared', session);

        if (this.debug) {
            console.log('🗑️ Session cleared');
        }
    }

    /**
     * پاک کردن کامل (شامل تمام دستگاه‌ها)
     * @returns {void}
     */
    clearAll() {
        this.clear();
        this.activeDevices = [];
        storage.remove('hokm_active_devices');

        this._emit('cleared-all');
    }

    // ============================================================
    // بخش ۹: توابع کمکی
    // ============================================================

    /**
     * دریافت اطلاعات Session
     * @returns {Object}
     */
    getInfo() {
        return {
            isActive: this.isActive,
            hasSession: !!this.currentSession,
            hasToken: !!this.currentToken,
            hasRefreshToken: !!this.refreshToken,
            isExpired: this.currentSession ? this._isExpired(this.currentSession) : true,
            isExpiringSoon: this.isExpiringSoon(),
            remainingTime: this.getRemainingTime(),
            lastActivity: this.lastActivity,
            deviceCount: this.activeDevices.length,
            maxDevices: this.maxDevices,
            session: this.currentSession ? {
                id: this.currentSession.id,
                userId: this.currentSession.userId,
                username: this.currentSession.username,
                createdAt: this.currentSession.createdAt,
                expiry: this.currentSession.expiry,
                device: this.currentSession.device,
                isGuest: this.currentSession.isGuest
            } : null
        };
    }

    /**
     * لاگ وضعیت Session
     */
    logStatus() {
        const info = this.getInfo();

        console.log('🔑 Session Status:');
        console.log('  Active:', info.isActive ? '✅' : '❌');
        console.log('  Has Session:', info.hasSession ? '✅' : '❌');
        console.log('  Has Token:', info.hasToken ? '✅' : '❌');
        console.log('  Has Refresh:', info.hasRefreshToken ? '✅' : '❌');
        console.log('  Is Expired:', info.isExpired ? '' : '✅');
        console.log('  Expiring Soon:', info.isExpiringSoon ? '️' : '✅');
        console.log('  Remaining:', Utils.formatDuration(Math.ceil(info.remainingTime / 1000)));
        console.log('  Devices:', `${info.deviceCount}/${info.maxDevices}`);

        if (info.session) {
            console.log('  User:', info.session.username);
            console.log('  Device:', info.session.device?.browser, info.session.device?.os);
        }
    }

    /**
     * export Session برای debug
     * @returns {Object}
     */
    exportForDebug() {
        return {
            session: this.currentSession,
            token: this.currentToken,
            refreshToken: this.refreshToken,
            devices: this.activeDevices,
            lastActivity: this.lastActivity
        };
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
                    console.error(`❌ Session event listener error:`, error);
                }
            });
        }

        // انتشار در eventBus اصلی
        eventBus.emit(`session:${event}`, data);
    }

    /**
     * پاک کردن تمام شنوندگان
     */
    clearListeners() {
        this.listeners.clear();
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const sessionManager = new SessionManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionManager, sessionManager };
} else {
    window.SessionManager = SessionManager;
    window.sessionManager = sessionManager;
}

console.log('✅ SessionManager loaded');
