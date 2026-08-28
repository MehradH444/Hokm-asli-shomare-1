/**
 * ============================================================
 * HOKM MASTER - UI Router
 * سیستم مسیریابی و مدیریت صفحات رابط کاربری
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل مسیریابی در اپلیکیشن است. شامل
 * navigation بین صفحات، history management، deep linking،
 * route guards، transition animations، state management برای
 * routes، و مدیریت back button.
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

class UIRouter {

    constructor() {
        /**
         * تعریف تمام route ها
         * @type {Array<Object>}
         */
        this.routes = this._defineRoutes();

        /**
         * route فعلی
         * @type {Object|null}
         */
        this.currentRoute = null;

        /**
         * route قبلی
         * @type {Object|null}
         */
        this.previousRoute = null;

        /**
         * تاریخچه navigation
         * @type {Array<Object>}
         */
        this.history = [];

        /**
         * حداکثر اندازه history
         * @type {number}
         */
        this.maxHistorySize = 50;

        /**
         * route guards
         * @type {Map<string, Function>}
         */
        this.guards = new Map();

        /**
         * middleware های route
         * @type {Map<string, Array<Function>>}
         */
        this.middlewares = new Map();

        /**
         * transition های در حال اجرا
         * @type {Map<string, boolean>}
         */
        this.activeTransitions = new Map();

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
         * آیا router فعال است
         * @type {boolean}
         */
        this.enabled = true;

        /**
         * آمار router
         * @type {Object}
         */
        this.stats = {
            totalNavigations: 0,
            totalGuardsTriggered: 0,
            totalGuardFailures: 0,
            totalTransitions: 0,
            averageTransitionTime: 0,
            lastNavigationAt: null
        };

        /**
         * پیکربندی router
         * @type {Object}
         */
        this.config = {
            enableHistory: true,
            enableTransitions: true,
            transitionDuration: 300,
            enableDeepLinking: true,
            enableBackButton: true,
            defaultRoute: 'home',
            notFoundRoute: 'not-found',
            unauthorizedRoute: 'login'
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

        // ثبت route guards
        this._registerDefaultGuards();

        // setup back button
        if (this.config.enableBackButton) {
            this._setupBackButton();
        }

        // setup deep linking
        if (this.config.enableDeepLinking) {
            this._setupDeepLinking();
        }

        // navigation به route پیش‌فرض
        if (!this.currentRoute) {
            this.navigate(this.config.defaultRoute);
        }

        if (this.debug) {
            console.log(' UIRouter initialized');
            console.log('  Routes:', this.routes.length);
            console.log('  Default Route:', this.config.defaultRoute);
            console.log('  History Size:', this.history.length);
        }
    }

    // ============================================================
    // بخش ۱: تعریف Route ها
    // ============================================================

    /**
     * تعریف تمام route ها
     * @returns {Array<Object>}
     * @private
     */
    _defineRoutes() {
        return [
            // صفحات اصلی
            {
                name: 'home',
                path: '/',
                component: 'home-screen',
                title: 'صفحه اصلی',
                icon: '🏠',
                requiresAuth: false,
                transition: 'fade',
                cache: true
            },
            {
                name: 'game',
                path: '/game',
                component: 'game-screen',
                title: 'بازی',
                icon: '🎮',
                requiresAuth: true,
                transition: 'slide-left',
                cache: false
            },
            {
                name: 'profile',
                path: '/profile',
                component: 'profile-screen',
                title: 'پروفایل',
                icon: '👤',
                requiresAuth: true,
                transition: 'slide-right',
                cache: true
            },
            {
                name: 'shop',
                path: '/shop',
                component: 'shop-screen',
                title: 'فروشگاه',
                icon: '🛒',
                requiresAuth: true,
                transition: 'slide-up',
                cache: true
            },
            {
                name: 'leaderboard',
                path: '/leaderboard',
                component: 'leaderboard-screen',
                title: 'رتبه‌بندی',
                icon: '🏆',
                requiresAuth: false,
                transition: 'fade',
                cache: true
            },
            {
                name: 'missions',
                path: '/missions',
                component: 'missions-screen',
                title: 'مأموریت‌ها',
                icon: '🎯',
                requiresAuth: true,
                transition: 'slide-left',
                cache: true
            },
            {
                name: 'achievements',
                path: '/achievements',
                component: 'achievements-screen',
                title: 'دستاوردها',
                icon: '🏅',
                requiresAuth: true,
                transition: 'slide-left',
                cache: true
            },
            {
                name: 'friends',
                path: '/friends',
                component: 'friends-screen',
                title: 'دوستان',
                icon: '👥',
                requiresAuth: true,
                transition: 'slide-right',
                cache: true
            },
            {
                name: 'chat',
                path: '/chat',
                component: 'chat-screen',
                title: 'چت',
                icon: '',
                requiresAuth: true,
                transition: 'slide-up',
                cache: false
            },
            {
                name: 'settings',
                path: '/settings',
                component: 'settings-screen',
                title: 'تنظیمات',
                icon: '⚙️',
                requiresAuth: true,
                transition: 'slide-right',
                cache: true
            },

            // صفحات احراز هویت
            {
                name: 'login',
                path: '/login',
                component: 'login-screen',
                title: 'ورود',
                icon: '🔐',
                requiresAuth: false,
                transition: 'fade',
                cache: false
            },
            {
                name: 'register',
                path: '/register',
                component: 'register-screen',
                title: 'ثبت‌نام',
                icon: '📝',
                requiresAuth: false,
                transition: 'slide-up',
                cache: false
            },
            {
                name: 'otp',
                path: '/otp',
                component: 'otp-screen',
                title: 'کد تأیید',
                icon: '🔢',
                requiresAuth: false,
                transition: 'slide-left',
                cache: false
            },

            // صفحات بازی
            {
                name: 'quick-play',
                path: '/quick-play',
                component: 'quick-play-screen',
                title: 'بازی سریع',
                icon: '⚡',
                requiresAuth: true,
                transition: 'slide-left',
                cache: false
            },
            {
                name: 'classic',
                path: '/classic',
                component: 'classic-screen',
                title: 'بازی کلاسیک',
                icon: '🎴',
                requiresAuth: true,
                transition: 'slide-left',
                cache: false
            },
            {
                name: 'ranked',
                path: '/ranked',
                component: 'ranked-screen',
                title: 'بازی رقابتی',
                icon: '🏆',
                requiresAuth: true,
                transition: 'slide-left',
                cache: false
            },
            {
                name: 'private',
                path: '/private',
                component: 'private-screen',
                title: 'اتاق خصوصی',
                icon: '🏠',
                requiresAuth: true,
                transition: 'slide-left',
                cache: false
            },
            {
                name: 'practice',
                path: '/practice',
                component: 'practice-screen',
                title: 'تمرین',
                icon: '🎓',
                requiresAuth: true,
                transition: 'slide-left',
                cache: false
            },
            {
                name: 'tournament',
                path: '/tournament',
                component: 'tournament-screen',
                title: 'تورنمنت',
                icon: '🏆',
                requiresAuth: true,
                transition: 'slide-left',
                cache: false
            },

            // صفحات دیگر
            {
                name: 'notifications',
                path: '/notifications',
                component: 'notifications-screen',
                title: 'اعلان‌ها',
                icon: '',
                requiresAuth: true,
                transition: 'slide-up',
                cache: false
            },
            {
                name: 'events',
                path: '/events',
                component: 'events-screen',
                title: 'رویدادها',
                icon: '',
                requiresAuth: true,
                transition: 'slide-left',
                cache: true
            },
            {
                name: 'league',
                path: '/league',
                component: 'league-screen',
                title: 'لیگ',
                icon: '🏅',
                requiresAuth: true,
                transition: 'slide-left',
                cache: true
            },
            {
                name: 'season',
                path: '/season',
                component: 'season-screen',
                title: 'فصل',
                icon: '📅',
                requiresAuth: true,
                transition: 'slide-left',
                cache: true
            },
            {
                name: 'statistics',
                path: '/statistics',
                component: 'statistics-screen',
                title: 'آمار',
                icon: '📊',
                requiresAuth: true,
                transition: 'slide-left',
                cache: true
            },
            {
                name: 'match-history',
                path: '/match-history',
                component: 'match-history-screen',
                title: 'تاریخچه بازی',
                icon: '📜',
                requiresAuth: true,
                transition: 'slide-left',
                cache: true
            },
            {
                name: 'inventory',
                path: '/inventory',
                component: 'inventory-screen',
                title: 'موجودی',
                icon: '🎒',
                requiresAuth: true,
                transition: 'slide-left',
                cache: true
            },
            {
                name: 'help',
                path: '/help',
                component: 'help-screen',
                title: 'راهنما',
                icon: '❓',
                requiresAuth: false,
                transition: 'slide-up',
                cache: true
            },
            {
                name: 'about',
                path: '/about',
                component: 'about-screen',
                title: 'درباره',
                icon: 'ℹ️',
                requiresAuth: false,
                transition: 'slide-up',
                cache: true
            },
            {
                name: 'not-found',
                path: '/not-found',
                component: 'not-found-screen',
                title: 'یافت نشد',
                icon: '❌',
                requiresAuth: false,
                transition: 'fade',
                cache: false
            }
        ];
    }

    // ============================================================
    // بخش ۲: Navigation
    // ============================================================

    /**
     * navigation به یک route
     * @param {string} routeName - نام route
     * @param {Object} params - پارامترها
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    async navigate(routeName, params = {}, options = {}) {
        if (!this.enabled) {
            return {
                success: false,
                error: 'ROUTER_DISABLED',
                message: 'Router غیرفعال است'
            };
        }

        const {
            replace = false,
            skipGuard = false,
            skipTransition = false,
            force = false
        } = options;

        // پیدا کردن route
        const route = this._findRoute(routeName);
        if (!route) {
            return {
                success: false,
                error: 'ROUTE_NOT_FOUND',
                message: `Route "${routeName}" یافت نشد`
            };
        }

        // بررسی guard ها
        if (!skipGuard) {
            const guardResult = await this._checkGuards(route, params);
            if (!guardResult.allowed) {
                this.stats.totalGuardFailures++;

                // navigation به route جایگزین
                if (guardResult.redirectTo) {
                    return this.navigate(guardResult.redirectTo, params, options);
                }

                return {
                    success: false,
                    error: 'GUARD_FAILED',
                    message: guardResult.reason,
                    route: routeName
                };
            }
        }

        // اجرای middleware ها
        await this._runMiddlewares(route, params);

        // ذخیره route قبلی
        this.previousRoute = this.currentRoute;

        // به‌روزرسانی route فعلی
        this.currentRoute = {
            ...route,
            params,
            timestamp: Date.now()
        };

        // به‌روزرسانی history
        if (!replace && this.config.enableHistory) {
            this.history.push(this.currentRoute);

            // محدود کردن اندازه history
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
            }
        } else if (replace && this.history.length > 0) {
            this.history[this.history.length - 1] = this.currentRoute;
        }

        // اعمال transition
        if (!skipTransition && this.config.enableTransitions) {
            await this._applyTransition(route);
        }

        // به‌روزرسانی URL (اگر deep linking فعال باشد)
        if (this.config.enableDeepLinking) {
            this._updateURL(route, params);
        }

        // به‌روزرسانی عنوان صفحه
        this._updatePageTitle(route);

        // به‌روزرسانی آمار
        this.stats.totalNavigations++;
        this.stats.lastNavigationAt = Date.now();

        // ذخیره داده‌ها
        this._saveData();

        this._emit('route-changed', {
            route: this.currentRoute,
            previousRoute: this.previousRoute,
            params
        });

        if (this.debug) {
            console.log(`🧭 Navigated to: ${routeName}`, params);
        }

        return {
            success: true,
            route: this.currentRoute,
            params
        };
    }

    /**
     * بازگشت به route قبلی
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    async goBack(options = {}) {
        const { skipTransition = false } = options;

        if (this.history.length <= 1) {
            // اگر history خالی است، به home برگرد
            return this.navigate(this.config.defaultRoute, {}, { replace: true });
        }

        // حذف route فعلی از history
        this.history.pop();

        // دریافت route قبلی
        const previousRoute = this.history[this.history.length - 1];

        if (!previousRoute) {
            return this.navigate(this.config.defaultRoute, {}, { replace: true });
        }

        // navigation به route قبلی
        return this.navigate(previousRoute.name, previousRoute.params || {}, {
            replace: true,
            skipTransition
        });
    }

    /**
     * رفتن به route خاص در history
     * @param {number} index - ایندکس
     * @returns {Object} نتیجه
     */
    async goTo(index) {
        if (index < 0 || index >= this.history.length) {
            return {
                success: false,
                error: 'INVALID_INDEX',
                message: 'ایندکس نامعتبر است'
            };
        }

        const route = this.history[index];
        return this.navigate(route.name, route.params || {}, { replace: true });
    }

    /**
     * جایگزینی route فعلی
     * @param {string} routeName - نام route
     * @param {Object} params - پارامترها
     * @returns {Object} نتیجه
     */
    async replace(routeName, params = {}) {
        return this.navigate(routeName, params, { replace: true });
    }

    /**
     * پاک کردن history و رفتن به route خاص
     * @param {string} routeName - نام route
     * @param {Object} params - پارامترها
     * @returns {Object} نتیجه
     */
    async clearAndNavigate(routeName, params = {}) {
        this.history = [];
        return this.navigate(routeName, params, { replace: true });
    }

    // ============================================================
    // بخش ۳: Route Guards
    // ============================================================

    /**
     * ثبت route guard
     * @param {string} guardName - نام guard
     * @param {Function} guardFn - تابع guard
     * @returns {void}
     */
    registerGuard(guardName, guardFn) {
        this.guards.set(guardName, guardFn);

        if (this.debug) {
            console.log(`🛡️ Guard registered: ${guardName}`);
        }
    }

    /**
     * حذف route guard
     * @param {string} guardName - نام guard
     * @returns {void}
     */
    unregisterGuard(guardName) {
        this.guards.delete(guardName);
    }

    /**
     * بررسی guard ها
     * @param {Object} route - route
     * @param {Object} params - پارامترها
     * @returns {Object} نتیجه
     * @private
     */
    async _checkGuards(route, params) {
        this.stats.totalGuardsTriggered++;

        // بررسی احراز هویت
        if (route.requiresAuth) {
            const user = authManager?.getCurrentUser();
            if (!user) {
                return {
                    allowed: false,
                    reason: 'Authentication required',
                    redirectTo: this.config.unauthorizedRoute
                };
            }
        }

        // اجرای guard های سفارشی
        for (const [guardName, guardFn] of this.guards) {
            try {
                const result = await guardFn(route, params);
                if (!result.allowed) {
                    return result;
                }
            } catch (error) {
                console.error(`❌ Guard ${guardName} failed:`, error);
                return {
                    allowed: false,
                    reason: error.message
                };
            }
        }

        return { allowed: true };
    }

    /**
     * ثبت guard های پیش‌فرض
     * @private
     */
    _registerDefaultGuards() {
        // Guard برای بررسی وضعیت بازی
        this.registerGuard('game-status', async (route, params) => {
            if (route.name === 'game') {
                // بررسی آیا بازی در حال انجام است
                // در production از game engine استفاده می‌شود
                return { allowed: true };
            }
            return { allowed: true };
        });

        // Guard برای بررسی محدودیت سنی
        this.registerGuard('age-restriction', async (route, params) => {
            // در production بررسی سن کاربر
            return { allowed: true };
        });
    }

    // ============================================================
    // بخش ۴: Middleware
    // ============================================================

    /**
     * ثبت middleware برای route
     * @param {string} routeName - نام route
     * @param {Function} middlewareFn - تابع middleware
     * @returns {void}
     */
    registerMiddleware(routeName, middlewareFn) {
        if (!this.middlewares.has(routeName)) {
            this.middlewares.set(routeName, []);
        }

        this.middlewares.get(routeName).push(middlewareFn);

        if (this.debug) {
            console.log(`🔧 Middleware registered for: ${routeName}`);
        }
    }

    /**
     * اجرای middleware ها
     * @param {Object} route - route
     * @param {Object} params - پارامترها
     * @returns {void}
     * @private
     */
    async _runMiddlewares(route, params) {
        const middlewares = this.middlewares.get(route.name) || [];

        for (const middleware of middlewares) {
            try {
                await middleware(route, params);
            } catch (error) {
                console.error(`❌ Middleware failed for ${route.name}:`, error);
            }
        }
    }

    // ============================================================
    // بخش ۵: Transition Animations
    // ============================================================

    /**
     * اعمال transition
     * @param {Object} route - route
     * @returns {Promise<void>}
     * @private
     */
    async _applyTransition(route) {
        const transition = route.transition || 'fade';
        const duration = this.config.transitionDuration;

        // جلوگیری از transition های همزمان
        if (this.activeTransitions.get('main')) {
            return;
        }

        this.activeTransitions.set('main', true);
        this.stats.totalTransitions++;

        const startTime = Date.now();

        try {
            // اعمال CSS class برای transition
            const appElement = document.getElementById('app') || document.body;
            
            // حذف تمام transition classes
            appElement.classList.remove('transition-fade', 'transition-slide-left', 'transition-slide-right', 'transition-slide-up');
            
            // اضافه کردن transition class جدید
            appElement.classList.add(`transition-${transition}`);

            // صبر برای اتمام transition
            await Utils.sleep(duration);

            // حذف transition class
            appElement.classList.remove(`transition-${transition}`);

            const endTime = Date.now();
            const transitionTime = endTime - startTime;

            // به‌روزرسانی میانگین زمان transition
            this.stats.averageTransitionTime = 
                ((this.stats.averageTransitionTime * (this.stats.totalTransitions - 1)) + transitionTime) / 
                this.stats.totalTransitions;

        } catch (error) {
            console.error('❌ Transition failed:', error);
        } finally {
            this.activeTransitions.set('main', false);
        }
    }

    // ============================================================
    // بخش ۶: Deep Linking
    // ============================================================

    /**
     * setup deep linking
     * @private
     */
    _setupDeepLinking() {
        if (typeof window === 'undefined') return;

        // بررسی URL اولیه
        const initialPath = window.location.pathname;
        const initialRoute = this._findRouteByPath(initialPath);

        if (initialRoute) {
            const params = this._parseURLParams(window.location.search);
            this.navigate(initialRoute.name, params, { replace: true });
        }

        // گوش دادن به تغییرات URL
        window.addEventListener('popstate', (event) => {
            const path = window.location.pathname;
            const route = this._findRouteByPath(path);

            if (route) {
                const params = this._parseURLParams(window.location.search);
                this.navigate(route.name, params, { replace: true, skipGuard: true });
            }
        });
    }

    /**
     * به‌روزرسانی URL
     * @param {Object} route - route
     * @param {Object} params - پارامترها
     * @private
     */
    _updateURL(route, params) {
        if (typeof window === 'undefined') return;

        const url = this._buildURL(route, params);
        
        if (window.history) {
            window.history.pushState({ route: route.name, params }, route.title, url);
        }
    }

    /**
     * ساخت URL
     * @param {Object} route - route
     * @param {Object} params - پارامترها
     * @returns {string}
     * @private
     */
    _buildURL(route, params) {
        let url = route.path;

        if (Object.keys(params).length > 0) {
            const queryString = Object.entries(params)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
            url += '?' + queryString;
        }

        return url;
    }

    /**
     * پیدا کردن route بر اساس path
     * @param {string} path - path
     * @returns {Object|null}
     * @private
     */
    _findRouteByPath(path) {
        const cleanPath = path.split('?')[0];
        return this.routes.find(r => r.path === cleanPath) || null;
    }

    /**
     * پارس کردن پارامترهای URL
     * @param {string} queryString - query string
     * @returns {Object}
     * @private
     */
    _parseURLParams(queryString) {
        const params = {};
        const searchParams = new URLSearchParams(queryString);

        searchParams.forEach((value, key) => {
            params[key] = value;
        });

        return params;
    }

    // ============================================================
    // بخش ۷: Back Button
    // ============================================================

    /**
     * setup back button
     * @private
     */
    _setupBackButton() {
        if (typeof window === 'undefined') return;

        // Android back button
        if ('onbeforeunload' in window) {
            window.addEventListener('beforeunload', (event) => {
                if (this.history.length > 1) {
                    event.preventDefault();
                    this.goBack();
                }
            });
        }

        // Hardware back button (mobile)
        if (typeof navigator !== 'undefined' && 'app' in navigator) {
            navigator.app?.addEventListener?.('backbutton', (event) => {
                event.preventDefault();
                this.goBack();
            });
        }
    }

    // ============================================================
    // بخش ۸: دریافت اطلاعات
    // ============================================================

    /**
     * دریافت route فعلی
     * @returns {Object|null}
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * دریافت route قبلی
     * @returns {Object|null}
     */
    getPreviousRoute() {
        return this.previousRoute;
    }

    /**
     * دریافت history
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getHistory(limit = 50) {
        return this.history.slice(-limit).reverse();
    }

    /**
     * دریافت تمام route ها
     * @returns {Array<Object>}
     */
    getAllRoutes() {
        return [...this.routes];
    }

    /**
     * دریافت route بر اساس نام
     * @param {string} routeName - نام route
     * @returns {Object|null}
     */
    getRoute(routeName) {
        return this._findRoute(routeName);
    }

    /**
     * پیدا کردن route
     * @param {string} routeName - نام route
     * @returns {Object|null}
     * @private
     */
    _findRoute(routeName) {
        return this.routes.find(r => r.name === routeName) || null;
    }

    /**
     * بررسی آیا route فعلی است
     * @param {string} routeName - نام route
     * @returns {boolean}
     */
    isCurrentRoute(routeName) {
        return this.currentRoute?.name === routeName;
    }

    /**
     * دریافت breadcrumb
     * @returns {Array<Object>}
     */
    getBreadcrumb() {
        const breadcrumb = [];

        // اضافه کردن home
        breadcrumb.push({
            name: 'home',
            title: 'صفحه اصلی',
            path: '/'
        });

        // اضافه کردن route های میانی
        if (this.history.length > 1) {
            for (let i = 1; i < this.history.length - 1; i++) {
                const route = this.history[i];
                breadcrumb.push({
                    name: route.name,
                    title: route.title,
                    path: route.path
                });
            }
        }

        // اضافه کردن route فعلی
        if (this.currentRoute) {
            breadcrumb.push({
                name: this.currentRoute.name,
                title: this.currentRoute.title,
                path: this.currentRoute.path,
                current: true
            });
        }

        return breadcrumb;
    }

    // ============================================================
    // بخش ۹: عنوان صفحه
    // ============================================================

    /**
     * به‌روزرسانی عنوان صفحه
     * @param {Object} route - route
     * @private
     */
    _updatePageTitle(route) {
        if (typeof document === 'undefined') return;

        const title = route.title ? `${route.title} - ${CONFIG.APP.NAME}` : CONFIG.APP.NAME;
        document.title = title;
    }

    // ============================================================
    // بخش ۰: تنظیمات
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
            console.log('🧭 Router config updated');
        }

        return {
            success: true,
            config: this.config
        };
    }

    /**
     * فعال/غیرفعال کردن router
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        this._emit('router-toggled', { enabled });

        if (this.debug) {
            console.log(` Router ${enabled ? 'enabled' : 'disabled'}`);
        }

        return {
            success: true,
            enabled
        };
    }

    // ============================================================
    // بخش ۱۱: توابع کمکی
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('router_history', this.history.slice(-20)); // فقط 20 مورد آخر
            storage.set('router_current_route', this.currentRoute);
            storage.set('router_stats', this.stats);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const history = storage.get('router_history');
            if (history) this.history = history;

            const currentRoute = storage.get('router_current_route');
            if (currentRoute) this.currentRoute = currentRoute;

            const stats = storage.get('router_stats');
            if (stats) this.stats = { ...this.stats, ...stats };
        }
    }

    // ============================================================
    // بخش ۱۲: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            totalRoutes: this.routes.length,
            historySize: this.history.length,
            guardsCount: this.guards.size,
            middlewaresCount: this.middlewares.size
        };
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        return {
            enabled: this.enabled,
            currentRoute: this.currentRoute?.name || 'none',
            totalNavigations: this.stats.totalNavigations,
            averageTransitionTime: this.stats.averageTransitionTime.toFixed(0) + 'ms',
            historySize: this.history.length
        };
    }

    /**
     * دریافت پرکاربردترین route ها
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getTopRoutes(limit = 10) {
        const routeCounts = {};

        this.history.forEach(route => {
            routeCounts[route.name] = (routeCounts[route.name] || 0) + 1;
        });

        return Object.entries(routeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([name, count]) => ({
                name,
                count,
                route: this._findRoute(name)
            }));
    }

    // ============================================================
    // بخش ۱۳: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.currentRoute = null;
        this.previousRoute = null;
        this.history = [];
        this.activeTransitions.clear();

        this.stats = {
            totalNavigations: 0,
            totalGuardsTriggered: 0,
            totalGuardFailures: 0,
            totalTransitions: 0,
            averageTransitionTime: 0,
            lastNavigationAt: null
        };

        this.navigate(this.config.defaultRoute, {}, { replace: true });

        if (this.debug) {
            console.log('🔄 UIRouter reset');
        }
    }

    /**
     * پاک کردن history
     * @returns {number} تعداد پاکسازی شده
     */
    clearHistory() {
        const count = this.history.length;
        this.history = [];
        this._saveData();

        if (this.debug) {
            console.log(` History cleared: ${count} items`);
        }

        return count;
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🧭 UIRouter Status:');
        console.log('  Enabled:', summary.enabled);
        console.log('  Current Route:', summary.currentRoute);
        console.log('  Total Navigations:', summary.totalNavigations);
        console.log('  Avg Transition Time:', summary.averageTransitionTime);
        console.log('  History Size:', summary.historySize);
        console.log('  Total Routes:', stats.totalRoutes);
        console.log('  Guards:', stats.guardsCount);
        console.log('  Middlewares:', stats.middlewaresCount);
    }

    // ============================================================
    // بخش ۱۴: Event System
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
                    console.error(`❌ Router event listener error:`, error);
                }
            });
        }

        eventBus.emit(`router:${event}`, data);
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
const uiRouter = new UIRouter();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIRouter, uiRouter };
} else {
    window.UIRouter = UIRouter;
    window.uiRouter = uiRouter;
}

console.log('✅ UIRouter loaded - 30 routes defined');
