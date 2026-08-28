/**
 * ============================================================
 * HOKM MASTER - Analytics Manager
 * سیستم تحلیل و آنالیتیکس بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم تحلیل و آنالیتیکس است.
 * شامل ردیابی رویدادهای کاربر، تحلیل عملکرد بازی، آمار و
 * متریک‌ها، گزارش‌گیری، بهینه‌سازی عملکرد، و ذخیره و ارسال
 * داده‌های تحلیلی.
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

class AnalyticsManager {

    constructor() {
        /**
         * رویدادهای ثبت شده
         * @type {Array<Object>}
         */
        this.events = [];

        /**
         * متریک‌های عملکرد
         * @type {Object}
         */
        this.metrics = {
            fps: [],
            memory: [],
            loadTime: [],
            responseTime: [],
            errorRate: []
        };

        /**
         * session های کاربر
         * @type {Array<Object>}
         */
        this.sessions = [];

        /**
         * session فعلی
         * @type {Object|null}
         */
        this.currentSession = null;

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
         * آیا آنالیتیکس فعال است
         * @type {boolean}
         */
        this.enabled = true;

        /**
         * آمار آنالیتیکس
         * @type {Object}
         */
        this.stats = {
            totalEvents: 0,
            totalSessions: 0,
            totalErrors: 0,
            totalPageViews: 0,
            totalButtonClicks: 0,
            totalGamesPlayed: 0,
            averageSessionDuration: 0,
            averageFPS: 0,
            averageMemoryUsage: 0,
            lastEventAt: null
        };

        /**
         * پیکربندی آنالیتیکس
         * @type {Object}
         */
        this.config = {
            maxEventsPerSession: 1000,
            maxSessionsToStore: 100,
            flushIntervalMs: 30000,
            enablePerformanceTracking: true,
            enableErrorTracking: true,
            enableUserBehaviorTracking: true,
            enableGameAnalytics: true,
            sampleRate: 1.0,
            batchSize: 50
        };

        /**
         * تایمر flush
         * @type {number|null}
         */
        this.flushTimer = null;

        /**
         * تایمر performance
         * @type {number|null}
         */
        this.performanceTimer = null;

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

        // شروع session جدید
        this._startNewSession();

        // شروع ردیابی performance
        if (this.config.enablePerformanceTracking) {
            this._startPerformanceTracking();
        }

        // شروع flush timer
        this._startFlushTimer();

        // ثبت رویدادهای سیستمی
        this._setupSystemEventListeners();

        if (this.debug) {
            console.log('📊 AnalyticsManager initialized');
            console.log('  Enabled:', this.enabled);
            console.log('  Sample Rate:', this.config.sampleRate);
        }
    }

    // ============================================================
    // بخش ۱: مدیریت Session
    // ============================================================

    /**
     * شروع session جدید
     * @returns {Object} session
     * @private
     */
    _startNewSession() {
        const session = {
            id: Utils.generateUUID(),
            userId: authManager?.getCurrentUser()?.id || 'anonymous',
            startTime: Date.now(),
            endTime: null,
            duration: 0,
            events: [],
            pageViews: 0,
            buttonClicks: 0,
            gamesPlayed: 0,
            errors: 0,
            device: this._getDeviceInfo(),
            metadata: {
                appVersion: CONFIG.APP.VERSION,
                language: CONFIG.LANGUAGE.DEFAULT,
                screenResolution: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown'
            }
        };

        this.currentSession = session;
        this.sessions.push(session);
        this.stats.totalSessions++;

        this._emit('session-started', { session });

        if (this.debug) {
            console.log(` New session started: ${session.id}`);
        }

        return session;
    }

    /**
     * پایان session فعلی
     * @returns {Object} نتیجه
     */
    endCurrentSession() {
        if (!this.currentSession) {
            return {
                success: false,
                error: 'NO_ACTIVE_SESSION',
                message: 'Session فعالی وجود ندارد'
            };
        }

        this.currentSession.endTime = Date.now();
        this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

        // محاسبه میانگین مدت session
        const totalDuration = this.sessions.reduce((sum, s) => sum + s.duration, 0);
        this.stats.averageSessionDuration = totalDuration / this.sessions.length;

        this._emit('session-ended', { session: this.currentSession });

        if (this.debug) {
            console.log(`✅ Session ended: ${this.currentSession.id}, Duration: ${this.currentSession.duration}ms`);
        }

        const endedSession = this.currentSession;
        this.currentSession = null;

        return {
            success: true,
            session: endedSession
        };
    }

    /**
     * دریافت session فعلی
     * @returns {Object|null}
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * دریافت تمام session ها
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getSessions(limit = 50) {
        return this.sessions.slice(-limit).reverse();
    }

    // ============================================================
    // بخش ۲: ردیابی رویدادها
    // ============================================================

    /**
     * ثبت رویداد
     * @param {string} eventName - نام رویداد
     * @param {Object} properties - ویژگی‌ها
     * @returns {Object} نتیجه
     */
    trackEvent(eventName, properties = {}) {
        if (!this.enabled) {
            return {
                success: false,
                error: 'ANALYTICS_DISABLED',
                message: 'آنالیتیکس غیرفعال است'
            };
        }

        // بررسی sample rate
        if (Math.random() > this.config.sampleRate) {
            return {
                success: false,
                error: 'SAMPLED_OUT',
                message: 'رویداد نمونه‌گیری نشد'
            };
        }

        const event = {
            id: Utils.generateUUID(),
            name: eventName,
            properties,
            timestamp: Date.now(),
            sessionId: this.currentSession?.id || null,
            userId: authManager?.getCurrentUser()?.id || 'anonymous',
            page: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
            metadata: {
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown'
            }
        };

        this.events.push(event);
        this.stats.totalEvents++;
        this.stats.lastEventAt = Date.now();

        // به‌روزرسانی session
        if (this.currentSession) {
            this.currentSession.events.push(event);

            // بررسی محدودیت رویدادها
            if (this.currentSession.events.length >= this.config.maxEventsPerSession) {
                this.endCurrentSession();
                this._startNewSession();
            }
        }

        // به‌روزرسانی آمار خاص
        this._updateEventStats(eventName);

        this._emit('event-tracked', { event });

        if (this.debug) {
            console.log(`📊 Event tracked: ${eventName}`, properties);
        }

        return {
            success: true,
            event
        };
    }

    /**
     * به‌روزرسانی آمار بر اساس نوع رویداد
     * @param {string} eventName - نام رویداد
     * @private
     */
    _updateEventStats(eventName) {
        if (eventName === 'page_view') {
            this.stats.totalPageViews++;
            if (this.currentSession) this.currentSession.pageViews++;
        } else if (eventName === 'button_click') {
            this.stats.totalButtonClicks++;
            if (this.currentSession) this.currentSession.buttonClicks++;
        } else if (eventName === 'game_started' || eventName === 'game_played') {
            this.stats.totalGamesPlayed++;
            if (this.currentSession) this.currentSession.gamesPlayed++;
        } else if (eventName === 'error') {
            this.stats.totalErrors++;
            if (this.currentSession) this.currentSession.errors++;
        }
    }

    /**
     * ثبت page view
     * @param {string} page - صفحه
     * @returns {Object} نتیجه
     */
    trackPageView(page) {
        return this.trackEvent('page_view', { page });
    }

    /**
     * ثبت کلیک دکمه
     * @param {string} buttonName - نام دکمه
     * @param {Object} properties - ویژگی‌ها
     * @returns {Object} نتیجه
     */
    trackButtonClick(buttonName, properties = {}) {
        return this.trackEvent('button_click', { buttonName, ...properties });
    }

    /**
     * ثبت خطا
     * @param {string} errorType - نوع خطا
     * @param {string} message - پیام خطا
     * @param {Object} details - جزئیات
     * @returns {Object} نتیجه
     */
    trackError(errorType, message, details = {}) {
        return this.trackEvent('error', { errorType, message, ...details });
    }

    /**
     * ثبت بازی
     * @param {Object} gameData - داده بازی
     * @returns {Object} نتیجه
     */
    trackGame(gameData) {
        return this.trackEvent('game_played', gameData);
    }

    /**
     * ثبت خرید
     * @param {Object} purchaseData - داده خرید
     * @returns {Object} نتیجه
     */
    trackPurchase(purchaseData) {
        return this.trackEvent('purchase', purchaseData);
    }

    /**
     * ثبت ثبت‌نام
     * @param {Object} userData - داده کاربر
     * @returns {Object} نتیجه
     */
    trackSignup(userData) {
        return this.trackEvent('signup', userData);
    }

    /**
     * ثبت ورود
     * @param {Object} userData - داده کاربر
     * @returns {Object} نتیجه
     */
    trackLogin(userData) {
        return this.trackEvent('login', userData);
    }

    /**
     * ثبت خروج
     * @param {Object} userData - داده کاربر
     * @returns {Object} نتیجه
     */
    trackLogout(userData) {
        return this.trackEvent('logout', userData);
    }

    // ============================================================
    // بخش ۳: ردیابی Performance
    // ============================================================

    /**
     * شروع ردیابی performance
     * @private
     */
    _startPerformanceTracking() {
        this.performanceTimer = setInterval(() => {
            this._trackPerformanceMetrics();
        }, 1000);
    }

    /**
     * ثبت متریک‌های performance
     * @private
     */
    _trackPerformanceMetrics() {
        // FPS
        const fps = this._calculateFPS();
        this.metrics.fps.push(fps);

        // Memory
        const memory = this._getMemoryUsage();
        this.metrics.memory.push(memory);

        // محدود کردن آرایه‌ها
        if (this.metrics.fps.length > 100) this.metrics.fps.shift();
        if (this.metrics.memory.length > 100) this.metrics.memory.shift();

        // محاسبه میانگین
        this.stats.averageFPS = this.metrics.fps.reduce((sum, f) => sum + f, 0) / this.metrics.fps.length;
        this.stats.averageMemoryUsage = this.metrics.memory.reduce((sum, m) => sum + m, 0) / this.metrics.memory.length;
    }

    /**
     * محاسبه FPS
     * @returns {number}
     * @private
     */
    _calculateFPS() {
        if (typeof performance === 'undefined') return 60;

        const now = performance.now();
        const delta = now - (this._lastFrameTime || now);
        this._lastFrameTime = now;

        return Math.round(1000 / delta);
    }

    /**
     * دریافت مصرف حافظه
     * @returns {number} مگابایت
     * @private
     */
    _getMemoryUsage() {
        if (performance && performance.memory) {
            return performance.memory.usedJSHeapSize / 1048576;
        }
        return 0;
    }

    /**
     * دریافت متریک‌های performance
     * @returns {Object}
     */
    getPerformanceMetrics() {
        return {
            fps: {
                current: this.metrics.fps[this.metrics.fps.length - 1] || 0,
                average: this.stats.averageFPS,
                min: Math.min(...this.metrics.fps),
                max: Math.max(...this.metrics.fps)
            },
            memory: {
                current: this.metrics.memory[this.metrics.memory.length - 1] || 0,
                average: this.stats.averageMemoryUsage,
                min: Math.min(...this.metrics.memory),
                max: Math.max(...this.metrics.memory)
            }
        };
    }

    // ============================================================
    // بخش ۴: Flush و ارسال داده‌ها
    // ============================================================

    /**
     * شروع flush timer
     * @private
     */
    _startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushIntervalMs);
    }

    /**
     * Flush رویدادها (ارسال به سرور)
     * @returns {Object} نتیجه
     */
    flush() {
        if (this.events.length === 0) {
            return {
                success: true,
                message: 'No events to flush'
            };
        }

        const eventsToSend = this.events.splice(0, this.config.batchSize);

        // در production، اینجا به سرور ارسال می‌شود
        this._sendToServer(eventsToSend);

        if (this.debug) {
            console.log(`📤 Flushed ${eventsToSend.length} events`);
        }

        return {
            success: true,
            flushedCount: eventsToSend.length,
            remainingCount: this.events.length
        };
    }

    /**
     * ارسال به سرور
     * @param {Array} events - رویدادها
     * @private
     */
    _sendToServer(events) {
        if (typeof wsManager !== 'undefined' && wsManager.isConnected) {
            wsManager.send('analytics_events', events);
        }

        // ذخیره محلی به عنوان backup
        storage?.set('analytics_pending_events', this.events);
    }

    /**
     * دریافت رویدادهای در انتظار
     * @returns {Array<Object>}
     */
    getPendingEvents() {
        return [...this.events];
    }

    // ============================================================
    // بخش ۵: گزارش‌گیری
    // ============================================================

    /**
     * دریافت گزارش کلی
     * @param {Object} options - گزینه‌ها
     * @returns {Object} گزارش
     */
    getReport(options = {}) {
        const {
            startDate = null,
            endDate = null,
            eventName = null
        } = options;

        let filteredEvents = [...this.events];

        // فیلتر بر اساس تاریخ
        if (startDate) {
            filteredEvents = filteredEvents.filter(e => e.timestamp >= startDate);
        }
        if (endDate) {
            filteredEvents = filteredEvents.filter(e => e.timestamp <= endDate);
        }

        // فیلتر بر اساس نام رویداد
        if (eventName) {
            filteredEvents = filteredEvents.filter(e => e.name === eventName);
        }

        // تحلیل رویدادها
        const eventCounts = {};
        filteredEvents.forEach(event => {
            eventCounts[event.name] = (eventCounts[event.name] || 0) + 1;
        });

        return {
            totalEvents: filteredEvents.length,
            eventCounts,
            topEvents: Object.entries(eventCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10),
            timeRange: {
                start: startDate || filteredEvents[0]?.timestamp,
                end: endDate || filteredEvents[filteredEvents.length - 1]?.timestamp
            },
            performance: this.getPerformanceMetrics(),
            sessions: this.sessions.length,
            averageSessionDuration: this.stats.averageSessionDuration
        };
    }

    /**
     * دریافت گزارش رویداد خاص
     * @param {string} eventName - نام رویداد
     * @returns {Object} گزارش
     */
    getEventReport(eventName) {
        const events = this.events.filter(e => e.name === eventName);
        const count = events.length;

        // تحلیل properties
        const propertyAnalysis = {};
        events.forEach(event => {
            for (const [key, value] of Object.entries(event.properties)) {
                if (!propertyAnalysis[key]) {
                    propertyAnalysis[key] = {
                        count: 0,
                        values: new Set()
                    };
                }
                propertyAnalysis[key].count++;
                propertyAnalysis[key].values.add(value);
            }
        });

        return {
            eventName,
            count,
            percentage: (count / this.stats.totalEvents) * 100,
            propertyAnalysis: Object.fromEntries(
                Object.entries(propertyAnalysis).map(([key, data]) => [
                    key,
                    {
                        count: data.count,
                        uniqueValues: data.values.size
                    }
                ])
            ),
            timeline: this._getEventTimeline(events)
        };
    }

    /**
     * دریافت timeline رویدادها
     * @param {Array} events - رویدادها
     * @returns {Object} timeline
     * @private
     */
    _getEventTimeline(events) {
        const hourlyCounts = {};
        
        events.forEach(event => {
            const hour = new Date(event.timestamp).getHours();
            hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
        });

        return hourlyCounts;
    }

    // ============================================================
    // بخش ۶: تحلیل کاربر
    // ============================================================

    /**
     * دریافت پروفایل تحلیلی کاربر
     * @param {string} userId - شناسه کاربر
     * @returns {Object} پروفایل
     */
    getUserProfile(userId) {
        const userEvents = this.events.filter(e => e.userId === userId);
        const userSessions = this.sessions.filter(s => s.userId === userId);

        const totalDuration = userSessions.reduce((sum, s) => sum + s.duration, 0);
        const averageSessionDuration = userSessions.length > 0 ? totalDuration / userSessions.length : 0;

        // رویدادهای محبوب
        const eventCounts = {};
        userEvents.forEach(event => {
            eventCounts[event.name] = (eventCounts[event.name] || 0) + 1;
        });

        const topEvents = Object.entries(eventCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return {
            userId,
            totalEvents: userEvents.length,
            totalSessions: userSessions.length,
            totalDuration,
            averageSessionDuration,
            topEvents: Object.fromEntries(topEvents),
            firstSeen: userEvents[0]?.timestamp,
            lastSeen: userEvents[userEvents.length - 1]?.timestamp,
            device: userSessions[userSessions.length - 1]?.device
        };
    }

    /**
     * دریافت کاربران فعال
     * @param {number} hours - ساعت‌های اخیر
     * @returns {Array<string>} شناسه کاربران
     */
    getActiveUsers(hours = 24) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        const activeUserIds = new Set();

        this.events.forEach(event => {
            if (event.timestamp >= cutoff) {
                activeUserIds.add(event.userId);
            }
        });

        return Array.from(activeUserIds);
    }

    // ============================================================
    // بخش ۷: تنظیمات
    // ============================================================

    /**
     * به‌روزرسانی پیکربندی
     * @param {Object} newConfig - پیکربندی جدید
     * @returns {Object} نتیجه
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };

        this._emit('config-updated', { config: this.config });

        if (this.debug) {
            console.log('️ Analytics config updated');
        }

        return {
            success: true,
            config: this.config
        };
    }

    /**
     * فعال/غیرفعال کردن آنالیتیکس
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        this._emit('analytics-toggled', { enabled });

        if (this.debug) {
            console.log(` Analytics ${enabled ? 'enabled' : 'disabled'}`);
        }

        return {
            success: true,
            enabled
        };
    }

    /**
     * تغییر sample rate
     * @param {number} rate - نرخ نمونه‌گیری (0 تا 1)
     * @returns {Object} نتیجه
     */
    setSampleRate(rate) {
        if (rate < 0 || rate > 1) {
            return {
                success: false,
                error: 'INVALID_RATE',
                message: 'نرخ نمونه‌گیری باید بین 0 و 1 باشد'
            };
        }

        return this.updateConfig({ sampleRate: rate });
    }

    // ============================================================
    // بخش ۸: توابع کمکی
    // ============================================================

    /**
     * دریافت اطلاعات دستگاه
     * @returns {Object}
     * @private
     */
    _getDeviceInfo() {
        return {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
            language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
            screenWidth: typeof screen !== 'undefined' ? screen.width : 0,
            screenHeight: typeof screen !== 'undefined' ? screen.height : 0,
            viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
            viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
            devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
            isMobile: Utils.isMobile(),
            isTablet: Utils.isTablet(),
            isDesktop: Utils.isDesktop()
        };
    }

    /**
     * ثبت رویدادهای سیستمی
     * @private
     */
    _setupSystemEventListeners() {
        if (typeof window === 'undefined') return;

        // Page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden');
            } else {
                this.trackEvent('page_visible');
            }
        });

        // Before unload
        window.addEventListener('beforeunload', () => {
            this.flush();
            this.endCurrentSession();
        });

        // Error tracking
        if (this.config.enableErrorTracking) {
            window.addEventListener('error', (event) => {
                this.trackError('javascript_error', event.message, {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            });

            window.addEventListener('unhandledrejection', (event) => {
                this.trackError('unhandled_promise_rejection', event.reason?.message || 'Unknown', {
                    reason: event.reason
                });
            });
        }
    }

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('analytics_events', this.events.slice(-1000)); // فقط 1000 رویداد آخر
            storage.set('analytics_sessions', this.sessions.slice(-50)); // فقط 50 session آخر
            storage.set('analytics_stats', this.stats);
            storage.set('analytics_config', this.config);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const events = storage.get('analytics_events');
            if (events) this.events = events;

            const sessions = storage.get('analytics_sessions');
            if (sessions) this.sessions = sessions;

            const stats = storage.get('analytics_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            const config = storage.get('analytics_config');
            if (config) this.config = { ...this.config, ...config };
        }
    }

    // ============================================================
    // بخش : آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            pendingEvents: this.events.length,
            totalSessions: this.sessions.length,
            performance: this.getPerformanceMetrics()
        };
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        return {
            enabled: this.enabled,
            totalEvents: this.stats.totalEvents,
            totalSessions: this.stats.totalSessions,
            averageSessionDuration: this.stats.averageSessionDuration,
            averageFPS: this.stats.averageFPS,
            averageMemoryUsage: this.stats.averageMemoryUsage,
            errorRate: this.stats.totalErrors / Math.max(1, this.stats.totalEvents)
        };
    }

    // ============================================================
    // بخش ۱۰: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.events = [];
        this.sessions = [];
        this.currentSession = null;
        this.metrics = {
            fps: [],
            memory: [],
            loadTime: [],
            responseTime: [],
            errorRate: []
        };

        this.stats = {
            totalEvents: 0,
            totalSessions: 0,
            totalErrors: 0,
            totalPageViews: 0,
            totalButtonClicks: 0,
            totalGamesPlayed: 0,
            averageSessionDuration: 0,
            averageFPS: 0,
            averageMemoryUsage: 0,
            lastEventAt: null
        };

        this._startNewSession();
        this._saveData();

        if (this.debug) {
            console.log('🔄 AnalyticsManager reset');
        }
    }

    /**
     * پاکسازی داده‌های قدیمی
     * @param {number} daysToKeep - روزهای نگهداری
     * @returns {number} تعداد پاکسازی شده
     */
    cleanupOldData(daysToKeep = 30) {
        const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

        const eventsBefore = this.events.length;
        this.events = this.events.filter(e => e.timestamp >= cutoff);
        const eventsCleaned = eventsBefore - this.events.length;

        const sessionsBefore = this.sessions.length;
        this.sessions = this.sessions.filter(s => s.startTime >= cutoff);
        const sessionsCleaned = sessionsBefore - this.sessions.length;

        this._saveData();

        if (this.debug) {
            console.log(`🧹 Cleaned ${eventsCleaned} events and ${sessionsCleaned} sessions older than ${daysToKeep} days`);
        }

        return eventsCleaned + sessionsCleaned;
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('📊 AnalyticsManager Status:');
        console.log('  Enabled:', summary.enabled);
        console.log('  Total Events:', summary.totalEvents);
        console.log('  Total Sessions:', summary.totalSessions);
        console.log('  Avg Session Duration:', summary.averageSessionDuration + 'ms');
        console.log('  Avg FPS:', summary.averageFPS.toFixed(1));
        console.log('  Avg Memory:', summary.averageMemoryUsage.toFixed(2) + 'MB');
        console.log('  Error Rate:', (summary.errorRate * 100).toFixed(2) + '%');
        console.log('  Pending Events:', stats.pendingEvents);
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
                    console.error(`❌ Analytics event listener error:`, error);
                }
            });
        }

        eventBus.emit(`analytics:${event}`, data);
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
const analyticsManager = new AnalyticsManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnalyticsManager, analyticsManager };
} else {
    window.AnalyticsManager = AnalyticsManager;
    window.analyticsManager = analyticsManager;
}

console.log('✅ AnalyticsManager loaded');
