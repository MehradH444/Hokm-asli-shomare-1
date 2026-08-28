/**
 * ============================================================
 * HOKM MASTER - Tournament Mode
 * حالت بازی تورنمنت
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم تورنمنت است. شامل
 * ایجاد تورنمنت، ثبت‌نام، سیستم Bracket (حذفی)، مدیریت
 * مراحل، پاداش‌ها، آمار، و Leaderboard تورنمنت.
 * 
 * انواع تورنمنت:
 * - Single Elimination (حذفی تک)
 * - Double Elimination (حذفی دوگانه)
 * - Round Robin (دوره‌ای)
 * - Swiss System (سوئیسی)
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
 * - scoringEngine (از فایل scoring.js)
 * - roomManager (از فایل room.js)
 * 
 * ============================================================
 */

class TournamentMode {

    constructor() {
        /**
         * وضعیت فعلی
         * @type {string} 'idle' | 'browsing' | 'registered' | 'playing' | 'finished'
         */
        this.status = 'idle';

        /**
         * تورنمنت فعلی
         * @type {Object|null}
         */
        this.currentTournament = null;

        /**
         * اطلاعات بازیکن
         * @type {Object|null}
         */
        this.player = null;

        /**
         * لیست تورنمنت‌های موجود
         * @type {Array<Object>}
         */
        this.availableTournaments = [];

        /**
         * Bracket تورنمنت فعلی
         * @type {Object|null}
         */
        this.bracket = null;

        /**
         * مرحله فعلی بازیکن در تورنمنت
         * @type {Object|null}
         */
        this.currentMatch = null;

        /**
         * نتیجه تورنمنت
         * @type {Object|null}
         */
        this.tournamentResult = null;

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
         * آمار تورنمنت
         * @type {Object}
         */
        this.stats = {
            totalTournaments: 0,
            tournamentsWon: 0,
            tournamentsEntered: 0,
            totalMatches: 0,
            matchesWon: 0,
            matchesLost: 0,
            winRate: 0,
            totalPrizeEarned: 0,
            bestFinish: null,
            averageFinish: 0
        };

        /**
         * تاریخچه تورنمنت‌ها
         * @type {Array<Object>}
         */
        this.tournamentHistory = [];

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        const user = authManager?.getCurrentUser();
        if (user) {
            this.player = {
                id: user.id,
                username: user.username,
                profile: user.profile
            };
        }

        this._loadStats();
        this._loadTournaments();

        if (this.debug) {
            console.log(' TournamentMode initialized');
        }
    }

    // ============================================================
    // بخش ۱: مدیریت تورنمنت‌ها
    // ============================================================

    /**
     * دریافت لیست تورنمنت‌های موجود
     * @returns {Array<Object>}
     */
    getAvailableTournaments() {
        return this.availableTournaments.filter(t => 
            t.status === 'upcoming' || t.status === 'registering'
        );
    }

    /**
     * دریافت تورنمنت‌های فعال
     * @returns {Array<Object>}
     */
    getActiveTournaments() {
        return this.availableTournaments.filter(t => 
            t.status === 'active'
        );
    }

    /**
     * دریافت تورنمنت‌های تکمیل شده
     * @returns {Array<Object>}
     */
    getCompletedTournaments() {
        return this.availableTournaments.filter(t => 
            t.status === 'completed'
        );
    }

    /**
     * دریافت جزئیات تورنمنت
     * @param {string} tournamentId - شناسه تورنمنت
     * @returns {Object|null}
     */
    getTournamentDetails(tournamentId) {
        return this.availableTournaments.find(t => t.id === tournamentId) || null;
    }

    /**
     * ایجاد تورنمنت جدید (فقط برای تست)
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    createTournament(options = {}) {
        const {
            name = 'Tournament',
            type = 'single_elimination',
            maxPlayers = 16,
            entryFee = 1000,
            prizePool = 10000,
            startDate = Date.now() + 3600000,
            aiLevel = 'hard'
        } = options;

        const tournament = {
            id: Utils.generateUUID(),
            name,
            type,
            maxPlayers,
            currentPlayers: 0,
            entryFee,
            prizePool,
            startDate,
            status: 'registering',
            aiLevel,
            bracket: null,
            participants: [],
            winner: null,
            createdAt: Date.now()
        };

        this.availableTournaments.push(tournament);
        this._saveTournaments();

        this._emit('tournament-created', { tournament });

        if (this.debug) {
            console.log(`🏆 Tournament created: ${name}`);
        }

        return {
            success: true,
            tournament
        };
    }

    // ============================================================
    // بخش ۲: ثبت‌نام در تورنمنت
    // ============================================================

    /**
     * ثبت‌نام در تورنمنت
     * @param {string} tournamentId - شناسه تورنمنت
     * @returns {Object} نتیجه
     */
    registerForTournament(tournamentId) {
        if (this.status !== 'idle' && this.status !== 'browsing') {
            return {
                success: false,
                error: 'TOURNAMENT_IN_PROGRESS',
                message: 'شما در حال حاضر در یک تورنمنت هستید'
            };
        }

        if (!this.player) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای ثبت‌نام باید وارد شوید'
            };
        }

        const tournament = this.availableTournaments.find(t => t.id === tournamentId);
        if (!tournament) {
            return {
                success: false,
                error: 'TOURNAMENT_NOT_FOUND',
                message: 'تورنمنت یافت نشد'
            };
        }

        if (tournament.status !== 'registering' && tournament.status !== 'upcoming') {
            return {
                success: false,
                error: 'REGISTRATION_CLOSED',
                message: 'ثبت‌نام بسته شده است'
            };
        }

        if (tournament.currentPlayers >= tournament.maxPlayers) {
            return {
                success: false,
                error: 'TOURNAMENT_FULL',
                message: 'تورنمنت پر است'
            };
        }

        // بررسی تکراری نبودن
        if (tournament.participants.some(p => p.id === this.player.id)) {
            return {
                success: false,
                error: 'ALREADY_REGISTERED',
                message: 'شما قبلاً ثبت‌نام کرده‌اید'
            };
        }

        // بررسی موجودی
        if (this.player.profile.coins < tournament.entryFee) {
            return {
                success: false,
                error: 'INSUFFICIENT_FUNDS',
                message: 'سکه کافی ندارید'
            };
        }

        // کسر ورودی
        this.player.profile.coins -= tournament.entryFee;
        if (storage) {
            storage.saveUserProfile(this.player);
        }

        // اضافه کردن به شرکت‌کنندگان
        tournament.participants.push({
            id: this.player.id,
            username: this.player.username,
            rating: this.player.profile.rating,
            registeredAt: Date.now()
        });

        tournament.currentPlayers++;

        // بررسی شروع تورنمنت
        if (tournament.currentPlayers >= tournament.maxPlayers) {
            tournament.status = 'active';
            this._startTournament(tournament);
        }

        this.status = 'registered';
        this.currentTournament = tournament;
        this.stats.tournamentsEntered++;

        this._emit('tournament-registered', {
            tournament,
            player: this.player
        });

        if (this.debug) {
            console.log(`✅ Registered for tournament: ${tournament.name}`);
        }

        return {
            success: true,
            tournament,
            position: tournament.currentPlayers
        };
    }

    /**
     * انصراف از تورنمنت
     * @param {string} tournamentId - شناسه تورنمنت
     * @returns {Object} نتیجه
     */
    withdrawFromTournament(tournamentId) {
        const tournament = this.availableTournaments.find(t => t.id === tournamentId);
        if (!tournament) {
            return {
                success: false,
                error: 'TOURNAMENT_NOT_FOUND',
                message: 'تورنمنت یافت نشد'
            };
        }

        const participantIndex = tournament.participants.findIndex(p => p.id === this.player.id);
        if (participantIndex === -1) {
            return {
                success: false,
                error: 'NOT_REGISTERED',
                message: 'شما ثبت‌نام نکرده‌اید'
            };
        }

        if (tournament.status === 'active') {
            return {
                success: false,
                error: 'TOURNAMENT_STARTED',
                message: 'تورنمنت شروع شده است'
            };
        }

        // بازگشت ورودی (50%)
        const refund = Math.floor(tournament.entryFee * 0.5);
        this.player.profile.coins += refund;
        if (storage) {
            storage.saveUserProfile(this.player);
        }

        tournament.participants.splice(participantIndex, 1);
        tournament.currentPlayers--;

        this.status = 'idle';
        this.currentTournament = null;

        this._emit('tournament-withdrawn', {
            tournament,
            refund
        });

        if (this.debug) {
            console.log(`❌ Withdrawn from tournament: ${tournament.name}`);
        }

        return {
            success: true,
            refund
        };
    }

    // ============================================================
    // بخش ۳: سیستم Bracket
    // ============================================================

    /**
     * شروع تورنمنت
     * @param {Object} tournament - تورنمنت
     * @private
     */
    _startTournament(tournament) {
        // ایجاد Bracket
        this.bracket = this._createBracket(tournament);

        tournament.bracket = this.bracket;
        tournament.status = 'active';
        tournament.startedAt = Date.now();

        this._emit('tournament-started', {
            tournament,
            bracket: this.bracket
        });

        if (this.debug) {
            console.log(` Tournament started: ${tournament.name}`);
        }
    }

    /**
     * ایجاد Bracket
     * @param {Object} tournament - تورنمنت
     * @returns {Object} Bracket
     * @private
     */
    _createBracket(tournament) {
        const participants = [...tournament.participants];
        const type = tournament.type;

        switch (type) {
            case 'single_elimination':
                return this._createSingleEliminationBracket(participants);
            case 'double_elimination':
                return this._createDoubleEliminationBracket(participants);
            case 'round_robin':
                return this._createRoundRobinBracket(participants);
            case 'swiss':
                return this._createSwissBracket(participants);
            default:
                return this._createSingleEliminationBracket(participants);
        }
    }

    /**
     * ایجاد Bracket حذفی تک
     * @param {Array} participants - شرکت‌کنندگان
     * @returns {Object}
     * @private
     */
    _createSingleEliminationBracket(participants) {
        const rounds = [];
        let currentRound = participants.map((p, index) => ({
            id: Utils.generateUUID(),
            player1: p,
            player2: participants[index + 1] || null,
            winner: null,
            round: 1
        }));

        rounds.push(currentRound);

        // ایجاد دورهای بعدی
        let roundNumber = 2;
        while (currentRound.length > 1) {
            const nextRound = [];
            for (let i = 0; i < currentRound.length; i += 2) {
                nextRound.push({
                    id: Utils.generateUUID(),
                    player1: null,
                    player2: null,
                    winner: null,
                    round: roundNumber
                });
            }
            rounds.push(nextRound);
            currentRound = nextRound;
            roundNumber++;
        }

        return {
            type: 'single_elimination',
            rounds,
            currentRound: 1
        };
    }

    /**
     * ایجاد Bracket حذفی دوگانه
     * @param {Array} participants - شرکت‌کنندگان
     * @returns {Object}
     * @private
     */
    _createDoubleEliminationBracket(participants) {
        const winnersBracket = this._createSingleEliminationBracket(participants);
        
        return {
            type: 'double_elimination',
            winnersBracket,
            losersBracket: null,
            currentRound: 1
        };
    }

    /**
     * ایجاد Bracket دوره‌ای
     * @param {Array} participants - شرکت‌کنندگان
     * @returns {Object}
     * @private
     */
    _createRoundRobinBracket(participants) {
        const matches = [];
        
        for (let i = 0; i < participants.length; i++) {
            for (let j = i + 1; j < participants.length; j++) {
                matches.push({
                    id: Utils.generateUUID(),
                    player1: participants[i],
                    player2: participants[j],
                    winner: null,
                    round: 1
                });
            }
        }

        return {
            type: 'round_robin',
            matches,
            standings: participants.map(p => ({
                player: p,
                wins: 0,
                losses: 0,
                points: 0
            }))
        };
    }

    /**
     * ایجاد Bracket سوئیسی
     * @param {Array} participants - شرکت‌کنندگان
     * @returns {Object}
     * @private
     */
    _createSwissBracket(participants) {
        return {
            type: 'swiss',
            rounds: [],
            standings: participants.map(p => ({
                player: p,
                wins: 0,
                losses: 0,
                points: 0
            })),
            currentRound: 0,
            maxRounds: Math.ceil(Math.log2(participants.length))
        };
    }

    // ============================================================
    // بخش ۴: مدیریت مسابقات
    // ============================================================

    /**
     * دریافت مسابقه بعدی بازیکن
     * @returns {Object|null}
     */
    getNextMatch() {
        if (!this.bracket || !this.currentTournament) {
            return null;
        }

        const playerId = this.player.id;

        // جستجو در Bracket
        for (const round of this.bracket.rounds) {
            for (const match of round) {
                if (match.player1?.id === playerId || match.player2?.id === playerId) {
                    if (!match.winner) {
                        return match;
                    }
                }
            }
        }

        return null;
    }

    /**
     * شروع مسابقه
     * @param {string} matchId - شناسه مسابقه
     * @returns {Object} نتیجه
     */
    startMatch(matchId) {
        if (this.status !== 'registered') {
            return {
                success: false,
                error: 'NOT_REGISTERED',
                message: 'شما ثبت‌نام نکرده‌اید'
            };
        }

        const match = this._findMatch(matchId);
        if (!match) {
            return {
                success: false,
                error: 'MATCH_NOT_FOUND',
                message: 'مسابقه یافت نشد'
            };
        }

        if (match.winner) {
            return {
                success: false,
                error: 'MATCH_COMPLETED',
                message: 'مسابقه قبلاً انجام شده است'
            };
        }

        this.status = 'playing';
        this.currentMatch = match;

        this._emit('match-started', {
            match,
            tournament: this.currentTournament
        });

        if (this.debug) {
            console.log(`⚔️ Match started: ${match.player1.username} vs ${match.player2?.username || 'TBD'}`);
        }

        return {
            success: true,
            match
        };
    }

    /**
     * پایان مسابقه
     * @param {string} matchId - شناسه مسابقه
     * @param {string} winnerId - شناسه برنده
     * @returns {Object} نتیجه
     */
    endMatch(matchId, winnerId) {
        const match = this._findMatch(matchId);
        if (!match) {
            return {
                success: false,
                error: 'MATCH_NOT_FOUND',
                message: 'مسابقه یافت نشد'
            };
        }

        match.winner = match.player1.id === winnerId ? match.player1 : match.player2;
        this.stats.totalMatches++;

        if (winnerId === this.player.id) {
            this.stats.matchesWon++;
        } else {
            this.stats.matchesLost++;
        }

        this.stats.winRate = (this.stats.matchesWon / this.stats.totalMatches) * 100;

        // به‌روزرسانی Bracket
        this._updateBracket(match);

        this._emit('match-ended', {
            match,
            winner: match.winner
        });

        if (this.debug) {
            console.log(`🏁 Match ended: ${match.winner.username} won`);
        }

        return {
            success: true,
            match,
            winner: match.winner
        };
    }

    /**
     * پیدا کردن مسابقه
     * @param {string} matchId - شناسه
     * @returns {Object|null}
     * @private
     */
    _findMatch(matchId) {
        if (!this.bracket) return null;

        for (const round of this.bracket.rounds) {
            const match = round.find(m => m.id === matchId);
            if (match) return match;
        }

        return null;
    }

    /**
     * به‌روزرسانی Bracket
     * @param {Object} completedMatch - مسابقه تکمیل شده
     * @private
     */
    _updateBracket(completedMatch) {
        const currentRoundIndex = this.bracket.rounds.findIndex(r => 
            r.some(m => m.id === completedMatch.id)
        );

        if (currentRoundIndex === -1) return;

        const nextRoundIndex = currentRoundIndex + 1;
        if (nextRoundIndex >= this.bracket.rounds.length) {
            // تورنمنت تمام شد
            this._completeTournament(completedMatch.winner);
            return;
        }

        const nextRound = this.bracket.rounds[nextRoundIndex];
        const matchIndex = Math.floor(this.bracket.rounds[currentRoundIndex].indexOf(completedMatch) / 2);

        if (nextRound[matchIndex]) {
            if (!nextRound[matchIndex].player1) {
                nextRound[matchIndex].player1 = completedMatch.winner;
            } else {
                nextRound[matchIndex].player2 = completedMatch.winner;
            }
        }
    }

    // ============================================================
    // بخش ۵: پایان تورنمنت
    // ============================================================

    /**
     * تکمیل تورنمنت
     * @param {Object} winner - برنده
     * @private
     */
    _completeTournament(winner) {
        this.status = 'finished';
        this.currentTournament.status = 'completed';
        this.currentTournament.winner = winner;
        this.currentTournament.completedAt = Date.now();

        this.tournamentResult = {
            tournament: this.currentTournament,
            winner,
            playerPosition: this._getPlayerPosition(),
            prize: this._calculatePrize()
        };

        this.stats.totalTournaments++;
        if (winner.id === this.player.id) {
            this.stats.tournamentsWon++;
            this.stats.bestFinish = 1;
        }

        // اضافه کردن به تاریخچه
        this.tournamentHistory.push({
            tournament: this.currentTournament,
            position: this._getPlayerPosition(),
            prize: this.tournamentResult.prize,
            completedAt: Date.now()
        });

        // اعطای پاداش
        this._awardPrize(this.tournamentResult.prize);

        this._saveStats();
        this._saveTournaments();

        this._emit('tournament-completed', {
            result: this.tournamentResult
        });

        if (this.debug) {
            console.log(`🏆 Tournament completed! Winner: ${winner.username}`);
        }
    }

    /**
     * محاسبه موقعیت بازیکن
     * @returns {number}
     * @private
     */
    _getPlayerPosition() {
        if (!this.bracket) return 0;

        const totalPlayers = this.currentTournament.currentPlayers;
        const currentRound = this.bracket.currentRound;
        const totalRounds = this.bracket.rounds.length;

        if (currentRound === totalRounds) {
            return 1; // برنده
        }

        return Math.pow(2, totalRounds - currentRound);
    }

    /**
     * محاسبه پاداش
     * @returns {number}
     * @private
     */
    _calculatePrize() {
        const position = this._getPlayerPosition();
        const prizePool = this.currentTournament.prizePool;

        if (position === 1) return prizePool * 0.5;
        if (position === 2) return prizePool * 0.3;
        if (position <= 4) return prizePool * 0.1;
        if (position <= 8) return prizePool * 0.05;

        return 0;
    }

    /**
     * اعطای پاداش
     * @param {number} prize - مبلغ پاداش
     * @private
     */
    _awardPrize(prize) {
        if (prize > 0 && this.player) {
            this.player.profile.coins += prize;
            this.stats.totalPrizeEarned += prize;

            if (storage) {
                storage.saveUserProfile(this.player);
            }

            if (this.debug) {
                console.log(`💰 Prize awarded: ${prize} coins`);
            }
        }
    }

    // ============================================================
    // بخش ۶: آمار و تاریخچه
    // ============================================================

    /**
     * دریافت آمار تورنمنت
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            tournamentsEntered: this.tournamentHistory.length,
            averageFinish: this.tournamentHistory.length > 0 ?
                this.tournamentHistory.reduce((sum, t) => sum + t.position, 0) / this.tournamentHistory.length : 0
        };
    }

    /**
     * دریافت تاریخچه تورنمنت‌ها
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getTournamentHistory(limit = 20) {
        return this.tournamentHistory.slice(-limit).reverse();
    }

    /**
     * دریافت Leaderboard تورنمنت
     * @param {string} tournamentId - شناسه تورنمنت
     * @returns {Array<Object>}
     */
    getTournamentLeaderboard(tournamentId) {
        const tournament = this.availableTournaments.find(t => t.id === tournamentId);
        if (!tournament) return [];

        return tournament.participants
            .map(p => ({
                ...p,
                position: 0,
                wins: 0,
                losses: 0
            }))
            .sort((a, b) => b.rating - a.rating);
    }

    // ============================================================
    // بخش ۷: کنترل‌ها
    // ============================================================

    /**
     * بازگشت به حالت مرور
     * @returns {Object} نتیجه
     */
    returnToBrowsing() {
        if (this.status === 'playing') {
            return {
                success: false,
                error: 'MATCH_IN_PROGRESS',
                message: 'مسابقه در حال انجام است'
            };
        }

        this.status = 'browsing';
        this.currentMatch = null;

        this._emit('returned-to-browsing');

        return {
            success: true
        };
    }

    /**
     * بازگشت به صفحه اصلی
     * @returns {Object} نتیجه
     */
    returnToHome() {
        this.status = 'idle';
        this.currentTournament = null;
        this.currentMatch = null;
        this.bracket = null;

        this._emit('returned-to-home');

        return {
            success: true
        };
    }

    /**
     * ریست کامل
     */
    reset() {
        this.status = 'idle';
        this.currentTournament = null;
        this.bracket = null;
        this.currentMatch = null;
        this.tournamentResult = null;

        this.stats = {
            totalTournaments: 0,
            tournamentsWon: 0,
            tournamentsEntered: 0,
            totalMatches: 0,
            matchesWon: 0,
            matchesLost: 0,
            winRate: 0,
            totalPrizeEarned: 0,
            bestFinish: null,
            averageFinish: 0
        };

        this.tournamentHistory = [];

        if (this.debug) {
            console.log('🔄 TournamentMode reset');
        }
    }

    // ============================================================
    // بخش ۸: توابع کمکی
    // ============================================================

    /**
     * ذخیره آمار
     * @private
     */
    _saveStats() {
        if (storage) {
            storage.set('tournament_stats', this.stats);
            storage.set('tournament_history', this.tournamentHistory);
        }
    }

    /**
     * بارگذاری آمار
     * @private
     */
    _loadStats() {
        if (storage) {
            const savedStats = storage.get('tournament_stats');
            if (savedStats) {
                this.stats = { ...this.stats, ...savedStats };
            }

            const savedHistory = storage.get('tournament_history');
            if (savedHistory) {
                this.tournamentHistory = savedHistory;
            }
        }
    }

    /**
     * ذخیره تورنمنت‌ها
     * @private
     */
    _saveTournaments() {
        if (storage) {
            storage.set('tournaments', this.availableTournaments);
        }
    }

    /**
     * بارگذاری تورنمنت‌ها
     * @private
     */
    _loadTournaments() {
        if (storage) {
            const saved = storage.get('tournaments');
            if (saved) {
                this.availableTournaments = saved;
            } else {
                // ایجاد تورنمنت‌های نمونه
                this._createSampleTournaments();
            }
        }
    }

    /**
     * ایجاد تورنمنت‌های نمونه
     * @private
     */
    _createSampleTournaments() {
        this.availableTournaments = [
            {
                id: Utils.generateUUID(),
                name: 'Weekly Championship',
                type: 'single_elimination',
                maxPlayers: 16,
                currentPlayers: 12,
                entryFee: 1000,
                prizePool: 10000,
                startDate: Date.now() + 7200000,
                status: 'registering',
                aiLevel: 'hard',
                participants: [],
                winner: null
            },
            {
                id: Utils.generateUUID(),
                name: 'Daily Quick Tournament',
                type: 'single_elimination',
                maxPlayers: 8,
                currentPlayers: 8,
                entryFee: 500,
                prizePool: 3000,
                startDate: Date.now() + 1800000,
                status: 'active',
                aiLevel: 'normal',
                participants: [],
                winner: null
            },
            {
                id: Utils.generateUUID(),
                name: 'Monthly Grand Prix',
                type: 'double_elimination',
                maxPlayers: 32,
                currentPlayers: 24,
                entryFee: 2000,
                prizePool: 50000,
                startDate: Date.now() + 86400000,
                status: 'registering',
                aiLevel: 'expert',
                participants: [],
                winner: null
            }
        ];

        this._saveTournaments();
    }

    /**
     * دریافت وضعیت فعلی
     * @returns {Object}
     */
    getStatus() {
        return {
            status: this.status,
            currentTournament: this.currentTournament,
            currentMatch: this.currentMatch,
            bracket: this.bracket,
            player: this.player
        };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const status = this.getStatus();
        const stats = this.getStats();

        console.log('🏆 TournamentMode Status:');
        console.log('  Status:', status.status);
        console.log('  Current Tournament:', status.currentTournament?.name || 'None');
        console.log('  Total Tournaments:', stats.totalTournaments);
        console.log('  Tournaments Won:', stats.tournamentsWon);
        console.log('  Total Matches:', stats.totalMatches);
        console.log('  Win Rate:', stats.winRate.toFixed(1) + '%');
        console.log('  Total Prize Earned:', stats.totalPrizeEarned);
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
                    console.error(`❌ Tournament event listener error:`, error);
                }
            });
        }

        eventBus.emit(`tournament:${event}`, data);
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
const tournamentMode = new TournamentMode();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TournamentMode, tournamentMode };
} else {
    window.TournamentMode = TournamentMode;
    window.tournamentMode = tournamentMode;
}

console.log('✅ TournamentMode loaded');
