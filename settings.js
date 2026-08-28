/**
 * ============================================================
 * HOKM MASTER - Settings Manager
 * سیستم مدیریت تنظیمات بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل تمام تنظیمات بازی است. شامل
 * تنظیمات دستگاه (صدا، موسیقی، ویبره)، گرافیک (کیفیت، انیمیشن)،
 * بازی (تایمر، قوانین)، حریم خصوصی، اعلان‌ها، زبان، حساب
 * کاربری، و پشتیبان‌گیری/بازیابی تنظیمات.
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

class SettingsManager {

    constructor() {
        /**
         * تنظیمات دستگاه
         * @type {Object}
         */
        this.deviceSettings = {
            vibration: {
                enabled: true,
                intensity: 'medium', // light, medium, heavy
                patterns: {
                    light: [10],
                    medium: [20],
                    heavy: [30],
                    success: [10, 50, 20],
                    error: [30, 50, 30],
                    notification: [10, 100, 10]
                }
            },
            sound: {
                enabled: true,
                volume: 0.7,
                sfxVolume: 0.7,
                musicVolume: 0.5
            },
            hapticFeedback: {
                enabled: true,
                intensity: 'medium'
            }
        };

        /**
         * تنظیمات گرافیک
         * @type {Object}
         */
        this.graphicsSettings = {
            quality: 'medium', // low, medium, high
            fps: 60,
            particles: {
                enabled: true,
                maxCount: 50
            },
            shadows: {
                enabled: false
            },
            animations: {
                enabled: true,
                speed: 1.0, // 0.5, 1.0, 1.5, 2.0
                reducedMotion: false
            },
            screenShake: {
                enabled: true,
                intensity: 1.0
            },
            cardAnimations: {
                enabled: true,
                dealSpeed: 1.0,
                playSpeed: 1.0
            },
            backgroundColor: '#0d2924',
            theme: 'dark' // dark, light, auto
        };

        /**
         * تنظیمات بازی
         * @type {Object}
         */
        this.gameSettings = {
            timer: {
                enabled: true,
                duration: 30, // ثانیه
                warningTime: 10
            },
            autoPlay: {
                enabled: false,
                delay: 1000 // میلی‌ثانیه
            },
            showLastTrick: true,
            showProbabilities: false,
            confirmActions: {
                leaveGame: true,
                surrender: true,
                deleteAccount: true
            },
            soundOnCardPlay: true,
            soundOnTrickWin: true,
            soundOnRoundWin: true,
            soundOnMatchWin: true,
            autoSortCards: true,
            cardSortOrder: 'suit' // suit, rank, value
        };

        /**
         * تنظیمات حریم خصوصی
         * @type {Object}
         */
        this.privacySettings = {
            profileVisibility: 'public', // public, friends, private
            showOnlineStatus: true,
            showGameHistory: true,
            showStatistics: true,
            allowFriendRequests: true,
            allowGameInvites: true,
            allowMessages: 'friends', // everyone, friends, none
            dataCollection: {
                analytics: true,
                crashReports: true,
                performanceData: true
            },
            thirdPartySharing: false
        };

        /**
         * تنظیمات اعلان‌ها
         * @type {Object}
         */
        this.notificationSettings = {
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
                shop: false,
                system: true,
                maintenance: true,
                update: true
            },
            maxPerDay: 10
        };

        /**
         * تنظیمات زبان و منطقه
         * @type {Object}
         */
        this.languageSettings = {
            language: 'fa',
            region: 'IR',
            numberFormat: 'persian', // persian, english
            dateFormat: 'shamsi', // shamsi, gregorian
            timeFormat: '24h', // 12h, 24h
            rtl: true
        };

        /**
         * تنظیمات دسترسی‌پذیری
         * @type {Object}
         */
        this.accessibilitySettings = {
            fontSize: 1.0, // 0.8, 0.9, 1.0, 1.1, 1.2, 1.3
            highContrast: false,
            colorBlindMode: 'none', // none, protanopia, deuteranopia, tritanopia
            screenReader: false,
            largeButtons: false,
            simplifyUI: false
        };

        /**
         * تنظیمات حساب کاربری
         * @type {Object}
         */
        this.accountSettings = {
            twoFactorAuth: false,
            loginNotifications: true,
            sessionTimeout: 30, // دقیقه
            autoLogout: false,
            rememberMe: true
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
         * نسخه تنظیمات (برای migration)
         * @type {number}
         */
        this.settingsVersion = 1;

        /**
         * تاریخ آخرین تغییر
         * @type {number}
         */
        this.lastModified = Date.now();

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری تنظیمات ذخیره شده
        this._loadSettings();

        // بررسی migration
        this._checkMigration();

        // اعمال تنظیمات
        this._applySettings();

        if (this.debug) {
            console.log('⚙️ SettingsManager initialized');
            console.log('  Version:', this.settingsVersion);
            console.log('  Language:', this.languageSettings.language);
            console.log('  Quality:', this.graphicsSettings.quality);
        }
    }

    // ============================================================
    // بخش ۱: دریافت تنظیمات
    // ============================================================

    /**
     * دریافت تمام تنظیمات
     * @returns {Object}
     */
    getAllSettings() {
        return {
            version: this.settingsVersion,
            lastModified: this.lastModified,
            device: { ...this.deviceSettings },
            graphics: { ...this.graphicsSettings },
            game: { ...this.gameSettings },
            privacy: { ...this.privacySettings },
            notifications: { ...this.notificationSettings },
            language: { ...this.languageSettings },
            accessibility: { ...this.accessibilitySettings },
            account: { ...this.accountSettings }
        };
    }

    /**
     * دریافت تنظیمات دستگاه
     * @returns {Object}
     */
    getDeviceSettings() {
        return { ...this.deviceSettings };
    }

    /**
     * دریافت تنظیمات گرافیک
     * @returns {Object}
     */
    getGraphicsSettings() {
        return { ...this.graphicsSettings };
    }

    /**
     * دریافت تنظیمات بازی
     * @returns {Object}
     */
    getGameSettings() {
        return { ...this.gameSettings };
    }

    /**
     * دریافت تنظیمات حریم خصوصی
     * @returns {Object}
     */
    getPrivacySettings() {
        return { ...this.privacySettings };
    }

    /**
     * دریافت تنظیمات اعلان‌ها
     * @returns {Object}
     */
    getNotificationSettings() {
        return { ...this.notificationSettings };
    }

    /**
     * دریافت تنظیمات زبان
     * @returns {Object}
     */
    getLanguageSettings() {
        return { ...this.languageSettings };
    }

    /**
     * دریافت تنظیمات دسترسی‌پذیری
     * @returns {Object}
     */
    getAccessibilitySettings() {
        return { ...this.accessibilitySettings };
    }

    /**
     * دریافت تنظیمات حساب
     * @returns {Object}
     */
    getAccountSettings() {
        return { ...this.accountSettings };
    }

    // ============================================================
    // بخش ۲: به‌روزرسانی تنظیمات
    // ============================================================

    /**
     * به‌روزرسانی تنظیمات دستگاه
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateDeviceSettings(newSettings) {
        const oldSettings = { ...this.deviceSettings };

        this.deviceSettings = this._deepMerge(this.deviceSettings, newSettings);
        this.lastModified = Date.now();

        // اعمال تغییرات
        this._applyDeviceSettings();
        this._saveSettings();

        this._emit('device-settings-updated', {
            oldSettings,
            newSettings: this.deviceSettings
        });

        if (this.debug) {
            console.log('📱 Device settings updated');
        }

        return {
            success: true,
            oldSettings,
            newSettings: this.deviceSettings
        };
    }

    /**
     * به‌روزرسانی تنظیمات گرافیک
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateGraphicsSettings(newSettings) {
        const oldSettings = { ...this.graphicsSettings };

        this.graphicsSettings = this._deepMerge(this.graphicsSettings, newSettings);
        this.lastModified = Date.now();

        this._applyGraphicsSettings();
        this._saveSettings();

        this._emit('graphics-settings-updated', {
            oldSettings,
            newSettings: this.graphicsSettings
        });

        if (this.debug) {
            console.log('🎨 Graphics settings updated');
        }

        return {
            success: true,
            oldSettings,
            newSettings: this.graphicsSettings
        };
    }

    /**
     * به‌روزرسانی تنظیمات بازی
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateGameSettings(newSettings) {
        const oldSettings = { ...this.gameSettings };

        this.gameSettings = this._deepMerge(this.gameSettings, newSettings);
        this.lastModified = Date.now();

        this._applyGameSettings();
        this._saveSettings();

        this._emit('game-settings-updated', {
            oldSettings,
            newSettings: this.gameSettings
        });

        if (this.debug) {
            console.log('🎮 Game settings updated');
        }

        return {
            success: true,
            oldSettings,
            newSettings: this.gameSettings
        };
    }

    /**
     * به‌روزرسانی تنظیمات حریم خصوصی
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updatePrivacySettings(newSettings) {
        const oldSettings = { ...this.privacySettings };

        this.privacySettings = this._deepMerge(this.privacySettings, newSettings);
        this.lastModified = Date.now();

        this._applyPrivacySettings();
        this._saveSettings();

        this._emit('privacy-settings-updated', {
            oldSettings,
            newSettings: this.privacySettings
        });

        if (this.debug) {
            console.log(' Privacy settings updated');
        }

        return {
            success: true,
            oldSettings,
            newSettings: this.privacySettings
        };
    }

    /**
     * به‌روزرسانی تنظیمات اعلان‌ها
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateNotificationSettings(newSettings) {
        const oldSettings = { ...this.notificationSettings };

        this.notificationSettings = this._deepMerge(this.notificationSettings, newSettings);
        this.lastModified = Date.now();

        this._applyNotificationSettings();
        this._saveSettings();

        this._emit('notification-settings-updated', {
            oldSettings,
            newSettings: this.notificationSettings
        });

        if (this.debug) {
            console.log(' Notification settings updated');
        }

        return {
            success: true,
            oldSettings,
            newSettings: this.notificationSettings
        };
    }

    /**
     * به‌روزرسانی تنظیمات زبان
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateLanguageSettings(newSettings) {
        const oldSettings = { ...this.languageSettings };

        this.languageSettings = this._deepMerge(this.languageSettings, newSettings);
        this.lastModified = Date.now();

        // به‌روزرسانی RTL
        if (newSettings.language) {
            this.languageSettings.rtl = newSettings.language === 'fa';
        }

        this._applyLanguageSettings();
        this._saveSettings();

        this._emit('language-settings-updated', {
            oldSettings,
            newSettings: this.languageSettings
        });

        if (this.debug) {
            console.log(`🌐 Language changed to: ${this.languageSettings.language}`);
        }

        return {
            success: true,
            oldSettings,
            newSettings: this.languageSettings
        };
    }

    /**
     * به‌روزرسانی تنظیمات دسترسی‌پذیری
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateAccessibilitySettings(newSettings) {
        const oldSettings = { ...this.accessibilitySettings };

        this.accessibilitySettings = this._deepMerge(this.accessibilitySettings, newSettings);
        this.lastModified = Date.now();

        this._applyAccessibilitySettings();
        this._saveSettings();

        this._emit('accessibility-settings-updated', {
            oldSettings,
            newSettings: this.accessibilitySettings
        });

        if (this.debug) {
            console.log('♿ Accessibility settings updated');
        }

        return {
            success: true,
            oldSettings,
            newSettings: this.accessibilitySettings
        };
    }

    /**
     * به‌روزرسانی تنظیمات حساب
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateAccountSettings(newSettings) {
        const oldSettings = { ...this.accountSettings };

        this.accountSettings = this._deepMerge(this.accountSettings, newSettings);
        this.lastModified = Date.now();

        this._applyAccountSettings();
        this._saveSettings();

        this._emit('account-settings-updated', {
            oldSettings,
            newSettings: this.accountSettings
        });

        if (this.debug) {
            console.log('👤 Account settings updated');
        }

        return {
            success: true,
            oldSettings,
            newSettings: this.accountSettings
        };
    }

    // ============================================================
    // بخش ۳: تنظیمات سریع
    // ============================================================

    /**
     * تغییر وضعیت ویبره
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setVibration(enabled) {
        return this.updateDeviceSettings({
            vibration: { enabled }
        });
    }

    /**
     * تغییر شدت ویبره
     * @param {string} intensity - شدت (light, medium, heavy)
     * @returns {Object} نتیجه
     */
    setVibrationIntensity(intensity) {
        const validIntensities = ['light', 'medium', 'heavy'];
        if (!validIntensities.includes(intensity)) {
            return {
                success: false,
                error: 'INVALID_INTENSITY',
                message: 'شدت نامعتبر است'
            };
        }

        return this.updateDeviceSettings({
            vibration: { intensity }
        });
    }

    /**
     * تغییر حجم صدا
     * @param {number} volume - حجم (0 تا 1)
     * @returns {Object} نتیجه
     */
    setSoundVolume(volume) {
        if (volume < 0 || volume > 1) {
            return {
                success: false,
                error: 'INVALID_VOLUME',
                message: 'حجم باید بین 0 و 1 باشد'
            };
        }

        return this.updateDeviceSettings({
            sound: { volume }
        });
    }

    /**
     * تغییر حجم افکت‌های صوتی
     * @param {number} volume - حجم
     * @returns {Object} نتیجه
     */
    setSfxVolume(volume) {
        if (volume < 0 || volume > 1) {
            return {
                success: false,
                error: 'INVALID_VOLUME',
                message: 'حجم باید بین 0 و 1 باشد'
            };
        }

        return this.updateDeviceSettings({
            sound: { sfxVolume: volume }
        });
    }

    /**
     * تغییر حجم موسیقی
     * @param {number} volume - حجم
     * @returns {Object} نتیجه
     */
    setMusicVolume(volume) {
        if (volume < 0 || volume > 1) {
            return {
                success: false,
                error: 'INVALID_VOLUME',
                message: 'حجم باید بین 0 و 1 باشد'
            };
        }

        return this.updateDeviceSettings({
            sound: { musicVolume: volume }
        });
    }

    /**
     * تغییر کیفیت گرافیک
     * @param {string} quality - کیفیت (low, medium, high)
     * @returns {Object} نتیجه
     */
    setGraphicsQuality(quality) {
        const validQualities = ['low', 'medium', 'high'];
        if (!validQualities.includes(quality)) {
            return {
                success: false,
                error: 'INVALID_QUALITY',
                message: 'کیفیت نامعتبر است'
            };
        }

        return this.updateGraphicsSettings({ quality });
    }

    /**
     * تغییر تم
     * @param {string} theme - تم (dark, light, auto)
     * @returns {Object} نتیجه
     */
    setTheme(theme) {
        const validThemes = ['dark', 'light', 'auto'];
        if (!validThemes.includes(theme)) {
            return {
                success: false,
                error: 'INVALID_THEME',
                message: 'تم نامعتبر است'
            };
        }

        return this.updateGraphicsSettings({ theme });
    }

    /**
     * تغییر زبان
     * @param {string} language - کد زبان
     * @returns {Object} نتیجه
     */
    setLanguage(language) {
        const supportedLanguages = ['fa', 'en'];
        if (!supportedLanguages.includes(language)) {
            return {
                success: false,
                error: 'UNSUPPORTED_LANGUAGE',
                message: 'زبان پشتیبانی نمی‌شود'
            };
        }

        return this.updateLanguageSettings({ language });
    }

    /**
     * تغییر اندازه فونت
     * @param {number} size - اندازه (0.8 تا 1.3)
     * @returns {Object} نتیجه
     */
    setFontSize(size) {
        if (size < 0.8 || size > 1.3) {
            return {
                success: false,
                error: 'INVALID_SIZE',
                message: 'اندازه فونت باید بین 0.8 و 1.3 باشد'
            };
        }

        return this.updateAccessibilitySettings({ fontSize: size });
    }

    /**
     * تغییر وضعیت حالت کوررنگی
     * @param {string} mode - حالت
     * @returns {Object} نتیجه
     */
    setColorBlindMode(mode) {
        const validModes = ['none', 'protanopia', 'deuteranopia', 'tritanopia'];
        if (!validModes.includes(mode)) {
            return {
                success: false,
                error: 'INVALID_MODE',
                message: 'حالت نامعتبر است'
            };
        }

        return this.updateAccessibilitySettings({ colorBlindMode: mode });
    }

    /**
     * تغییر وضعیت تایمر بازی
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setGameTimer(enabled) {
        return this.updateGameSettings({
            timer: { enabled }
        });
    }

    /**
     * تغییر مدت تایمر بازی
     * @param {number} duration - مدت (ثانیه)
     * @returns {Object} نتیجه
     */
    setGameTimerDuration(duration) {
        if (duration < 10 || duration > 120) {
            return {
                success: false,
                error: 'INVALID_DURATION',
                message: 'مدت تایمر باید بین 10 تا 120 ثانیه باشد'
            };
        }

        return this.updateGameSettings({
            timer: { duration }
        });
    }

    /**
     * تغییر وضعیت نمایش آنلاین
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setShowOnlineStatus(enabled) {
        return this.updatePrivacySettings({ showOnlineStatus: enabled });
    }

    /**
     * تغییر وضعیت درخواست‌های دوستی
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setAllowFriendRequests(enabled) {
        return this.updatePrivacySettings({ allowFriendRequests: enabled });
    }

    /**
     * تغییر وضعیت احراز هویت دو مرحله‌ای
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setTwoFactorAuth(enabled) {
        return this.updateAccountSettings({ twoFactorAuth: enabled });
    }

    // ============================================================
    // بخش ۴: اعمال تنظیمات
    // ============================================================

    /**
     * اعمال تمام تنظیمات
     * @private
     */
    _applySettings() {
        this._applyDeviceSettings();
        this._applyGraphicsSettings();
        this._applyGameSettings();
        this._applyPrivacySettings();
        this._applyNotificationSettings();
        this._applyLanguageSettings();
        this._applyAccessibilitySettings();
        this._applyAccountSettings();
    }

    /**
     * اعمال تنظیمات دستگاه
     * @private
     */
    _applyDeviceSettings() {
        // اعمال ویبره
        if ('vibrate' in navigator) {
            // ویبره فقط هنگام نیاز اعمال می‌شود
        }

        // اعمال صدا
        if (typeof audioManager !== 'undefined') {
            audioManager?.setMasterVolume(this.deviceSettings.sound.volume);
            audioManager?.setSfxVolume(this.deviceSettings.sound.sfxVolume);
            audioManager?.setMusicVolume(this.deviceSettings.sound.musicVolume);
            audioManager?.setEnabled(this.deviceSettings.sound.enabled);
        }
    }

    /**
     * اعمال تنظیمات گرافیک
     * @private
     */
    _applyGraphicsSettings() {
        // اعمال کیفیت
        const root = document.documentElement;
        if (root) {
            root.setAttribute('data-quality', this.graphicsSettings.quality);
            root.setAttribute('data-theme', this.graphicsSettings.theme);
        }

        // اعمال FPS
        if (this.graphicsSettings.fps === 30) {
            // کاهش frame rate
        }

        // اعمال انیمیشن
        if (this.graphicsSettings.animations.reducedMotion) {
            if (root) {
                root.classList.add('reduced-motion');
            }
        } else {
            if (root) {
                root.classList.remove('reduced-motion');
            }
        }
    }

    /**
     * اعمال تنظیمات بازی
     * @private
     */
    _applyGameSettings() {
        // اعمال به game engine
        if (typeof hokmEngine !== 'undefined' && hokmEngine) {
            if (hokmEngine.setRules) {
                hokmEngine.setRules({
                    timerEnabled: this.gameSettings.timer.enabled,
                    timerDuration: this.gameSettings.timer.duration
                });
            }
        }
    }

    /**
     * اعمال تنظیمات حریم خصوصی
     * @private
     */
    _applyPrivacySettings() {
        // اعمال به friends manager
        if (typeof friendsManager !== 'undefined' && friendsManager) {
            friendsManager.limits = {
                ...friendsManager.limits,
                allowFriendRequests: this.privacySettings.allowFriendRequests
            };
        }
    }

    /**
     * اعمال تنظیمات اعلان‌ها
     * @private
     */
    _applyNotificationSettings() {
        if (typeof notificationsManager !== 'undefined' && notificationsManager) {
            notificationsManager.updateSettings(this.notificationSettings);
        }
    }

    /**
     * اعمال تنظیمات زبان
     * @private
     */
    _applyLanguageSettings() {
        const root = document.documentElement;
        if (root) {
            root.setAttribute('lang', this.languageSettings.language);
            root.setAttribute('dir', this.languageSettings.rtl ? 'rtl' : 'ltr');
        }

        // به‌روزرسانی فرمت اعداد
        if (typeof Utils !== 'undefined') {
            Utils.numberFormat = this.languageSettings.numberFormat;
        }
    }

    /**
     * اعمال تنظیمات دسترسی‌پذیری
     * @private
     */
    _applyAccessibilitySettings() {
        const root = document.documentElement;
        if (root) {
            root.style.setProperty('--font-scale', this.accessibilitySettings.fontSize);

            if (this.accessibilitySettings.highContrast) {
                root.classList.add('high-contrast');
            } else {
                root.classList.remove('high-contrast');
            }

            if (this.accessibilitySettings.colorBlindMode !== 'none') {
                root.setAttribute('data-colorblind', this.accessibilitySettings.colorBlindMode);
            } else {
                root.removeAttribute('data-colorblind');
            }

            if (this.accessibilitySettings.largeButtons) {
                root.classList.add('large-buttons');
            } else {
                root.classList.remove('large-buttons');
            }
        }
    }

    /**
     * اعمال تنظیمات حساب
     * @private
     */
    _applyAccountSettings() {
        // تنظیم timeout session
        if (typeof sessionManager !== 'undefined' && sessionManager) {
            sessionManager.sessionTimeout = this.accountSettings.sessionTimeout * 60 * 1000;
        }
    }

    // ============================================================
    // بخش ۵: پیش‌فرض‌ها و ریست
    // ============================================================

    /**
     * ریست به تنظیمات پیش‌فرض
     * @param {string} category - دسته‌بندی (همه یا خاص)
     * @returns {Object} نتیجه
     */
    resetToDefaults(category = 'all') {
        const oldSettings = this.getAllSettings();

        if (category === 'all' || category === 'device') {
            this.deviceSettings = this._getDefaultDeviceSettings();
        }

        if (category === 'all' || category === 'graphics') {
            this.graphicsSettings = this._getDefaultGraphicsSettings();
        }

        if (category === 'all' || category === 'game') {
            this.gameSettings = this._getDefaultGameSettings();
        }

        if (category === 'all' || category === 'privacy') {
            this.privacySettings = this._getDefaultPrivacySettings();
        }

        if (category === 'all' || category === 'notifications') {
            this.notificationSettings = this._getDefaultNotificationSettings();
        }

        if (category === 'all' || category === 'language') {
            this.languageSettings = this._getDefaultLanguageSettings();
        }

        if (category === 'all' || category === 'accessibility') {
            this.accessibilitySettings = this._getDefaultAccessibilitySettings();
        }

        if (category === 'all' || category === 'account') {
            this.accountSettings = this._getDefaultAccountSettings();
        }

        this.lastModified = Date.now();
        this._applySettings();
        this._saveSettings();

        this._emit('settings-reset', {
            category,
            oldSettings,
            newSettings: this.getAllSettings()
        });

        if (this.debug) {
            console.log(`🔄 Settings reset: ${category}`);
        }

        return {
            success: true,
            category,
            newSettings: this.getAllSettings()
        };
    }

    /**
     * دریافت تنظیمات پیش‌فرض دستگاه
     * @returns {Object}
     * @private
     */
    _getDefaultDeviceSettings() {
        return {
            vibration: {
                enabled: true,
                intensity: 'medium',
                patterns: {
                    light: [10],
                    medium: [20],
                    heavy: [30],
                    success: [10, 50, 20],
                    error: [30, 50, 30],
                    notification: [10, 100, 10]
                }
            },
            sound: {
                enabled: true,
                volume: 0.7,
                sfxVolume: 0.7,
                musicVolume: 0.5
            },
            hapticFeedback: {
                enabled: true,
                intensity: 'medium'
            }
        };
    }

    /**
     * دریافت تنظیمات پیش‌فرض گرافیک
     * @returns {Object}
     * @private
     */
    _getDefaultGraphicsSettings() {
        return {
            quality: 'medium',
            fps: 60,
            particles: { enabled: true, maxCount: 50 },
            shadows: { enabled: false },
            animations: { enabled: true, speed: 1.0, reducedMotion: false },
            screenShake: { enabled: true, intensity: 1.0 },
            cardAnimations: { enabled: true, dealSpeed: 1.0, playSpeed: 1.0 },
            backgroundColor: '#0d2924',
            theme: 'dark'
        };
    }

    /**
     * دریافت تنظیمات پیش‌فرض بازی
     * @returns {Object}
     * @private
     */
    _getDefaultGameSettings() {
        return {
            timer: { enabled: true, duration: 30, warningTime: 10 },
            autoPlay: { enabled: false, delay: 1000 },
            showLastTrick: true,
            showProbabilities: false,
            confirmActions: {
                leaveGame: true,
                surrender: true,
                deleteAccount: true
            },
            soundOnCardPlay: true,
            soundOnTrickWin: true,
            soundOnRoundWin: true,
            soundOnMatchWin: true,
            autoSortCards: true,
            cardSortOrder: 'suit'
        };
    }

    /**
     * دریافت تنظیمات پیش‌فرض حریم خصوصی
     * @returns {Object}
     * @private
     */
    _getDefaultPrivacySettings() {
        return {
            profileVisibility: 'public',
            showOnlineStatus: true,
            showGameHistory: true,
            showStatistics: true,
            allowFriendRequests: true,
            allowGameInvites: true,
            allowMessages: 'friends',
            dataCollection: {
                analytics: true,
                crashReports: true,
                performanceData: true
            },
            thirdPartySharing: false
        };
    }

    /**
     * دریافت تنظیمات پیش‌فرض اعلان‌ها
     * @returns {Object}
     * @private
     */
    _getDefaultNotificationSettings() {
        return {
            enabled: true,
            sound: true,
            vibration: true,
            pushEnabled: true,
            quietHours: { enabled: false, start: 23, end: 8 },
            types: {
                friend_request: true,
                game_invite: true,
                reward: true,
                mission: true,
                league: true,
                tournament: true,
                event: true,
                shop: false,
                system: true,
                maintenance: true,
                update: true
            },
            maxPerDay: 10
        };
    }

    /**
     * دریافت تنظیمات پیش‌فرض زبان
     * @returns {Object}
     * @private
     */
    _getDefaultLanguageSettings() {
        return {
            language: 'fa',
            region: 'IR',
            numberFormat: 'persian',
            dateFormat: 'shamsi',
            timeFormat: '24h',
            rtl: true
        };
    }

    /**
     * دریافت تنظیمات پیش‌فرض دسترسی‌پذیری
     * @returns {Object}
     * @private
     */
    _getDefaultAccessibilitySettings() {
        return {
            fontSize: 1.0,
            highContrast: false,
            colorBlindMode: 'none',
            screenReader: false,
            largeButtons: false,
            simplifyUI: false
        };
    }

    /**
     * دریافت تنظیمات پیش‌فرض حساب
     * @returns {Object}
     * @private
     */
    _getDefaultAccountSettings() {
        return {
            twoFactorAuth: false,
            loginNotifications: true,
            sessionTimeout: 30,
            autoLogout: false,
            rememberMe: true
        };
    }

    // ============================================================
    // بخش ۶: پشتیبان‌گیری و بازیابی
    // ============================================================

    /**
     * ایجاد پشتیبان از تنظیمات
     * @returns {Object} نتیجه
     */
    createBackup() {
        const backup = {
            version: this.settingsVersion,
            createdAt: Date.now(),
            appVersion: CONFIG.APP.VERSION,
            settings: this.getAllSettings()
        };

        const backupId = Utils.generateUUID();
        storage?.set(`settings_backup_${backupId}`, backup);

        this._emit('settings-backup-created', { backupId, backup });

        if (this.debug) {
            console.log(`💾 Settings backup created: ${backupId}`);
        }

        return {
            success: true,
            backupId,
            backup
        };
    }

    /**
     * بازیابی تنظیمات از پشتیبان
     * @param {string} backupId - شناسه پشتیبان
     * @returns {Object} نتیجه
     */
    restoreBackup(backupId) {
        const backup = storage?.get(`settings_backup_${backupId}`);
        if (!backup) {
            return {
                success: false,
                error: 'BACKUP_NOT_FOUND',
                message: 'پشتیبان یافت نشد'
            };
        }

        const oldSettings = this.getAllSettings();

        // بازیابی تنظیمات
        if (backup.settings.device) this.deviceSettings = backup.settings.device;
        if (backup.settings.graphics) this.graphicsSettings = backup.settings.graphics;
        if (backup.settings.game) this.gameSettings = backup.settings.game;
        if (backup.settings.privacy) this.privacySettings = backup.settings.privacy;
        if (backup.settings.notifications) this.notificationSettings = backup.settings.notifications;
        if (backup.settings.language) this.languageSettings = backup.settings.language;
        if (backup.settings.accessibility) this.accessibilitySettings = backup.settings.accessibility;
        if (backup.settings.account) this.accountSettings = backup.settings.account;

        this.lastModified = Date.now();
        this._applySettings();
        this._saveSettings();

        this._emit('settings-restored', {
            backupId,
            oldSettings,
            newSettings: this.getAllSettings()
        });

        if (this.debug) {
            console.log(`♻️ Settings restored from backup: ${backupId}`);
        }

        return {
            success: true,
            backupId,
            oldSettings,
            newSettings: this.getAllSettings()
        };
    }

    /**
     * دریافت لیست پشتیبان‌ها
     * @returns {Array<Object>}
     */
    getBackups() {
        const backups = [];
        if (!storage) return backups;

        // جستجو در storage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('settings_backup_')) {
                const backup = storage.get(key);
                if (backup) {
                    backups.push({
                        id: key.replace('settings_backup_', ''),
                        createdAt: backup.createdAt,
                        appVersion: backup.appVersion,
                        version: backup.version
                    });
                }
            }
        }

        // مرتب‌سازی بر اساس تاریخ
        backups.sort((a, b) => b.createdAt - a.createdAt);

        return backups;
    }

    /**
     * حذف پشتیبان
     * @param {string} backupId - شناسه پشتیبان
     * @returns {Object} نتیجه
     */
    deleteBackup(backupId) {
        const key = `settings_backup_${backupId}`;
        storage?.remove(key);

        this._emit('settings-backup-deleted', { backupId });

        return {
            success: true,
            backupId
        };
    }

    /**
     * export تنظیمات به JSON
     * @returns {string} JSON string
     */
    exportToJSON() {
        return JSON.stringify(this.getAllSettings(), null, 2);
    }

    /**
     * import تنظیمات از JSON
     * @param {string} jsonString - JSON string
     * @returns {Object} نتیجه
     */
    importFromJSON(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            const oldSettings = this.getAllSettings();

            if (imported.device) this.deviceSettings = this._deepMerge(this.deviceSettings, imported.device);
            if (imported.graphics) this.graphicsSettings = this._deepMerge(this.graphicsSettings, imported.graphics);
            if (imported.game) this.gameSettings = this._deepMerge(this.gameSettings, imported.game);
            if (imported.privacy) this.privacySettings = this._deepMerge(this.privacySettings, imported.privacy);
            if (imported.notifications) this.notificationSettings = this._deepMerge(this.notificationSettings, imported.notifications);
            if (imported.language) this.languageSettings = this._deepMerge(this.languageSettings, imported.language);
            if (imported.accessibility) this.accessibilitySettings = this._deepMerge(this.accessibilitySettings, imported.accessibility);
            if (imported.account) this.accountSettings = this._deepMerge(this.accountSettings, imported.account);

            this.lastModified = Date.now();
            this._applySettings();
            this._saveSettings();

            this._emit('settings-imported', {
                oldSettings,
                newSettings: this.getAllSettings()
            });

            return {
                success: true,
                oldSettings,
                newSettings: this.getAllSettings()
            };
        } catch (error) {
            return {
                success: false,
                error: 'INVALID_JSON',
                message: 'فرمت JSON نامعتبر است'
            };
        }
    }

    // ============================================================
    // بخش ۷: Migration
    // ============================================================

    /**
     * بررسی migration
     * @private
     */
    _checkMigration() {
        const savedVersion = storage?.get('settings_version') || 0;

        if (savedVersion < this.settingsVersion) {
            this._migrateSettings(savedVersion, this.settingsVersion);
        }
    }

    /**
     * migration تنظیمات
     * @param {number} fromVersion - نسخه مبدأ
     * @param {number} toVersion - نسخه مقصد
     * @private
     */
    _migrateSettings(fromVersion, toVersion) {
        if (fromVersion < 1) {
            // Migration از v0 به v1
            // اضافه کردن تنظیمات جدید
            if (!this.accessibilitySettings.colorBlindMode) {
                this.accessibilitySettings.colorBlindMode = 'none';
            }

            if (!this.gameSettings.cardSortOrder) {
                this.gameSettings.cardSortOrder = 'suit';
            }
        }

        // به‌روزرسانی نسخه
        storage?.set('settings_version', this.settingsVersion);

        if (this.debug) {
            console.log(`🔄 Settings migrated from v${fromVersion} to v${toVersion}`);
        }
    }

    // ============================================================
    // بخش : توابع کمکی
    // ============================================================

    /**
     * ادغام عمیق دو آبجکت
     * @param {Object} target - هدف
     * @param {Object} source - منبع
     * @returns {Object}
     * @private
     */
    _deepMerge(target, source) {
        if (!source) return target;

        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
                    result[key] = this._deepMerge(target[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * ذخیره تنظیمات
     * @private
     */
    _saveSettings() {
        if (storage) {
            storage.set('settings_device', this.deviceSettings);
            storage.set('settings_graphics', this.graphicsSettings);
            storage.set('settings_game', this.gameSettings);
            storage.set('settings_privacy', this.privacySettings);
            storage.set('settings_notifications', this.notificationSettings);
            storage.set('settings_language', this.languageSettings);
            storage.set('settings_accessibility', this.accessibilitySettings);
            storage.set('settings_account', this.accountSettings);
            storage.set('settings_version', this.settingsVersion);
            storage.set('settings_last_modified', this.lastModified);
        }
    }

    /**
     * بارگذاری تنظیمات
     * @private
     */
    _loadSettings() {
        if (storage) {
            const device = storage.get('settings_device');
            if (device) this.deviceSettings = this._deepMerge(this._getDefaultDeviceSettings(), device);

            const graphics = storage.get('settings_graphics');
            if (graphics) this.graphicsSettings = this._deepMerge(this._getDefaultGraphicsSettings(), graphics);

            const game = storage.get('settings_game');
            if (game) this.gameSettings = this._deepMerge(this._getDefaultGameSettings(), game);

            const privacy = storage.get('settings_privacy');
            if (privacy) this.privacySettings = this._deepMerge(this._getDefaultPrivacySettings(), privacy);

            const notifications = storage.get('settings_notifications');
            if (notifications) this.notificationSettings = this._deepMerge(this._getDefaultNotificationSettings(), notifications);

            const language = storage.get('settings_language');
            if (language) this.languageSettings = this._deepMerge(this._getDefaultLanguageSettings(), language);

            const accessibility = storage.get('settings_accessibility');
            if (accessibility) this.accessibilitySettings = this._deepMerge(this._getDefaultAccessibilitySettings(), accessibility);

            const account = storage.get('settings_account');
            if (account) this.accountSettings = this._deepMerge(this._getDefaultAccountSettings(), account);

            const version = storage.get('settings_version');
            if (version) this.settingsVersion = version;

            const lastModified = storage.get('settings_last_modified');
            if (lastModified) this.lastModified = lastModified;
        }
    }

    // ============================================================
    // بخش ۹: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار تنظیمات
     * @returns {Object}
     */
    getStats() {
        return {
            version: this.settingsVersion,
            lastModified: this.lastModified,
            lastModifiedAgo: Utils.timeAgo(this.lastModified),
            categories: {
                device: this.deviceSettings,
                graphics: this.graphicsSettings,
                game: this.gameSettings,
                privacy: this.privacySettings,
                notifications: this.notificationSettings,
                language: this.languageSettings,
                accessibility: this.accessibilitySettings,
                account: this.accountSettings
            },
            backupsCount: this.getBackups().length
        };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();

        console.log('⚙️ SettingsManager Status:');
        console.log('  Version:', stats.version);
        console.log('  Last Modified:', stats.lastModifiedAgo);
        console.log('  Language:', this.languageSettings.language);
        console.log('  Theme:', this.graphicsSettings.theme);
        console.log('  Quality:', this.graphicsSettings.quality);
        console.log('  Sound Volume:', this.deviceSettings.sound.volume);
        console.log('  Backups:', stats.backupsCount);
    }

    // ============================================================
    // بخش ۱۰: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.resetToDefaults('all');

        // حذف تمام پشتیبان‌ها
        const backups = this.getBackups();
        backups.forEach(backup => {
            this.deleteBackup(backup.id);
        });

        if (this.debug) {
            console.log('🔄 SettingsManager reset');
        }
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
                    console.error(`❌ Settings event listener error:`, error);
                }
            });
        }

        eventBus.emit(`settings:${event}`, data);
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
const settingsManager = new SettingsManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SettingsManager, settingsManager };
} else {
    window.SettingsManager = SettingsManager;
    window.settingsManager = settingsManager;
}

console.log('✅ SettingsManager loaded');
