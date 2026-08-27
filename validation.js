/**
 * ============================================================
 * HOKM MASTER - Game Validation Engine
 * موتور اعتبارسنجی و Anti-Cheat بازی حکم
 * ============================================================
 * 
 * این فایل مسئول اعتبارسنجی تمام حرکات و اقدامات بازیکنان
 * در بازی است. شامل بررسی کارت‌های بازی شده، Follow Suit،
 * Trump، نوبت، وضعیت بازی، و تشخیص تقلب.
 * 
 * این موتور با RulesEngine و CardEngine همکاری می‌کند تا
 * تمام قوانین بازی به درستی رعایت شوند.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - cardEngine (از فایل cards.js)
 * - rulesEngine (از فایل rules.js)
 * 
 * ============================================================
 */

class ValidationEngine {

    constructor() {
        /**
         * مرجع CardEngine
         * @type {CardEngine}
         */
        this.cardEngine = null;

        /**
         * مرجع RulesEngine
         * @type {RulesEngine}
         */
        this.rulesEngine = null;

        /**
         * لیست تخلفات ثبت شده
         * @type {Array}
         */
        this.violations = [];

        /**
         * لیست بازیکنان متخلف
         * @type {Map}
         */
        this.suspiciousPlayers = new Map();

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
         * آمار اعتبارسنجی
         * @type {Object}
         */
        this.stats = {
            totalValidations: 0,
            validMoves: 0,
            invalidMoves: 0,
            violationsDetected: 0,
            playersKicked: 0,
            falsePositives: 0
        };

        /**
         * سطح سخت‌گیری Anti-Cheat
         * @type {string} 'low' | 'medium' | 'high' | 'strict'
         */
        this.securityLevel = 'high';

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        if (typeof cardEngine !== 'undefined') {
            this.cardEngine = cardEngine;
        }

        if (typeof rulesEngine !== 'undefined') {
            this.rulesEngine = rulesEngine;
        }

        if (this.debug) {
            console.log('🛡️ ValidationEngine initialized');
            console.log('  Security Level:', this.securityLevel);
        }
    }

    // ============================================================
    // بخش ۱: اعتبارسنجی کارت
    // ============================================================

    /**
     * اعتبارسنجی کامل یک کارت
     * @param {Object} card - کارت
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه اعتبارسنجی
     */
    validateCard(card, hand, gameState) {
        this.stats.totalValidations++;

        const errors = [];
        const warnings = [];

        // ۱. بررسی وجود کارت
        if (!card) {
            errors.push({
                code: 'NO_CARD',
                severity: 'critical',
                message: 'کارت مشخص نشده است'
            });
            return this._createValidationResult(false, errors, warnings);
        }

        // ۲. بررسی ساختار کارت
        if (!card.id || !card.suit || !card.rank) {
            errors.push({
                code: 'INVALID_CARD_STRUCTURE',
                severity: 'critical',
                message: 'ساختار کارت نامعتبر است'
            });
            return this._createValidationResult(false, errors, warnings);
        }

        // ۳. بررسی خال معتبر
        if (!this._isValidSuit(card.suit)) {
            errors.push({
                code: 'INVALID_SUIT',
                severity: 'critical',
                message: `خال نامعتبر: ${card.suit}`
            });
        }

        // ۴. بررسی رتبه معتبر
        if (!this._isValidRank(card.rank)) {
            errors.push({
                code: 'INVALID_RANK',
                severity: 'critical',
                message: `رتبه نامعتبر: ${card.rank}`
            });
        }

        // ۵. بررسی وجود کارت در دست
        if (!this._isCardInHand(card, hand)) {
            errors.push({
                code: 'CARD_NOT_IN_HAND',
                severity: 'critical',
                message: 'این کارت در دست بازیکن نیست'
            });
        }

        // ۶. بررسی تکراری نبودن کارت بازی شده
        if (this._isCardAlreadyPlayed(card, gameState)) {
            errors.push({
                code: 'CARD_ALREADY_PLAYED',
                severity: 'critical',
                message: 'این کارت قبلاً بازی شده است'
            });
        }

        // ۷. بررسی Follow Suit
        const followSuitResult = this._validateFollowSuit(card, hand, gameState);
        if (!followSuitResult.valid) {
            errors.push({
                code: followSuitResult.code,
                severity: 'high',
                message: followSuitResult.message
            });
        }

        // ۸. بررسی Trump Rules
        const trumpResult = this._validateTrumpRules(card, hand, gameState);
        if (!trumpResult.valid) {
            errors.push({
                code: trumpResult.code,
                severity: 'high',
                message: trumpResult.message
            });
        }

        const isValid = errors.length === 0;

        if (isValid) {
            this.stats.validMoves++;
        } else {
            this.stats.invalidMoves++;
        }

        return this._createValidationResult(isValid, errors, warnings);
    }

    /**
     * بررسی اعتبار خال
     * @param {string} suit - خال
     * @returns {boolean}
     * @private
     */
    _isValidSuit(suit) {
        const validSuits = Object.values(CONFIG.GAME.CARDS.SUITS);
        return validSuits.includes(suit);
    }

    /**
     * بررسی اعتبار رتبه
     * @param {string} rank - رتبه
     * @returns {boolean}
     * @private
     */
    _isValidRank(rank) {
        const validRanks = CONFIG.GAME.CARDS.RANKS;
        return validRanks.includes(rank);
    }

    /**
     * بررسی وجود کارت در دست
     * @param {Object} card - کارت
     * @param {Array} hand - دست
     * @returns {boolean}
     * @private
     */
    _isCardInHand(card, hand) {
        if (!Array.isArray(hand)) return false;
        return hand.some(c => c.id === card.id);
    }

    /**
     * بررسی تکراری نبودن کارت بازی شده
     * @param {Object} card - کارت
     * @param {Object} gameState - وضعیت بازی
     * @returns {boolean}
     * @private
     */
    _isCardAlreadyPlayed(card, gameState) {
        if (!gameState || !gameState.playedCards) return false;

        return gameState.playedCards.some(played => 
            played.card && played.card.id === card.id
        );
    }

    /**
     * اعتبارسنجی Follow Suit
     * @param {Object} card - کارت
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     * @private
     */
    _validateFollowSuit(card, hand, gameState) {
        // اگر RulesEngine در دسترس است، از آن استفاده کن
        if (this.rulesEngine) {
            const leadSuit = gameState.leadSuit || gameState.currentTrickLeadSuit;
            return this.rulesEngine.checkFollowSuit(card, hand, leadSuit);
        }

        // اعتبارسنجی پایه
        const leadSuit = gameState.leadSuit || gameState.currentTrickLeadSuit;

        if (!leadSuit) {
            return { valid: true, code: null, message: null };
        }

        const hasLeadSuit = hand.some(c => c.suit === leadSuit);

        if (!hasLeadSuit) {
            return { valid: true, code: 'NO_LEAD_SUIT', message: 'کارتی از خال شروع ندارید' };
        }

        if (card.suit !== leadSuit) {
            return {
                valid: false,
                code: 'MUST_FOLLOW_SUIT',
                message: `باید از خال ${this._getSuitNameFa(leadSuit)} بازی کنید`
            };
        }

        return { valid: true, code: null, message: null };
    }

    /**
     * اعتبارسنجی قوانین Trump
     * @param {Object} card - کارت
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     * @private
     */
    _validateTrumpRules(card, hand, gameState) {
        if (this.rulesEngine) {
            const trump = gameState.trump;
            const leadSuit = gameState.leadSuit || gameState.currentTrickLeadSuit;
            return this.rulesEngine.checkTrumpRules(card, trump, leadSuit, hand);
        }

        return { valid: true, code: null, message: null };
    }

    // ============================================================
    // بخش ۲: اعتبارسنجی نوبت
    // ============================================================

    /**
     * اعتبارسنجی نوبت بازیکن
     * @param {number} playerIndex - ایندکس بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     */
    validateTurn(playerIndex, gameState) {
        const errors = [];

        // بررسی وجود بازیکن
        if (playerIndex === undefined || playerIndex === null) {
            errors.push({
                code: 'NO_PLAYER_INDEX',
                severity: 'critical',
                message: 'ایندکس بازیکن مشخص نشده است'
            });
            return this._createValidationResult(false, errors, []);
        }

        // بررسی محدوده ایندکس
        if (playerIndex < 0 || playerIndex >= (gameState.players?.length || 0)) {
            errors.push({
                code: 'INVALID_PLAYER_INDEX',
                severity: 'critical',
                message: 'ایندکس بازیکن نامعتبر است'
            });
        }

        // بررسی نوبت فعلی
        if (gameState.currentPlayerIndex !== undefined && 
            playerIndex !== gameState.currentPlayerIndex) {
            errors.push({
                code: 'NOT_YOUR_TURN',
                severity: 'high',
                message: 'نوبت شما نیست'
            });
        }

        // بررسی وضعیت بازی
        if (gameState.status !== 'playing') {
            errors.push({
                code: 'GAME_NOT_PLAYING',
                severity: 'high',
                message: `بازی در وضعیت "${gameState.status}" است و در حال انجام نیست`
            });
        }

        // بررسی AFK
        if (gameState.players && gameState.players[playerIndex]) {
            const player = gameState.players[playerIndex];
            if (player.isAfk || player.disconnected) {
                errors.push({
                    code: 'PLAYER_AFK',
                    severity: 'high',
                    message: 'بازیکن AFK است'
                });
            }
        }

        const isValid = errors.length === 0;

        return this._createValidationResult(isValid, errors, []);
    }

    // ============================================================
    // بخش ۳: اعتبارسنجی وضعیت بازی
    // ============================================================

    /**
     * اعتبارسنجی کامل وضعیت بازی
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     */
    validateGameState(gameState) {
        const errors = [];
        const warnings = [];

        // بررسی وجود gameState
        if (!gameState) {
            errors.push({
                code: 'NO_GAME_STATE',
                severity: 'critical',
                message: 'وضعیت بازی مشخص نشده است'
            });
            return this._createValidationResult(false, errors, warnings);
        }

        // بررسی شناسه بازی
        if (!gameState.gameId) {
            errors.push({
                code: 'NO_GAME_ID',
                severity: 'high',
                message: 'شناسه بازی مشخص نشده است'
            });
        }

        // بررسی بازیکنان
        if (!gameState.players || gameState.players.length !== 4) {
            errors.push({
                code: 'INVALID_PLAYER_COUNT',
                severity: 'critical',
                message: `تعداد بازیکنان باید 4 باشد، اما ${gameState.players?.length || 0} است`
            });
        }

        // بررسی تیم‌ها
        if (gameState.players && gameState.players.length === 4) {
            const team1 = gameState.players.filter(p => p.team === 'team1');
            const team2 = gameState.players.filter(p => p.team === 'team2');

            if (team1.length !== 2 || team2.length !== 2) {
                errors.push({
                    code: 'INVALID_TEAMS',
                    severity: 'critical',
                    message: 'تیم‌ها باید 2 نفره باشند'
                });
            }
        }

        // بررسی حکم
        if (gameState.status === 'playing' && !gameState.trump) {
            warnings.push({
                code: 'NO_TRUMP',
                severity: 'medium',
                message: 'حکم مشخص نشده است'
            });
        }

        // بررسی کارت‌های هر بازیکن
        if (gameState.players) {
            gameState.players.forEach((player, index) => {
                if (!player.hand || !Array.isArray(player.hand)) {
                    errors.push({
                        code: 'INVALID_HAND',
                        severity: 'critical',
                        message: `دست بازیکن ${index} نامعتبر است`
                    });
                } else if (player.hand.length > 13) {
                    errors.push({
                        code: 'TOO_MANY_CARDS',
                        severity: 'high',
                        message: `بازیکن ${index} بیش از 13 کارت دارد`
                    });
                }
            });
        }

        const isValid = errors.length === 0;

        return this._createValidationResult(isValid, errors, warnings);
    }

    // ============================================================
    // بخش ۴: Anti-Cheat - تشخیص تقلب
    // ============================================================

    /**
     * بررسی رفتار مشکوک بازیکن
     * @param {Object} action - اقدام بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     */
    checkSuspiciousBehavior(action, gameState) {
        const suspicions = [];

        // ۱. بررسی سرعت غیرعادی
        if (action.timestamp && gameState.lastActionTimestamp) {
            const timeDiff = action.timestamp - gameState.lastActionTimestamp;
            
            if (timeDiff < 100) { // کمتر از 100 میلی‌ثانیه
                suspicions.push({
                    type: 'TOO_FAST',
                    severity: 'high',
                    message: 'بازیکن بیش از حد سریع عمل کرده است',
                    timeDiff
                });
            }
        }

        // ۲. بررسی الگوی غیرعادی
        if (action.type === 'play_card' && gameState.playerActions) {
            const playerActions = gameState.playerActions[action.playerIndex] || [];
            const recentActions = playerActions.slice(-5);

            // اگر همه کارت‌ها یکسان هستند (مثلاً همه حکم)
            if (recentActions.length >= 3) {
                const allTrump = recentActions.every(a => 
                    a.card && a.card.suit === gameState.trump
                );

                if (allTrump) {
                    suspicions.push({
                        type: 'SUSPICIOUS_PATTERN',
                        severity: 'medium',
                        message: 'بازیکن الگوی غیرعادی دارد (فقط حکم بازی می‌کند)'
                    });
                }
            }
        }

        // ۳. بررسی تغییر ناگهانی رفتار
        if (action.type === 'play_card' && gameState.playerStats) {
            const playerStats = gameState.playerStats[action.playerIndex];
            
            if (playerStats) {
                const avgResponseTime = playerStats.averageResponseTime || 0;
                const currentResponseTime = action.responseTime || 0;

                if (avgResponseTime > 0 && currentResponseTime < avgResponseTime * 0.1) {
                    suspicions.push({
                        type: 'SUDDEN_SPEED_CHANGE',
                        severity: 'medium',
                        message: 'تغییر ناگهانی در سرعت پاسخ‌دهی'
                    });
                }
            }
        }

        // ثبت تخلف اگر مشکوک است
        if (suspicions.length > 0) {
            this._recordSuspicion(action.playerIndex, suspicions);
        }

        return {
            suspicious: suspicions.length > 0,
            suspicions,
            playerIndex: action.playerIndex
        };
    }

    /**
     * ثبت رفتار مشکوک
     * @param {number} playerIndex - ایندکس بازیکن
     * @param {Array} suspicions - لیست شک‌ها
     * @private
     */
    _recordSuspicion(playerIndex, suspicions) {
        if (!this.suspiciousPlayers.has(playerIndex)) {
            this.suspiciousPlayers.set(playerIndex, {
                count: 0,
                suspicions: [],
                firstSuspicion: Date.now(),
                lastSuspicion: Date.now()
            });
        }

        const record = this.suspiciousPlayers.get(playerIndex);
        record.count++;
        record.lastSuspicion = Date.now();
        record.suspicions.push(...suspicions);

        // بررسی نیاز به اخراج
        if (record.count >= this._getMaxSuspicionThreshold()) {
            this._handlePlayerViolation(playerIndex, record);
        }

        if (this.debug) {
            console.log(`⚠️ Suspicious behavior detected for player ${playerIndex}:`, suspicions.length);
        }
    }

    /**
     * دریافت حداکثر آستانه شک
     * @returns {number}
     * @private
     */
    _getMaxSuspicionThreshold() {
        const thresholds = {
            low: 10,
            medium: 7,
            high: 5,
            strict: 3
        };
        return thresholds[this.securityLevel] || 5;
    }

    /**
     * مدیریت تخلف بازیکن
     * @param {number} playerIndex - ایندکس بازیکن
     * @param {Object} record - رکورد تخلف
     * @private
     */
    _handlePlayerViolation(playerIndex, record) {
        this.stats.violationsDetected++;
        this.stats.playersKicked++;

        const violation = {
            playerIndex,
            count: record.count,
            suspicions: record.suspicions,
            timestamp: Date.now(),
            action: 'kick'
        };

        this.violations.push(violation);

        // محدود کردن لیست تخلفات
        if (this.violations.length > 100) {
            this.violations.shift();
        }

        this._emit('player-violation', violation);

        if (this.debug) {
            console.log(`🚫 Player ${playerIndex} kicked for violations:`, record.count);
        }
    }

    /**
     * بررسی تقلب در کارت
     * @param {Object} card - کارت
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     */
    checkCardCheat(card, gameState) {
        const cheats = [];

        // ۱. بررسی کارت نامرئی (کارتی که نباید وجود داشته باشد)
        if (card.id && !this._isValidCardId(card.id)) {
            cheats.push({
                type: 'INVALID_CARD_ID',
                severity: 'critical',
                message: 'شناسه کارت نامعتبر است'
            });
        }

        // ۲. بررسی کارت تکراری در دست
        if (gameState.players) {
            const allCards = [];
            gameState.players.forEach(player => {
                if (player.hand) {
                    allCards.push(...player.hand);
                }
            });

            const duplicateCards = allCards.filter((c, index) => 
                allCards.findIndex(other => other.id === c.id) !== index
            );

            if (duplicateCards.length > 0) {
                cheats.push({
                    type: 'DUPLICATE_CARDS',
                    severity: 'critical',
                    message: 'کارت تکراری در دست بازیکنان یافت شد',
                    cards: duplicateCards
                });
            }
        }

        // ۳. بررسی کارت غیرممکن (مثلاً 5 خال پیک وقتی فقط 13 کارت از هر خال داریم)
        // این بررسی در CardEngine انجام می‌شود

        return {
            cheating: cheats.length > 0,
            cheats
        };
    }

    /**
     * بررسی اعتبار شناسه کارت
     * @param {string} cardId - شناسه کارت
     * @returns {boolean}
     * @private
     */
    _isValidCardId(cardId) {
        if (!cardId || typeof cardId !== 'string') return false;

        const parts = cardId.split('_');
        if (parts.length !== 2) return false;

        const [suit, rank] = parts;
        return this._isValidSuit(suit) && this._isValidRank(rank);
    }

    // ============================================================
    // بخش ۵: اعتبارسنجی امتیاز
    // ============================================================

    /**
     * اعتبارسنجی امتیاز Round
     * @param {Object} roundResult - نتیجه Round
     * @returns {Object} نتیجه
     */
    validateRoundScore(roundResult) {
        const errors = [];

        // بررسی مجموع Trick ها
        const totalTricks = (roundResult.team1Tricks || 0) + (roundResult.team2Tricks || 0);
        const expectedTricks = 26; // 13 کارت × 2 تیم

        if (totalTricks !== expectedTricks) {
            errors.push({
                code: 'INVALID_TRICK_COUNT',
                severity: 'critical',
                message: `مجموع Trick ها باید ${expectedTricks} باشد، اما ${totalTricks} است`
            });
        }

        // بررسی Kot
        if (roundResult.isKot) {
            const winningTeam = roundResult.winner;
            const winningTricks = winningTeam === 'team1' ? 
                roundResult.team1Tricks : roundResult.team2Tricks;

            if (winningTricks !== expectedTricks) {
                errors.push({
                    code: 'INVALID_KOT',
                    severity: 'high',
                    message: 'Kot اعلام شده اما تعداد Trick ها صحیح نیست'
                });
            }
        }

        const isValid = errors.length === 0;

        return this._createValidationResult(isValid, errors, []);
    }

    /**
     * اعتبارسنجی امتیاز Match
     * @param {Object} matchResult - نتیجه Match
     * @returns {Object} نتیجه
     */
    validateMatchScore(matchResult) {
        const errors = [];

        // بررسی تعداد Round های برده شده
        const team1Wins = matchResult.team1RoundsWon || 0;
        const team2Wins = matchResult.team2RoundsWon || 0;
        const roundsToWin = matchResult.roundsToWin || 2;

        if (team1Wins < roundsToWin && team2Wins < roundsToWin) {
            errors.push({
                code: 'MATCH_NOT_COMPLETE',
                severity: 'high',
                message: 'هیچ تیمی به تعداد Round لازم برای پیروزی نرسیده است'
            });
        }

        if (team1Wins >= roundsToWin && team2Wins >= roundsToWin) {
            errors.push({
                code: 'BOTH_TEAMS_WON',
                severity: 'critical',
                message: 'هر دو تیم به تعداد Round لازم رسیده‌اند (غیرممکن)'
            });
        }

        const isValid = errors.length === 0;

        return this._createValidationResult(isValid, errors, []);
    }

    // ============================================================
    // بخش ۶: اعتبارسنجی پاداش
    // ============================================================

    /**
     * اعتبارسنجی پاداش بازی
     * @param {Object} reward - پاداش
     * @param {Object} gameResult - نتیجه بازی
     * @returns {Object} نتیجه
     */
    validateReward(reward, gameResult) {
        const errors = [];
        const warnings = [];

        // بررسی سکه
        if (reward.coins !== undefined) {
            if (reward.coins < 0) {
                errors.push({
                    code: 'NEGATIVE_COINS',
                    severity: 'critical',
                    message: 'تعداد سکه نمی‌تواند منفی باشد'
                });
            }

            if (reward.coins > 100000) {
                warnings.push({
                    code: 'HIGH_COINS',
                    severity: 'medium',
                    message: 'تعداد سکه غیرعادی بالاست'
                });
            }
        }

        // بررسی XP
        if (reward.xp !== undefined) {
            if (reward.xp < 0) {
                errors.push({
                    code: 'NEGATIVE_XP',
                    severity: 'critical',
                    message: 'تعداد XP نمی‌تواند منفی باشد'
                });
            }
        }

        // بررسی Rating
        if (reward.ratingChange !== undefined) {
            if (Math.abs(reward.ratingChange) > 100) {
                warnings.push({
                    code: 'HIGH_RATING_CHANGE',
                    severity: 'medium',
                    message: 'تغییر Rating غیرعادی بالاست'
                });
            }
        }

        const isValid = errors.length === 0;

        return this._createValidationResult(isValid, errors, warnings);
    }

    // ============================================================
    // بخش ۷: سیستم Penalty
    // ============================================================

    /**
     * اعمال Penalty بر بازیکن
     * @param {number} playerIndex - ایندکس بازیکن
     * @param {string} reason - دلیل
     * @param {Object} penalty - جزئیات Penalty
     * @returns {Object} نتیجه
     */
    applyPenalty(playerIndex, reason, penalty = {}) {
        const {
            type = 'warning',
            coins = 0,
            xp = 0,
            temporaryBan = 0,
            permanentBan = false
        } = penalty;

        const penaltyRecord = {
            playerIndex,
            reason,
            type,
            coins,
            xp,
            temporaryBan,
            permanentBan,
            timestamp: Date.now(),
            id: Utils.generateUUID()
        };

        this.violations.push(penaltyRecord);

        this._emit('penalty-applied', penaltyRecord);

        if (this.debug) {
            console.log(`⚖️ Penalty applied to player ${playerIndex}:`, penaltyRecord);
        }

        return {
            success: true,
            penalty: penaltyRecord
        };
    }

    /**
     * دریافت تاریخچه تخلفات بازیکن
     * @param {number} playerIndex - ایندکس بازیکن
     * @returns {Array}
     */
    getPlayerViolations(playerIndex) {
        return this.violations.filter(v => v.playerIndex === playerIndex);
    }

    /**
     * بررسی آیا بازیکن Ban شده است
     * @param {number} playerIndex - ایندکس بازیکن
     * @returns {Object} نتیجه
     */
    isPlayerBanned(playerIndex) {
        const violations = this.getPlayerViolations(playerIndex);
        const latestBan = violations.find(v => 
            v.permanentBan || v.temporaryBan > 0
        );

        if (!latestBan) {
            return { banned: false };
        }

        if (latestBan.permanentBan) {
            return {
                banned: true,
                type: 'permanent',
                reason: latestBan.reason,
                timestamp: latestBan.timestamp
            };
        }

        const banExpiry = latestBan.timestamp + (latestBan.temporaryBan * 1000);
        const isBanned = Date.now() < banExpiry;

        return {
            banned: isBanned,
            type: 'temporary',
            reason: latestBan.reason,
            expiry: banExpiry,
            remainingSeconds: Math.max(0, (banExpiry - Date.now()) / 1000)
        };
    }

    // ============================================================
    // بخش ۸: توابع کمکی
    // ============================================================

    /**
     * ایجاد نتیجه اعتبارسنجی
     * @param {boolean} valid - آیا معتبر است
     * @param {Array} errors - خطاها
     * @param {Array} warnings - هشدارها
     * @returns {Object}
     * @private
     */
    _createValidationResult(valid, errors, warnings) {
        return {
            valid,
            errors,
            warnings,
            errorCount: errors.length,
            warningCount: warnings.length,
            severity: this._getHighestSeverity(errors)
        };
    }

    /**
     * دریافت بالاترین سطح خطا
     * @param {Array} errors - خطاها
     * @returns {string}
     * @private
     */
    _getHighestSeverity(errors) {
        if (errors.length === 0) return 'none';

        const severities = errors.map(e => e.severity);
        
        if (severities.includes('critical')) return 'critical';
        if (severities.includes('high')) return 'high';
        if (severities.includes('medium')) return 'medium';
        return 'low';
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

    /**
     * دریافت آمار اعتبارسنجی
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            totalViolations: this.violations.length,
            suspiciousPlayersCount: this.suspiciousPlayers.size,
            securityLevel: this.securityLevel
        };
    }

    /**
     * دریافت لیست تخلفات
     * @param {number} limit - تعداد
     * @returns {Array}
     */
    getViolations(limit = 50) {
        return this.violations.slice(-limit).reverse();
    }

    /**
     * ریست آمار
     */
    resetStats() {
        this.stats = {
            totalValidations: 0,
            validMoves: 0,
            invalidMoves: 0,
            violationsDetected: 0,
            playersKicked: 0,
            falsePositives: 0
        };
    }

    /**
     * پاک کردن تاریخچه تخلفات
     */
    clearViolations() {
        this.violations = [];
        this.suspiciousPlayers.clear();
    }

    // ============================================================
    // بخش : تنظیمات
    // ============================================================

    /**
     * تنظیم سطح امنیت
     * @param {string} level - سطح ('low' | 'medium' | 'high' | 'strict')
     * @returns {Object} نتیجه
     */
    setSecurityLevel(level) {
        const validLevels = ['low', 'medium', 'high', 'strict'];
        
        if (!validLevels.includes(level)) {
            return {
                success: false,
                error: 'INVALID_LEVEL',
                message: 'سطح امنیت نامعتبر است'
            };
        }

        this.securityLevel = level;

        this._emit('security-level-changed', { level });

        return {
            success: true,
            level
        };
    }

    // ============================================================
    // بخش ۰: Event System
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
                    console.error(`❌ Validation event listener error:`, error);
                }
            });
        }

        eventBus.emit(`validation:${event}`, data);
    }

    /**
     * پاک کردن شنوندگان
     */
    clearListeners() {
        this.listeners.clear();
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();

        console.log('🛡️ ValidationEngine Status:');
        console.log('  Security Level:', stats.securityLevel);
        console.log('  Total Validations:', stats.totalValidations);
        console.log('  Valid Moves:', stats.validMoves);
        console.log('  Invalid Moves:', stats.invalidMoves);
        console.log('  Violations Detected:', stats.violationsDetected);
        console.log('  Players Kicked:', stats.playersKicked);
        console.log('  Total Violations:', stats.totalViolations);
        console.log('  Suspicious Players:', stats.suspiciousPlayersCount);
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const validationEngine = new ValidationEngine();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ValidationEngine, validationEngine };
} else {
    window.ValidationEngine = ValidationEngine;
    window.validationEngine = validationEngine;
}

console.log('✅ ValidationEngine loaded');
