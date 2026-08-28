/**
 * ============================================================
 * HOKM MASTER - Notifications Manager
 * سیستم مدیریت اعلان‌های بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم اعلان‌ها است. شامل
 * اعلان‌های دوستی، دعوت بازی، پاداش، مأموریت، لیگ، تورنمنت،
 * رویداد، فروشگاه، سیستمی، نگهداری و به‌روزرسانی. همچنین
 * شامل Push Notifications، Quiet Hours، محدودیت‌های روزانه،
 * و آمار کامل اعلان‌ها.
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

class NotificationsManager {

    constructor() {
        /**
         * اعلان‌ها
         * @type {Array<Object>}
         */
        this.notifications = [];

        /**
         * اعلان‌های خوانده نشده
         * @type {Array<Object>}
         */
        this.unreadNotifications = [];

        /**
         * تنظیمات اعلان‌ها
         * @type {Object}
         */
        this.settings = {
            enabled: true,
            sound: true,
            vibration: true,
            pushEnabled: true,
            quietHours: {
                enabled: false,
                start: 23,
                end: 8
            },
            types: {
                friend_request: true,
                game_invite: true,
                reward: true,
                mission: true,
                league: true,
                tournament: true,
                event: true,
                shop: true,
                system: true,
                maintenance: true,
                update: true
            },
            maxPerDay: 10
        };

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
         * آمار اعلان‌ها
         * @type {Object}
         */
        this.stats = {
            totalReceived: 0,
            totalRead: 0,
            totalClicked: 0,
            totalCleared: 0,
            totalPushSent: 0,
            totalPushFailed: 0,
            todayReceived: 0,
            todayRead: 0,
            lastDailyReset: null
        };

        /**
         * محدودیت‌ها
         * @type {Object}
         */
        this.limits = {
            maxStored: CONFIG.NOTIFICATIONS?.MAX_STORED || 100,
            retentionDays: CONFIG.NOTIFICATIONS?.RETENTION_DAYS || 30,
            pushMaxPerDay: CONFIG.NOTIFICATIONS?.PUSH?.MAX_PER_DAY || 10,
            quietStart: CONFIG.NOTIFICATIONS?.PUSH?.QUIET_HOURS_START || 23,
            quietEnd: CONFIG.NOTIFICATIONS?.PUSH?.QUIET_HOURS_END || 8
        };

        /**
         * آیکون‌های اعلان بر اساس نوع
         * @type {Object}
         */
        this.icons = {
            friend_request: '👥',
            game_invite: '🎮',
            reward: '🎁',
            mission: '',
            league: '🏅',
            tournament: '🏆',
            event: '🎪',
            shop: '',
            system: '⚙️',
            maintenance: '🔧',
            update: '📦'
        };

        /**
         * رنگ‌های اعلان بر اساس نوع
         * @type {Object}
         */
        this.colors = {
            friend_request: '#3b82f6',
            game_invite: '#10b981',
            reward: '#f59e0b',
            mission: '#8b5cf6',
            league: '#ec4899',
            tournament: '#ef4444',
            event: '#06b6d4',
            shop: '#84cc16',
            system: '#6b7280',
            maintenance: '#f97316',
            update: '#6366f1'
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

        // بررسی reset روزانه
        this._checkDailyReset();

        // پاکسازی اعلان‌های قدیمی
        this._cleanupOldNotifications();

        // به‌روزرسانی لیست خوانده نشده
        this._updateUnreadList();

        // درخواست مجوز Push Notification
        if (this.settings.pushEnabled) {
            this._requestPushPermission();
        }

        if (this.debug) {
            console.log('🔔 NotificationsManager initialized');
            console.log('  Total:', this.notifications.length);
            console.log('  Unread:', this.unreadNotifications.length);
        }
    }

    // ============================================================
    // بخش ۱: دریافت اعلان‌ها
    // ============================================================

    /**
     * دریافت تمام اعلان‌ها
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getAllNotifications(options = {}) {
        const {
            type = null,
            read = null,
            limit = 100,
            offset = 0
        } = options;

        let notifications = [...this.notifications];

        if (type) {
            notifications = notifications.filter(n => n.type === type);
        }

        if (read !== null) {
            notifications = notifications.filter(n => n.read === read);
        }

        // مرتب‌سازی بر اساس زمان (جدیدترین اول)
        notifications.sort((a, b) => b.timestamp - a.timestamp);

        return notifications.slice(offset, offset + limit);
    }

    /**
     * دریافت اعلان‌های خوانده نشده
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getUnreadNotifications(options = {}) {
        return this.getAllNotifications({ ...options, read: false });
    }

    /**
     * دریافت اعلان‌های خوانده شده
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getReadNotifications(options = {}) {
        return this.getAllNotifications({ ...options, read: true });
    }

    /**
     * دریافت اعلان بر اساس شناسه
     * @param {string} notificationId - شناسه اعلان
     * @returns {Object|null}
     */
    getNotification(notificationId) {
        return this.notifications.find(n => n.id === notificationId) || null;
    }

    /**
     * دریافت اعلان‌ها بر اساس نوع
     * @param {string} type - نوع اعلان
     * @returns {Array<Object>}
     */
    getNotificationsByType(type) {
        return this.notifications.filter(n => n.type === type);
    }

    /**
     * دریافت تعداد اعلان‌های خوانده نشده
     * @returns {number}
     */
    getUnreadCount() {
        return this.unreadNotifications.length;
    }

    /**
     * دریافت تعداد اعلان‌های خوانده نشده بر اساس نوع
     * @param {string} type - نوع
     * @returns {number}
     */
    getUnreadCountByType(type) {
        return this.unreadNotifications.filter(n => n.type === type).length;
    }

    // ============================================================
    // بخش ۲: ایجاد اعلان
    // ============================================================

    /**
     * ایجاد اعلان جدید
     * @param {Object} notificationData - داده اعلان
     * @returns {Object} نتیجه
     */
    createNotification(notificationData) {
        const {
            type,
            title,
            message,
            data = {},
            priority = 'normal',
            action = null,
            sound = true,
            vibration = true,
            push = true
        } = notificationData;

        // بررسی فعال بودن اعلان
        if (!this.settings.enabled) {
            return {
                success: false,
                error: 'NOTIFICATIONS_DISABLED',
                message: 'اعلان‌ها غیرفعال هستند'
            };
        }

        // بررسی نوع اعلان
        if (!this.settings.types[type]) {
            return {
                success: false,
                error: 'TYPE_DISABLED',
                message: `اعلان‌های نوع ${type} غیرفعال هستند`
            };
        }

        // بررسی Quiet Hours
        if (this._isQuietHours() && type !== 'system' && type !== 'maintenance') {
            return {
                success: false,
                error: 'QUIET_HOURS',
                message: 'در ساعات سکوت هستیم'
            };
        }

        // بررسی محدودیت روزانه
        if (this.stats.todayReceived >= this.limits.pushMaxPerDay && type !== 'system') {
            return {
                success: false,
                error: 'DAILY_LIMIT_REACHED',
                message: `حداکثر ${this.limits.pushMaxPerDay} اعلان در روز`
            };
        }

        // ایجاد اعلان
        const notification = {
            id: Utils.generateUUID(),
            type,
            title,
            message,
            data,
            priority,
            action,
            icon: this.icons[type] || '🔔',
            color: this.colors[type] || '#6b7280',
            read: false,
            clicked: false,
            sound,
            vibration,
            push,
            timestamp: Date.now(),
            readAt: null,
            clickedAt: null,
            expiresAt: this._getExpiryTime(type)
        };

        // اضافه کردن به لیست
        this.notifications.push(notification);
        this.unreadNotifications.push(notification);

        // محدود کردن تعداد
        if (this.notifications.length > this.limits.maxStored) {
            this.notifications = this.notifications.slice(-this.limits.maxStored);
        }

        // به‌روزرسانی آمار
        this.stats.totalReceived++;
        this.stats.todayReceived++;

        // پخش صدا و ویبره
        if (sound && this.settings.sound) {
            this._playNotificationSound();
        }

        if (vibration && this.settings.vibration) {
            this._vibrate();
        }

        // ارسال Push Notification
        if (push && this.settings.pushEnabled && !this._isQuietHours()) {
            this._sendPushNotification(notification);
        }

        // ذخیره
        this._saveData();

        this._emit('notification-received', { notification });

        if (this.debug) {
            console.log(`🔔 Notification received: ${title}`);
        }

        return {
            success: true,
            notification
        };
    }

    /**
     * ایجاد اعلان دوستی
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createFriendRequestNotification(data) {
        return this.createNotification({
            type: 'friend_request',
            title: 'درخواست دوستی',
            message: `${data.username} درخواست دوستی فرستاد`,
            data: { userId: data.userId, username: data.username },
            action: 'open_friends',
            priority: 'high'
        });
    }

    /**
     * ایجاد اعلان دعوت بازی
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createGameInviteNotification(data) {
        return this.createNotification({
            type: 'game_invite',
            title: 'دعوت به بازی',
            message: `${data.username} شما را به بازی دعوت کرد`,
            data: { userId: data.userId, username: data.username, roomId: data.roomId },
            action: 'open_invite',
            priority: 'high'
        });
    }

    /**
     * ایجاد اعلان پاداش
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createRewardNotification(data) {
        return this.createNotification({
            type: 'reward',
            title: 'پاداش جدید',
            message: `شما ${data.coins || 0} سکه و ${data.xp || 0} XP دریافت کردید`,
            data: { coins: data.coins, xp: data.xp, gems: data.gems },
            action: 'open_rewards',
            priority: 'normal'
        });
    }

    /**
     * ایجاد اعلان مأموریت
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createMissionNotification(data) {
        return this.createNotification({
            type: 'mission',
            title: 'مأموریت جدید',
            message: data.message || 'مأموریت جدید در دسترس است',
            data: { missionId: data.missionId },
            action: 'open_missions',
            priority: 'normal'
        });
    }

    /**
     * ایجاد اعلان لیگ
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createLeagueNotification(data) {
        return this.createNotification({
            type: 'league',
            title: data.title || 'به‌روزرسانی لیگ',
            message: data.message,
            data: { tier: data.tier, rank: data.rank },
            action: 'open_league',
            priority: 'high'
        });
    }

    /**
     * ایجاد اعلان تورنمنت
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createTournamentNotification(data) {
        return this.createNotification({
            type: 'tournament',
            title: data.title || 'تورنمنت جدید',
            message: data.message,
            data: { tournamentId: data.tournamentId },
            action: 'open_tournament',
            priority: 'high'
        });
    }

    /**
     * ایجاد اعلان رویداد
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createEventNotification(data) {
        return this.createNotification({
            type: 'event',
            title: data.title || 'رویداد جدید',
            message: data.message,
            data: { eventId: data.eventId },
            action: 'open_event',
            priority: 'normal'
        });
    }

    /**
     * ایجاد اعلان فروشگاه
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createShopNotification(data) {
        return this.createNotification({
            type: 'shop',
            title: data.title || 'پیشنهاد ویژه',
            message: data.message,
            data: { itemId: data.itemId },
            action: 'open_shop',
            priority: 'low'
        });
    }

    /**
     * ایجاد اعلان سیستمی
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createSystemNotification(data) {
        return this.createNotification({
            type: 'system',
            title: data.title || 'اعلان سیستمی',
            message: data.message,
            data: data.data || {},
            action: data.action || null,
            priority: 'high',
            push: true
        });
    }

    /**
     * ایجاد اعلان نگهداری
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createMaintenanceNotification(data) {
        return this.createNotification({
            type: 'maintenance',
            title: 'نگهداری سرور',
            message: data.message || 'سرور در حال به‌روزرسانی است',
            data: { estimatedDuration: data.estimatedDuration },
            action: null,
            priority: 'urgent',
            push: true
        });
    }

    /**
     * ایجاد اعلان به‌روزرسانی
     * @param {Object} data - داده
     * @returns {Object} نتیجه
     */
    createUpdateNotification(data) {
        return this.createNotification({
            type: 'update',
            title: 'به‌روزرسانی جدید',
            message: `نسخه ${data.version} در دسترس است`,
            data: { version: data.version, url: data.url },
            action: 'open_update',
            priority: 'high',
            push: true
        });
    }

    /**
     * دریافت زمان انقضا بر اساس نوع
     * @param {string} type - نوع
     * @returns {number} timestamp
     * @private
     */
    _getExpiryTime(type) {
        const expiryMap = {
            friend_request: 72 * 60 * 60 * 1000, // 72 ساعت
            game_invite: 5 * 60 * 1000, // 5 دقیقه
            reward: 24 * 60 * 60 * 1000, // 24 ساعت
            mission: 24 * 60 * 60 * 1000,
            league: 7 * 24 * 60 * 60 * 1000, // 7 روز
            tournament: 24 * 60 * 60 * 1000,
            event: 7 * 24 * 60 * 60 * 1000,
            shop: 24 * 60 * 60 * 1000,
            system: 30 * 24 * 60 * 60 * 1000, // 30 روز
            maintenance: 24 * 60 * 60 * 1000,
            update: 7 * 24 * 60 * 60 * 1000
        };

        const duration = expiryMap[type] || 24 * 60 * 60 * 1000;
        return Date.now() + duration;
    }

    // ============================================================
    // بخش ۳: مدیریت اعلان‌ها
    // ============================================================

    /**
     * علامت‌گذاری اعلان به عنوان خوانده شده
     * @param {string} notificationId - شناسه اعلان
     * @returns {Object} نتیجه
     */
    markAsRead(notificationId) {
        const notification = this.getNotification(notificationId);
        if (!notification) {
            return {
                success: false,
                error: 'NOTIFICATION_NOT_FOUND',
                message: 'اعلان یافت نشد'
            };
        }

        if (notification.read) {
            return {
                success: false,
                error: 'ALREADY_READ',
                message: 'اعلان قبلاً خوانده شده است'
            };
        }

        notification.read = true;
        notification.readAt = Date.now();

        // حذف از لیست خوانده نشده
        const unreadIndex = this.unreadNotifications.findIndex(n => n.id === notificationId);
        if (unreadIndex !== -1) {
            this.unreadNotifications.splice(unreadIndex, 1);
        }

        // به‌روزرسانی آمار
        this.stats.totalRead++;
        this.stats.todayRead++;

        this._saveData();

        this._emit('notification-read', { notification });

        if (this.debug) {
            console.log(`📖 Notification read: ${notification.title}`);
        }

        return {
            success: true,
            notification
        };
    }

    /**
     * علامت‌گذاری همه اعلان‌ها به عنوان خوانده شده
     * @returns {Object} نتیجه
     */
    markAllAsRead() {
        const unreadCount = this.unreadNotifications.length;

        this.unreadNotifications.forEach(notification => {
            notification.read = true;
            notification.readAt = Date.now();
        });

        this.unreadNotifications = [];

        this.stats.totalRead += unreadCount;
        this.stats.todayRead += unreadCount;

        this._saveData();

        this._emit('all-notifications-read', { count: unreadCount });

        if (this.debug) {
            console.log(`📖 All notifications read: ${unreadCount}`);
        }

        return {
            success: true,
            count: unreadCount
        };
    }

    /**
     * کلیک روی اعلان
     * @param {string} notificationId - شناسه اعلان
     * @returns {Object} نتیجه
     */
    clickNotification(notificationId) {
        const notification = this.getNotification(notificationId);
        if (!notification) {
            return {
                success: false,
                error: 'NOTIFICATION_NOT_FOUND',
                message: 'اعلان یافت نشد'
            };
        }

        // اگر خوانده نشده، علامت‌گذاری کن
        if (!notification.read) {
            this.markAsRead(notificationId);
        }

        notification.clicked = true;
        notification.clickedAt = Date.now();

        this.stats.totalClicked++;

        this._saveData();

        this._emit('notification-clicked', { notification });

        if (this.debug) {
            console.log(`🖱️ Notification clicked: ${notification.title}`);
        }

        return {
            success: true,
            notification,
            action: notification.action,
            data: notification.data
        };
    }

    /**
     * حذف اعلان
     * @param {string} notificationId - شناسه اعلان
     * @returns {Object} نتیجه
     */
    deleteNotification(notificationId) {
        const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
        if (notificationIndex === -1) {
            return {
                success: false,
                error: 'NOTIFICATION_NOT_FOUND',
                message: 'اعلان یافت نشد'
            };
        }

        const notification = this.notifications[notificationIndex];
        this.notifications.splice(notificationIndex, 1);

        // حذف از لیست خوانده نشده
        const unreadIndex = this.unreadNotifications.findIndex(n => n.id === notificationId);
        if (unreadIndex !== -1) {
            this.unreadNotifications.splice(unreadIndex, 1);
        }

        this._saveData();

        this._emit('notification-deleted', { notification });

        if (this.debug) {
            console.log(`🗑️ Notification deleted: ${notification.title}`);
        }

        return {
            success: true,
            notification
        };
    }

    /**
     * حذف اعلان‌های خوانده شده
     * @returns {Object} نتیجه
     */
    deleteReadNotifications() {
        const readNotifications = this.notifications.filter(n => n.read);
        const count = readNotifications.length;

        this.notifications = this.notifications.filter(n => !n.read);

        this.stats.totalCleared += count;

        this._saveData();

        this._emit('read-notifications-deleted', { count });

        if (this.debug) {
            console.log(`🗑️ Read notifications deleted: ${count}`);
        }

        return {
            success: true,
            count
        };
    }

    /**
     * پاک کردن همه اعلان‌ها
     * @returns {Object} نتیجه
     */
    clearAllNotifications() {
        const count = this.notifications.length;

        this.notifications = [];
        this.unreadNotifications = [];

        this.stats.totalCleared += count;

        this._saveData();

        this._emit('all-notifications-cleared', { count });

        if (this.debug) {
            console.log(`🗑️ All notifications cleared: ${count}`);
        }

        return {
            success: true,
            count
        };
    }

    // ============================================================
    // بخش ۴: Push Notifications
    // ============================================================

    /**
     * درخواست مجوز Push Notification
     * @returns {Object} نتیجه
     */
    async requestPushPermission() {
        if (!('Notification' in window)) {
            return {
                success: false,
                error: 'NOT_SUPPORTED',
                message: 'مرورگر شما از Push Notification پشتیبانی نمی‌کند'
            };
        }

        try {
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                this.settings.pushEnabled = true;
                this._saveData();

                this._emit('push-permission-granted');

                if (this.debug) {
                    console.log('✅ Push permission granted');
                }

                return {
                    success: true,
                    permission
                };
            } else {
                this.settings.pushEnabled = false;
                this._saveData();

                this._emit('push-permission-denied');

                if (this.debug) {
                    console.log('❌ Push permission denied');
                }

                return {
                    success: false,
                    error: 'PERMISSION_DENIED',
                    message: 'مجوز Push Notification رد شد',
                    permission
                };
            }
        } catch (error) {
            return {
                success: false,
                error: 'REQUEST_FAILED',
                message: 'درخواست مجوز با خطا مواجه شد'
            };
        }
    }

    /**
     * ارسال Push Notification
     * @param {Object} notification - اعلان
     * @private
     */
    _sendPushNotification(notification) {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        try {
            const pushNotification = new Notification(notification.title, {
                body: notification.message,
                icon: '/icon.png',
                badge: '/badge.png',
                tag: notification.id,
                requireInteraction: notification.priority === 'urgent',
                silent: !notification.sound,
                vibrate: notification.vibration ? [200, 100, 200] : null,
                data: {
                    notificationId: notification.id,
                    type: notification.type,
                    action: notification.action,
                    data: notification.data
                }
            });

            pushNotification.onclick = () => {
                window.focus();
                this.clickNotification(notification.id);
                pushNotification.close();
            };

            this.stats.totalPushSent++;

            if (this.debug) {
                console.log('📤 Push notification sent');
            }
        } catch (error) {
            this.stats.totalPushFailed++;
            console.error('❌ Push notification failed:', error);
        }
    }

    /**
     * بررسی وضعیت مجوز Push
     * @returns {string} وضعیت
     */
    getPushPermissionStatus() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }

    // ============================================================
    // بخش ۵: تنظیمات
    // ============================================================

    /**
     * دریافت تنظیمات
     * @returns {Object}
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * به‌روزرسانی تنظیمات
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateSettings(newSettings) {
        this.settings = {
            ...this.settings,
            ...newSettings
        };

        this._saveData();

        this._emit('settings-updated', { settings: this.settings });

        if (this.debug) {
            console.log('⚙️ Notification settings updated');
        }

        return {
            success: true,
            settings: this.settings
        };
    }

    /**
     * فعال/غیرفعال کردن اعلان‌ها
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setEnabled(enabled) {
        return this.updateSettings({ enabled });
    }

    /**
     * فعال/غیرفعال کردن صدا
     * @param {boolean} sound - آیا صدا فعال باشد
     * @returns {Object} نتیجه
     */
    setSoundEnabled(sound) {
        return this.updateSettings({ sound });
    }

    /**
     * فعال/غیرفعال کردن ویبره
     * @param {boolean} vibration - آیا ویبره فعال باشد
     * @returns {Object} نتیجه
     */
    setVibrationEnabled(vibration) {
        return this.updateSettings({ vibration });
    }

    /**
     * فعال/غیرفعال کردن Push
     * @param {boolean} pushEnabled - آیا Push فعال باشد
     * @returns {Object} نتیجه
     */
    setPushEnabled(pushEnabled) {
        if (pushEnabled) {
            return this.requestPushPermission();
        } else {
            return this.updateSettings({ pushEnabled });
        }
    }

    /**
     * تنظیم Quiet Hours
     * @param {Object} quietHours - تنظیمات Quiet Hours
     * @returns {Object} نتیجه
     */
    setQuietHours(quietHours) {
        return this.updateSettings({
            quietHours: {
                ...this.settings.quietHours,
                ...quietHours
            }
        });
    }

    /**
     * فعال/غیرفعال کردن نوع اعلان
     * @param {string} type - نوع اعلان
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setNotificationTypeEnabled(type, enabled) {
        const validTypes = Object.keys(this.settings.types);
        if (!validTypes.includes(type)) {
            return {
                success: false,
                error: 'INVALID_TYPE',
                message: 'نوع اعلان نامعتبر است'
            };
        }

        return this.updateSettings({
            types: {
                ...this.settings.types,
                [type]: enabled
            }
        });
    }

    /**
     * بررسی Quiet Hours
     * @returns {boolean}
     * @private
     */
    _isQuietHours() {
        if (!this.settings.quietHours.enabled) return false;

        const now = new Date();
        const currentHour = now.getHours();
        const { start, end } = this.settings.quietHours;

        if (start > end) {
            // مثال: 23 تا 8
            return currentHour >= start || currentHour < end;
        } else {
            // مثال: 1 تا 5
            return currentHour >= start && currentHour < end;
        }
    }

    // ============================================================
    // بخش ۶: توابع کمکی
    // ============================================================

    /**
     * به‌روزرسانی لیست خوانده نشده
     * @private
     */
    _updateUnreadList() {
        this.unreadNotifications = this.notifications.filter(n => !n.read);
    }

    /**
     * پخش صدای اعلان
     * @private
     */
    _playNotificationSound() {
        try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {
                // اگر پخش خودکار مسدود شد
            });
        } catch (error) {
            // اگر فایل صوتی وجود نداشت
        }
    }

    /**
     * ویبره
     * @private
     */
    _vibrate() {
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    }

    /**
     * پاکسازی اعلان‌های قدیمی
     * @private
     */
    _cleanupOldNotifications() {
        const cutoff = Date.now() - (this.limits.retentionDays * 24 * 60 * 60 * 1000);

        this.notifications = this.notifications.filter(n => n.timestamp > cutoff);
        this.unreadNotifications = this.unreadNotifications.filter(n => n.timestamp > cutoff);
    }

    /**
     * بررسی reset روزانه
     * @private
     */
    _checkDailyReset() {
        const today = new Date().toDateString();
        const lastReset = this.stats.lastDailyReset;

        if (lastReset !== today) {
            this.stats.todayReceived = 0;
            this.stats.todayRead = 0;
            this.stats.lastDailyReset = today;

            if (this.debug) {
                console.log('🔄 Daily notification stats reset');
            }
        }
    }

    // ============================================================
    // بخش ۷: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            totalNotifications: this.notifications.length,
            unreadCount: this.unreadNotifications.length,
            readCount: this.notifications.length - this.unreadNotifications.length,
            pushPermission: this.getPushPermissionStatus(),
            isQuietHours: this._isQuietHours()
        };
    }

    /**
     * دریافت آمار بر اساس نوع
     * @returns {Object}
     */
    getStatsByType() {
        const stats = {};

        this.notifications.forEach(n => {
            if (!stats[n.type]) {
                stats[n.type] = { total: 0, read: 0, unread: 0 };
            }
            stats[n.type].total++;
            if (n.read) {
                stats[n.type].read++;
            } else {
                stats[n.type].unread++;
            }
        });

        return stats;
    }

    /**
     * دریافت خلاصه اعلان‌ها
     * @returns {Object}
     */
    getSummary() {
        return {
            total: this.notifications.length,
            unread: this.unreadNotifications.length,
            todayReceived: this.stats.todayReceived,
            todayRead: this.stats.todayRead,
            pushEnabled: this.settings.pushEnabled,
            isQuietHours: this._isQuietHours()
        };
    }

    // ============================================================
    // بخش ۸: ذخیره و بارگذاری
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('notifications_list', this.notifications);
            storage.set('notifications_unread', this.unreadNotifications);
            storage.set('notifications_settings', this.settings);
            storage.set('notifications_stats', this.stats);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const notifications = storage.get('notifications_list');
            if (notifications) this.notifications = notifications;

            const unread = storage.get('notifications_unread');
            if (unread) this.unreadNotifications = unread;

            const settings = storage.get('notifications_settings');
            if (settings) this.settings = { ...this.settings, ...settings };

            const stats = storage.get('notifications_stats');
            if (stats) this.stats = { ...this.stats, ...stats };
        }
    }

    // ============================================================
    // بخش ۹: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.notifications = [];
        this.unreadNotifications = [];

        this.settings = {
            enabled: true,
            sound: true,
            vibration: true,
            pushEnabled: true,
            quietHours: {
                enabled: false,
                start: 23,
                end: 8
            },
            types: {
                friend_request: true,
                game_invite: true,
                reward: true,
                mission: true,
                league: true,
                tournament: true,
                event: true,
                shop: true,
                system: true,
                maintenance: true,
                update: true
            },
            maxPerDay: 10
        };

        this.stats = {
            totalReceived: 0,
            totalRead: 0,
            totalClicked: 0,
            totalCleared: 0,
            totalPushSent: 0,
            totalPushFailed: 0,
            todayReceived: 0,
            todayRead: 0,
            lastDailyReset: null
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 NotificationsManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🔔 NotificationsManager Status:');
        console.log('  Total:', stats.totalNotifications);
        console.log('  Unread:', stats.unreadCount);
        console.log('  Read:', stats.readCount);
        console.log('  Today Received:', summary.todayReceived);
        console.log('  Today Read:', summary.todayRead);
        console.log('  Push Enabled:', summary.pushEnabled);
        console.log('  Push Permission:', stats.pushPermission);
        console.log('  Quiet Hours:', stats.isQuietHours);
        console.log('  Total Push Sent:', stats.totalPushSent);
        console.log('  Total Push Failed:', stats.totalPushFailed);
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
                    console.error(` Notifications event listener error:`, error);
                }
            });
        }

        eventBus.emit(`notifications:${event}`, data);
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
const notificationsManager = new NotificationsManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NotificationsManager, notificationsManager };
} else {
    window.NotificationsManager = NotificationsManager;
    window.notificationsManager = notificationsManager;
}

console.log('✅ NotificationsManager loaded');
