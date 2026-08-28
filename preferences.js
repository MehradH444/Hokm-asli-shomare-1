/**
 * ============================================================
 * HOKM MASTER - User Preferences Manager
 * سیستم مدیریت ترجیحات کاربر
 * ============================================================
 * 
 * این فایل مسئول مدیریت ترجیحات شخصی کاربر است. برخلاف
 * settings.js که تنظیمات فنی را مدیریت می‌کند، این فایل
 * ترجیحات شخصی‌سازی شده کاربر برای تجربه بازی را مدیریت
 * می‌کند. شامل چیدمان کارت‌ها، رنگ‌های مورد علاقه، استراتژی
 * پیش‌فرض، نمایش اطلاعات، و سایر ترجیحات شخصی.
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

class PreferencesManager {

    constructor() {
        /**
         * ترجیحات چیدمان کارت
         * @type {Object}
         */
        this.cardLayoutPreferences = {
            sortOrder: 'suit', // suit, rank, value, custom
            suitOrder: ['spades', 'hearts', 'diamonds', 'clubs'],
            rankOrder: ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'],
            fanAngle: 15, // درجه
            fanRadius: 100, // پیکسل
            cardOverlap: 30, // پیکسل
            showCardBack: true,
            highlightValidCards: true,
            highlightTrumpCards: true,
            highlightLeadSuit: true,
            showCardValues: false,
            compactMode: false
        };

        /**
         * ترجیحات نمایش
         * @type {Object}
         */
        this.displayPreferences = {
            showOpponentNames: true,
            showOpponentAvatars: true,
            showOpponentRatings: false,
            showTrickHistory: true,
            showLastTrick: true,
            showScoreboard: true,
            showTimer: true,
            showTrumpIndicator: true,
            showDealerIndicator: true,
            showHakemIndicator: true,
            showTurnIndicator: true,
            showCardCount: true,
            showAnimations: true,
            animationSpeed: 1.0, // 0.5, 1.0, 1.5, 2.0
            showTooltips: true,
            showHelpHints: true,
            showProbabilityHints: false
        };

        /**
         * ترجیحات رنگ
         * @type {Object}
         */
        this.colorPreferences = {
            primaryColor: '#f4d03f',
            secondaryColor: '#0d2924',
            accentColor: '#16a34a',
            backgroundColor: '#0a1f1c',
            cardBackColor: '#1a3d36',
            trumpHighlightColor: '#f4d03f',
            validCardColor: '#4ade80',
            invalidCardColor: '#ef4444',
            selectedCardColor: '#3b82f6',
            customColors: {
                spades: '#000000',
                hearts: '#dc2626',
                diamonds: '#dc2626',
                clubs: '#000000'
            }
        };

        /**
         * ترجیحات استراتژی
         * @type {Object}
         */
        this.strategyPreferences = {
            defaultTrumpSelection: 'most_cards', // most_cards, highest_value, balanced
            autoPlayEnabled: false,
            autoPlayDelay: 1000, // میلی‌ثانیه
            autoPlayStrategy: 'balanced', // aggressive, defensive, balanced
            suggestBestMove: false,
            showMoveAnalysis: false,
            warnOnMistakes: true,
            autoSortAfterTrick: true,
            rememberLastTrump: true
        };

        /**
         * ترجیحات صدا
         * @type {Object}
         */
        this.soundPreferences = {
            cardPlaySound: true,
            trickWinSound: true,
            roundWinSound: true,
            matchWinSound: true,
            matchLoseSound: true,
            buttonClickSound: true,
            notificationSound: true,
            coinEarnSound: true,
            levelUpSound: true,
            achievementSound: true,
            customSounds: {},
            soundPack: 'default' // default, classic, modern, minimal
        };

        /**
         * ترجیحات کنترل
         * @type {Object}
         */
        this.controlPreferences = {
            dragToPlay: true,
            clickToPlay: true,
            doubleClickToSort: true,
            rightClickToCancel: true,
            keyboardShortcuts: {
                play: 'Enter',
                sort: 'S',
                undo: 'Z',
                redo: 'Y',
                pause: 'P',
                settings: 'Escape'
            },
            touchGestures: {
                swipeToSort: true,
                pinchToZoom: true,
                longPressToInfo: true
            },
            confirmBeforePlay: false,
            confirmBeforeLeave: true
        };

        /**
         * ترجیحات اجتماعی
         * @type {Object}
         */
        this.socialPreferences = {
            autoAcceptFriendRequests: false,
            autoAcceptGameInvites: false,
            showOnlineFriends: true,
            notifyOnFriendOnline: true,
            notifyOnFriendOffline: false,
            showChatNotifications: true,
            autoOpenChat: false,
            defaultChatChannel: 'public',
            quickMessages: [
                'سلام',
                'خسته نباشید',
                'دستت درد نکنه',
                'ایول!',
                'بازی خوبی بود',
                'دوباره؟',
                'موفق باشی',
                'GG'
            ],
            emojiEnabled: true,
            stickerEnabled: true
        };

        /**
         * ترجیحات بازی
         * @type {Object}
         */
        this.gamePreferences = {
            defaultGameMode: 'quick', // quick, classic, ranked, private, practice
            defaultAILevel: 'normal',
            autoStartNextGame: false,
            autoJoinTournaments: false,
            preferRankedGames: false,
            showGameSuggestions: true,
            trackStatistics: true,
            saveGameHistory: true,
            maxHistorySize: 100
        };

        /**
         * ترجیحات اعلان
         * @type {Object}
         */
        this.notificationPreferences = {
            showInGameNotifications: true,
            notificationPosition: 'top-right', // top-left, top-right, bottom-left, bottom-right
            notificationDuration: 3000, // میلی‌ثانیه
            notificationMaxVisible: 3,
            showRewardNotifications: true,
            showMissionNotifications: true,
            showFriendNotifications: true,
            showSystemNotifications: true,
            minimizeNotifications: false
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
         * نسخه ترجیحات
         * @type {number}
         */
        this.preferencesVersion = 1;

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
        // بارگذاری ترجیحات ذخیره شده
        this._loadPreferences();

        // بررسی migration
        this._checkMigration();

        // اعمال ترجیحات
        this._applyPreferences();

        if (this.debug) {
            console.log('🎨 PreferencesManager initialized');
            console.log('  Version:', this.preferencesVersion);
            console.log('  Card Sort:', this.cardLayoutPreferences.sortOrder);
            console.log('  Theme:', this.colorPreferences.primaryColor);
        }
    }

    // ============================================================
    // بخش ۱: دریافت ترجیحات
    // ============================================================

    /**
     * دریافت تمام ترجیحات
     * @returns {Object}
     */
    getAllPreferences() {
        return {
            version: this.preferencesVersion,
            lastModified: this.lastModified,
            cardLayout: { ...this.cardLayoutPreferences },
            display: { ...this.displayPreferences },
            color: { ...this.colorPreferences },
            strategy: { ...this.strategyPreferences },
            sound: { ...this.soundPreferences },
            control: { ...this.controlPreferences },
            social: { ...this.socialPreferences },
            game: { ...this.gamePreferences },
            notification: { ...this.notificationPreferences }
        };
    }

    /**
     * دریافت ترجیحات چیدمان کارت
     * @returns {Object}
     */
    getCardLayoutPreferences() {
        return { ...this.cardLayoutPreferences };
    }

    /**
     * دریافت ترجیحات نمایش
     * @returns {Object}
     */
    getDisplayPreferences() {
        return { ...this.displayPreferences };
    }

    /**
     * دریافت ترجیحات رنگ
     * @returns {Object}
     */
    getColorPreferences() {
        return { ...this.colorPreferences };
    }

    /**
     * دریافت ترجیحات استراتژی
     * @returns {Object}
     */
    getStrategyPreferences() {
        return { ...this.strategyPreferences };
    }

    /**
     * دریافت ترجیحات صدا
     * @returns {Object}
     */
    getSoundPreferences() {
        return { ...this.soundPreferences };
    }

    /**
     * دریافت ترجیحات کنترل
     * @returns {Object}
     */
    getControlPreferences() {
        return { ...this.controlPreferences };
    }

    /**
     * دریافت ترجیحات اجتماعی
     * @returns {Object}
     */
    getSocialPreferences() {
        return { ...this.socialPreferences };
    }

    /**
     * دریافت ترجیحات بازی
     * @returns {Object}
     */
    getGamePreferences() {
        return { ...this.gamePreferences };
    }

    /**
     * دریافت ترجیحات اعلان
     * @returns {Object}
     */
    getNotificationPreferences() {
        return { ...this.notificationPreferences };
    }

    // ============================================================
    // بخش ۲: به‌روزرسانی ترجیحات
    // ============================================================

    /**
     * به‌روزرسانی ترجیحات چیدمان کارت
     * @param {Object} newPreferences - ترجیحات جدید
     * @returns {Object} نتیجه
     */
    updateCardLayoutPreferences(newPreferences) {
        const oldPreferences = { ...this.cardLayoutPreferences };

        this.cardLayoutPreferences = this._deepMerge(this.cardLayoutPreferences, newPreferences);
        this.lastModified = Date.now();

        this._applyCardLayoutPreferences();
        this._savePreferences();

        this._emit('card-layout-preferences-updated', {
            oldPreferences,
            newPreferences: this.cardLayoutPreferences
        });

        if (this.debug) {
            console.log('🃏 Card layout preferences updated');
        }

        return {
            success: true,
            oldPreferences,
            newPreferences: this.cardLayoutPreferences
        };
    }

    /**
     * به‌روزرسانی ترجیحات نمایش
     * @param {Object} newPreferences - ترجیحات جدید
     * @returns {Object} نتیجه
     */
    updateDisplayPreferences(newPreferences) {
        const oldPreferences = { ...this.displayPreferences };

        this.displayPreferences = this._deepMerge(this.displayPreferences, newPreferences);
        this.lastModified = Date.now();

        this._applyDisplayPreferences();
        this._savePreferences();

        this._emit('display-preferences-updated', {
            oldPreferences,
            newPreferences: this.displayPreferences
        });

        if (this.debug) {
            console.log('👁️ Display preferences updated');
        }

        return {
            success: true,
            oldPreferences,
            newPreferences: this.displayPreferences
        };
    }

    /**
     * به‌روزرسانی ترجیحات رنگ
     * @param {Object} newPreferences - ترجیحات جدید
     * @returns {Object} نتیجه
     */
    updateColorPreferences(newPreferences) {
        const oldPreferences = { ...this.colorPreferences };

        this.colorPreferences = this._deepMerge(this.colorPreferences, newPreferences);
        this.lastModified = Date.now();

        this._applyColorPreferences();
        this._savePreferences();

        this._emit('color-preferences-updated', {
            oldPreferences,
            newPreferences: this.colorPreferences
        });

        if (this.debug) {
            console.log('🎨 Color preferences updated');
        }

        return {
            success: true,
            oldPreferences,
            newPreferences: this.colorPreferences
        };
    }

    /**
     * به‌روزرسانی ترجیحات استراتژی
     * @param {Object} newPreferences - ترجیحات جدید
     * @returns {Object} نتیجه
     */
    updateStrategyPreferences(newPreferences) {
        const oldPreferences = { ...this.strategyPreferences };

        this.strategyPreferences = this._deepMerge(this.strategyPreferences, newPreferences);
        this.lastModified = Date.now();

        this._applyStrategyPreferences();
        this._savePreferences();

        this._emit('strategy-preferences-updated', {
            oldPreferences,
            newPreferences: this.strategyPreferences
        });

        if (this.debug) {
            console.log('🧠 Strategy preferences updated');
        }

        return {
            success: true,
            oldPreferences,
            newPreferences: this.strategyPreferences
        };
    }

    /**
     * به‌روزرسانی ترجیحات صدا
     * @param {Object} newPreferences - ترجیحات جدید
     * @returns {Object} نتیجه
     */
    updateSoundPreferences(newPreferences) {
        const oldPreferences = { ...this.soundPreferences };

        this.soundPreferences = this._deepMerge(this.soundPreferences, newPreferences);
        this.lastModified = Date.now();

        this._applySoundPreferences();
        this._savePreferences();

        this._emit('sound-preferences-updated', {
            oldPreferences,
            newPreferences: this.soundPreferences
        });

        if (this.debug) {
            console.log('🔊 Sound preferences updated');
        }

        return {
            success: true,
            oldPreferences,
            newPreferences: this.soundPreferences
        };
    }

    /**
     * به‌روزرسانی ترجیحات کنترل
     * @param {Object} newPreferences - ترجیحات جدید
     * @returns {Object} نتیجه
     */
    updateControlPreferences(newPreferences) {
        const oldPreferences = { ...this.controlPreferences };

        this.controlPreferences = this._deepMerge(this.controlPreferences, newPreferences);
        this.lastModified = Date.now();

        this._applyControlPreferences();
        this._savePreferences();

        this._emit('control-preferences-updated', {
            oldPreferences,
            newPreferences: this.controlPreferences
        });

        if (this.debug) {
            console.log('🎮 Control preferences updated');
        }

        return {
            success: true,
            oldPreferences,
            newPreferences: this.controlPreferences
        };
    }

    /**
     * به‌روزرسانی ترجیحات اجتماعی
     * @param {Object} newPreferences - ترجیحات جدید
     * @returns {Object} نتیجه
     */
    updateSocialPreferences(newPreferences) {
        const oldPreferences = { ...this.socialPreferences };

        this.socialPreferences = this._deepMerge(this.socialPreferences, newPreferences);
        this.lastModified = Date.now();

        this._applySocialPreferences();
        this._savePreferences();

        this._emit('social-preferences-updated', {
            oldPreferences,
            newPreferences: this.socialPreferences
        });

        if (this.debug) {
            console.log(' Social preferences updated');
        }

        return {
            success: true,
            oldPreferences,
            newPreferences: this.socialPreferences
        };
    }

    /**
     * به‌روزرسانی ترجیحات بازی
     * @param {Object} newPreferences - ترجیحات جدید
     * @returns {Object} نتیجه
     */
    updateGamePreferences(newPreferences) {
        const oldPreferences = { ...this.gamePreferences };

        this.gamePreferences = this._deepMerge(this.gamePreferences, newPreferences);
        this.lastModified = Date.now();

        this._applyGamePreferences();
        this._savePreferences();

        this._emit('game-preferences-updated', {
            oldPreferences,
            newPreferences: this.gamePreferences
        });

        if (this.debug) {
            console.log('🎲 Game preferences updated');
        }

        return {
            success: true,
            oldPreferences,
            newPreferences: this.gamePreferences
        };
    }

    /**
     * به‌روزرسانی ترجیحات اعلان
     * @param {Object} newPreferences - ترجیحات جدید
     * @returns {Object} نتیجه
     */
    updateNotificationPreferences(newPreferences) {
        const oldPreferences = { ...this.notificationPreferences };

        this.notificationPreferences = this._deepMerge(this.notificationPreferences, newPreferences);
        this.lastModified = Date.now();

        this._applyNotificationPreferences();
        this._savePreferences();

        this._emit('notification-preferences-updated', {
            oldPreferences,
            newPreferences: this.notificationPreferences
        });

        if (this.debug) {
            console.log('🔔 Notification preferences updated');
        }

        return {
            success: true,
            oldPreferences,
            newPreferences: this.notificationPreferences
        };
    }

    // ============================================================
    // بخش ۳: ترجیحات سریع
    // ============================================================

    /**
     * تغییر ترتیب کارت‌ها
     * @param {string} order - ترتیب (suit, rank, value, custom)
     * @returns {Object} نتیجه
     */
    setCardSortOrder(order) {
        const validOrders = ['suit', 'rank', 'value', 'custom'];
        if (!validOrders.includes(order)) {
            return {
                success: false,
                error: 'INVALID_ORDER',
                message: 'ترتیب نامعتبر است'
            };
        }

        return this.updateCardLayoutPreferences({ sortOrder: order });
    }

    /**
     * تغییر زاویه fan کارت‌ها
     * @param {number} angle - زاویه (درجه)
     * @returns {Object} نتیجه
     */
    setFanAngle(angle) {
        if (angle < 0 || angle > 45) {
            return {
                success: false,
                error: 'INVALID_ANGLE',
                message: 'زاویه باید بین 0 تا 45 درجه باشد'
            };
        }

        return this.updateCardLayoutPreferences({ fanAngle: angle });
    }

    /**
     * تغییر حالت فشرده
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setCompactMode(enabled) {
        return this.updateCardLayoutPreferences({ compactMode: enabled });
    }

    /**
     * تغییر سرعت انیمیشن
     * @param {number} speed - سرعت (0.5, 1.0, 1.5, 2.0)
     * @returns {Object} نتیجه
     */
    setAnimationSpeed(speed) {
        const validSpeeds = [0.5, 1.0, 1.5, 2.0];
        if (!validSpeeds.includes(speed)) {
            return {
                success: false,
                error: 'INVALID_SPEED',
                message: 'سرعت نامعتبر است'
            };
        }

        return this.updateDisplayPreferences({ animationSpeed: speed });
    }

    /**
     * تغییر رنگ اصلی
     * @param {string} color - رنگ (hex)
     * @returns {Object} نتیجه
     */
    setPrimaryColor(color) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return {
                success: false,
                error: 'INVALID_COLOR',
                message: 'فرمت رنگ نامعتبر است'
            };
        }

        return this.updateColorPreferences({ primaryColor: color });
    }

    /**
     * تغییر استراتژی پیش‌فرض
     * @param {string} strategy - استراتژی
     * @returns {Object} نتیجه
     */
    setDefaultStrategy(strategy) {
        const validStrategies = ['aggressive', 'defensive', 'balanced'];
        if (!validStrategies.includes(strategy)) {
            return {
                success: false,
                error: 'INVALID_STRATEGY',
                message: 'استراتژی نامعتبر است'
            };
        }

        return this.updateStrategyPreferences({ autoPlayStrategy: strategy });
    }

    /**
     * تغییر حالت بازی پیش‌فرض
     * @param {string} mode - حالت بازی
     * @returns {Object} نتیجه
     */
    setDefaultGameMode(mode) {
        const validModes = ['quick', 'classic', 'ranked', 'private', 'practice'];
        if (!validModes.includes(mode)) {
            return {
                success: false,
                error: 'INVALID_MODE',
                message: 'حالت بازی نامعتبر است'
            };
        }

        return this.updateGamePreferences({ defaultGameMode: mode });
    }

    /**
     * تغییر سطح AI پیش‌فرض
     * @param {string} level - سطح AI
     * @returns {Object} نتیجه
     */
    setDefaultAILevel(level) {
        const validLevels = ['beginner', 'easy', 'normal', 'hard', 'expert', 'master'];
        if (!validLevels.includes(level)) {
            return {
                success: false,
                error: 'INVALID_LEVEL',
                message: 'سطح AI نامعتبر است'
            };
        }

        return this.updateGamePreferences({ defaultAILevel: level });
    }

    /**
     * تغییر کلید میانبر
     * @param {string} action - اکشن
     * @param {string} key - کلید
     * @returns {Object} نتیجه
     */
    setKeyboardShortcut(action, key) {
        const validActions = Object.keys(this.controlPreferences.keyboardShortcuts);
        if (!validActions.includes(action)) {
            return {
                success: false,
                error: 'INVALID_ACTION',
                message: 'اکشن نامعتبر است'
            };
        }

        return this.updateControlPreferences({
            keyboardShortcuts: { [action]: key }
        });
    }

    // ============================================================
    // بخش ۴: اعمال ترجیحات
    // ============================================================

    /**
     * اعمال تمام ترجیحات
     * @private
     */
    _applyPreferences() {
        this._applyCardLayoutPreferences();
        this._applyDisplayPreferences();
        this._applyColorPreferences();
        this._applyStrategyPreferences();
        this._applySoundPreferences();
        this._applyControlPreferences();
        this._applySocialPreferences();
        this._applyGamePreferences();
        this._applyNotificationPreferences();
    }

    /**
     * اعمال ترجیحات چیدمان کارت
     * @private
     */
    _applyCardLayoutPreferences() {
        // اعمال به game engine
        if (typeof cardEngine !== 'undefined' && cardEngine) {
            if (cardEngine.setSortOrder) {
                cardEngine.setSortOrder(this.cardLayoutPreferences.sortOrder);
            }
        }

        // اعمال CSS variables
        const root = document.documentElement;
        if (root) {
            root.style.setProperty('--card-fan-angle', `${this.cardLayoutPreferences.fanAngle}deg`);
            root.style.setProperty('--card-fan-radius', `${this.cardLayoutPreferences.fanRadius}px`);
            root.style.setProperty('--card-overlap', `${this.cardLayoutPreferences.cardOverlap}px`);
        }
    }

    /**
     * اعمال ترجیحات نمایش
     * @private
     */
    _applyDisplayPreferences() {
        const root = document.documentElement;
        if (root) {
            if (this.displayPreferences.compactMode) {
                root.classList.add('compact-mode');
            } else {
                root.classList.remove('compact-mode');
            }

            root.style.setProperty('--animation-speed', this.displayPreferences.animationSpeed);
        }
    }

    /**
     * اعمال ترجیحات رنگ
     * @private
     */
    _applyColorPreferences() {
        const root = document.documentElement;
        if (root) {
            root.style.setProperty('--primary-color', this.colorPreferences.primaryColor);
            root.style.setProperty('--secondary-color', this.colorPreferences.secondaryColor);
            root.style.setProperty('--accent-color', this.colorPreferences.accentColor);
            root.style.setProperty('--background-color', this.colorPreferences.backgroundColor);
            root.style.setProperty('--card-back-color', this.colorPreferences.cardBackColor);
            root.style.setProperty('--trump-highlight-color', this.colorPreferences.trumpHighlightColor);
            root.style.setProperty('--valid-card-color', this.colorPreferences.validCardColor);
            root.style.setProperty('--invalid-card-color', this.colorPreferences.invalidCardColor);
            root.style.setProperty('--selected-card-color', this.colorPreferences.selectedCardColor);
        }
    }

    /**
     * اعمال ترجیحات استراتژی
     * @private
     */
    _applyStrategyPreferences() {
        // اعمال به AI engine
        if (typeof aiEngine !== 'undefined' && aiEngine) {
            if (aiEngine.setDefaultStrategy) {
                aiEngine.setDefaultStrategy(this.strategyPreferences.autoPlayStrategy);
            }
        }
    }

    /**
     * اعمال ترجیحات صدا
     * @private
     */
    _applySoundPreferences() {
        // اعمال به audio manager
        if (typeof audioManager !== 'undefined' && audioManager) {
            if (audioManager.setSoundPack) {
                audioManager.setSoundPack(this.soundPreferences.soundPack);
            }
        }
    }

    /**
     * اعمال ترجیحات کنترل
     * @private
     */
    _applyControlPreferences() {
        // ثبت keyboard shortcuts
        this._setupKeyboardShortcuts();
    }

    /**
     * اعمال ترجیحات اجتماعی
     * @private
     */
    _applySocialPreferences() {
        // اعمال به friends manager
        if (typeof friendsManager !== 'undefined' && friendsManager) {
            friendsManager.autoAcceptRequests = this.socialPreferences.autoAcceptFriendRequests;
        }
    }

    /**
     * اعمال ترجیحات بازی
     * @private
     */
    _applyGamePreferences() {
        // اعمال به game modes
        if (typeof quickPlayMode !== 'undefined' && quickPlayMode) {
            quickPlayMode.defaultLevel = this.gamePreferences.defaultAILevel;
        }
    }

    /**
     * اعمال ترجیحات اعلان
     * @private
     */
    _applyNotificationPreferences() {
        // اعمال به notifications manager
        if (typeof notificationsManager !== 'undefined' && notificationsManager) {
            notificationsManager.settings = {
                ...notificationsManager.settings,
                ...this.notificationPreferences
            };
        }
    }

    /**
     * تنظیم keyboard shortcuts
     * @private
     */
    _setupKeyboardShortcuts() {
        if (typeof document === 'undefined') return;

        const shortcuts = this.controlPreferences.keyboardShortcuts;

        document.addEventListener('keydown', (event) => {
            if (event.key === shortcuts.play) {
                this._emit('shortcut-play', { event });
            } else if (event.key === shortcuts.sort) {
                this._emit('shortcut-sort', { event });
            } else if (event.key === shortcuts.undo) {
                this._emit('shortcut-undo', { event });
            } else if (event.key === shortcuts.redo) {
                this._emit('shortcut-redo', { event });
            } else if (event.key === shortcuts.pause) {
                this._emit('shortcut-pause', { event });
            } else if (event.key === shortcuts.settings) {
                this._emit('shortcut-settings', { event });
            }
        });
    }

    // ============================================================
    // بخش ۵: پیش‌فرض‌ها و ریست
    // ============================================================

    /**
     * ریست به ترجیحات پیش‌فرض
     * @param {string} category - دسته‌بندی
     * @returns {Object} نتیجه
     */
    resetToDefaults(category = 'all') {
        const oldPreferences = this.getAllPreferences();

        if (category === 'all' || category === 'cardLayout') {
            this.cardLayoutPreferences = this._getDefaultCardLayoutPreferences();
        }

        if (category === 'all' || category === 'display') {
            this.displayPreferences = this._getDefaultDisplayPreferences();
        }

        if (category === 'all' || category === 'color') {
            this.colorPreferences = this._getDefaultColorPreferences();
        }

        if (category === 'all' || category === 'strategy') {
            this.strategyPreferences = this._getDefaultStrategyPreferences();
        }

        if (category === 'all' || category === 'sound') {
            this.soundPreferences = this._getDefaultSoundPreferences();
        }

        if (category === 'all' || category === 'control') {
            this.controlPreferences = this._getDefaultControlPreferences();
        }

        if (category === 'all' || category === 'social') {
            this.socialPreferences = this._getDefaultSocialPreferences();
        }

        if (category === 'all' || category === 'game') {
            this.gamePreferences = this._getDefaultGamePreferences();
        }

        if (category === 'all' || category === 'notification') {
            this.notificationPreferences = this._getDefaultNotificationPreferences();
        }

        this.lastModified = Date.now();
        this._applyPreferences();
        this._savePreferences();

        this._emit('preferences-reset', {
            category,
            oldPreferences,
            newPreferences: this.getAllPreferences()
        });

        if (this.debug) {
            console.log(` Preferences reset: ${category}`);
        }

        return {
            success: true,
            category,
            newPreferences: this.getAllPreferences()
        };
    }

    /**
     * دریافت ترجیحات پیش‌فرض چیدمان کارت
     * @returns {Object}
     * @private
     */
    _getDefaultCardLayoutPreferences() {
        return {
            sortOrder: 'suit',
            suitOrder: ['spades', 'hearts', 'diamonds', 'clubs'],
            rankOrder: ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'],
            fanAngle: 15,
            fanRadius: 100,
            cardOverlap: 30,
            showCardBack: true,
            highlightValidCards: true,
            highlightTrumpCards: true,
            highlightLeadSuit: true,
            showCardValues: false,
            compactMode: false
        };
    }

    /**
     * دریافت ترجیحات پیش‌فرض نمایش
     * @returns {Object}
     * @private
     */
    _getDefaultDisplayPreferences() {
        return {
            showOpponentNames: true,
            showOpponentAvatars: true,
            showOpponentRatings: false,
            showTrickHistory: true,
            showLastTrick: true,
            showScoreboard: true,
            showTimer: true,
            showTrumpIndicator: true,
            showDealerIndicator: true,
            showHakemIndicator: true,
            showTurnIndicator: true,
            showCardCount: true,
            showAnimations: true,
            animationSpeed: 1.0,
            showTooltips: true,
            showHelpHints: true,
            showProbabilityHints: false
        };
    }

    /**
     * دریافت ترجیحات پیش‌فرض رنگ
     * @returns {Object}
     * @private
     */
    _getDefaultColorPreferences() {
        return {
            primaryColor: '#f4d03f',
            secondaryColor: '#0d2924',
            accentColor: '#16a34a',
            backgroundColor: '#0a1f1c',
            cardBackColor: '#1a3d36',
            trumpHighlightColor: '#f4d03f',
            validCardColor: '#4ade80',
            invalidCardColor: '#ef4444',
            selectedCardColor: '#3b82f6',
            customColors: {
                spades: '#000000',
                hearts: '#dc2626',
                diamonds: '#dc2626',
                clubs: '#000000'
            }
        };
    }

    /**
     * دریافت ترجیحات پیش‌فرض استراتژی
     * @returns {Object}
     * @private
     */
    _getDefaultStrategyPreferences() {
        return {
            defaultTrumpSelection: 'most_cards',
            autoPlayEnabled: false,
            autoPlayDelay: 1000,
            autoPlayStrategy: 'balanced',
            suggestBestMove: false,
            showMoveAnalysis: false,
            warnOnMistakes: true,
            autoSortAfterTrick: true,
            rememberLastTrump: true
        };
    }

    /**
     * دریافت ترجیحات پیش‌فرض صدا
     * @returns {Object}
     * @private
     */
    _getDefaultSoundPreferences() {
        return {
            cardPlaySound: true,
            trickWinSound: true,
            roundWinSound: true,
            matchWinSound: true,
            matchLoseSound: true,
            buttonClickSound: true,
            notificationSound: true,
            coinEarnSound: true,
            levelUpSound: true,
            achievementSound: true,
            customSounds: {},
            soundPack: 'default'
        };
    }

    /**
     * دریافت ترجیحات پیش‌فرض کنترل
     * @returns {Object}
     * @private
     */
    _getDefaultControlPreferences() {
        return {
            dragToPlay: true,
            clickToPlay: true,
            doubleClickToSort: true,
            rightClickToCancel: true,
            keyboardShortcuts: {
                play: 'Enter',
                sort: 'S',
                undo: 'Z',
                redo: 'Y',
                pause: 'P',
                settings: 'Escape'
            },
            touchGestures: {
                swipeToSort: true,
                pinchToZoom: true,
                longPressToInfo: true
            },
            confirmBeforePlay: false,
            confirmBeforeLeave: true
        };
    }

    /**
     * دریافت ترجیحات پیش‌فرض اجتماعی
     * @returns {Object}
     * @private
     */
    _getDefaultSocialPreferences() {
        return {
            autoAcceptFriendRequests: false,
            autoAcceptGameInvites: false,
            showOnlineFriends: true,
            notifyOnFriendOnline: true,
            notifyOnFriendOffline: false,
            showChatNotifications: true,
            autoOpenChat: false,
            defaultChatChannel: 'public',
            quickMessages: [
                'سلام',
                'خسته نباشید',
                'دستت درد نکنه',
                'ایول!',
                'بازی خوبی بود',
                'دوباره؟',
                'موفق باشی',
                'GG'
            ],
            emojiEnabled: true,
            stickerEnabled: true
        };
    }

    /**
     * دریافت ترجیحات پیش‌فرض بازی
     * @returns {Object}
     * @private
     */
    _getDefaultGamePreferences() {
        return {
            defaultGameMode: 'quick',
            defaultAILevel: 'normal',
            autoStartNextGame: false,
            autoJoinTournaments: false,
            preferRankedGames: false,
            showGameSuggestions: true,
            trackStatistics: true,
            saveGameHistory: true,
            maxHistorySize: 100
        };
    }

    /**
     * دریافت ترجیحات پیش‌فرض اعلان
     * @returns {Object}
     * @private
     */
    _getDefaultNotificationPreferences() {
        return {
            showInGameNotifications: true,
            notificationPosition: 'top-right',
            notificationDuration: 3000,
            notificationMaxVisible: 3,
            showRewardNotifications: true,
            showMissionNotifications: true,
            showFriendNotifications: true,
            showSystemNotifications: true,
            minimizeNotifications: false
        };
    }

    // ============================================================
    // بخش ۶: پشتیبان‌گیری و بازیابی
    // ============================================================

    /**
     * ایجاد پشتیبان از ترجیحات
     * @returns {Object} نتیجه
     */
    createBackup() {
        const backup = {
            version: this.preferencesVersion,
            createdAt: Date.now(),
            appVersion: CONFIG.APP.VERSION,
            preferences: this.getAllPreferences()
        };

        const backupId = Utils.generateUUID();
        storage?.set(`preferences_backup_${backupId}`, backup);

        this._emit('preferences-backup-created', { backupId, backup });

        if (this.debug) {
            console.log(`💾 Preferences backup created: ${backupId}`);
        }

        return {
            success: true,
            backupId,
            backup
        };
    }

    /**
     * بازیابی ترجیحات از پشتیبان
     * @param {string} backupId - شناسه پشتیبان
     * @returns {Object} نتیجه
     */
    restoreBackup(backupId) {
        const backup = storage?.get(`preferences_backup_${backupId}`);
        if (!backup) {
            return {
                success: false,
                error: 'BACKUP_NOT_FOUND',
                message: 'پشتیبان یافت نشد'
            };
        }

        const oldPreferences = this.getAllPreferences();

        // بازیابی ترجیحات
        if (backup.preferences.cardLayout) this.cardLayoutPreferences = backup.preferences.cardLayout;
        if (backup.preferences.display) this.displayPreferences = backup.preferences.display;
        if (backup.preferences.color) this.colorPreferences = backup.preferences.color;
        if (backup.preferences.strategy) this.strategyPreferences = backup.preferences.strategy;
        if (backup.preferences.sound) this.soundPreferences = backup.preferences.sound;
        if (backup.preferences.control) this.controlPreferences = backup.preferences.control;
        if (backup.preferences.social) this.socialPreferences = backup.preferences.social;
        if (backup.preferences.game) this.gamePreferences = backup.preferences.game;
        if (backup.preferences.notification) this.notificationPreferences = backup.preferences.notification;

        this.lastModified = Date.now();
        this._applyPreferences();
        this._savePreferences();

        this._emit('preferences-restored', {
            backupId,
            oldPreferences,
            newPreferences: this.getAllPreferences()
        });

        if (this.debug) {
            console.log(`♻️ Preferences restored from backup: ${backupId}`);
        }

        return {
            success: true,
            backupId,
            oldPreferences,
            newPreferences: this.getAllPreferences()
        };
    }

    /**
     * export ترجیحات به JSON
     * @returns {string} JSON string
     */
    exportToJSON() {
        return JSON.stringify(this.getAllPreferences(), null, 2);
    }

    /**
     * import ترجیحات از JSON
     * @param {string} jsonString - JSON string
     * @returns {Object} نتیجه
     */
    importFromJSON(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            const oldPreferences = this.getAllPreferences();

            if (imported.cardLayout) this.cardLayoutPreferences = this._deepMerge(this.cardLayoutPreferences, imported.cardLayout);
            if (imported.display) this.displayPreferences = this._deepMerge(this.displayPreferences, imported.display);
            if (imported.color) this.colorPreferences = this._deepMerge(this.colorPreferences, imported.color);
            if (imported.strategy) this.strategyPreferences = this._deepMerge(this.strategyPreferences, imported.strategy);
            if (imported.sound) this.soundPreferences = this._deepMerge(this.soundPreferences, imported.sound);
            if (imported.control) this.controlPreferences = this._deepMerge(this.controlPreferences, imported.control);
            if (imported.social) this.socialPreferences = this._deepMerge(this.socialPreferences, imported.social);
            if (imported.game) this.gamePreferences = this._deepMerge(this.gamePreferences, imported.game);
            if (imported.notification) this.notificationPreferences = this._deepMerge(this.notificationPreferences, imported.notification);

            this.lastModified = Date.now();
            this._applyPreferences();
            this._savePreferences();

            this._emit('preferences-imported', {
                oldPreferences,
                newPreferences: this.getAllPreferences()
            });

            return {
                success: true,
                oldPreferences,
                newPreferences: this.getAllPreferences()
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
        const savedVersion = storage?.get('preferences_version') || 0;

        if (savedVersion < this.preferencesVersion) {
            this._migratePreferences(savedVersion, this.preferencesVersion);
        }
    }

    /**
     * migration ترجیحات
     * @param {number} fromVersion - نسخه مبدأ
     * @param {number} toVersion - نسخه مقصد
     * @private
     */
    _migratePreferences(fromVersion, toVersion) {
        if (fromVersion < 1) {
            // Migration از v0 به v1
            // اضافه کردن ترجیحات جدید
            if (!this.cardLayoutPreferences.compactMode) {
                this.cardLayoutPreferences.compactMode = false;
            }

            if (!this.displayPreferences.showProbabilityHints) {
                this.displayPreferences.showProbabilityHints = false;
            }

            if (!this.controlPreferences.touchGestures) {
                this.controlPreferences.touchGestures = {
                    swipeToSort: true,
                    pinchToZoom: true,
                    longPressToInfo: true
                };
            }
        }

        // به‌روزرسانی نسخه
        storage?.set('preferences_version', this.preferencesVersion);

        if (this.debug) {
            console.log(`🔄 Preferences migrated from v${fromVersion} to v${toVersion}`);
        }
    }

    // ============================================================
    // بخش ۸: توابع کمکی
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
     * ذخیره ترجیحات
     * @private
     */
    _savePreferences() {
        if (storage) {
            storage.set('preferences_card_layout', this.cardLayoutPreferences);
            storage.set('preferences_display', this.displayPreferences);
            storage.set('preferences_color', this.colorPreferences);
            storage.set('preferences_strategy', this.strategyPreferences);
            storage.set('preferences_sound', this.soundPreferences);
            storage.set('preferences_control', this.controlPreferences);
            storage.set('preferences_social', this.socialPreferences);
            storage.set('preferences_game', this.gamePreferences);
            storage.set('preferences_notification', this.notificationPreferences);
            storage.set('preferences_version', this.preferencesVersion);
            storage.set('preferences_last_modified', this.lastModified);
        }
    }

    /**
     * بارگذاری ترجیحات
     * @private
     */
    _loadPreferences() {
        if (storage) {
            const cardLayout = storage.get('preferences_card_layout');
            if (cardLayout) this.cardLayoutPreferences = this._deepMerge(this._getDefaultCardLayoutPreferences(), cardLayout);

            const display = storage.get('preferences_display');
            if (display) this.displayPreferences = this._deepMerge(this._getDefaultDisplayPreferences(), display);

            const color = storage.get('preferences_color');
            if (color) this.colorPreferences = this._deepMerge(this._getDefaultColorPreferences(), color);

            const strategy = storage.get('preferences_strategy');
            if (strategy) this.strategyPreferences = this._deepMerge(this._getDefaultStrategyPreferences(), strategy);

            const sound = storage.get('preferences_sound');
            if (sound) this.soundPreferences = this._deepMerge(this._getDefaultSoundPreferences(), sound);

            const control = storage.get('preferences_control');
            if (control) this.controlPreferences = this._deepMerge(this._getDefaultControlPreferences(), control);

            const social = storage.get('preferences_social');
            if (social) this.socialPreferences = this._deepMerge(this._getDefaultSocialPreferences(), social);

            const game = storage.get('preferences_game');
            if (game) this.gamePreferences = this._deepMerge(this._getDefaultGamePreferences(), game);

            const notification = storage.get('preferences_notification');
            if (notification) this.notificationPreferences = this._deepMerge(this._getDefaultNotificationPreferences(), notification);

            const version = storage.get('preferences_version');
            if (version) this.preferencesVersion = version;

            const lastModified = storage.get('preferences_last_modified');
            if (lastModified) this.lastModified = lastModified;
        }
    }

    // ============================================================
    // بخش ۹: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار ترجیحات
     * @returns {Object}
     */
    getStats() {
        return {
            version: this.preferencesVersion,
            lastModified: this.lastModified,
            lastModifiedAgo: Utils.timeAgo(this.lastModified),
            categories: {
                cardLayout: this.cardLayoutPreferences,
                display: this.displayPreferences,
                color: this.colorPreferences,
                strategy: this.strategyPreferences,
                sound: this.soundPreferences,
                control: this.controlPreferences,
                social: this.socialPreferences,
                game: this.gamePreferences,
                notification: this.notificationPreferences
            }
        };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();

        console.log('🎨 PreferencesManager Status:');
        console.log('  Version:', stats.version);
        console.log('  Last Modified:', stats.lastModifiedAgo);
        console.log('  Card Sort:', this.cardLayoutPreferences.sortOrder);
        console.log('  Primary Color:', this.colorPreferences.primaryColor);
        console.log('  Animation Speed:', this.displayPreferences.animationSpeed);
        console.log('  Default Strategy:', this.strategyPreferences.autoPlayStrategy);
        console.log('  Default Game Mode:', this.gamePreferences.defaultGameMode);
    }

    // ============================================================
    // بخش ۱۰: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.resetToDefaults('all');

        if (this.debug) {
            console.log('🔄 PreferencesManager reset');
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
                    console.error(` Preferences event listener error:`, error);
                }
            });
        }

        eventBus.emit(`preferences:${event}`, data);
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
const preferencesManager = new PreferencesManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PreferencesManager, preferencesManager };
} else {
    window.PreferencesManager = PreferencesManager;
    window.preferencesManager = preferencesManager;
}

console.log('✅ PreferencesManager loaded');
