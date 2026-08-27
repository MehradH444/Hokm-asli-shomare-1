/**
 * ============================================================
 * HOKM MASTER - Game Engine
 * موتور اصلی بازی حکم
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل منطق بازی حکم است. شامل تمام
 * قوانین بازی، مدیریت نوبت، امتیازدهی، تشخیص Kot، مدیریت
 * Round و Match، انتخاب حاکم و حکم، و تعیین برنده.
 * 
 * این موتور از CardEngine برای مدیریت کارت‌ها استفاده می‌کند.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - cardEngine (از فایل cards.js)
 * 
 * ============================================================
 */

class HokmEngine {

    constructor() {
        /**
         * وضعیت بازی
         * @type {string} 'idle' | 'waiting' | 'playing' | 'paused' | 'finished'
         */
        this.status = 'idle';

        /**
         * شناسه بازی
         * @type {string}
         */
        this.gameId = null;

        /**
         * لیست بازیکنان
         * @type {Array<Object>}
         */
        this.players = [];

        /**
         * تیم‌ها
         * @type {Object} { team1: [], team2: [] }
         */
        this.teams = {
            team1: [],
            team2: []
        };

        /**
         * امتیاز تیم‌ها
         * @type {Object}
         */
        this.scores = {
            team1: 0,
            team2: 0
        };

        /**
         * شماره Round فعلی
         * @type {number}
         */
        this.currentRound = 1;

        /**
         * تعداد Round های برده شده برای پیروزی
         * @type {number}
         */
        this.roundsToWin = CONFIG.GAME.SCORING.FIRST_TO_WIN_ROUNDS;

        /**
         * برنده‌های Round های قبلی
         * @type {Array}
         */
        this.roundWinners = [];

        /**
         * ایندکس حاکم
         * @type {number}
         */
        this.hakemIndex = null;

        /**
         * ایندکس Dealer (توزیع‌کننده)
         * @type {number}
         */
        this.dealerIndex = null;

        /**
         * ایندکس بازیکن فعلی (نوبت)
         * @type {number}
         */
        this.currentPlayerIndex = null;

        /**
         * آیا حکم انتخاب شده
         * @type {boolean}
         */
        this.trumpSelected = false;

        /**
         * آیا بازی شروع شده
         * @type {boolean}
         */
        this.gameStarted = false;

        /**
         * تایمر نوبت
         * @type {number|null}
         */
        this.turnTimer = null;

        /**
         * زمان باقی‌مانده نوبت
         * @type {number}
         */
        this.turnTimeRemaining = 0;

        /**
         * تاریخچه بازی
         * @type {Array}
         */
        this.history = [];

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
         * مرجع CardEngine
         * @type {CardEngine}
         */
        this.cardEngine = null;

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // استفاده از CardEngine سراسری
        if (typeof cardEngine !== 'undefined') {
            this.cardEngine = cardEngine;
        }

        if (this.debug) {
            console.log('🎮 HokmEngine initialized');
        }
    }

    // ============================================================
    // بخش ۱: راه‌اندازی بازی
    // ============================================================

    /**
     * شروع بازی جدید
     * @param {Array<Object>} players - لیست بازیکنان
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    startGame(players, options = {}) {
        const {
            roundsToWin = CONFIG.GAME.SCORING.FIRST_TO_WIN_ROUNDS,
            mode = 'classic',
            aiLevel = null
        } = options;

        // اعتبارسنجی تعداد بازیکنان
        if (players.length !== CONFIG.GAME.PLAYERS.MAX) {
            return {
                success: false,
                error: 'INVALID_PLAYER_COUNT',
                message: `بازی حکم نیاز به ${CONFIG.GAME.PLAYERS.MAX} بازیکن دارد`
            };
        }

        // ریست state
        this._resetState();

        // تنظیم بازیکنان
        this.players = players.map((player, index) => ({
            ...player,
            index: index,
            team: index % 2 === 0 ? 'team1' : 'team2',
            isAI: player.isAI || false,
            aiLevel: player.aiLevel || aiLevel,
            hand: [],
            tricksWon: 0,
            cardsPlayed: []
        }));

        // تنظیم تیم‌ها
        this.teams = {
            team1: this.players.filter(p => p.team === 'team1'),
            team2: this.players.filter(p => p.team === 'team2')
        };

        // تنظیمات بازی
        this.roundsToWin = roundsToWin;
        this.gameId = Utils.generateUUID();
        this.status = 'waiting';
        this.mode = mode;

        // انتخاب حاکم و Dealer تصادفی
        this.hakemIndex = Utils.randomInt(0, this.players.length - 1);
        this.dealerIndex = (this.hakemIndex + 1) % this.players.length;
        this.currentPlayerIndex = this.hakemIndex;

        this._emit('game-created', {
            gameId: this.gameId,
            players: this.players,
            hakem: this.players[this.hakemIndex],
            dealer: this.players[this.dealerIndex]
        });

        if (this.debug) {
            console.log(`🎮 Game created: ${this.gameId}`);
            console.log(`  Hakem: Player ${this.hakemIndex}`);
            console.log(`  Dealer: Player ${this.dealerIndex}`);
        }

        return {
            success: true,
            gameId: this.gameId,
            hakem: this.players[this.hakemIndex],
            dealer: this.players[this.dealerIndex],
            players: this.players
        };
    }

    /**
     * ریست state بازی
     * @private
     */
    _resetState() {
        this.status = 'idle';
        this.players = [];
        this.teams = { team1: [], team2: [] };
        this.scores = { team1: 0, team2: 0 };
        this.currentRound = 1;
        this.roundWinners = [];
        this.hakemIndex = null;
        this.dealerIndex = null;
        this.currentPlayerIndex = null;
        this.trumpSelected = false;
        this.gameStarted = false;
        this.history = [];

        if (this.cardEngine) {
            this.cardEngine.reset();
        }

        this._stopTurnTimer();
    }

    // ============================================================
    // بخش : انتخاب حاکم و حکم
    // ============================================================

    /**
     * دریافت اطلاعات حاکم
     * @returns {Object|null}
     */
    getHakem() {
        if (this.hakemIndex === null) return null;
        return this.players[this.hakemIndex];
    }

    /**
     * دریافت اطلاعات Dealer
     * @returns {Object|null}
     */
    getDealer() {
        if (this.dealerIndex === null) return null;
        return this.players[this.dealerIndex];
    }

    /**
     * انتخاب حکم توسط حاکم
     * @param {string} suit - خال حکم
     * @param {number} playerIndex - ایندکس بازیکن (باید حاکم باشد)
     * @returns {Object} نتیجه
     */
    selectTrump(suit, playerIndex) {
        // بررسی وضعیت بازی
        if (this.status !== 'waiting') {
            return {
                success: false,
                error: 'INVALID_STATE',
                message: 'بازی در وضعیت نامعتبر است'
            };
        }

        // بررسی اینکه بازیکن حاکم است
        if (playerIndex !== this.hakemIndex) {
            return {
                success: false,
                error: 'NOT_HAKEM',
                message: 'فقط حاکم می‌تواند حکم را انتخاب کند'
            };
        }

        // بررسی تکراری نبودن
        if (this.trumpSelected) {
            return {
                success: false,
                error: 'TRUMP_ALREADY_SELECTED',
                message: 'حکم قبلاً انتخاب شده است'
            };
        }

        // اعتبارسنجی خال
        const validSuits = Object.values(CONFIG.GAME.CARDS.SUITS);
        if (!validSuits.includes(suit)) {
            return {
                success: false,
                error: 'INVALID_SUIT',
                message: 'خال نامعتبر است'
            };
        }

        // تنظیم حکم در CardEngine
        if (this.cardEngine) {
            const result = this.cardEngine.setTrump(suit);
            if (!result.success) {
                return result;
            }
        }

        this.trumpSelected = true;

        this._emit('trump-selected', {
            suit: suit,
            hakem: this.players[this.hakemIndex],
            suitName: this._getSuitNameFa(suit)
        });

        if (this.debug) {
            console.log(`👑 Trump selected: ${this._getSuitNameFa(suit)} by Hakem (Player ${this.hakemIndex})`);
        }

        return {
            success: true,
            suit: suit,
            suitName: this._getSuitNameFa(suit)
        };
    }

    /**
     * دریافت نام فارسی خال
     * @param {string} suit - خال
     * @returns {string}
     * @private
     */
    _getSuitNameFa(suit) {
        const names = {
            spades: 'پیک',
            hearts: 'دل',
            diamonds: 'خشت',
            clubs: 'گشنیز'
        };
        return names[suit] || suit;
    }

    // ============================================================
    // بخش ۳: توزیع کارت و شروع بازی
    // ============================================================

    /**
     * توزیع کارت و شروع بازی
     * @returns {Object} نتیجه
     */
    dealAndStart() {
        if (!this.trumpSelected) {
            return {
                success: false,
                error: 'TRUMP_NOT_SELECTED',
                message: 'ابتدا باید حکم انتخاب شود'
            };
        }

        if (!this.cardEngine) {
            return {
                success: false,
                error: 'NO_CARD_ENGINE',
                message: 'موتور کارت در دسترس نیست'
            };
        }

        try {
            // ساخت Deck و Shuffle
            const deck = this.cardEngine.createDeck();
            this.cardEngine.deck = deck;
            this.cardEngine.shuffle();

            // Deal کردن کارت‌ها
            const hands = this.cardEngine.deal(this.players.length);

            // تخصیص کارت به بازیکنان
            this.players.forEach((player, index) => {
                player.hand = hands[`player${index}`] || [];
                // مرتب‌سازی دست
                player.hand = this.cardEngine.sortBySuitThenRank(player.hand);
            });

            this.status = 'playing';
            this.gameStarted = true;

            // شروع Round اول
            this._startRound();

            this._emit('game-started', {
                gameId: this.gameId,
                players: this.players.map(p => ({
                    index: p.index,
                    handSize: p.hand.length,
                    team: p.team
                }))
            });

            if (this.debug) {
                console.log('🎴 Cards dealt and game started');
            }

            return {
                success: true,
                hands: this.players.map(p => ({
                    player: p.index,
                    cards: p.hand
                }))
            };

        } catch (error) {
            console.error('❌ Deal failed:', error);
            return {
                success: false,
                error: 'DEAL_FAILED',
                message: 'خطا در توزیع کارت‌ها'
            };
        }
    }

    /**
     * شروع Round جدید
     * @private
     */
    _startRound() {
        if (!this.cardEngine) return;

        // شروع Trick جدید
        this.cardEngine.startTrick(null);

        // تعیین بازیکن شروع‌کننده (اولین نفر بعد از Dealer)
        const starterIndex = (this.dealerIndex + 1) % this.players.length;
        this.currentPlayerIndex = starterIndex;

        this._emit('round-started', {
            round: this.currentRound,
            starter: this.players[starterIndex]
        });

        // شروع تایمر نوبت
        this._startTurnTimer();

        if (this.debug) {
            console.log(`🔄 Round ${this.currentRound} started. Starter: Player ${starterIndex}`);
        }
    }

    // ============================================================
    // بخش : مدیریت نوبت
    // ============================================================

    /**
     * بازی کردن کارت
     * @param {number} playerIndex - ایندکس بازیکن
     * @param {Object} card - کارت
     * @returns {Object} نتیجه
     */
    playCard(playerIndex, card) {
        // بررسی وضعیت بازی
        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            };
        }

        // بررسی نوبت
        if (playerIndex !== this.currentPlayerIndex) {
            return {
                success: false,
                error: 'NOT_YOUR_TURN',
                message: 'نوبت شما نیست'
            };
        }

        const player = this.players[playerIndex];

        // بررسی وجود کارت در دست
        if (!player.hand.some(c => c.id === card.id)) {
            return {
                success: false,
                error: 'CARD_NOT_IN_HAND',
                message: 'این کارت در دست شما نیست'
            };
        }

        // اعتبارسنجی بازی با CardEngine
        if (this.cardEngine) {
            const validation = this.cardEngine.validatePlay(card, player.hand);
            if (!validation.valid) {
                return validation;
            }
        }

        // بازی کردن کارت در CardEngine
        if (this.cardEngine) {
            const result = this.cardEngine.playCard(card, playerIndex);
            if (!result.valid) {
                return result;
            }
        }

        // حذف کارت از دست بازیکن
        const cardIndex = player.hand.findIndex(c => c.id === card.id);
        player.hand.splice(cardIndex, 1);
        player.cardsPlayed.push(card);

        // ثبت در تاریخچه
        this.history.push({
            type: 'card_played',
            player: playerIndex,
            card: card,
            round: this.currentRound,
            timestamp: Date.now()
        });

        this._emit('card-played', {
            player: playerIndex,
            card: card,
            handRemaining: player.hand.length
        });

        if (this.debug) {
            console.log(`🎴 Player ${playerIndex} played: ${card.nameFa}`);
        }

        // بررسی تکمیل Trick
        const trickComplete = this._checkTrickComplete();
        if (trickComplete) {
            return this._completeTrick();
        }

        // رفتن به نوبت بعدی
        this._nextTurn();

        return {
            success: true,
            card: card,
            nextPlayer: this.currentPlayerIndex
        };
    }

    /**
     * بررسی تکمیل Trick
     * @returns {boolean}
     * @private
     */
    _checkTrickComplete() {
        if (!this.cardEngine) return false;
        return this.cardEngine.playedCards.length === this.players.length;
    }

    /**
     * تکمیل Trick
     * @returns {Object} نتیجه
     * @private
     */
    _completeTrick() {
        if (!this.cardEngine) {
            return { success: false };
        }

        // تعیین برنده Trick
        const trickResult = this.cardEngine.determineTrickWinner();

        if (!trickResult.winner) {
            return { success: false, error: 'NO_WINNER' };
        }

        const winnerIndex = trickResult.winner.playerIndex;
        const winner = this.players[winnerIndex];
        const winnerTeam = winner.team;

        // افزایش امتیاز تیم برنده
        this.scores[winnerTeam]++;
        winner.tricksWon++;

        // ثبت در تاریخچه
        this.history.push({
            type: 'trick_won',
            winner: winnerIndex,
            team: winnerTeam,
            round: this.currentRound,
            cards: this.cardEngine.playedCards.map(p => p.card),
            timestamp: Date.now()
        });

        this._emit('trick-won', {
            winner: winnerIndex,
            team: winnerTeam,
            scores: this.scores
        });

        if (this.debug) {
            console.log(`🏆 Player ${winnerIndex} (${winnerTeam}) won trick. Score: ${this.scores.team1}-${this.scores.team2}`);
        }

        // بررسی پایان Round
        const roundComplete = this._checkRoundComplete();
        if (roundComplete) {
            return this._completeRound();
        }

        // شروع Trick جدید - برنده Trick بعدی را شروع می‌کند
        this.cardEngine.startTrick(null);
        this.currentPlayerIndex = winnerIndex;
        this._startTurnTimer();

        return {
            success: true,
            trickWinner: winnerIndex,
            scores: this.scores,
            nextStarter: winnerIndex
        };
    }

    /**
     * بررسی پایان Round
     * @returns {boolean}
     * @private
     */
    _checkRoundComplete() {
        // Round وقتی تمام می‌شود که همه کارت‌ها بازی شوند
        return this.players.every(p => p.hand.length === 0);
    }

    /**
     * تکمیل Round
     * @returns {Object} نتیجه
     * @private
     */
    _completeRound() {
        this._stopTurnTimer();

        const team1Score = this.scores.team1;
        const team2Score = this.scores.team2;

        // تعیین برنده Round
        let roundWinner = null;
        let isKot = false;

        if (team1Score > team2Score) {
            roundWinner = 'team1';
            if (team2Score === 0) isKot = true;
        } else if (team2Score > team1Score) {
            roundWinner = 'team2';
            if (team1Score === 0) isKot = true;
        } else {
            // مساوی - در حکم معمولاً نمی‌شود ولی برای احتیاط
            roundWinner = 'draw';
        }

        this.roundWinners.push({
            round: this.currentRound,
            winner: roundWinner,
            score: { team1: team1Score, team2: team2Score },
            isKot: isKot
        });

        this._emit('round-completed', {
            round: this.currentRound,
            winner: roundWinner,
            score: { team1: team1Score, team2: team2Score },
            isKot: isKot
        });

        if (this.debug) {
            console.log(` Round ${this.currentRound} completed. Winner: ${roundWinner} (${team1Score}-${team2Score})${isKot ? ' KOT!' : ''}`);
        }

        // بررسی Kot
        if (isKot) {
            this._handleKot(roundWinner);
        }

        // بررسی پایان Match
        const matchComplete = this._checkMatchComplete();
        if (matchComplete) {
            return this._completeMatch();
        }

        // شروع Round بعدی
        this.currentRound++;
        this.scores = { team1: 0, team2: 0 };

        // Dealer بعدی
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;

        // Round بعدی توسط تیم بازنده شروع می‌شود
        // (یا تیمی که Round قبل را باخته)
        const losingTeam = roundWinner === 'team1' ? 'team2' : 'team1';
        this.currentPlayerIndex = this.teams[losingTeam][0].index;

        // توزیع کارت برای Round جدید
        if (this.cardEngine) {
            this.cardEngine.reset();
            const deck = this.cardEngine.createDeck();
            this.cardEngine.deck = deck;
            this.cardEngine.shuffle();

            const hands = this.cardEngine.deal(this.players.length);
            this.players.forEach((player, index) => {
                player.hand = hands[`player${index}`] || [];
                player.hand = this.cardEngine.sortBySuitThenRank(player.hand);
                player.cardsPlayed = [];
                player.tricksWon = 0;
            });
        }

        this._startRound();

        return {
            success: true,
            roundComplete: true,
            roundWinner: roundWinner,
            isKot: isKot,
            nextRound: this.currentRound
        };
    }

    /**
     * بررسی پایان Match
     * @returns {boolean}
     * @private
     */
    _checkMatchComplete() {
        const team1Wins = this.roundWinners.filter(r => r.winner === 'team1').length;
        const team2Wins = this.roundWinners.filter(r => r.winner === 'team2').length;

        return team1Wins >= this.roundsToWin || team2Wins >= this.roundsToWin;
    }

    /**
     * تکمیل Match
     * @returns {Object} نتیجه
     * @private
     */
    _completeMatch() {
        this.status = 'finished';

        const team1Wins = this.roundWinners.filter(r => r.winner === 'team1').length;
        const team2Wins = this.roundWinners.filter(r => r.winner === 'team2').length;

        let matchWinner = null;
        if (team1Wins > team2Wins) {
            matchWinner = 'team1';
        } else if (team2Wins > team1Wins) {
            matchWinner = 'team2';
        }

        const winnerTeam = this.teams[matchWinner];
        const loserTeam = matchWinner === 'team1' ? this.teams.team2 : this.teams.team1;

        this._emit('match-completed', {
            winner: matchWinner,
            winnerTeam: winnerTeam,
            loserTeam: loserTeam,
            score: {
                team1: team1Wins,
                team2: team2Wins
            },
            rounds: this.roundWinners
        });

        if (this.debug) {
            console.log(`🏆 Match completed! Winner: ${matchWinner} (${team1Wins}-${team2Wins})`);
        }

        return {
            success: true,
            matchWinner: matchWinner,
            winnerTeam: winnerTeam,
            score: { team1: team1Wins, team2: team2Wins },
            rounds: this.roundWinners
        };
    }

    /**
     * مدیریت Kot
     * @param {string} winningTeam - تیم برنده
     * @private
     */
    _handleKot(winningTeam) {
        // Kot یعنی یک تیم همه Trick ها را برده
        // در قوانین مختلف حکم، Kot امتیاز اضافه دارد
        const kotBonus = CONFIG.GAME.SCORING.KOT_BONUS;

        this._emit('kot', {
            team: winningTeam,
            bonus: kotBonus,
            round: this.currentRound
        });

        if (this.debug) {
            console.log(`💥 KOT! Team ${winningTeam} wins all tricks in round ${this.currentRound}`);
        }
    }

    // ============================================================
    // بخش ۵: مدیریت نوبت و تایمر
    // ============================================================

    /**
     * رفتن به نوبت بعدی
     * @private
     */
    _nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this._startTurnTimer();

        this._emit('turn-changed', {
            currentPlayer: this.currentPlayerIndex,
            player: this.players[this.currentPlayerIndex]
        });
    }

    /**
     * شروع تایمر نوبت
     * @private
     */
    _startTurnTimer() {
        this._stopTurnTimer();

        this.turnTimeRemaining = CONFIG.GAME.TIMER.TURN_SECONDS;

        this.turnTimer = setInterval(() => {
            this.turnTimeRemaining--;

            if (this.turnTimeRemaining <= CONFIG.GAME.TIMER.TURN_WARNING_SECONDS) {
                this._emit('turn-warning', {
                    player: this.currentPlayerIndex,
                    remaining: this.turnTimeRemaining
                });
            }

            if (this.turnTimeRemaining <= 0) {
                this._handleTurnTimeout();
            }
        }, 1000);
    }

    /**
     * توقف تایمر نوبت
     * @private
     */
    _stopTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    }

    /**
     * مدیریت اتمام زمان نوبت
     * @private
     */
    _handleTurnTimeout() {
        this._stopTurnTimer();

        const player = this.players[this.currentPlayerIndex];

        // بازی خودکار یک کارت (اولین کارت معتبر)
        if (player.hand.length > 0) {
            const validCard = this._findValidCard(player);
            if (validCard) {
                this.playCard(this.currentPlayerIndex, validCard);
            }
        }

        this._emit('turn-timeout', {
            player: this.currentPlayerIndex,
            player: player
        });

        if (this.debug) {
            console.log(`⏰ Player ${this.currentPlayerIndex} timeout`);
        }
    }

    /**
     * پیدا کردن کارت معتبر برای بازی خودکار
     * @param {Object} player - بازیکن
     * @returns {Object|null}
     * @private
     */
    _findValidCard(player) {
        if (!this.cardEngine) return player.hand[0];

        const leadSuit = this.cardEngine.leadSuit;

        if (leadSuit) {
            // اگر خال شروع مشخص است، باید Follow Suit کند
            const leadCards = player.hand.filter(c => c.suit === leadSuit);
            if (leadCards.length > 0) {
                return leadCards[0];
            }
        }

        // در غیر این صورت، کوچکترین کارت
        const sorted = this.cardEngine.sortByValue(player.hand);
        return sorted[0];
    }

    // ============================================================
    // بخش ۶: کنترل بازی
    // ============================================================

    /**
     * توقف بازی (Pause)
     * @returns {Object}
     */
    pause() {
        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'INVALID_STATE',
                message: 'بازی در حال انجام نیست'
            };
        }

        this.status = 'paused';
        this._stopTurnTimer();

        this._emit('game-paused');

        return { success: true };
    }

    /**
     * ادامه بازی (Resume)
     * @returns {Object}
     */
    resume() {
        if (this.status !== 'paused') {
            return {
                success: false,
                error: 'INVALID_STATE',
                message: 'بازی متوقف نشده است'
            };
        }

        this.status = 'playing';
        this._startTurnTimer();

        this._emit('game-resumed');

        return { success: true };
    }

    /**
     * انصراف از بازی
     * @param {number} playerIndex - بازیکن منصرف شده
     * @returns {Object}
     */
    surrender(playerIndex) {
        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'INVALID_STATE',
                message: 'بازی در حال انجام نیست'
            };
        }

        const player = this.players[playerIndex];
        const losingTeam = player.team;
        const winningTeam = losingTeam === 'team1' ? 'team2' : 'team1';

        this.status = 'finished';
        this._stopTurnTimer();

        this._emit('game-surrendered', {
            player: playerIndex,
            losingTeam: losingTeam,
            winningTeam: winningTeam
        });

        return {
            success: true,
            winner: winningTeam,
            reason: 'surrender'
        };
    }

    /**
     * خروج بازیکن از بازی
     * @param {number} playerIndex - بازیکن
     * @returns {Object}
     */
    playerLeave(playerIndex) {
        if (this.status !== 'playing' && this.status !== 'waiting') {
            return {
                success: false,
                error: 'INVALID_STATE',
                message: 'بازی در وضعیت نامعتبر است'
            };
        }

        this._emit('player-left', {
            player: playerIndex,
            playerData: this.players[playerIndex]
        });

        // اگر بازی در حال انجام است، تیم بازنده می‌شود
        if (this.status === 'playing') {
            return this.surrender(playerIndex);
        }

        return { success: true };
    }

    // ============================================================
    // بخش ۷: اطلاعات بازی
    // ============================================================

    /**
     * دریافت وضعیت کامل بازی
     * @returns {Object}
     */
    getGameState() {
        return {
            gameId: this.gameId,
            status: this.status,
            mode: this.mode,
            currentRound: this.currentRound,
            roundsToWin: this.roundsToWin,
            scores: this.scores,
            trump: this.cardEngine ? this.cardEngine.getTrump() : null,
            trumpSelected: this.trumpSelected,
            hakem: this.getHakem(),
            dealer: this.getDealer(),
            currentPlayer: this.currentPlayerIndex !== null ? this.players[this.currentPlayerIndex] : null,
            turnTimeRemaining: this.turnTimeRemaining,
            players: this.players.map(p => ({
                index: p.index,
                team: p.team,
                handSize: p.hand.length,
                tricksWon: p.tricksWon,
                isAI: p.isAI
            })),
            teams: {
                team1: {
                    players: this.teams.team1.map(p => p.index),
                    score: this.scores.team1,
                    roundsWon: this.roundWinners.filter(r => r.winner === 'team1').length
                },
                team2: {
                    players: this.teams.team2.map(p => p.index),
                    score: this.scores.team2,
                    roundsWon: this.roundWinners.filter(r => r.winner === 'team2').length
                }
            },
            roundWinners: this.roundWinners,
            history: this.history
        };
    }

    /**
     * دریافت اطلاعات یک بازیکن
     * @param {number} playerIndex - ایندکس
     * @returns {Object|null}
     */
    getPlayerInfo(playerIndex) {
        if (playerIndex < 0 || playerIndex >= this.players.length) {
            return null;
        }

        const player = this.players[playerIndex];
        return {
            ...player,
            isCurrentPlayer: playerIndex === this.currentPlayerIndex,
            canPlay: this.status === 'playing' && playerIndex === this.currentPlayerIndex && player.hand.length > 0
        };
    }

    /**
     * دریافت کارت‌های قابل بازی برای یک بازیکن
     * @param {number} playerIndex - ایندکس
     * @returns {Array}
     */
    getPlayableCards(playerIndex) {
        if (playerIndex !== this.currentPlayerIndex) {
            return [];
        }

        const player = this.players[playerIndex];
        if (!this.cardEngine) return player.hand;

        return player.hand.filter(card => {
            const validation = this.cardEngine.validatePlay(card, player.hand);
            return validation.valid;
        });
    }

    /**
     * آیا بازیکن می‌تواند کارت بازی کند
     * @param {number} playerIndex - ایندکس
     * @param {Object} card - کارت
     * @returns {Object}
     */
    canPlayCard(playerIndex, card) {
        if (this.status !== 'playing') {
            return { valid: false, reason: 'GAME_NOT_PLAYING' };
        }

        if (playerIndex !== this.currentPlayerIndex) {
            return { valid: false, reason: 'NOT_YOUR_TURN' };
        }

        const player = this.players[playerIndex];
        if (!this.cardEngine) return { valid: true };

        return this.cardEngine.validatePlay(card, player.hand);
    }

    // ============================================================
    // بخش ۸: آمار و تاریخچه
    // ============================================================

    /**
     * دریافت آمار بازی
     * @returns {Object}
     */
    getGameStats() {
        return {
            totalRounds: this.currentRound,
            totalTricks: this.cardEngine ? this.cardEngine.stats.totalTricks : 0,
            team1Tricks: this.scores.team1,
            team2Tricks: this.scores.team2,
            roundWinners: this.roundWinners,
            kotCount: this.roundWinners.filter(r => r.isKot).length,
            historyLength: this.history.length
        };
    }

    /**
     * دریافت تاریخچه بازی
     * @returns {Array}
     */
    getHistory() {
        return this.history;
    }

    // ============================================================
    // بخش ۹: Event System
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
                    console.error(`❌ HokmEngine event listener error:`, error);
                }
            });
        }

        // انتشار در eventBus اصلی
        eventBus.emit(`game:${event}`, data);
    }

    /**
     * پاک کردن تمام شنوندگان
     */
    clearListeners() {
        this.listeners.clear();
    }

    /**
     * لاگ وضعیت بازی
     */
    logStatus() {
        const state = this.getGameState();

        console.log('🎮 HokmEngine Status:');
        console.log('  Game ID:', state.gameId);
        console.log('  Status:', state.status);
        console.log('  Mode:', state.mode);
        console.log('  Round:', state.currentRound);
        console.log('  Score:', `${state.scores.team1}-${state.scores.team2}`);
        console.log('  Trump:', state.trump ? this._getSuitNameFa(state.trump) : 'None');
        console.log('  Hakem:', state.hakem ? `Player ${state.hakem.index}` : 'None');
        console.log('  Dealer:', state.dealer ? `Player ${state.dealer.index}` : 'None');
        console.log('  Current Player:', state.currentPlayer ? `Player ${state.currentPlayer.index}` : 'None');
        console.log('  Players:', state.players.length);
        console.log('  Round Winners:', state.roundWinners.length);
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const hokmEngine = new HokmEngine();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HokmEngine, hokmEngine };
} else {
    window.HokmEngine = HokmEngine;
    window.hokmEngine = hokmEngine;
}

console.log('✅ HokmEngine loaded');
