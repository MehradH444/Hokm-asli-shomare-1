/**
 * ============================================================
 * HOKM MASTER - Utility Functions
 * توابع کمکی و عمومی پروژه
 * ============================================================
 * 
 * این فایل شامل تمام توابع کمکی است که در سایر فایل‌های
 * پروژه مورد استفاده قرار می‌گیرند.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * 
 * ============================================================
 */

const Utils = {

    // ============================================================
    // 1. تبدیل اعداد
    // ============================================================

    /**
     * تبدیل اعداد انگلیسی به فارسی
     * @param {number|string} num - عدد ورودی
     * @returns {string} عدد فارسی
     */
    toPersianNumber(num) {
        if (num === null || num === undefined) return '';
        
        const persianDigits = ['۰', '', '۲', '۳', '', '۵', '۶', '', '۸', '۹'];
        return num.toString().replace(/\d/g, digit => persianDigits[digit]);
    },

    /**
     * تبدیل اعداد فارسی به انگلیسی
     * @param {string} str - رشته ورودی
     * @returns {string} رشته با اعداد انگلیسی
     */
    toEnglishNumber(str) {
        if (!str) return '';
        
        const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, //g, /۷/g, /۸/g, /۹/g];
        const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
        const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        
        let result = str;
        
        persianDigits.forEach((regex, index) => {
            result = result.replace(regex, englishDigits[index]);
        });
        
        arabicDigits.forEach((regex, index) => {
            result = result.replace(regex, englishDigits[index]);
        });
        
        return result;
    },

    /**
     * تبدیل عدد به فرمت فارسی با جداکننده هزارگان
     * @param {number} num - عدد ورودی
     * @returns {string} عدد فرمت شده
     */
    formatPersianNumber(num) {
        if (num === null || num === undefined) return '۰';
        
        const englishFormatted = num.toLocaleString('en-US');
        return this.toPersianNumber(englishFormatted);
    },

    /**
     * تبدیل عدد به فرمت کوتاه (K, M, B)
     * @param {number} num - عدد ورودی
     * @returns {string} عدد فرمت شده
     */
    formatShortNumber(num) {
        if (num === null || num === undefined) return '';
        
        if (num < 1000) {
            return this.toPersianNumber(num);
        } else if (num < 1000000) {
            return this.toPersianNumber((num / 1000).toFixed(1)) + 'K';
        } else if (num < 1000000000) {
            return this.toPersianNumber((num / 1000000).toFixed(1)) + 'M';
        } else {
            return this.toPersianNumber((num / 1000000000).toFixed(1)) + 'B';
        }
    },

    // ============================================================
    // 2. اعتبارسنجی‌ها
    // ============================================================

    /**
     * اعتبارسنجی شماره موبایل ایران
     * @param {string} phone - شماره موبایل
     * @returns {boolean} معتبر است یا خیر
     */
    validatePhone(phone) {
        if (!phone) return false;
        
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.length === 11) {
            return CONFIG.PHONE.PATTERN.test(cleaned);
        } else if (cleaned.length === 12 && cleaned.startsWith('98')) {
            return CONFIG.PHONE.INTERNATIONAL_PATTERN.test('+' + cleaned);
        }
        
        return false;
    },

    /**
     * اعتبارسنجی ایمیل
     * @param {string} email - ایمیل
     * @returns {boolean} معتبر است یا خیر
     */
    validateEmail(email) {
        if (!email) return false;
        
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * اعتبارسنجی نام کاربری
     * @param {string} username - نام کاربری
     * @returns {boolean} معتبر است یا خیر
     */
    validateUsername(username) {
        if (!username) return false;
        
        if (username.length < CONFIG.AUTH.USERNAME.MIN_LENGTH) return false;
        if (username.length > CONFIG.AUTH.USERNAME.MAX_LENGTH) return false;
        
        if (!CONFIG.AUTH.USERNAME.PATTERN.test(username)) return false;
        
        const lowerUsername = username.toLowerCase();
        if (CONFIG.AUTH.USERNAME.RESERVED.includes(lowerUsername)) return false;
        
        return true;
    },

    /**
     * اعتبارسنجی رمز عبور
     * @param {string} password - رمز عبور
     * @returns {object} نتیجه اعتبارسنجی
     */
    validatePassword(password) {
        const result = {
            valid: true,
            errors: []
        };

        if (!password) {
            result.valid = false;
            result.errors.push('رمز عبور الزامی است');
            return result;
        }

        if (password.length < CONFIG.AUTH.PASSWORD.MIN_LENGTH) {
            result.valid = false;
            result.errors.push(`رمز عبور باید حداقل ${CONFIG.AUTH.PASSWORD.MIN_LENGTH} کاراکتر باشد`);
        }

        if (password.length > CONFIG.AUTH.PASSWORD.MAX_LENGTH) {
            result.valid = false;
            result.errors.push(`رمز عبور نباید بیشتر از ${CONFIG.AUTH.PASSWORD.MAX_LENGTH} کاراکتر باشد`);
        }

        if (CONFIG.AUTH.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
            result.valid = false;
            result.errors.push('رمز عبور باید شامل حداقل یک حرف بزرگ باشد');
        }

        if (CONFIG.AUTH.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
            result.valid = false;
            result.errors.push('رمز عبور باید شامل حداقل یک حرف کوچک باشد');
        }

        if (CONFIG.AUTH.PASSWORD.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
            result.valid = false;
            result.errors.push('رمز عبور باید شامل حداقل یک عدد باشد');
        }

        if (CONFIG.AUTH.PASSWORD.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            result.valid = false;
            result.errors.push('رمز عبور باید شامل حداقل یک کاراکتر خاص باشد');
        }

        return result;
    },

    /**
     * اعتبارسنجی کد OTP
     * @param {string} code - کد OTP
     * @returns {boolean} معتبر است یا خیر
     */
    validateOTP(code) {
        if (!code) return false;
        
        const cleaned = this.toEnglishNumber(code).replace(/\D/g, '');
        return cleaned.length === CONFIG.AUTH.OTP.LENGTH && /^\d+$/.test(cleaned);
    },

    /**
     * اعتبارسنجی URL
     * @param {string} url - آدرس URL
     * @returns {boolean} معتبر است یا خیر
     */
    validateURL(url) {
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    },

    // ============================================================
    // 3. فرمت‌دهی
    // ============================================================

    /**
     * فرمت شماره موبایل با فاصله
     * @param {string} phone - شماره موبایل
     * @returns {string} شماره فرمت شده
     */
    formatPhone(phone) {
        if (!phone) return '';
        
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.length <= 3) {
            return cleaned;
        } else if (cleaned.length <= 7) {
            return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
        } else {
            return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 11)}`;
        }
    },

    /**
     * فرمت شماره موبایل با کد کشور
     * @param {string} phone - شماره موبایل
     * @returns {string} شماره فرمت شده با کد کشور
     */
    formatPhoneInternational(phone) {
        if (!phone) return '';
        
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.startsWith('98')) {
            return '+' + cleaned;
        } else if (cleaned.startsWith('0')) {
            return '+98' + cleaned.slice(1);
        }
        
        return '+98' + cleaned;
    },

    /**
     * فرمت ارز (سکه)
     * @param {number} amount - مقدار
     * @param {boolean} persian - آیا فارسی باشد
     * @returns {string} مقدار فرمت شده
     */
    formatCurrency(amount, persian = true) {
        if (amount === null || amount === undefined) return persian ? '۰' : '0';
        
        const formatted = amount.toLocaleString('en-US');
        return persian ? this.toPersianNumber(formatted) : formatted;
    },

    /**
     * فرمت تاریخ به شمسی
     * @param {number|Date} timestamp - تاریخ
     * @returns {string} تاریخ شمسی
     */
    toShamsiDate(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        
        try {
            return date.toLocaleDateString('fa-IR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return date.toLocaleDateString();
        }
    },

    /**
     * فرمت تاریخ و زمان به شمسی
     * @param {number|Date} timestamp - تاریخ و زمان
     * @returns {string} تاریخ و زمان شمسی
     */
    toShamsiDateTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        
        try {
            return date.toLocaleDateString('fa-IR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return date.toLocaleString();
        }
    },

    /**
     * فرمت زمان نسبی (مثلاً "۵ دقیقه پیش")
     * @param {number} timestamp - تاریخ
     * @returns {string} زمان نسبی
     */
    timeAgo(timestamp) {
        if (!timestamp) return '';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (seconds < 60) return 'همین الان';
        if (minutes < 60) return `${this.toPersianNumber(minutes)} دقیقه پیش`;
        if (hours < 24) return `${this.toPersianNumber(hours)} ساعت پیش`;
        if (days < 7) return `${this.toPersianNumber(days)} روز پیش`;
        if (weeks < 4) return `${this.toPersianNumber(weeks)} هفته پیش`;
        if (months < 12) return `${this.toPersianNumber(months)} ماه پیش`;
        return `${this.toPersianNumber(years)} سال پیش`;
    },

    /**
     * فرمت مدت زمان (ثانیه به فرمت خوانا)
     * @param {number} seconds - ثانیه
     * @returns {string} مدت زمان فرمت شده
     */
    formatDuration(seconds) {
        if (!seconds || seconds < 0) return '۰ ثانیه';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts = [];
        
        if (hours > 0) {
            parts.push(`${this.toPersianNumber(hours)} ساعت`);
        }
        
        if (minutes > 0) {
            parts.push(`${this.toPersianNumber(minutes)} دقیقه`);
        }
        
        if (secs > 0 || parts.length === 0) {
            parts.push(`${this.toPersianNumber(secs)} ثانیه`);
        }

        return parts.join(' و ');
    },

    /**
     * فرمت درصد
     * @param {number} value - مقدار
     * @param {number} total - کل
     * @returns {string} درصد فرمت شده
     */
    formatPercentage(value, total) {
        if (!total || total === 0) return '۰٪';
        
        const percentage = Math.round((value / total) * 100);
        return `${this.toPersianNumber(percentage)}٪`;
    },

    // ============================================================
    // 4. توابع رشته‌ای
    // ============================================================

    /**
     * کوتاه کردن رشته با اضافه کردن ...
     * @param {string} str - رشته
     * @param {number} maxLength - حداکثر طول
     * @returns {string} رشته کوتاه شده
     */
    truncate(str, maxLength = 50) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    },

    /**
     * حذف فاصله‌های اضافی
     * @param {string} str - رشته
     * @returns {string} رشته تمیز
     */
    trim(str) {
        if (!str) return '';
        return str.trim().replace(/\s+/g, ' ');
    },

    /**
     * تبدیل رشته به slug
     * @param {string} str - رشته
     * @returns {string} slug
     */
    slugify(str) {
        if (!str) return '';
        
        return str
            .toLowerCase()
            .replace(/[\s_]+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    },

    /**
     * پاکسازی HTML از رشته
     * @param {string} str - رشته
     * @returns {string} رشته پاکسازی شده
     */
    sanitizeHTML(str) {
        if (!str) return '';
        
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * تبدیل رشته به حالت Title Case
     * @param {string} str - رشته
     * @returns {string} رشته Title Case
     */
    toTitleCase(str) {
        if (!str) return '';
        
        return str.replace(/\w\S*/g, function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    },

    /**
     * تولید رشته تصادفی
     * @param {number} length - طول رشته
     * @returns {string} رشته تصادفی
     */
    randomString(length = 10) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return result;
    },

    // ============================================================
    // 5. توابع آرایه‌ای
    // ============================================================

    /**
     * شافل کردن آرایه (Fisher-Yates)
     * @param {Array} array - آرایه
     * @returns {Array} آرایه شافل شده
     */
    shuffle(array) {
        if (!Array.isArray(array)) return [];
        
        const arr = [...array];
        
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        
        return arr;
    },

    /**
     * حذف تکراری‌ها از آرایه
     * @param {Array} array - آرایه
     * @returns {Array} آرایه بدون تکراری
     */
    unique(array) {
        if (!Array.isArray(array)) return [];
        return [...new Set(array)];
    },

    /**
     * تقسیم آرایه به بخش‌های کوچکتر
     * @param {Array} array - آرایه
     * @param {number} size - اندازه هر بخش
     * @returns {Array} آرایه‌های کوچکتر
     */
    chunk(array, size) {
        if (!Array.isArray(array) || size <= 0) return [];
        
        const chunks = [];
        
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        
        return chunks;
    },

    /**
     * مرتب‌سازی آرایه بر اساس یک property
     * @param {Array} array - آرایه
     * @param {string} key - کلید
     * @param {boolean} ascending - صعودی
     * @returns {Array} آرایه مرتب شده
     */
    sortBy(array, key, ascending = true) {
        if (!Array.isArray(array)) return [];
        
        return [...array].sort((a, b) => {
            const valA = a[key];
            const valB = b[key];
            
            if (valA < valB) return ascending ? -1 : 1;
            if (valA > valB) return ascending ? 1 : -1;
            return 0;
        });
    },

    /**
     * گروه‌بندی آرایه بر اساس یک property
     * @param {Array} array - آرایه
     * @param {string} key - کلید
     * @returns {Object} آبجکت گروه‌بندی شده
     */
    groupBy(array, key) {
        if (!Array.isArray(array)) return {};
        
        return array.reduce((result, item) => {
            const group = item[key];
            result[group] = result[group] || [];
            result[group].push(item);
            return result;
        }, {});
    },

    /**
     * پیدا کردن آیتم در آرایه
     * @param {Array} array - آرایه
     * @param {Function} predicate - شرط
     * @returns {*} آیتم پیدا شده
     */
    find(array, predicate) {
        if (!Array.isArray(array)) return undefined;
        return array.find(predicate);
    },

    /**
     * فیلتر کردن آرایه
     * @param {Array} array - آرایه
     * @param {Function} predicate - شرط
     * @returns {Array} آرایه فیلتر شده
     */
    filter(array, predicate) {
        if (!Array.isArray(array)) return [];
        return array.filter(predicate);
    },

    /**
     * مپ کردن آرایه
     * @param {Array} array - آرایه
     * @param {Function} callback - تابع
     * @returns {Array} آرایه جدید
     */
    map(array, callback) {
        if (!Array.isArray(array)) return [];
        return array.map(callback);
    },

    // ============================================================
    // 6. توابع آبجکت
    // ============================================================

    /**
     * کپی عمیق از آبجکت
     * @param {*} obj - آبجکت
     * @returns {*} کپی عمیق
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        
        const cloned = {};
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        
        return cloned;
    },

    /**
     * ادغام عمیق دو آبجکت
     * @param {Object} target - هدف
     * @param {Object} source - منبع
     * @returns {Object} آبجکت ادغام شده
     */
    deepMerge(target, source) {
        if (!source) return target;
        
        const result = this.deepClone(target);
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] instanceof Object && key in target) {
                    result[key] = this.deepMerge(target[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    },

    /**
     * مقایسه عمیق دو آبجکت
     * @param {*} obj1 - آبجکت اول
     * @param {*} obj2 - آبجکت دوم
     * @returns {boolean} آیا برابرند
     */
    deepEqual(obj1, obj2) {
        if (obj1 === obj2) return true;
        if (obj1 === null || obj2 === null) return false;
        if (typeof obj1 !== typeof obj2) return false;
        
        if (typeof obj1 !== 'object') return obj1 === obj2;
        
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        
        if (keys1.length !== keys2.length) return false;
        
        for (const key of keys1) {
            if (!keys2.includes(key)) return false;
            if (!this.deepEqual(obj1[key], obj2[key])) return false;
        }
        
        return true;
    },

    /**
     * دریافت مقدار از آبجکت تو در تو با path
     * @param {Object} obj - آبجکت
     * @param {string} path - مسیر (مثلاً 'a.b.c')
     * @param {*} defaultValue - مقدار پیش‌فرض
     * @returns {*} مقدار
     */
    get(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result === null || result === undefined) return defaultValue;
            result = result[key];
        }
        
        return result === undefined ? defaultValue : result;
    },

    /**
     * تنظیم مقدار در آبجکت تو در تو با path
     * @param {Object} obj - آبجکت
     * @param {string} path - مسیر
     * @param {*} value - مقدار
     */
    set(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    },

    // ============================================================
    // 7. توابع ریاضی
    // ============================================================

    /**
     * تولید عدد تصادفی بین دو مقدار
     * @param {number} min - حداقل
     * @param {number} max - حداکثر
     * @returns {number} عدد تصادفی
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * تولید عدد اعشاری تصادفی بین دو مقدار
     * @param {number} min - حداقل
     * @param {number} max - حداکثر
     * @returns {number} عدد اعشاری تصادفی
     */
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * محدود کردن مقدار بین دو عدد
     * @param {number} value - مقدار
     * @param {number} min - حداقل
     * @param {number} max - حداکثر
     * @returns {number} مقدار محدود شده
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * محاسبه درصد
     * @param {number} value - مقدار
     * @param {number} total - کل
     * @returns {number} درصد
     */
    percentage(value, total) {
        if (total === 0) return 0;
        return (value / total) * 100;
    },

    /**
     * گرد کردن به نزدیک‌ترین ضریب
     * @param {number} value - مقدار
     * @param {number} multiple - ضریب
     * @returns {number} مقدار گرد شده
     */
    roundToMultiple(value, multiple) {
        return Math.round(value / multiple) * multiple;
    },

    /**
     * محاسبه فاصله اقلیدسی بین دو نقطه
     * @param {Object} p1 - نقطه اول {x, y}
     * @param {Object} p2 - نقطه دوم {x, y}
     * @returns {number} فاصله
     */
    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * تبدیل درجه به رادیان
     * @param {number} degrees - درجه
     * @returns {number} رادیان
     */
    degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    },

    /**
     * تبدیل رادیان به درجه
     * @param {number} radians - رادیان
     * @returns {number} درجه
     */
    radiansToDegrees(radians) {
        return radians * (180 / Math.PI);
    },

    // ============================================================
    // 8. توابع زمان
    // ============================================================

    /**
     * sleep - توقف اجرای کد
     * @param {number} ms - میلی‌ثانیه
     * @returns {Promise} Promise
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * debounce - محدود کردن فراخوانی تابع
     * @param {Function} func - تابع
     * @param {number} wait - زمان انتظار
     * @returns {Function} تابع debounce شده
     */
    debounce(func, wait) {
        let timeout;
        
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * throttle - محدود کردن نرخ فراخوانی
     * @param {Function} func - تابع
     * @param {number} limit - محدودیت
     * @returns {Function} تابع throttle شده
     */
    throttle(func, limit) {
        let inThrottle;
        
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
    },

    /**
     * دریافت timestamp فعلی
     * @returns {number} timestamp
     */
    now() {
        return Date.now();
    },

    /**
     * بررسی انقضای timestamp
     * @param {number} timestamp - timestamp
     * @returns {boolean} منقضی شده یا خیر
     */
    isExpired(timestamp) {
        if (!timestamp) return true;
        return Date.now() > timestamp;
    },

    /**
     * محاسبه زمان باقی‌مانده
     * @param {number} timestamp - timestamp
     * @returns {number} میلی‌ثانیه باقی‌مانده
     */
    timeRemaining(timestamp) {
        if (!timestamp) return 0;
        return Math.max(0, timestamp - Date.now());
    },

    // ============================================================
    // 9. توابع DOM
    // ============================================================

    /**
     * ایجاد عنصر HTML
     * @param {string} tag - تگ
     * @param {Object} attributes - ویژگی‌ها
     * @param {string|HTMLElement} content - محتوا
     * @returns {HTMLElement} عنصر ایجاد شده
     */
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on')) {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key === 'dataset' && typeof value === 'object') {
                for (const [dataKey, dataValue] of Object.entries(value)) {
                    element.dataset[dataKey] = dataValue;
                }
            } else {
                element.setAttribute(key, value);
            }
        }
        
        if (typeof content === 'string') {
            element.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            element.appendChild(content);
        }
        
        return element;
    },

    /**
     * حذف عنصر از DOM
     * @param {HTMLElement} element - عنصر
     */
    removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    },

    /**
     * نمایش عنصر
     * @param {HTMLElement} element - عنصر
     */
    show(element) {
        if (element) {
            element.classList.remove('hidden');
            element.style.display = '';
        }
    },

    /**
     * مخفی کردن عنصر
     * @param {HTMLElement} element - عنصر
     */
    hide(element) {
        if (element) {
            element.classList.add('hidden');
            element.style.display = 'none';
        }
    },

    /**
     * toggle کردن نمایش عنصر
     * @param {HTMLElement} element - عنصر
     */
    toggle(element) {
        if (element) {
            if (element.classList.contains('hidden')) {
                this.show(element);
            } else {
                this.hide(element);
            }
        }
    },

    /**
     * کپی به کلیپ‌بورد
     * @param {string} text - متن
     * @returns {Promise<boolean>} موفقیت
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const result = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                return result;
            }
        } catch (error) {
            console.error('Copy to clipboard failed:', error);
            return false;
        }
    },

    /**
     * دریافت ابعاد viewport
     * @returns {Object} {width, height}
     */
    getViewportSize() {
        return {
            width: window.innerWidth || document.documentElement.clientWidth,
            height: window.innerHeight || document.documentElement.clientHeight
        };
    },

    /**
     * بررسی موبایل بودن دستگاه
     * @returns {boolean} موبایل است یا خیر
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * بررسی تبلت بودن دستگاه
     * @returns {boolean} تبلت است یا خیر
     */
    isTablet() {
        const width = this.getViewportSize().width;
        return width >= 768 && width <= 1024;
    },

    /**
     * بررسی دسکتاپ بودن دستگاه
     * @returns {boolean} دسکتاپ است یا خیر
     */
    isDesktop() {
        return this.getViewportSize().width > 1024;
    },

    // ============================================================
    // 10. توابع رنگ
    // ============================================================

    /**
     * تبدیل HEX به RGB
     * @param {string} hex - رنگ HEX
     * @returns {Object} {r, g, b}
     */
    hexToRGB(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    /**
     * تبدیل RGB به HEX
     * @param {number} r - قرمز
     * @param {number} g - سبز
     * @param {number} b - آبی
     * @returns {string} رنگ HEX
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    },

    /**
     * روشن‌تر کردن رنگ
     * @param {string} color - رنگ HEX
     * @param {number} percent - درصد
     * @returns {string} رنگ روشن‌تر
     */
    lightenColor(color, percent) {
        const rgb = this.hexToRGB(color);
        if (!rgb) return color;
        
        const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent / 100));
        const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent / 100));
        const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent / 100));
        
        return this.rgbToHex(r, g, b);
    },

    /**
     * تیره‌تر کردن رنگ
     * @param {string} color - رنگ HEX
     * @param {number} percent - درصد
     * @returns {string} رنگ تیره‌تر
     */
    darkenColor(color, percent) {
        const rgb = this.hexToRGB(color);
        if (!rgb) return color;
        
        const r = Math.max(0, Math.floor(rgb.r * (1 - percent / 100)));
        const g = Math.max(0, Math.floor(rgb.g * (1 - percent / 100)));
        const b = Math.max(0, Math.floor(rgb.b * (1 - percent / 100)));
        
        return this.rgbToHex(r, g, b);
    },

    /**
     * تولید رنگ تصادفی
     * @returns {string} رنگ HEX تصادفی
     */
    randomColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    },

    // ============================================================
    // 11. توابع UI
    // ============================================================

    /**
     * نمایش Toast notification
     * @param {string} message - پیام
     * @param {string} type - نوع (success, error, warning, info)
     * @param {number} duration - مدت زمان
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) {
            console.warn('Toast container not found');
            return;
        }

        const toast = this.createElement('div', {
            className: `toast toast-${type}`
        }, message);

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                this.removeElement(toast);
            }, 300);
        }, duration);
    },

    /**
     * نمایش confirm dialog
     * @param {string} message - پیام
     * @returns {boolean} تأیید شد یا خیر
     */
    confirm(message) {
        return window.confirm(message);
    },

    /**
     * نمایش alert
     * @param {string} message - پیام
     */
    alert(message) {
        window.alert(message);
    },

    /**
     * اسکرول به بالای صفحه
     * @param {string} behavior - رفتار اسکرول
     */
    scrollToTop(behavior = 'smooth') {
        window.scrollTo({
            top: 0,
            behavior: behavior
        });
    },

    /**
     * اسکرول به عنصر
     * @param {HTMLElement} element - عنصر
     * @param {string} behavior - رفتار اسکرول
     */
    scrollToElement(element, behavior = 'smooth') {
        if (element) {
            element.scrollIntoView({
                behavior: behavior,
                block: 'start'
            });
        }
    },

    // ============================================================
    // 12. توابع بازی
    // ============================================================

    /**
     * دریافت نماد خال کارت
     * @param {string} suit - خال
     * @returns {string} نماد
     */
    getSuitSymbol(suit) {
        return CONFIG.GAME.CARDS.SUIT_SYMBOLS[suit] || '';
    },

    /**
     * دریافت رنگ خال کارت
     * @param {string} suit - خال
     * @returns {string} رنگ
     */
    getSuitColor(suit) {
        return CONFIG.GAME.CARDS.SUIT_COLORS[suit] || '#000000';
    },

    /**
     * دریافت نام فارسی خال
     * @param {string} suit - خال
     * @returns {string} نام فارسی
     */
    getSuitName(suit) {
        const names = {
            spades: 'پیک',
            hearts: 'دل',
            diamonds: 'خشت',
            clubs: 'گشنیز'
        };
        return names[suit] || suit;
    },

    /**
     * دریافت نام فارسی رتبه کارت
     * @param {string} rank - رتبه
     * @returns {string} نام فارسی
     */
    getRankName(rank) {
        const names = {
            '2': 'دو',
            '3': 'سه',
            '4': 'چهار',
            '5': 'پنج',
            '6': 'شش',
            '7': 'هفت',
            '8': 'هشت',
            '9': 'نه',
            '10': 'ده',
            'J': 'سرباز',
            'Q': 'بی‌بی',
            'K': 'شاه',
            'A': 'آس'
        };
        return names[rank] || rank;
    },

    /**
     * مقایسه دو کارت
     * @param {Object} card1 - کارت اول
     * @param {Object} card2 - کارت دوم
     * @param {string} trump - حکم
     * @returns {number} نتیجه مقایسه
     */
    compareCards(card1, card2, trump) {
        const value1 = this.getCardValue(card1, trump);
        const value2 = this.getCardValue(card2, trump);
        
        return value1 - value2;
    },

    /**
     * دریافت ارزش کارت
     * @param {Object} card - کارت
     * @param {string} trump - حکم
     * @returns {number} ارزش کارت
     */
    getCardValue(card, trump) {
        if (card.suit === trump) {
            return CONFIG.GAME.CARDS.TRUMP_RANK_VALUES[card.rank];
        }
        return CONFIG.GAME.CARDS.RANK_VALUES[card.rank];
    },

    /**
     * بررسی برنده دست
     * @param {Array} cards - کارت‌های بازی شده
     * @param {string} trump - حکم
     * @param {string} leadSuit - خال شروع
     * @returns {number} ایندکس برنده
     */
    determineTrickWinner(cards, trump, leadSuit) {
        let winnerIndex = 0;
        let highestValue = -1;

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const value = this.getCardValue(card, trump);
            
            const isTrump = card.suit === trump;
            const isLeadSuit = card.suit === leadSuit;
            
            const currentWinner = cards[winnerIndex];
            const currentWinnerIsTrump = currentWinner.suit === trump;
            const currentWinnerIsLeadSuit = currentWinner.suit === leadSuit;

            if (isTrump && !currentWinnerIsTrump) {
                winnerIndex = i;
                highestValue = value;
            } else if (isTrump && currentWinnerIsTrump && value > highestValue) {
                winnerIndex = i;
                highestValue = value;
            } else if (!isTrump && !currentWinnerIsTrump && isLeadSuit && !currentWinnerIsLeadSuit) {
                winnerIndex = i;
                highestValue = value;
            } else if (!isTrump && !currentWinnerIsTrump && isLeadSuit && currentWinnerIsLeadSuit && value > highestValue) {
                winnerIndex = i;
                highestValue = value;
            }
        }

        return winnerIndex;
    },

    // ============================================================
    // 13. توابع شبکه
    // ============================================================

    /**
     * بررسی اتصال اینترنت
     * @returns {boolean} متصل است یا خیر
     */
    isOnline() {
        return navigator.onLine;
    },

    /**
     * دریافت نوع اتصال
     * @returns {string} نوع اتصال
     */
    getConnectionType() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (!connection) return 'unknown';
        
        return connection.effectiveType || 'unknown';
    },

    /**
     * بررسی سرعت اتصال
     * @returns {string} سرعت اتصال
     */
    getConnectionSpeed() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (!connection) return 'unknown';
        
        const downlink = connection.downlink;
        
        if (downlink >= 10) return 'fast';
        if (downlink >= 2) return 'medium';
        if (downlink > 0) return 'slow';
        
        return 'unknown';
    },

    // ============================================================
    // 14. توابع ذخیره‌سازی
    // ============================================================

    /**
     * ذخیره در localStorage با مدیریت خطا
     * @param {string} key - کلید
     * @param {*} value - مقدار
     * @returns {boolean} موفقیت
     */
    safeLocalStorageSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('localStorage set error:', error);
            return false;
        }
    },

    /**
     * دریافت از localStorage با مدیریت خطا
     * @param {string} key - کلید
     * @param {*} defaultValue - مقدار پیش‌فرض
     * @returns {*} مقدار
     */
    safeLocalStorageGet(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('localStorage get error:', error);
            return defaultValue;
        }
    },

    /**
     * حذف از localStorage با مدیریت خطا
     * @param {string} key - کلید
     * @returns {boolean} موفقیت
     */
    safeLocalStorageRemove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('localStorage remove error:', error);
            return false;
        }
    },

    // ============================================================
    // 15. توابع متفرقه
    // ============================================================

    /**
     * تولید UUID
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * تولید ID یکتا بر اساس timestamp
     * @returns {string} ID یکتا
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * تأخیر تصادفی
     * @param {number} min - حداقل
     * @param {number} max - حداکثر
     * @returns {Promise} Promise
     */
    randomDelay(min = 500, max = 1500) {
        const delay = this.randomInt(min, max);
        return this.sleep(delay);
    },

    /**
     * اجرای تابع با retry
     * @param {Function} fn - تابع
     * @param {number} retries - تعداد تلاش
     * @param {number} delay - تأخیر
     * @returns {Promise} نتیجه
     */
    async retry(fn, retries = 3, delay = 1000) {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0) {
                await this.sleep(delay);
                return this.retry(fn, retries - 1, delay * 1.5);
            }
            throw error;
        }
    },

    /**
     * اندازه‌گیری زمان اجرای تابع
     * @param {Function} fn - تابع
     * @param {string} label - برچسب
     * @returns {*} نتیجه تابع
     */
    measureTime(fn, label = 'Operation') {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        console.log(`${label} took ${end - start}ms`);
        
        return result;
    },

    /**
     * تبدیل به Promise
     * @param {*} value - مقدار
     * @returns {Promise} Promise
     */
    toPromise(value) {
        return Promise.resolve(value);
    },

    /**
     * اجرای چند Promise به صورت موازی با محدودیت
     * @param {Array} promises - آرایه Promise
     * @param {number} limit - محدودیت
     * @returns {Promise<Array>} نتایج
     */
    async promisePool(promises, limit = 5) {
        const results = [];
        const executing = new Set();

        for (const promise of promises) {
            const p = Promise.resolve().then(() => promise());
            results.push(p);
            executing.add(p);

            const clean = () => executing.delete(p);
            p.then(clean, clean);

            if (executing.size >= limit) {
                await Promise.race(executing);
            }
        }

        return Promise.all(results);
    },

    /**
     * بررسی پشتیبانی مرورگر از یک ویژگی
     * @param {string} feature - ویژگی
     * @returns {boolean} پشتیبانی می‌شود یا خیر
     */
    supports(feature) {
        const features = {
            websocket: 'WebSocket' in window,
            localStorage: (() => {
                try {
                    localStorage.setItem('test', 'test');
                    localStorage.removeItem('test');
                    return true;
                } catch (e) {
                    return false;
                }
            })(),
            clipboard: 'clipboard' in navigator,
            vibration: 'vibrate' in navigator,
            notification: 'Notification' in window,
            serviceWorker: 'serviceWorker' in navigator,
            push: 'PushManager' in window,
            webgl: (() => {
                try {
                    const canvas = document.createElement('canvas');
                    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
                } catch (e) {
                    return false;
                }
            })()
        };

        return features[feature] || false;
    },

    /**
     * دریافت اطلاعات دستگاه
     * @returns {Object} اطلاعات دستگاه
     */
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            languages: navigator.languages,
            online: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
            isMobile: this.isMobile(),
            isTablet: this.isTablet(),
            isDesktop: this.isDesktop(),
            connectionType: this.getConnectionType(),
            connectionSpeed: this.getConnectionSpeed()
        };
    },

    /**
     * لاگ با سطح
     * @param {string} level - سطح (info, warn, error, debug)
     * @param {string} message - پیام
     * @param {*} data - داده
     */
    log(level = 'info', message, data = null) {
        if (CONFIG.DEBUG.ENABLED) {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
            
            switch (level) {
                case 'info':
                    console.log(logMessage, data || '');
                    break;
                case 'warn':
                    console.warn(logMessage, data || '');
                    break;
                case 'error':
                    console.error(logMessage, data || '');
                    break;
                case 'debug':
                    console.debug(logMessage, data || '');
                    break;
            }
        }
    },

    /**
     * لاگ اطلاعاتی
     */
    logInfo(message, data) {
        this.log('info', message, data);
    },

    /**
     * لاگ هشدار
     */
    logWarn(message, data) {
        this.log('warn', message, data);
    },

    /**
     * لاگ خطا
     */
    logError(message, data) {
        this.log('error', message, data);
    },

    /**
     * لاگ debug
     */
    logDebug(message, data) {
        this.log('debug', message, data);
    }

};

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
} else {
    window.Utils = Utils;
}

console.log('✅ Utils loaded - Total functions:', Object.keys(Utils).length);
