/**
 * ============================================================
 * HOKM MASTER - Security Validation Manager
 * سیستم اعتبارسنجی امنیتی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل اعتبارسنجی امنیتی در بازی است.
 * شامل اعتبارسنجی ورودی‌ها، جلوگیری از XSS، CSRF، SQL Injection،
 * Rate Limiting، اعتبارسنجی فایل، URL، ایمیل، تلفن، نام کاربری،
 * رمز عبور، و محافظت از داده‌های حساس.
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

class SecurityValidationManager {

    constructor() {
        /**
         * قوانین اعتبارسنجی
         * @type {Object}
         */
        this.rules = this._defineValidationRules();

        /**
         * Rate Limiter
         * @type {Map<string, Array<number>>}
         */
        this.rateLimits = new Map();

        /**
         * CSRF Token
         * @type {string}
         */
        this.csrfToken = null;

        /**
         * لیست IP های مسدود
         * @type {Set<string>}
         */
        this.blockedIPs = new Set();

        /**
         * لیست User Agent های مشکوک
         * @type {Array<string>}
         */
        this.suspiciousUserAgents = [
            'bot',
            'crawler',
            'spider',
            'scraper',
            'curl',
            'wget',
            'python-requests',
            'go-http-client'
        ];

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
         * آمار اعتبارسنجی
         * @type {Object}
         */
        this.stats = {
            totalValidations: 0,
            passedValidations: 0,
            failedValidations: 0,
            xssAttempts: 0,
            injectionAttempts: 0,
            rateLimitHits: 0,
            csrfFailures: 0,
            invalidInputs: 0,
            lastValidationAt: null
        };

        /**
         * محدودیت‌های Rate Limiting
         * @type {Object}
         */
        this.rateLimitConfig = {
            api: { maxRequests: 60, windowMs: 60000 },
            login: { maxAttempts: 10, windowMs: 3600000 },
            otp: { maxAttempts: 5, windowMs: 600000 },
            chat: { maxMessages: 20, windowMs: 60000 },
            report: { maxReports: 5, windowMs: 86400000 },
            passwordReset: { maxAttempts: 3, windowMs: 3600000 },
            fileUpload: { maxUploads: 10, windowMs: 3600000 }
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // تولید CSRF Token
        this.csrfToken = this._generateCSRFToken();

        // بارگذاری داده‌ها
        this._loadData();

        if (this.debug) {
            console.log('️ SecurityValidationManager initialized');
            console.log('  CSRF Token:', this.csrfToken.substring(0, 10) + '...');
            console.log('  Rate Limit Rules:', Object.keys(this.rateLimitConfig).length);
        }
    }

    // ============================================================
    // بخش ۱: تعریف قوانین اعتبارسنجی
    // ============================================================

    /**
     * تعریف قوانین اعتبارسنجی
     * @returns {Object}
     * @private
     */
    _defineValidationRules() {
        return {
            email: {
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                minLength: 5,
                maxLength: 254,
                message: 'ایمیل نامعتبر است'
            },
            phone: {
                pattern: /^09\d{9}$/,
                internationalPattern: /^\+989\d{9}$/,
                minLength: 10,
                maxLength: 13,
                message: 'شماره موبایل نامعتبر است'
            },
            username: {
                pattern: /^[a-zA-Z0-9_\u0600-\u06FF]{3,30}$/,
                minLength: 3,
                maxLength: 30,
                reserved: ['admin', 'system', 'support', 'hokm', 'master', 'moderator'],
                message: 'نام کاربری نامعتبر است (3-30 کاراکتر، فقط حروف، اعداد و _)'
            },
            password: {
                minLength: 8,
                maxLength: 128,
                requireUppercase: true,
                requireLowercase: true,
                requireNumber: true,
                requireSpecial: false,
                message: 'رمز عبور باید حداقل 8 کاراکتر و شامل حرف بزرگ، کوچک و عدد باشد'
            },
            otp: {
                pattern: /^\d{6}$/,
                length: 6,
                message: 'کد OTP باید 6 رقم باشد'
            },
            roomCode: {
                pattern: /^\d{5}$/,
                length: 5,
                message: 'کد اتاق باید 5 رقم باشد'
            },
            url: {
                pattern: /^https?:\/\/[^\s]+$/,
                maxLength: 2048,
                allowedProtocols: ['http:', 'https:'],
                message: 'URL نامعتبر است'
            },
            chatMessage: {
                minLength: 1,
                maxLength: 250,
                message: 'پیام باید بین 1 تا 250 کاراکتر باشد'
            },
            displayName: {
                pattern: /^[\u0600-\u06FFa-zA-Z0-9\s]{2,30}$/,
                minLength: 2,
                maxLength: 30,
                message: 'نام نمایشی نامعتبر است'
            },
            bio: {
                minLength: 0,
                maxLength: 500,
                message: 'بیوگرافی باید حداکثر 500 کاراکتر باشد'
            },
            reportReason: {
                minLength: 10,
                maxLength: 1000,
                message: 'دلیل گزارش باید بین 10 تا 1000 کاراکتر باشد'
            }
        };
    }

    // ============================================================
    // بخش ۲: اعتبارسنجی عمومی
    // ============================================================

    /**
     * اعتبارسنجی یک مقدار
     * @param {*} value - مقدار
     * @param {string} type - نوع اعتبارسنجی
     * @returns {Object} نتیجه
     */
    validate(value, type) {
        const rule = this.rules[type];
        if (!rule) {
            return {
                valid: false,
                error: 'UNKNOWN_RULE',
                message: 'قانون اعتبارسنجی نامشخص است'
            };
        }

        this.stats.totalValidations++;

        const result = this._applyRule(value, rule);

        if (result.valid) {
            this.stats.passedValidations++;
        } else {
            this.stats.failedValidations++;
            this.stats.invalidInputs++;
        }

        this.stats.lastValidationAt = Date.now();

        return result;
    }

    /**
     * اعمال یک قانون اعتبارسنجی
     * @param {*} value - مقدار
     * @param {Object} rule - قانون
     * @returns {Object}
     * @private
     */
    _applyRule(value, rule) {
        // بررسی خالی نبودن
        if (value === null || value === undefined) {
            return {
                valid: false,
                error: 'EMPTY_VALUE',
                message: 'مقدار خالی است'
            };
        }

        // تبدیل به رشته
        const strValue = String(value).trim();

        // بررسی طول
        if (rule.minLength !== undefined && strValue.length < rule.minLength) {
            return {
                valid: false,
                error: 'TOO_SHORT',
                message: `${rule.message} (حداقل ${rule.minLength} کاراکتر)`
            };
        }

        if (rule.maxLength !== undefined && strValue.length > rule.maxLength) {
            return {
                valid: false,
                error: 'TOO_LONG',
                message: `${rule.message} (حداکثر ${rule.maxLength} کاراکتر)`
            };
        }

        // بررسی طول دقیق
        if (rule.length !== undefined && strValue.length !== rule.length) {
            return {
                valid: false,
                error: 'INVALID_LENGTH',
                message: `${rule.message} (دقیقاً ${rule.length} کاراکتر)`
            };
        }

        // بررسی الگو
        if (rule.pattern && !rule.pattern.test(strValue)) {
            return {
                valid: false,
                error: 'INVALID_PATTERN',
                message: rule.message
            };
        }

        // بررسی الگوی بین‌المللی (برای تلفن)
        if (rule.internationalPattern && !rule.pattern.test(strValue) && !rule.internationalPattern.test(strValue)) {
            return {
                valid: false,
                error: 'INVALID_PATTERN',
                message: rule.message
            };
        }

        // بررسی مقادیر رزرو شده
        if (rule.reserved && rule.reserved.includes(strValue.toLowerCase())) {
            return {
                valid: false,
                error: 'RESERVED_VALUE',
                message: 'این مقدار رزرو شده است'
            };
        }

        // بررسی الزامات رمز عبور
        if (rule.requireUppercase && !/[A-Z]/.test(strValue)) {
            return {
                valid: false,
                error: 'NO_UPPERCASE',
                message: 'رمز عبور باید شامل حداقل یک حرف بزرگ باشد'
            };
        }

        if (rule.requireLowercase && !/[a-z]/.test(strValue)) {
            return {
                valid: false,
                error: 'NO_LOWERCASE',
                message: 'رمز عبور باید شامل حداقل یک حرف کوچک باشد'
            };
        }

        if (rule.requireNumber && !/[0-9]/.test(strValue)) {
            return {
                valid: false,
                error: 'NO_NUMBER',
                message: 'رمز عبور باید شامل حداقل یک عدد باشد'
            };
        }

        if (rule.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(strValue)) {
            return {
                valid: false,
                error: 'NO_SPECIAL',
                message: 'رمز عبور باید شامل حداقل یک کاراکتر خاص باشد'
            };
        }

        // بررسی XSS
        if (this._containsXSS(strValue)) {
            this.stats.xssAttempts++;
            return {
                valid: false,
                error: 'XSS_DETECTED',
                message: 'محتوای مشکوک شناسایی شد'
            };
        }

        // بررسی Injection
        if (this._containsInjection(strValue)) {
            this.stats.injectionAttempts++;
            return {
                valid: false,
                error: 'INJECTION_DETECTED',
                message: 'الگوی Injection شناسایی شد'
            };
        }

        return {
            valid: true,
            sanitized: this.sanitize(strValue)
        };
    }

    // ============================================================
    // بخش ۳: اعتبارسنجی‌های خاص
    // ============================================================

    /**
     * اعتبارسنجی ایمیل
     * @param {string} email - ایمیل
     * @returns {Object}
     */
    validateEmail(email) {
        return this.validate(email, 'email');
    }

    /**
     * اعتبارسنجی شماره موبایل
     * @param {string} phone - شماره موبایل
     * @returns {Object}
     */
    validatePhone(phone) {
        return this.validate(phone, 'phone');
    }

    /**
     * اعتبارسنجی نام کاربری
     * @param {string} username - نام کاربری
     * @returns {Object}
     */
    validateUsername(username) {
        return this.validate(username, 'username');
    }

    /**
     * اعتبارسنجی رمز عبور
     * @param {string} password - رمز عبور
     * @returns {Object}
     */
    validatePassword(password) {
        return this.validate(password, 'password');
    }

    /**
     * اعتبارسنجی OTP
     * @param {string} otp - کد OTP
     * @returns {Object}
     */
    validateOTP(otp) {
        return this.validate(otp, 'otp');
    }

    /**
     * اعتبارسنجی کد اتاق
     * @param {string} code - کد اتاق
     * @returns {Object}
     */
    validateRoomCode(code) {
        return this.validate(code, 'roomCode');
    }

    /**
     * اعتبارسنجی URL
     * @param {string} url - URL
     * @returns {Object}
     */
    validateURL(url) {
        return this.validate(url, 'url');
    }

    /**
     * اعتبارسنجی پیام چت
     * @param {string} message - پیام
     * @returns {Object}
     */
    validateChatMessage(message) {
        return this.validate(message, 'chatMessage');
    }

    /**
     * اعتبارسنجی نام نمایشی
     * @param {string} name - نام
     * @returns {Object}
     */
    validateDisplayName(name) {
        return this.validate(name, 'displayName');
    }

    /**
     * اعتبارسنجی بیوگرافی
     * @param {string} bio - بیوگرافی
     * @returns {Object}
     */
    validateBio(bio) {
        return this.validate(bio, 'bio');
    }

    /**
     * اعتبارسنجی دلیل گزارش
     * @param {string} reason - دلیل
     * @returns {Object}
     */
    validateReportReason(reason) {
        return this.validate(reason, 'reportReason');
    }

    // ============================================================
    // بخش ۴: پاکسازی ورودی‌ها (Sanitization)
    // ============================================================

    /**
     * پاکسازی ورودی
     * @param {string} input - ورودی
     * @returns {string} ورودی پاکسازی شده
     */
    sanitize(input) {
        if (typeof input !== 'string') return input;

        return input
            // حذف تگ‌های HTML
            .replace(/<[^>]*>/g, '')
            // حذف event handler ها
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            // حذف javascript:
            .replace(/javascript\s*:/gi, '')
            // حذف data:
            .replace(/data\s*:[^,]*;base64/gi, '')
            // حذف expression()
            .replace(/expression\s*\([^)]*\)/gi, '')
            // حذف url()
            .replace(/url\s*\([^)]*\)/gi, '')
            // حذف تگ‌های اسکریپت
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            // حذف تگ‌های style
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            // حذف تگ‌های iframe
            .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
            // حذف تگ‌های object
            .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
            // حذف تگ‌های embed
            .replace(/<embed[^>]*>/gi, '')
            // حذف تگ‌های applet
            .replace(/<applet[^>]*>[\s\S]*?<\/applet>/gi, '')
            // حذف تگ‌های form
            .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
            // حذف تگ‌های input
            .replace(/<input[^>]*>/gi, '')
            // حذف تگ‌های textarea
            .replace(/<textarea[^>]*>[\s\S]*?<\/textarea>/gi, '')
            // حذف تگ‌های select
            .replace(/<select[^>]*>[\s\S]*?<\/select>/gi, '')
            // حذف تگ‌های button
            .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
            // حذف تگ‌های link
            .replace(/<link[^>]*>/gi, '')
            // حذف تگ‌های meta
            .replace(/<meta[^>]*>/gi, '')
            // حذف تگ‌های base
            .replace(/<base[^>]*>/gi, '')
            // حذف کامنت‌های HTML
            .replace(/<!--[\s\S]*?-->/g, '')
            // حذف کاراکترهای کنترل
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            // حذف فاصله‌های اضافی
            .trim()
            // محدود کردن طول
            .substring(0, 10000);
    }

    /**
     * پاکسازی HTML (اجازه تگ‌های محدود)
     * @param {string} input - ورودی
     * @returns {string}
     */
    sanitizeHTML(input) {
        if (typeof input !== 'string') return input;

        const allowedTags = ['b', 'i', 'u', 'em', 'strong', 'br', 'p'];
        const allowedAttrs = ['class'];

        let sanitized = input;

        // حذف تگ‌های غیرمجاز
        sanitized = sanitized.replace(/<\/?([a-zA-Z]+)([^>]*)>/g, (match, tag, attrs) => {
            if (allowedTags.includes(tag.toLowerCase())) {
                // فقط اجازه attribute های مجاز
                let cleanAttrs = '';
                if (attrs) {
                    const attrMatches = attrs.match(/([a-zA-Z-]+)\s*=\s*["']([^"']*)["']/g);
                    if (attrMatches) {
                        attrMatches.forEach(attr => {
                            const attrName = attr.split('=')[0].trim().toLowerCase();
                            if (allowedAttrs.includes(attrName)) {
                                cleanAttrs += ' ' + attr;
                            }
                        });
                    }
                }
                return `<${tag}${cleanAttrs}>`;
            }
            return '';
        });

        return sanitized;
    }

    /**
     * پاکسازی URL
     * @param {string} url - URL
     * @returns {string}
     */
    sanitizeURL(url) {
        if (typeof url !== 'string') return url;

        try {
            const urlObj = new URL(url);

            // فقط اجازه پروتکل‌های مجاز
            if (!this.rules.url.allowedProtocols.includes(urlObj.protocol)) {
                return '';
            }

            // حذف پارامترهای مشکوک
            urlObj.searchParams.forEach((value, key) => {
                if (key.toLowerCase().includes('script') ||
                    key.toLowerCase().includes('eval') ||
                    key.toLowerCase().includes('exec')) {
                    urlObj.searchParams.delete(key);
                }
            });

            return urlObj.toString();
        } catch (error) {
            return '';
        }
    }

    // ============================================================
    // بخش ۵: تشخیص حملات
    // ============================================================

    /**
     * بررسی وجود XSS
     * @param {string} input - ورودی
     * @returns {boolean}
     * @private
     */
    _containsXSS(input) {
        const xssPatterns = [
            /<script[^>]*>[\s\S]*?<\/script>/gi,
            /<script[^>]*>/gi,
            /javascript\s*:/gi,
            /on\w+\s*=\s*["'][^"']*["']/gi,
            /on\w+\s*=\s*[^\s>]+/gi,
            /<img[^>]+onerror/gi,
            /<svg[^>]+onload/gi,
            /<body[^>]+onload/gi,
            /<iframe[^>]*>/gi,
            /<object[^>]*>/gi,
            /<embed[^>]*>/gi,
            /<applet[^>]*>/gi,
            /expression\s*\([^)]*\)/gi,
            /url\s*\([^)]*\)/gi,
            /vbscript\s*:/gi,
            /data\s*:[^,]*;base64/gi,
            /<link[^>]*>/gi,
            /<meta[^>]*>/gi,
            /<base[^>]*>/gi,
            /<form[^>]*>/gi,
            /<input[^>]*>/gi,
            /alert\s*\(/gi,
            /confirm\s*\(/gi,
            /prompt\s*\(/gi,
            /document\.cookie/gi,
            /document\.write/gi,
            /document\.location/gi,
            /window\.location/gi,
            /eval\s*\(/gi,
            /setTimeout\s*\(/gi,
            /setInterval\s*\(/gi,
            /Function\s*\(/gi,
            /String\.fromCharCode/gi,
            /unescape\s*\(/gi,
            /decodeURIComponent\s*\(/gi
        ];

        return xssPatterns.some(pattern => pattern.test(input));
    }

    /**
     * بررسی وجود Injection
     * @param {string} input - ورودی
     * @returns {boolean}
     * @private
     */
    _containsInjection(input) {
        const injectionPatterns = [
            // SQL Injection
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|HAVING|GROUP|ORDER|LIMIT|OFFSET)\b)/gi,
            /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
            /(\b(OR|AND)\s+['"]\w+['"]\s*=\s*['"]\w+['"])/gi,
            /(--|\/\*|\*\/|;)/g,
            /(\b(UNION\s+(ALL\s+)?SELECT)\b)/gi,
            /(\b(WAITFOR\s+DELAY)\b)/gi,
            /(\b(BENCHMARK|SLEEP)\s*\()/gi,
            /(\b(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b)/gi,

            // NoSQL Injection
            /(\$gt|\$lt|\$gte|\$lte|\$ne|\$in|\$nin|\$or|\$and|\$not|\$where|\$regex)/gi,

            // Command Injection
            /(\b(cat|ls|dir|pwd|whoami|id|uname|ifconfig|ipconfig|netstat|ps|kill|rm|cp|mv|mkdir|chmod|chown|wget|curl|nc|bash|sh|cmd|powershell)\b)/gi,
            /[;|&`$(){}[\]]/g,
            /\.\.\//g,
            /\.\.\\/g,

            // LDAP Injection
            /(\(|\)|\||\&|\!|\*)/g,

            // XPath Injection
            /(\b(or|and|not)\b\s+['"])/gi,

            // Path Traversal
            /(\.\.\/|\.\.\\)/g,
            /(%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)/gi
        ];

        return injectionPatterns.some(pattern => pattern.test(input));
    }

    // ============================================================
    // بخش ۶: Rate Limiting
    // ============================================================

    /**
     * بررسی Rate Limit
     * @param {string} key - کلید (مثلاً IP یا userId)
     * @param {string} type - نوع (api, login, otp, chat, ...)
     * @returns {Object} نتیجه
     */
    checkRateLimit(key, type = 'api') {
        const config = this.rateLimitConfig[type];
        if (!config) {
            return {
                allowed: true,
                message: 'پیکربندی Rate Limit یافت نشد'
            };
        }

        const now = Date.now();
        const limitKey = `${type}:${key}`;

        // دریافت یا ایجاد لیست درخواست‌ها
        if (!this.rateLimits.has(limitKey)) {
            this.rateLimits.set(limitKey, []);
        }

        const requests = this.rateLimits.get(limitKey);

        // حذف درخواست‌های قدیمی
        const validRequests = requests.filter(t => now - t < config.windowMs);
        this.rateLimits.set(limitKey, validRequests);

        // بررسی محدودیت
        if (validRequests.length >= config.maxRequests) {
            this.stats.rateLimitHits++;

            const oldestRequest = validRequests[0];
            const retryAfter = Math.ceil((config.windowMs - (now - oldestRequest)) / 1000);

            this._emit('rate-limit-hit', { key, type, retryAfter });

            if (this.debug) {
                console.log(`⚠️ Rate limit hit: ${type} for ${key}, retry after ${retryAfter}s`);
            }

            return {
                allowed: false,
                error: 'RATE_LIMIT_EXCEEDED',
                message: `تعداد درخواست‌ها بیش از حد است. لطفاً ${retryAfter} ثانیه صبر کنید`,
                retryAfter,
                maxRequests: config.maxRequests,
                windowMs: config.windowMs
            };
        }

        // ثبت درخواست جدید
        validRequests.push(now);
        this.rateLimits.set(limitKey, validRequests);

        return {
            allowed: true,
            remaining: config.maxRequests - validRequests.length,
            resetAt: now + config.windowMs
        };
    }

    /**
     * بررسی Rate Limit برای API
     * @param {string} key - کلید
     * @returns {Object}
     */
    checkAPIRateLimit(key) {
        return this.checkRateLimit(key, 'api');
    }

    /**
     * بررسی Rate Limit برای Login
     * @param {string} key - کلید
     * @returns {Object}
     */
    checkLoginRateLimit(key) {
        return this.checkRateLimit(key, 'login');
    }

    /**
     * بررسی Rate Limit برای OTP
     * @param {string} key - کلید
     * @returns {Object}
     */
    checkOTPRateLimit(key) {
        return this.checkRateLimit(key, 'otp');
    }

    /**
     * بررسی Rate Limit برای Chat
     * @param {string} key - کلید
     * @returns {Object}
     */
    checkChatRateLimit(key) {
        return this.checkRateLimit(key, 'chat');
    }

    /**
     * بررسی Rate Limit برای Report
     * @param {string} key - کلید
     * @returns {Object}
     */
    checkReportRateLimit(key) {
        return this.checkRateLimit(key, 'report');
    }

    /**
     * بررسی Rate Limit برای Password Reset
     * @param {string} key - کلید
     * @returns {Object}
     */
    checkPasswordResetRateLimit(key) {
        return this.checkRateLimit(key, 'passwordReset');
    }

    /**
     * بررسی Rate Limit برای File Upload
     * @param {string} key - کلید
     * @returns {Object}
     */
    checkFileUploadRateLimit(key) {
        return this.checkRateLimit(key, 'fileUpload');
    }

    /**
     * پاکسازی Rate Limits قدیمی
     * @returns {number} تعداد پاکسازی شده
     */
    cleanupRateLimits() {
        const now = Date.now();
        let cleaned = 0;

        this.rateLimits.forEach((requests, key) => {
            const validRequests = requests.filter(t => now - t < 3600000); // 1 ساعت

            if (validRequests.length === 0) {
                this.rateLimits.delete(key);
                cleaned++;
            } else {
                this.rateLimits.set(key, validRequests);
            }
        });

        if (this.debug && cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} expired rate limit entries`);
        }

        return cleaned;
    }

    // ============================================================
    // بخش : CSRF Protection
    // ============================================================

    /**
     * تولید CSRF Token جدید
     * @returns {string}
     */
    generateCSRFToken() {
        this.csrfToken = this._generateCSRFToken();
        storage?.set('csrf_token', this.csrfToken);

        this._emit('csrf-token-generated', { token: this.csrfToken });

        return this.csrfToken;
    }

    /**
     * بررسی CSRF Token
     * @param {string} token - Token ارسالی
     * @returns {Object} نتیجه
     */
    verifyCSRFToken(token) {
        if (!token || token !== this.csrfToken) {
            this.stats.csrfFailures++;

            this._emit('csrf-validation-failed', { token });

            if (this.debug) {
                console.log('❌ CSRF validation failed');
            }

            return {
                valid: false,
                error: 'CSRF_TOKEN_INVALID',
                message: 'توکن CSRF نامعتبر است'
            };
        }

        return {
            valid: true,
            message: 'توکن CSRF معتبر است'
        };
    }

    /**
     * دریافت CSRF Token فعلی
     * @returns {string}
     */
    getCSRFToken() {
        return this.csrfToken;
    }

    /**
     * تولید CSRF Token
     * @returns {string}
     * @private
     */
    _generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // ============================================================
    // بخش ۸: اعتبارسنجی فایل
    // ============================================================

    /**
     * اعتبارسنجی فایل آپلود شده
     * @param {Object} file - فایل
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    validateFile(file, options = {}) {
        const {
            maxSizeMB = 2,
            allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
            allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
        } = options;

        // بررسی وجود فایل
        if (!file) {
            return {
                valid: false,
                error: 'NO_FILE',
                message: 'فایلی انتخاب نشده است'
            };
        }

        // بررسی اندازه
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            return {
                valid: false,
                error: 'FILE_TOO_LARGE',
                message: `حجم فایل نباید بیشتر از ${maxSizeMB} مگابایت باشد`
            };
        }

        // بررسی نوع MIME
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: 'INVALID_FILE_TYPE',
                message: `نوع فایل نامعتبر است. انواع مجاز: ${allowedTypes.join(', ')}`
            };
        }

        // بررسی پسوند
        const fileName = file.name.toLowerCase();
        const extension = '.' + fileName.split('.').pop();

        if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
            return {
                valid: false,
                error: 'INVALID_EXTENSION',
                message: `پسوند فایل نامعتبر است. پسوندهای مجاز: ${allowedExtensions.join(', ')}`
            };
        }

        // بررسی نام فایل مشکوک
        if (this._isSuspiciousFileName(fileName)) {
            return {
                valid: false,
                error: 'SUSPICIOUS_FILENAME',
                message: 'نام فایل مشکوک است'
            };
        }

        return {
            valid: true,
            file: {
                name: file.name,
                size: file.size,
                type: file.type,
                extension: extension
            }
        };
    }

    /**
     * بررسی نام فایل مشکوک
     * @param {string} fileName - نام فایل
     * @returns {boolean}
     * @private
     */
    _isSuspiciousFileName(fileName) {
        const suspiciousPatterns = [
            /\.exe$/i,
            /\.bat$/i,
            /\.cmd$/i,
            /\.ps1$/i,
            /\.sh$/i,
            /\.php$/i,
            /\.asp$/i,
            /\.aspx$/i,
            /\.jsp$/i,
            /\.js$/i,
            /\.html$/i,
            /\.htm$/i,
            /\.svg$/i,
            /script/i,
            /eval/i,
            /exec/i,
            /\.\./,
            /[<>:"|?*]/
        ];

        return suspiciousPatterns.some(pattern => pattern.test(fileName));
    }

    // ============================================================
    // بخش ۹: اعتبارسنجی User Agent
    // ============================================================

    /**
     * بررسی User Agent
     * @param {string} userAgent - User Agent
     * @returns {Object} نتیجه
     */
    validateUserAgent(userAgent) {
        if (!userAgent) {
            return {
                valid: false,
                error: 'NO_USER_AGENT',
                message: 'User Agent وجود ندارد'
            };
        }

        const lowerUA = userAgent.toLowerCase();
        const isSuspicious = this.suspiciousUserAgents.some(ua => lowerUA.includes(ua));

        if (isSuspicious) {
            return {
                valid: false,
                error: 'SUSPICIOUS_USER_AGENT',
                message: 'User Agent مشکوک شناسایی شد',
                userAgent: userAgent
            };
        }

        return {
            valid: true,
            userAgent: userAgent
        };
    }

    // ============================================================
    // بخش ۰: اعتبارسنجی IP
    // ============================================================

    /**
     * بررسی IP
     * @param {string} ip - آدرس IP
     * @returns {Object} نتیجه
     */
    validateIP(ip) {
        if (!ip) {
            return {
                valid: false,
                error: 'NO_IP',
                message: 'آدرس IP وجود ندارد'
            };
        }

        // بررسی فرمت IPv4
        const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        // بررسی فرمت IPv6
        const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

        if (!ipv4Pattern.test(ip) && !ipv6Pattern.test(ip)) {
            return {
                valid: false,
                error: 'INVALID_IP',
                message: 'فرمت IP نامعتبر است'
            };
        }

        // بررسی IP های رزرو شده
        if (this._isReservedIP(ip)) {
            return {
                valid: false,
                error: 'RESERVED_IP',
                message: 'IP رزرو شده است'
            };
        }

        // بررسی IP مسدود
        if (this.blockedIPs.has(ip)) {
            return {
                valid: false,
                error: 'BLOCKED_IP',
                message: 'این IP مسدود شده است'
            };
        }

        return {
            valid: true,
            ip: ip
        };
    }

    /**
     * بررسی IP رزرو شده
     * @param {string} ip - IP
     * @returns {boolean}
     * @private
     */
    _isReservedIP(ip) {
        const reservedPatterns = [
            /^10\./,
            /^172\.(1[6-9]|2\d|3[0-1])\./,
            /^192\.168\./,
            /^127\./,
            /^0\./,
            /^169\.254\./,
            /^::1$/,
            /^fe80::/,
            /^fc00::/,
            /^fd00::/
        ];

        return reservedPatterns.some(pattern => pattern.test(ip));
    }

    /**
     * مسدود کردن IP
     * @param {string} ip - IP
     * @returns {Object} نتیجه
     */
    blockIP(ip) {
        this.blockedIPs.add(ip);
        this._saveData();

        this._emit('ip-blocked', { ip });

        if (this.debug) {
            console.log(`🚫 IP blocked: ${ip}`);
        }

        return {
            success: true,
            ip: ip
        };
    }

    /**
     * رفع مسدودیت IP
     * @param {string} ip - IP
     * @returns {Object} نتیجه
     */
    unblockIP(ip) {
        this.blockedIPs.delete(ip);
        this._saveData();

        this._emit('ip-unblocked', { ip });

        return {
            success: true,
            ip: ip
        };
    }

    /**
     * دریافت لیست IP های مسدود
     * @returns {Array<string>}
     */
    getBlockedIPs() {
        return Array.from(this.blockedIPs);
    }

    // ============================================================
    // بخش ۱۱: اعتبارسنجی چند مقداری
    // ============================================================

    /**
     * اعتبارسنجی چند مقدار همزمان
     * @param {Object} data - داده‌ها
     * @param {Object} rules - قوانین
     * @returns {Object} نتیجه
     */
    validateMultiple(data, rules) {
        const results = {};
        let allValid = true;
        const errors = [];

        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            const result = this.validate(value, rule);

            results[field] = result;

            if (!result.valid) {
                allValid = false;
                errors.push({
                    field,
                    error: result.error,
                    message: result.message
                });
            }
        }

        return {
            valid: allValid,
            results,
            errors
        };
    }

    /**
     * اعتبارسنجی فرم ثبت‌نام
     * @param {Object} formData - داده‌های فرم
     * @returns {Object} نتیجه
     */
    validateRegistrationForm(formData) {
        return this.validateMultiple(formData, {
            username: 'username',
            email: 'email',
            password: 'password'
        });
    }

    /**
     * اعتبارسنجی فرم ورود
     * @param {Object} formData - داده‌های فرم
     * @returns {Object} نتیجه
     */
    validateLoginForm(formData) {
        return this.validateMultiple(formData, {
            email: 'email',
            password: 'password'
        });
    }

    /**
     * اعتبارسنجی فرم تغییر رمز عبور
     * @param {Object} formData - داده‌های فرم
     * @returns {Object} نتیجه
     */
    validatePasswordChangeForm(formData) {
        const results = this.validateMultiple(formData, {
            currentPassword: 'password',
            newPassword: 'password'
        });

        // بررسی یکسان نبودن رمز قدیم و جدید
        if (results.valid && formData.currentPassword === formData.newPassword) {
            results.valid = false;
            results.errors.push({
                field: 'newPassword',
                error: 'SAME_PASSWORD',
                message: 'رمز عبور جدید نباید با رمز قبلی یکسان باشد'
            });
        }

        return results;
    }

    // ============================================================
    // بخش ۱۲: Content Security
    // ============================================================

    /**
     * بررسی Content Security Policy
     * @returns {Object} نتیجه
     */
    checkContentSecurity() {
        const issues = [];

        // بررسی HTTPS
        if (typeof window !== 'undefined' && window.location.protocol !== 'https:') {
            issues.push({
                type: 'INSECURE_PROTOCOL',
                message: 'اتصال از HTTPS استفاده نمی‌کند',
                severity: 'high'
            });
        }

        // بررسی Mixed Content
        if (typeof document !== 'undefined') {
            const insecureResources = document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]');
            if (insecureResources.length > 0) {
                issues.push({
                    type: 'MIXED_CONTENT',
                    message: `${insecureResources.length} منبع ناامن شناسایی شد`,
                    severity: 'medium'
                });
            }
        }

        return {
            secure: issues.length === 0,
            issues
        };
    }

    // ============================================================
    // بخش ۳: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            rateLimitEntries: this.rateLimits.size,
            blockedIPsCount: this.blockedIPs.size,
            csrfToken: this.csrfToken ? 'present' : 'missing'
        };
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        const totalValidations = this.stats.totalValidations;
        const passRate = totalValidations > 0 ?
            ((this.stats.passedValidations / totalValidations) * 100).toFixed(2) : '100';

        return {
            totalValidations,
            passRate: passRate + '%',
            securityThreats: {
                xss: this.stats.xssAttempts,
                injection: this.stats.injectionAttempts,
                rateLimitHits: this.stats.rateLimitHits,
                csrfFailures: this.stats.csrfFailures
            },
            activeBlocks: this.blockedIPs.size
        };
    }

    // ============================================================
    // بخش ۱۴: ذخیره و بارگذاری
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('security_blocked_ips', Array.from(this.blockedIPs));
            storage.set('security_csrf_token', this.csrfToken);
            storage.set('security_stats', this.stats);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const blockedIPs = storage.get('security_blocked_ips');
            if (blockedIPs) this.blockedIPs = new Set(blockedIPs);

            const csrfToken = storage.get('security_csrf_token');
            if (csrfToken) this.csrfToken = csrfToken;

            const stats = storage.get('security_stats');
            if (stats) this.stats = { ...this.stats, ...stats };
        }
    }

    // ============================================================
    // بخش ۱۵: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.rateLimits.clear();
        this.blockedIPs.clear();
        this.csrfToken = this._generateCSRFToken();

        this.stats = {
            totalValidations: 0,
            passedValidations: 0,
            failedValidations: 0,
            xssAttempts: 0,
            injectionAttempts: 0,
            rateLimitHits: 0,
            csrfFailures: 0,
            invalidInputs: 0,
            lastValidationAt: null
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 SecurityValidationManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🛡️ SecurityValidationManager Status:');
        console.log('  Total Validations:', stats.totalValidations);
        console.log('  Pass Rate:', summary.passRate);
        console.log('  XSS Attempts:', summary.securityThreats.xss);
        console.log('  Injection Attempts:', summary.securityThreats.injection);
        console.log('  Rate Limit Hits:', summary.securityThreats.rateLimitHits);
        console.log('  CSRF Failures:', summary.securityThreats.csrfFailures);
        console.log('  Blocked IPs:', summary.activeBlocks);
        console.log('  Rate Limit Entries:', stats.rateLimitEntries);
    }

    // ============================================================
    // بخش ۱: Event System
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
                    console.error(`❌ Security Validation event listener error:`, error);
                }
            });
        }

        eventBus.emit(`security-validation:${event}`, data);
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
const securityValidationManager = new SecurityValidationManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecurityValidationManager, securityValidationManager };
} else {
    window.SecurityValidationManager = SecurityValidationManager;
    window.securityValidationManager = securityValidationManager;
}

console.log('✅ SecurityValidationManager loaded');
