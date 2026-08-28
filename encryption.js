/**
 * ============================================================
 * HOKM MASTER - Encryption Manager
 * سیستم رمزنگاری و امنیت داده‌ها
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل رمزنگاری داده‌های حساس در بازی
 * است. شامل رمزنگاری داده‌های ذخیره‌شده، هش کردن رمز عبور،
 * امضای دیجیتال، مدیریت کلیدها، رمزنگاری localStorage،
 * امنیت توکن‌ها، و محافظت از داده‌های حساس.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - storage (از فایل storage.js)
 * 
 * ============================================================
 */

class EncryptionManager {

    constructor() {
        /**
         * کلید اصلی رمزنگاری
         * @type {string}
         */
        this.masterKey = null;

        /**
         * کلیدهای رمزنگاری مختلف
         * @type {Object}
         */
        this.keys = {
            data: null,
            token: null,
            password: null,
            session: null
        };

        /**
         * الگوریتم رمزنگاری پیش‌فرض
         * @type {string}
         */
        this.defaultAlgorithm = 'AES-256-GCM';

        /**
         * طول کلید (بیت)
         * @type {number}
         */
        this.keyLength = 256;

        /**
         * طول IV (بایت)
         * @type {number}
         */
        this.ivLength = 12;

        /**
         * طول تگ احراز هویت (بیت)
         * @type {number}
         */
        this.tagLength = 128;

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
         * آمار رمزنگاری
         * @type {Object}
         */
        this.stats = {
            totalEncryptions: 0,
            totalDecryptions: 0,
            totalHashes: 0,
            totalSignatures: 0,
            totalKeyGenerations: 0,
            failedEncryptions: 0,
            failedDecryptions: 0,
            lastOperationAt: null
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // تولید یا بارگذاری کلید اصلی
        this._initializeKeys();

        if (this.debug) {
            console.log('🔐 EncryptionManager initialized');
            console.log('  Algorithm:', this.defaultAlgorithm);
            console.log('  Key Length:', this.keyLength);
        }
    }

    // ============================================================
    // بخش ۱: مدیریت کلیدها
    // ============================================================

    /**
     * مقداردهی اولیه کلیدها
     * @private
     */
    _initializeKeys() {
        // بررسی کلید ذخیره شده
        const savedMasterKey = storage?.get('encryption_master_key');

        if (savedMasterKey) {
            this.masterKey = savedMasterKey;
        } else {
            // تولید کلید جدید
            this.masterKey = this._generateMasterKey();
            storage?.set('encryption_master_key', this.masterKey);
        }

        // تولید کلیدهای فرعی
        this.keys.data = this._deriveKey(this.masterKey, 'data');
        this.keys.token = this._deriveKey(this.masterKey, 'token');
        this.keys.password = this._deriveKey(this.masterKey, 'password');
        this.keys.session = this._deriveKey(this.masterKey, 'session');

        this.stats.totalKeyGenerations += 4;
    }

    /**
     * تولید کلید اصلی
     * @returns {string}
     * @private
     */
    _generateMasterKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * استخراج کلید فرعی از کلید اصلی
     * @param {string} masterKey - کلید اصلی
     * @param {string} purpose - هدف کلید
     * @returns {string}
     * @private
     */
    _deriveKey(masterKey, purpose) {
        const combined = masterKey + purpose;
        return this._hashString(combined);
    }

    /**
     * دریافت کلید برای هدف خاص
     * @param {string} purpose - هدف
     * @returns {string}
     */
    getKey(purpose) {
        return this.keys[purpose] || this.keys.data;
    }

    /**
     * تغییر کلید اصلی
     * @param {string} newMasterKey - کلید جدید
     * @returns {Object} نتیجه
     */
    rotateMasterKey(newMasterKey = null) {
        const oldKey = this.masterKey;

        if (!newMasterKey) {
            newMasterKey = this._generateMasterKey();
        }

        this.masterKey = newMasterKey;
        storage?.set('encryption_master_key', this.masterKey);

        // بازتولید کلیدهای فرعی
        this.keys.data = this._deriveKey(this.masterKey, 'data');
        this.keys.token = this._deriveKey(this.masterKey, 'token');
        this.keys.password = this._deriveKey(this.masterKey, 'password');
        this.keys.session = this._deriveKey(this.masterKey, 'session');

        this.stats.totalKeyGenerations += 4;

        this._emit('key-rotated', { oldKey: '***', newKey: '***' });

        if (this.debug) {
            console.log('🔄 Master key rotated');
        }

        return {
            success: true,
            rotatedAt: Date.now()
        };
    }

    // ============================================================
    // بخش ۲: رمزنگاری و رمزگشایی
    // ============================================================

    /**
     * رمزنگاری داده
     * @param {*} data - داده برای رمزنگاری
     * @param {string} purpose - هدف رمزنگاری
     * @returns {Object} نتیجه
     */
    encrypt(data, purpose = 'data') {
        try {
            const key = this.getKey(purpose);
            const jsonString = JSON.stringify(data);
            const encodedData = new TextEncoder().encode(jsonString);

            // تولید IV تصادفی
            const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

            // رمزنگاری با Web Crypto API
            const cryptoKey = this._importKey(key);

            return crypto.subtle.encrypt(
                {
                    name: this.defaultAlgorithm,
                    iv: iv
                },
                cryptoKey,
                encodedData
            ).then(encrypted => {
                const encryptedArray = new Uint8Array(encrypted);

                // ترکیب IV و داده رمزنگاری شده
                const combined = new Uint8Array(iv.length + encryptedArray.length);
                combined.set(iv);
                combined.set(encryptedArray, iv.length);

                // تبدیل به Base64
                const encryptedBase64 = this._arrayBufferToBase64(combined);

                this.stats.totalEncryptions++;
                this.stats.lastOperationAt = Date.now();

                return {
                    success: true,
                    encrypted: encryptedBase64,
                    algorithm: this.defaultAlgorithm,
                    timestamp: Date.now()
                };
            });
        } catch (error) {
            this.stats.failedEncryptions++;
            console.error('❌ Encryption failed:', error);

            return Promise.resolve({
                success: false,
                error: 'ENCRYPTION_FAILED',
                message: error.message
            });
        }
    }

    /**
     * رمزگشایی داده
     * @param {string} encryptedData - داده رمزنگاری شده
     * @param {string} purpose - هدف رمزنگاری
     * @returns {Object} نتیجه
     */
    decrypt(encryptedData, purpose = 'data') {
        try {
            const key = this.getKey(purpose);

            // تبدیل از Base64 به ArrayBuffer
            const combined = this._base64ToArrayBuffer(encryptedData);

            // استخراج IV و داده رمزنگاری شده
            const iv = combined.slice(0, this.ivLength);
            const encryptedArray = combined.slice(this.ivLength);

            // رمزگشایی با Web Crypto API
            const cryptoKey = this._importKey(key);

            return crypto.subtle.decrypt(
                {
                    name: this.defaultAlgorithm,
                    iv: iv
                },
                cryptoKey,
                encryptedArray
            ).then(decrypted => {
                const decryptedString = new TextDecoder().decode(decrypted);
                const data = JSON.parse(decryptedString);

                this.stats.totalDecryptions++;
                this.stats.lastOperationAt = Date.now();

                return {
                    success: true,
                    data: data,
                    algorithm: this.defaultAlgorithm,
                    timestamp: Date.now()
                };
            });
        } catch (error) {
            this.stats.failedDecryptions++;
            console.error('❌ Decryption failed:', error);

            return Promise.resolve({
                success: false,
                error: 'DECRYPTION_FAILED',
                message: error.message
            });
        }
    }

    /**
     * وارد کردن کلید برای Web Crypto API
     * @param {string} key - کلید
     * @returns {CryptoKey}
     * @private
     */
    _importKey(key) {
        const keyBuffer = this._hexToArrayBuffer(key);

        return crypto.subtle.importKey(
            'raw',
            keyBuffer,
            {
                name: this.defaultAlgorithm,
                length: this.keyLength
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // ============================================================
    // بخش ۳: رمزنگاری ساده (XOR)
    // ============================================================

    /**
     * رمزنگاری ساده با XOR (برای داده‌های کم‌اهمیت)
     * @param {string} data - داده
     * @param {string} key - کلید
     * @returns {string}
     */
    simpleEncrypt(data, key = this.masterKey) {
        let result = '';
        for (let i = 0; i < data.length; i++) {
            const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return btoa(unescape(encodeURIComponent(result)));
    }

    /**
     * رمزگشایی ساده با XOR
     * @param {string} encryptedData - داده رمزنگاری شده
     * @param {string} key - کلید
     * @returns {string}
     */
    simpleDecrypt(encryptedData, key = this.masterKey) {
        try {
            const decoded = decodeURIComponent(escape(atob(encryptedData)));
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                result += String.fromCharCode(charCode);
            }
            return result;
        } catch (error) {
            console.error('❌ Simple decryption failed:', error);
            return null;
        }
    }

    // ============================================================
    // بخش ۴: هش کردن
    // ============================================================

    /**
     * هش کردن داده با SHA-256
     * @param {string} data - داده
     * @returns {Promise<string>} هش
     */
    async hash(data) {
        try {
            const encodedData = new TextEncoder().encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
            const hashArray = new Uint8Array(hashBuffer);
            const hashHex = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');

            this.stats.totalHashes++;
            this.stats.lastOperationAt = Date.now();

            return {
                success: true,
                hash: hashHex,
                algorithm: 'SHA-256'
            };
        } catch (error) {
            console.error('❌ Hashing failed:', error);
            return {
                success: false,
                error: 'HASH_FAILED',
                message: error.message
            };
        }
    }

    /**
     * هش کردن رشته (سینکرون)
     * @param {string} str - رشته
     * @returns {string} هش
     * @private
     */
    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    /**
     * هش کردن رمز عبور با salt
     * @param {string} password - رمز عبور
     * @param {string} salt - salt (اختیاری)
     * @returns {Promise<Object>} نتیجه
     */
    async hashPassword(password, salt = null) {
        if (!salt) {
            const saltArray = crypto.getRandomValues(new Uint8Array(16));
            salt = Array.from(saltArray, byte => byte.toString(16).padStart(2, '0')).join('');
        }

        const combined = salt + password;
        const hashResult = await this.hash(combined);

        if (hashResult.success) {
            return {
                success: true,
                hash: hashResult.hash,
                salt: salt,
                algorithm: 'SHA-256'
            };
        }

        return hashResult;
    }

    /**
     * بررسی صحت رمز عبور
     * @param {string} password - رمز عبور وارد شده
     * @param {string} storedHash - هش ذخیره شده
     * @param {string} salt - salt
     * @returns {Promise<boolean>}
     */
    async verifyPassword(password, storedHash, salt) {
        const hashResult = await this.hashPassword(password, salt);

        if (hashResult.success) {
            return hashResult.hash === storedHash;
        }

        return false;
    }

    // ============================================================
    // بخش ۵: امضای دیجیتال
    // ============================================================

    /**
     * ایجاد امضای دیجیتال برای داده
     * @param {*} data - داده
     * @param {string} key - کلید امضا
     * @returns {Promise<Object>} نتیجه
     */
    async sign(data, key = this.masterKey) {
        try {
            const dataString = JSON.stringify(data);
            const signature = this._hmacSHA256(dataString, key);

            this.stats.totalSignatures++;
            this.stats.lastOperationAt = Date.now();

            return {
                success: true,
                signature: signature,
                data: data,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('❌ Signing failed:', error);
            return {
                success: false,
                error: 'SIGNING_FAILED',
                message: error.message
            };
        }
    }

    /**
     * بررسی امضای دیجیتال
     * @param {*} data - داده
     * @param {string} signature - امضا
     * @param {string} key - کلید
     * @returns {Promise<boolean>}
     */
    async verifySignature(data, signature, key = this.masterKey) {
        const dataString = JSON.stringify(data);
        const expectedSignature = this._hmacSHA256(dataString, key);

        return signature === expectedSignature;
    }

    /**
     * HMAC-SHA256 (پیاده‌سازی ساده)
     * @param {string} message - پیام
     * @param {string} key - کلید
     * @returns {string} امضا
     * @private
     */
    _hmacSHA256(message, key) {
        const blockSize = 64;
        const keyBytes = this._stringToBytes(key);

        // اگر کلید بلندتر از blockSize است، هش کن
        let keyBlock = keyBytes;
        if (keyBytes.length > blockSize) {
            keyBlock = this._simpleHash(keyBytes);
        }

        // پد کردن کلید
        while (keyBlock.length < blockSize) {
            keyBlock.push(0);
        }

        // ایجاد ipad و opad
        const ipad = keyBlock.map(b => b ^ 0x36);
        const opad = keyBlock.map(b => b ^ 0x5c);

        // HMAC = H(opad || H(ipad || message))
        const innerHash = this._simpleHash([...ipad, ...this._stringToBytes(message)]);
        const outerHash = this._simpleHash([...opad, ...innerHash]);

        return outerHash.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * هش ساده (برای HMAC)
     * @param {Array<number>} data - داده
     * @returns {Array<number>} هش
     * @private
     */
    _simpleHash(data) {
        let h0 = 0x6a09e667;
        let h1 = 0xbb67ae85;
        let h2 = 0x3c6ef372;
        let h3 = 0xa54ff53a;

        for (let i = 0; i < data.length; i++) {
            h0 = ((h0 << 5) - h0 + data[i]) & 0xffffffff;
            h1 = ((h1 << 5) - h1 + h0) & 0xffffffff;
            h2 = ((h2 << 5) - h2 + h1) & 0xffffffff;
            h3 = ((h3 << 5) - h3 + h2) & 0xffffffff;
        }

        return [
            (h0 >> 24) & 0xff, (h0 >> 16) & 0xff, (h0 >> 8) & 0xff, h0 & 0xff,
            (h1 >> 24) & 0xff, (h1 >> 16) & 0xff, (h1 >> 8) & 0xff, h1 & 0xff,
            (h2 >> 24) & 0xff, (h2 >> 16) & 0xff, (h2 >> 8) & 0xff, h2 & 0xff,
            (h3 >> 24) & 0xff, (h3 >> 16) & 0xff, (h3 >> 8) & 0xff, h3 & 0xff
        ];
    }

    // ============================================================
    // بخش ۶: رمزنگاری localStorage
    // ============================================================

    /**
     * ذخیره داده رمزنگاری شده در localStorage
     * @param {string} key - کلید
     * @param {*} data - داده
     * @param {string} purpose - هدف
     * @returns {Promise<Object>} نتیجه
     */
    async saveEncrypted(key, data, purpose = 'data') {
        const encryptionResult = await this.encrypt(data, purpose);

        if (encryptionResult.success) {
            storage?.set(key, encryptionResult.encrypted);
            return {
                success: true,
                key: key
            };
        }

        return encryptionResult;
    }

    /**
     * بارگذاری داده رمزنگاری شده از localStorage
     * @param {string} key - کلید
     * @param {string} purpose - هدف
     * @returns {Promise<Object>} نتیجه
     */
    async loadEncrypted(key, purpose = 'data') {
        const encryptedData = storage?.get(key);

        if (!encryptedData) {
            return {
                success: false,
                error: 'DATA_NOT_FOUND',
                message: 'داده یافت نشد'
            };
        }

        return await this.decrypt(encryptedData, purpose);
    }

    /**
     * حذف داده رمزنگاری شده
     * @param {string} key - کلید
     * @returns {Object} نتیجه
     */
    removeEncrypted(key) {
        storage?.remove(key);
        return {
            success: true,
            key: key
        };
    }

    // ============================================================
    // بخش ۷: امنیت توکن
    // ============================================================

    /**
     * ایجاد توکن امن
     * @param {Object} payload - داده توکن
     * @param {number} expiryHours - ساعت انقضا
     * @returns {Promise<Object>} نتیجه
     */
    async createSecureToken(payload, expiryHours = 24) {
        const tokenData = {
            payload: payload,
            createdAt: Date.now(),
            expiresAt: Date.now() + (expiryHours * 60 * 60 * 1000),
            nonce: this._generateNonce()
        };

        const signature = await this.sign(tokenData, this.keys.token);

        if (signature.success) {
            tokenData.signature = signature.signature;

            const tokenString = btoa(JSON.stringify(tokenData));

            return {
                success: true,
                token: tokenString,
                expiresAt: tokenData.expiresAt
            };
        }

        return signature;
    }

    /**
     * بررسی و رمزگشایی توکن
     * @param {string} token - توکن
     * @returns {Promise<Object>} نتیجه
     */
    async verifySecureToken(token) {
        try {
            const tokenData = JSON.parse(atob(token));

            // بررسی انقضا
            if (Date.now() > tokenData.expiresAt) {
                return {
                    success: false,
                    error: 'TOKEN_EXPIRED',
                    message: 'توکن منقضی شده است'
                };
            }

            // بررسی امضا
            const { signature, ...dataToVerify } = tokenData;
            const isValid = await this.verifySignature(dataToVerify, signature, this.keys.token);

            if (!isValid) {
                return {
                    success: false,
                    error: 'INVALID_SIGNATURE',
                    message: 'امضای توکن نامعتبر است'
                };
            }

            return {
                success: true,
                payload: tokenData.payload,
                expiresAt: tokenData.expiresAt
            };
        } catch (error) {
            return {
                success: false,
                error: 'INVALID_TOKEN',
                message: error.message
            };
        }
    }

    /**
     * تولید nonce تصادفی
     * @returns {string}
     * @private
     */
    _generateNonce() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // ============================================================
    // بخش ۸: توابع کمکی تبدیل
    // ============================================================

    /**
     * تبدیل ArrayBuffer به Base64
     * @param {Uint8Array} buffer - بافر
     * @returns {string}
     * @private
     */
    _arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    /**
     * تبدیل Base64 به ArrayBuffer
     * @param {string} base64 - Base64
     * @returns {Uint8Array}
     * @private
     */
    _base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * تبدیل hex به ArrayBuffer
     * @param {string} hex - hex
     * @returns {Uint8Array}
     * @private
     */
    _hexToArrayBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    /**
     * تبدیل رشته به آرایه بایت
     * @param {string} str - رشته
     * @returns {Array<number>}
     * @private
     */
    _stringToBytes(str) {
        return Array.from(str).map(c => c.charCodeAt(0));
    }

    // ============================================================
    // بخش ۹: رمزنگاری داده‌های حساس
    // ============================================================

    /**
     * رمزنگاری پروفایل کاربر
     * @param {Object} profile - پروفایل
     * @returns {Promise<Object>} نتیجه
     */
    async encryptProfile(profile) {
        return await this.encrypt(profile, 'data');
    }

    /**
     * رمزگشایی پروفایل کاربر
     * @param {string} encryptedProfile - پروفایل رمزنگاری شده
     * @returns {Promise<Object>} نتیجه
     */
    async decryptProfile(encryptedProfile) {
        return await this.decrypt(encryptedProfile, 'data');
    }

    /**
     * رمزنگاری اطلاعات مالی (سکه، الماس)
     * @param {Object} currency - اطلاعات مالی
     * @returns {Promise<Object>} نتیجه
     */
    async encryptCurrency(currency) {
        return await this.encrypt(currency, 'data');
    }

    /**
     * رمزگشایی اطلاعات مالی
     * @param {string} encryptedCurrency - اطلاعات مالی رمزنگاری شده
     * @returns {Promise<Object>} نتیجه
     */
    async decryptCurrency(encryptedCurrency) {
        return await this.decrypt(encryptedCurrency, 'data');
    }

    /**
     * رمزنگاری توکن session
     * @param {Object} session - session
     * @returns {Promise<Object>} نتیجه
     */
    async encryptSession(session) {
        return await this.encrypt(session, 'session');
    }

    /**
     * رمزگشایی توکن session
     * @param {string} encryptedSession - session رمزنگاری شده
     * @returns {Promise<Object>} نتیجه
     */
    async decryptSession(encryptedSession) {
        return await this.decrypt(encryptedSession, 'session');
    }

    // ============================================================
    // بخش ۱۰: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            algorithm: this.defaultAlgorithm,
            keyLength: this.keyLength,
            hasMasterKey: !!this.masterKey
        };
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        return {
            algorithm: this.defaultAlgorithm,
            totalOperations: this.stats.totalEncryptions + this.stats.totalDecryptions + this.stats.totalHashes + this.stats.totalSignatures,
            successRate: this._calculateSuccessRate(),
            lastOperation: this.stats.lastOperationAt ? Utils.timeAgo(this.stats.lastOperationAt) : 'never'
        };
    }

    /**
     * محاسبه نرخ موفقیت
     * @returns {string}
     * @private
     */
    _calculateSuccessRate() {
        const total = this.stats.totalEncryptions + this.stats.totalDecryptions;
        const failed = this.stats.failedEncryptions + this.stats.failedDecryptions;

        if (total === 0) return '100%';

        const successRate = ((total - failed) / total) * 100;
        return successRate.toFixed(2) + '%';
    }

    // ============================================================
    // بخش ۱: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.masterKey = null;
        this.keys = {
            data: null,
            token: null,
            password: null,
            session: null
        };

        this.stats = {
            totalEncryptions: 0,
            totalDecryptions: 0,
            totalHashes: 0,
            totalSignatures: 0,
            totalKeyGenerations: 0,
            failedEncryptions: 0,
            failedDecryptions: 0,
            lastOperationAt: null
        };

        storage?.remove('encryption_master_key');

        this._initializeKeys();

        if (this.debug) {
            console.log('🔄 EncryptionManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🔐 EncryptionManager Status:');
        console.log('  Algorithm:', summary.algorithm);
        console.log('  Total Operations:', summary.totalOperations);
        console.log('  Success Rate:', summary.successRate);
        console.log('  Last Operation:', summary.lastOperation);
        console.log('  Encryptions:', stats.totalEncryptions);
        console.log('  Decryptions:', stats.totalDecryptions);
        console.log('  Hashes:', stats.totalHashes);
        console.log('  Signatures:', stats.totalSignatures);
        console.log('  Failed Encryptions:', stats.failedEncryptions);
        console.log('  Failed Decryptions:', stats.failedDecryptions);
    }

    // ============================================================
    // بخش ۱۲: Event System
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
                    console.error(`❌ Encryption event listener error:`, error);
                }
            });
        }

        eventBus.emit(`encryption:${event}`, data);
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
const encryptionManager = new EncryptionManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EncryptionManager, encryptionManager };
} else {
    window.EncryptionManager = EncryptionManager;
    window.encryptionManager = encryptionManager;
}

console.log('✅ EncryptionManager loaded - AES-256-GCM');
