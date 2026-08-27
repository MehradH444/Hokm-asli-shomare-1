/**
 * ============================================================
 * HOKM MASTER - REST API Manager
 * مدیریت ارتباط REST API با سرور
 * ============================================================
 * 
 * این فایل مسئول مدیریت تمام درخواست‌های REST API به سرور است.
 * شامل احراز هویت، مدیریت پروفایل، بازی، فروشگاه، دوستان،
 * چت، و تمام endpoint های مورد نیاز بازی.
 * 
 * ویژگی‌ها:
 * - Token-based authentication
 * - Request/Response caching
 * - Automatic retry with exponential backoff
 * - Rate limiting
 * - Request queueing
 * - Error handling
 * - Request/response interceptors
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - storage (از فایل storage.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - wsManager (از فایل websocket.js)
 * 
 * ============================================================
 */

class APIManager {

    constructor() {
        /**
         * آدرس پایه API
         * @type {string}
         */
        this.baseURL = CONFIG.API.BASE_URL;

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
         * کش درخواست‌ها
         * @type {Map}
         */
        this.cache = new Map();

        /**
         * حداکثر زمان کش (میلی‌ثانیه)
         * @type {number}
         */
        this.cacheTTL = 60000;

        /**
         * صف درخواست‌ها
         * @type {Array}
         */
        this.requestQueue = [];

        /**
         * آیا در حال پردازش صف است
         * @type {boolean}
         */
        this.isProcessingQueue = false;

        /**
         * محدودیت نرخ درخواست
         * @type {Object}
         */
        this.rateLimits = {
            requests: [],
            maxRequests: 60,
            windowMs: 60000
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
         * آمار API
         * @type {Object}
         */
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cachedRequests: 0,
            averageResponseTime: 0,
            totalBytesTransferred: 0
        };

        /**
         * Interceptor های درخواست
         * @type {Array}
         */
        this.requestInterceptors = [];

        /**
         * Interceptor های پاسخ
         * @type {Array}
         */
        this.responseInterceptors = [];

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری Token از storage
        this._loadAuthToken();

        if (this.debug) {
            console.log(' APIManager initialized');
            console.log('  Base URL:', this.baseURL);
        }
    }

    /**
     * بارگذاری Token احراز هویت
     * @private
     */
    _loadAuthToken() {
        const token = storage.get(CONFIG.STORAGE_KEYS.TOKEN, {
            decrypt: true
        });

        if (token) {
            this.authToken = token;
        }
    }

    // ============================================================
    // بخش ۱: تنظیمات Token
    // ============================================================

    /**
     * تنظیم Token احراز هویت
     * @param {string} token - Token
     * @returns {void}
     */
    setAuthToken(token) {
        this.authToken = token;
        storage.set(CONFIG.STORAGE_KEYS.TOKEN, token, {
            encrypt: true
        });

        this._emit('token-set', { token });

        if (this.debug) {
            console.log('🔑 Auth token set');
        }
    }

    /**
     * پاک کردن Token
     * @returns {void}
     */
    clearAuthToken() {
        this.authToken = null;
        storage.remove(CONFIG.STORAGE_KEYS.TOKEN);

        this._emit('token-cleared');

        if (this.debug) {
            console.log('🗑️ Auth token cleared');
        }
    }

    /**
     * دریافت Token فعلی
     * @returns {string|null}
     */
    getAuthToken() {
        return this.authToken;
    }

    // ============================================================
    // بخش ۲: متدهای اصلی HTTP
    // ============================================================

    /**
     * ارسال درخواست GET
     * @param {string} endpoint - endpoint
     * @param {Object} params - پارامترها
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<Object>} پاسخ
     */
    async get(endpoint, params = {}, options = {}) {
        return this.request('GET', endpoint, null, { ...options, params });
    }

    /**
     * ارسال درخواست POST
     * @param {string} endpoint - endpoint
     * @param {*} data - داده
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<Object>} پاسخ
     */
    async post(endpoint, data = {}, options = {}) {
        return this.request('POST', endpoint, data, options);
    }

    /**
     * ارسال درخواست PUT
     * @param {string} endpoint - endpoint
     * @param {*} data - داده
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<Object>} پاسخ
     */
    async put(endpoint, data = {}, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }

    /**
     * ارسال درخواست DELETE
     * @param {string} endpoint - endpoint
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<Object>} پاسخ
     */
    async delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, null, options);
    }

    /**
     * ارسال درخواست PATCH
     * @param {string} endpoint - endpoint
     * @param {*} data - داده
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<Object>} پاسخ
     */
    async patch(endpoint, data = {}, options = {}) {
        return this.request('PATCH', endpoint, data, options);
    }

    /**
     * ارسال درخواست اصلی
     * @param {string} method - متد HTTP
     * @param {string} endpoint - endpoint
     * @param {*} data - داده
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<Object>} پاسخ
     */
    async request(method, endpoint, data = null, options = {}) {
        const {
            params = {},
            headers = {},
            timeout = CONFIG.API.TIMEOUT,
            retry = true,
            retryAttempts = CONFIG.API.RETRY_ATTEMPTS,
            cache = false,
            cacheTTL = this.cacheTTL,
            priority = 'normal'
        } = options;

        // بررسی rate limit
        if (!this._checkRateLimit()) {
            return this._queueRequest(method, endpoint, data, options);
        }

        // ساخت URL کامل
        const url = this._buildURL(endpoint, params);

        // بررسی کش
        if (cache && method === 'GET') {
            const cached = this._getFromCache(url);
            if (cached) {
                this.stats.cachedRequests++;
                return cached;
            }
        }

        // ساخت headers
        const requestHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...headers
        };

        if (this.authToken) {
            requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
        }

        // ساخت options درخواست
        const fetchOptions = {
            method: method,
            headers: requestHeaders,
            credentials: 'same-origin'
        };

        if (data && method !== 'GET') {
            fetchOptions.body = JSON.stringify(data);
        }

        const startTime = Date.now();
        this.stats.totalRequests++;

        try {
            // اجرای request interceptors
            let processedOptions = fetchOptions;
            for (const interceptor of this.requestInterceptors) {
                processedOptions = await interceptor(method, url, processedOptions);
            }

            // ارسال درخواست با timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            fetchOptions.signal = controller.signal;

            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            const responseTime = Date.now() - startTime;
            this._updateResponseTime(responseTime);

            // بررسی وضعیت پاسخ
            if (!response.ok) {
                throw new APIError(
                    response.status,
                    response.statusText,
                    await response.json().catch(() => ({}))
                );
            }

            // پارس پاسخ
            const responseData = await response.json();

            // اجرای response interceptors
            let processedResponse = responseData;
            for (const interceptor of this.responseInterceptors) {
                processedResponse = await interceptor(response, processedResponse);
            }

            // ذخیره در کش
            if (cache && method === 'GET') {
                this._saveToCache(url, processedResponse, cacheTTL);
            }

            this.stats.successfulRequests++;
            this.stats.totalBytesTransferred += JSON.stringify(processedResponse).length;

            this._emit('request-success', {
                method,
                endpoint,
                responseTime,
                status: response.status
            });

            if (this.debug) {
                console.log(`✅ ${method} ${endpoint} - ${responseTime}ms`);
            }

            return {
                success: true,
                data: processedResponse,
                status: response.status,
                headers: response.headers,
                responseTime
            };

        } catch (error) {
            this.stats.failedRequests++;

            // تلاش مجدد
            if (retry && retryAttempts > 0 && this._isRetryableError(error)) {
                if (this.debug) {
                    console.log(`🔄 Retrying ${method} ${endpoint} (${retryAttempts} attempts left)`);
                }

                await Utils.sleep(CONFIG.API.RETRY_DELAY);
                return this.request(method, endpoint, data, {
                    ...options,
                    retryAttempts: retryAttempts - 1
                });
            }

            this._emit('request-error', {
                method,
                endpoint,
                error: error.message
            });

            if (this.debug) {
                console.error(` ${method} ${endpoint} failed:`, error.message);
            }

            return {
                success: false,
                error: error.message,
                status: error.status || 0,
                data: error.data || null
            };
        }
    }

    // ============================================================
    // بخش ۳: ساخت URL
    // ============================================================

    /**
     * ساخت URL کامل
     * @param {string} endpoint - endpoint
     * @param {Object} params - پارامترها
     * @returns {string} URL کامل
     * @private
     */
    _buildURL(endpoint, params = {}) {
        let url = `${this.baseURL}${endpoint}`;

        if (Object.keys(params).length > 0) {
            const queryString = Object.entries(params)
                .filter(([_, value]) => value !== null && value !== undefined)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');

            if (queryString) {
                url += `?${queryString}`;
            }
        }

        return url;
    }

    // ============================================================
    // بخش ۴: مدیریت کش
    // ============================================================

    /**
     * دریافت از کش
     * @param {string} key - کلید
     * @returns {*|null}
     * @private
     */
    _getFromCache(key) {
        const cached = this.cache.get(key);

        if (!cached) return null;

        if (Date.now() > cached.expiry) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * ذخیره در کش
     * @param {string} key - کلید
     * @param {*} data - داده
     * @param {number} ttl - زمان انقضا (میلی‌ثانیه)
     * @private
     */
    _saveToCache(key, data, ttl = this.cacheTTL) {
        this.cache.set(key, {
            data: data,
            expiry: Date.now() + ttl,
            timestamp: Date.now()
        });
    }

    /**
     * پاک کردن کش
     * @param {string} pattern - الگو (اختیاری)
     * @returns {number} تعداد آیتم‌های پاک شده
     */
    clearCache(pattern = null) {
        let count = 0;

        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                    count++;
                }
            }
        } else {
            count = this.cache.size;
            this.cache.clear();
        }

        if (this.debug) {
            console.log(`🗑️ Cache cleared: ${count} items`);
        }

        return count;
    }

    // ============================================================
    // بخش ۵: مدیریت Rate Limit
    // ============================================================

    /**
     * بررسی Rate Limit
     * @returns {boolean} آیا مجاز است
     * @private
     */
    _checkRateLimit() {
        const now = Date.now();

        // حذف درخواست‌های قدیمی
        this.rateLimits.requests = this.rateLimits.requests.filter(
            timestamp => now - timestamp < this.rateLimits.windowMs
        );

        if (this.rateLimits.requests.length >= this.rateLimits.maxRequests) {
            return false;
        }

        this.rateLimits.requests.push(now);
        return true;
    }

    /**
     * صف کردن درخواست
     * @param {string} method - متد
     * @param {string} endpoint - endpoint
     * @param {*} data - داده
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<Object>}
     * @private
     */
    async _queueRequest(method, endpoint, data, options) {
        return new Promise((resolve) => {
            this.requestQueue.push({
                method,
                endpoint,
                data,
                options,
                resolve
            });

            if (!this.isProcessingQueue) {
                this._processQueue();
            }
        });
    }

    /**
     * پردازش صف درخواست‌ها
     * @private
     */
    async _processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            if (!this._checkRateLimit()) {
                await Utils.sleep(1000);
                continue;
            }

            const request = this.requestQueue.shift();
            const result = await this.request(
                request.method,
                request.endpoint,
                request.data,
                request.options
            );

            request.resolve(result);
        }

        this.isProcessingQueue = false;
    }

    // ============================================================
    // بخش ۶: مدیریت خطا
    // ============================================================

    /**
     * بررسی آیا خطا قابل retry است
     * @param {Error} error - خطا
     * @returns {boolean}
     * @private
     */
    _isRetryableError(error) {
        if (error instanceof APIError) {
            return [408, 429, 500, 502, 503, 504].includes(error.status);
        }

        // Network errors
        return error.name === 'TypeError' || error.name === 'AbortError';
    }

    /**
     * مدیریت خطای 401 (Unauthorized)
     * @returns {void}
     * @private
     */
    _handleUnauthorized() {
        console.warn('️ Unauthorized - clearing token');

        this.clearAuthToken();
        eventBus.emit(EVENTS.AUTH.SESSION_EXPIRED);

        this._emit('unauthorized');
    }

    // ============================================================
    // بخش ۷: Interceptors
    // ============================================================

    /**
     * اضافه کردن Request Interceptor
     * @param {Function} interceptor - تابع
     * @returns {Function} تابع حذف
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);

        return () => {
            const index = this.requestInterceptors.indexOf(interceptor);
            if (index > -1) {
                this.requestInterceptors.splice(index, 1);
            }
        };
    }

    /**
     * اضافه کردن Response Interceptor
     * @param {Function} interceptor - تابع
     * @returns {Function} تابع حذف
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);

        return () => {
            const index = this.responseInterceptors.indexOf(interceptor);
            if (index > -1) {
                this.responseInterceptors.splice(index, 1);
            }
        };
    }

    // ============================================================
    // بخش ۸: API Methods - Authentication
    // ============================================================

    /**
     * ارسال OTP
     * @param {string} phone - شماره موبایل
     * @returns {Promise<Object>}
     */
    async sendOTP(phone) {
        return this.post('/auth/otp/send', { phone });
    }

    /**
     * تأیید OTP
     * @param {string} phone - شماره موبایل
     * @param {string} otp - کد OTP
     * @returns {Promise<Object>}
     */
    async verifyOTP(phone, otp) {
        const result = await this.post('/auth/otp/verify', { phone, otp });

        if (result.success && result.data.token) {
            this.setAuthToken(result.data.token);
            this.userId = result.data.userId;
        }

        return result;
    }

    /**
     * ورود مهمان
     * @returns {Promise<Object>}
     */
    async loginAsGuest() {
        const result = await this.post('/auth/guest');

        if (result.success && result.data.token) {
            this.setAuthToken(result.data.token);
            this.userId = result.data.userId;
        }

        return result;
    }

    /**
     * خروج
     * @returns {Promise<Object>}
     */
    async logout() {
        const result = await this.post('/auth/logout');
        this.clearAuthToken();
        return result;
    }

    /**
     * ثبت‌نام
     * @param {Object} data - داده‌های ثبت‌نام
     * @returns {Promise<Object>}
     */
    async register(data) {
        const result = await this.post('/auth/register', data);

        if (result.success && result.data.token) {
            this.setAuthToken(result.data.token);
            this.userId = result.data.userId;
        }

        return result;
    }

    /**
     * بازیابی رمز عبور
     * @param {string} email - ایمیل
     * @returns {Promise<Object>}
     */
    async requestPasswordRecovery(email) {
        return this.post('/auth/password/recovery', { email });
    }

    /**
     * تغییر رمز عبور
     * @param {string} token - Token بازیابی
     * @param {string} newPassword - رمز جدید
     * @returns {Promise<Object>}
     */
    async resetPassword(token, newPassword) {
        return this.post('/auth/password/reset', { token, newPassword });
    }

    // ============================================================
    // بخش ۹: API Methods - Profile
    // ============================================================

    /**
     * دریافت پروفایل
     * @param {string} userId - شناسه کاربر (اختیاری)
     * @returns {Promise<Object>}
     */
    async getProfile(userId = null) {
        const endpoint = userId ? `/profile/${userId}` : '/profile/me';
        return this.get(endpoint, {}, { cache: true });
    }

    /**
     * به‌روزرسانی پروفایل
     * @param {Object} data - داده‌ها
     * @returns {Promise<Object>}
     */
    async updateProfile(data) {
        const result = await this.put('/profile/me', data);

        if (result.success) {
            this._emit('profile-updated', result.data);
        }

        return result;
    }

    /**
     * تغییر آواتار
     * @param {number} avatarId - شناسه آواتار
     * @returns {Promise<Object>}
     */
    async changeAvatar(avatarId) {
        return this.put('/profile/avatar', { avatarId });
    }

    /**
     * تغییر نام
     * @param {string} username - نام کاربری جدید
     * @returns {Promise<Object>}
     */
    async changeUsername(username) {
        return this.put('/profile/username', { username });
    }

    /**
     * دریافت آمار
     * @param {string} userId - شناسه کاربر
     * @returns {Promise<Object>}
     */
    async getStatistics(userId = null) {
        const endpoint = userId ? `/statistics/${userId}` : '/statistics/me';
        return this.get(endpoint, {}, { cache: true });
    }

    /**
     * دریافت تاریخچه بازی
     * @param {Object} params - پارامترها
     * @returns {Promise<Object>}
     */
    async getMatchHistory(params = {}) {
        return this.get('/matches/history', params);
    }

    // ============================================================
    // بخش ۱۰: API Methods - Game
    // ============================================================

    /**
     * شروع بازی
     * @param {Object} data - داده‌ها
     * @returns {Promise<Object>}
     */
    async startGame(data) {
        return this.post('/game/start', data);
    }

    /**
     * بازی کردن کارت
     * @param {string} gameId - شناسه بازی
     * @param {Object} card - کارت
     * @returns {Promise<Object>}
     */
    async playCard(gameId, card) {
        return this.post(`/game/${gameId}/play`, { card });
    }

    /**
     * انتخاب حکم
     * @param {string} gameId - شناسه بازی
     * @param {string} suit - خال
     * @returns {Promise<Object>}
     */
    async selectTrump(gameId, suit) {
        return this.post(`/game/${gameId}/trump`, { suit });
    }

    /**
     * دریافت وضعیت بازی
     * @param {string} gameId - شناسه بازی
     * @returns {Promise<Object>}
     */
    async getGameState(gameId) {
        return this.get(`/game/${gameId}/state`);
    }

    /**
     * خروج از بازی
     * @param {string} gameId - شناسه بازی
     * @returns {Promise<Object>}
     */
    async leaveGame(gameId) {
        return this.post(`/game/${gameId}/leave`);
    }

    // ============================================================
    // بخش ۱۱: API Methods - Room
    // ============================================================

    /**
     * ساخت اتاق
     * @param {Object} data - داده‌ها
     * @returns {Promise<Object>}
     */
    async createRoom(data) {
        return this.post('/room/create', data);
    }

    /**
     * پیوستن به اتاق
     * @param {string} roomCode - کد اتاق
     * @returns {Promise<Object>}
     */
    async joinRoom(roomCode) {
        return this.post('/room/join', { roomCode });
    }

    /**
     * ترک اتاق
     * @param {string} roomId - شناسه اتاق
     * @returns {Promise<Object>}
     */
    async leaveRoom(roomId) {
        return this.post(`/room/${roomId}/leave`);
    }

    /**
     * دریافت وضعیت اتاق
     * @param {string} roomId - شناسه اتاق
     * @returns {Promise<Object>}
     */
    async getRoomState(roomId) {
        return this.get(`/room/${roomId}/state`);
    }

    /**
     * دعوت بازیکن
     * @param {string} roomId - شناسه اتاق
     * @param {string} userId - شناسه کاربر
     * @returns {Promise<Object>}
     */
    async invitePlayer(roomId, userId) {
        return this.post(`/room/${roomId}/invite`, { userId });
    }

    // ============================================================
    // بخش ۱۲: API Methods - Shop
    // ============================================================

    /**
     * دریافت آیتم‌های فروشگاه
     * @param {Object} params - پارامترها
     * @returns {Promise<Object>}
     */
    async getShopItems(params = {}) {
        return this.get('/shop/items', params, { cache: true });
    }

    /**
     * خرید آیتم
     * @param {string} itemId - شناسه آیتم
     * @returns {Promise<Object>}
     */
    async purchaseItem(itemId) {
        const result = await this.post('/shop/purchase', { itemId });

        if (result.success) {
            this._emit('item-purchased', result.data);
        }

        return result;
    }

    /**
     * تجهیز آیتم
     * @param {string} itemId - شناسه آیتم
     * @param {string} slot - اسلات
     * @returns {Promise<Object>}
     */
    async equipItem(itemId, slot) {
        return this.post('/shop/equip', { itemId, slot });
    }

    /**
     * دریافت Inventory
     * @returns {Promise<Object>}
     */
    async getInventory() {
        return this.get('/inventory', {}, { cache: true });
    }

    // ============================================================
    // بخش ۱۳: API Methods - Social
    // ============================================================

    /**
     * دریافت لیست دوستان
     * @returns {Promise<Object>}
     */
    async getFriends() {
        return this.get('/friends', {}, { cache: true });
    }

    /**
     * ارسال درخواست دوستی
     * @param {string} userId - شناسه کاربر
     * @returns {Promise<Object>}
     */
    async sendFriendRequest(userId) {
        return this.post('/friends/request', { userId });
    }

    /**
     * قبول درخواست دوستی
     * @param {string} requestId - شناسه درخواست
     * @returns {Promise<Object>}
     */
    async acceptFriendRequest(requestId) {
        return this.post(`/friends/request/${requestId}/accept`);
    }

    /**
     * رد درخواست دوستی
     * @param {string} requestId - شناسه درخواست
     * @returns {Promise<Object>}
     */
    async rejectFriendRequest(requestId) {
        return this.post(`/friends/request/${requestId}/reject`);
    }

    /**
     * حذف دوست
     * @param {string} userId - شناسه کاربر
     * @returns {Promise<Object>}
     */
    async removeFriend(userId) {
        return this.delete(`/friends/${userId}`);
    }

    /**
     * مسدود کردن کاربر
     * @param {string} userId - شناسه کاربر
     * @returns {Promise<Object>}
     */
    async blockUser(userId) {
        return this.post('/block', { userId });
    }

    // ============================================================
    // بخش ۱۴: API Methods - Chat
    // ============================================================

    /**
     * ارسال پیام
     * @param {string} roomId - شناسه اتاق
     * @param {string} message - پیام
     * @returns {Promise<Object>}
     */
    async sendMessage(roomId, message) {
        return this.post(`/chat/${roomId}/send`, { message });
    }

    /**
     * دریافت پیام‌ها
     * @param {string} roomId - شناسه اتاق
     * @param {Object} params - پارامترها
     * @returns {Promise<Object>}
     */
    async getMessages(roomId, params = {}) {
        return this.get(`/chat/${roomId}/messages`, params);
    }

    // ============================================================
    // بخش ۱۵: API Methods - Leaderboard
    // ============================================================

    /**
     * دریافت رتبه‌بندی
     * @param {Object} params - پارامترها
     * @returns {Promise<Object>}
     */
    async getLeaderboard(params = {}) {
        return this.get('/leaderboard', params, { cache: true });
    }

    // ============================================================
    // بخش ۱۶: API Methods - Missions
    // ============================================================

    /**
     * دریافت مأموریت‌ها
     * @returns {Promise<Object>}
     */
    async getMissions() {
        return this.get('/missions', {}, { cache: true });
    }

    /**
     * دریافت پاداش مأموریت
     * @param {string} missionId - شناسه مأموریت
     * @returns {Promise<Object>}
     */
    async claimMissionReward(missionId) {
        return this.post(`/missions/${missionId}/claim`);
    }

    // ============================================================
    // بخش ۱۷: API Methods - Tournament
    // ============================================================

    /**
     * دریافت لیست تورنمنت‌ها
     * @param {Object} params - پارامترها
     * @returns {Promise<Object>}
     */
    async getTournaments(params = {}) {
        return this.get('/tournaments', params, { cache: true });
    }

    /**
     * ثبت‌نام در تورنمنت
     * @param {string} tournamentId - شناسه تورنمنت
     * @returns {Promise<Object>}
     */
    async registerTournament(tournamentId) {
        return this.post(`/tournaments/${tournamentId}/register`);
    }

    // ============================================================
    // بخش ۱۸: API Methods - League
    // ============================================================

    /**
     * دریافت اطلاعات لیگ
     * @returns {Promise<Object>}
     */
    async getLeagueInfo() {
        return this.get('/league', {}, { cache: true });
    }

    /**
     * دریافت رتبه‌بندی لیگ
     * @param {Object} params - پارامترها
     * @returns {Promise<Object>}
     */
    async getLeagueLeaderboard(params = {}) {
        return this.get('/league/leaderboard', params, { cache: true });
    }

    // ============================================================
    // بخش ۱۹: API Methods - Notifications
    // ============================================================

    /**
     * دریافت اعلان‌ها
     * @param {Object} params - پارامترها
     * @returns {Promise<Object>}
     */
    async getNotifications(params = {}) {
        return this.get('/notifications', params);
    }

    /**
     * علامت‌گذاری اعلان به عنوان خوانده شده
     * @param {string} notificationId - شناسه اعلان
     * @returns {Promise<Object>}
     */
    async markNotificationRead(notificationId) {
        return this.post(`/notifications/${notificationId}/read`);
    }

    /**
     * علامت‌گذاری همه اعلان‌ها به عنوان خوانده شده
     * @returns {Promise<Object>}
     */
    async markAllNotificationsRead() {
        return this.post('/notifications/read-all');
    }

    // ============================================================
    // بخش ۰: API Methods - Report
    // ============================================================

    /**
     * ارسال گزارش
     * @param {Object} data - داده‌های گزارش
     * @returns {Promise<Object>}
     */
    async submitReport(data) {
        return this.post('/report', data);
    }

    // ============================================================
    // بخش ۲۱: توابع کمکی
    // ============================================================

    /**
     * به‌روزرسانی میانگین زمان پاسخ
     * @param {number} responseTime - زمان پاسخ
     * @private
     */
    _updateResponseTime(responseTime) {
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime * 0.7) + (responseTime * 0.3);
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            queueSize: this.requestQueue.length,
            rateLimitRemaining: this.rateLimits.maxRequests - this.rateLimits.requests.length
        };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();

        console.log('🌐 API Status:');
        console.log('  Base URL:', this.baseURL);
        console.log('  Auth Token:', this.authToken ? '✅' : '❌');
        console.log('  Total Requests:', stats.totalRequests);
        console.log('  Success Rate:', ((stats.successfulRequests / Math.max(1, stats.totalRequests)) * 100).toFixed(1) + '%');
        console.log('  Avg Response Time:', stats.averageResponseTime.toFixed(2) + 'ms');
        console.log('  Cache Size:', stats.cacheSize);
        console.log('  Queue Size:', stats.queueSize);
        console.log('  Rate Limit Remaining:', stats.rateLimitRemaining);
    }

    // ============================================================
    // بخش ۲۲: Event System
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
                    console.error(`❌ API event listener error:`, error);
                }
            });
        }

        eventBus.emit(`api:${event}`, data);
    }

    /**
     * پاک کردن شنوندگان
     */
    clearListeners() {
        this.listeners.clear();
    }

    /**
     * پاکسازی کامل
     * @returns {void}
     */
    destroy() {
        this.clearCache();
        this.clearListeners();
        this.requestQueue = [];

        if (this.debug) {
            console.log('🗑️ APIManager destroyed');
        }
    }
}

/**
 * کلاس خطای API
 */
class APIError extends Error {
    constructor(status, message, data = {}) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const apiManager = new APIManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIManager, apiManager, APIError };
} else {
    window.APIManager = APIManager;
    window.apiManager = apiManager;
    window.APIError = APIError;
}

console.log('✅ APIManager loaded');
