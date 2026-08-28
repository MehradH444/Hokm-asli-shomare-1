/**
 * ============================================================
 * HOKM MASTER - Ranked Play Mode
 * حالت بازی رقابتی (Ranked)
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل حالت بازی رقابتی است. شامل
 * سیستم Rating ELO، مدیریت League، Promotion/Demotion،
 * محاسبه تغییرات Rating، سیستم Streak، پاداش‌های ویژه،
 * محدودیت‌های Ranked، و آمار کامل.
 * 
 * تفاوت‌های Ranked با Classic:
 * - سیستم Rating و ELO
 * - League و Promotion/Demotion
 * - پاداش‌های ویژه بر اساس عملکرد
 * - محدودیت‌های سخت‌گیرانه‌تر
 * - آمار دقیق‌تر
 * - Leaderboard
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
 * - validationEngine (از فایل validation.js)
 * - leagueManager (از فایل league.js)
 * 
 * ============================================================
 */

class RankedPlayMode {

    constructor() {
        /**
         * وضعیت فعلی حالت بازی
         * @type {string} 'idle' | 'searching' | 'playing' | 'finished' | 'reward'
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
         * Rating فعلی بازیکن
         * @type {number}
         */
        this.currentRating = 1000;

        /**
         * League فعلی بازیکن
         * @type {Object}
         */
        this.currentLeague = {
            tier: 'bronze',
            division: 1,
            points: 0,
            pointsToNext: 100
        };

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
         * تغییرات Rating
         * @type {Object|null}
         */
        this.ratingChange = null;

        /**
         * پاداش بازی
         * @type {Object|null}
         */
        this.reward = null;

        /**
         * Streak فعلی (برد متوالی)
         * @type {number}
         */
        this.currentStreak = 0;

        /**
         * بهترین Streak
         * @type {number}
         */
        this.bestStreak = 0;

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
         * آمار بازی Ranked
         * @type {Object}
         */
        this.stats = {
            totalGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            currentRating: 1000,
            peakRating: 1000,
            currentLeague: 'bronze',
            peakLeague: 'bronze',
            currentStreak: 0,
            bestStreak: 0,
            totalRatingGained: 0,
            totalRatingLost: 0,
            promotions: 0,
            demotions: 0,
            averageGameDuration: 0,
            totalCoinsEarned: 0,
            totalXpEarned: 0,
            kotCount: 0,
            perfectGames: 0,
            comebackWins: 0
        };

        /**
         * تاریخچه بازی‌های Ranked
         * @type {Array<Object>}
         */
        this.gameHistory = [];

        /**
         * حداکثر تاریخچه
         * @type {number}
         */
        this.maxHistorySize = 100;

        /**
         * محدودیت‌های Ranked
         * @type {Object}
         */
        this.restrictions = {
            minRating: 0,
            maxRating: 3000,
            minGamesForLeague: 10,
            maxDailyGames: 50,
            dailyGamesPlayed: 0,
            lastDailyReset: null
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

            this.currentRating = user.profile?.rating || 1000;
            this.currentLeague = user.profile?.league || this.currentLeague;
            this.currentStreak = user.profile?.currentStreak || 0;
            this.bestStreak = user.profile?.bestStreak || 0;
        }

        // بارگذاری آمار ذخیره شده
        this._loadStats();

        // بررسی Reset روزانه
        this._checkDailyReset();

        if (this.debug) {
            console.log('🏆 RankedPlayMode initialized');
            console.log('  Current Rating:', this.currentRating);
            console.log('  Current League:', this.currentLeague.tier);
        }
    }

    // ============================================================
    // بخش ۱: شروع بازی Ranked
    // ============================================================

    /**
     * شروع بازی Ranked
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    startRanked(options = {}) {
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
                message: 'برای بازی Ranked باید وارد شوید'
            };
        }

        // بررسی محدودیت روزانه
        if (this.restrictions.dailyGamesPlayed >= this.restrictions.maxDailyGames) {
            return {
                success: false,
                error: 'DAILY_LIMIT_REACHED',
                message: `محدودیت روزانه ${this.restrictions.maxDailyGames} بازی رسیده‌اید`
            };
        }

        // بررسی حداقل بازی برای League
        if (this.stats.totalGames < this.restrictions.minGamesForLeague && this.currentLeague.tier === 'bronze') {
            // اجازه بازی می‌دهیم اما بدون تغییر League
        }

        const {
            aiLevel = 'normal',
            timeout = 120
        } = options;

        this.status = 'searching';

        this._emit('ranked-searching', {
            rating: this.currentRating,
            league: this.currentLeague,
            timeout
        });

        if (this.debug) {
            console.log('🏆 Ranked search started');
        }

        // شبیه‌سازی پیدا کردن بازیکنان
        this._simulateRankedMatch(aiLevel, timeout);

        return {
            success: true,
            status: 'searching',
            rating: this.currentRating,
            league: this.currentLeague
        };
    }

    /**
     * شبیه‌سازی بازی Ranked
     * @param {string} aiLevel - سطح AI
     * @param {number} timeout - زمان انتظار
     * @private
     */
    _simulateRankedMatch(aiLevel, timeout) {
        const searchDuration = Utils.randomInt(3000, 8000);

        setTimeout(() => {
            if (this.status === 'searching') {
                this._handleMatchFound(aiLevel);
            }
        }, searchDuration);
    }

    /**
     * مدیریت پیدا شدن Match
     * @param {string} aiLevel - سطح AI
     * @private
     */
    _handleMatchFound(aiLevel) {
        // تولید بازیکنان با Rating مشابه
        this.players = this._generateRankedOpponents(aiLevel);

        // تقسیم تیم‌ها
        this._assignTeams();

        this.status = 'playing';
        this.gameId = Utils.generateUUID();
        this.gameStartTime = Date.now();

        // راه‌اندازی HokmEngine
        if (hokmEngine) {
            const result = hokmEngine.startGame(this.players, {
                mode: 'ranked',
                level: aiLevel,
                roundsToWin: 2
            });

            if (result.success) {
                this.gameState = hokmEngine.getGameState();
                this._setupGameListeners();
                this._startDurationTimer();

                this._emit('ranked-game-started', {
                    gameId: this.gameId,
                    players: this.players,
                    teams: this.teams
                });

                if (this.debug) {
                    console.log(' Ranked game started');
                }
            }
        } else {
            this._simulateRankedGame();
        }
    }

    /**
     * تولید حریفان Ranked
     * @param {string} aiLevel - سطح AI
     * @returns {Array<Object>}
     * @private
     */
    _generateRankedOpponents(aiLevel) {
        const opponents = [];
        const ratingRange = 200;

        for (let i = 0; i < 3; i++) {
            const ratingDiff = Utils.randomInt(-ratingRange, ratingRange);
            const opponentRating = Math.max(500, Math.min(3000, this.currentRating + ratingDiff));

            opponents.push({
                id: Utils.generateUUID(),
                username: `Ranked_${Utils.randomInt(1000, 9999)}`,
                isAI: true,
                aiLevel: aiLevel,
                rating: opponentRating,
                league: this._getLeagueFromRating(opponentRating),
                avatar: Utils.randomInt(1, 50)
            });
        }

        return [this.player, ...opponents];
    }

    /**
     * دریافت League از Rating
     * @param {number} rating - Rating
     * @returns {string} League tier
     * @private
     */
    _getLeagueFromRating(rating) {
        if (rating >= 2500) return 'diamond';
        if (rating >= 2000) return 'platinum';
        if (rating >= 1500) return 'gold';
        if (rating >= 1000) return 'silver';
        return 'bronze';
    }

    /**
     * تقسیم تیم‌ها
     * @private
     */
    _assignTeams() {
        this.teams = {
            team1: [this.players[0], this.players[2]],
            team2: [this.players[1], this.players[3]]
        };

        this.players.forEach((player, index) => {
            player.team = index % 2 === 0 ? 'team1' : 'team2';
        });
    }

    // ============================================================
    // بخش ۲: Gameplay
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
    // بخش ۳: پایان بازی و محاسبه Rating
    // ============================================================

    /**
     * شبیه‌سازی پایان بازی Ranked
     * @private
     */
    _simulateRankedGame() {
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

        // محاسبه تغییرات Rating
        this._calculateRatingChange(result);

        // محاسبه پاداش
        this._calculateReward(result);

        // به‌روزرسانی آمار
        this._updateStats(result);

        // ذخیره در تاریخچه
        this._addToHistory(result);

        // بررسی Promotion/Demotion
        this._checkLeagueChange();

        this._emit('ranked-game-ended', {
            result,
            ratingChange: this.ratingChange,
            reward: this.reward
        });

        if (this.debug) {
            console.log(' Ranked game ended');
            console.log('  Rating Change:', this.ratingChange?.change || 0);
        }
    }

    /**
     * محاسبه تغییرات Rating
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _calculateRatingChange(result) {
        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;
        const isWinner = team === result.winner;

        // محاسبه Rating میانگین حریفان
        const opponents = this.players.filter(p => p.id !== this.player.id);
        const averageOpponentRating = opponents.reduce((sum, p) => sum + (p.rating || 1000), 0) / opponents.length;

        // فرمول ELO
        const expectedScore = 1 / (1 + Math.pow(10, (averageOpponentRating - this.currentRating) / 400));
        const actualScore = isWinner ? 1 : 0;

        // K Factor بر اساس Rating
        let kFactor = 32;
        if (this.currentRating < 1200) kFactor = 40;
        else if (this.currentRating < 1600) kFactor = 32;
        else if (this.currentRating < 2000) kFactor = 24;
        else kFactor = 16;

        // محاسبه تغییر پایه
        let ratingChange = Math.round(kFactor * (actualScore - expectedScore));

        // پاداش Kot
        if (result.isKot && isWinner) {
            ratingChange += 10;
        }

        // پاداش Streak
        if (isWinner && this.currentStreak > 0) {
            const streakBonus = Math.min(this.currentStreak * 2, 20);
            ratingChange += streakBonus;
        }

        // محدود کردن تغییر
        const maxChange = 50;
        ratingChange = Math.max(-maxChange, Math.min(maxChange, ratingChange));

        // اگر باخت، حداقل تغییر
        if (!isWinner && ratingChange > -10) {
            ratingChange = -10;
        }

        const newRating = Math.max(0, Math.min(3000, this.currentRating + ratingChange));

        this.ratingChange = {
            change: ratingChange,
            oldRating: this.currentRating,
            newRating,
            isWinner,
            kFactor,
            expectedScore,
            actualScore,
            kotBonus: result.isKot && isWinner ? 10 : 0,
            streakBonus: isWinner ? Math.min(this.currentStreak * 2, 20) : 0
        };

        this.currentRating = newRating;

        // به‌روزرسانی Peak Rating
        if (newRating > this.stats.peakRating) {
            this.stats.peakRating = newRating;
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
                coins: 200,
                xp: 100,
                ratingChange: this.ratingChange?.change || 0
            };
            return;
        }

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;

        const gameResult = {
            mode: 'ranked',
            level: 'normal',
            isWinner: team === result.winner,
            tricksWon: result.score?.[team] || 0,
            totalTricks: 26,
            isKot: result.isKot || false,
            roundDuration: this.gameDuration
        };

        const playerProfile = this.player?.profile || {};

        this.reward = scoringEngine.calculateFullReward(gameResult, playerProfile);

        // اضافه کردن تغییر Rating به پاداش
        if (this.reward && this.ratingChange) {
            this.reward.ratingChange = this.ratingChange.change;
        }

        if (this.debug) {
            console.log(' Ranked reward calculated:', this.reward);
        }
    }

    /**
     * به‌روزرسانی آمار
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _updateStats(result) {
        this.stats.totalGames++;

        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;
        const isWinner = team === result.winner;

        if (isWinner) {
            this.stats.wins++;
            this.currentStreak++;
            if (this.currentStreak > this.bestStreak) {
                this.bestStreak = this.currentStreak;
            }
        } else if (result.winner === 'draw') {
            this.stats.draws++;
            this.currentStreak = 0;
        } else {
            this.stats.losses++;
            this.currentStreak = 0;
        }

        this.stats.winRate = (this.stats.wins / this.stats.totalGames) * 100;
        this.stats.currentStreak = this.currentStreak;
        this.stats.bestStreak = this.bestStreak;

        // به‌روزرسانی Rating در آمار
        this.stats.currentRating = this.currentRating;

        // به‌روزرسانی League
        this.stats.currentLeague = this.currentLeague.tier;

        // به‌روزرسانی میانگین مدت زمان
        this.stats.averageGameDuration =
            ((this.stats.averageGameDuration * (this.stats.totalGames - 1)) + this.gameDuration) /
            this.stats.totalGames;

        if (this.reward) {
            this.stats.totalCoinsEarned += this.reward.coins || 0;
            this.stats.totalXpEarned += this.reward.xp || 0;
        }

        if (this.ratingChange) {
            if (this.ratingChange.change > 0) {
                this.stats.totalRatingGained += this.ratingChange.change;
            } else {
                this.stats.totalRatingLost += Math.abs(this.ratingChange.change);
            }
        }

        // بررسی بازی کامل
        if (result.score?.[team] === 26) {
            this.stats.perfectGames++;
        }

        // بررسی Comeback
        if (isWinner && result.score?.[team] < 10) {
            this.stats.comebackWins++;
        }

        // به‌روزرسانی محدودیت روزانه
        this.restrictions.dailyGamesPlayed++;

        // ذخیره آمار
        this._saveStats();
    }

    /**
     * بررسی تغییر League
     * @private
     */
    _checkLeagueChange() {
        const newLeague = this._getLeagueFromRating(this.currentRating);
        const oldLeague = this.currentLeague.tier;

        if (newLeague !== oldLeague) {
            const leagueOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
            const oldIndex = leagueOrder.indexOf(oldLeague);
            const newIndex = leagueOrder.indexOf(newLeague);

            if (newIndex > oldIndex) {
                // Promotion
                this.stats.promotions++;
                this._emit('league-promoted', {
                    oldLeague,
                    newLeague,
                    rating: this.currentRating
                });

                if (this.debug) {
                    console.log(`🎉 Promoted to ${newLeague}!`);
                }
            } else {
                // Demotion
                this.stats.demotions++;
                this._emit('league-demoted', {
                    oldLeague,
                    newLeague,
                    rating: this.currentRating
                });

                if (this.debug) {
                    console.log(` Demoted to ${newLeague}`);
                }
            }

            this.currentLeague.tier = newLeague;
            this.currentLeague.points = 0;
        }

        // به‌روزرسانی Peak League
        const peakLeagueOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
        if (peakLeagueOrder.indexOf(newLeague) > peakLeagueOrder.indexOf(this.stats.peakLeague)) {
            this.stats.peakLeague = newLeague;
        }
    }

    // ============================================================
    // بخش ۴: دریافت پاداش
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

        this._emit('ranked-reward-claimed', {
            reward: this.reward,
            ratingChange: this.ratingChange
        });

        if (this.debug) {
            console.log('💰 Ranked reward claimed');
        }

        return {
            success: true,
            reward: this.reward,
            ratingChange: this.ratingChange
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
            this.player.profile.rating = this.currentRating;
            this.player.profile.league = this.currentLeague;
            this.player.profile.currentStreak = this.currentStreak;
            this.player.profile.bestStreak = this.bestStreak;

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
            ratingChange: this.ratingChange,
            gameResult: this.gameResult,
            duration: this.gameDuration,
            canClaim: this.status === 'finished' && this.reward !== null
        };
    }

    // ============================================================
    // بخش : تاریخچه و آمار
    // ============================================================

    /**
     * اضافه کردن به تاریخچه
     * @param {Object} result - نتیجه بازی
     * @private
     */
    _addToHistory(result) {
        const playerIndex = this.players.findIndex(p => p.id === this.player.id);
        const team = this.players[playerIndex]?.team;

        const historyEntry = {
            gameId: this.gameId,
            timestamp: Date.now(),
            result: 'win',
            ratingChange: this.ratingChange?.change || 0,
            oldRating: this.ratingChange?.oldRating || this.currentRating,
            newRating: this.ratingChange?.newRating || this.currentRating,
            duration: this.gameDuration,
            opponents: this.players.filter(p => p.id !== this.player.id).map(p => ({
                username: p.username,
                rating: p.rating
            })),
            score: result.score,
            isKot: result.isKot || false,
            streak: this.currentStreak
        };

        this.gameHistory.push(historyEntry);

        if (this.gameHistory.length > this.maxHistorySize) {
            this.gameHistory.shift();
        }
    }

    /**
     * دریافت تاریخچه بازی‌ها
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getGameHistory(limit = 20) {
        return this.gameHistory.slice(-limit).reverse();
    }

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            currentRating: this.currentRating,
            currentLeague: this.currentLeague,
            currentStreak: this.currentStreak,
            bestStreak: this.bestStreak,
            dailyGamesPlayed: this.restrictions.dailyGamesPlayed,
            dailyGamesRemaining: this.restrictions.maxDailyGames - this.restrictions.dailyGamesPlayed
        };
    }

    /**
     * دریافت پیشرفت League
     * @returns {Object}
     */
    getLeagueProgress() {
        const leagueTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
        const currentIndex = leagueTiers.indexOf(this.currentLeague.tier);
        const nextTier = leagueTiers[currentIndex + 1];

        const tierRanges = {
            bronze: { min: 0, max: 999 },
            silver: { min: 1000, max: 1499 },
            gold: { min: 1500, max: 1999 },
            platinum: { min: 2000, max: 2499 },
            diamond: { min: 2500, max: 2999 },
            master: { min: 3000, max: 9999 }
        };

        const currentRange = tierRanges[this.currentLeague.tier];
        const progress = ((this.currentRating - currentRange.min) / (currentRange.max - currentRange.min + 1)) * 100;

        return {
            currentTier: this.currentLeague.tier,
            currentRating: this.currentRating,
            progress: Math.min(100, Math.max(0, progress)),
            nextTier: nextTier || null,
            ratingToNext: nextTier ? tierRanges[nextTier].min - this.currentRating : 0,
            isMaxTier: !nextTier
        };
    }

    // ============================================================
    // بخش ۶: بازگشت و بازی مجدد
    // ============================================================

    /**
     * بازگشت به صفحه اصلی
     * @returns {Object} نتیجه
     */
    returnToHome() {
        this._cleanup();

        this._emit('ranked-returned-to-home');

        if (this.debug) {
            console.log('🏠 Returned to home from Ranked');
        }

        return {
            success: true
        };
    }

    /**
     * بازی مجدد Ranked
     * @returns {Object} نتیجه
     */
    playAgain() {
        this._cleanup();

        return this.startRanked({
            aiLevel: 'normal'
        });
    }

    // ============================================================
    // بخش ۷: پاکسازی
    // ============================================================

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
        this.ratingChange = null;
        this.reward = null;
        this.gameStartTime = null;
        this.gameDuration = 0;

        this._stopDurationTimer();

        if (hokmEngine) {
            hokmEngine.clearListeners();
        }

        if (this.debug) {
            console.log('🧹 RankedPlayMode cleaned up');
        }
    }

    /**
     * ریست کامل
     */
    reset() {
        this._cleanup();

        this.stats = {
            totalGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            currentRating: 1000,
            peakRating: 1000,
            currentLeague: 'bronze',
            peakLeague: 'bronze',
            currentStreak: 0,
            bestStreak: 0,
            totalRatingGained: 0,
            totalRatingLost: 0,
            promotions: 0,
            demotions: 0,
            averageGameDuration: 0,
            totalCoinsEarned: 0,
            totalXpEarned: 0,
            kotCount: 0,
            perfectGames: 0,
            comebackWins: 0
        };

        this.gameHistory = [];
        this.currentRating = 1000;
        this.currentLeague = { tier: 'bronze', division: 1, points: 0, pointsToNext: 100 };
        this.currentStreak = 0;
        this.bestStreak = 0;

        if (this.debug) {
            console.log('🔄 RankedPlayMode reset');
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
            storage.set('ranked_stats', this.stats);
            storage.set('ranked_history', this.gameHistory);
        }
    }

    /**
     * بارگذاری آمار
     * @private
     */
    _loadStats() {
        if (storage) {
            const savedStats = storage.get('ranked_stats');
            if (savedStats) {
                this.stats = { ...this.stats, ...savedStats };
            }

            const savedHistory = storage.get('ranked_history');
            if (savedHistory) {
                this.gameHistory = savedHistory;
            }
        }
    }

    /**
     * بررسی Reset روزانه
     * @private
     */
    _checkDailyReset() {
        const today = new Date().toDateString();
        const lastReset = this.restrictions.lastDailyReset;

        if (lastReset !== today) {
            this.restrictions.dailyGamesPlayed = 0;
            this.restrictions.lastDailyReset = today;

            if (this.debug) {
                console.log(' Daily games reset');
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
            currentRating: this.currentRating,
            currentLeague: this.currentLeague,
            currentStreak: this.currentStreak,
            bestStreak: this.bestStreak,
            gameState: this.gameState,
            gameResult: this.gameResult,
            ratingChange: this.ratingChange,
            reward: this.reward,
            duration: this.gameDuration
        };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const status = this.getStatus();
        const stats = this.getStats();

        console.log('🏆 RankedPlayMode Status:');
        console.log('  Status:', status.status);
        console.log('  Rating:', status.currentRating);
        console.log('  League:', status.currentLeague.tier);
        console.log('  Streak:', status.currentStreak);
        console.log('  Best Streak:', status.bestStreak);
        console.log('  Total Games:', stats.totalGames);
        console.log('  Wins:', stats.wins);
        console.log('  Losses:', stats.losses);
        console.log('  Win Rate:', stats.winRate.toFixed(1) + '%');
        console.log('  Peak Rating:', stats.peakRating);
        console.log('  Peak League:', stats.peakLeague);
        console.log('  Promotions:', stats.promotions);
        console.log('  Demotions:', stats.demotions);
        console.log('  Daily Games:', `${stats.dailyGamesPlayed}/${this.restrictions.maxDailyGames}`);
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
                    console.error(`❌ RankedPlay event listener error:`, error);
                }
            });
        }

        eventBus.emit(`ranked-play:${event}`, data);
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
const rankedPlayMode = new RankedPlayMode();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RankedPlayMode, rankedPlayMode };
} else {
    window.RankedPlayMode = RankedPlayMode;
    window.rankedPlayMode = rankedPlayMode;
}

console.log('✅ RankedPlayMode loaded');
