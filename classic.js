/**
 * ============================================================
 * HOKM MASTER - Classic Play Mode
 * حالت بازی کلاسیک حکم
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل حالت بازی کلاسیک است. بازی
 * کلاسیک شامل قوانین استاندارد حکم ایرانی، انتخاب تنظیمات
 * پیشرفته، انتخاب حریفان (دوستان یا AI)، امکان ذخیره بازی،
 * و تجربه کامل بازی حکم است.
 * 
 * تفاوت‌های Classic با Quick:
 * - انتخاب تنظیمات کامل (تعداد دست، سطح، قوانین)
 * - انتخاب حریفان (دوستان یا AI)
 * - امکان ذخیره و ادامه بازی
 * - قوانین کامل‌تر و دقیق‌تر
 * - بدون محدودیت زمانی سخت‌گیرانه
 * - امکان انتخاب تیم
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
 * - roomManager (از فایل room.js)
 * - hokmEngine (از فایل engine.js)
 * - cardEngine (از فایل cards.js)
 * - aiEngine (از فایل ai.js)
 * - scoringEngine (از فایل scoring.js)
 * - validationEngine (از فایل validation.js)
 * - friendsManager (از فایل friends.js)
 * 
 * ============================================================
 */

class ClassicPlayMode {

    constructor() {
        /**
         * وضعیت فعلی حالت بازی
         * @type {string} 'idle' | 'setup' | 'lobby' | 'playing' | 'paused' | 'finished' | 'reward'
         */
        this.status = 'idle';

        /**
         * شناسه بازی فعلی
         * @type {string|null}
         */
        this.gameId = null;

        /**
         * شناسه اتاق فعلی
         * @type {string|null}
         */
        this.roomId = null;

        /**
         * اطلاعات بازیکن فعلی
         * @type {Object|null}
         */
        this.player = null;

        /**
         * لیست بازیکنان
         * @type {Array<Object>}
         */
        this.players = [];

        /**
         * تیم‌ها
         * @type {Object}
         */
        this.teams = {
            team1: [],
            team2: []
        };

        /**
         * تنظیمات بازی کلاسیک
         * @type {Object}
         */
        this.gameSettings = {
            handsToWin: 7,          // تعداد دست برای برد (7 یا 13)
            roundsToWin: 2,         // تعداد راند برای برد مچ
            aiLevel: 'normal',      // سطح AI
            allowKot: true,         // اجازه Kot
            allowDoubleKot: false,  // اجازه Double Kot
            timerEnabled: true,     // تایمر فعال
            timerDuration: 30,      // مدت تایمر (ثانیه)
            chatEnabled: true,      // چت فعال
            emotesEnabled: true,    // ایموت فعال
            autoTrump: false,       // انتخاب خودکار حکم
            showLastTrick: true,    // نمایش آخرین دست
            soundEnabled: true,     // صدا فعال
            animationEnabled: true  // انیمیشن فعال
        };

        /**
         * وضعیت بازی
         * @type {Object|null}
         */
        this.gameState = null;

        /**
         * نتیجه بازی
         * @type {Object|null}
         */
        this.gameResult = null;

        /**
         * پاداش بازی
         * @type {Object|null}
         */
        this.reward = null;

        /**
         * تاریخچه بازی (برای ذخیره)
         * @type {Object|null}
         */
        this.savedGame = null;

        /**
         * زمان شروع بازی
         * @type {number|null}
         */
        this.gameStartTime = null;

        /**
         * مدت زمان بازی (ثانیه)
         * @type {number}
         */
        this.gameDuration = 0;

        /**
         * تایمر مدت زمان بازی
         * @type {number|null}
         */
        this.durationTimer = null;

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
         * آمار بازی کلاسیک
         * @type {Object}
         */
        this.stats = {
            totalGames: 0,
            completedGames: 0,
            savedGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            averageGameDuration: 0,
            totalCoinsEarned: 0,
            totalXpEarned: 0,
            kotCount: 0,
            perfectGames: 0
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری اطلاعات بازیکن
        const user = authManager?.getCurrentUser();
        if (user) {
            this.player = {
                id: user.id,
                username: user.username,
                profile: user.profile
            };
        }

        // بارگذاری تنظیمات ذخیره شده
        this._loadSavedSettings();

        if (this.debug) {
            console.log('🎴 ClassicPlayMode initialized');
        }
    }

    // ============================================================
    // بخش ۱: راه‌اندازی بازی
    // ============================================================

    /**
     * شروع راه‌اندازی بازی کلاسیک
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    startSetup(options = {}) {
        if (this.status !== 'idle') {
            return {
                success: false,
                error: 'GAME_IN_PROGRESS',
                message: 'یک بازی در حال انجام است'
            };
        }

        if (!this.player) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای بازی باید وارد شوید'
            };
        }

        // اعمال تنظیمات پیش‌فرض
        this.gameSettings = {
            ...this.gameSettings,
            ...options
        };

        this.status = 'setup';

        this._emit('setup-started', {
            settings: this.gameSettings
        });

        if (this.debug) {
            console.log(' Classic setup started');
        }

        return {
            success: true,
            status: 'setup',
            settings: this.gameSettings
        };
    }

    /**
     * به‌روزرسانی تنظیمات بازی
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateSettings(newSettings) {
        if (this.status !== 'setup' && this.status !== 'idle') {
            return {
                success: false,
                error: 'INVALID_STATE',
                message: 'نمی‌توان تنظیمات را در این وضعیت تغییر داد'
            };
        }

        // اعتبارسنجی تنظیمات
        const validation = this._validateSettings(newSettings);
        if (!validation.valid) {
            return {
                success: false,
                error: 'INVALID_SETTINGS',
                message: validation.errors.join('، ')
            };
        }

        this.gameSettings = {
            ...this.gameSettings,
            ...newSettings
        };

        // ذخیره تنظیمات
        this._saveSettings();

        this._emit('settings-updated', {
            settings: this.gameSettings
        });

        if (this.debug) {
            console.log('⚙️ Settings updated');
        }

        return {
            success: true,
            settings: this.gameSettings
        };
    }

    /**
     * اعتبارسنجی تنظیمات
     * @param {Object} settings - تنظیمات
     * @returns {Object} نتیجه
     * @private
     */
    _validateSettings(settings) {
        const errors = [];

        if (settings.handsToWin !== undefined) {
            if (![7, 13].includes(settings.handsToWin)) {
                errors.push('تعداد دست برای برد باید 7 یا 13 باشد');
            }
        }

        if (settings.roundsToWin !== undefined) {
            if (settings.roundsToWin < 1 || settings.roundsToWin > 5) {
                errors.push('تعداد راند برای برد باید بین 1 تا 5 باشد');
            }
        }

        if (settings.aiLevel !== undefined) {
            const validLevels = ['beginner', 'easy', 'normal', 'hard', 'expert', 'master'];
            if (!validLevels.includes(settings.aiLevel)) {
                errors.push('سطح AI نامعتبر است');
            }
        }

        if (settings.timerDuration !== undefined) {
            if (settings.timerDuration < 10 || settings.timerDuration > 120) {
                errors.push('مدت تایمر باید بین 10 تا 120 ثانیه باشد');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * دریافت تنظیمات فعلی
     * @returns {Object}
     */
    getSettings() {
        return { ...this.gameSettings };
    }

    /**
     * ریست تنظیمات به پیش‌فرض
     * @returns {Object} نتیجه
     */
    resetSettings() {
        this.gameSettings = {
            handsToWin: 7,
            roundsToWin: 2,
            aiLevel: 'normal',
            allowKot: true,
            allowDoubleKot: false,
            timerEnabled: true,
            timerDuration: 30,
            chatEnabled: true,
            emotesEnabled: true,
            autoTrump: false,
            showLastTrick: true,
            soundEnabled: true,
            animationEnabled: true
        };

        this._saveSettings();

        this._emit('settings-reset', {
            settings: this.gameSettings
        });

        return {
            success: true,
            settings: this.gameSettings
        };
    }

    // ============================================================
    // بخش : انتخاب حریفان
    // ============================================================

    /**
     * اضافه کردن بازیکن AI
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    addAIPlayer(options = {}) {
        if (this.players.length >= 4) {
            return {
                success: false,
                error: 'ROOM_FULL',
                message: 'اتاق پر است (حداکثر 4 بازیکن)'
            };
        }

        const {
            level = this.gameSettings.aiLevel,
            name = null
        } = options;

        const aiPlayer = {
            id: `ai_${Utils.generateUUID()}`,
            username: name || `AI_${Utils.randomInt(1000, 9999)}`,
            isAI: true,
            aiLevel: level,
            rating: this._getAIRating(level),
            avatar: Utils.randomInt(1, 50),
            seat: this.players.length
        };

        this.players.push(aiPlayer);

        this._emit('ai-player-added', {
            player: aiPlayer,
            totalPlayers: this.players.length
        });

        if (this.debug) {
            console.log(`🤖 AI player added: ${aiPlayer.username} (${level})`);
        }

        return {
            success: true,
            player: aiPlayer
        };
    }

    /**
     * اضافه کردن دوست به بازی
     * @param {string} friendId - شناسه دوست
     * @returns {Object} نتیجه
     */
    addFriendPlayer(friendId) {
        if (this.players.length >= 4) {
            return {
                success: false,
                error: 'ROOM_FULL',
                message: 'اتاق پر است'
            };
        }

        // بررسی وجود دوست
        if (friendsManager) {
            const friend = friendsManager.getFriend(friendId);
            if (!friend) {
                return {
                    success: false,
                    error: 'FRIEND_NOT_FOUND',
                    message: 'دوست یافت نشد'
                };
            }

            if (!friend.isOnline) {
                return {
                    success: false,
                    error: 'FRIEND_OFFLINE',
                    message: 'دوست آفلاین است'
                };
            }
        }

        const friendPlayer = {
            id: friendId,
            username: `Friend_${friendId.substring(0, 6)}`,
            isAI: false,
            isFriend: true,
            rating: 1000,
            avatar: 1,
            seat: this.players.length,
            status: 'invited'
        };

        this.players.push(friendPlayer);

        // ارسال دعوت
        this._sendFriendInvitation(friendId);

        this._emit('friend-player-added', {
            player: friendPlayer,
            totalPlayers: this.players.length
        });

        if (this.debug) {
            console.log(`👥 Friend player added: ${friendPlayer.username}`);
        }

        return {
            success: true,
            player: friendPlayer
        };
    }

    /**
     * حذف بازیکن
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     */
    removePlayer(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);

        if (playerIndex === -1) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن یافت نشد'
            };
        }

        const removedPlayer = this.players[playerIndex];
        this.players.splice(playerIndex, 1);

        // به‌روزرسانی صندلی‌ها
        this.players.forEach((p, index) => {
            p.seat = index;
        });

        this._emit('player-removed', {
            player: removedPlayer,
            totalPlayers: this.players.length
        });

        if (this.debug) {
            console.log(` Player removed: ${removedPlayer.username}`);
        }

        return {
            success: true,
            player: removedPlayer
        };
    }

    /**
     * پر کردن خودکار با AI
     * @returns {Object} نتیجه
     */
    autoFillWithAI() {
        while (this.players.length < 4) {
            this.addAIPlayer({
                level: this.gameSettings.aiLevel
            });
        }

        this._emit('auto-filled', {
            totalPlayers: this.players.length
        });

        return {
            success: true,
            players: this.players
        };
    }

    /**
     * دریافت لیست بازیکنان
     * @returns {Array<Object>}
     */
    getPlayers() {
        return [...this.players];
    }

    /**
     * دریافت تعداد بازیکنان
     * @returns {number}
     */
    getPlayerCount() {
        return this.players.length;
    }

    // ============================================================
    // بخش ۳: Lobby
    // ============================================================

    /**
     * ورود به Lobby
     * @returns {Object} نتیجه
     */
    enterLobby() {
        if (this.status !== 'setup') {
            return {
                success: false,
                error: 'INVALID_STATE',
                message: 'ابتدا باید بازی را راه‌اندازی کنید'
            };
        }

        if (this.players.length < 4) {
            return {
                success: false,
                error: 'NOT_ENOUGH_PLAYERS',
                message: 'حداقل 4 بازیکن نیاز است'
            };
        }

        this.status = 'lobby';

        // تقسیم تیم‌ها
        this._assignTeams();

        this._emit('lobby-entered', {
            players: this.players,
            teams: this.teams,
            settings: this.gameSettings
        });

        if (this.debug) {
            console.log('🎴 Entered lobby');
        }

        return {
            success: true,
            status: 'lobby',
            players: this.players,
            teams: this.teams
        };
    }

    /**
     * تقسیم بازیکنان به تیم‌ها
     * @private
     */
    _assignTeams() {
        // تیم 1: بازیکن اصلی و بازیکن روبرو
        // تیم 2: دو بازیکن دیگر
        this.teams = {
            team1: [this.players[0], this.players[2]],
            team2: [this.players[1], this.players[3]]
        };

        // علامت‌گذاری تیم‌ها
        this.players.forEach((player, index) => {
            player.team = index % 2 === 0 ? 'team1' : 'team2';
        });
    }

    /**
     * تغییر تیم بازیکن (فقط در lobby)
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     */
    switchTeam(playerId) {
        if (this.status !== 'lobby') {
            return {
                success: false,
                error: 'NOT_IN_LOBBY',
                message: 'شما در Lobby نیستید'
            };
        }

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن یافت نشد'
            };
        }

        // نمی‌توان تیم بازیکن اصلی را تغییر داد
        if (playerIndex === 0) {
            return {
                success: false,
                error: 'CANNOT_SWITCH_HOST',
                message: 'نمی‌توان تیم میزبان را تغییر داد'
            };
        }

        // جابجایی با بازیکن روبرو
        const oppositeIndex = (playerIndex + 2) % 4;
        const temp = this.players[playerIndex];
        this.players[playerIndex] = this.players[oppositeIndex];
        this.players[oppositeIndex] = temp;

        // به‌روزرسانی صندلی‌ها
        this.players.forEach((p, index) => {
            p.seat = index;
            p.team = index % 2 === 0 ? 'team1' : 'team2';
        });

        // تقسیم مجدد تیم‌ها
        this._assignTeams();

        this._emit('teams-switched', {
            teams: this.teams
        });

        return {
            success: true,
            teams: this.teams
        };
    }

    /**
     * دریافت اطلاعات Lobby
     * @returns {Object}
     */
    getLobbyInfo() {
        return {
            status: this.status,
            players: this.players,
            teams: this.teams,
            settings: this.gameSettings,
            ready: this.players.length === 4
        };
    }

    /**
     * انصراف از Lobby
     * @returns {Object} نتیجه
     */
    leaveLobby() {
        if (this.status !== 'lobby') {
            return {
                success: false,
                error: 'NOT_IN_LOBBY',
                message: 'شما در Lobby نیستید'
            };
        }

        this._cleanup();

        this._emit('lobby-left');

        if (this.debug) {
            console.log('🚪 Left lobby');
        }

        return {
            success: true
        };
    }

    // ============================================================
    // بخش ۴: شروع بازی
    // ============================================================

    /**
     * شروع بازی
     * @returns {Object} نتیجه
     */
    startGame() {
        if (this.status !== 'lobby') {
            return {
                success: false,
                error: 'NOT_IN_LOBBY',
                message: 'شما در Lobby نیستید'
            };
        }

        if (this.players.length !== 4) {
            return {
                success: false,
                error: 'NOT_ENOUGH_PLAYERS',
                message: 'تعداد بازیکنان باید 4 باشد'
            };
        }

        this.status = 'playing';
        this.gameId = Utils.generateUUID();
        this.gameStartTime = Date.now();

        // راه‌اندازی HokmEngine
        if (hokmEngine) {
            const result = hokmEngine.startGame(this.players, {
                mode: 'classic',
                level: this.gameSettings.aiLevel,
                roundsToWin: this.gameSettings.roundsToWin,
                allowKot: this.gameSettings.allowKot,
                allowDoubleKot: this.gameSettings.allowDoubleKot
            });

            if (result.success) {
                this.gameState = hokmEngine.getGameState();

                // ثبت listener برای رویدادهای بازی
                this._setupGameListeners();

                // شروع تایمر مدت زمان
                this._startDurationTimer();

                this._emit('game-started', {
                    gameId: this.gameId,
                    players: this.players,
                    teams: this.teams,
                    settings: this.gameSettings
                });

                if (this.debug) {
                    console.log('🎮 Classic game started');
                }
            }

            return result;
        } else {
            // شبیه‌سازی بازی
            return this._simulateClassicGame();
        }
    }

    /**
     * شبیه‌سازی بازی کلاسیک
     * @returns {Object} نتیجه
     * @private
     */
    _simulateClassicGame() {
        const duration = Utils.randomInt(600000, 1200000); // 10-20 دقیقه

        setTimeout(() => {
            if (this.status === 'playing') {
                this._handleGameEnd({
                    winner: Math.random() > 0.5 ? 'team1' : 'team2',
                    score: {
                        team1: Utils.randomInt(7, 13),
                        team2: Utils.randomInt(7, 13)
                    },
                    rounds: Utils.randomInt(2, 4),
                    isKot: Math.random() > 0.9
                });
            }
        }, duration);

        return {
            success: true,
            gameId: this.gameId
        };
    }

    /**
     * ثبت listener های بازی
     * @private
     */
    _setupGameListeners() {
        if (!hokmEngine) return;

        hokmEngine.on('trump-selected', (data) => {
            this._emit('trump-selected', data);
        });

        hokmEngine.on('card-played', (data) => {
            this._emit('card-played', data);
        });

        hokmEngine.on('trick-won', (data) => {
            this._emit('trick-won', data);
        });

        hokmEngine.on('round-completed', (data) => {
            this._emit('round-completed', data);
        });

        hokmEngine.on('kot', (data) => {
            this.stats.kotCount++;
            this._emit('kot', data);
        });

        hokmEngine.on('match-completed', (data) => {
            this._handleGameEnd(data);
        });
    }

    // ============================================================
    // بخش ۵: Gameplay
    // ============================================================

    /**
     * بازی کردن کارت
     * @param {Object} card - کارت
     * @returns {Object} نتیجه
     */
    playCard(card) {
        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        if (!hokmEngine) {
            return {
                success: false,
                error: 'NO_ENGINE',
                message: 'موتور بازی در دسترس نیست'
            };
        }

        // اعتبارسنجی کارت
        if (validationEngine) {
            const playerIndex = this.players.findIndex(p => p.id === this.player.id);
            const player = hokmEngine.getPlayerInfo(playerIndex);
            const validation = validationEngine.validateCard(card, player?.hand || [], this.gameState);

            if (!validation.valid) {
                return validation;
            }
        }

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const result = hokmEngine.playCard(playerIndex, card);

        if (result.success) {
            this.gameState = hokmEngine.getGameState();

            this._emit('card-played', {
                card,
                playerIndex,
                playerName: this.player.username
            });

            if (this.debug) {
                console.log(`🃏 Card played: ${card.nameFa}`);
            }
        }

        return result;
    }

    /**
     * انتخاب حکم
     * @param {string} suit - خال
     * @returns {Object} نتیجه
     */
    selectTrump(suit) {
        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        if (!hokmEngine) {
            return {
                success: false,
                error: 'NO_ENGINE',
                message: 'موتور بازی در دسترس نیست'
            };
        }

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const result = hokmEngine.selectTrump(suit, playerIndex);

        if (result.success) {
            this.gameState = hokmEngine.getGameState();

            this._emit('trump-selected', {
                suit,
                playerIndex,
                playerName: this.player.username
            });

            if (this.debug) {
                console.log(`👑 Trump selected: ${suit}`);
            }
        }

        return result;
    }

    /**
     * دریافت وضعیت بازی
     * @returns {Object}
     */
    getGameState() {
        if (hokmEngine) {
            return hokmEngine.getGameState();
        }

        return this.gameState;
    }

    /**
     * دریافت کارت‌های بازیکن
     * @returns {Array<Object>}
     */
    getPlayerHand() {
        if (!hokmEngine) return [];

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const player = hokmEngine.getPlayerInfo(playerIndex);

        return player?.hand || [];
    }

    /**
     * دریافت کارت‌های قابل بازی
     * @returns {Array<Object>}
     */
    getPlayableCards() {
        if (!hokmEngine) return [];

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        return hokmEngine.getPlayableCards(playerIndex);
    }

    /**
     * بررسی آیا می‌توان کارت بازی کرد
     * @param {Object} card - کارت
     * @returns {Object} نتیجه
     */
    canPlayCard(card) {
        if (!hokmEngine) {
            return { valid: true };
        }

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        return hokmEngine.canPlayCard(playerIndex, card);
    }

    // ============================================================
    // بخش ۶: Pause و Resume
    // ============================================================

    /**
     * توقف بازی (Pause)
     * @returns {Object} نتیجه
     */
    pauseGame() {
        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        this.status = 'paused';

        // توقف تایمر مدت زمان
        this._stopDurationTimer();

        if (hokmEngine) {
            hokmEngine.pause();
        }

        this._emit('game-paused', {
            gameId: this.gameId
        });

        if (this.debug) {
            console.log('⏸️ Game paused');
        }

        return {
            success: true
        };
    }

    /**
     * ادامه بازی (Resume)
     * @returns {Object} نتیجه
     */
    resumeGame() {
        if (this.status !== 'paused') {
            return {
                success: false,
                error: 'GAME_NOT_PAUSED',
                message: 'بازی متوقف نشده است'
            };
        }

        this.status = 'playing';

        // شروع مجدد تایمر
        this._startDurationTimer();

        if (hokmEngine) {
            hokmEngine.resume();
        }

        this._emit('game-resumed', {
            gameId: this.gameId
        });

        if (this.debug) {
            console.log('▶️ Game resumed');
        }

        return {
            success: true
        };
    }

    // ============================================================
    // بخش ۷: ذخیره و بارگذاری بازی
    // ============================================================

    /**
     * ذخیره بازی
     * @returns {Object} نتیجه
     */
    saveGame() {
        if (this.status !== 'playing' && this.status !== 'paused') {
            return {
                success: false,
                error: 'INVALID_STATE',
                message: 'بازی در وضعیت مناسب برای ذخیره نیست'
            };
        }

        const gameState = this.getGameState();
        if (!gameState) {
            return {
                success: false,
                error: 'NO_GAME_STATE',
                message: 'وضعیت بازی در دسترس نیست'
            };
        }

        this.savedGame = {
            gameId: this.gameId,
            timestamp: Date.now(),
            players: this.players,
            teams: this.teams,
            settings: this.gameSettings,
            gameState,
            gameDuration: this.gameDuration,
            version: CONFIG.APP.VERSION
        };

        // ذخیره در storage
        if (storage) {
            storage.set('classic_saved_game', this.savedGame);
        }

        this.stats.savedGames++;

        this._emit('game-saved', {
            gameId: this.gameId,
            timestamp: this.savedGame.timestamp
        });

        if (this.debug) {
            console.log('💾 Game saved');
        }

        return {
            success: true,
            savedGame: this.savedGame
        };
    }

    /**
     * بارگذاری بازی ذخیره شده
     * @returns {Object} نتیجه
     */
    loadSavedGame() {
        if (this.status !== 'idle') {
            return {
                success: false,
                error: 'GAME_IN_PROGRESS',
                message: 'یک بازی در حال انجام است'
            };
        }

        // بارگذاری از storage
        let savedGame = null;
        if (storage) {
            savedGame = storage.get('classic_saved_game');
        }

        if (!savedGame) {
            return {
                success: false,
                error: 'NO_SAVED_GAME',
                message: 'بازی ذخیره شده‌ای وجود ندارد'
            };
        }

        // بررسی نسخه
        if (savedGame.version !== CONFIG.APP.VERSION) {
            return {
                success: false,
                error: 'VERSION_MISMATCH',
                message: 'نسخه بازی ذخیره شده با نسخه فعلی مطابقت ندارد'
            };
        }

        // بازیابی وضعیت
        this.gameId = savedGame.gameId;
        this.players = savedGame.players;
        this.teams = savedGame.teams;
        this.gameSettings = savedGame.settings;
        this.gameState = savedGame.gameState;
        this.gameDuration = savedGame.gameDuration || 0;

        this.status = 'paused';

        this._emit('game-loaded', {
            gameId: this.gameId,
            savedAt: savedGame.timestamp
        });

        if (this.debug) {
            console.log('📂 Game loaded');
        }

        return {
            success: true,
            savedGame
        };
    }

    /**
     * بررسی آیا بازی ذخیره شده وجود دارد
     * @returns {boolean}
     */
    hasSavedGame() {
        if (!storage) return false;
        return storage.has('classic_saved_game');
    }

    /**
     * حذف بازی ذخیره شده
     * @returns {Object} نتیجه
     */
    deleteSavedGame() {
        if (storage) {
            storage.remove('classic_saved_game');
        }

        this.savedGame = null;

        this._emit('saved-game-deleted');

        return {
            success: true
        };
    }

    // ============================================================
    // بخش : پایان بازی
    // ============================================================

    /**
     * مدیریت پایان بازی
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _handleGameEnd(result) {
        this.status = 'finished';
        this.gameResult = result;

        // محاسبه مدت زمان بازی
        if (this.gameStartTime) {
            this.gameDuration = Math.floor((Date.now() - this.gameStartTime) / 1000);
        }

        // توقف تایمر
        this._stopDurationTimer();

        // محاسبه پاداش
        this._calculateReward(result);

        // به‌روزرسانی آمار
        this._updateStats(result);

        // حذف بازی ذخیره شده
        this.deleteSavedGame();

        this._emit('game-ended', {
            result,
            reward: this.reward,
            duration: this.gameDuration
        });

        if (this.debug) {
            console.log('🏁 Classic game ended');
        }
    }

    /**
     * محاسبه پاداش
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _calculateReward(result) {
        if (!scoringEngine) {
            this.reward = {
                coins: 150,
                xp: 75
            };
            return;
        }

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;

        const gameResult = {
            mode: 'classic',
            level: this.gameSettings.aiLevel,
            isWinner: team === result.winner,
            tricksWon: result.score?.[team] || 0,
            totalTricks: 26,
            isKot: result.isKot || false,
            isDoubleKot: result.isDoubleKot || false,
            roundDuration: this.gameDuration
        };

        const playerProfile = this.player?.profile || {};

        this.reward = scoringEngine.calculateFullReward(gameResult, playerProfile);

        if (this.debug) {
            console.log(' Reward calculated:', this.reward);
        }
    }

    /**
     * به‌روزرسانی آمار
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _updateStats(result) {
        this.stats.totalGames++;
        this.stats.completedGames++;

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;
        const isWinner = team === result.winner;

        if (isWinner) {
            this.stats.wins++;
        } else if (result.winner === 'draw') {
            this.stats.draws++;
        } else {
            this.stats.losses++;
        }

        this.stats.winRate = (this.stats.wins / this.stats.totalGames) * 100;

        // به‌روزرسانی میانگین مدت زمان
        this.stats.averageGameDuration = 
            ((this.stats.averageGameDuration * (this.stats.completedGames - 1)) + this.gameDuration) / 
            this.stats.completedGames;

        if (this.reward) {
            this.stats.totalCoinsEarned += this.reward.coins || 0;
            this.stats.totalXpEarned += this.reward.xp || 0;
        }

        // بررسی بازی کامل (همه دست‌ها)
        if (result.score?.[team] === 26) {
            this.stats.perfectGames++;
        }
    }

    // ============================================================
    // بخش : دریافت پاداش
    // ============================================================

    /**
     * دریافت پاداش بازی
     * @returns {Object} نتیجه
     */
    claimReward() {
        if (this.status !== 'finished') {
            return {
                success: false,
                error: 'GAME_NOT_FINISHED',
                message: 'بازی تمام نشده است'
            };
        }

        if (!this.reward) {
            return {
                success: false,
                error: 'NO_REWARD',
                message: 'پاداشی وجود ندارد'
            };
        }

        // به‌روزرسانی پروفایل بازیکن
        this._applyRewardToProfile();

        this.status = 'reward';

        this._emit('reward-claimed', {
            reward: this.reward
        });

        if (this.debug) {
            console.log('💰 Reward claimed');
        }

        return {
            success: true,
            reward: this.reward
        };
    }

    /**
     * اعمال پاداش به پروفایل
     * @private
     */
    _applyRewardToProfile() {
        if (!this.reward || !this.player) return;

        if (this.player.profile) {
            this.player.profile.coins = (this.player.profile.coins || 0) + (this.reward.coins || 0);
            this.player.profile.xp = (this.player.profile.xp || 0) + (this.reward.xp || 0);

            if (this.player.profile.stats) {
                this.player.profile.stats.totalGames++;
                const playerIndex = this.players.findIndex(p => p.id === this.player.id);
                const team = this.players[playerIndex]?.team;
                if (this.gameResult?.winner === team) {
                    this.player.profile.stats.wins++;
                } else {
                    this.player.profile.stats.losses++;
                }
            }

            if (storage) {
                storage.saveUserProfile(this.player);
            }
        }
    }

    /**
     * دریافت اطلاعات پاداش
     * @returns {Object}
     */
    getRewardInfo() {
        return {
            reward: this.reward,
            gameResult: this.gameResult,
            duration: this.gameDuration,
            canClaim: this.status === 'finished' && this.reward !== null
        };
    }

    // ============================================================
    // بخش ۱۰: بازگشت و بازی مجدد
    // ============================================================

    /**
     * بازگشت به صفحه اصلی
     * @returns {Object} نتیجه
     */
    returnToHome() {
        this._cleanup();

        this._emit('returned-to-home');

        if (this.debug) {
            console.log('🏠 Returned to home');
        }

        return {
            success: true
        };
    }

    /**
     * بازی مجدد با همان تنظیمات
     * @returns {Object} نتیجه
     */
    playAgain() {
        const settings = { ...this.gameSettings };
        this._cleanup();

        this.startSetup(settings);
        this.autoFillWithAI();
        this.enterLobby();

        return this.startGame();
    }

    /**
     * بازی مجدد با تنظیمات جدید
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    playAgainWithSettings(newSettings) {
        this._cleanup();

        this.startSetup(newSettings);
        this.autoFillWithAI();
        this.enterLobby();

        return this.startGame();
    }

    // ============================================================
    // بخش ۱: پاکسازی
    // ============================================================

    /**
     * پاکسازی کامل
     * @private
     */
    _cleanup() {
        this.status = 'idle';
        this.gameId = null;
        this.roomId = null;
        this.players = [];
        this.teams = { team1: [], team2: [] };
        this.gameState = null;
        this.gameResult = null;
        this.reward = null;
        this.gameStartTime = null;
        this.gameDuration = 0;

        // توقف تایمر
        this._stopDurationTimer();

        // پاک کردن listener های بازی
        if (hokmEngine) {
            hokmEngine.clearListeners();
        }

        if (this.debug) {
            console.log('🧹 ClassicPlayMode cleaned up');
        }
    }

    /**
     * ریست کامل
     */
    reset() {
        this._cleanup();

        this.stats = {
            totalGames: 0,
            completedGames: 0,
            savedGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            averageGameDuration: 0,
            totalCoinsEarned: 0,
            totalXpEarned: 0,
            kotCount: 0,
            perfectGames: 0
        };

        if (this.debug) {
            console.log('🔄 ClassicPlayMode reset');
        }
    }

    // ============================================================
    // بخش ۱۲: توابع کمکی
    // ============================================================

    /**
     * دریافت رتبه AI بر اساس سطح
     * @param {string} level - سطح
     * @returns {number} رتبه
     * @private
     */
    _getAIRating(level) {
        const ratings = {
            beginner: 600,
            easy: 800,
            normal: 1000,
            hard: 1300,
            expert: 1600,
            master: 2000
        };
        return ratings[level] || 1000;
    }

    /**
     * ذخیره تنظیمات
     * @private
     */
    _saveSettings() {
        if (storage) {
            storage.set('classic_settings', this.gameSettings);
        }
    }

    /**
     * بارگذاری تنظیمات ذخیره شده
     * @private
     */
    _loadSavedSettings() {
        if (storage) {
            const saved = storage.get('classic_settings');
            if (saved) {
                this.gameSettings = { ...this.gameSettings, ...saved };
            }
        }
    }

    /**
     * ارسال دعوت به دوست
     * @param {string} friendId - شناسه دوست
     * @private
     */
    _sendFriendInvitation(friendId) {
        // در production از WebSocket استفاده می‌شود
        if (this.debug) {
            console.log(`📩 Invitation sent to friend: ${friendId}`);
        }
    }

    /**
     * شروع تایمر مدت زمان
     * @private
     */
    _startDurationTimer() {
        this._stopDurationTimer();

        this.durationTimer = setInterval(() => {
            if (this.gameStartTime) {
                this.gameDuration = Math.floor((Date.now() - this.gameStartTime) / 1000);
            }
        }, 1000);
    }

    /**
     * توقف تایمر مدت زمان
     * @private
     */
    _stopDurationTimer() {
        if (this.durationTimer) {
            clearInterval(this.durationTimer);
            this.durationTimer = null;
        }
    }

    /**
     * فرمت مدت زمان بازی
     * @returns {string}
     */
    getFormattedDuration() {
        const minutes = Math.floor(this.gameDuration / 60);
        const seconds = this.gameDuration % 60;

        if (minutes > 0) {
            return `${Utils.toPersianNumber(minutes)} دقیقه و ${Utils.toPersianNumber(seconds)} ثانیه`;
        }

        return `${Utils.toPersianNumber(seconds)} ثانیه`;
    }

    // ============================================================
    // بخش ۱۳: دریافت اطلاعات
    // ============================================================

    /**
     * دریافت وضعیت فعلی
     * @returns {Object}
     */
    getStatus() {
        return {
            status: this.status,
            gameId: this.gameId,
            roomId: this.roomId,
            player: this.player,
            players: this.players,
            teams: this.teams,
            settings: this.gameSettings,
            gameState: this.gameState,
            gameResult: this.gameResult,
            reward: this.reward,
            duration: this.gameDuration
        };
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const status = this.getStatus();
        const stats = this.getStats();

        console.log('🎴 ClassicPlayMode Status:');
        console.log('  Status:', status.status);
        console.log('  Game ID:', status.gameId || 'None');
        console.log('  Players:', status.players.length);
        console.log('  Duration:', this.getFormattedDuration());
        console.log('  Total Games:', stats.totalGames);
        console.log('  Completed:', stats.completedGames);
        console.log('  Wins:', stats.wins);
        console.log('  Losses:', stats.losses);
        console.log('  Draws:', stats.draws);
        console.log('  Win Rate:', stats.winRate.toFixed(1) + '%');
        console.log('  Saved Games:', stats.savedGames);
        console.log('  Kot Count:', stats.kotCount);
        console.log('  Perfect Games:', stats.perfectGames);
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
                    console.error(` ClassicPlay event listener error:`, error);
                }
            });
        }

        eventBus.emit(`classic-play:${event}`, data);
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
const classicPlayMode = new ClassicPlayMode();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ClassicPlayMode, classicPlayMode };
} else {
    window.ClassicPlayMode = ClassicPlayMode;
    window.classicPlayMode = classicPlayMode;
}

console.log('✅ ClassicPlayMode loaded');
