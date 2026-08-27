/**
 * ============================================================
 * HOKM MASTER - Storage Manager
 * مدیریت ذخیره‌سازی داده‌ها
 * ============================================================
 * 
 * این فایل مسئول مدیریت تمام عملیات ذخیره‌سازی داده‌ها در
 * مرورگر کاربر است. شامل localStorage، sessionStorage و
 * IndexedDB با قابلیت‌های پیشرفته مانند رمزنگاری، انقضا،
 * quota management و migration.
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

class StorageManager {

    constructor() {
        /**
         * پیشوند کلیدهای ذخیره‌سازی
         * @type {string}
         */
        this.prefix = 'hokm_';

        /**
         * نسخه فعلی storage schema
         * @type {number}
         */
        this.schemaVersion = 1;

        /**
         * آیا localStorage در دسترس است
         * @type {boolean}
         */
        this.isLocalStorageAvailable = this._checkLocalStorage();

        /**
         * آیا sessionStorage در دسترس است
         * @type {boolean}
         */
        this.isSessionStorageAvailable = this._checkSessionStorage();

        /**
         * آیا IndexedDB در دسترس است
         * @type {boolean}
         */
        this.isIndexedDBAvailable = this._checkIndexedDB();

        /**
         * کلید رمزنگاری (در production از سرور دریافت می‌شود)
         * @type {string}
         */
        this.encryptionKey = 'hokm_master_secret_key_2026';

        /**
         * حداکثر حجم localStorage (معمولاً 5MB)
         * @type {number}
         */
        this.maxStorageSize = 5 * 1024 * 1024;

        /**
         * هشدار وقتی به این درصد از حجم رسیدیم
         * @type {number}
         */
        this.warningThreshold = 0.8;

        /**
         * شنوندگان رویداد تغییرات
         * @type {Map}
         */
        this.listeners = new Map();

        /**
         * کش داده‌های پرکاربرد
         * @type {Map}
         */
        this.cache = new Map();

        /**
         * حداکثر تعداد آیتم‌های کش
         * @type {number}
         */
        this.maxCacheSize = 100;

        /**
         * مدت زمان انقضای کش (میلی‌ثانیه)
         * @type {number}
         */
        this.cacheTTL = 60000;

        /**
         * آیا debug mode فعال است
         * @type {boolean}
         */
        this.debug = CONFIG.DEBUG.ENABLED;

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه Storage Manager
     * @private
     */
    _init() {
        this._migrateOldData();
        this._setupStorageListener();
        
        if (this.debug) {
            console.log('📦 StorageManager initialized');
            console.log('  - localStorage:', this.isLocalStorageAvailable);
            console.log('  - sessionStorage:', this.isSessionStorageAvailable);
            console.log('  - IndexedDB:', this.isIndexedDBAvailable);
        }
    }

    /**
     * بررسی دسترسی به localStorage
     * @returns {boolean}
     * @private
     */
    _checkLocalStorage() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            console.warn('⚠️ localStorage not available:', e);
            return false;
        }
    }

    /**
     * بررسی دسترسی به sessionStorage
     * @returns {boolean}
     * @private
     */
    _checkSessionStorage() {
        try {
            const testKey = '__session_test__';
            sessionStorage.setItem(testKey, 'test');
            sessionStorage.removeItem(testKey);
            return true;
        } catch (e) {
            console.warn('⚠️ sessionStorage not available:', e);
            return false;
        }
    }

    /**
     * بررسی دسترسی به IndexedDB
     * @returns {boolean}
     * @private
     */
    _checkIndexedDB() {
        return 'indexedDB' in window;
    }

    /**
     * مهاجرت داده‌های قدیمی
     * @private
     */
    _migrateOldData() {
        try {
            const oldVersion = this._getRaw('schema_version');
            
            if (!oldVersion) {
                this._setRaw('schema_version', this.schemaVersion);
                return;
            }

            const oldVersionNum = parseInt(oldVersion, 10);
            
            if (oldVersionNum < this.schemaVersion) {
                console.log(`🔄 Migrating storage from v${oldVersionNum} to v${this.schemaVersion}`);
                this._runMigrations(oldVersionNum);
                this._setRaw('schema_version', this.schemaVersion);
            }
        } catch (error) {
            console.error('❌ Migration failed:', error);
        }
    }

    /**
     * اجرای migration ها
     * @param {number} fromVersion - نسخه مبدأ
     * @private
     */
    _runMigrations(fromVersion) {
        // Migration از v0 به v1
        if (fromVersion < 1) {
            this._migrateV0ToV1();
        }

        // Migration های آینده اینجا اضافه می‌شوند
    }

    /**
     * Migration از نسخه 0 به 1
     * @private
     */
    _migrateV0ToV1() {
        try {
            // مثال: تغییر نام کلیدهای قدیمی
            const oldUser = this._getRaw('user');
            if (oldUser) {
                this._setRaw('hokm_user', oldUser);
                this._removeRaw('user');
            }

            const oldSettings = this._getRaw('settings');
            if (oldSettings) {
                this._setRaw('hokm_settings', oldSettings);
                this._removeRaw('settings');
            }

            console.log('✅ Migration v0 -> v1 completed');
        } catch (error) {
            console.error('❌ Migration v0 -> v1 failed:', error);
        }
    }

    /**
     * تنظیم listener برای تغییرات storage
     * @private
     */
    _setupStorageListener() {
        if (this.isLocalStorageAvailable) {
            window.addEventListener('storage', (event) => {
                if (event.key && event.key.startsWith(this.prefix)) {
                    const key = event.key.replace(this.prefix, '');
                    this._emit('change', { key, newValue: event.newValue, oldValue: event.oldValue });
                }
            });
        }
    }

    // ============================================================
    // بخش ۱: عملیات پایه localStorage
    // ============================================================

    /**
     * دریافت مقدار خام از localStorage
     * @param {string} key - کلید
     * @returns {string|null}
     * @private
     */
    _getRaw(key) {
        if (!this.isLocalStorageAvailable) return null;
        return localStorage.getItem(key);
    }

    /**
     * تنظیم مقدار خام در localStorage
     * @param {string} key - کلید
     * @param {string} value - مقدار
     * @returns {boolean}
     * @private
     */
    _setRaw(key, value) {
        if (!this.isLocalStorageAvailable) return false;
        
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this._handleQuotaExceeded();
            }
            console.error('❌ localStorage set error:', error);
            return false;
        }
    }

    /**
     * حذف مقدار خام از localStorage
     * @param {string} key - کلید
     * @returns {boolean}
     * @private
     */
    _removeRaw(key) {
        if (!this.isLocalStorageAvailable) return false;
        
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('❌ localStorage remove error:', error);
            return false;
        }
    }

    // ============================================================
    // بخش ۲: عملیات اصلی ذخیره‌سازی
    // ============================================================

    /**
     * ذخیره داده در localStorage
     * @param {string} key - کلید
     * @param {*} value - مقدار
     * @param {Object} options - گزینه‌ها
     * @param {boolean} options.encrypt - آیا رمزنگاری شود
     * @param {number} options.ttl - مدت انقضا (میلی‌ثانیه)
     * @param {boolean} options.session - آیا در sessionStorage ذخیره شود
     * @returns {boolean} موفقیت
     */
    set(key, value, options = {}) {
        const {
            encrypt = false,
            ttl = null,
            session = false
        } = options;

        const fullKey = this.prefix + key;
        
        let dataToStore = value;

        // رمزنگاری در صورت نیاز
        if (encrypt) {
            dataToStore = this._encrypt(JSON.stringify(value));
        } else {
            dataToStore = JSON.stringify(value);
        }

        // اضافه کردن metadata انقضا
        if (ttl) {
            const wrappedData = {
                __data: dataToStore,
                __expiry: Date.now() + ttl,
                __version: this.schemaVersion
            };
            dataToStore = JSON.stringify(wrappedData);
        }

        const storage = session ? sessionStorage : localStorage;
        
        try {
            if (session && this.isSessionStorageAvailable) {
                sessionStorage.setItem(fullKey, dataToStore);
            } else if (this.isLocalStorageAvailable) {
                localStorage.setItem(fullKey, dataToStore);
            } else {
                // Fallback به حافظه موقت
                this.cache.set(fullKey, dataToStore);
            }

            // به‌روزرسانی کش
            this._updateCache(key, value);

            // انتشار رویداد
            this._emit('set', { key, value, options });

            if (this.debug) {
                console.log(`💾 Stored: ${key}`, options);
            }

            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this._handleQuotaExceeded();
                return this.set(key, value, options); // Retry بعد از cleanup
            }
            console.error(`❌ Failed to store ${key}:`, error);
            return false;
        }
    }

    /**
     * دریافت داده از localStorage
     * @param {string} key - کلید
     * @param {Object} options - گزینه‌ها
     * @param {boolean} options.decrypt - آیا رمزگشایی شود
     * @param {*} options.defaultValue - مقدار پیش‌فرض
     * @param {boolean} options.session - آیا از sessionStorage خوانده شود
     * @returns {*} مقدار
     */
    get(key, options = {}) {
        const {
            decrypt = false,
            defaultValue = null,
            session = false
        } = options;

        const fullKey = this.prefix + key;

        // بررسی کش ابتدا
        const cached = this._getFromCache(key);
        if (cached !== undefined) {
            return cached;
        }

        let data = null;

        try {
            if (session && this.isSessionStorageAvailable) {
                data = sessionStorage.getItem(fullKey);
            } else if (this.isLocalStorageAvailable) {
                data = localStorage.getItem(fullKey);
            } else {
                data = this.cache.get(fullKey);
            }
        } catch (error) {
            console.error(`❌ Failed to read ${key}:`, error);
            return defaultValue;
        }

        if (data === null || data === undefined) {
            return defaultValue;
        }

        try {
            // بررسی انقضا
            const parsed = JSON.parse(data);
            
            if (parsed && parsed.__expiry) {
                if (Date.now() > parsed.__expiry) {
                    this.remove(key);
                    return defaultValue;
                }
                data = parsed.__data;
            }

            // رمزگشایی در صورت نیاز
            if (decrypt && typeof data === 'string') {
                data = this._decrypt(data);
            }

            const result = typeof data === 'string' ? JSON.parse(data) : data;

            // به‌روزرسانی کش
            this._updateCache(key, result);

            return result;
        } catch (error) {
            console.error(`❌ Failed to parse ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * حذف داده از localStorage
     * @param {string} key - کلید
     * @param {Object} options - گزینه‌ها
     * @param {boolean} options.session - آیا از sessionStorage حذف شود
     * @returns {boolean} موفقیت
     */
    remove(key, options = {}) {
        const { session = false } = options;
        const fullKey = this.prefix + key;

        try {
            if (session && this.isSessionStorageAvailable) {
                sessionStorage.removeItem(fullKey);
            } else if (this.isLocalStorageAvailable) {
                localStorage.removeItem(fullKey);
            }
            
            this.cache.delete(key);
            this._emit('remove', { key });

            if (this.debug) {
                console.log(`🗑️ Removed: ${key}`);
            }

            return true;
        } catch (error) {
            console.error(`❌ Failed to remove ${key}:`, error);
            return false;
        }
    }

    /**
     * بررسی وجود کلید
     * @param {string} key - کلید
     * @param {boolean} session - آیا در sessionStorage
     * @returns {boolean}
     */
    has(key, session = false) {
        const fullKey = this.prefix + key;

        try {
            if (session && this.isSessionStorageAvailable) {
                return sessionStorage.getItem(fullKey) !== null;
            } else if (this.isLocalStorageAvailable) {
                return localStorage.getItem(fullKey) !== null;
            }
            
            return this.cache.has(fullKey);
        } catch (error) {
            return false;
        }
    }

    /**
     * دریافت تمام کلیدهای ذخیره‌شده
     * @param {string} prefix - پیشوند فیلتر
     * @returns {string[]} آرایه کلیدها
     */
    keys(prefix = '') {
        const result = [];
        const searchPrefix = this.prefix + prefix;

        try {
            if (this.isLocalStorageAvailable) {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(searchPrefix)) {
                        result.push(key.replace(this.prefix, ''));
                    }
                }
            }
        } catch (error) {
            console.error('❌ Failed to get keys:', error);
        }

        return result;
    }

    /**
     * پاک کردن تمام داده‌های برنامه
     * @param {boolean} includeSettings - آیا تنظیمات هم پاک شود
     * @returns {boolean} موفقیت
     */
    clear(includeSettings = false) {
        try {
            if (this.isLocalStorageAvailable) {
                const keysToRemove = [];
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    
                    if (key && key.startsWith(this.prefix)) {
                        if (includeSettings || !key.includes('settings')) {
                            keysToRemove.push(key);
                        }
                    }
                }

                keysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                });
            }

            this.cache.clear();
            this._emit('clear', { includeSettings });

            if (this.debug) {
                console.log('🧹 Storage cleared');
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to clear storage:', error);
            return false;
        }
    }

    /**
     * دریافت حجم استفاده‌شده از storage
     * @returns {Object} {used, total, percentage, usedFormatted}
     */
    getUsage() {
        let used = 0;

        try {
            if (this.isLocalStorageAvailable) {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    const value = localStorage.getItem(key);
                    
                    if (key && value) {
                        used += key.length + value.length;
                    }
                }
            }
        } catch (error) {
            console.error('❌ Failed to calculate usage:', error);
        }

        const total = this.maxStorageSize;
        const percentage = (used / total) * 100;

        return {
            used: used,
            total: total,
            percentage: percentage,
            usedFormatted: this._formatBytes(used),
            totalFormatted: this._formatBytes(total),
            isNearLimit: percentage >= (this.warningThreshold * 100),
            isAtLimit: percentage >= 95
        };
    }

    // ============================================================
    // بخش ۳: ذخیره‌سازی با انقضا
    // ============================================================

    /**
     * ذخیره داده با مدت انقضا
     * @param {string} key - کلید
     * @param {*} value - مقدار
     * @param {number} ttl - مدت انقضا (میلی‌ثانیه)
     * @returns {boolean} موفقیت
     */
    setWithExpiry(key, value, ttl) {
        return this.set(key, value, { ttl });
    }

    /**
     * دریافت داده با بررسی انقضا
     * @param {string} key - کلید
     * @param {*} defaultValue - مقدار پیش‌فرض
     * @returns {*} مقدار
     */
    getWithExpiry(key, defaultValue = null) {
        return this.get(key, { defaultValue });
    }

    /**
     * بررسی انقضای یک کلید
     * @param {string} key - کلید
     * @returns {boolean} منقضی شده یا خیر
     */
    isExpired(key) {
        const fullKey = this.prefix + key;

        try {
            const data = this.isLocalStorageAvailable ? localStorage.getItem(fullKey) : null;
            
            if (!data) return true;

            const parsed = JSON.parse(data);
            
            if (parsed && parsed.__expiry) {
                return Date.now() > parsed.__expiry;
            }

            return false;
        } catch (error) {
            return true;
        }
    }

    /**
     * دریافت زمان باقی‌مانده تا انقضا
     * @param {string} key - کلید
     * @returns {number} میلی‌ثانیه باقی‌مانده (0 اگر منقضی شده)
     */
    getTimeRemaining(key) {
        const fullKey = this.prefix + key;

        try {
            const data = this.isLocalStorageAvailable ? localStorage.getItem(fullKey) : null;
            
            if (!data) return 0;

            const parsed = JSON.parse(data);
            
            if (parsed && parsed.__expiry) {
                return Math.max(0, parsed.__expiry - Date.now());
            }

            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * پاک کردن تمام داده‌های منقضی شده
     * @returns {number} تعداد آیتم‌های پاک شده
     */
    clearExpired() {
        let clearedCount = 0;
        const keys = this.keys();

        keys.forEach(key => {
            if (this.isExpired(key)) {
                this.remove(key);
                clearedCount++;
            }
        });

        if (clearedCount > 0 && this.debug) {
            console.log(`🧹 Cleared ${clearedCount} expired items`);
        }

        return clearedCount;
    }

    // ============================================================
    // بخش ۴: رمزنگاری
    // ============================================================

    /**
     * رمزنگاری داده
     * @param {string} data - داده
     * @returns {string} داده رمزنگاری شده
     * @private
     */
    _encrypt(data) {
        try {
            // Simple XOR encryption (در production از Web Crypto API استفاده شود)
            const key = this.encryptionKey;
            let result = '';
            
            for (let i = 0; i < data.length; i++) {
                const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                result += String.fromCharCode(charCode);
            }

            return btoa(unescape(encodeURIComponent(result)));
        } catch (error) {
            console.error('❌ Encryption failed:', error);
            return data;
        }
    }

    /**
     * رمزگشایی داده
     * @param {string} encryptedData - داده رمزنگاری شده
     * @returns {string} داده اصلی
     * @private
     */
    _decrypt(encryptedData) {
        try {
            const key = this.encryptionKey;
            const decoded = decodeURIComponent(escape(atob(encryptedData)));
            let result = '';
            
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                result += String.fromCharCode(charCode);
            }

            return result;
        } catch (error) {
            console.error('❌ Decryption failed:', error);
            return encryptedData;
        }
    }

    // ============================================================
    // بخش ۵: مدیریت کش
    // ============================================================

    /**
     * به‌روزرسانی کش
     * @param {string} key - کلید
     * @param {*} value - مقدار
     * @private
     */
    _updateCache(key, value) {
        if (this.cache.size >= this.maxCacheSize) {
            // حذف قدیمی‌ترین آیتم
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value: value,
            timestamp: Date.now()
        });
    }

    /**
     * دریافت از کش
     * @param {string} key - کلید
     * @returns {*|undefined}
     * @private
     */
    _getFromCache(key) {
        const cached = this.cache.get(key);
        
        if (!cached) return undefined;

        // بررسی انقضای کش
        if (Date.now() - cached.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            return undefined;
        }

        return cached.value;
    }

    /**
     * پاک کردن کش
     */
    clearCache() {
        this.cache.clear();
        
        if (this.debug) {
            console.log(' Cache cleared');
        }
    }

    // ============================================================
    // بخش ۶: مدیریت quota
    // ============================================================

    /**
     * مدیریت خطای QuotaExceeded
     * @private
     */
    _handleQuotaExceeded() {
        console.warn('⚠️ Storage quota exceeded. Cleaning up...');

        // پاک کردن داده‌های منقضی
        this.clearExpired();

        // پاک کردن کش
        this.clearCache();

        // بررسی دوباره حجم
        const usage = this.getUsage();
        
        if (usage.isAtLimit) {
            // پاک کردن داده‌های قدیمی‌تر
            this._cleanupOldData();
        }

        this._emit('quotaWarning', { usage });
    }

    /**
     * پاک کردن داده‌های قدیمی
     * @private
     */
    _cleanupOldData() {
        try {
            const keys = this.keys();
            const itemsWithTimestamp = [];

            keys.forEach(key => {
                const fullKey = this.prefix + key;
                const data = localStorage.getItem(fullKey);
                
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        const timestamp = parsed.__timestamp || parsed.createdAt || 0;
                        itemsWithTimestamp.push({ key, timestamp, size: data.length });
                    } catch (e) {
                        itemsWithTimestamp.push({ key, timestamp: 0, size: data.length });
                    }
                }
            });

            // مرتب‌سازی بر اساس تاریخ (قدیمی‌ترین اول)
            itemsWithTimestamp.sort((a, b) => a.timestamp - b.timestamp);

            // پاک کردن تا رسیدن به حجم مناسب
            let freed = 0;
            const targetFree = this.maxStorageSize * 0.2; // 20% فضا آزاد کنیم

            for (const item of itemsWithTimestamp) {
                if (freed >= targetFree) break;
                
                // نباید داده‌های حیاتی را پاک کنیم
                if (!this._isCriticalKey(item.key)) {
                    this.remove(item.key);
                    freed += item.size;
                }
            }

            if (this.debug) {
                console.log(` Freed ${this._formatBytes(freed)} of storage`);
            }
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }

    /**
     * بررسی حیاتی بودن کلید
     * @param {string} key - کلید
     * @returns {boolean}
     * @private
     */
    _isCriticalKey(key) {
        const criticalKeys = [
            'user',
            'session',
            'token',
            'settings',
            'currency'
        ];

        return criticalKeys.some(critical => key.includes(critical));
    }

    /**
     * فرمت کردن بایت‌ها
     * @param {number} bytes - بایت
     * @returns {string}
     * @private
     */
    _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ============================================================
    // بخش ۷: سیستم رویداد
    // ============================================================

    /**
     * ثبت شنونده رویداد
     * @param {string} event - نام رویداد
     * @param {Function} callback - تابع
     * @returns {Function} تابع حذف شنونده
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        this.listeners.get(event).add(callback);

        // برگرداندن تابع حذف
        return () => {
            this.off(event, callback);
        };
    }

    /**
     * حذف شنونده رویداد
     * @param {string} event - نام رویداد
     * @param {Function} callback - تابع
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * انتشار رویداد
     * @param {string} event - نام رویداد
     * @param {*} data - داده
     * @private
     */
    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Event listener error for ${event}:`, error);
                }
            });
        }
    }

    /**
     * پاک کردن تمام شنوندگان
     */
    clearListeners() {
        this.listeners.clear();
    }

    // ============================================================
    // بخش ۸: IndexedDB (برای داده‌های بزرگ)
    // ============================================================

    /**
     * باز کردن IndexedDB
     * @returns {Promise<IDBDatabase>}
     * @private
     */
    _openIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!this.isIndexedDBAvailable) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            const request = indexedDB.open('hokm_master_db', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('data')) {
                    db.createObjectStore('data', { keyPath: 'key' });
                }
                
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * ذخیره در IndexedDB
     * @param {string} store - نام store
     * @param {string} key - کلید
     * @param {*} value - مقدار
     * @returns {Promise<boolean>}
     */
    async setIndexedDB(store, key, value) {
        try {
            const db = await this._openIndexedDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([store], 'readwrite');
                const objectStore = transaction.objectStore(store);
                
                const request = objectStore.put({
                    key: key,
                    value: value,
                    timestamp: Date.now()
                });

                request.onsuccess = () => {
                    resolve(true);
                    db.close();
                };
                
                request.onerror = () => {
                    reject(request.error);
                    db.close();
                };
            });
        } catch (error) {
            console.error('❌ IndexedDB set error:', error);
            return false;
        }
    }

    /**
     * دریافت از IndexedDB
     * @param {string} store - نام store
     * @param {string} key - کلید
     * @returns {Promise<*>}
     */
    async getIndexedDB(store, key) {
        try {
            const db = await this._openIndexedDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([store], 'readonly');
                const objectStore = transaction.objectStore(store);
                
                const request = objectStore.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.value : null);
                    db.close();
                };
                
                request.onerror = () => {
                    reject(request.error);
                    db.close();
                };
            });
        } catch (error) {
            console.error(' IndexedDB get error:', error);
            return null;
        }
    }

    /**
     * حذف از IndexedDB
     * @param {string} store - نام store
     * @param {string} key - کلید
     * @returns {Promise<boolean>}
     */
    async removeIndexedDB(store, key) {
        try {
            const db = await this._openIndexedDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([store], 'readwrite');
                const objectStore = transaction.objectStore(store);
                
                const request = objectStore.delete(key);

                request.onsuccess = () => {
                    resolve(true);
                    db.close();
                };
                
                request.onerror = () => {
                    reject(request.error);
                    db.close();
                };
            });
        } catch (error) {
            console.error('❌ IndexedDB remove error:', error);
            return false;
        }
    }

    // ============================================================
    // بخش ۹: Backup و Restore
    // ============================================================

    /**
     * ایجاد backup از تمام داده‌ها
     * @returns {Object} داده‌های backup
     */
    createBackup() {
        const backup = {
            version: this.schemaVersion,
            timestamp: Date.now(),
            data: {},
            metadata: this.getUsage()
        };

        const keys = this.keys();
        
        keys.forEach(key => {
            const fullKey = this.prefix + key;
            try {
                const value = localStorage.getItem(fullKey);
                if (value) {
                    backup.data[key] = value;
                }
            } catch (error) {
                console.error(`❌ Failed to backup ${key}:`, error);
            }
        });

        if (this.debug) {
            console.log(`💾 Backup created with ${keys.length} items`);
        }

        return backup;
    }

    /**
     * بازیابی از backup
     * @param {Object} backup - داده‌های backup
     * @param {boolean} overwrite - آیا داده‌های فعلی overwrite شوند
     * @returns {boolean} موفقیت
     */
    restoreBackup(backup, overwrite = false) {
        try {
            if (!backup || !backup.data) {
                throw new Error('Invalid backup data');
            }

            if (!overwrite) {
                // فقط داده‌های موجود نیستند را اضافه کن
                Object.keys(backup.data).forEach(key => {
                    if (!this.has(key)) {
                        const fullKey = this.prefix + key;
                        localStorage.setItem(fullKey, backup.data[key]);
                    }
                });
            } else {
                // پاک کردن و بازیابی کامل
                this.clear(true);
                
                Object.keys(backup.data).forEach(key => {
                    const fullKey = this.prefix + key;
                    localStorage.setItem(fullKey, backup.data[key]);
                });
            }

            this.clearCache();

            if (this.debug) {
                console.log(`✅ Restored backup from ${new Date(backup.timestamp).toLocaleString('fa-IR')}`);
            }

            return true;
        } catch (error) {
            console.error('❌ Restore failed:', error);
            return false;
        }
    }

    /**
     * export داده‌ها به JSON
     * @returns {string} JSON string
     */
    exportToJSON() {
        const backup = this.createBackup();
        return JSON.stringify(backup, null, 2);
    }

    /**
     * import داده‌ها از JSON
     * @param {string} jsonString - JSON string
     * @param {boolean} overwrite - آیا overwrite شود
     * @returns {boolean} موفقیت
     */
    importFromJSON(jsonString, overwrite = false) {
        try {
            const backup = JSON.parse(jsonString);
            return this.restoreBackup(backup, overwrite);
        } catch (error) {
            console.error('❌ Import failed:', error);
            return false;
        }
    }

    // ============================================================
    // بخش ۱۰: توابع کمکی خاص برنامه
    // ============================================================

    /**
     * ذخیره پروفایل کاربر
     * @param {Object} profile - پروفایل
     * @returns {boolean}
     */
    saveUserProfile(profile) {
        return this.set(CONFIG.STORAGE_KEYS.PROFILE, profile, {
            encrypt: true
        });
    }

    /**
     * دریافت پروفایل کاربر
     * @returns {Object|null}
     */
    getUserProfile() {
        return this.get(CONFIG.STORAGE_KEYS.PROFILE, {
            decrypt: true,
            defaultValue: null
        });
    }

    /**
     * ذخیره تنظیمات
     * @param {Object} settings - تنظیمات
     * @returns {boolean}
     */
    saveSettings(settings) {
        return this.set(CONFIG.STORAGE_KEYS.SETTINGS, settings);
    }

    /**
     * دریافت تنظیمات
     * @returns {Object}
     */
    getSettings() {
        return this.get(CONFIG.STORAGE_KEYS.SETTINGS, {
            defaultValue: this._getDefaultSettings()
        });
    }

    /**
     * دریافت تنظیمات پیش‌فرض
     * @returns {Object}
     * @private
     */
    _getDefaultSettings() {
        return {
            sound: true,
            music: true,
            vibration: true,
            notifications: true,
            language: 'fa',
            theme: 'dark',
            graphics: 'medium',
            animations: true,
            reducedMotion: false,
            highContrast: false,
            fontSize: 1.0
        };
    }

    /**
     * ذخیره تاریخچه بازی
     * @param {Object} match - اطلاعات بازی
     * @returns {boolean}
     */
    saveMatchHistory(match) {
        const history = this.get(CONFIG.STORAGE_KEYS.MATCH_HISTORY, {
            defaultValue: []
        });

        history.unshift(match);

        // محدود کردن به 100 بازی آخر
        if (history.length > 100) {
            history.length = 100;
        }

        return this.set(CONFIG.STORAGE_KEYS.MATCH_HISTORY, history);
    }

    /**
     * دریافت تاریخچه بازی
     * @param {number} limit - تعداد
     * @returns {Array}
     */
    getMatchHistory(limit = 50) {
        const history = this.get(CONFIG.STORAGE_KEYS.MATCH_HISTORY, {
            defaultValue: []
        });

        return history.slice(0, limit);
    }

    /**
     * ذخیره آمار
     * @param {Object} stats - آمار
     * @returns {boolean}
     */
    saveStatistics(stats) {
        return this.set(CONFIG.STORAGE_KEYS.STATISTICS, stats);
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStatistics() {
        return this.get(CONFIG.STORAGE_KEYS.STATISTICS, {
            defaultValue: this._getDefaultStatistics()
        });
    }

    /**
     * آمار پیش‌فرض
     * @returns {Object}
     * @private
     */
    _getDefaultStatistics() {
        return {
            totalGames: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            tricksWon: 0,
            kotCount: 0,
            bestStreak: 0,
            currentStreak: 0,
            totalPlayTime: 0,
            averageGameDuration: 0,
            coinsEarned: 0,
            coinsSpent: 0,
            xpEarned: 0,
            missionsCompleted: 0,
            achievementsUnlocked: 0,
            tournamentsWon: 0,
            friendsAdded: 0
        };
    }

    /**
     * ذخیره لیست دوستان
     * @param {Array} friends - دوستان
     * @returns {boolean}
     */
    saveFriends(friends) {
        return this.set(CONFIG.STORAGE_KEYS.FRIENDS, friends);
    }

    /**
     * دریافت لیست دوستان
     * @returns {Array}
     */
    getFriends() {
        return this.get(CONFIG.STORAGE_KEYS.FRIENDS, {
            defaultValue: []
        });
    }

    /**
     * ذخیره لیست مسدودشده‌ها
     * @param {Array} blocked - مسدودشده‌ها
     * @returns {boolean}
     */
    saveBlocked(blocked) {
        return this.set(CONFIG.STORAGE_KEYS.BLOCKED, blocked);
    }

    /**
     * دریافت لیست مسدودشده‌ها
     * @returns {Array}
     */
    getBlocked() {
        return this.get(CONFIG.STORAGE_KEYS.BLOCKED, {
            defaultValue: []
        });
    }

    /**
     * ذخیره اعلان‌ها
     * @param {Array} notifications - اعلان‌ها
     * @returns {boolean}
     */
    saveNotifications(notifications) {
        return this.set(CONFIG.STORAGE_KEYS.NOTIFICATIONS, notifications);
    }

    /**
     * دریافت اعلان‌ها
     * @returns {Array}
     */
    getNotifications() {
        return this.get(CONFIG.STORAGE_KEYS.NOTIFICATIONS, {
            defaultValue: []
        });
    }

    /**
     * ذخیره موجودی
     * @param {Object} currency - موجودی
     * @returns {boolean}
     */
    saveCurrency(currency) {
        return this.set(CONFIG.STORAGE_KEYS.CURRENCY, currency, {
            encrypt: true
        });
    }

    /**
     * دریافت موجودی
     * @returns {Object}
     */
    getCurrency() {
        return this.get(CONFIG.STORAGE_KEYS.CURRENCY, {
            decrypt: true,
            defaultValue: {
                coins: CONFIG.CURRENCY.COINS.INITIAL_AMOUNT,
                gems: CONFIG.CURRENCY.GEMS.INITIAL_AMOUNT,
                tickets: CONFIG.CURRENCY.TICKETS.INITIAL_AMOUNT,
                eventTokens: CONFIG.CURRENCY.EVENT_TOKENS.INITIAL_AMOUNT
            }
        });
    }

    /**
     * ذخیره Inventory
     * @param {Object} inventory - موجودی آیتم‌ها
     * @returns {boolean}
     */
    saveInventory(inventory) {
        return this.set(CONFIG.STORAGE_KEYS.INVENTORY, inventory);
    }

    /**
     * دریافت Inventory
     * @returns {Object}
     */
    getInventory() {
        return this.get(CONFIG.STORAGE_KEYS.INVENTORY, {
            defaultValue: {
                avatars: [1],
                frames: [1],
                cardBacks: [1],
                tables: [1],
                titles: [1],
                emotes: [],
                effects: []
            }
        });
    }

    /**
     * ذخیره تجهیزات
     * @param {Object} equipment - تجهیزات فعلی
     * @returns {boolean}
     */
    saveEquipment(equipment) {
        return this.set(CONFIG.STORAGE_KEYS.EQUIPMENT, equipment);
    }

    /**
     * دریافت تجهیزات
     * @returns {Object}
     */
    getEquipment() {
        return this.get(CONFIG.STORAGE_KEYS.EQUIPMENT, {
            defaultValue: {
                avatar: 1,
                frame: 1,
                cardBack: 1,
                table: 1,
                title: 1,
                emote: null,
                effect: null
            }
        });
    }

    /**
     * ذخیره مأموریت‌ها
     * @param {Object} missions - مأموریت‌ها
     * @returns {boolean}
     */
    saveMissions(missions) {
        return this.set(CONFIG.STORAGE_KEYS.MISSIONS, missions);
    }

    /**
     * دریافت مأموریت‌ها
     * @returns {Object}
     */
    getMissions() {
        return this.get(CONFIG.STORAGE_KEYS.MISSIONS, {
            defaultValue: {
                daily: [],
                weekly: [],
                monthly: [],
                lastDailyReset: null,
                lastWeeklyReset: null,
                lastMonthlyReset: null
            }
        });
    }

    /**
     * ذخیره دستاوردها
     * @param {Object} achievements - دستاوردها
     * @returns {boolean}
     */
    saveAchievements(achievements) {
        return this.set(CONFIG.STORAGE_KEYS.ACHIEVEMENTS, achievements);
    }

    /**
     * دریافت دستاوردها
     * @returns {Object}
     */
    getAchievements() {
        return this.get(CONFIG.STORAGE_KEYS.ACHIEVEMENTS, {
            defaultValue: {
                unlocked: [],
                progress: {}
            }
        });
    }

    /**
     * ذخیره جایزه روزانه
     * @param {Object} dailyReward - جایزه روزانه
     * @returns {boolean}
     */
    saveDailyReward(dailyReward) {
        return this.set(CONFIG.STORAGE_KEYS.DAILY_REWARD, dailyReward);
    }

    /**
     * دریافت جایزه روزانه
     * @returns {Object}
     */
    getDailyReward() {
        return this.get(CONFIG.STORAGE_KEYS.DAILY_REWARD, {
            defaultValue: {
                currentDay: 1,
                lastClaimed: null,
                streak: 0,
                cycle: 1
            }
        });
    }

    /**
     * ذخیره لیگ
     * @param {Object} league - اطلاعات لیگ
     * @returns {boolean}
     */
    saveLeague(league) {
        return this.set(CONFIG.STORAGE_KEYS.LEAGUE, league);
    }

    /**
     * دریافت لیگ
     * @returns {Object}
     */
    getLeague() {
        return this.get(CONFIG.STORAGE_KEYS.LEAGUE, {
            defaultValue: {
                currentTier: 'bronze',
                rating: CONFIG.LEAGUE.DEFAULT_RATING,
                season: 1,
                progress: 0
            }
        });
    }

    /**
     * ذخیره وضعیت آموزش
     * @param {Object} tutorial - وضعیت آموزش
     * @returns {boolean}
     */
    saveTutorial(tutorial) {
        return this.set(CONFIG.STORAGE_KEYS.TUTORIAL, tutorial);
    }

    /**
     * دریافت وضعیت آموزش
     * @returns {Object}
     */
    getTutorial() {
        return this.get(CONFIG.STORAGE_KEYS.TUTORIAL, {
            defaultValue: {
                completed: false,
                currentStep: 0,
                watchedSteps: []
            }
        });
    }

    // ============================================================
    // بخش ۱۱: توابع کمکی عمومی
    // ============================================================

    /**
     * دریافت اطلاعات کامل storage
     * @returns {Object}
     */
    getInfo() {
        return {
            schemaVersion: this.schemaVersion,
            isLocalStorageAvailable: this.isLocalStorageAvailable,
            isSessionStorageAvailable: this.isSessionStorageAvailable,
            isIndexedDBAvailable: this.isIndexedDBAvailable,
            usage: this.getUsage(),
            cacheSize: this.cache.size,
            listenersCount: this.listeners.size,
            totalKeys: this.keys().length
        };
    }

    /**
     * لاگ وضعیت storage
     */
    logStatus() {
        const info = this.getInfo();
        
        console.log('📦 Storage Status:');
        console.log('  Schema Version:', info.schemaVersion);
        console.log('  localStorage:', info.isLocalStorageAvailable ? '✅' : '❌');
        console.log('  sessionStorage:', info.isSessionStorageAvailable ? '✅' : '❌');
        console.log('  IndexedDB:', info.isIndexedDBAvailable ? '✅' : '❌');
        console.log('  Usage:', info.usage.usedFormatted, '/', info.usage.totalFormatted);
        console.log('  Percentage:', info.usage.percentage.toFixed(2) + '%');
        console.log('  Cache Size:', info.cacheSize);
        console.log('  Total Keys:', info.totalKeys);
    }

    /**
     * تست عملکرد storage
     * @returns {Object} نتیجه تست
     */
    runDiagnostics() {
        const results = {
            localStorage: false,
            sessionStorage: false,
            indexedDB: false,
            encryption: false,
            expiry: false,
            quota: false
        };

        // تست localStorage
        try {
            const testKey = this.prefix + 'diag_test';
            localStorage.setItem(testKey, 'test');
            const value = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            results.localStorage = value === 'test';
        } catch (e) {
            results.localStorage = false;
        }

        // تست sessionStorage
        try {
            const testKey = this.prefix + 'diag_test';
            sessionStorage.setItem(testKey, 'test');
            const value = sessionStorage.getItem(testKey);
            sessionStorage.removeItem(testKey);
            results.sessionStorage = value === 'test';
        } catch (e) {
            results.sessionStorage = false;
        }

        // تست IndexedDB
        results.indexedDB = this.isIndexedDBAvailable;

        // تست رمزنگاری
        try {
            const original = 'test data';
            const encrypted = this._encrypt(original);
            const decrypted = this._decrypt(encrypted);
            results.encryption = original === decrypted;
        } catch (e) {
            results.encryption = false;
        }

        // تست انقضا
        try {
            this.set('diag_test', 'test', { ttl: 1000 });
            const value = this.get('diag_test');
            results.expiry = value === 'test';
            
            // صبر کن تا منقضی شود
            setTimeout(() => {
                const expiredValue = this.get('diag_test');
                console.log('Expiry test after timeout:', expiredValue === null ? '✅' : '❌');
            }, 1100);
        } catch (e) {
            results.expiry = false;
        }

        // تست quota
        results.quota = !this.getUsage().isAtLimit;

        return results;
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const storage = new StorageManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageManager, storage };
} else {
    window.StorageManager = StorageManager;
    window.storage = storage;
}

console.log('✅ StorageManager loaded - Schema Version:', storage.schemaVersion);
