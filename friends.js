/**
 * ============================================================
 * HOKM MASTER - Friends Manager
 * سیستم مدیریت دوستان بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم دوستان است. شامل لیست
 * دوستان، درخواست‌های دوستی، جستجوی بازیکنان، مسدود کردن،
 * دعوت به بازی، نمایش وضعیت آنلاین/آفلاین، و آمار دوستان.
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

class FriendsManager {

    constructor() {
        /**
         * لیست دوستان بازیکن فعلی
         * @type {Array<Object>}
         */
        this.friends = [];

        /**
         * درخواست‌های دریافتی
         * @type {Array<Object>}
         */
        this.incomingRequests = [];

        /**
         * درخواست‌های ارسالی
         * @type {Array<Object>}
         */
        this.outgoingRequests = [];

        /**
         * لیست بازیکنان مسدود شده
         * @type {Array<Object>}
         */
        this.blockedList = [];

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
         * آمار دوستان
         * @type {Object}
         */
        this.stats = {
            totalFriends: 0,
            totalRequestsSent: 0,
            totalRequestsReceived: 0,
            totalRequestsAccepted: 0,
            totalRequestsRejected: 0,
            totalBlocked: 0,
            onlineFriends: 0,
            offlineFriends: 0,
            favoriteFriends: 0
        };

        /**
         * محدودیت‌های سیستم دوستان
         * @type {Object}
         */
        this.limits = {
            maxFriends: CONFIG.FRIENDS?.MAX_FRIENDS || 100,
            maxPendingRequests: CONFIG.FRIENDS?.MAX_PENDING_REQUESTS || 20,
            maxBlocked: CONFIG.FRIENDS?.MAX_BLOCKED || 50,
            requestExpiryHours: CONFIG.FRIENDS?.REQUEST_EXPIRY_HOURS || 72,
            inviteCooldownSeconds: CONFIG.FRIENDS?.INVITE_COOLDOWN_SECONDS || 300,
            searchMinLength: CONFIG.FRIENDS?.SEARCH_MIN_LENGTH || 3,
            searchMaxResults: CONFIG.FRIENDS?.SEARCH_MAX_RESULTS || 20
        };

        /**
         * زمان آخرین دعوت به هر دوست
         * @type {Object} { friendId: timestamp }
         */
        this.lastInviteTimes = {};

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

        // بررسی انقضای درخواست‌ها
        this._checkRequestExpiry();

        if (this.debug) {
            console.log('👥 FriendsManager initialized');
            console.log('  Friends:', this.friends.length);
            console.log('  Incoming Requests:', this.incomingRequests.length);
            console.log('  Outgoing Requests:', this.outgoingRequests.length);
            console.log('  Blocked:', this.blockedList.length);
        }
    }

    // ============================================================
    // بخش : مدیریت دوستان
    // ============================================================

    /**
     * دریافت لیست دوستان
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getFriends(options = {}) {
        const {
            status = null,
            sortBy = 'username',
            limit = 100,
            offset = 0
        } = options;

        let friends = [...this.friends];

        if (status) {
            friends = friends.filter(f => f.status === status);
        }

        // مرتب‌سازی
        friends.sort((a, b) => {
            if (sortBy === 'username') return a.username.localeCompare(b.username);
            if (sortBy === 'rating') return b.rating - a.rating;
            if (sortBy === 'lastOnline') return b.lastOnline - a.lastOnline;
            if (sortBy === 'addedAt') return b.addedAt - a.addedAt;
            return 0;
        });

        return friends.slice(offset, offset + limit);
    }

    /**
     * دریافت دوستان آنلاین
     * @returns {Array<Object>}
     */
    getOnlineFriends() {
        return this.friends.filter(f => f.status === 'online');
    }

    /**
     * دریافت دوستان آفلاین
     * @returns {Array<Object>}
     */
    getOfflineFriends() {
        return this.friends.filter(f => f.status === 'offline');
    }

    /**
     * دریافت دوستان مورد علاقه
     * @returns {Array<Object>}
     */
    getFavoriteFriends() {
        return this.friends.filter(f => f.isFavorite);
    }

    /**
     * دریافت اطلاعات یک دوست
     * @param {string} friendId - شناسه دوست
     * @returns {Object|null}
     */
    getFriend(friendId) {
        return this.friends.find(f => f.id === friendId) || null;
    }

    /**
     * جستجو در لیست دوستان
     * @param {string} query - عبارت جستجو
     * @returns {Array<Object>}
     */
    searchFriends(query) {
        if (!query || query.length < this.limits.searchMinLength) {
            return [];
        }

        const lowerQuery = query.toLowerCase();

        return this.friends.filter(f =>
            f.username.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * افزودن به لیست مورد علاقه
     * @param {string} friendId - شناسه دوست
     * @returns {Object} نتیجه
     */
    addFavorite(friendId) {
        const friend = this.getFriend(friendId);
        if (!friend) {
            return {
                success: false,
                error: 'FRIEND_NOT_FOUND',
                message: 'دوست یافت نشد'
            };
        }

        friend.isFavorite = true;
        friend.updatedAt = Date.now();

        this._updateStats();
        this._saveData();

        this._emit('friend-favorited', { friend });

        if (this.debug) {
            console.log(`⭐ Friend favorited: ${friend.username}`);
        }

        return {
            success: true,
            friend
        };
    }

    /**
     * حذف از لیست مورد علاقه
     * @param {string} friendId - شناسه دوست
     * @returns {Object} نتیجه
     */
    removeFavorite(friendId) {
        const friend = this.getFriend(friendId);
        if (!friend) {
            return {
                success: false,
                error: 'FRIEND_NOT_FOUND',
                message: 'دوست یافت نشد'
            };
        }

        friend.isFavorite = false;
        friend.updatedAt = Date.now();

        this._updateStats();
        this._saveData();

        this._emit('friend-unfavorited', { friend });

        return {
            success: true,
            friend
        };
    }

    /**
     * حذف دوست
     * @param {string} friendId - شناسه دوست
     * @returns {Object} نتیجه
     */
    removeFriend(friendId) {
        const friendIndex = this.friends.findIndex(f => f.id === friendId);
        if (friendIndex === -1) {
            return {
                success: false,
                error: 'FRIEND_NOT_FOUND',
                message: 'دوست یافت نشد'
            };
        }

        const removedFriend = this.friends[friendIndex];
        this.friends.splice(friendIndex, 1);

        this._updateStats();
        this._saveData();

        this._emit('friend-removed', { friend: removedFriend });

        if (this.debug) {
            console.log(`❌ Friend removed: ${removedFriend.username}`);
        }

        return {
            success: true,
            friend: removedFriend
        };
    }

    // ============================================================
    // بخش : درخواست‌های دوستی
    // ============================================================

    /**
     * ارسال درخواست دوستی
     * @param {string} targetId - شناسه بازیکن هدف
     * @returns {Object} نتیجه
     */
    sendFriendRequest(targetId) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای ارسال درخواست باید وارد شوید'
            };
        }

        if (targetId === user.id) {
            return {
                success: false,
                error: 'SELF_REQUEST',
                message: 'نمی‌توانید به خودتان درخواست بفرستید'
            };
        }

        // بررسی تکراری نبودن
        if (this.friends.some(f => f.id === targetId)) {
            return {
                success: false,
                error: 'ALREADY_FRIENDS',
                message: 'شما قبلاً با این کاربر دوست هستید'
            };
        }

        if (this.outgoingRequests.some(r => r.targetId === targetId)) {
            return {
                success: false,
                error: 'REQUEST_ALREADY_SENT',
                message: 'شما قبلاً درخواست فرستاده‌اید'
            };
        }

        if (this.incomingRequests.some(r => r.senderId === targetId)) {
            return {
                success: false,
                error: 'INCOMING_REQUEST_EXISTS',
                message: 'این کاربر به شما درخواست فرستاده است'
            };
        }

        // بررسی مسدود نبودن
        if (this.blockedList.some(b => b.id === targetId)) {
            return {
                success: false,
                error: 'USER_BLOCKED',
                message: 'شما این کاربر را مسدود کرده‌اید'
            };
        }

        // بررسی محدودیت
        if (this.outgoingRequests.length >= this.limits.maxPendingRequests) {
            return {
                success: false,
                error: 'MAX_REQUESTS_REACHED',
                message: `حداکثر ${this.limits.maxPendingRequests} درخواست در انتظار`
            };
        }

        const request = {
            id: Utils.generateUUID(),
            senderId: user.id,
            senderUsername: user.username,
            senderAvatar: user.profile?.avatar || 1,
            targetId,
            targetUsername: this._getUsernameById(targetId),
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.limits.requestExpiryHours * 60 * 60 * 1000)
        };

        this.outgoingRequests.push(request);
        this.stats.totalRequestsSent++;

        this._saveData();

        this._emit('friend-request-sent', { request });

        if (this.debug) {
            console.log(`📨 Friend request sent to: ${request.targetUsername}`);
        }

        return {
            success: true,
            request
        };
    }

    /**
     * دریافت درخواست‌های دریافتی
     * @returns {Array<Object>}
     */
    getIncomingRequests() {
        return [...this.incomingRequests];
    }

    /**
     * دریافت درخواست‌های ارسالی
     * @returns {Array<Object>}
     */
    getOutgoingRequests() {
        return [...this.outgoingRequests];
    }

    /**
     * قبول درخواست دوستی
     * @param {string} requestId - شناسه درخواست
     * @returns {Object} نتیجه
     */
    acceptFriendRequest(requestId) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای قبول درخواست باید وارد شوید'
            };
        }

        const requestIndex = this.incomingRequests.findIndex(r => r.id === requestId);
        if (requestIndex === -1) {
            return {
                success: false,
                error: 'REQUEST_NOT_FOUND',
                message: 'درخواست یافت نشد'
            };
        }

        const request = this.incomingRequests[requestIndex];

        // بررسی انقضا
        if (Date.now() > request.expiresAt) {
            this.incomingRequests.splice(requestIndex, 1);
            return {
                success: false,
                error: 'REQUEST_EXPIRED',
                message: 'درخواست منقضی شده است'
            };
        }

        // بررسی محدودیت دوستان
        if (this.friends.length >= this.limits.maxFriends) {
            return {
                success: false,
                error: 'MAX_FRIENDS_REACHED',
                message: `حداکثر ${this.limits.maxFriends} دوست`
            };
        }

        // اضافه کردن به لیست دوستان
        const newFriend = {
            id: request.senderId,
            username: request.senderUsername,
            avatar: request.senderAvatar,
            rating: 1000,
            tier: 'bronze',
            status: 'offline',
            isFavorite: false,
            lastOnline: Date.now(),
            addedAt: Date.now(),
            updatedAt: Date.now()
        };

        this.friends.push(newFriend);

        // حذف از درخواست‌ها
        this.incomingRequests.splice(requestIndex, 1);

        // حذف درخواست ارسالی متناظر (اگر وجود دارد)
        const outgoingIndex = this.outgoingRequests.findIndex(r => 
            r.senderId === request.senderId && r.targetId === user.id
        );
        if (outgoingIndex !== -1) {
            this.outgoingRequests.splice(outgoingIndex, 1);
        }

        this.stats.totalRequestsAccepted++;
        this._updateStats();
        this._saveData();

        this._emit('friend-request-accepted', {
            request,
            friend: newFriend
        });

        if (this.debug) {
            console.log(`✅ Friend request accepted: ${newFriend.username}`);
        }

        return {
            success: true,
            friend: newFriend
        };
    }

    /**
     * رد درخواست دوستی
     * @param {string} requestId - شناسه درخواست
     * @returns {Object} نتیجه
     */
    rejectFriendRequest(requestId) {
        const requestIndex = this.incomingRequests.findIndex(r => r.id === requestId);
        if (requestIndex === -1) {
            return {
                success: false,
                error: 'REQUEST_NOT_FOUND',
                message: 'درخواست یافت نشد'
            };
        }

        const request = this.incomingRequests[requestIndex];
        this.incomingRequests.splice(requestIndex, 1);

        this.stats.totalRequestsRejected++;
        this._saveData();

        this._emit('friend-request-rejected', { request });

        if (this.debug) {
            console.log(` Friend request rejected: ${request.senderUsername}`);
        }

        return {
            success: true,
            request
        };
    }

    /**
     * لغو درخواست ارسالی
     * @param {string} requestId - شناسه درخواست
     * @returns {Object} نتیجه
     */
    cancelFriendRequest(requestId) {
        const requestIndex = this.outgoingRequests.findIndex(r => r.id === requestId);
        if (requestIndex === -1) {
            return {
                success: false,
                error: 'REQUEST_NOT_FOUND',
                message: 'درخواست یافت نشد'
            };
        }

        const request = this.outgoingRequests[requestIndex];
        this.outgoingRequests.splice(requestIndex, 1);

        this._saveData();

        this._emit('friend-request-cancelled', { request });

        return {
            success: true,
            request
        };
    }

    /**
     * بررسی انقضای درخواست‌ها
     * @private
     */
    _checkRequestExpiry() {
        const now = Date.now();

        this.incomingRequests = this.incomingRequests.filter(r => {
            if (now > r.expiresAt) {
                this._emit('friend-request-expired', { request: r });
                return false;
            }
            return true;
        });

        this.outgoingRequests = this.outgoingRequests.filter(r => {
            if (now > r.expiresAt) {
                this._emit('friend-request-expired', { request: r });
                return false;
            }
            return true;
        });
    }

    // ============================================================
    // بخش ۳: جستجوی بازیکنان
    // ============================================================

    /**
     * جستجوی بازیکنان
     * @param {string} query - عبارت جستجو
     * @returns {Array<Object>}
     */
    searchPlayers(query) {
        const user = authManager?.getCurrentUser();
        if (!user) return [];

        if (!query || query.length < this.limits.searchMinLength) {
            return [];
        }

        const lowerQuery = query.toLowerCase();

        // در production، این جستجو از سرور انجام می‌شود
        // اینجا نمونه‌ای از نتایج را برمی‌گردانیم
        const sampleResults = [
            { id: 'p1', username: 'ProPlayer1', rating: 1500, tier: 'gold', status: 'online' },
            { id: 'p2', username: 'MasterGamer', rating: 2000, tier: 'platinum', status: 'offline' },
            { id: 'p3', username: 'ElitePlayer', rating: 1800, tier: 'gold', status: 'online' }
        ];

        return sampleResults
            .filter(p => p.username.toLowerCase().includes(lowerQuery))
            .filter(p => p.id !== user.id)
            .filter(p => !this.friends.some(f => f.id === p.id))
            .filter(p => !this.blockedList.some(b => b.id === p.id))
            .slice(0, this.limits.searchMaxResults);
    }

    // ============================================================
    // بخش : مسدود کردن
    // ============================================================

    /**
     * مسدود کردن کاربر
     * @param {string} userId - شناسه کاربر
     * @returns {Object} نتیجه
     */
    blockUser(userId) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای مسدود کردن باید وارد شوید'
            };
        }

        if (userId === user.id) {
            return {
                success: false,
                error: 'SELF_BLOCK',
                message: 'نمی‌توانید خودتان را مسدود کنید'
            };
        }

        if (this.blockedList.some(b => b.id === userId)) {
            return {
                success: false,
                error: 'ALREADY_BLOCKED',
                message: 'این کاربر قبلاً مسدود شده است'
            };
        }

        if (this.blockedList.length >= this.limits.maxBlocked) {
            return {
                success: false,
                error: 'MAX_BLOCKED_REACHED',
                message: `حداکثر ${this.limits.maxBlocked} کاربر مسدود`
            };
        }

        // حذف از دوستان اگر دوست است
        const friendIndex = this.friends.findIndex(f => f.id === userId);
        if (friendIndex !== -1) {
            this.friends.splice(friendIndex, 1);
        }

        // حذف از درخواست‌ها
        this.incomingRequests = this.incomingRequests.filter(r => r.senderId !== userId);
        this.outgoingRequests = this.outgoingRequests.filter(r => r.targetId !== userId);

        // اضافه کردن به لیست مسدود
        const blockedUser = {
            id: userId,
            username: this._getUsernameById(userId),
            blockedAt: Date.now()
        };

        this.blockedList.push(blockedUser);
        this.stats.totalBlocked++;

        this._updateStats();
        this._saveData();

        this._emit('user-blocked', { user: blockedUser });

        if (this.debug) {
            console.log(`🚫 User blocked: ${blockedUser.username}`);
        }

        return {
            success: true,
            user: blockedUser
        };
    }

    /**
     * رفع مسدودیت
     * @param {string} userId - شناسه کاربر
     * @returns {Object} نتیجه
     */
    unblockUser(userId) {
        const blockIndex = this.blockedList.findIndex(b => b.id === userId);
        if (blockIndex === -1) {
            return {
                success: false,
                error: 'NOT_BLOCKED',
                message: 'این کاربر مسدود نیست'
            };
        }

        const unblockedUser = this.blockedList[blockIndex];
        this.blockedList.splice(blockIndex, 1);

        this._updateStats();
        this._saveData();

        this._emit('user-unblocked', { user: unblockedUser });

        if (this.debug) {
            console.log(`✅ User unblocked: ${unblockedUser.username}`);
        }

        return {
            success: true,
            user: unblockedUser
        };
    }

    /**
     * دریافت لیست مسدودها
     * @returns {Array<Object>}
     */
    getBlockedList() {
        return [...this.blockedList];
    }

    /**
     * بررسی مسدود بودن کاربر
     * @param {string} userId - شناسه کاربر
     * @returns {boolean}
     */
    isUserBlocked(userId) {
        return this.blockedList.some(b => b.id === userId);
    }

    // ============================================================
    // بخش ۵: دعوت به بازی
    // ============================================================

    /**
     * دعوت دوست به بازی
     * @param {string} friendId - شناسه دوست
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    inviteFriend(friendId, options = {}) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای دعوت باید وارد شوید'
            };
        }

        const friend = this.getFriend(friendId);
        if (!friend) {
            return {
                success: false,
                error: 'FRIEND_NOT_FOUND',
                message: 'دوست یافت نشد'
            };
        }

        if (friend.status !== 'online') {
            return {
                success: false,
                error: 'FRIEND_OFFLINE',
                message: 'دوست آفلاین است'
            };
        }

        // بررسی cooldown
        const lastInvite = this.lastInviteTimes[friendId] || 0;
        const timeSinceLastInvite = (Date.now() - lastInvite) / 1000;

        if (timeSinceLastInvite < this.limits.inviteCooldownSeconds) {
            const remaining = Math.ceil(this.limits.inviteCooldownSeconds - timeSinceLastInvite);
            return {
                success: false,
                error: 'INVITE_COOLDOWN',
                message: `لطفاً ${remaining} ثانیه صبر کنید`,
                remaining
            };
        }

        const invitation = {
            id: Utils.generateUUID(),
            fromPlayerId: user.id,
            fromPlayerName: user.username,
            toPlayerId: friendId,
            toPlayerName: friend.username,
            gameMode: options.gameMode || 'quick',
            createdAt: Date.now(),
            expiresAt: Date.now() + 60000, // 1 دقیقه
            status: 'pending'
        };

        this.lastInviteTimes[friendId] = Date.now();

        // در production از WebSocket استفاده می‌شود
        this._sendInvitation(invitation);

        this._emit('friend-invited', {
            friend,
            invitation
        });

        if (this.debug) {
            console.log(` Friend invited: ${friend.username}`);
        }

        return {
            success: true,
            invitation
        };
    }

    /**
     * ارسال دعوت (در production از WebSocket)
     * @param {Object} invitation - دعوت
     * @private
     */
    _sendInvitation(invitation) {
        if (typeof wsManager !== 'undefined' && wsManager.isConnected) {
            wsManager.send('friend_invite', invitation);
        }

        if (this.debug) {
            console.log('📨 Invitation sent via WebSocket');
        }
    }

    // ============================================================
    // بخش : وضعیت آنلاین/آفلاین
    // ============================================================

    /**
     * به‌روزرسانی وضعیت یک دوست
     * @param {string} friendId - شناسه دوست
     * @param {string} status - وضعیت (online/offline)
     * @returns {void}
     */
    updateFriendStatus(friendId, status) {
        const friend = this.getFriend(friendId);
        if (!friend) return;

        friend.status = status;
        friend.lastOnline = status === 'online' ? Date.now() : friend.lastOnline;
        friend.updatedAt = Date.now();

        this._updateStats();
        this._saveData();

        this._emit('friend-status-changed', {
            friend,
            status
        });

        if (this.debug) {
            console.log(`🟢 Friend status changed: ${friend.username} → ${status}`);
        }
    }

    /**
     * به‌روزرسانی وضعیت همه دوستان
     * @param {Array<Object>} statuses - لیست وضعیت‌ها
     * @returns {void}
     */
    updateAllFriendsStatus(statuses) {
        statuses.forEach(({ id, status }) => {
            this.updateFriendStatus(id, status);
        });
    }

    // ============================================================
    // بخش ۷: آمار و تحلیل
    // ============================================================

    /**
     * به‌روزرسانی آمار
     * @private
     */
    _updateStats() {
        this.stats.totalFriends = this.friends.length;
        this.stats.onlineFriends = this.friends.filter(f => f.status === 'online').length;
        this.stats.offlineFriends = this.friends.filter(f => f.status === 'offline').length;
        this.stats.favoriteFriends = this.friends.filter(f => f.isFavorite).length;
        this.stats.totalBlocked = this.blockedList.length;
    }

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            pendingIncoming: this.incomingRequests.length,
            pendingOutgoing: this.outgoingRequests.length,
            limits: this.limits
        };
    }

    /**
     * دریافت خلاصه دوستان
     * @returns {Object}
     */
    getFriendsSummary() {
        return {
            total: this.friends.length,
            online: this.stats.onlineFriends,
            offline: this.stats.offlineFriends,
            favorites: this.stats.favoriteFriends,
            pendingRequests: this.incomingRequests.length,
            maxFriends: this.limits.maxFriends
        };
    }

    // ============================================================
    // بخش ۸: توابع کمکی
    // ============================================================

    /**
     * دریافت نام کاربری بر اساس شناسه
     * @param {string} userId - شناسه کاربر
     * @returns {string}
     * @private
     */
    _getUsernameById(userId) {
        // در production از سرور دریافت می‌شود
        const friend = this.friends.find(f => f.id === userId);
        return friend?.username || `Player_${userId.substring(0, 6)}`;
    }

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('friends_list', this.friends);
            storage.set('friends_incoming', this.incomingRequests);
            storage.set('friends_outgoing', this.outgoingRequests);
            storage.set('friends_blocked', this.blockedList);
            storage.set('friends_stats', this.stats);
            storage.set('friends_last_invites', this.lastInviteTimes);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const friends = storage.get('friends_list');
            if (friends) this.friends = friends;

            const incoming = storage.get('friends_incoming');
            if (incoming) this.incomingRequests = incoming;

            const outgoing = storage.get('friends_outgoing');
            if (outgoing) this.outgoingRequests = outgoing;

            const blocked = storage.get('friends_blocked');
            if (blocked) this.blockedList = blocked;

            const stats = storage.get('friends_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            const lastInvites = storage.get('friends_last_invites');
            if (lastInvites) this.lastInviteTimes = lastInvites;
        }
    }

    // ============================================================
    // بخش ۹: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.friends = [];
        this.incomingRequests = [];
        this.outgoingRequests = [];
        this.blockedList = [];
        this.lastInviteTimes = {};

        this.stats = {
            totalFriends: 0,
            totalRequestsSent: 0,
            totalRequestsReceived: 0,
            totalRequestsAccepted: 0,
            totalRequestsRejected: 0,
            totalBlocked: 0,
            onlineFriends: 0,
            offlineFriends: 0,
            favoriteFriends: 0
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 FriendsManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getFriendsSummary();

        console.log('👥 FriendsManager Status:');
        console.log('  Total Friends:', summary.total, '/', summary.maxFriends);
        console.log('  Online:', summary.online);
        console.log('  Offline:', summary.offline);
        console.log('  Favorites:', summary.favorites);
        console.log('  Pending Incoming:', summary.pendingRequests);
        console.log('  Pending Outgoing:', stats.pendingOutgoing);
        console.log('  Blocked:', stats.totalBlocked, '/', stats.limits.maxBlocked);
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
                    console.error(`❌ Friends event listener error:`, error);
                }
            });
        }

        eventBus.emit(`friends:${event}`, data);
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
const friendsManager = new FriendsManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FriendsManager, friendsManager };
} else {
    window.FriendsManager = FriendsManager;
    window.friendsManager = friendsManager;
}

console.log('✅ FriendsManager loaded');
