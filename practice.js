/**
 * ============================================================
 * HOKM MASTER - Practice Mode
 * حالت بازی تمرینی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل حالت بازی تمرینی است. شامل
 * بازی بدون محدودیت، امکان تمرین سناریوهای مختلف، آموزش
 * قوانین، تمرین با AI در سطوح مختلف، آنالیز بازی، و آمار
 * پیشرفت. در این حالت هیچ پاداش یا Rating تغییری نمی‌کند.
 * 
 * تفاوت‌های Practice با سایر حالت‌ها:
 * - بدون پاداش (سکه، XP، Rating)
 * - بدون محدودیت زمانی
 * - امکان undo/redo حرکت
 * - امکان مشاهده کارت‌های حریف
 * - امکان تمرین سناریوهای خاص
 * - آنالیز کامل بازی
 * - آموزش قوانین
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
 * - hokmEngine (از فایل engine.js)
 * - cardEngine (از فایل cards.js)
 * - aiEngine (از فایل ai.js)
 * - rulesEngine (از فایل rules.js)
 * - validationEngine (از فایل validation.js)
 * 
 * ============================================================
 */

class PracticeMode {

    constructor() {
        /**
         * وضعیت فعلی حالت بازی
         * @type {string} 'idle' | 'setup' | 'playing' | 'paused' | 'analysis' | 'finished'
         */
        this.status = 'idle';

        /**
         * شناسه بازی فعلی
         * @type {string|null}
         */
        this.gameId = null;

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
         * تنظیمات تمرین
         * @type {Object}
         */
        this.practiceSettings = {
            aiLevel: 'normal',
            aiCount: 3,
            showOpponentCards: false,
            showProbabilities: false,
            unlimitedTime: true,
            allowUndo: true,
            allowHint: true,
            allowRestart: true,
            autoPlayAI: true,
            soundEnabled: true,
            animationEnabled: true,
            tutorialMode: false,
            scenarioMode: null
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
         * تاریخچه حرکات (برای undo/redo)
         * @type {Array<Object>}
         */
        this.moveHistory = [];

        /**
         * ایندکس فعلی در تاریخچه
         * @type {number}
         */
        this.currentMoveIndex = -1;

        /**
         * حداکثر تاریخچه
         * @type {number}
         */
        this.maxMoveHistory = 200;

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
         * آمار تمرین
         * @type {Object}
         */
        this.practiceStats = {
            totalGames: 0,
            completedGames: 0,
            totalMoves: 0,
            correctMoves: 0,
            wrongMoves: 0,
            hintsUsed: 0,
            undosUsed: 0,
            averageGameDuration: 0,
            scenariosCompleted: 0,
            tutorialsCompleted: 0
        };

        /**
         * سناریوهای تمرینی
         * @type {Array<Object>}
         */
        this.scenarios = this._initScenarios();

        /**
         * آموزش‌های موجود
         * @type {Array<Object>}
         */
        this.tutorials = this._initTutorials();

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
            console.log('🎓 PracticeMode initialized');
        }
    }

    // ============================================================
    // بخش ۱: راه‌اندازی تمرین
    // ============================================================

    /**
     * شروع تمرین آزاد
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    startFreePractice(options = {}) {
        if (this.status !== 'idle') {
            return {
                success: false,
                error: 'PRACTICE_IN_PROGRESS',
                message: 'یک تمرین در حال انجام است'
            };
        }

        if (!this.player) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای تمرین باید وارد شوید'
            };
        }

        const {
            aiLevel = 'normal',
            aiCount = 3,
            showOpponentCards = false,
            showProbabilities = false,
            unlimitedTime = true,
            allowUndo = true,
            allowHint = true
        } = options;

        this.practiceSettings = {
            ...this.practiceSettings,
            aiLevel,
            aiCount,
            showOpponentCards,
            showProbabilities,
            unlimitedTime,
            allowUndo,
            allowHint,
            tutorialMode: false,
            scenarioMode: null
        };

        this.status = 'setup';

        // ایجاد بازیکنان AI
        this.players = this._createAIPlayers(aiCount, aiLevel);

        // اضافه کردن بازیکن اصلی
        this.players.unshift({
            ...this.player,
            isAI: false,
            seat: 0
        });

        this._assignTeams();

        this._emit('practice-setup', {
            settings: this.practiceSettings,
            players: this.players
        });

        if (this.debug) {
            console.log('🎓 Free practice setup started');
        }

        return {
            success: true,
            status: 'setup',
            settings: this.practiceSettings,
            players: this.players
        };
    }

    /**
     * شروع تمرین با سناریو
     * @param {string} scenarioId - شناسه سناریو
     * @returns {Object} نتیجه
     */
    startScenarioPractice(scenarioId) {
        if (this.status !== 'idle') {
            return {
                success: false,
                error: 'PRACTICE_IN_PROGRESS',
                message: 'یک تمرین در حال انجام است'
            };
        }

        const scenario = this.scenarios.find(s => s.id === scenarioId);
        if (!scenario) {
            return {
                success: false,
                error: 'SCENARIO_NOT_FOUND',
                message: 'سناریو یافت نشد'
            };
        }

        this.practiceSettings = {
            ...this.practiceSettings,
            scenarioMode: scenarioId,
            aiLevel: scenario.aiLevel || 'normal',
            allowUndo: true,
            allowHint: true,
            showOpponentCards: scenario.showCards || false
        };

        this.status = 'setup';

        // بارگذاری سناریو
        this._loadScenario(scenario);

        this._emit('scenario-started', {
            scenario,
            settings: this.practiceSettings
        });

        if (this.debug) {
            console.log(`🎯 Scenario started: ${scenario.name}`);
        }

        return {
            success: true,
            scenario,
            settings: this.practiceSettings
        };
    }

    /**
     * شروع آموزش
     * @param {string} tutorialId - شناسه آموزش
     * @returns {Object} نتیجه
     */
    startTutorial(tutorialId) {
        if (this.status !== 'idle') {
            return {
                success: false,
                error: 'PRACTICE_IN_PROGRESS',
                message: 'یک تمرین در حال انجام است'
            };
        }

        const tutorial = this.tutorials.find(t => t.id === tutorialId);
        if (!tutorial) {
            return {
                success: false,
                error: 'TUTORIAL_NOT_FOUND',
                message: 'آموزش یافت نشد'
            };
        }

        this.practiceSettings = {
            ...this.practiceSettings,
            tutorialMode: true,
            aiLevel: 'beginner',
            allowUndo: true,
            allowHint: true,
            showOpponentCards: true,
            showProbabilities: true,
            unlimitedTime: true
        };

        this.status = 'setup';

        this._loadTutorial(tutorial);

        this._emit('tutorial-started', {
            tutorial,
            settings: this.practiceSettings
        });

        if (this.debug) {
            console.log(`📚 Tutorial started: ${tutorial.title}`);
        }

        return {
            success: true,
            tutorial,
            settings: this.practiceSettings
        };
    }

    /**
     * ایجاد بازیکنان AI
     * @param {number} count - تعداد
     * @param {string} level - سطح
     * @returns {Array<Object>}
     * @private
     */
    _createAIPlayers(count, level) {
        const players = [];

        for (let i = 0; i < count; i++) {
            players.push({
                id: `ai_practice_${Utils.generateUUID()}`,
                username: `AI_${Utils.randomInt(1000, 9999)}`,
                isAI: true,
                aiLevel: level,
                rating: 1000,
                avatar: Utils.randomInt(1, 50),
                seat: i + 1
            });
        }

        return players;
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
     * بارگذاری سناریو
     * @param {Object} scenario - سناریو
     * @private
     */
    _loadScenario(scenario) {
        // در production، سناریو از سرور بارگذاری می‌شود
        // اینجا یک سناریوی نمونه ایجاد می‌کنیم

        this.players = scenario.players || this._createAIPlayers(3, scenario.aiLevel || 'normal');
        this.players.unshift({
            ...this.player,
            isAI: false,
            seat: 0
        });

        this._assignTeams();

        if (this.debug) {
            console.log(` Scenario loaded: ${scenario.name}`);
        }
    }

    /**
     * بارگذاری آموزش
     * @param {Object} tutorial - آموزش
     * @private
     */
    _loadTutorial(tutorial) {
        this.players = this._createAIPlayers(3, 'beginner');
        this.players.unshift({
            ...this.player,
            isAI: false,
            seat: 0
        });

        this._assignTeams();

        if (this.debug) {
            console.log(`📚 Tutorial loaded: ${tutorial.title}`);
        }
    }

    // ============================================================
    // بخش ۲: شروع بازی
    // ============================================================

    /**
     * شروع بازی تمرینی
     * @returns {Object} نتیجه
     */
    startGame() {
        if (this.status !== 'setup') {
            return {
                success: false,
                error: 'NOT_IN_SETUP',
                message: 'ابتدا باید تمرین را راه‌اندازی کنید'
            };
        }

        this.status = 'playing';
        this.gameId = Utils.generateUUID();
        this.gameStartTime = Date.now();
        this.moveHistory = [];
        this.currentMoveIndex = -1;

        // راه‌اندازی HokmEngine
        if (hokmEngine) {
            const result = hokmEngine.startGame(this.players, {
                mode: 'practice',
                level: this.practiceSettings.aiLevel,
                roundsToWin: 2
            });

            if (result.success) {
                this.gameState = hokmEngine.getGameState();
                this._setupGameListeners();
                this._startDurationTimer();

                // ثبت وضعیت اولیه در تاریخچه
                this._saveMoveToHistory('game_start', this.gameState);

                this._emit('practice-game-started', {
                    gameId: this.gameId,
                    players: this.players,
                    settings: this.practiceSettings
                });

                if (this.debug) {
                    console.log('🎮 Practice game started');
                }
            }

            return result;
        } else {
            return this._simulatePracticeGame();
        }
    }

    /**
     * شبیه‌سازی بازی تمرینی
     * @returns {Object} نتیجه
     * @private
     */
    _simulatePracticeGame() {
        const duration = Utils.randomInt(300000, 600000);

        setTimeout(() => {
            if (this.status === 'playing') {
                this._handleGameEnd({
                    winner: Math.random() > 0.5 ? 'team1' : 'team2',
                    score: {
                        team1: Utils.randomInt(7, 13),
                        team2: Utils.randomInt(7, 13)
                    }
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
            this._saveMoveToHistory('trump_selected', { ...data });
            this._emit('trump-selected', data);
        });

        hokmEngine.on('card-played', (data) => {
            this._saveMoveToHistory('card_played', { ...data });
            this.practiceStats.totalMoves++;
            this._emit('card-played', data);
        });

        hokmEngine.on('trick-won', (data) => {
            this._saveMoveToHistory('trick_won', { ...data });
            this._emit('trick-won', data);
        });

        hokmEngine.on('round-completed', (data) => {
            this._saveMoveToHistory('round_completed', { ...data });
            this._emit('round-completed', data);
        });

        hokmEngine.on('match-completed', (data) => {
            this._handleGameEnd(data);
        });
    }

    // ============================================================
    // بخش ۳: Gameplay با امکانات تمرینی
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

            // بررسی صحت حرکت (اگر hint فعال است)
            if (this.practiceSettings.allowHint) {
                const isOptimal = this._isOptimalMove(card, playerIndex);
                if (isOptimal) {
                    this.practiceStats.correctMoves++;
                } else {
                    this.practiceStats.wrongMoves++;
                }
            }

            this._emit('card-played', {
                card,
                playerIndex,
                isOptimal: this._isOptimalMove(card, playerIndex)
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

    /**
     * دریافت کارت‌های حریف (اگر مجاز باشد)
     * @param {number} playerIndex - ایندکس بازیکن
     * @returns {Array<Object>|null}
     */
    getOpponentHand(playerIndex) {
        if (!this.practiceSettings.showOpponentCards) {
            return null;
        }

        if (!hokmEngine) return null;

        const player = hokmEngine.getPlayerInfo(playerIndex);
        return player?.hand || null;
    }

    // ============================================================
    // بخش ۴: Undo/Redo
    // ============================================================

    /**
     * بازگشت به حرکت قبلی (Undo)
     * @returns {Object} نتیجه
     */
    undoMove() {
        if (!this.practiceSettings.allowUndo) {
            return {
                success: false,
                error: 'UNDO_NOT_ALLOWED',
                message: 'Undo در این حالت مجاز نیست'
            };
        }

        if (this.currentMoveIndex <= 0) {
            return {
                success: false,
                error: 'NO_MORE_UNDO',
                message: 'حرکت قبلی وجود ندارد'
            };
        }

        this.currentMoveIndex--;
        const previousState = this.moveHistory[this.currentMoveIndex];

        // بازگرداندن وضعیت
        if (hokmEngine && previousState) {
            // در production، وضعیت کامل بازی بازگردانده می‌شود
            this.gameState = previousState.state;
        }

        this.practiceStats.undosUsed++;

        this._emit('move-undone', {
            moveIndex: this.currentMoveIndex,
            move: previousState
        });

        if (this.debug) {
            console.log(`↩️ Undo to move ${this.currentMoveIndex}`);
        }

        return {
            success: true,
            moveIndex: this.currentMoveIndex,
            state: previousState
        };
    }

    /**
     * رفتن به حرکت بعدی (Redo)
     * @returns {Object} نتیجه
     */
    redoMove() {
        if (!this.practiceSettings.allowUndo) {
            return {
                success: false,
                error: 'REDO_NOT_ALLOWED',
                message: 'Redo در این حالت مجاز نیست'
            };
        }

        if (this.currentMoveIndex >= this.moveHistory.length - 1) {
            return {
                success: false,
                error: 'NO_MORE_REDO',
                message: 'حرکت بعدی وجود ندارد'
            };
        }

        this.currentMoveIndex++;
        const nextState = this.moveHistory[this.currentMoveIndex];

        if (hokmEngine && nextState) {
            this.gameState = nextState.state;
        }

        this._emit('move-redone', {
            moveIndex: this.currentMoveIndex,
            move: nextState
        });

        if (this.debug) {
            console.log(`️ Redo to move ${this.currentMoveIndex}`);
        }

        return {
            success: true,
            moveIndex: this.currentMoveIndex,
            state: nextState
        };
    }

    /**
     * ذخیره حرکت در تاریخچه
     * @param {string} type - نوع حرکت
     * @param {Object} data - داده
     * @private
     */
    _saveMoveToHistory(type, data) {
        const move = {
            type,
            state: this.gameState ? { ...this.gameState } : null,
            data: { ...data },
            timestamp: Date.now(),
            index: this.moveHistory.length
        };

        // اگر در میانه تاریخچه هستیم، حرکات بعدی را حذف کن
        if (this.currentMoveIndex < this.moveHistory.length - 1) {
            this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
        }

        this.moveHistory.push(move);
        this.currentMoveIndex = this.moveHistory.length - 1;

        // محدود کردن تاریخچه
        if (this.moveHistory.length > this.maxMoveHistory) {
            this.moveHistory.shift();
        }
    }

    /**
     * دریافت تاریخچه حرکات
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getMoveHistory(limit = 50) {
        return this.moveHistory.slice(-limit);
    }

    /**
     * دریافت ایندکس فعلی در تاریخچه
     * @returns {number}
     */
    getCurrentMoveIndex() {
        return this.currentMoveIndex;
    }

    // ============================================================
    // بخش ۵: Hint و آنالیز
    // ============================================================

    /**
     * دریافت پیشنهاد حرکت (Hint)
     * @returns {Object} نتیجه
     */
    getHint() {
        if (!this.practiceSettings.allowHint) {
            return {
                success: false,
                error: 'HINT_NOT_ALLOWED',
                message: 'Hint در این حالت مجاز نیست'
            };
        }

        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const player = hokmEngine?.getPlayerInfo(playerIndex);

        if (!player || !player.hand || player.hand.length === 0) {
            return {
                success: false,
                error: 'NO_CARDS',
                message: 'کارتی در دست نیست'
            };
        }

        // پیدا کردن بهترین حرکت
        const bestMove = this._findBestMove(player.hand, playerIndex);

        this.practiceStats.hintsUsed++;

        this._emit('hint-provided', {
            card: bestMove.card,
            reason: bestMove.reason,
            confidence: bestMove.confidence
        });

        if (this.debug) {
            console.log(`💡 Hint: ${bestMove.card.nameFa} - ${bestMove.reason}`);
        }

        return {
            success: true,
            card: bestMove.card,
            reason: bestMove.reason,
            confidence: bestMove.confidence
        };
    }

    /**
     * پیدا کردن بهترین حرکت
     * @param {Array} hand - دست
     * @param {number} playerIndex - ایندکس بازیکن
     * @returns {Object}
     * @private
     */
    _findBestMove(hand, playerIndex) {
        const gameState = this.getGameState();
        const trump = gameState?.trump;
        const leadSuit = gameState?.leadSuit;

        // استراتژی ساده برای hint
        let bestCard = hand[0];
        let bestScore = -1;
        let reason = '';

        hand.forEach(card => {
            let score = 0;

            // اگر کارت حکم است
            if (card.suit === trump) {
                score += 50;
                reason = 'کارت حکم قوی است';
            }

            // اگر کارت از خال شروع است
            if (leadSuit && card.suit === leadSuit) {
                score += 30;
                reason = 'کارت از خال شروع است';
            }

            // اگر کارت بالا است
            if (card.value >= 10) {
                score += 20;
                reason = 'کارت بالا است';
            }

            if (score > bestScore) {
                bestScore = score;
                bestCard = card;
            }
        });

        return {
            card: bestCard,
            reason,
            confidence: bestScore / 100
        };
    }

    /**
     * بررسی آیا حرکت بهینه است
     * @param {Object} card - کارت
     * @param {number} playerIndex - ایندکس بازیکن
     * @returns {boolean}
     * @private
     */
    _isOptimalMove(card, playerIndex) {
        const bestMove = this._findBestMove(
            hokmEngine?.getPlayerInfo(playerIndex)?.hand || [],
            playerIndex
        );

        return bestMove.card.id === card.id;
    }

    /**
     * دریافت آنالیز بازی
     * @returns {Object} آنالیز
     */
    getGameAnalysis() {
        if (!this.gameState) {
            return {
                success: false,
                error: 'NO_GAME_STATE',
                message: 'وضعیت بازی در دسترس نیست'
            };
        }

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const player = hokmEngine?.getPlayerInfo(playerIndex);

        const analysis = {
            totalMoves: this.practiceStats.totalMoves,
            correctMoves: this.practiceStats.correctMoves,
            wrongMoves: this.practiceStats.wrongMoves,
            accuracy: this.practiceStats.totalMoves > 0 ?
                (this.practiceStats.correctMoves / this.practiceStats.totalMoves) * 100 : 0,
            hintsUsed: this.practiceStats.hintsUsed,
            undosUsed: this.practiceStats.undosUsed,
            currentHand: player?.hand || [],
            trump: this.gameState.trump,
            scores: this.gameState.scores,
            currentPlayer: this.gameState.currentPlayerIndex,
            suggestions: this._generateSuggestions()
        };

        return {
            success: true,
            analysis
        };
    }

    /**
     * تولید پیشنهادات
     * @returns {Array<string>}
     * @private
     */
    _generateSuggestions() {
        const suggestions = [];

        if (this.practiceStats.wrongMoves > this.practiceStats.correctMoves) {
            suggestions.push('بیشتر به خال شروع توجه کنید');
        }

        if (this.practiceStats.hintsUsed > 5) {
            suggestions.push('سعی کنید بدون hint بازی کنید');
        }

        if (this.practiceStats.undosUsed > 10) {
            suggestions.push('قبل از بازی کردن، بیشتر فکر کنید');
        }

        return suggestions;
    }

    // ============================================================
    // بخش ۶: پایان بازی
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

        // به‌روزرسانی آمار
        this._updateStats(result);

        // ذخیره آمار
        this._saveStats();

        this._emit('practice-game-ended', {
            result,
            duration: this.gameDuration,
            stats: this.practiceStats
        });

        if (this.debug) {
            console.log('🏁 Practice game ended');
        }
    }

    /**
     * به‌روزرسانی آمار
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _updateStats(result) {
        this.practiceStats.totalGames++;
        this.practiceStats.completedGames++;

        // به‌روزرسانی میانگین مدت زمان
        this.practiceStats.averageGameDuration =
            ((this.practiceStats.averageGameDuration * (this.practiceStats.completedGames - 1)) + this.gameDuration) /
            this.practiceStats.completedGames;

        // اگر سناریو بود
        if (this.practiceSettings.scenarioMode) {
            this.practiceStats.scenariosCompleted++;
        }

        // اگر آموزش بود
        if (this.practiceSettings.tutorialMode) {
            this.practiceStats.tutorialsCompleted++;
        }
    }

    // ============================================================
    // بخش ۷: کنترل بازی
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
        this._stopDurationTimer();

        if (hokmEngine) {
            hokmEngine.pause();
        }

        this._emit('game-paused');

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
        this._startDurationTimer();

        if (hokmEngine) {
            hokmEngine.resume();
        }

        this._emit('game-resumed');

        return {
            success: true
        };
    }

    /**
     * شروع مجدد بازی (Restart)
     * @returns {Object} نتیجه
     */
    restartGame() {
        if (!this.practiceSettings.allowRestart) {
            return {
                success: false,
                error: 'RESTART_NOT_ALLOWED',
                message: 'Restart در این حالت مجاز نیست'
            };
        }

        // پاک کردن تاریخچه
        this.moveHistory = [];
        this.currentMoveIndex = -1;

        // ریست آمار بازی جاری
        this.practiceStats.totalMoves = 0;
        this.practiceStats.correctMoves = 0;
        this.practiceStats.wrongMoves = 0;
        this.practiceStats.hintsUsed = 0;
        this.practiceStats.undosUsed = 0;

        // شروع مجدد
        this.status = 'setup';
        this.gameState = null;
        this.gameResult = null;

        this._emit('game-restarted');

        if (this.debug) {
            console.log('🔄 Game restarted');
        }

        return this.startGame();
    }

    // ============================================================
    // بخش : سناریوها و آموزش‌ها
    // ============================================================

    /**
     * دریافت لیست سناریوها
     * @returns {Array<Object>}
     */
    getScenarios() {
        return this.scenarios;
    }

    /**
     * دریافت لیست آموزش‌ها
     * @returns {Array<Object>}
     */
    getTutorials() {
        return this.tutorials;
    }

    /**
     * دریافت سناریوی خاص
     * @param {string} scenarioId - شناسه
     * @returns {Object|null}
     */
    getScenario(scenarioId) {
        return this.scenarios.find(s => s.id === scenarioId) || null;
    }

    /**
     * دریافت آموزش خاص
     * @param {string} tutorialId - شناسه
     * @returns {Object|null}
     */
    getTutorial(tutorialId) {
        return this.tutorials.find(t => t.id === tutorialId) || null;
    }

    /**
     * مقداردهی اولیه سناریوها
     * @returns {Array<Object>}
     * @private
     */
    _initScenarios() {
        return [
            {
                id: 'trump_selection',
                name: 'انتخاب حکم',
                description: 'تمرین انتخاب بهترین حکم',
                difficulty: 'easy',
                aiLevel: 'easy',
                showCards: true,
                completed: false
            },
            {
                id: 'follow_suit',
                name: 'رعایت خال',
                description: 'تمرین Follow Suit',
                difficulty: 'easy',
                aiLevel: 'easy',
                showCards: false,
                completed: false
            },
            {
                id: 'trump_management',
                name: 'مدیریت حکم',
                description: 'تمرین استفاده بهینه از حکم',
                difficulty: 'medium',
                aiLevel: 'normal',
                showCards: true,
                completed: false
            },
            {
                id: 'endgame',
                name: 'پایان بازی',
                description: 'تمرین استراتژی پایان بازی',
                difficulty: 'hard',
                aiLevel: 'hard',
                showCards: true,
                completed: false
            },
            {
                id: 'kot_scenario',
                name: 'سناریوی Kot',
                description: 'تمرین شرایط Kot',
                difficulty: 'expert',
                aiLevel: 'expert',
                showCards: true,
                completed: false
            }
        ];
    }

    /**
     * مقداردهی اولیه آموزش‌ها
     * @returns {Array<Object>}
     * @private
     */
    _initTutorials() {
        return [
            {
                id: 'rules_basics',
                title: 'قوانین پایه حکم',
                description: 'آشنایی با قوانین اصلی بازی',
                duration: 10,
                steps: 5,
                completed: false
            },
            {
                id: 'card_values',
                title: 'ارزش کارت‌ها',
                description: 'آشنایی با ارزش کارت‌ها در حکم',
                duration: 8,
                steps: 4,
                completed: false
            },
            {
                id: 'trump_basics',
                title: 'مبانی حکم',
                description: 'آشنایی با مفهوم حکم و Trump',
                duration: 12,
                steps: 6,
                completed: false
            },
            {
                id: 'scoring_system',
                title: 'سیستم امتیازدهی',
                description: 'آشنایی با نحوه امتیازدهی',
                duration: 10,
                steps: 5,
                completed: false
            },
            {
                id: 'advanced_strategy',
                title: 'استراتژی پیشرفته',
                description: 'تکنیک‌های پیشرفته بازی',
                duration: 20,
                steps: 10,
                completed: false
            }
        ];
    }

    // ============================================================
    // بخش : بازگشت و پاکسازی
    // ============================================================

    /**
     * بازگشت به صفحه اصلی
     * @returns {Object} نتیجه
     */
    returnToHome() {
        this._cleanup();

        this._emit('returned-to-home');

        if (this.debug) {
            console.log('🏠 Returned to home from Practice');
        }

        return {
            success: true
        };
    }

    /**
     * تمرین مجدد
     * @returns {Object} نتیجه
     */
    practiceAgain() {
        this._cleanup();

        return this.startFreePractice({
            aiLevel: this.practiceSettings.aiLevel
        });
    }

    /**
     * پاکسازی کامل
     * @private
     */
    _cleanup() {
        this.status = 'idle';
        this.gameId = null;
        this.players = [];
        this.teams = { team1: [], team2: [] };
        this.gameState = null;
        this.gameResult = null;
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.gameStartTime = null;
        this.gameDuration = 0;

        this._stopDurationTimer();

        if (hokmEngine) {
            hokmEngine.clearListeners();
        }

        if (this.debug) {
            console.log('🧹 PracticeMode cleaned up');
        }
    }

    /**
     * ریست کامل
     */
    reset() {
        this._cleanup();

        this.practiceStats = {
            totalGames: 0,
            completedGames: 0,
            totalMoves: 0,
            correctMoves: 0,
            wrongMoves: 0,
            hintsUsed: 0,
            undosUsed: 0,
            averageGameDuration: 0,
            scenariosCompleted: 0,
            tutorialsCompleted: 0
        };

        if (this.debug) {
            console.log('🔄 PracticeMode reset');
        }
    }

    // ============================================================
    // بخش ۱۰: توابع کمکی
    // ============================================================

    /**
     * ذخیره آمار
     * @private
     */
    _saveStats() {
        if (storage) {
            storage.set('practice_stats', this.practiceStats);
        }
    }

    /**
     * بارگذاری آمار
     * @private
     */
    _loadStats() {
        if (storage) {
            const saved = storage.get('practice_stats');
            if (saved) {
                this.practiceStats = { ...this.practiceStats, ...saved };
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
            gameId: this.gameId,
            player: this.player,
            players: this.players,
            teams: this.teams,
            settings: this.practiceSettings,
            gameState: this.gameState,
            gameResult: this.gameResult,
            duration: this.gameDuration,
            moveHistoryLength: this.moveHistory.length,
            currentMoveIndex: this.currentMoveIndex
        };
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return { ...this.practiceStats };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const status = this.getStatus();
        const stats = this.getStats();

        console.log(' PracticeMode Status:');
        console.log('  Status:', status.status);
        console.log('  Game ID:', status.gameId || 'None');
        console.log('  Players:', status.players.length);
        console.log('  Duration:', this.getFormattedDuration());
        console.log('  Total Games:', stats.totalGames);
        console.log('  Completed:', stats.completedGames);
        console.log('  Total Moves:', stats.totalMoves);
        console.log('  Correct Moves:', stats.correctMoves);
        console.log('  Wrong Moves:', stats.wrongMoves);
        console.log('  Hints Used:', stats.hintsUsed);
        console.log('  Undos Used:', stats.undosUsed);
        console.log('  Scenarios Completed:', stats.scenariosCompleted);
        console.log('  Tutorials Completed:', stats.tutorialsCompleted);
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
                    console.error(` PracticeMode event listener error:`, error);
                }
            });
        }

        eventBus.emit(`practice:${event}`, data);
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
const practiceMode = new PracticeMode();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PracticeMode, practiceMode };
} else {
    window.PracticeMode = PracticeMode;
    window.practiceMode = practiceMode;
}

console.log('✅ PracticeMode loaded');
