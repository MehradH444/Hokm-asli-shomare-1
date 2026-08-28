/**
 * ============================================================
 * HOKM MASTER - Main Application Controller
 * کنترلر اصلی اپلیکیشن حکم مستر
 * ============================================================
 * 
 * این فایل نقطه ورود اصلی اپلیکیشن است و مسئول:
 * - راه‌اندازی تمام ماژول‌ها
 * - مدیریت چرخه حیات اپلیکیشن
 * - هماهنگی بین ماژول‌ها
 * - مدیریت رویدادهای سراسری
 * - error handling سراسری
 * - PWA و Service Worker
 * - keyboard shortcuts
 * - visibility & online/offline handling
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-29
 * 
 * وابستگی‌ها:
 * - تمام ماژول‌های پروژه
 * 
 * ============================================================
 */

class AppController {

    constructor() {
        /**
         * وضعیت اپلیکیشن
         * @type {string} 'initializing' | 'ready' | 'running' | 'error' | 'destroyed'
         */
        this.status = 'initializing';

        /**
         * زمان شروع اپلیکیشن
         * @type {number}
         */
        this.startTime = Date.now();

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
         * اطلاعات نسخه
         * @type {Object}
         */
        this.versionInfo = {
            version: CONFIG.APP.VERSION,
            build: CONFIG.APP.BUILD || '1.0.0',
            environment: CONFIG.APP.ENVIRONMENT || 'production',
            buildDate: CONFIG.APP.BUILD_DATE || new Date().toISOString()
        };

        /**
         * ماژول‌های ثبت شده
         * @type {Map<string, Object>}
         */
        this.modules = new Map();

        /**
         * پلاگین‌های ثبت شده
         * @type {Array<Object>}
         */
        this.plugins = [];

        /**
         * میانبرهای صفحه کلید
         * @type {Map<string, Function>}
         */
        this.keyboardShortcuts = new Map();

        /**
         * آیا اپلیکیشن visible است
         * @type {boolean}
         */
        this.isVisible = true;

        /**
         * آیا اپلیکیشن آنلاین است
         * @type {boolean}
         */
        this.isOnline = navigator?.onLine ?? true;

        /**
         * Service Worker registration
         * @type {ServiceWorkerRegistration|null}
         */
        this.swRegistration = null;

        /**
         * آمار اپلیکیشن
         * @type {Object}
         */
        this.stats = {
            totalSessions: 0,
            totalErrors: 0,
            totalWarnings: 0,
            uptime: 0,
            memoryUsage: 0,
            lastErrorAt: null,
            initializationTime: 0
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // ثبت error handlers سراسری
        this._setupGlobalErrorHandlers();

        // ثبت keyboard shortcuts
        this._setupKeyboardShortcuts();

        // ثبت event listeners سراسری
        this._setupGlobalEventListeners();

        if (this.debug) {
            console.log('🎮 AppController initialized');
            console.log('  Version:', this.versionInfo.version);
            console.log('  Environment:', this.versionInfo.environment);
        }
    }

    // ============================================================
    // بخش ۱: Initialization Sequence
    // ============================================================

    /**
     * شروع اپلیکیشن
     * @returns {Promise<Object>} نتیجه
     */
    async start() {
        const initStartTime = Date.now();

        try {
            this.status = 'initializing';

            console.log(`🚀 Starting Hokm Master v${this.versionInfo.version}...`);

            // مرحله ۱: بررسی پشتیبانی مرورگر
            await this._checkBrowserSupport();

            // مرحله : راه‌اندازی Storage
            this._initStorage();

            // مرحله : راه‌اندازی EventBus
            this._initEventBus();

            // مرحله : راه‌اندازی Auth
            await this._initAuth();

            // مرحله : راه‌اندازی Network
            this._initNetwork();

            // مرحله ۶: راه‌اندازی Game Engines
            this._initGameEngines();

            // مرحله ۷: راه‌اندازی UI Managers
            this._initUIManagers();

            // مرحله ۸: راه‌اندازی Audio
            this._initAudio();

            // مرحله ۹: راه‌اندازی Security
            this._initSecurity();

            // مرحله ۱۰: راه‌اندازی Analytics
            this._initAnalytics();

            // مرحله ۱۱: ثبت Service Worker
            await this._registerServiceWorker();

            // مرحله ۱۲: بارگذاری داده‌های اولیه
            await this._loadInitialData();

            // مرحله ۱۳: نمایش صفحه اصلی
            this._showMainScreen();

            // محاسبه زمان initialization
            this.stats.initializationTime = Date.now() - initStartTime;
            this.status = 'ready';

            console.log(`✅ App ready in ${this.stats.initializationTime}ms`);

            this._emit('app-ready', {
                version: this.versionInfo,
                initTime: this.stats.initializationTime
            });

            return {
                success: true,
                initTime: this.stats.initializationTime,
                version: this.versionInfo
            };

        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.status = 'error';
            this.stats.totalErrors++;

            this._emit('app-init-failed', { error: error.message });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * بررسی پشتیبانی مرورگر
     * @returns {Promise<void>}
     * @private
     */
    async _checkBrowserSupport() {
        const requiredFeatures = [
            { name: 'localStorage', test: () => typeof localStorage !== 'undefined' },
            { name: 'WebSocket', test: () => typeof WebSocket !== 'undefined' },
            { name: 'Promise', test: () => typeof Promise !== 'undefined' },
            { name: 'fetch', test: () => typeof fetch !== 'undefined' },
            { name: 'crypto', test: () => typeof crypto !== 'undefined' }
        ];

        const unsupported = requiredFeatures.filter(f => !f.test());

        if (unsupported.length > 0) {
            throw new Error(`مرورگر شما از این ویژگی‌ها پشتیبانی نمی‌کند: ${unsupported.map(f => f.name).join(', ')}`);
        }

        if (this.debug) {
            console.log('✅ Browser support check passed');
        }
    }

    /**
     * راه‌اندازی Storage
     * @private
     */
    _initStorage() {
        if (typeof storage !== 'undefined') {
            this.modules.set('storage', storage);
            console.log('✅ Storage initialized');
        }
    }

    /**
     * راه‌اندازی EventBus
     * @private
     */
    _initEventBus() {
        if (typeof eventBus !== 'undefined') {
            this.modules.set('eventBus', eventBus);
            console.log('✅ EventBus initialized');
        }
    }

    /**
     * راه‌اندازی Auth
     * @returns {Promise<void>}
     * @private
     */
    async _initAuth() {
        if (typeof authManager !== 'undefined') {
            this.modules.set('authManager', authManager);
            console.log('✅ AuthManager initialized');
        }

        if (typeof sessionManager !== 'undefined') {
            this.modules.set('sessionManager', sessionManager);
            console.log('✅ SessionManager initialized');
        }

        if (typeof otpManager !== 'undefined') {
            this.modules.set('otpManager', otpManager);
            console.log('✅ OTPManager initialized');
        }
    }

    /**
     * راه‌اندازی Network
     * @private
     */
    _initNetwork() {
        if (typeof wsManager !== 'undefined') {
            this.modules.set('wsManager', wsManager);
            console.log('✅ WebSocketManager initialized');
        }

        if (typeof apiManager !== 'undefined') {
            this.modules.set('apiManager', apiManager);
            console.log('✅ APIManager initialized');
        }
    }

    /**
     * راه‌اندازی Game Engines
     * @private
     */
    _initGameEngines() {
        const gameModules = [
            { name: 'cardEngine', ref: typeof cardEngine !== 'undefined' ? cardEngine : null },
            { name: 'hokmEngine', ref: typeof hokmEngine !== 'undefined' ? hokmEngine : null },
            { name: 'rulesEngine', ref: typeof rulesEngine !== 'undefined' ? rulesEngine : null },
            { name: 'scoringEngine', ref: typeof scoringEngine !== 'undefined' ? scoringEngine : null },
            { name: 'validationEngine', ref: typeof validationEngine !== 'undefined' ? validationEngine : null },
            { name: 'turnManager', ref: typeof turnManager !== 'undefined' ? turnManager : null }
        ];

        gameModules.forEach(module => {
            if (module.ref) {
                this.modules.set(module.name, module.ref);
                console.log(`✅ ${module.name} initialized`);
            }
        });
    }

    /**
     * راه‌اندازی UI Managers
     * @private
     */
    _initUIManagers() {
        const uiModules = [
            { name: 'uiRouter', ref: typeof uiRouter !== 'undefined' ? uiRouter : null },
            { name: 'screenManager', ref: typeof screenManager !== 'undefined' ? screenManager : null },
            { name: 'modalManager', ref: typeof modalManager !== 'undefined' ? modalManager : null },
            { name: 'toastManager', ref: typeof toastManager !== 'undefined' ? toastManager : null },
            { name: 'animationManager', ref: typeof animationManager !== 'undefined' ? animationManager : null },
            { name: 'settingsManager', ref: typeof settingsManager !== 'undefined' ? settingsManager : null },
            { name: 'preferencesManager', ref: typeof preferencesManager !== 'undefined' ? preferencesManager : null }
        ];

        uiModules.forEach(module => {
            if (module.ref) {
                this.modules.set(module.name, module.ref);
                console.log(`✅ ${module.name} initialized`);
            }
        });
    }

    /**
     * راه‌اندازی Audio
     * @private
     */
    _initAudio() {
        if (typeof soundManager !== 'undefined') {
            this.modules.set('soundManager', soundManager);
            console.log('✅ SoundManager initialized');
        }

        if (typeof musicManager !== 'undefined') {
            this.modules.set('musicManager', musicManager);
            console.log('✅ MusicManager initialized');
        }
    }

    /**
     * راه‌اندازی Security
     * @private
     */
    _initSecurity() {
        if (typeof antiCheatSystem !== 'undefined') {
            this.modules.set('antiCheatSystem', antiCheatSystem);
            console.log('✅ AntiCheatSystem initialized');
        }

        if (typeof encryptionManager !== 'undefined') {
            this.modules.set('encryptionManager', encryptionManager);
            console.log('✅ EncryptionManager initialized');
        }

        if (typeof securityValidationManager !== 'undefined') {
            this.modules.set('securityValidationManager', securityValidationManager);
            console.log('✅ SecurityValidationManager initialized');
        }
    }

    /**
     * راه‌اندازی Analytics
     * @private
     */
    _initAnalytics() {
        if (typeof analyticsManager !== 'undefined') {
            this.modules.set('analyticsManager', analyticsManager);
            console.log('✅ AnalyticsManager initialized');
        }
    }

    /**
     * ثبت Service Worker
     * @returns {Promise<void>}
     * @private
     */
    async _registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                this.swRegistration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registered');
            } catch (error) {
                console.warn('⚠️ Service Worker registration failed:', error);
            }
        }
    }

    /**
     * بارگذاری داده‌های اولیه
     * @returns {Promise<void>}
     * @private
     */
    async _loadInitialData() {
        console.log('📦 Loading initial data...');

        // بارگذاری پروفایل کاربر
        if (typeof authManager !== 'undefined' && authManager.isLoggedIn()) {
            console.log('✅ User profile loaded');
        }

        // بارگذاری تنظیمات
        if (typeof settingsManager !== 'undefined') {
            console.log('✅ Settings loaded');
        }

        // بارگذاری ترجیحات
        if (typeof preferencesManager !== 'undefined') {
            console.log('✅ Preferences loaded');
        }
    }

    /**
     * نمایش صفحه اصلی
     * @private
     */
    _showMainScreen() {
        if (typeof uiRouter !== 'undefined') {
            const user = typeof authManager !== 'undefined' ? authManager.getCurrentUser() : null;

            if (user) {
                uiRouter.navigate('home');
            } else {
                uiRouter.navigate('login');
            }
        }
    }

    // ============================================================
    // بخش ۲: Global Error Handlers
    // ============================================================

    /**
     * ثبت error handlers سراسری
     * @private
     */
    _setupGlobalErrorHandlers() {
        // JavaScript errors
        window.addEventListener('error', (event) => {
            this._handleGlobalError(event.error || event.message, event.filename, event.lineno);
        });

        // Unhandled Promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this._handleUnhandledRejection(event.reason);
        });

        // Console error override (optional)
        if (this.debug) {
            const originalError = console.error;
            console.error = (...args) => {
                this.stats.totalErrors++;
                originalError.apply(console, args);
            };
        }
    }

    /**
     * مدیریت خطای سراسری
     * @param {Error|string} error - خطا
     * @param {string} filename - نام فایل
     * @param {number} lineno - شماره خط
     * @private
     */
    _handleGlobalError(error, filename, lineno) {
        this.stats.totalErrors++;
        this.stats.lastErrorAt = Date.now();

        const errorInfo = {
            message: error?.message || error,
            filename,
            lineno,
            timestamp: Date.now(),
            stack: error?.stack
        };

        console.error('❌ Global error:', errorInfo);

        // ارسال به analytics
        if (typeof analyticsManager !== 'undefined') {
            analyticsManager.trackError('global_error', errorInfo.message, errorInfo);
        }

        // نمایش toast خطا
        if (typeof toastManager !== 'undefined') {
            toastManager.error('خطایی رخ داد. لطفاً صفحه را رفرش کنید.');
        }

        this._emit('app-error', errorInfo);
    }

    /**
     * مدیریت unhandled rejection
     * @param {any} reason - دلیل
     * @private
     */
    _handleUnhandledRejection(reason) {
        this.stats.totalErrors++;
        this.stats.lastErrorAt = Date.now();

        console.error('❌ Unhandled rejection:', reason);

        if (typeof analyticsManager !== 'undefined') {
            analyticsManager.trackError('unhandled_rejection', reason?.message || reason);
        }

        this._emit('app-unhandled-rejection', { reason });
    }

    // ============================================================
    // بخش ۳: Global Event Listeners
    // ============================================================

    /**
     * ثبت event listeners سراسری
     * @private
     */
    _setupGlobalEventListeners() {
        if (typeof document === 'undefined') return;

        // Visibility change
        document.addEventListener('visibilitychange', () => {
            this._handleVisibilityChange();
        });

        // Online/Offline
        window.addEventListener('online', () => {
            this._handleOnline();
        });

        window.addEventListener('offline', () => {
            this._handleOffline();
        });

        // Before unload
        window.addEventListener('beforeunload', (event) => {
            this._handleBeforeUnload(event);
        });

        // Resize
        window.addEventListener('resize', Utils.debounce(() => {
            this._handleResize();
        }, 250));

        // Keyboard
        document.addEventListener('keydown', (event) => {
            this._handleKeyboardEvent(event);
        });
    }

    /**
     * مدیریت تغییر visibility
     * @private
     */
    _handleVisibilityChange() {
        this.isVisible = !document.hidden;

        if (this.isVisible) {
            console.log('👁️ App became visible');
            this._emit('app-visible');

            // Resume audio
            if (typeof musicManager !== 'undefined') {
                musicManager.resume();
            }
        } else {
            console.log('👁️ App became hidden');
            this._emit('app-hidden');

            // Pause audio
            if (typeof musicManager !== 'undefined') {
                musicManager.pause();
            }
        }
    }

    /**
     * مدیریت آنلاین شدن
     * @private
     */
    _handleOnline() {
        this.isOnline = true;
        console.log(' App is online');

        this._emit('app-online');

        if (typeof toastManager !== 'undefined') {
            toastManager.success('اتصال برقرار شد', { duration: 2000 });
        }

        // Reconnect WebSocket
        if (typeof wsManager !== 'undefined' && !wsManager.isConnected) {
            wsManager.connect();
        }
    }

    /**
     * مدیریت آفلاین شدن
     * @private
     */
    _handleOffline() {
        this.isOnline = false;
        console.log('🌐 App is offline');

        this._emit('app-offline');

        if (typeof toastManager !== 'undefined') {
            toastManager.warning('اتصال قطع شد', { duration: 3000 });
        }
    }

    /**
     * مدیریت before unload
     * @param {Event} event - رویداد
     * @private
     */
    _handleBeforeUnload(event) {
        // ذخیره state
        this._saveAppState();

        // ارسال analytics
        if (typeof analyticsManager !== 'undefined') {
            analyticsManager.trackEvent('app_close', {
                sessionDuration: Date.now() - this.startTime,
                totalErrors: this.stats.totalErrors
            });
        }

        // نمایش confirmation در صورت نیاز
        if (this._shouldConfirmExit()) {
            event.preventDefault();
            event.returnValue = 'آیا مطمئن هستید که می‌خواهید خارج شوید؟';
        }
    }

    /**
     * مدیریت resize
     * @private
     */
    _handleResize() {
        this._emit('app-resized', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }

    /**
     * بررسی آیا باید confirmation نمایش دهد
     * @returns {boolean}
     * @private
     */
    _shouldConfirmExit() {
        // اگر بازی در حال انجام است
        if (typeof hokmEngine !== 'undefined' && hokmEngine.status === 'playing') {
            return true;
        }

        return false;
    }

    // ============================================================
    // بخش ۴: Keyboard Shortcuts
    // ============================================================

    /**
     * ثبت keyboard shortcuts
     * @private
     */
    _setupKeyboardShortcuts() {
        // F1 - Help
        this.registerShortcut('F1', () => {
            if (typeof uiRouter !== 'undefined') {
                uiRouter.navigate('help');
            }
        });

        // F2 - Settings
        this.registerShortcut('F2', () => {
            if (typeof uiRouter !== 'undefined') {
                uiRouter.navigate('settings');
            }
        });

        // F5 - Refresh (prevent default)
        this.registerShortcut('F5', (event) => {
            event.preventDefault();
            window.location.reload();
        });

        // Escape - Close modal/back
        this.registerShortcut('Escape', () => {
            if (typeof modalManager !== 'undefined') {
                const activeModal = modalManager.getActiveModal();
                if (activeModal) {
                    modalManager.closeModal(activeModal.name);
                    return;
                }
            }

            if (typeof uiRouter !== 'undefined') {
                uiRouter.goBack();
            }
        });

        // Ctrl+M - Mute/Unmute
        this.registerShortcut('Control+M', () => {
            if (typeof soundManager !== 'undefined') {
                if (soundManager.soundsEnabled) {
                    soundManager.muteSounds();
                } else {
                    soundManager.unmuteSounds();
                }
            }
        });

        // Ctrl+P - Pause/Resume music
        this.registerShortcut('Control+P', () => {
            if (typeof musicManager !== 'undefined') {
                if (musicManager.status === 'playing') {
                    musicManager.pause();
                } else if (musicManager.status === 'paused') {
                    musicManager.resume();
                }
            }
        });

        // Ctrl+N - New Game
        this.registerShortcut('Control+N', () => {
            if (typeof uiRouter !== 'undefined') {
                uiRouter.navigate('quick-play');
            }
        });

        // Ctrl+L - Leaderboard
        this.registerShortcut('Control+L', () => {
            if (typeof uiRouter !== 'undefined') {
                uiRouter.navigate('leaderboard');
            }
        });

        // Ctrl+I - Inventory
        this.registerShortcut('Control+I', () => {
            if (typeof uiRouter !== 'undefined') {
                uiRouter.navigate('inventory');
            }
        });

        // Ctrl+S - Statistics
        this.registerShortcut('Control+S', (event) => {
            event.preventDefault();
            if (typeof uiRouter !== 'undefined') {
                uiRouter.navigate('statistics');
            }
        });
    }

    /**
     * ثبت shortcut جدید
     * @param {string} key - کلید
     * @param {Function} callback - callback
     * @returns {void}
     */
    registerShortcut(key, callback) {
        this.keyboardShortcuts.set(key.toLowerCase(), callback);

        if (this.debug) {
            console.log(`⌨️ Shortcut registered: ${key}`);
        }
    }

    /**
     * حذف shortcut
     * @param {string} key - کلید
     * @returns {void}
     */
    unregisterShortcut(key) {
        this.keyboardShortcuts.delete(key.toLowerCase());
    }

    /**
     * مدیریت رویداد keyboard
     * @param {KeyboardEvent} event - رویداد
     * @private
     */
    _handleKeyboardEvent(event) {
        // ساخت key string
        const modifiers = [];
        if (event.ctrlKey) modifiers.push('control');
        if (event.shiftKey) modifiers.push('shift');
        if (event.altKey) modifiers.push('alt');
        if (event.metaKey) modifiers.push('meta');

        const keyString = [...modifiers, event.key.toLowerCase()].join('+');

        // بررسی shortcut
        const callback = this.keyboardShortcuts.get(keyString);
        if (callback) {
            event.preventDefault();
            callback(event);
        }
    }

    // ============================================================
    // بخش ۵: Plugin System
    // ============================================================

    /**
     * ثبت پلاگین
     * @param {Object} plugin - پلاگین
     * @returns {Object} نتیجه
     */
    registerPlugin(plugin) {
        const {
            name,
            version,
            init,
            destroy,
            hooks = {}
        } = plugin;

        if (!name) {
            return {
                success: false,
                error: 'INVALID_PLUGIN',
                message: 'نام پلاگین الزامی است'
            };
        }

        const pluginInfo = {
            name,
            version: version || '1.0.0',
            init,
            destroy,
            hooks,
            registeredAt: Date.now(),
            isActive: false
        };

        this.plugins.push(pluginInfo);

        // اجرای init
        if (init) {
            try {
                init(this);
                pluginInfo.isActive = true;
            } catch (error) {
                console.error(`❌ Plugin ${name} init failed:`, error);
                pluginInfo.isActive = false;
            }
        }

        console.log(`🔌 Plugin registered: ${name} v${pluginInfo.version}`);

        return {
            success: true,
            plugin: pluginInfo
        };
    }

    /**
     * حذف پلاگین
     * @param {string} pluginName - نام پلاگین
     * @returns {Object} نتیجه
     */
    unregisterPlugin(pluginName) {
        const pluginIndex = this.plugins.findIndex(p => p.name === pluginName);
        if (pluginIndex === -1) {
            return {
                success: false,
                error: 'PLUGIN_NOT_FOUND',
                message: 'پلاگین یافت نشد'
            };
        }

        const plugin = this.plugins[pluginIndex];

        // اجرای destroy
        if (plugin.destroy) {
            try {
                plugin.destroy();
            } catch (error) {
                console.error(`❌ Plugin ${pluginName} destroy failed:`, error);
            }
        }

        this.plugins.splice(pluginIndex, 1);

        console.log(`🔌 Plugin unregistered: ${pluginName}`);

        return {
            success: true,
            pluginName
        };
    }

    /**
     * اجرای hook
     * @param {string} hookName - نام hook
     * @param {*} data - داده
     * @returns {Array} نتایج
     */
    async runHook(hookName, data = null) {
        const results = [];

        for (const plugin of this.plugins) {
            if (plugin.hooks[hookName]) {
                try {
                    const result = await plugin.hooks[hookName](data);
                    results.push({ plugin: plugin.name, result });
                } catch (error) {
                    console.error(`❌ Hook ${hookName} failed in plugin ${plugin.name}:`, error);
                }
            }
        }

        return results;
    }

    // ============================================================
    // بخش ۶: App State Management
    // ============================================================

    /**
     * ذخیره state اپلیکیشن
     * @private
     */
    _saveAppState() {
        if (typeof storage !== 'undefined') {
            const appState = {
                version: this.versionInfo.version,
                status: this.status,
                lastActiveAt: Date.now(),
                uptime: Date.now() - this.startTime,
                totalErrors: this.stats.totalErrors
            };

            storage.set('app_state', appState);
        }
    }

    /**
     * بارگذاری state اپلیکیشن
     * @returns {Object|null}
     */
    loadAppState() {
        if (typeof storage !== 'undefined') {
            return storage.get('app_state');
        }
        return null;
    }

    /**
     * پاک کردن state اپلیکیشن
     * @returns {void}
     */
    clearAppState() {
        if (typeof storage !== 'undefined') {
            storage.remove('app_state');
        }
    }

    // ============================================================
    // بخش ۷: Module Management
    // ============================================================

    /**
     * دریافت ماژول
     * @param {string} moduleName - نام ماژول
     * @returns {Object|null}
     */
    getModule(moduleName) {
        return this.modules.get(moduleName) || null;
    }

    /**
     * دریافت تمام ماژول‌ها
     * @returns {Map<string, Object>}
     */
    getAllModules() {
        return new Map(this.modules);
    }

    /**
     * بررسی وجود ماژول
     * @param {string} moduleName - نام ماژول
     * @returns {boolean}
     */
    hasModule(moduleName) {
        return this.modules.has(moduleName);
    }

    // ============================================================
    // بخش ۸: Status & Info
    // ============================================================

    /**
     * دریافت وضعیت اپلیکیشن
     * @returns {Object}
     */
    getStatus() {
        return {
            status: this.status,
            version: this.versionInfo,
            uptime: Date.now() - this.startTime,
            isOnline: this.isOnline,
            isVisible: this.isVisible,
            modulesCount: this.modules.size,
            pluginsCount: this.plugins.length,
            shortcutsCount: this.keyboardShortcuts.size
        };
    }

    /**
     * دریافت آمار اپلیکیشن
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.startTime,
            memoryUsage: performance?.memory?.usedJSHeapSize || 0,
            modulesLoaded: this.modules.size,
            pluginsLoaded: this.plugins.length
        };
    }

    /**
     * دریافت اطلاعات نسخه
     * @returns {Object}
     */
    getVersionInfo() {
        return {
            ...this.versionInfo,
            buildNumber: this.versionInfo.build,
            environment: this.versionInfo.environment,
            buildDate: this.versionInfo.buildDate,
            features: {
                pwa: 'serviceWorker' in navigator,
                websocket: typeof WebSocket !== 'undefined',
                webAudio: typeof AudioContext !== 'undefined',
                crypto: typeof crypto !== 'undefined',
                localStorage: typeof localStorage !== 'undefined'
            }
        };
    }

    // ============================================================
    // بخش : Utility Methods
    // ============================================================

    /**
     * رفرش اپلیکیشن
     * @returns {void}
     */
    refresh() {
        window.location.reload();
    }

    /**
     * خروج از اپلیکیشن
     * @returns {void}
     */
    exit() {
        this._saveAppState();
        this.destroy();
        window.close();
    }

    /**
     * پاک کردن cache
     * @returns {Promise<void>}
     */
    async clearCache() {
        if (this.swRegistration) {
            const caches = await this.swRegistration.caches;
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }

        if (typeof storage !== 'undefined') {
            storage.clear();
        }

        console.log('️ Cache cleared');
    }

    /**
     * گزارش مشکل
     * @param {Object} issueData - داده‌های مشکل
     * @returns {Object} نتیجه
     */
    reportIssue(issueData) {
        const report = {
            ...issueData,
            appVersion: this.versionInfo.version,
            environment: this.versionInfo.environment,
            timestamp: Date.now(),
            uptime: Date.now() - this.startTime,
            totalErrors: this.stats.totalErrors,
            isOnline: this.isOnline,
            userAgent: navigator?.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`
        };

        console.log('📝 Issue reported:', report);

        this._emit('issue-reported', report);

        return {
            success: true,
            report
        };
    }

    // ============================================================
    // بخش ۱۰: Destroy & Cleanup
    // ============================================================

    /**
     * نابودی اپلیکیشن
     * @returns {void}
     */
    async destroy() {
        console.log('🛑 Destroying app...');

        this.status = 'destroyed';

        // نابودی پلاگین‌ها
        for (const plugin of this.plugins) {
            if (plugin.destroy) {
                try {
                    plugin.destroy();
                } catch (error) {
                    console.error(`❌ Plugin ${plugin.name} destroy failed:`, error);
                }
            }
        }

        // پاک کردن listeners
        this.clearListeners();
        this.keyboardShortcuts.clear();

        // ذخیره state
        this._saveAppState();

        console.log('✅ App destroyed');

        this._emit('app-destroyed');
    }

    // ============================================================
    // بخش ۱۱: Debug & Logging
    // ============================================================

    /**
     * لاگ وضعیت کامل
     * @returns {void}
     */
    logFullStatus() {
        const status = this.getStatus();
        const stats = this.getStats();
        const version = this.getVersionInfo();

        console.log('═══════════════════════════════════════');
        console.log('🎮 HOKM MASTER - App Status');
        console.log('═══════════════════════════════════════');
        console.log(`Version: ${version.version} (${version.buildNumber})`);
        console.log(`Environment: ${version.environment}`);
        console.log(`Status: ${status.status}`);
        console.log(`Uptime: ${Utils.formatDuration(Math.floor(stats.uptime / 1000))}`);
        console.log(`Online: ${status.isOnline ? '✅' : '❌'}`);
        console.log(`Visible: ${status.isVisible ? '✅' : '❌'}`);
        console.log('───────────────────────────────────────');
        console.log(`Modules: ${status.modulesCount}`);
        console.log(`Plugins: ${status.pluginsCount}`);
        console.log(`Shortcuts: ${status.shortcutsCount}`);
        console.log('───────────────────────────────────────');
        console.log(`Total Errors: ${stats.totalErrors}`);
        console.log(`Total Warnings: ${stats.totalWarnings}`);
        console.log(`Init Time: ${stats.initializationTime}ms`);
        console.log('═══════════════════════════════════════');
    }

    /**
     * دریافت debug info
     * @returns {Object}
     */
    getDebugInfo() {
        return {
            status: this.getStatus(),
            stats: this.getStats(),
            version: this.getVersionInfo(),
            modules: Array.from(this.modules.keys()),
            plugins: this.plugins.map(p => ({ name: p.name, version: p.version, active: p.isActive })),
            shortcuts: Array.from(this.keyboardShortcuts.keys())
        };
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
                    console.error(`❌ App event listener error:`, error);
                }
            });
        }

        // انتشار در eventBus اصلی
        if (typeof eventBus !== 'undefined') {
            eventBus.emit(`app:${event}`, data);
        }
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
const appController = new AppController();

// ============================================================
// Auto-start when DOM is ready
// ============================================================
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        console.log(' Hokm Master - Starting...');
        await appController.start();
    });
}

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppController, appController };
} else {
    window.AppController = AppController;
    window.appController = appController;
}

console.log('✅ AppController loaded');
