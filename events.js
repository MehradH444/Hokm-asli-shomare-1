/**
 * ============================================================
 * HOKM MASTER - Event System
 * سیستم رویداد مرکزی پروژه
 * ============================================================
 * 
 * این فایل یک Event Bus کامل و پیشرفته را پیاده‌سازی می‌کند
 * که به عنوان سیستم ارتباطی بین تمام ماژول‌های پروژه عمل
 * می‌کند. تمام بخش‌های بازی از طریق این سیستم با یکدیگر
 * ارتباط برقرار می‌کنند.
 * 
 * ویژگی‌ها:
 * - پشتیبانی از wildcard patterns
 * - Namespace برای سازماندهی رویدادها
 * - اولویت برای شنوندگان
 * - قابلیت once (یک‌بار مصرف)
 * - قابلیت pause/resume
 * - تاریخچه رویدادها
 * - Debug mode
 * - Performance monitoring
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * 
 * ============================================================
 */

class EventBus {

    constructor() {
        /**
         * نقشه شنوندگان رویداد
         * ساختار: Map<string, Set<Listener>>
         * @type {Map}
         */
        this.listeners = new Map();

        /**
         * شنوندگان wildcard
         * @type {Array}
         */
        this.wildcardListeners = [];

        /**
         * شنوندگان namespace
         * @type {Map}
         */
        this.namespaceListeners = new Map();

        /**
         * تاریخچه رویدادها
         * @type {Array}
         */
        this.history = [];

        /**
         * حداکثر تعداد رویداد در تاریخچه
         * @type {number}
         */
        this.maxHistorySize = 500;

        /**
         * آیا رویدادها pause شده‌اند
         * @type {boolean}
         */
        this.isPaused = false;

        /**
         * صف رویدادهای در انتظار
         * @type {Array}
         */
        this.pendingEvents = [];

        /**
         * شمارنده رویدادها
         * @type {number}
         */
        this.eventCounter = 0;

        /**
         * آمار رویدادها
         * @type {Object}
         */
        this.stats = {
            totalEmitted: 0,
            totalHandled: 0,
            totalErrors: 0,
            averageListeners: 0,
            slowestEvent: null,
            slowestDuration: 0,
            byNamespace: {}
        };

        /**
         * آیا debug mode فعال است
         * @type {boolean}
         */
        this.debug = CONFIG.DEBUG.ENABLED;

        /**
         * حداکثر تعداد شنونده برای هر رویداد (جلوگیری از memory leak)
         * @type {number}
         */
        this.maxListenersPerEvent = 50;

        /**
         * زمان‌سنج برای performance monitoring
         * @type {Map}
         */
        this.timers = new Map();

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        if (this.debug) {
            console.log(' EventBus initialized');
        }

        // پاک کردن تاریخچه قدیمی هر 5 دقیقه
        setInterval(() => {
            this._cleanupHistory();
        }, 300000);
    }

    // ============================================================
    // بخش ۱: تعریف رویدادها
    // ============================================================

    /**
     * تمام رویدادهای پروژه
     * این ثابت شامل تمام رویدادهایی است که در پروژه استفاده می‌شوند
     * @type {Object}
     */
    static get EVENTS() {
        return Object.freeze({
            // رویدادهای عمومی
            APP: Object.freeze({
                READY: 'app:ready',
                INITIALIZED: 'app:initialized',
                ERROR: 'app:error',
                WARNING: 'app:warning',
                STATE_CHANGE: 'app:state_change',
                VISIBILITY_CHANGE: 'app:visibility_change',
                ONLINE: 'app:online',
                OFFLINE: 'app:offline',
                LANGUAGE_CHANGE: 'app:language_change',
                THEME_CHANGE: 'app:theme_change'
            }),

            // رویدادهای احراز هویت
            AUTH: Object.freeze({
                LOGIN_STARTED: 'auth:login_started',
                LOGIN_SUCCESS: 'auth:login_success',
                LOGIN_FAILED: 'auth:login_failed',
                LOGOUT: 'auth:logout',
                LOGOUT_SUCCESS: 'auth:logout_success',
                REGISTER_STARTED: 'auth:register_started',
                REGISTER_SUCCESS: 'auth:register_success',
                REGISTER_FAILED: 'auth:register_failed',
                OTP_SENT: 'auth:otp_sent',
                OTP_VERIFIED: 'auth:otp_verified',
                OTP_FAILED: 'auth:otp_failed',
                OTP_RESENT: 'auth:otp_resent',
                GUEST_LOGIN: 'auth:guest_login',
                SESSION_EXPIRED: 'auth:session_expired',
                SESSION_REFRESHED: 'auth:session_refreshed',
                TOKEN_EXPIRED: 'auth:token_expired',
                PASSWORD_CHANGED: 'auth:password_changed',
                ACCOUNT_DELETED: 'auth:account_deleted'
            }),

            // رویدادهای رابط کاربری
            UI: Object.freeze({
                SCREEN_CHANGE: 'ui:screen_change',
                PAGE_CHANGE: 'ui:page_change',
                MODAL_OPEN: 'ui:modal_open',
                MODAL_CLOSE: 'ui:modal_close',
                MODAL_CONFIRM: 'ui:modal_confirm',
                MODAL_CANCEL: 'ui:modal_cancel',
                TOAST_SHOW: 'ui:toast_show',
                TOAST_HIDE: 'ui:toast_hide',
                LOADING_START: 'ui:loading_start',
                LOADING_END: 'ui:loading_end',
                LOADING_PROGRESS: 'ui:loading_progress',
                MENU_OPEN: 'ui:menu_open',
                MENU_CLOSE: 'ui:menu_close',
                SCROLL: 'ui:scroll',
                RESIZE: 'ui:resize',
                KEYBOARD_SHOW: 'ui:keyboard_show',
                KEYBOARD_HIDE: 'ui:keyboard_hide'
            }),

            // رویدادهای پروفایل
            PROFILE: Object.freeze({
                UPDATED: 'profile:updated',
                AVATAR_CHANGED: 'profile:avatar_changed',
                NAME_CHANGED: 'profile:name_changed',
                LEVEL_UP: 'profile:level_up',
                XP_GAINED: 'profile:xp_gained',
                RATING_CHANGED: 'profile:rating_changed',
                LEAGUE_CHANGED: 'profile:league_changed',
                LEAGUE_PROMOTED: 'profile:league_promoted',
                LEAGUE_DEMOTED: 'profile:league_demoted',
                TITLE_CHANGED: 'profile:title_changed',
                FRAME_CHANGED: 'profile:frame_changed',
                STATISTICS_UPDATED: 'profile:statistics_updated'
            }),

            // رویدادهای بازی
            GAME: Object.freeze({
                STARTED: 'game:started',
                ENDED: 'game:ended',
                TURN_CHANGED: 'game:turn_changed',
                CARD_PLAYED: 'game:card_played',
                CARD_SELECTED: 'game:card_selected',
                CARD_DEALT: 'game:card_dealt',
                TRICK_STARTED: 'game:trick_started',
                TRICK_WON: 'game:trick_won',
                TRICK_COMPLETED: 'game:trick_completed',
                ROUND_STARTED: 'game:round_started',
                ROUND_WON: 'game:round_won',
                ROUND_COMPLETED: 'game:round_completed',
                MATCH_WON: 'game:match_won',
                MATCH_LOST: 'game:match_lost',
                MATCH_DRAW: 'game:match_draw',
                TRUMP_SELECTED: 'game:trump_selected',
                HAKEM_CHOSEN: 'game:hakem_chosen',
                DEALER_CHOSEN: 'game:dealer_chosen',
                KOT: 'game:kot',
                DOUBLE_KOT: 'game:double_kot',
                SCORE_UPDATED: 'game:score_updated',
                TIMER_STARTED: 'game:timer_started',
                TIMER_WARNING: 'game:timer_warning',
                TIMER_EXPIRED: 'game:timer_expired',
                PLAYER_READY: 'game:player_ready',
                PLAYER_NOT_READY: 'game:player_not_ready',
                PLAYER_DISCONNECTED: 'game:player_disconnected',
                PLAYER_RECONNECTED: 'game:player_reconnected',
                PLAYER_AFK: 'game:player_afk',
                PLAYER_LEFT: 'game:player_left',
                GAME_PAUSED: 'game:paused',
                GAME_RESUMED: 'game:resumed'
            }),

            // رویدادهای هوش مصنوعی
            AI: Object.freeze({
                THINKING: 'ai:thinking',
                MOVE_MADE: 'ai:move_made',
                TRUMP_CHOSEN: 'ai:trump_chosen',
                ERROR: 'ai:error',
                LEVEL_CHANGED: 'ai:level_changed'
            }),

            // رویدادهای شبکه
            NETWORK: Object.freeze({
                CONNECTED: 'network:connected',
                DISCONNECTED: 'network:disconnected',
                RECONNECTING: 'network:reconnecting',
                RECONNECTED: 'network:reconnected',
                RECONNECT_FAILED: 'network:reconnect_failed',
                MESSAGE_SENT: 'network:message_sent',
                MESSAGE_RECEIVED: 'network:message_received',
                ERROR: 'network:error',
                LATENCY_UPDATED: 'network:latency_updated',
                WS_OPEN: 'network:ws_open',
                WS_CLOSE: 'network:ws_close',
                WS_ERROR: 'network:ws_error',
                WS_MESSAGE: 'network:ws_message'
            }),

            // رویدادهای اتاق
            ROOM: Object.freeze({
                CREATED: 'room:created',
                JOINED: 'room:joined',
                LEFT: 'room:left',
                PLAYER_JOINED: 'room:player_joined',
                PLAYER_LEFT: 'room:player_left',
                PLAYER_KICKED: 'room:player_kicked',
                READY_CHANGED: 'room:ready_changed',
                ALL_READY: 'room:all_ready',
                STARTED: 'room:started',
                CLOSED: 'room:closed',
                CODE_COPIED: 'room:code_copied',
                INVITE_SENT: 'room:invite_sent'
            }),

            // رویدادهای Matchmaking
            MATCHMAKING: Object.freeze({
                STARTED: 'matchmaking:started',
                SEARCHING: 'matchmaking:searching',
                MATCH_FOUND: 'matchmaking:match_found',
                MATCH_ACCEPTED: 'matchmaking:match_accepted',
                MATCH_DECLINED: 'matchmaking:match_declined',
                CANCELLED: 'matchmaking:cancelled',
                TIMEOUT: 'matchmaking:timeout',
                ERROR: 'matchmaking:error',
                QUEUE_POSITION: 'matchmaking:queue_position'
            }),

            // رویدادهای لیگ
            LEAGUE: Object.freeze({
                UPDATED: 'league:updated',
                SEASON_STARTED: 'league:season_started',
                SEASON_ENDED: 'league:season_ended',
                RANK_CHANGED: 'league:rank_changed',
                REWARDS_DISTRIBUTED: 'league:rewards_distributed'
            }),

            // رویدادهای تورنمنت
            TOURNAMENT: Object.freeze({
                REGISTERED: 'tournament:registered',
                STARTED: 'tournament:started',
                MATCH_WON: 'tournament:match_won',
                MATCH_LOST: 'tournament:match_lost',
                ELIMINATED: 'tournament:eliminated',
                COMPLETED: 'tournament:completed',
                REWARD_CLAIMED: 'tournament:reward_claimed',
                BRACKET_UPDATED: 'tournament:bracket_updated'
            }),

            // رویدادهای رویداد (Event)
            EVENT: Object.freeze({
                STARTED: 'event:started',
                ENDED: 'event:ended',
                PROGRESS_UPDATED: 'event:progress_updated',
                REWARD_CLAIMED: 'event:reward_claimed',
                RANK_CHANGED: 'event:rank_changed'
            }),

            // رویدادهای مأموریت
            MISSION: Object.freeze({
                UPDATED: 'mission:updated',
                COMPLETED: 'mission:completed',
                REWARD_CLAIMED: 'mission:reward_claimed',
                DAILY_RESET: 'mission:daily_reset',
                WEEKLY_RESET: 'mission:weekly_reset',
                MONTHLY_RESET: 'mission:monthly_reset',
                NEW_AVAILABLE: 'mission:new_available'
            }),

            // رویدادهای دستاورد
            ACHIEVEMENT: Object.freeze({
                UNLOCKED: 'achievement:unlocked',
                PROGRESS_UPDATED: 'achievement:progress_updated',
                REWARD_CLAIMED: 'achievement:reward_claimed'
            }),

            // رویدادهای پاداش
            REWARD: Object.freeze({
                CLAIMED: 'reward:claimed',
                DAILY_CLAIMED: 'reward:daily_claimed',
                MATCH_EARNED: 'reward:match_earned',
                MISSION_EARNED: 'reward:mission_earned',
                ACHIEVEMENT_EARNED: 'reward:achievement_earned',
                LEAGUE_EARNED: 'reward:league_earned',
                TOURNAMENT_EARNED: 'reward:tournament_earned',
                CHEST_OPENED: 'reward:chest_opened'
            }),

            // رویدادهای اقتصاد
            ECONOMY: Object.freeze({
                COINS_CHANGED: 'economy:coins_changed',
                GEMS_CHANGED: 'economy:gems_changed',
                TICKETS_CHANGED: 'economy:tickets_changed',
                TRANSACTION_COMPLETED: 'economy:transaction_completed',
                TRANSACTION_FAILED: 'economy:transaction_failed',
                BALANCE_LOW: 'economy:balance_low',
                BALANCE_ZERO: 'economy:balance_zero'
            }),

            // رویدادهای فروشگاه
            SHOP: Object.freeze({
                ITEM_PURCHASED: 'shop:item_purchased',
                ITEM_EQUIPPED: 'shop:item_equipped',
                ITEM_UNEQUIPPED: 'shop:item_unequipped',
                PURCHASE_FAILED: 'shop:purchase_failed',
                REFUND_REQUESTED: 'shop:refund_requested',
                VIP_PURCHASED: 'shop:vip_purchased',
                VIP_EXPIRED: 'shop:vip_expired'
            }),

            // رویدادهای اجتماعی
            SOCIAL: Object.freeze({
                FRIEND_REQUEST_SENT: 'social:friend_request_sent',
                FRIEND_REQUEST_RECEIVED: 'social:friend_request_received',
                FRIEND_REQUEST_ACCEPTED: 'social:friend_request_accepted',
                FRIEND_REQUEST_REJECTED: 'social:friend_request_rejected',
                FRIEND_ADDED: 'social:friend_added',
                FRIEND_REMOVED: 'social:friend_removed',
                FRIEND_ONLINE: 'social:friend_online',
                FRIEND_OFFLINE: 'social:friend_offline',
                BLOCK_ADDED: 'social:block_added',
                BLOCK_REMOVED: 'social:block_removed',
                INVITE_SENT: 'social:invite_sent',
                INVITE_RECEIVED: 'social:invite_received',
                INVITE_ACCEPTED: 'social:invite_accepted',
                INVITE_DECLINED: 'social:invite_declined'
            }),

            // رویدادهای چت
            CHAT: Object.freeze({
                MESSAGE_SENT: 'chat:message_sent',
                MESSAGE_RECEIVED: 'chat:message_received',
                MESSAGE_DELETED: 'chat:message_deleted',
                MESSAGE_EDITED: 'chat:message_edited',
                USER_MUTED: 'chat:user_muted',
                USER_UNMUTED: 'chat:user_unmuted',
                USER_BLOCKED: 'chat:user_blocked',
                USER_REPORTED: 'chat:user_reported',
                SPAM_DETECTED: 'chat:spam_detected',
                PROFANITY_DETECTED: 'chat:profanity_detected',
                ROOM_CREATED: 'chat:room_created',
                ROOM_JOINED: 'chat:room_joined',
                ROOM_LEFT: 'chat:room_left'
            }),

            // رویدادهای اعلان
            NOTIFICATION: Object.freeze({
                RECEIVED: 'notification:received',
                READ: 'notification:read',
                READ_ALL: 'notification:read_all',
                CLEARED: 'notification:cleared',
                CLICKED: 'notification:clicked',
                PERMISSION_GRANTED: 'notification:permission_granted',
                PERMISSION_DENIED: 'notification:permission_denied'
            }),

            // رویدادهای رتبه‌بندی
            LEADERBOARD: Object.freeze({
                UPDATED: 'leaderboard:updated',
                RANK_CHANGED: 'leaderboard:rank_changed',
                ENTERED_TOP: 'leaderboard:entered_top',
                LEFT_TOP: 'leaderboard:left_top'
            }),

            // رویدادهای ذخیره‌سازی
            STORAGE: Object.freeze({
                SAVED: 'storage:saved',
                LOADED: 'storage:loaded',
                CLEARED: 'storage:cleared',
                ERROR: 'storage:error',
                QUOTA_WARNING: 'storage:quota_warning',
                QUOTA_EXCEEDED: 'storage:quota_exceeded',
                MIGRATION_STARTED: 'storage:migration_started',
                MIGRATION_COMPLETED: 'storage:migration_completed'
            }),

            // رویدادهای صوتی
            AUDIO: Object.freeze({
                PLAY: 'audio:play',
                PAUSE: 'audio:pause',
                STOP: 'audio:stop',
                VOLUME_CHANGED: 'audio:volume_changed',
                MUTE_TOGGLED: 'audio:mute_toggled',
                MUSIC_TOGGLED: 'audio:music_toggled',
                SFX_TOGGLED: 'audio:sfx_toggled',
                ERROR: 'audio:error'
            }),

            // رویدادهای گرافیک
            GRAPHICS: Object.freeze({
                QUALITY_CHANGED: 'graphics:quality_changed',
                PARTICLES_TOGGLED: 'graphics:particles_toggled',
                SHADOWS_TOGGLED: 'graphics:shadows_toggled',
                ANIMATIONS_TOGGLED: 'graphics:animations_toggled'
            }),

            // رویدادهای تحلیل
            ANALYTICS: Object.freeze({
                EVENT_TRACKED: 'analytics:event_tracked',
                SCREEN_VIEW: 'analytics:screen_view',
                BUTTON_CLICK: 'analytics:button_click',
                ERROR_LOGGED: 'analytics:error_logged',
                PERFORMANCE_MEASURED: 'analytics:performance_measured'
            }),

            // رویدادهای امنیت
            SECURITY: Object.freeze({
                LOGIN_ATTEMPT: 'security:login_attempt',
                SUSPICIOUS_ACTIVITY: 'security:suspicious_activity',
                RATE_LIMIT_HIT: 'security:rate_limit_hit',
                VALIDATION_FAILED: 'security:validation_failed',
                ENCRYPTION_ERROR: 'security:encryption_error'
            }),

            // رویدادهای گزارش
            REPORT: Object.freeze({
                SUBMITTED: 'report:submitted',
                RESOLVED: 'report:resolved',
                REJECTED: 'report:rejected'
            })
        });
    }

    // ============================================================
    // بخش ۲: عملیات اصلی
    // ============================================================

    /**
     * ثبت شنونده برای یک رویداد
     * @param {string} event - نام رویداد
     * @param {Function} callback - تابع شنونده
     * @param {Object} options - گزینه‌ها
     * @param {number} options.priority - اولویت (بالاتر = زودتر اجرا)
     * @param {boolean} options.once - آیا فقط یک بار اجرا شود
     * @param {string} options.namespace - namespace
     * @param {boolean} options.async - آیا به صورت async اجرا شود
     * @returns {Function} تابع حذف شنونده
     */
    on(event, callback, options = {}) {
        const {
            priority = 0,
            once = false,
            namespace = null,
            async = false
        } = options;

        // بررسی wildcard
        if (event.includes('*')) {
            return this._addWildcardListener(event, callback, options);
        }

        // بررسی namespace
        if (namespace) {
            return this._addNamespaceListener(event, callback, namespace, options);
        }

        // ایجاد Set اگر وجود ندارد
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        const listeners = this.listeners.get(event);

        // بررسی حداکثر تعداد شنونده
        if (listeners.size >= this.maxListenersPerEvent) {
            console.warn(`⚠️ Max listeners (${this.maxListenersPerEvent}) reached for event: ${event}`);
            return () => {};
        }

        const listener = {
            callback,
            priority,
            once,
            async,
            createdAt: Date.now(),
            callCount: 0,
            lastCallAt: null,
            id: this._generateListenerId()
        };

        listeners.add(listener);

        // مرتب‌سازی بر اساس اولویت
        this._sortListeners(event);

        if (this.debug) {
            console.log(` Registered listener for: ${event} (priority: ${priority}, once: ${once})`);
        }

        // برگرداندن تابع حذف
        return () => this.off(event, callback);
    }

    /**
     * ثبت شنونده یک‌بار مصرف
     * @param {string} event - نام رویداد
     * @param {Function} callback - تابع
     * @param {Object} options - گزینه‌ها
     * @returns {Function} تابع حذف
     */
    once(event, callback, options = {}) {
        return this.on(event, callback, { ...options, once: true });
    }

    /**
     * ثبت شنونده با اولویت بالا
     * @param {string} event - نام رویداد
     * @param {Function} callback - تابع
     * @param {Object} options - گزینه‌ها
     * @returns {Function} تابع حذف
     */
    onHighPriority(event, callback, options = {}) {
        return this.on(event, callback, { ...options, priority: 100 });
    }

    /**
     * ثبت شنونده با اولویت پایین
     * @param {string} event - نام رویداد
     * @param {Function} callback - تابع
     * @param {Object} options - گزینه‌ها
     * @returns {Function} تابع حذف
     */
    onLowPriority(event, callback, options = {}) {
        return this.on(event, callback, { ...options, priority: -100 });
    }

    /**
     * حذف شنونده
     * @param {string} event - نام رویداد
     * @param {Function} callback - تابع
     * @returns {boolean} موفقیت
     */
    off(event, callback) {
        // حذف از شنوندگان عادی
        if (this.listeners.has(event)) {
            const listeners = this.listeners.get(event);
            
            for (const listener of listeners) {
                if (listener.callback === callback) {
                    listeners.delete(listener);
                    
                    if (this.debug) {
                        console.log(`📡 Removed listener for: ${event}`);
                    }
                    
                    return true;
                }
            }
        }

        // حذف از wildcard
        this.wildcardListeners = this.wildcardListeners.filter(
            l => l.pattern !== event || l.callback !== callback
        );

        // حذف از namespace
        for (const [ns, listeners] of this.namespaceListeners) {
            for (const listener of listeners) {
                if (listener.event === event && listener.callback === callback) {
                    listeners.delete(listener);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * حذف تمام شنوندگان یک رویداد
     * @param {string} event - نام رویداد
     * @returns {number} تعداد شنوندگان حذف شده
     */
    offAll(event) {
        let count = 0;

        if (this.listeners.has(event)) {
            count = this.listeners.get(event).size;
            this.listeners.delete(event);
        }

        // حذف wildcard های مرتبط
        const wildcardCount = this.wildcardListeners.length;
        this.wildcardListeners = this.wildcardListeners.filter(l => l.pattern !== event);
        count += wildcardCount - this.wildcardListeners.length;

        if (this.debug) {
            console.log(`📡 Removed all listeners for: ${event} (${count} removed)`);
        }

        return count;
    }

    /**
     * حذف تمام شنوندگان
     * @returns {number} تعداد کل شنوندگان حذف شده
     */
    clear() {
        let count = 0;

        for (const [, listeners] of this.listeners) {
            count += listeners.size;
        }

        count += this.wildcardListeners.length;

        for (const [, listeners] of this.namespaceListeners) {
            count += listeners.size;
        }

        this.listeners.clear();
        this.wildcardListeners = [];
        this.namespaceListeners.clear();

        if (this.debug) {
            console.log(`📡 Cleared all listeners (${count} total)`);
        }

        return count;
    }

    /**
     * انتشار رویداد
     * @param {string} event - نام رویداد
     * @param {*} data - داده
     * @param {Object} options - گزینه‌ها
     * @param {boolean} options.sync - آیا به صورت sync اجرا شود
     * @param {boolean} options.skipHistory - آیا در تاریخچه ثبت نشود
     * @returns {Promise<Array>} نتایج
     */
    async emit(event, data = null, options = {}) {
        const {
            sync = false,
            skipHistory = false
        } = options;

        // اگر pause است، در صف قرار بده
        if (this.isPaused) {
            this.pendingEvents.push({ event, data, options });
            
            if (this.debug) {
                console.log(`️ Event queued (paused): ${event}`);
            }
            
            return [];
        }

        const startTime = performance.now();
        const eventId = ++this.eventCounter;
        const results = [];

        // ثبت در تاریخچه
        if (!skipHistory) {
            this._addToHistory(eventId, event, data);
        }

        // به‌روزرسانی آمار
        this.stats.totalEmitted++;

        // جمع‌آوری تمام شنوندگان
        const allListeners = this._getAllListenersForEvent(event);

        if (this.debug) {
            console.log(`📡 Emitting: ${event} (${allListeners.length} listeners)`);
        }

        // اجرای شنوندگان
        for (const listener of allListeners) {
            try {
                let result;

                if (listener.async || sync === false) {
                    result = await Promise.resolve(listener.callback(data, event));
                } else {
                    result = listener.callback(data, event);
                }

                results.push({
                    listenerId: listener.id,
                    result,
                    success: true
                });

                listener.callCount++;
                listener.lastCallAt = Date.now();
                this.stats.totalHandled++;

                // حذف شنونده یک‌بار مصرف
                if (listener.once) {
                    this.off(event, listener.callback);
                }

            } catch (error) {
                console.error(`❌ Error in listener for ${event}:`, error);
                
                results.push({
                    listenerId: listener.id,
                    error,
                    success: false
                });

                this.stats.totalErrors++;
            }
        }

        // محاسبه زمان
        const duration = performance.now() - startTime;

        // به‌روزرسانی آمار slowest
        if (duration > this.stats.slowestDuration) {
            this.stats.slowestDuration = duration;
            this.stats.slowestEvent = event;
        }

        // به‌روزرسانی آمار namespace
        const namespace = event.split(':')[0];
        if (!this.stats.byNamespace[namespace]) {
            this.stats.byNamespace[namespace] = 0;
        }
        this.stats.byNamespace[namespace]++;

        // محاسبه میانگین شنوندگان
        const totalListeners = Array.from(this.listeners.values())
            .reduce((sum, set) => sum + set.size, 0);
        this.stats.averageListeners = totalListeners / Math.max(1, this.listeners.size);

        return results;
    }

    /**
     * انتشار رویداد به صورت sync
     * @param {string} event - نام رویداد
     * @param {*} data - داده
     * @returns {Array} نتایج
     */
    emitSync(event, data = null) {
        return this.emit(event, data, { sync: true });
    }

    /**
     * انتشار رویداد با تاخیر
     * @param {string} event - نام رویداد
     * @param {*} data - داده
     * @param {number} delay - تاخیر (میلی‌ثانیه)
     * @returns {Promise}
     */
    emitDelayed(event, data = null, delay = 100) {
        return new Promise(resolve => {
            setTimeout(() => {
                this.emit(event, data).then(resolve);
            }, delay);
        });
    }

    /**
     * بررسی وجود شنونده برای یک رویداد
     * @param {string} event - نام رویداد
     * @returns {boolean}
     */
    hasListeners(event) {
        if (this.listeners.has(event) && this.listeners.get(event).size > 0) {
            return true;
        }

        // بررسی wildcard
        const hasWildcard = this.wildcardListeners.some(l => this._matchWildcard(l.pattern, event));

        return hasWildcard;
    }

    /**
     * دریافت تعداد شنوندگان یک رویداد
     * @param {string} event - نام رویداد
     * @returns {number}
     */
    listenerCount(event) {
        let count = 0;

        if (this.listeners.has(event)) {
            count += this.listeners.get(event).size;
        }

        // شمارش wildcard های منطبق
        count += this.wildcardListeners.filter(l => this._matchWildcard(l.pattern, event)).length;

        return count;
    }

    /**
     * دریافت تمام رویدادهای ثبت شده
     * @returns {string[]}
     */
    getEvents() {
        return Array.from(this.listeners.keys());
    }

    // ============================================================
    // بخش ۳: Wildcard و Namespace
    // ============================================================

    /**
     * اضافه کردن شنونده wildcard
     * @param {string} pattern - الگو (مثلاً 'game:*')
     * @param {Function} callback - تابع
     * @param {Object} options - گزینه‌ها
     * @returns {Function} تابع حذف
     * @private
     */
    _addWildcardListener(pattern, callback, options = {}) {
        const listener = {
            pattern,
            callback,
            priority: options.priority || 0,
            once: options.once || false,
            createdAt: Date.now(),
            id: this._generateListenerId()
        };

        this.wildcardListeners.push(listener);

        return () => {
            this.wildcardListeners = this.wildcardListeners.filter(l => l.id !== listener.id);
        };
    }

    /**
     * اضافه کردن شنونده namespace
     * @param {string} event - رویداد
     * @param {Function} callback - تابع
     * @param {string} namespace - namespace
     * @param {Object} options - گزینه‌ها
     * @returns {Function} تابع حذف
     * @private
     */
    _addNamespaceListener(event, callback, namespace, options = {}) {
        if (!this.namespaceListeners.has(namespace)) {
            this.namespaceListeners.set(namespace, new Set());
        }

        const listener = {
            event,
            callback,
            priority: options.priority || 0,
            once: options.once || false,
            createdAt: Date.now(),
            id: this._generateListenerId()
        };

        this.namespaceListeners.get(namespace).add(listener);

        return () => {
            const listeners = this.namespaceListeners.get(namespace);
            if (listeners) {
                for (const l of listeners) {
                    if (l.id === listener.id) {
                        listeners.delete(l);
                        break;
                    }
                }
            }
        };
    }

    /**
     * دریافت تمام شنوندگان یک رویداد (شامل wildcard و namespace)
     * @param {string} event - نام رویداد
     * @returns {Array}
     * @private
     */
    _getAllListenersForEvent(event) {
        const allListeners = [];

        // شنوندگان مستقیم
        if (this.listeners.has(event)) {
            for (const listener of this.listeners.get(event)) {
                allListeners.push(listener);
            }
        }

        // شنوندگان wildcard
        for (const listener of this.wildcardListeners) {
            if (this._matchWildcard(listener.pattern, event)) {
                allListeners.push(listener);
            }
        }

        // شنوندگان namespace
        const namespace = event.split(':')[0];
        if (this.namespaceListeners.has(namespace)) {
            for (const listener of this.namespaceListeners.get(namespace)) {
                if (listener.event === event || listener.event === '*') {
                    allListeners.push(listener);
                }
            }
        }

        // مرتب‌سازی بر اساس اولویت
        allListeners.sort((a, b) => b.priority - a.priority);

        return allListeners;
    }

    /**
     * بررسی تطابق wildcard
     * @param {string} pattern - الگو
     * @param {string} event - رویداد
     * @returns {boolean}
     * @private
     */
    _matchWildcard(pattern, event) {
        if (pattern === '*') return true;
        
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(event);
    }

    /**
     * مرتب‌سازی شنوندگان بر اساس اولویت
     * @param {string} event - نام رویداد
     * @private
     */
    _sortListeners(event) {
        if (!this.listeners.has(event)) return;

        const listeners = Array.from(this.listeners.get(event));
        listeners.sort((a, b) => b.priority - a.priority);

        this.listeners.set(event, new Set(listeners));
    }

    // ============================================================
    // بخش ۴: Pause و Resume
    // ============================================================

    /**
     * Pause کردن رویدادها
     * @returns {void}
     */
    pause() {
        this.isPaused = true;
        
        if (this.debug) {
            console.log('⏸️ EventBus paused');
        }
    }

    /**
     * Resume کردن رویدادها
     * @param {boolean} processPending - آیا رویدادهای در صف پردازش شوند
     * @returns {Promise<void>}
     */
    async resume(processPending = true) {
        this.isPaused = false;
        
        if (this.debug) {
            console.log('▶️ EventBus resumed');
        }

        if (processPending && this.pendingEvents.length > 0) {
            const pending = [...this.pendingEvents];
            this.pendingEvents = [];

            for (const { event, data, options } of pending) {
                await this.emit(event, data, options);
            }
        }
    }

    /**
     * بررسی وضعیت pause
     * @returns {boolean}
     */
    isPausedStatus() {
        return this.isPaused;
    }

    /**
     * دریافت تعداد رویدادهای در صف
     * @returns {number}
     */
    pendingCount() {
        return this.pendingEvents.length;
    }

    // ============================================================
    // بخش ۵: تاریخچه
    // ============================================================

    /**
     * اضافه کردن به تاریخچه
     * @param {number} id - شناسه
     * @param {string} event - رویداد
     * @param {*} data - داده
     * @private
     */
    _addToHistory(id, event, data) {
        this.history.push({
            id,
            event,
            data: this._serializeData(data),
            timestamp: Date.now()
        });

        // محدود کردن اندازه
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * دریافت تاریخچه
     * @param {number} limit - تعداد
     * @param {string} filter - فیلتر رویداد
     * @returns {Array}
     */
    getHistory(limit = 50, filter = null) {
        let history = [...this.history].reverse();

        if (filter) {
            history = history.filter(h => h.event === filter || h.event.includes(filter));
        }

        return history.slice(0, limit);
    }

    /**
     * پاک کردن تاریخچه
     * @returns {void}
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * پاک کردن تاریخچه قدیمی
     * @private
     */
    _cleanupHistory() {
        const oneHourAgo = Date.now() - 3600000;
        this.history = this.history.filter(h => h.timestamp > oneHourAgo);
    }

    /**
     * سریالایز داده برای تاریخچه
     * @param {*} data - داده
     * @returns {*}
     * @private
     */
    _serializeData(data) {
        try {
            if (data === null || data === undefined) return data;
            if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
                return data;
            }
            return JSON.parse(JSON.stringify(data));
        } catch (e) {
            return '[Unserializable]';
        }
    }

    // ============================================================
    // بخش ۶: Performance Monitoring
    // ============================================================

    /**
     * شروع زمان‌سنج
     * @param {string} label - برچسب
     * @returns {void}
     */
    startTimer(label) {
        this.timers.set(label, performance.now());
    }

    /**
     * پایان زمان‌سنج
     * @param {string} label - برچسب
     * @returns {number} مدت زمان (میلی‌ثانیه)
     */
    endTimer(label) {
        if (!this.timers.has(label)) {
            console.warn(`⚠️ Timer not found: ${label}`);
            return 0;
        }

        const start = this.timers.get(label);
        const duration = performance.now() - start;
        this.timers.delete(label);

        return duration;
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            totalListeners: Array.from(this.listeners.values())
                .reduce((sum, set) => sum + set.size, 0),
            totalEvents: this.listeners.size,
            totalWildcardListeners: this.wildcardListeners.length,
            totalNamespaceListeners: Array.from(this.namespaceListeners.values())
                .reduce((sum, set) => sum + set.size, 0),
            historySize: this.history.length,
            pendingCount: this.pendingEvents.length,
            isPaused: this.isPaused
        };
    }

    /**
     * لاگ آمار
     * @returns {void}
     */
    logStats() {
        const stats = this.getStats();
        
        console.log('📊 EventBus Stats:');
        console.log('  Total Events:', stats.totalEvents);
        console.log('  Total Listeners:', stats.totalListeners);
        console.log('  Wildcard Listeners:', stats.totalWildcardListeners);
        console.log('  Namespace Listeners:', stats.totalNamespaceListeners);
        console.log('  Total Emitted:', stats.totalEmitted);
        console.log('  Total Handled:', stats.stats.totalHandled);
        console.log('  Total Errors:', stats.totalErrors);
        console.log('  Average Listeners:', stats.averageListeners.toFixed(2));
        console.log('  Slowest Event:', stats.slowestEvent);
        console.log('  Slowest Duration:', stats.slowestDuration.toFixed(2) + 'ms');
        console.log('  History Size:', stats.historySize);
        console.log('  Pending:', stats.pendingCount);
        console.log('  Paused:', stats.isPaused);
    }

    // ============================================================
    // بخش ۷: توابع کمکی
    // ============================================================

    /**
     * تولید شناسه یکتا برای شنونده
     * @returns {string}
     * @private
     */
    _generateListenerId() {
        return 'listener_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * دریافت شنونده‌ها بر اساس namespace
     * @param {string} namespace - namespace
     * @returns {Array}
     */
    getListenersByNamespace(namespace) {
        if (!this.namespaceListeners.has(namespace)) {
            return [];
        }

        return Array.from(this.namespaceListeners.get(namespace));
    }

    /**
     * حذف تمام شنوندگان یک namespace
     * @param {string} namespace - namespace
     * @returns {number} تعداد حذف شده
     */
    clearNamespace(namespace) {
        if (!this.namespaceListeners.has(namespace)) {
            return 0;
        }

        const count = this.namespaceListeners.get(namespace).size;
        this.namespaceListeners.delete(namespace);

        return count;
    }

    /**
     * بررسی سلامت سیستم
     * @returns {Object}
     */
    healthCheck() {
        const stats = this.getStats();
        
        return {
            healthy: stats.totalErrors < 100,
            memoryUsage: this.history.length * 100 + this.listeners.size * 50,
            performance: stats.slowestDuration < 1000,
            warnings: []
        };
    }

    /**
     * export تمام تنظیمات
     * @returns {Object}
     */
    exportConfig() {
        return {
            maxHistorySize: this.maxHistorySize,
            maxListenersPerEvent: this.maxListenersPerEvent,
            debug: this.debug,
            stats: this.stats,
            events: this.getEvents(),
            listenerCounts: Object.fromEntries(
                Array.from(this.listeners.entries()).map(([k, v]) => [k, v.size])
            )
        };
    }

    /**
     * import تنظیمات
     * @param {Object} config - تنظیمات
     * @returns {void}
     */
    importConfig(config) {
        if (config.maxHistorySize) {
            this.maxHistorySize = config.maxHistorySize;
        }
        
        if (config.maxListenersPerEvent) {
            this.maxListenersPerEvent = config.maxListenersPerEvent;
        }
        
        if (typeof config.debug === 'boolean') {
            this.debug = config.debug;
        }
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const eventBus = new EventBus();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventBus, eventBus, EVENTS: EventBus.EVENTS };
} else {
    window.EventBus = EventBus;
    window.eventBus = eventBus;
    window.EVENTS = EventBus.EVENTS;
}

console.log('✅ EventBus loaded - Total event categories:', Object.keys(EventBus.EVENTS).length);
