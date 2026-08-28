/**
 * ============================================================
 * HOKM MASTER - Chat Manager
 * سیستم مدیریت چت بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم چت است. شامل چت عمومی،
 * خصوصی، اتاق بازی، مدیریت پیام‌ها، فیلتر محتوای نامناسب،
 * محدودیت‌های ارسال، ایموجی و استیکر، تاریخچه چت، و آمار.
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

class ChatManager {

    constructor() {
        /**
         * کانال‌های چت
         * @type {Object}
         */
        this.channels = {
            public: [],
            private: [],
            room: [],
            union: []
        };

        /**
         * کانال فعال فعلی
         * @type {string} 'public' | 'private' | 'room' | 'union'
         */
        this.activeChannel = 'public';

        /**
         * شناسه کاربر فعلی در چت خصوصی
         * @type {string|null}
         */
        this.privateChatWith = null;

        /**
         * شناسه اتاق فعلی
         * @type {string|null}
         */
        this.currentRoomId = null;

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
         * آمار چت
         * @type {Object}
         */
        this.stats = {
            totalMessagesSent: 0,
            totalMessagesReceived: 0,
            totalChannelsUsed: 0,
            totalEmojisSent: 0,
            totalStickersSent: 0,
            totalBlockedMessages: 0,
            totalReports: 0,
            dailyMessagesSent: 0,
            lastDailyReset: null
        };

        /**
         * محدودیت‌های چت
         * @type {Object}
         */
        this.limits = {
            maxMessageLength: CONFIG.CHAT?.MAX_MESSAGE_LENGTH || 250,
            minMessageLength: CONFIG.CHAT?.MIN_MESSAGE_LENGTH || 1,
            messagesPerMinute: CONFIG.CHAT?.RATE_LIMIT?.MESSAGES_PER_MINUTE || 20,
            messagesPerHour: CONFIG.CHAT?.RATE_LIMIT?.MESSAGES_PER_HOUR || 200,
            cooldownAfterSpam: CONFIG.CHAT?.RATE_LIMIT?.COOLDOWN_AFTER_SPAM_SECONDS || 60,
            maxHistoryPerChannel: 500,
            emojiPerMessage: CONFIG.CHAT?.EMOJI?.MAX_PER_MESSAGE || 10,
            profanityFilter: CONFIG.CHAT?.PROFANITY_FILTER?.ENABLED || true,
            autoModerate: CONFIG.CHAT?.PROFANITY_FILTER?.AUTO_MODERATE || true,
            replaceCharacter: CONFIG.CHAT?.PROFANITY_FILTER?.REPLACE_CHARACTER || '*'
        };

        /**
         * تاریخچه ارسال پیام‌ها (برای rate limiting)
         * @type {Array<number>}
         */
        this.messageHistory = [];

        /**
         * زمان cooldown بعد از spam
         * @type {number|null}
         */
        this.spamCooldownUntil = null;

        /**
         * لیست کلمات ممنوعه
         * @type {Array<string>}
         */
        this.bannedWords = this._initBannedWords();

        /**
         * پیام‌های سریع (Quick Messages)
         * @type {Array<string>}
         */
        this.quickMessages = CONFIG.CHAT?.QUICK_MESSAGES || [
            'سلام',
            'خسته نباشید',
            'دستت درد نکنه',
            'ایول!',
            'بازی خوبی بود',
            'دوباره؟',
            'موفق باشی',
            'GG'
        ];

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

        // پاکسازی پیام‌های قدیمی
        this._cleanupOldMessages();

        if (this.debug) {
            console.log(' ChatManager initialized');
            console.log('  Public Messages:', this.channels.public.length);
            console.log('  Private Messages:', this.channels.private.length);
            console.log('  Room Messages:', this.channels.room.length);
        }
    }

    // ============================================================
    // بخش ۱: مدیریت کانال‌ها
    // ============================================================

    /**
     * تغییر کانال فعال
     * @param {string} channel - نام کانال
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    switchChannel(channel, options = {}) {
        const validChannels = ['public', 'private', 'room', 'union'];

        if (!validChannels.includes(channel)) {
            return {
                success: false,
                error: 'INVALID_CHANNEL',
                message: 'کانال نامعتبر است'
            };
        }

        // تنظیمات خاص هر کانال
        if (channel === 'private' && options.userId) {
            this.privateChatWith = options.userId;
        }

        if (channel === 'room' && options.roomId) {
            this.currentRoomId = options.roomId;
        }

        this.activeChannel = channel;
        this.stats.totalChannelsUsed++;

        this._emit('channel-switched', {
            channel,
            options
        });

        if (this.debug) {
            console.log(` Switched to channel: ${channel}`);
        }

        return {
            success: true,
            channel,
            messages: this.getChannelMessages(channel)
        };
    }

    /**
     * دریافت کانال فعال
     * @returns {string}
     */
    getActiveChannel() {
        return this.activeChannel;
    }

    /**
     * دریافت پیام‌های یک کانال
     * @param {string} channel - نام کانال
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getChannelMessages(channel, options = {}) {
        const {
            limit = 100,
            offset = 0,
            before = null,
            after = null
        } = options;

        let messages = [...(this.channels[channel] || [])];

        // فیلتر بر اساس زمان
        if (before) {
            messages = messages.filter(m => m.timestamp < before);
        }

        if (after) {
            messages = messages.filter(m => m.timestamp > after);
        }

        // مرتب‌سازی بر اساس زمان (جدیدترین اول)
        messages.sort((a, b) => b.timestamp - a.timestamp);

        return messages.slice(offset, offset + limit);
    }

    /**
     * دریافت پیام‌های کانال فعال
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getActiveMessages(options = {}) {
        return this.getChannelMessages(this.activeChannel, options);
    }

    /**
     * دریافت پیام‌های خصوصی با یک کاربر
     * @param {string} userId - شناسه کاربر
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getPrivateMessages(userId, options = {}) {
        return this.channels.private.filter(m =>
            (m.senderId === userId && m.receiverId === this._getCurrentUserId()) ||
            (m.senderId === this._getCurrentUserId() && m.receiverId === userId)
        ).sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * دریافت پیام‌های اتاق فعلی
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getRoomMessages(options = {}) {
        if (!this.currentRoomId) return [];

        return this.channels.room.filter(m => m.roomId === this.currentRoomId)
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    // ============================================================
    // بخش : ارسال پیام
    // ============================================================

    /**
     * ارسال پیام
     * @param {string} content - محتوای پیام
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    sendMessage(content, options = {}) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای ارسال پیام باید وارد شوید'
            };
        }

        // بررسی cooldown spam
        if (this.spamCooldownUntil && Date.now() < this.spamCooldownUntil) {
            const remaining = Math.ceil((this.spamCooldownUntil - Date.now()) / 1000);
            return {
                success: false,
                error: 'SPAM_COOLDOWN',
                message: `لطفاً ${remaining} ثانیه صبر کنید`,
                remaining
            };
        }

        // اعتبارسنجی محتوا
        const validation = this._validateMessage(content);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
                message: validation.message
            };
        }

        // بررسی rate limit
        if (!this._checkRateLimit()) {
            return {
                success: false,
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'تعداد پیام‌های شما بیش از حد است. لطفاً صبر کنید'
            };
        }

        // فیلتر محتوای نامناسب
        const filteredContent = this._filterProfanity(content);

        // تشخیص نوع پیام
        const messageType = this._detectMessageType(filteredContent);

        // ایجاد پیام
        const message = {
            id: Utils.generateUUID(),
            senderId: user.id,
            senderUsername: user.username,
            senderAvatar: user.profile?.avatar || 1,
            senderTier: user.profile?.league?.tier || 'bronze',
            content: filteredContent,
            type: messageType,
            channel: this.activeChannel,
            receiverId: this.activeChannel === 'private' ? this.privateChatWith : null,
            roomId: this.activeChannel === 'room' ? this.currentRoomId : null,
            timestamp: Date.now(),
            edited: false,
            deleted: false,
            reactions: [],
            replyTo: options.replyTo || null,
            metadata: {
                device: Utils.isMobile() ? 'mobile' : 'desktop',
                appVersion: CONFIG.APP.VERSION
            }
        };

        // اضافه کردن به کانال
        this._addMessageToChannel(message);

        // به‌روزرسانی آمار
        this.stats.totalMessagesSent++;
        this.stats.dailyMessagesSent++;

        if (messageType === 'emoji') {
            this.stats.totalEmojisSent++;
        } else if (messageType === 'sticker') {
            this.stats.totalStickersSent++;
        }

        // ذخیره
        this._saveData();

        // ارسال به سرور (در production)
        this._sendToServer(message);

        this._emit('message-sent', { message });

        if (this.debug) {
            console.log(`💬 Message sent: ${message.content.substring(0, 30)}...`);
        }

        return {
            success: true,
            message
        };
    }

    /**
     * ارسال پیام سریع
     * @param {string} quickMessage - پیام سریع
     * @returns {Object} نتیجه
     */
    sendQuickMessage(quickMessage) {
        if (!this.quickMessages.includes(quickMessage)) {
            return {
                success: false,
                error: 'INVALID_QUICK_MESSAGE',
                message: 'پیام سریع نامعتبر است'
            };
        }

        return this.sendMessage(quickMessage);
    }

    /**
     * ارسال ایموجی
     * @param {string} emoji - ایموجی
     * @returns {Object} نتیجه
     */
    sendEmoji(emoji) {
        // بررسی محدودیت ایموجی در پیام
        const emojiCount = (emoji.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;

        if (emojiCount > this.limits.emojiPerMessage) {
            return {
                success: false,
                error: 'TOO_MANY_EMOJIS',
                message: `حداکثر ${this.limits.emojiPerMessage} ایموجی در هر پیام`
            };
        }

        return this.sendMessage(emoji);
    }

    /**
     * ارسال استیکر
     * @param {string} stickerId - شناسه استیکر
     * @returns {Object} نتیجه
     */
    sendSticker(stickerId) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای ارسال استیکر باید وارد شوید'
            };
        }

        // بررسی مالکیت استیکر
        const ownedStickers = user.profile?.inventory?.stickers || [];
        if (!ownedStickers.includes(stickerId)) {
            return {
                success: false,
                error: 'STICKER_NOT_OWNED',
                message: 'شما این استیکر را ندارید'
            };
        }

        const message = {
            id: Utils.generateUUID(),
            senderId: user.id,
            senderUsername: user.username,
            senderAvatar: user.profile?.avatar || 1,
            content: `sticker:${stickerId}`,
            type: 'sticker',
            channel: this.activeChannel,
            stickerId,
            timestamp: Date.now(),
            edited: false,
            deleted: false,
            reactions: []
        };

        this._addMessageToChannel(message);
        this.stats.totalMessagesSent++;
        this.stats.totalStickersSent++;

        this._saveData();
        this._sendToServer(message);

        this._emit('sticker-sent', { message });

        return {
            success: true,
            message
        };
    }

    // ============================================================
    // بخش ۳: مدیریت پیام‌ها
    // ============================================================

    /**
     * ویرایش پیام
     * @param {string} messageId - شناسه پیام
     * @param {string} newContent - محتوای جدید
     * @returns {Object} نتیجه
     */
    editMessage(messageId, newContent) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای ویرایش باید وارد شوید'
            };
        }

        const message = this._findMessage(messageId);
        if (!message) {
            return {
                success: false,
                error: 'MESSAGE_NOT_FOUND',
                message: 'پیام یافت نشد'
            };
        }

        if (message.senderId !== user.id) {
            return {
                success: false,
                error: 'NOT_OWNER',
                message: 'شما مالک این پیام نیستید'
            };
        }

        // بررسی محدودیت زمان ویرایش (5 دقیقه)
        const timeSinceSent = Date.now() - message.timestamp;
        if (timeSinceSent > 5 * 60 * 1000) {
            return {
                success: false,
                error: 'EDIT_TIME_EXPIRED',
                message: 'زمان ویرایش به پایان رسیده است'
            };
        }

        // اعتبارسنجی محتوای جدید
        const validation = this._validateMessage(newContent);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
                message: validation.message
            };
        }

        const oldContent = message.content;
        message.content = this._filterProfanity(newContent);
        message.edited = true;
        message.editedAt = Date.now();

        this._saveData();
        this._sendToServer({ type: 'edit', messageId, newContent: message.content });

        this._emit('message-edited', {
            message,
            oldContent
        });

        if (this.debug) {
            console.log(`✏️ Message edited: ${messageId}`);
        }

        return {
            success: true,
            message
        };
    }

    /**
     * حذف پیام
     * @param {string} messageId - شناسه پیام
     * @returns {Object} نتیجه
     */
    deleteMessage(messageId) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای حذف باید وارد شوید'
            };
        }

        const message = this._findMessage(messageId);
        if (!message) {
            return {
                success: false,
                error: 'MESSAGE_NOT_FOUND',
                message: 'پیام یافت نشد'
            };
        }

        // فقط صاحب پیام یا ادمین می‌تواند حذف کند
        if (message.senderId !== user.id && user.role !== 'admin') {
            return {
                success: false,
                error: 'NOT_AUTHORIZED',
                message: 'شما اجازه حذف این پیام را ندارید'
            };
        }

        message.deleted = true;
        message.deletedAt = Date.now();
        message.content = '[پیام حذف شده]';

        this._saveData();
        this._sendToServer({ type: 'delete', messageId });

        this._emit('message-deleted', { message });

        if (this.debug) {
            console.log(`🗑️ Message deleted: ${messageId}`);
        }

        return {
            success: true,
            message
        };
    }

    /**
     * واکنش به پیام
     * @param {string} messageId - شناسه پیام
     * @param {string} emoji - ایموجی واکنش
     * @returns {Object} نتیجه
     */
    reactToMessage(messageId, emoji) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای واکنش باید وارد شوید'
            };
        }

        const message = this._findMessage(messageId);
        if (!message) {
            return {
                success: false,
                error: 'MESSAGE_NOT_FOUND',
                message: 'پیام یافت نشد'
            };
        }

        // بررسی واکنش قبلی
        const existingReaction = message.reactions.find(r =>
            r.userId === user.id && r.emoji === emoji
        );

        if (existingReaction) {
            // حذف واکنش
            message.reactions = message.reactions.filter(r =>
                !(r.userId === user.id && r.emoji === emoji)
            );
        } else {
            // اضافه کردن واکنش
            message.reactions.push({
                userId: user.id,
                username: user.username,
                emoji,
                timestamp: Date.now()
            });
        }

        this._saveData();

        this._emit('message-reacted', {
            message,
            emoji,
            action: existingReaction ? 'removed' : 'added'
        });

        return {
            success: true,
            message
        };
    }

    /**
     * ریپلای به پیام
     * @param {string} messageId - شناسه پیام
     * @param {string} content - محتوای ریپلای
     * @returns {Object} نتیجه
     */
    replyToMessage(messageId, content) {
        const originalMessage = this._findMessage(messageId);
        if (!originalMessage) {
            return {
                success: false,
                error: 'MESSAGE_NOT_FOUND',
                message: 'پیام یافت نشد'
            };
        }

        return this.sendMessage(content, { replyTo: messageId });
    }

    // ============================================================
    // بخش ۴: اعتبارسنجی و فیلتر
    // ============================================================

    /**
     * اعتبارسنجی پیام
     * @param {string} content - محتوا
     * @returns {Object} نتیجه
     * @private
     */
    _validateMessage(content) {
        if (!content || typeof content !== 'string') {
            return {
                valid: false,
                error: 'INVALID_CONTENT',
                message: 'محتوا نامعتبر است'
            };
        }

        const trimmed = content.trim();

        if (trimmed.length < this.limits.minMessageLength) {
            return {
                valid: false,
                error: 'TOO_SHORT',
                message: `پیام باید حداقل ${this.limits.minMessageLength} کاراکتر باشد`
            };
        }

        if (trimmed.length > this.limits.maxMessageLength) {
            return {
                valid: false,
                error: 'TOO_LONG',
                message: `پیام نباید بیشتر از ${this.limits.maxMessageLength} کاراکتر باشد`
            };
        }

        return { valid: true };
    }

    /**
     * فیلتر محتوای نامناسب
     * @param {string} content - محتوا
     * @returns {string} محتوای فیلتر شده
     * @private
     */
    _filterProfanity(content) {
        if (!this.limits.profanityFilter) return content;

        let filtered = content;
        const replaceChar = this.limits.replaceCharacter;

        this.bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            const replacement = replaceChar.repeat(word.length);
            filtered = filtered.replace(regex, replacement);
        });

        return filtered;
    }

    /**
     * تشخیص نوع پیام
     * @param {string} content - محتوا
     * @returns {string} نوع پیام
     * @private
     */
    _detectMessageType(content) {
        // فقط ایموجی
        const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+$/u;
        if (emojiRegex.test(content.trim())) {
            return 'emoji';
        }

        // لینک
        const urlRegex = /https?:\/\/[^\s]+/;
        if (urlRegex.test(content)) {
            return 'link';
        }

        // متن ساده
        return 'text';
    }

    /**
     * بررسی rate limit
     * @returns {boolean}
     * @private
     */
    _checkRateLimit() {
        const now = Date.now();

        // پاکسازی تاریخچه قدیمی (بیشتر از 1 ساعت)
        this.messageHistory = this.messageHistory.filter(t => now - t < 3600000);

        // بررسی محدودیت دقیقه‌ای
        const messagesLastMinute = this.messageHistory.filter(t => now - t < 60000).length;
        if (messagesLastMinute >= this.limits.messagesPerMinute) {
            this.spamCooldownUntil = now + (this.limits.cooldownAfterSpam * 1000);
            return false;
        }

        // بررسی محدودیت ساعتی
        if (this.messageHistory.length >= this.limits.messagesPerHour) {
            this.spamCooldownUntil = now + (this.limits.cooldownAfterSpam * 1000);
            return false;
        }

        // اضافه کردن به تاریخچه
        this.messageHistory.push(now);

        return true;
    }

    /**
     * مقداردهی اولیه کلمات ممنوعه
     * @returns {Array<string>}
     * @private
     */
    _initBannedWords() {
        // در production از سرور دریافت می‌شود
        return [
            'کلمه_ممنوعه_1',
            'کلمه_ممنوعه_2'
        ];
    }

    // ============================================================
    // بخش ۵: دریافت پیام‌ها از سرور
    // ============================================================

    /**
     * دریافت پیام جدید از سرور
     * @param {Object} message - پیام
     * @returns {void}
     */
    handleIncomingMessage(message) {
        if (!message || !message.id) return;

        // بررسی تکراری نبودن
        const exists = this.channels[message.channel || 'public'].some(m => m.id === message.id);
        if (exists) return;

        // اضافه کردن به کانال
        this._addMessageToChannel(message);

        this.stats.totalMessagesReceived++;

        this._emit('message-received', { message });

        if (this.debug) {
            console.log(`📥 Message received: ${message.content?.substring(0, 30)}...`);
        }
    }

    /**
     * به‌روزرسانی پیام از سرور
     * @param {Object} update - به‌روزرسانی
     * @returns {void}
     */
    handleMessageUpdate(update) {
        const { messageId, type, data } = update;
        const message = this._findMessage(messageId);

        if (!message) return;

        if (type === 'edit') {
            message.content = data.newContent;
            message.edited = true;
            message.editedAt = Date.now();
            this._emit('message-edited-remote', { message });
        } else if (type === 'delete') {
            message.deleted = true;
            message.deletedAt = Date.now();
            message.content = '[پیام حذف شده]';
            this._emit('message-deleted-remote', { message });
        } else if (type === 'react') {
            message.reactions = data.reactions;
            this._emit('message-reacted-remote', { message });
        }
    }

    // ============================================================
    // بخش ۶: توابع کمکی
    // ============================================================

    /**
     * اضافه کردن پیام به کانال
     * @param {Object} message - پیام
     * @private
     */
    _addMessageToChannel(message) {
        const channel = message.channel || this.activeChannel;

        if (!this.channels[channel]) {
            this.channels[channel] = [];
        }

        this.channels[channel].push(message);

        // محدود کردن تعداد پیام‌ها
        if (this.channels[channel].length > this.limits.maxHistoryPerChannel) {
            this.channels[channel] = this.channels[channel].slice(-this.limits.maxHistoryPerChannel);
        }
    }

    /**
     * پیدا کردن پیام
     * @param {string} messageId - شناسه پیام
     * @returns {Object|null}
     * @private
     */
    _findMessage(messageId) {
        for (const channel of Object.values(this.channels)) {
            const message = channel.find(m => m.id === messageId);
            if (message) return message;
        }
        return null;
    }

    /**
     * دریافت شناسه کاربر فعلی
     * @returns {string|null}
     * @private
     */
    _getCurrentUserId() {
        return authManager?.getCurrentUser()?.id || null;
    }

    /**
     * ارسال به سرور
     * @param {Object} data - داده
     * @private
     */
    _sendToServer(data) {
        if (typeof wsManager !== 'undefined' && wsManager.isConnected) {
            wsManager.send('chat', data);
        }
    }

    /**
     * پاکسازی پیام‌های قدیمی
     * @private
     */
    _cleanupOldMessages() {
        const retentionDays = CONFIG.CHAT?.RETENTION_DAYS || 30;
        const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

        Object.keys(this.channels).forEach(channel => {
            this.channels[channel] = this.channels[channel].filter(m => m.timestamp > cutoff);
        });
    }

    /**
     * بررسی reset روزانه
     * @private
     */
    _checkDailyReset() {
        const today = new Date().toDateString();
        const lastReset = this.stats.lastDailyReset;

        if (lastReset !== today) {
            this.stats.dailyMessagesSent = 0;
            this.stats.lastDailyReset = today;
            this.messageHistory = [];
            this.spamCooldownUntil = null;

            if (this.debug) {
                console.log('🔄 Daily chat stats reset');
            }
        }
    }

    // ============================================================
    // بخش ۷: آمار و تاریخچه
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            channels: {
                public: this.channels.public.length,
                private: this.channels.private.length,
                room: this.channels.room.length,
                union: this.channels.union.length
            },
            activeChannel: this.activeChannel,
            limits: this.limits
        };
    }

    /**
     * دریافت خلاصه چت
     * @returns {Object}
     */
    getChatSummary() {
        return {
            totalMessages: this.stats.totalMessagesSent,
            dailyMessages: this.stats.dailyMessagesSent,
            activeChannel: this.activeChannel,
            unreadCounts: {
                public: this._getUnreadCount('public'),
                private: this._getUnreadCount('private'),
                room: this._getUnreadCount('room')
            }
        };
    }

    /**
     * دریافت تعداد پیام‌های خوانده نشده
     * @param {string} channel - کانال
     * @returns {number}
     * @private
     */
    _getUnreadCount(channel) {
        const lastRead = storage?.get(`chat_last_read_${channel}`) || 0;
        return this.channels[channel].filter(m => m.timestamp > lastRead).length;
    }

    /**
     * علامت‌گذاری کانال به عنوان خوانده شده
     * @param {string} channel - کانال
     * @returns {void}
     */
    markChannelAsRead(channel) {
        const lastMessage = this.channels[channel]?.[this.channels[channel].length - 1];
        if (lastMessage && storage) {
            storage.set(`chat_last_read_${channel}`, lastMessage.timestamp);
        }

        this._emit('channel-marked-read', { channel });
    }

    // ============================================================
    // بخش : ذخیره و بارگذاری
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('chat_channels', this.channels);
            storage.set('chat_stats', this.stats);
            storage.set('chat_message_history', this.messageHistory);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const channels = storage.get('chat_channels');
            if (channels) this.channels = channels;

            const stats = storage.get('chat_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            const history = storage.get('chat_message_history');
            if (history) this.messageHistory = history;
        }
    }

    // ============================================================
    // بخش ۹: کنترل‌ها
    // ============================================================

    /**
     * پاک کردن تاریخچه یک کانال
     * @param {string} channel - کانال
     * @returns {Object} نتیجه
     */
    clearChannelHistory(channel) {
        const user = authManager?.getCurrentUser();
        if (!user || user.role !== 'admin') {
            return {
                success: false,
                error: 'NOT_AUTHORIZED',
                message: 'فقط ادمین می‌تواند تاریخچه را پاک کند'
            };
        }

        const count = this.channels[channel]?.length || 0;
        this.channels[channel] = [];

        this._saveData();

        this._emit('channel-cleared', { channel, count });

        return {
            success: true,
            clearedCount: count
        };
    }

    /**
     * ریست کامل
     */
    reset() {
        this.channels = {
            public: [],
            private: [],
            room: [],
            union: []
        };

        this.activeChannel = 'public';
        this.privateChatWith = null;
        this.currentRoomId = null;
        this.messageHistory = [];
        this.spamCooldownUntil = null;

        this.stats = {
            totalMessagesSent: 0,
            totalMessagesReceived: 0,
            totalChannelsUsed: 0,
            totalEmojisSent: 0,
            totalStickersSent: 0,
            totalBlockedMessages: 0,
            totalReports: 0,
            dailyMessagesSent: 0,
            lastDailyReset: null
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 ChatManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getChatSummary();

        console.log('💬 ChatManager Status:');
        console.log('  Active Channel:', stats.activeChannel);
        console.log('  Public Messages:', stats.channels.public);
        console.log('  Private Messages:', stats.channels.private);
        console.log('  Room Messages:', stats.channels.room);
        console.log('  Total Sent:', stats.totalMessagesSent);
        console.log('  Daily Sent:', stats.dailyMessagesSent);
        console.log('  Emojis:', stats.totalEmojisSent);
        console.log('  Stickers:', stats.totalStickersSent);
        console.log('  Blocked:', stats.totalBlockedMessages);
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
                    console.error(`❌ Chat event listener error:`, error);
                }
            });
        }

        eventBus.emit(`chat:${event}`, data);
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
const chatManager = new ChatManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChatManager, chatManager };
} else {
    window.ChatManager = ChatManager;
    window.chatManager = chatManager;
}

console.log('✅ ChatManager loaded');
