/**
 * ============================================================
 * HOKM MASTER - Private Room Mode
 * حالت بازی اتاق خصوصی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل حالت بازی خصوصی است. شامل
 * ساخت اتاق خصوصی، پیوستن با کد، مدیریت بازیکنان، تنظیمات
 * اتاق، سیستم دعوت، کنترل‌های میزبان، و gameplay خصوصی
 * بدون تأثیر بر Rating.
 * 
 * تفاوت‌های Private با Ranked:
 * - بدون تغییر Rating
 * - امکان انتخاب حریفان
 * - تنظیمات کامل اتاق
 * - کد دعوت 5 رقمی
 * - کنترل‌های میزبان
 * - بدون محدودیت روزانه
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
 * - friendsManager (از فایل friends.js)
 * 
 * ============================================================
 */

class PrivateRoomMode {

    constructor() {
        /**
         * وضعیت فعلی حالت بازی
         * @type {string} 'idle' | 'creating' | 'lobby' | 'playing' | 'finished' | 'reward'
         */
        this.status = 'idle';

        /**
         * شناسه اتاق فعلی
         * @type {string|null}
         */
        this.roomId = null;

        /**
         * کد اتاق فعلی
         * @type {string|null}
         */
        this.roomCode = null;

        /**
         * آیا میزبان هستیم
         * @type {boolean}
         */
        this.isHost = false;

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
         * تنظیمات اتاق
         * @type {Object}
         */
        this.roomSettings = {
            maxPlayers: 4,
            isPublic: false,
            password: null,
            gameMode: 'classic',
            aiLevel: 'normal',
            handsToWin: 7,
            roundsToWin: 2,
            allowKot: true,
            allowDoubleKot: false,
            timerEnabled: true,
            timerDuration: 30,
            chatEnabled: true,
            emotesEnabled: true,
            allowSpectators: false,
            entryFee: 0
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
         * لیست دعوت‌های ارسالی
         * @type {Array<Object>}
         */
        this.sentInvitations = [];

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
         * آمار بازی خصوصی
         * @type {Object}
         */
        this.stats = {
            totalRoomsCreated: 0,
            totalRoomsJoined: 0,
            totalGamesPlayed: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            averageGameDuration: 0,
            totalCoinsEarned: 0,
            friendsInvited: 0
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

        // بارگذاری آمار
        this._loadStats();

        if (this.debug) {
            console.log('🏠 PrivateRoomMode initialized');
        }
    }

    // ============================================================
    // بخش ۱: ساخت اتاق خصوصی
    // ============================================================

    /**
     * ساخت اتاق خصوصی جدید
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    createRoom(options = {}) {
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
                message: 'برای ساخت اتاق باید وارد شوید'
            };
        }

        this.status = 'creating';

        const {
            maxPlayers = 4,
            isPublic = false,
            password = null,
            gameMode = 'classic',
            aiLevel = 'normal',
            handsToWin = 7,
            roundsToWin = 2,
            allowKot = true,
            allowDoubleKot = false,
            timerEnabled = true,
            timerDuration = 30,
            chatEnabled = true,
            emotesEnabled = true,
            allowSpectators = false,
            entryFee = 0
        } = options;

        // ذخیره تنظیمات
        this.roomSettings = {
            maxPlayers,
            isPublic,
            password,
            gameMode,
            aiLevel,
            handsToWin,
            roundsToWin,
            allowKot,
            allowDoubleKot,
            timerEnabled,
            timerDuration,
            chatEnabled,
            emotesEnabled,
            allowSpectators,
            entryFee
        };

        // ساخت اتاق از طریق roomManager
        if (roomManager) {
            const result = roomManager.createRoom({
                name: `${this.player.username}'s Room`,
                isPublic,
                maxPlayers,
                password,
                gameMode,
                level: aiLevel,
                entryFee,
                allowSpectators
            });

            if (result.success) {
                this.roomId = result.room.id;
                this.roomCode = result.roomCode;
                this.isHost = true;
                this.players = [this.player];

                this.stats.totalRoomsCreated++;

                this._emit('room-created', {
                    roomId: this.roomId,
                    roomCode: this.roomCode,
                    settings: this.roomSettings
                });

                if (this.debug) {
                    console.log(`🏠 Room created: ${this.roomCode}`);
                }

                return {
                    success: true,
                    roomId: this.roomId,
                    roomCode: this.roomCode,
                    settings: this.roomSettings
                };
            } else {
                this.status = 'idle';
                return result;
            }
        } else {
            // شبیه‌سازی بدون roomManager
            this.roomId = Utils.generateUUID();
            this.roomCode = this._generateRoomCode();
            this.isHost = true;
            this.players = [this.player];

            this.stats.totalRoomsCreated++;

            this._emit('room-created', {
                roomId: this.roomId,
                roomCode: this.roomCode,
                settings: this.roomSettings
            });

            return {
                success: true,
                roomId: this.roomId,
                roomCode: this.roomCode,
                settings: this.roomSettings
            };
        }
    }

    /**
     * تولید کد اتاق 5 رقمی
     * @returns {string}
     * @private
     */
    _generateRoomCode() {
        const digits = '0123456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += digits.charAt(Math.floor(Math.random() * digits.length));
        }
        return code;
    }

    // ============================================================
    // بخش ۲: پیوستن به اتاق
    // ============================================================

    /**
     * پیوستن به اتاق با کد
     * @param {string} roomCode - کد اتاق
     * @param {string} password - رمز عبور (اختیاری)
     * @returns {Object} نتیجه
     */
    joinRoom(roomCode, password = null) {
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
                message: 'برای پیوستن باید وارد شوید'
            };
        }

        if (!roomCode || roomCode.length !== 5) {
            return {
                success: false,
                error: 'INVALID_CODE',
                message: 'کد اتاق باید 5 رقم باشد'
            };
        }

        this.status = 'lobby';

        // پیوستن از طریق roomManager
        if (roomManager) {
            const result = roomManager.joinRoom(roomCode, password);

            if (result.success) {
                this.roomId = result.room.id;
                this.roomCode = roomCode;
                this.isHost = false;
                this.players = result.room.players;
                this.roomSettings = result.room.settings || this.roomSettings;

                this.stats.totalRoomsJoined++;

                this._emit('room-joined', {
                    roomId: this.roomId,
                    roomCode,
                    players: this.players
                });

                if (this.debug) {
                    console.log(` Joined room: ${roomCode}`);
                }

                return {
                    success: true,
                    roomId: this.roomId,
                    roomCode,
                    players: this.players
                };
            } else {
                this.status = 'idle';
                return result;
            }
        } else {
            // شبیه‌سازی
            this.roomId = Utils.generateUUID();
            this.roomCode = roomCode;
            this.isHost = false;
            this.players = [this.player];

            this.stats.totalRoomsJoined++;

            return {
                success: true,
                roomId: this.roomId,
                roomCode,
                players: this.players
            };
        }
    }

    /**
     * ترک اتاق
     * @returns {Object} نتیجه
     */
    leaveRoom() {
        if (this.status === 'idle') {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        if (this.status === 'playing') {
            return {
                success: false,
                error: 'GAME_IN_PROGRESS',
                message: 'نمی‌توانید در حین بازی اتاق را ترک کنید'
            };
        }

        // ترک از طریق roomManager
        if (roomManager) {
            roomManager.leaveRoom();
        }

        this._cleanup();

        this._emit('room-left', {
            roomCode: this.roomCode
        });

        if (this.debug) {
            console.log('🚪 Left room');
        }

        return {
            success: true
        };
    }

    // ============================================================
    // بخش ۳: مدیریت بازیکنان
    // ============================================================

    /**
     * اضافه کردن بازیکن AI
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    addAIPlayer(options = {}) {
        if (!this.isHost) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند AI اضافه کند'
            };
        }

        if (this.players.length >= this.roomSettings.maxPlayers) {
            return {
                success: false,
                error: 'ROOM_FULL',
                message: 'اتاق پر است'
            };
        }

        const {
            level = this.roomSettings.aiLevel,
            name = null
        } = options;

        const aiPlayer = {
            id: `ai_${Utils.generateUUID()}`,
            username: name || `AI_${Utils.randomInt(1000, 9999)}`,
            isAI: true,
            aiLevel: level,
            rating: 1000,
            avatar: Utils.randomInt(1, 50),
            seat: this.players.length,
            ready: true
        };

        this.players.push(aiPlayer);

        this._emit('ai-player-added', {
            player: aiPlayer,
            totalPlayers: this.players.length
        });

        if (this.debug) {
            console.log(` AI added: ${aiPlayer.username}`);
        }

        return {
            success: true,
            player: aiPlayer
        };
    }

    /**
     * حذف بازیکن (فقط میزبان)
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     */
    removePlayer(playerId) {
        if (!this.isHost) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند بازیکن را حذف کند'
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
            console.log(`👤 Player removed: ${removedPlayer.username}`);
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
        if (!this.isHost) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند این کار را انجام دهد'
            };
        }

        while (this.players.length < this.roomSettings.maxPlayers) {
            this.addAIPlayer({
                level: this.roomSettings.aiLevel
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
     * آماده شدن بازیکن
     * @returns {Object} نتیجه
     */
    setReady() {
        const player = this.players.find(p => p.id === this.player.id);

        if (!player) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن در اتاق یافت نشد'
            };
        }

        player.ready = !player.ready;

        this._emit('player-ready-changed', {
            player,
            ready: player.ready
        });

        // بررسی آیا همه آماده هستند
        if (this._allPlayersReady()) {
            this._emit('all-players-ready', {
                players: this.players
            });
        }

        return {
            success: true,
            ready: player.ready
        };
    }

    /**
     * بررسی آیا همه بازیکنان آماده هستند
     * @returns {boolean}
     * @private
     */
    _allPlayersReady() {
        return this.players.length >= 2 && this.players.every(p => p.ready);
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
    // بخش ۴: تنظیمات اتاق
    // ============================================================

    /**
     * به‌روزرسانی تنظیمات اتاق
     * @param {Object} newSettings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateRoomSettings(newSettings) {
        if (!this.isHost) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند تنظیمات را تغییر دهد'
            };
        }

        if (this.status === 'playing') {
            return {
                success: false,
                error: 'GAME_IN_PROGRESS',
                message: 'نمی‌توان در حین بازی تنظیمات را تغییر داد'
            };
        }

        // اعتبارسنجی
        const validation = this._validateSettings(newSettings);
        if (!validation.valid) {
            return {
                success: false,
                error: 'INVALID_SETTINGS',
                message: validation.errors.join('، ')
            };
        }

        const oldSettings = { ...this.roomSettings };

        this.roomSettings = {
            ...this.roomSettings,
            ...newSettings
        };

        this._emit('settings-updated', {
            oldSettings,
            newSettings: this.roomSettings
        });

        if (this.debug) {
            console.log('⚙️ Room settings updated');
        }

        return {
            success: true,
            settings: this.roomSettings
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

        if (settings.maxPlayers !== undefined) {
            if (![2, 4].includes(settings.maxPlayers)) {
                errors.push('تعداد بازیکنان باید 2 یا 4 باشد');
            }
        }

        if (settings.handsToWin !== undefined) {
            if (![7, 13].includes(settings.handsToWin)) {
                errors.push('تعداد دست برای برد باید 7 یا 13 باشد');
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
     * دریافت تنظیمات اتاق
     * @returns {Object}
     */
    getRoomSettings() {
        return { ...this.roomSettings };
    }

    // ============================================================
    // بخش ۵: سیستم دعوت
    // ============================================================

    /**
     * دعوت دوست به اتاق
     * @param {string} friendId - شناسه دوست
     * @returns {Object} نتیجه
     */
    inviteFriend(friendId) {
        if (!this.isHost) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند دعوت ارسال کند'
            };
        }

        if (this.players.length >= this.roomSettings.maxPlayers) {
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

        // ایجاد دعوت
        const invitation = {
            id: Utils.generateUUID(),
            roomId: this.roomId,
            roomCode: this.roomCode,
            fromPlayerId: this.player.id,
            fromPlayerName: this.player.username,
            toPlayerId: friendId,
            createdAt: Date.now(),
            expiresAt: Date.now() + 300000, // 5 دقیقه
            status: 'pending'
        };

        this.sentInvitations.push(invitation);
        this.stats.friendsInvited++;

        // ارسال دعوت (در production از WebSocket)
        this._sendInvitation(invitation);

        this._emit('friend-invited', {
            invitation,
            friendId
        });

        if (this.debug) {
            console.log(`📩 Invitation sent to: ${friendId}`);
        }

        return {
            success: true,
            invitation
        };
    }

    /**
     * ارسال دعوت
     * @param {Object} invitation - دعوت
     * @private
     */
    _sendInvitation(invitation) {
        // در production از WebSocket استفاده می‌شود
        if (wsManager && wsManager.isConnected) {
            wsManager.send('room_invite', invitation);
        }

        if (this.debug) {
            console.log('📩 Invitation sent via WebSocket');
        }
    }

    /**
     * کپی کردن کد اتاق
     * @returns {Object} نتیجه
     */
    copyRoomCode() {
        if (!this.roomCode) {
            return {
                success: false,
                error: 'NO_ROOM_CODE',
                message: 'کد اتاق وجود ندارد'
            };
        }

        if (Utils.copyToClipboard) {
            const result = Utils.copyToClipboard(this.roomCode);
            return {
                success: true,
                code: this.roomCode,
                copied: result
            };
        }

        return {
            success: true,
            code: this.roomCode,
            copied: false
        };
    }

    /**
     * اشتراک‌گذاری کد اتاق
     * @returns {Object} نتیجه
     */
    shareRoomCode() {
        if (!this.roomCode) {
            return {
                success: false,
                error: 'NO_ROOM_CODE',
                message: 'کد اتاق وجود ندارد'
            };
        }

        const shareText = `بیا حکم بازی کنیم! کد اتاق: ${this.roomCode}`;

        if (navigator.share) {
            navigator.share({
                title: 'حکم مستر',
                text: shareText,
                url: window.location.href
            });
        }

        this._emit('room-code-shared', {
            code: this.roomCode
        });

        return {
            success: true,
            code: this.roomCode
        };
    }

    // ============================================================
    // بخش ۶: شروع بازی
    // ============================================================

    /**
     * شروع بازی
     * @returns {Object} نتیجه
     */
    startGame() {
        if (!this.isHost) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند بازی را شروع کند'
            };
        }

        if (this.players.length < 2) {
            return {
                success: false,
                error: 'NOT_ENOUGH_PLAYERS',
                message: 'حداقل 2 بازیکن نیاز است'
            };
        }

        if (this.players.length !== this.roomSettings.maxPlayers) {
            return {
                success: false,
                error: 'ROOM_NOT_FULL',
                message: `اتاق باید ${this.roomSettings.maxPlayers} بازیکن داشته باشد`
            };
        }

        this.status = 'playing';
        this.gameId = Utils.generateUUID();
        this.gameStartTime = Date.now();

        // تقسیم تیم‌ها
        this._assignTeams();

        // راه‌اندازی HokmEngine
        if (hokmEngine) {
            const result = hokmEngine.startGame(this.players, {
                mode: 'private',
                level: this.roomSettings.aiLevel,
                roundsToWin: this.roomSettings.roundsToWin,
                allowKot: this.roomSettings.allowKot,
                allowDoubleKot: this.roomSettings.allowDoubleKot
            });

            if (result.success) {
                this.gameState = hokmEngine.getGameState();
                this._setupGameListeners();
                this._startDurationTimer();

                this._emit('game-started', {
                    gameId: this.gameId,
                    players: this.players,
                    teams: this.teams,
                    settings: this.roomSettings
                });

                if (this.debug) {
                    console.log('🎮 Private game started');
                }
            }

            return result;
        } else {
            return this._simulatePrivateGame();
        }
    }

    /**
     * تقسیم تیم‌ها
     * @private
     */
    _assignTeams() {
        if (this.players.length === 4) {
            this.teams = {
                team1: [this.players[0], this.players[2]],
                team2: [this.players[1], this.players[3]]
            };
        } else if (this.players.length === 2) {
            this.teams = {
                team1: [this.players[0]],
                team2: [this.players[1]]
            };
        }

        this.players.forEach((player, index) => {
            player.team = index % 2 === 0 ? 'team1' : 'team2';
        });
    }

    /**
     * شبیه‌سازی بازی خصوصی
     * @returns {Object} نتیجه
     * @private
     */
    _simulatePrivateGame() {
        const duration = Utils.randomInt(300000, 600000);

        setTimeout(() => {
            if (this.status === 'playing') {
                this._handleGameEnd({
                    winner: Math.random() > 0.5 ? 'team1' : 'team2',
                    score: {
                        team1: Utils.randomInt(7, 13),
                        team2: Utils.randomInt(7, 13)
                    },
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
            this._emit('kot', data);
        });

        hokmEngine.on('match-completed', (data) => {
            this._handleGameEnd(data);
        });
    }

    // ============================================================
    // بخش ۷: Gameplay
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

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const result = hokmEngine.playCard(playerIndex, card);

        if (result.success) {
            this.gameState = hokmEngine.getGameState();

            this._emit('card-played', {
                card,
                playerIndex
            });
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
                playerIndex
            });
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

    // ============================================================
    // بخش ۸: پایان بازی
    // ============================================================

    /**
     * مدیریت پایان بازی
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _handleGameEnd(result) {
        this.status = 'finished';
        this.gameResult = result;

        if (this.gameStartTime) {
            this.gameDuration = Math.floor((Date.now() - this.gameStartTime) / 1000);
        }

        this._stopDurationTimer();

        // محاسبه پاداش (بدون Rating change)
        this._calculateReward(result);

        // به‌روزرسانی آمار
        this._updateStats(result);

        // ذخیره آمار
        this._saveStats();

        this._emit('game-ended', {
            result,
            reward: this.reward,
            duration: this.gameDuration
        });

        if (this.debug) {
            console.log('🏁 Private game ended');
        }
    }

    /**
     * محاسبه پاداش
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _calculateReward(result) {
        // در بازی خصوصی، فقط سکه و XP (بدون Rating)
        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;
        const isWinner = team === result.winner;

        this.reward = {
            coins: isWinner ? 100 : 25,
            xp: isWinner ? 50 : 10,
            ratingChange: 0, // بدون تغییر Rating
            isWinner
        };

        if (this.debug) {
            console.log('💰 Private reward calculated:', this.reward);
        }
    }

    /**
     * به‌روزرسانی آمار
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _updateStats(result) {
        this.stats.totalGamesPlayed++;

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;
        const isWinner = team === result.winner;

        if (isWinner) {
            this.stats.wins++;
        } else {
            this.stats.losses++;
        }

        this.stats.winRate = (this.stats.wins / this.stats.totalGamesPlayed) * 100;

        // به‌روزرسانی میانگین مدت زمان
        this.stats.averageGameDuration =
            ((this.stats.averageGameDuration * (this.stats.totalGamesPlayed - 1)) + this.gameDuration) /
            this.stats.totalGamesPlayed;

        if (this.reward) {
            this.stats.totalCoinsEarned += this.reward.coins || 0;
        }
    }

    // ============================================================
    // بخش ۹: دریافت پاداش
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
            console.log('💰 Private reward claimed');
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
    // بخش ۰: بازگشت و بازی مجدد
    // ============================================================

    /**
     * بازگشت به صفحه اصلی
     * @returns {Object} نتیجه
     */
    returnToHome() {
        this._cleanup();

        this._emit('returned-to-home');

        if (this.debug) {
            console.log('🏠 Returned to home from Private');
        }

        return {
            success: true
        };
    }

    /**
     * بازی مجدد در همان اتاق
     * @returns {Object} نتیجه
     */
    playAgain() {
        if (!this.isHost) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند بازی مجدد را شروع کند'
            };
        }

        this.status = 'lobby';
        this.gameResult = null;
        this.reward = null;
        this.gameState = null;
        this.gameDuration = 0;

        // ریست آماده بودن بازیکنان
        this.players.forEach(p => {
            p.ready = false;
        });

        this._emit('play-again', {
            players: this.players
        });

        return {
            success: true,
            status: 'lobby'
        };
    }

    /**
     * دعوت بازیکن جدید برای بازی بعدی
     * @param {string} friendId - شناسه دوست
     * @returns {Object} نتیجه
     */
    inviteForNextGame(friendId) {
        return this.inviteFriend(friendId);
    }

    // ============================================================
    // بخش ۱۱: پاکسازی
    // ============================================================

    /**
     * پاکسازی کامل
     * @private
     */
    _cleanup() {
        this.status = 'idle';
        this.roomId = null;
        this.roomCode = null;
        this.isHost = false;
        this.players = [];
        this.teams = { team1: [], team2: [] };
        this.gameState = null;
        this.gameResult = null;
        this.reward = null;
        this.gameStartTime = null;
        this.gameDuration = 0;
        this.sentInvitations = [];

        this._stopDurationTimer();

        if (hokmEngine) {
            hokmEngine.clearListeners();
        }

        if (roomManager) {
            roomManager.leaveRoom();
        }

        if (this.debug) {
            console.log('🧹 PrivateRoomMode cleaned up');
        }
    }

    /**
     * ریست کامل
     */
    reset() {
        this._cleanup();

        this.stats = {
            totalRoomsCreated: 0,
            totalRoomsJoined: 0,
            totalGamesPlayed: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            averageGameDuration: 0,
            totalCoinsEarned: 0,
            friendsInvited: 0
        };

        if (this.debug) {
            console.log(' PrivateRoomMode reset');
        }
    }

    // ============================================================
    // بخش ۱۲: توابع کمکی
    // ============================================================

    /**
     * ذخیره آمار
     * @private
     */
    _saveStats() {
        if (storage) {
            storage.set('private_stats', this.stats);
        }
    }

    /**
     * بارگذاری آمار
     * @private
     */
    _loadStats() {
        if (storage) {
            const saved = storage.get('private_stats');
            if (saved) {
                this.stats = { ...this.stats, ...saved };
            }
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

    /**
     * دریافت وضعیت فعلی
     * @returns {Object}
     */
    getStatus() {
        return {
            status: this.status,
            roomId: this.roomId,
            roomCode: this.roomCode,
            isHost: this.isHost,
            player: this.player,
            players: this.players,
            teams: this.teams,
            settings: this.roomSettings,
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

        console.log('🏠 PrivateRoomMode Status:');
        console.log('  Status:', status.status);
        console.log('  Room Code:', status.roomCode || 'None');
        console.log('  Is Host:', status.isHost);
        console.log('  Players:', status.players.length);
        console.log('  Total Rooms Created:', stats.totalRoomsCreated);
        console.log('  Total Games:', stats.totalGamesPlayed);
        console.log('  Wins:', stats.wins);
        console.log('  Losses:', stats.losses);
        console.log('  Win Rate:', stats.winRate.toFixed(1) + '%');
        console.log('  Friends Invited:', stats.friendsInvited);
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
                    console.error(`❌ PrivateRoom event listener error:`, error);
                }
            });
        }

        eventBus.emit(`private-room:${event}`, data);
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
const privateRoomMode = new PrivateRoomMode();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PrivateRoomMode, privateRoomMode };
} else {
    window.PrivateRoomMode = PrivateRoomMode;
    window.privateRoomMode = privateRoomMode;
}

console.log('✅ PrivateRoomMode loaded');
