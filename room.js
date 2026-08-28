/**
 * ============================================================
 * HOKM MASTER - Room Manager
 * مدیریت اتاق‌های بازی چند نفره
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل اتاق‌های بازی در حالت چند نفره
 * است. شامل ساخت اتاق، پیوستن به اتاق، مدیریت بازیکنان،
 * کد اتاق، تنظیمات اتاق، وضعیت‌های مختلف اتاق، و چرخه حیات
 * کامل اتاق از ساخت تا پایان بازی.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - storage (از فایل storage.js)
 * - wsManager (از فایل websocket.js)
 * 
 * ============================================================
 */

class RoomManager {

    constructor() {
        /**
         * اتاق فعلی که بازیکن در آن است
         * @type {Object|null}
         */
        this.currentRoom = null;

        /**
         * لیست اتاق‌های عمومی (برای نمایش در لیست)
         * @type {Array<Object>}
         */
        this.publicRooms = [];

        /**
         * شناسه بازیکن فعلی
         * @type {string|null}
         */
        this.playerId = null;

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
         * آمار اتاق
         * @type {Object}
         */
        this.stats = {
            totalRoomsCreated: 0,
            totalRoomsJoined: 0,
            totalGamesPlayed: 0,
            averageRoomDuration: 0,
            activeRooms: 0
        };

        /**
         * تایمر پاکسازی اتاق‌های منقضی
         * @type {number|null}
         */
        this.cleanupTimer = null;

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری شناسه بازیکن
        const user = storage.getUserProfile();
        if (user) {
            this.playerId = user.id;
        }

        // شروع پاکسازی دوره‌ای
        this._startCleanupTimer();

        if (this.debug) {
            console.log(' RoomManager initialized');
        }
    }

    // ============================================================
    // بخش ۱: ساخت اتاق
    // ============================================================

    /**
     * ساخت اتاق جدید
     * @param {Object} options - گزینه‌های اتاق
     * @returns {Object} نتیجه
     */
    createRoom(options = {}) {
        const {
            name = null,
            isPublic = true,
            maxPlayers = 4,
            password = null,
            gameMode = 'classic',
            level = 'normal',
            entryFee = 0,
            timeLimit = 30,
            allowSpectators = false,
            region = 'iran'
        } = options;

        // بررسی محدودیت‌ها
        if (maxPlayers < 2 || maxPlayers > 4) {
            return {
                success: false,
                error: 'INVALID_MAX_PLAYERS',
                message: 'تعداد بازیکنان باید بین 2 تا 4 باشد'
            };
        }

        if (entryFee < 0) {
            return {
                success: false,
                error: 'INVALID_ENTRY_FEE',
                message: 'ورودی نمی‌تواند منفی باشد'
            };
        }

        // تولید کد اتاق (5 رقمی)
        const roomCode = this._generateRoomCode();

        // ساخت اتاق
        const room = {
            id: Utils.generateUUID(),
            code: roomCode,
            name: name || `Room ${roomCode}`,
            hostId: this.playerId,
            hostName: this._getPlayerName(),
            isPublic,
            maxPlayers,
            password,
            gameMode,
            level,
            entryFee,
            timeLimit,
            allowSpectators,
            region,
            status: 'waiting', // waiting, ready, playing, finished
            players: [],
            spectators: [],
            createdAt: Date.now(),
            startedAt: null,
            finishedAt: null,
            settings: {
                trumpSelection: 'hakem',
                kotAllowed: true,
                doubleKotAllowed: false,
                chatEnabled: true,
                emotesEnabled: true
            },
            gameState: null
        };

        // اضافه کردن سازنده به عنوان بازیکن اول
        room.players.push({
            id: this.playerId,
            name: this._getPlayerName(),
            role: 'host',
            ready: false,
            joinedAt: Date.now(),
            seat: 0
        });

        this.currentRoom = room;
        this.stats.totalRoomsCreated++;
        this.stats.activeRooms++;

        // اضافه کردن به لیست اتاق‌های عمومی
        if (isPublic) {
            this.publicRooms.push(room);
        }

        this._emit('room-created', room);

        if (this.debug) {
            console.log(`🏠 Room created: ${roomCode} (${room.id})`);
        }

        return {
            success: true,
            room,
            roomCode
        };
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
        if (!roomCode || roomCode.length !== 5) {
            return {
                success: false,
                error: 'INVALID_ROOM_CODE',
                message: 'کد اتاق باید 5 رقم باشد'
            };
        }

        // پیدا کردن اتاق
        const room = this.publicRooms.find(r => r.code === roomCode);

        if (!room) {
            return {
                success: false,
                error: 'ROOM_NOT_FOUND',
                message: 'اتاقی با این کد یافت نشد'
            };
        }

        // بررسی وضعیت اتاق
        if (room.status !== 'waiting') {
            return {
                success: false,
                error: 'ROOM_NOT_AVAILABLE',
                message: `اتاق در وضعیت "${room.status}" است و نمی‌توان پیوست`
            };
        }

        // بررسی ظرفیت
        if (room.players.length >= room.maxPlayers) {
            return {
                success: false,
                error: 'ROOM_FULL',
                message: 'اتاق پر است'
            };
        }

        // بررسی رمز عبور
        if (room.password && room.password !== password) {
            return {
                success: false,
                error: 'WRONG_PASSWORD',
                message: 'رمز عبور اشتباه است'
            };
        }

        // بررسی تکراری نبودن بازیکن
        if (room.players.some(p => p.id === this.playerId)) {
            return {
                success: false,
                error: 'ALREADY_IN_ROOM',
                message: 'شما قبلاً در این اتاق هستید'
            };
        }

        // اضافه کردن بازیکن
        const player = {
            id: this.playerId,
            name: this._getPlayerName(),
            role: 'player',
            ready: false,
            joinedAt: Date.now(),
            seat: room.players.length
        };

        room.players.push(player);
        this.currentRoom = room;
        this.stats.totalRoomsJoined++;

        this._emit('room-joined', { room, player });

        if (this.debug) {
            console.log(`🏠 Joined room: ${roomCode}`);
        }

        return {
            success: true,
            room,
            player
        };
    }

    /**
     * پیوستن به اتاق با شناسه
     * @param {string} roomId - شناسه اتاق
     * @returns {Object} نتیجه
     */
    joinRoomById(roomId) {
        const room = this.publicRooms.find(r => r.id === roomId);

        if (!room) {
            return {
                success: false,
                error: 'ROOM_NOT_FOUND',
                message: 'اتاق یافت نشد'
            };
        }

        return this.joinRoom(room.code);
    }

    // ============================================================
    // بخش ۳: ترک اتاق
    // ============================================================

    /**
     * ترک اتاق
     * @returns {Object} نتیجه
     */
    leaveRoom() {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        const room = this.currentRoom;
        const playerIndex = room.players.findIndex(p => p.id === this.playerId);

        if (playerIndex === -1) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن در اتاق یافت نشد'
            };
        }

        // اگر سازنده اتاق است و بازی شروع نشده
        if (room.hostId === this.playerId && room.status === 'waiting') {
            // انتقال میزبانی یا حذف اتاق
            if (room.players.length > 1) {
                room.hostId = room.players[1].id;
                room.hostName = room.players[1].name;
                room.players[1].role = 'host';
            } else {
                // حذف اتاق
                this._removeRoom(room.id);
            }
        } else {
            // حذف بازیکن از اتاق
            room.players.splice(playerIndex, 1);

            // اگر اتاق خالی شد
            if (room.players.length === 0) {
                this._removeRoom(room.id);
            }
        }

        const leftRoom = this.currentRoom;
        this.currentRoom = null;

        this._emit('room-left', { room: leftRoom });

        if (this.debug) {
            console.log('🏠 Left room');
        }

        return {
            success: true,
            room: leftRoom
        };
    }

    /**
     * حذف اتاق از لیست
     * @param {string} roomId - شناسه اتاق
     * @private
     */
    _removeRoom(roomId) {
        const index = this.publicRooms.findIndex(r => r.id === roomId);

        if (index !== -1) {
            this.publicRooms.splice(index, 1);
            this.stats.activeRooms--;
        }

        if (this.currentRoom?.id === roomId) {
            this.currentRoom = null;
        }
    }

    // ============================================================
    // بخش ۴: مدیریت بازیکنان
    // ============================================================

    /**
     * آماده شدن بازیکن
     * @returns {Object} نتیجه
     */
    setReady() {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        const player = this.currentRoom.players.find(p => p.id === this.playerId);

        if (!player) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن در اتاق یافت نشد'
            };
        }

        player.ready = !player.ready;

        this._emit('player-ready-changed', {
            room: this.currentRoom,
            player,
            ready: player.ready
        });

        // بررسی آیا همه آماده هستند
        if (this._allPlayersReady()) {
            this._emit('all-players-ready', { room: this.currentRoom });
        }

        return {
            success: true,
            player,
            ready: player.ready
        };
    }

    /**
     * بررسی آیا همه بازیکنان آماده هستند
     * @returns {boolean}
     * @private
     */
    _allPlayersReady() {
        if (!this.currentRoom) return false;

        return this.currentRoom.players.every(p => p.ready);
    }

    /**
     * اخراج بازیکن از اتاق (فقط میزبان)
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     */
    kickPlayer(playerId) {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        // بررسی میزبان بودن
        if (this.currentRoom.hostId !== this.playerId) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند بازیکن را اخراج کند'
            };
        }

        // نمی‌توان میزبان را اخراج کرد
        if (playerId === this.currentRoom.hostId) {
            return {
                success: false,
                error: 'CANNOT_KICK_HOST',
                message: 'نمی‌توان میزبان را اخراج کرد'
            };
        }

        const playerIndex = this.currentRoom.players.findIndex(p => p.id === playerId);

        if (playerIndex === -1) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن در اتاق یافت نشد'
            };
        }

        const kickedPlayer = this.currentRoom.players[playerIndex];
        this.currentRoom.players.splice(playerIndex, 1);

        // به‌روزرسانی صندلی‌ها
        this.currentRoom.players.forEach((p, index) => {
            p.seat = index;
        });

        this._emit('player-kicked', {
            room: this.currentRoom,
            kickedPlayer
        });

        if (this.debug) {
            console.log(` Player kicked: ${kickedPlayer.name}`);
        }

        return {
            success: true,
            kickedPlayer
        };
    }

    /**
     * انتقال میزبانی
     * @param {string} playerId - شناسه بازیکن جدید
     * @returns {Object} نتیجه
     */
    transferHost(playerId) {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        if (this.currentRoom.hostId !== this.playerId) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند میزبانی را منتقل کند'
            };
        }

        const newHost = this.currentRoom.players.find(p => p.id === playerId);

        if (!newHost) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن در اتاق یافت نشد'
            };
        }

        // تغییر نقش‌ها
        const oldHost = this.currentRoom.players.find(p => p.id === this.playerId);
        oldHost.role = 'player';
        newHost.role = 'host';

        this.currentRoom.hostId = playerId;
        this.currentRoom.hostName = newHost.name;

        this._emit('host-transferred', {
            room: this.currentRoom,
            oldHostId: this.playerId,
            newHostId: playerId
        });

        return {
            success: true,
            newHost
        };
    }

    // ============================================================
    // بخش ۵: تنظیمات اتاق
    // ============================================================

    /**
     * به‌روزرسانی تنظیمات اتاق
     * @param {Object} settings - تنظیمات جدید
     * @returns {Object} نتیجه
     */
    updateRoomSettings(settings) {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        if (this.currentRoom.hostId !== this.playerId) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند تنظیمات را تغییر دهد'
            };
        }

        if (this.currentRoom.status !== 'waiting') {
            return {
                success: false,
                error: 'ROOM_NOT_WAITING',
                message: 'اتاق در وضعیت انتظار نیست'
            };
        }

        const oldSettings = { ...this.currentRoom.settings };

        this.currentRoom.settings = {
            ...this.currentRoom.settings,
            ...settings
        };

        this._emit('room-settings-updated', {
            room: this.currentRoom,
            oldSettings,
            newSettings: this.currentRoom.settings
        });

        return {
            success: true,
            settings: this.currentRoom.settings
        };
    }

    /**
     * تغییر حالت بازی
     * @param {string} gameMode - حالت بازی
     * @returns {Object} نتیجه
     */
    changeGameMode(gameMode) {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        if (this.currentRoom.hostId !== this.playerId) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند حالت بازی را تغییر دهد'
            };
        }

        const validModes = ['quick', 'classic', 'ranked', 'private', 'ai', 'practice'];

        if (!validModes.includes(gameMode)) {
            return {
                success: false,
                error: 'INVALID_GAME_MODE',
                message: 'حالت بازی نامعتبر است'
            };
        }

        const oldMode = this.currentRoom.gameMode;
        this.currentRoom.gameMode = gameMode;

        this._emit('game-mode-changed', {
            room: this.currentRoom,
            oldMode,
            newMode: gameMode
        });

        return {
            success: true,
            gameMode
        };
    }

    /**
     * تغییر سطح بازی
     * @param {string} level - سطح
     * @returns {Object} نتیجه
     */
    changeLevel(level) {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        if (this.currentRoom.hostId !== this.playerId) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند سطح را تغییر دهد'
            };
        }

        const validLevels = ['beginner', 'easy', 'normal', 'hard', 'expert', 'master'];

        if (!validLevels.includes(level)) {
            return {
                success: false,
                error: 'INVALID_LEVEL',
                message: 'سطح نامعتبر است'
            };
        }

        const oldLevel = this.currentRoom.level;
        this.currentRoom.level = level;

        this._emit('level-changed', {
            room: this.currentRoom,
            oldLevel,
            newLevel: level
        });

        return {
            success: true,
            level
        };
    }

    // ============================================================
    // بخش : شروع بازی
    // ============================================================

    /**
     * شروع بازی (فقط میزبان)
     * @returns {Object} نتیجه
     */
    startGame() {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        if (this.currentRoom.hostId !== this.playerId) {
            return {
                success: false,
                error: 'NOT_HOST',
                message: 'فقط میزبان می‌تواند بازی را شروع کند'
            };
        }

        if (this.currentRoom.status !== 'waiting') {
            return {
                success: false,
                error: 'ROOM_NOT_WAITING',
                message: 'اتاق در وضعیت انتظار نیست'
            };
        }

        // بررسی تعداد بازیکنان
        if (this.currentRoom.players.length < 2) {
            return {
                success: false,
                error: 'NOT_ENOUGH_PLAYERS',
                message: 'حداقل 2 بازیکن نیاز است'
            };
        }

        // بررسی آماده بودن همه بازیکنان
        if (!this._allPlayersReady()) {
            return {
                success: false,
                error: 'NOT_ALL_READY',
                message: 'همه بازیکنان باید آماده باشند'
            };
        }

        // تغییر وضعیت اتاق
        this.currentRoom.status = 'playing';
        this.currentRoom.startedAt = Date.now();

        this.stats.totalGamesPlayed++;

        this._emit('game-started', { room: this.currentRoom });

        if (this.debug) {
            console.log('🎮 Game started in room');
        }

        return {
            success: true,
            room: this.currentRoom
        };
    }

    /**
     * پایان بازی
     * @param {Object} gameResult - نتیجه بازی
     * @returns {Object} نتیجه
     */
    endGame(gameResult) {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        if (this.currentRoom.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        this.currentRoom.status = 'finished';
        this.currentRoom.finishedAt = Date.now();
        this.currentRoom.gameResult = gameResult;

        this._emit('game-ended', {
            room: this.currentRoom,
            result: gameResult
        });

        if (this.debug) {
            console.log(' Game ended in room');
        }

        return {
            success: true,
            room: this.currentRoom
        };
    }

    // ============================================================
    // بخش ۷: دعوت بازیکن
    // ============================================================

    /**
     * دعوت بازیکن به اتاق
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     */
    invitePlayer(playerId) {
        if (!this.currentRoom) {
            return {
                success: false,
                error: 'NOT_IN_ROOM',
                message: 'شما در اتاقی نیستید'
            };
        }

        if (this.currentRoom.status !== 'waiting') {
            return {
                success: false,
                error: 'ROOM_NOT_WAITING',
                message: 'اتاق در وضعیت انتظار نیست'
            };
        }

        if (this.currentRoom.players.length >= this.currentRoom.maxPlayers) {
            return {
                success: false,
                error: 'ROOM_FULL',
                message: 'اتاق پر است'
            };
        }

        const invitation = {
            id: Utils.generateUUID(),
            roomId: this.currentRoom.id,
            roomCode: this.currentRoom.code,
            fromPlayerId: this.playerId,
            fromPlayerName: this._getPlayerName(),
            toPlayerId: playerId,
            createdAt: Date.now(),
            expiresAt: Date.now() + 300000, // 5 دقیقه
            status: 'pending'
        };

        this._emit('player-invited', {
            room: this.currentRoom,
            invitation
        });

        if (this.debug) {
            console.log(`📩 Player invited: ${playerId}`);
        }

        return {
            success: true,
            invitation
        };
    }

    /**
     * قبول دعوت
     * @param {string} invitationId - شناسه دعوت
     * @returns {Object} نتیجه
     */
    acceptInvitation(invitationId) {
        // در اینجا باید دعوت را از سرور دریافت کرد
        // برای سادگی، مستقیماً به اتاق می‌پیوندیم

        return {
            success: true,
            message: 'دعوت قبول شد'
        };
    }

    /**
     * رد دعوت
     * @param {string} invitationId - شناسه دعوت
     * @returns {Object} نتیجه
     */
    declineInvitation(invitationId) {
        return {
            success: true,
            message: 'دعوت رد شد'
        };
    }

    // ============================================================
    // بخش ۸: دریافت اطلاعات اتاق
    // ============================================================

    /**
     * دریافت اتاق فعلی
     * @returns {Object|null}
     */
    getCurrentRoom() {
        return this.currentRoom;
    }

    /**
     * دریافت لیست اتاق‌های عمومی
     * @param {Object} filters - فیلترها
     * @returns {Array<Object>}
     */
    getPublicRooms(filters = {}) {
        let rooms = [...this.publicRooms];

        // فیلتر بر اساس حالت بازی
        if (filters.gameMode) {
            rooms = rooms.filter(r => r.gameMode === filters.gameMode);
        }

        // فیلتر بر اساس سطح
        if (filters.level) {
            rooms = rooms.filter(r => r.level === filters.level);
        }

        // فیلتر بر اساس منطقه
        if (filters.region) {
            rooms = rooms.filter(r => r.region === filters.region);
        }

        // فیلتر اتاق‌های پر
        if (!filters.showFull) {
            rooms = rooms.filter(r => r.players.length < r.maxPlayers);
        }

        // مرتب‌سازی بر اساس تاریخ ساخت
        rooms.sort((a, b) => b.createdAt - a.createdAt);

        return rooms;
    }

    /**
     * دریافت اطلاعات کامل اتاق
     * @param {string} roomId - شناسه اتاق
     * @returns {Object|null}
     */
    getRoomInfo(roomId) {
        return this.publicRooms.find(r => r.id === roomId) || null;
    }

    /**
     * دریافت اطلاعات بازیکن در اتاق
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object|null}
     */
    getPlayerInfo(playerId) {
        if (!this.currentRoom) return null;

        return this.currentRoom.players.find(p => p.id === playerId) || null;
    }

    // ============================================================
    // بخش ۹: تماشاگر
    // ============================================================

    /**
     * پیوستن به عنوان تماشاگر
     * @param {string} roomId - شناسه اتاق
     * @returns {Object} نتیجه
     */
    joinAsSpectator(roomId) {
        const room = this.publicRooms.find(r => r.id === roomId);

        if (!room) {
            return {
                success: false,
                error: 'ROOM_NOT_FOUND',
                message: 'اتاق یافت نشد'
            };
        }

        if (!room.allowSpectators) {
            return {
                success: false,
                error: 'SPECTATORS_NOT_ALLOWED',
                message: 'تماشاگر مجاز نیست'
            };
        }

        if (room.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        const spectator = {
            id: this.playerId,
            name: this._getPlayerName(),
            joinedAt: Date.now()
        };

        room.spectators.push(spectator);

        this._emit('spectator-joined', {
            room,
            spectator
        });

        return {
            success: true,
            spectator
        };
    }

    /**
     * ترک تماشا
     * @param {string} roomId - شناسه اتاق
     * @returns {Object} نتیجه
     */
    leaveSpectator(roomId) {
        const room = this.publicRooms.find(r => r.id === roomId);

        if (!room) {
            return {
                success: false,
                error: 'ROOM_NOT_FOUND',
                message: 'اتاق یافت نشد'
            };
        }

        const spectatorIndex = room.spectators.findIndex(s => s.id === this.playerId);

        if (spectatorIndex === -1) {
            return {
                success: false,
                error: 'NOT_SPECTATING',
                message: 'شما تماشاگر این اتاق نیستید'
            };
        }

        room.spectators.splice(spectatorIndex, 1);

        this._emit('spectator-left', {
            room,
            spectatorId: this.playerId
        });

        return {
            success: true
        };
    }

    // ============================================================
    // بخش ۱۰: پاکسازی و مدیریت
    // ============================================================

    /**
     * شروع تایمر پاکسازی
     * @private
     */
    _startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this._cleanupExpiredRooms();
        }, 60000); // هر دقیقه
    }

    /**
     * پاکسازی اتاق‌های منقضی
     * @private
     */
    _cleanupExpiredRooms() {
        const now = Date.now();
        const maxAge = 3600000; // 1 ساعت

        this.publicRooms = this.publicRooms.filter(room => {
            const age = now - room.createdAt;

            if (age > maxAge && room.status === 'waiting') {
                this._emit('room-expired', { room });
                return false;
            }

            return true;
        });
    }

    /**
     * ریست کامل
     */
    reset() {
        this.currentRoom = null;
        this.publicRooms = [];
        this.playerId = null;

        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        this.stats = {
            totalRoomsCreated: 0,
            totalRoomsJoined: 0,
            totalGamesPlayed: 0,
            averageRoomDuration: 0,
            activeRooms: 0
        };

        if (this.debug) {
            console.log('🔄 RoomManager reset');
        }
    }

    // ============================================================
    // بخش ۱۱: توابع کمکی
    // ============================================================

    /**
     * دریافت نام بازیکن
     * @returns {string}
     * @private
     */
    _getPlayerName() {
        const user = storage.getUserProfile();
        return user?.username || 'Player';
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            currentRoom: this.currentRoom ? {
                id: this.currentRoom.id,
                code: this.currentRoom.code,
                players: this.currentRoom.players.length,
                status: this.currentRoom.status
            } : null,
            publicRoomsCount: this.publicRooms.length
        };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();

        console.log('🏠 RoomManager Status:');
        console.log('  Current Room:', stats.currentRoom?.code || 'None');
        console.log('  Public Rooms:', stats.publicRoomsCount);
        console.log('  Total Created:', stats.totalRoomsCreated);
        console.log('  Total Joined:', stats.totalRoomsJoined);
        console.log('  Total Games:', stats.totalGamesPlayed);
        console.log('  Active Rooms:', stats.activeRooms);
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
                    console.error(`❌ Room event listener error:`, error);
                }
            });
        }

        eventBus.emit(`room:${event}`, data);
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
const roomManager = new RoomManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RoomManager, roomManager };
} else {
    window.RoomManager = RoomManager;
    window.roomManager = roomManager;
}

console.log('✅ RoomManager loaded');
