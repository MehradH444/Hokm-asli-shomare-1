/**
 * ============================================================
 * HOKM MASTER - Screen Manager
 * سیستم مدیریت صفحات و نمایش رابط کاربری
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل صفحات (Screens) در اپلیکیشن است.
 * شامل ثبت صفحات، مدیریت چرخه حیات (lifecycle)، cache کردن،
 * transitions، modal management، screen-specific data،
 * و هماهنگی با router برای نمایش صفحات.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - storage (از فایل storage.js)
 * - uiRouter (از فایل router.js)
 * 
 * ============================================================
 */

class ScreenManager {

    constructor() {
        /**
         * ثبت صفحات
         * @type {Map<string, Object>}
         */
        this.screens = new Map();

        /**
         * صفحه فعال فعلی
         * @type {Object|null}
         */
        this.activeScreen = null;

        /**
         * صفحات در حال نمایش (stack)
         * @type {Array<Object>}
         */
        this.screenStack = [];

        /**
         * صفحات cache شده
         * @type {Map<string, Object>}
         */
        this.screenCache = new Map();

        /**
         * حداکثر اندازه cache
         * @type {number}
         */
        this.maxCacheSize = 10;

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
         * آیا Screen Manager فعال است
         * @type {boolean}
         */
        this.enabled = true;

        /**
         * آمار Screen Manager
         * @type {Object}
         */
        this.stats = {
            totalScreensRegistered: 0,
            totalScreenActivations: 0,
            totalScreenDeactivations: 0,
            totalCacheHits: 0,
            totalCacheMisses: 0,
            totalTransitions: 0,
            averageTransitionTime: 0,
            lastActivationAt: null
        };

        /**
         * پیکربندی
         * @type {Object}
         */
        this.config = {
            enableCache: true,
            enableTransitions: true,
            transitionDuration: 300,
            maxStackSize: 10,
            preloadScreens: ['home', 'game', 'profile']
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

        // ثبت صفحات پیش‌فرض
        this._registerDefaultScreens();

        // preload صفحات مهم
        if (this.config.preloadScreens.length > 0) {
            this._preloadScreens(this.config.preloadScreens);
        }

        if (this.debug) {
            console.log('🖥️ ScreenManager initialized');
            console.log('  Registered Screens:', this.screens.size);
            console.log('  Cache Size:', this.screenCache.size);
        }
    }

    // ============================================================
    // بخش ۱: ثبت صفحات
    // ============================================================

    /**
     * ثبت صفحه جدید
     * @param {Object} screenConfig - پیکربندی صفحه
     * @returns {Object} نتیجه
     */
    registerScreen(screenConfig) {
        const {
            name,
            component,
            title,
            icon,
            requiresAuth = false,
            cacheable = true,
            transition = 'fade',
            onBeforeEnter = null,
            onAfterEnter = null,
            onBeforeLeave = null,
            onAfterLeave = null,
            data = {},
            meta = {}
        } = screenConfig;

        if (!name || !component) {
            return {
                success: false,
                error: 'INVALID_CONFIG',
                message: 'نام و کامپوننت صفحه الزامی است'
            };
        }

        const screen = {
            name,
            component,
            title: title || name,
            icon: icon || null,
            requiresAuth,
            cacheable,
            transition,
            lifecycle: {
                onBeforeEnter,
                onAfterEnter,
                onBeforeLeave,
                onAfterLeave
            },
            data: { ...data },
            meta: { ...meta },
            registeredAt: Date.now(),
            isActive: false,
            activationCount: 0,
            lastActivatedAt: null
        };

        this.screens.set(name, screen);
        this.stats.totalScreensRegistered++;

        this._emit('screen-registered', { screen });

        if (this.debug) {
            console.log(`📝 Screen registered: ${name}`);
        }

        return {
            success: true,
            screen
        };
    }

    /**
     * ثبت چند صفحه همزمان
     * @param {Array<Object>} screenConfigs - پیکربندی صفحات
     * @returns {Object} نتیجه
     */
    registerScreens(screenConfigs) {
        const results = [];

        screenConfigs.forEach(config => {
            results.push(this.registerScreen(config));
        });

        return {
            success: true,
            results
        };
    }

    /**
     * حذف صفحه
     * @param {string} screenName - نام صفحه
     * @returns {Object} نتیجه
     */
    unregisterScreen(screenName) {
        if (!this.screens.has(screenName)) {
            return {
                success: false,
                error: 'SCREEN_NOT_FOUND',
                message: 'صفحه یافت نشد'
            };
        }

        // اگر صفحه فعال است، deactivate کن
        if (this.activeScreen?.name === screenName) {
            this.deactivateScreen(screenName);
        }

        // حذف از cache
        this.screenCache.delete(screenName);

        // حذف از stack
        this.screenStack = this.screenStack.filter(s => s.name !== screenName);

        this.screens.delete(screenName);

        this._emit('screen-unregistered', { screenName });

        if (this.debug) {
            console.log(`🗑️ Screen unregistered: ${screenName}`);
        }

        return {
            success: true,
            screenName
        };
    }

    /**
     * دریافت صفحه
     * @param {string} screenName - نام صفحه
     * @returns {Object|null}
     */
    getScreen(screenName) {
        return this.screens.get(screenName) || null;
    }

    /**
     * دریافت تمام صفحات
     * @returns {Array<Object>}
     */
    getAllScreens() {
        return Array.from(this.screens.values());
    }

    /**
     * بررسی وجود صفحه
     * @param {string} screenName - نام صفحه
     * @returns {boolean}
     */
    hasScreen(screenName) {
        return this.screens.has(screenName);
    }

    // ============================================================
    // بخش ۲: فعال‌سازی و غیرفعال‌سازی
    // ============================================================

    /**
     * فعال‌سازی صفحه
     * @param {string} screenName - نام صفحه
     * @param {Object} params - پارامترها
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    async activateScreen(screenName, params = {}, options = {}) {
        if (!this.enabled) {
            return {
                success: false,
                error: 'SCREEN_MANAGER_DISABLED',
                message: 'Screen Manager غیرفعال است'
            };
        }

        const screen = this.screens.get(screenName);
        if (!screen) {
            return {
                success: false,
                error: 'SCREEN_NOT_FOUND',
                message: `صفحه "${screenName}" یافت نشد`
            };
        }

        const {
            skipLifecycle = false,
            skipTransition = false,
            force = false
        } = options;

        // اگر صفحه قبلاً فعال است
        if (this.activeScreen?.name === screenName && !force) {
            return {
                success: true,
                screen: screen,
                message: 'صفحه قبلاً فعال است'
            };
        }

        // اجرای onBeforeEnter
        if (!skipLifecycle && screen.lifecycle.onBeforeEnter) {
            try {
                const result = await screen.lifecycle.onBeforeEnter(screen, params);
                if (result === false) {
                    return {
                        success: false,
                        error: 'BEFORE_ENTER_REJECTED',
                        message: 'فعال‌سازی صفحه رد شد'
                    };
                }
            } catch (error) {
                console.error(` onBeforeEnter failed for ${screenName}:`, error);
            }
        }

        // غیرفعال‌سازی صفحه قبلی
        if (this.activeScreen && this.activeScreen.name !== screenName) {
            await this.deactivateScreen(this.activeScreen.name, { skipTransition });
        }

        // اضافه کردن به stack
        if (this.screenStack.length >= this.config.maxStackSize) {
            this.screenStack.shift();
        }
        this.screenStack.push(screen);

        // به‌روزرسانی وضعیت صفحه
        screen.isActive = true;
        screen.activationCount++;
        screen.lastActivatedAt = Date.now();

        // cache کردن صفحه
        if (screen.cacheable && this.config.enableCache) {
            this._cacheScreen(screen, params);
        }

        // اعمال transition
        if (!skipTransition && this.config.enableTransitions) {
            await this._applyScreenTransition(screen);
        }

        // به‌روزرسانی صفحه فعال
        this.activeScreen = screen;

        // اجرای onAfterEnter
        if (!skipLifecycle && screen.lifecycle.onAfterEnter) {
            try {
                await screen.lifecycle.onAfterEnter(screen, params);
            } catch (error) {
                console.error(` onAfterEnter failed for ${screenName}:`, error);
            }
        }

        // به‌روزرسانی آمار
        this.stats.totalScreenActivations++;
        this.stats.lastActivationAt = Date.now();

        this._emit('screen-activated', {
            screen,
            params,
            previousScreen: this.activeScreen
        });

        if (this.debug) {
            console.log(`✅ Screen activated: ${screenName}`);
        }

        return {
            success: true,
            screen,
            params
        };
    }

    /**
     * غیرفعال‌سازی صفحه
     * @param {string} screenName - نام صفحه
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    async deactivateScreen(screenName, options = {}) {
        const screen = this.screens.get(screenName);
        if (!screen) {
            return {
                success: false,
                error: 'SCREEN_NOT_FOUND',
                message: 'صفحه یافت نشد'
            };
        }

        const {
            skipLifecycle = false,
            skipTransition = false
        } = options;

        // اجرای onBeforeLeave
        if (!skipLifecycle && screen.lifecycle.onBeforeLeave) {
            try {
                const result = await screen.lifecycle.onBeforeLeave(screen);
                if (result === false) {
                    return {
                        success: false,
                        error: 'BEFORE_LEAVE_REJECTED',
                        message: 'غیرفعال‌سازی صفحه رد شد'
                    };
                }
            } catch (error) {
                console.error(`❌ onBeforeLeave failed for ${screenName}:`, error);
            }
        }

        // اعمال transition
        if (!skipTransition && this.config.enableTransitions) {
            await this._applyScreenTransition(screen, 'leave');
        }

        // به‌روزرسانی وضعیت
        screen.isActive = false;

        // حذف از stack
        this.screenStack = this.screenStack.filter(s => s.name !== screenName);

        // اجرای onAfterLeave
        if (!skipLifecycle && screen.lifecycle.onAfterLeave) {
            try {
                await screen.lifecycle.onAfterLeave(screen);
            } catch (error) {
                console.error(`❌ onAfterLeave failed for ${screenName}:`, error);
            }
        }

        // به‌روزرسانی صفحه فعال
        if (this.activeScreen?.name === screenName) {
            this.activeScreen = null;
        }

        // به‌روزرسانی آمار
        this.stats.totalScreenDeactivations++;

        this._emit('screen-deactivated', { screen });

        if (this.debug) {
            console.log(`❌ Screen deactivated: ${screenName}`);
        }

        return {
            success: true,
            screen
        };
    }

    // ============================================================
    // بخش ۳: Cache Management
    // ============================================================

    /**
     * cache کردن صفحه
     * @param {Object} screen - صفحه
     * @param {Object} params - پارامترها
     * @private
     */
    _cacheScreen(screen, params) {
        // بررسی اندازه cache
        if (this.screenCache.size >= this.maxCacheSize) {
            this._evictOldestCache();
        }

        this.screenCache.set(screen.name, {
            screen,
            params,
            cachedAt: Date.now(),
            accessCount: 1
        });

        if (this.debug) {
            console.log(`💾 Screen cached: ${screen.name}`);
        }
    }

    /**
     * دریافت صفحه از cache
     * @param {string} screenName - نام صفحه
     * @returns {Object|null}
     */
    getCachedScreen(screenName) {
        const cached = this.screenCache.get(screenName);
        
        if (cached) {
            cached.accessCount++;
            cached.lastAccessedAt = Date.now();
            this.stats.totalCacheHits++;

            return cached;
        }

        this.stats.totalCacheMisses++;
        return null;
    }

    /**
     * حذف صفحه از cache
     * @param {string} screenName - نام صفحه
     * @returns {Object} نتیجه
     */
    clearScreenCache(screenName) {
        if (!this.screenCache.has(screenName)) {
            return {
                success: false,
                error: 'NOT_CACHED',
                message: 'صفحه در cache نیست'
            };
        }

        this.screenCache.delete(screenName);

        if (this.debug) {
            console.log(`️ Screen cache cleared: ${screenName}`);
        }

        return {
            success: true,
            screenName
        };
    }

    /**
     * پاک کردن تمام cache
     * @returns {number} تعداد پاکسازی شده
     */
    clearAllCache() {
        const count = this.screenCache.size;
        this.screenCache.clear();

        if (this.debug) {
            console.log(`🗑️ All screen cache cleared: ${count} items`);
        }

        return count;
    }

    /**
     * حذف قدیمی‌ترین cache
     * @private
     */
    _evictOldestCache() {
        let oldestKey = null;
        let oldestTime = Infinity;

        this.screenCache.forEach((value, key) => {
            if (value.cachedAt < oldestTime) {
                oldestTime = value.cachedAt;
                oldestKey = key;
            }
        });

        if (oldestKey) {
            this.screenCache.delete(oldestKey);

            if (this.debug) {
                console.log(`🗑️ Evicted oldest cache: ${oldestKey}`);
            }
        }
    }

    /**
     * دریافت آمار cache
     * @returns {Object}
     */
    getCacheStats() {
        return {
            size: this.screenCache.size,
            maxSize: this.maxCacheSize,
            hitRate: this.stats.totalCacheHits / Math.max(1, this.stats.totalCacheHits + this.stats.totalCacheMisses) * 100
        };
    }

    // ============================================================
    // بخش ۴: Screen Stack
    // ============================================================

    /**
     * دریافت stack صفحات
     * @returns {Array<Object>}
     */
    getScreenStack() {
        return [...this.screenStack];
    }

    /**
     * دریافت صفحه بالای stack
     * @returns {Object|null}
     */
    getTopScreen() {
        return this.screenStack[this.screenStack.length - 1] || null;
    }

    /**
     * پاپ کردن صفحه از stack
     * @returns {Object|null}
     */
    async popScreen() {
        if (this.screenStack.length <= 1) {
            return null;
        }

        const screen = this.screenStack.pop();
        await this.deactivateScreen(screen.name);

        // فعال‌سازی صفحه قبلی
        const previousScreen = this.getTopScreen();
        if (previousScreen) {
            await this.activateScreen(previousScreen.name, {}, { skipTransition: true });
        }

        return screen;
    }

    /**
     * پاک کردن stack
     * @returns {number} تعداد پاکسازی شده
     */
    async clearStack() {
        const count = this.screenStack.length;

        for (const screen of this.screenStack) {
            await this.deactivateScreen(screen.name);
        }

        this.screenStack = [];

        if (this.debug) {
            console.log(`🗑️ Screen stack cleared: ${count} items`);
        }

        return count;
    }

    // ============================================================
    // بخش ۵: Transition Animations
    // ============================================================

    /**
     * اعمال transition صفحه
     * @param {Object} screen - صفحه
     * @param {string} direction - جهت (enter/leave)
     * @returns {Promise<void>}
     * @private
     */
    async _applyScreenTransition(screen, direction = 'enter') {
        const transition = screen.transition || 'fade';
        const duration = this.config.transitionDuration;

        this.stats.totalTransitions++;
        const startTime = Date.now();

        try {
            const appElement = document.getElementById('app') || document.body;
            const screenElement = document.getElementById(`screen-${screen.name}`);

            if (screenElement) {
                // حذف تمام transition classes
                screenElement.classList.remove(
                    'transition-fade-in', 'transition-fade-out',
                    'transition-slide-left-in', 'transition-slide-left-out',
                    'transition-slide-right-in', 'transition-slide-right-out',
                    'transition-slide-up-in', 'transition-slide-up-out'
                );

                // اضافه کردن transition class
                const transitionClass = `transition-${transition}-${direction}`;
                screenElement.classList.add(transitionClass);

                // صبر برای اتمام transition
                await Utils.sleep(duration);

                // حذف transition class
                screenElement.classList.remove(transitionClass);
            }

            const endTime = Date.now();
            const transitionTime = endTime - startTime;

            // به‌روزرسانی میانگین
            this.stats.averageTransitionTime =
                ((this.stats.averageTransitionTime * (this.stats.totalTransitions - 1)) + transitionTime) /
                this.stats.totalTransitions;

        } catch (error) {
            console.error('❌ Screen transition failed:', error);
        }
    }

    // ============================================================
    // بخش ۶: Screen Data Management
    // ============================================================

    /**
     * به‌روزرسانی داده‌های صفحه
     * @param {string} screenName - نام صفحه
     * @param {Object} newData - داده‌های جدید
     * @returns {Object} نتیجه
     */
    updateScreenData(screenName, newData) {
        const screen = this.screens.get(screenName);
        if (!screen) {
            return {
                success: false,
                error: 'SCREEN_NOT_FOUND',
                message: 'صفحه یافت نشد'
            };
        }

        const oldData = { ...screen.data };
        screen.data = {
            ...screen.data,
            ...newData
        };

        this._emit('screen-data-updated', {
            screenName,
            oldData,
            newData: screen.data
        });

        if (this.debug) {
            console.log(`📊 Screen data updated: ${screenName}`);
        }

        return {
            success: true,
            screenName,
            oldData,
            newData: screen.data
        };
    }

    /**
     * دریافت داده‌های صفحه
     * @param {string} screenName - نام صفحه
     * @returns {Object|null}
     */
    getScreenData(screenName) {
        const screen = this.screens.get(screenName);
        return screen?.data || null;
    }

    /**
     * پاک کردن داده‌های صفحه
     * @param {string} screenName - نام صفحه
     * @returns {Object} نتیجه
     */
    clearScreenData(screenName) {
        const screen = this.screens.get(screenName);
        if (!screen) {
            return {
                success: false,
                error: 'SCREEN_NOT_FOUND',
                message: 'صفحه یافت نشد'
            };
        }

        const oldData = { ...screen.data };
        screen.data = {};

        this._emit('screen-data-cleared', {
            screenName,
            oldData
        });

        return {
            success: true,
            screenName,
            oldData
        };
    }

    // ============================================================
    // بخش ۷: Preloading
    // ============================================================

    /**
     * preload کردن صفحات
     * @param {Array<string>} screenNames - نام صفحات
     * @returns {Object} نتیجه
     */
    async preloadScreens(screenNames) {
        const results = [];

        for (const screenName of screenNames) {
            const screen = this.screens.get(screenName);
            if (screen) {
                // شبیه‌سازی preload
                await Utils.sleep(100);
                results.push({
                    screenName,
                    success: true
                });

                if (this.debug) {
                    console.log(` Screen preloaded: ${screenName}`);
                }
            } else {
                results.push({
                    screenName,
                    success: false,
                    error: 'SCREEN_NOT_FOUND'
                });
            }
        }

        this._emit('screens-preloaded', { screenNames, results });

        return {
            success: true,
            results
        };
    }

    // ============================================================
    // بخش : ثبت صفحات پیش‌فرض
    // ============================================================

    /**
     * ثبت صفحات پیش‌فرض
     * @private
     */
    _registerDefaultScreens() {
        const defaultScreens = [
            {
                name: 'home',
                component: 'home-screen',
                title: 'صفحه اصلی',
                icon: '🏠',
                cacheable: true,
                transition: 'fade'
            },
            {
                name: 'game',
                component: 'game-screen',
                title: 'بازی',
                icon: '',
                requiresAuth: true,
                cacheable: false,
                transition: 'slide-left'
            },
            {
                name: 'profile',
                component: 'profile-screen',
                title: 'پروفایل',
                icon: '👤',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-right'
            },
            {
                name: 'shop',
                component: 'shop-screen',
                title: 'فروشگاه',
                icon: '🛒',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-up'
            },
            {
                name: 'leaderboard',
                component: 'leaderboard-screen',
                title: 'رتبه‌بندی',
                icon: '',
                cacheable: true,
                transition: 'fade'
            },
            {
                name: 'missions',
                component: 'missions-screen',
                title: 'مأموریت‌ها',
                icon: '',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-left'
            },
            {
                name: 'achievements',
                component: 'achievements-screen',
                title: 'دستاوردها',
                icon: '',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-left'
            },
            {
                name: 'friends',
                component: 'friends-screen',
                title: 'دوستان',
                icon: '👥',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-right'
            },
            {
                name: 'chat',
                component: 'chat-screen',
                title: 'چت',
                icon: '💬',
                requiresAuth: true,
                cacheable: false,
                transition: 'slide-up'
            },
            {
                name: 'settings',
                component: 'settings-screen',
                title: 'تنظیمات',
                icon: '⚙️',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-right'
            },
            {
                name: 'login',
                component: 'login-screen',
                title: 'ورود',
                icon: '',
                cacheable: false,
                transition: 'fade'
            },
            {
                name: 'register',
                component: 'register-screen',
                title: 'ثبت‌نام',
                icon: '📝',
                cacheable: false,
                transition: 'slide-up'
            },
            {
                name: 'otp',
                component: 'otp-screen',
                title: 'کد تأیید',
                icon: '🔢',
                cacheable: false,
                transition: 'slide-left'
            },
            {
                name: 'quick-play',
                component: 'quick-play-screen',
                title: 'بازی سریع',
                icon: '⚡',
                requiresAuth: true,
                cacheable: false,
                transition: 'slide-left'
            },
            {
                name: 'classic',
                component: 'classic-screen',
                title: 'بازی کلاسیک',
                icon: '🎴',
                requiresAuth: true,
                cacheable: false,
                transition: 'slide-left'
            },
            {
                name: 'ranked',
                component: 'ranked-screen',
                title: 'بازی رقابتی',
                icon: '🏆',
                requiresAuth: true,
                cacheable: false,
                transition: 'slide-left'
            },
            {
                name: 'private',
                component: 'private-screen',
                title: 'اتاق خصوصی',
                icon: '',
                requiresAuth: true,
                cacheable: false,
                transition: 'slide-left'
            },
            {
                name: 'practice',
                component: 'practice-screen',
                title: 'تمرین',
                icon: '',
                requiresAuth: true,
                cacheable: false,
                transition: 'slide-left'
            },
            {
                name: 'tournament',
                component: 'tournament-screen',
                title: 'تورنمنت',
                icon: '🏆',
                requiresAuth: true,
                cacheable: false,
                transition: 'slide-left'
            },
            {
                name: 'notifications',
                component: 'notifications-screen',
                title: 'اعلان‌ها',
                icon: '🔔',
                requiresAuth: true,
                cacheable: false,
                transition: 'slide-up'
            },
            {
                name: 'events',
                component: 'events-screen',
                title: 'رویدادها',
                icon: '',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-left'
            },
            {
                name: 'league',
                component: 'league-screen',
                title: 'لیگ',
                icon: '',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-left'
            },
            {
                name: 'season',
                component: 'season-screen',
                title: 'فصل',
                icon: '📅',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-left'
            },
            {
                name: 'statistics',
                component: 'statistics-screen',
                title: 'آمار',
                icon: '📊',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-left'
            },
            {
                name: 'match-history',
                component: 'match-history-screen',
                title: 'تاریخچه بازی',
                icon: '📜',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-left'
            },
            {
                name: 'inventory',
                component: 'inventory-screen',
                title: 'موجودی',
                icon: '🎒',
                requiresAuth: true,
                cacheable: true,
                transition: 'slide-left'
            },
            {
                name: 'help',
                component: 'help-screen',
                title: 'راهنما',
                icon: '❓',
                cacheable: true,
                transition: 'slide-up'
            },
            {
                name: 'about',
                component: 'about-screen',
                title: 'درباره',
                icon: '️',
                cacheable: true,
                transition: 'slide-up'
            },
            {
                name: 'not-found',
                component: 'not-found-screen',
                title: 'یافت نشد',
                icon: '',
                cacheable: false,
                transition: 'fade'
            }
        ];

        this.registerScreens(defaultScreens);
    }

    // ============================================================
    // بخش ۹: تنظیمات
    // ============================================================

    /**
     * به‌روزرسانی پیکربندی
     * @param {Object} newConfig - پیکربندی جدید
     * @returns {Object} نتیجه
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };

        this._emit('config-updated', { config: this.config });

        if (this.debug) {
            console.log('🖥️ Screen Manager config updated');
        }

        return {
            success: true,
            config: this.config
        };
    }

    /**
     * فعال/غیرفعال کردن Screen Manager
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        this._emit('screen-manager-toggled', { enabled });

        if (this.debug) {
            console.log(` Screen Manager ${enabled ? 'enabled' : 'disabled'}`);
        }

        return {
            success: true,
            enabled
        };
    }

    // ============================================================
    // بخش ۱۰: توابع کمکی
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('screen_manager_stats', this.stats);
            storage.set('screen_manager_config', this.config);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const stats = storage.get('screen_manager_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            const config = storage.get('screen_manager_config');
            if (config) this.config = { ...this.config, ...config };
        }
    }

    // ============================================================
    // بخش ۱۱: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            totalScreens: this.screens.size,
            activeScreen: this.activeScreen?.name || null,
            stackSize: this.screenStack.length,
            cacheSize: this.screenCache.size,
            cacheStats: this.getCacheStats()
        };
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        return {
            enabled: this.enabled,
            activeScreen: this.activeScreen?.name || 'none',
            totalScreens: this.screens.size,
            stackSize: this.screenStack.length,
            cacheHitRate: this.getCacheStats().hitRate.toFixed(1) + '%'
        };
    }

    /**
     * دریافت پرکاربردترین صفحات
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getTopScreens(limit = 10) {
        return Array.from(this.screens.values())
            .sort((a, b) => b.activationCount - a.activationCount)
            .slice(0, limit);
    }

    // ============================================================
    // بخش ۱۲: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    async reset() {
        // غیرفعال‌سازی تمام صفحات
        for (const screen of this.screens.values()) {
            if (screen.isActive) {
                await this.deactivateScreen(screen.name);
            }
        }

        this.activeScreen = null;
        this.screenStack = [];
        this.screenCache.clear();

        this.stats = {
            totalScreensRegistered: 0,
            totalScreenActivations: 0,
            totalScreenDeactivations: 0,
            totalCacheHits: 0,
            totalCacheMisses: 0,
            totalTransitions: 0,
            averageTransitionTime: 0,
            lastActivationAt: null
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 ScreenManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🖥️ ScreenManager Status:');
        console.log('  Enabled:', summary.enabled);
        console.log('  Active Screen:', summary.activeScreen);
        console.log('  Total Screens:', summary.totalScreens);
        console.log('  Stack Size:', summary.stackSize);
        console.log('  Cache Hit Rate:', summary.cacheHitRate);
        console.log('  Total Activations:', stats.totalScreenActivations);
        console.log('  Total Deactivations:', stats.totalScreenDeactivations);
        console.log('  Total Transitions:', stats.totalTransitions);
    }

    // ============================================================
    // بخش ۱۳: Event System
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
                    console.error(`❌ Screen Manager event listener error:`, error);
                }
            });
        }

        eventBus.emit(`screen-manager:${event}`, data);
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
const screenManager = new ScreenManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScreenManager, screenManager };
} else {
    window.ScreenManager = ScreenManager;
    window.screenManager = screenManager;
}

console.log('✅ ScreenManager loaded - 30 screens registered');
