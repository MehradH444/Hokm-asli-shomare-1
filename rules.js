/**
 * ============================================================
 * HOKM MASTER - Game Rules Engine
 * موتور قوانین بازی حکم
 * ============================================================
 * 
 * این فایل مسئول پیاده‌سازی تمام قوانین بازی حکم ایرانی است.
 * شامل قوانین Follow Suit، Trump، Hakem، Dealer، Kot،
 * امتیازدهی، و تمام حالت‌های خاص بازی.
 * 
 * این موتور تمام قوانین را به صورت دقیق و کامل پیاده‌سازی
 * می‌کند و برای اعتبارسنجی حرکت‌ها، محاسبه امتیاز، و
 * تعیین وضعیت بازی استفاده می‌شود.
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

class RulesEngine {

    constructor() {
        /**
         * مرجع CardEngine
         * @type {CardEngine}
         */
        this.cardEngine = null;

        /**
         * قوانین فعال
         * @type {Object}
         */
        this.activeRules = {
            mustFollowSuit: true,
            trumpBeatsAll: true,
            hakemChoosesTrump: true,
            dealerRotates: true,
            kotAllowed: true,
            doubleKotAllowed: false,
            winningScore: CONFIG.GAME.SCORING.WINNING_SCORE,
            firstToWinRounds: CONFIG.GAME.SCORING.FIRST_TO_WIN_ROUNDS,
            kotBonus: CONFIG.GAME.SCORING.KOT_BONUS
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
         * آمار قوانین
         * @type {Object}
         */
        this.stats = {
            totalValidations: 0,
            validMoves: 0,
            invalidMoves: 0,
            kotCount: 0,
            doubleKotCount: 0,
            trumpPlays: 0,
            suitFollows: 0,
            suitViolations: 0
        };

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

        if (this.debug) {
            console.log('📜 RulesEngine initialized');
        }
    }

    // ============================================================
    // بخش ۱: تنظیمات قوانین
    // ============================================================

    /**
     * تنظیم قوانین بازی
     * @param {Object} rules - قوانین
     * @returns {Object} نتیجه
     */
    setRules(rules) {
        this.activeRules = {
            ...this.activeRules,
            ...rules
        };

        this._emit('rules-changed', this.activeRules);

        if (this.debug) {
            console.log('📜 Rules updated:', this.activeRules);
        }

        return {
            success: true,
            rules: this.activeRules
        };
    }

    /**
     * دریافت قوانین فعلی
     * @returns {Object}
     */
    getRules() {
        return { ...this.activeRules };
    }

    /**
     * ریست به قوانین پیش‌فرض
     * @returns {Object}
     */
    resetToDefault() {
        this.activeRules = {
            mustFollowSuit: true,
            trumpBeatsAll: true,
            hakemChoosesTrump: true,
            dealerRotates: true,
            kotAllowed: true,
            doubleKotAllowed: false,
            winningScore: CONFIG.GAME.SCORING.WINNING_SCORE,
            firstToWinRounds: CONFIG.GAME.SCORING.FIRST_TO_WIN_ROUNDS,
            kotBonus: CONFIG.GAME.SCORING.KOT_BONUS
        };

        this._emit('rules-reset', this.activeRules);

        return {
            success: true,
            rules: this.activeRules
        };
    }

    // ============================================================
    // بخش ۲: قوانین Follow Suit
    // ============================================================

    /**
     * بررسی آیا بازیکن باید Follow Suit کند
     * @param {Object} card - کارت مورد نظر
     * @param {Array} hand - دست بازیکن
     * @param {string} leadSuit - خال شروع
     * @returns {Object} نتیجه
     */
    checkFollowSuit(card, hand, leadSuit) {
        this.stats.totalValidations++;

        // اگر Follow Suit غیرفعال است، هر کارتی مجاز است
        if (!this.activeRules.mustFollowSuit) {
            this.stats.validMoves++;
            return {
                valid: true,
                mustFollow: false,
                reason: null
            };
        }

        // اگر خال شروع مشخص نیست (اولین کارت دست)، هر کارتی مجاز است
        if (!leadSuit) {
            this.stats.validMoves++;
            return {
                valid: true,
                mustFollow: false,
                reason: null
            };
        }

        // بررسی آیا بازیکن کارت از خال شروع دارد
        const hasLeadSuit = hand.some(c => c.suit === leadSuit);

        if (!hasLeadSuit) {
            // بازیکن کارت از خال شروع ندارد، هر کارتی مجاز است
            this.stats.validMoves++;
            return {
                valid: true,
                mustFollow: false,
                reason: 'NO_LEAD_SUIT',
                message: 'شما کارتی از خال شروع ندارید'
            };
        }

        // بازیکن باید از خال شروع بازی کند
        if (card.suit !== leadSuit) {
            this.stats.invalidMoves++;
            this.stats.suitViolations++;
            return {
                valid: false,
                mustFollow: true,
                reason: 'MUST_FOLLOW_SUIT',
                message: `باید از خال ${this._getSuitNameFa(leadSuit)} بازی کنید`
            };
        }

        this.stats.validMoves++;
        this.stats.suitFollows++;

        return {
            valid: true,
            mustFollow: true,
            reason: null
        };
    }

    /**
     * دریافت کارت‌های معتبر بر اساس Follow Suit
     * @param {Array} hand - دست بازیکن
     * @param {string} leadSuit - خال شروع
     * @returns {Array} کارت‌های معتبر
     */
    getValidCards(hand, leadSuit = null) {
        if (!leadSuit || !this.activeRules.mustFollowSuit) {
            return [...hand];
        }

        const leadCards = hand.filter(c => c.suit === leadSuit);

        if (leadCards.length > 0) {
            return leadCards;
        }

        return [...hand];
    }

    // ============================================================
    // بخش : قوانین Trump (حکم)
    // ============================================================

    /**
     * بررسی قوانین مربوط به حکم
     * @param {Object} card - کارت
     * @param {string} trump - خال حکم
     * @param {string} leadSuit - خال شروع
     * @param {Array} hand - دست بازیکن
     * @returns {Object} نتیجه
     */
    checkTrumpRules(card, trump, leadSuit, hand) {
        // اگر حکم مشخص نیست، قوانین حکم اعمال نمی‌شود
        if (!trump) {
            return {
                valid: true,
                isTrumpPlay: false,
                reason: null
            };
        }

        const isTrumpCard = card.suit === trump;
        const hasLeadSuit = leadSuit ? hand.some(c => c.suit === leadSuit) : false;

        // اگر کارت حکم است
        if (isTrumpCard) {
            this.stats.trumpPlays++;

            // اگر خال شروع مشخص است و بازیکن کارت از خال شروع دارد
            if (leadSuit && hasLeadSuit && card.suit !== leadSuit) {
                // بازیکن نباید حکم بازی کند وقتی کارت از خال شروع دارد
                return {
                    valid: false,
                    isTrumpPlay: true,
                    reason: 'CANNOT_PLAY_TRUMP_WHEN_HAVE_LEAD_SUIT',
                    message: `شما کارت از خال ${this._getSuitNameFa(leadSuit)} دارید، نمی‌توانید حکم بازی کنید`
                };
            }

            return {
                valid: true,
                isTrumpPlay: true,
                reason: null
            };
        }

        return {
            valid: true,
            isTrumpPlay: false,
            reason: null
        };
    }

    /**
     * آیا کارت حکم است
     * @param {Object} card - کارت
     * @param {string} trump - خال حکم
     * @returns {boolean}
     */
    isTrump(card, trump) {
        return trump !== null && card.suit === trump;
    }

    /**
     * دریافت ارزش کارت با در نظر گرفتن حکم
     * @param {Object} card - کارت
     * @param {string} trump - خال حکم
     * @returns {number} ارزش
     */
    getCardValue(card, trump) {
        if (!card) return 0;

        if (this.isTrump(card, trump)) {
            return card.trumpValue || CONFIG.GAME.CARDS.TRUMP_RANK_VALUES[card.rank];
        }

        return card.value || CONFIG.GAME.CARDS.RANK_VALUES[card.rank];
    }

    // ============================================================
    // بخش ۴: قوانین Hakem (حاکم)
    // ============================================================

    /**
     * بررسی قوانین حاکم
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     */
    checkHakemRules(gameState) {
        if (!this.activeRules.hakemChoosesTrump) {
            return {
                valid: true,
                hakemCanChooseTrump: false,
                reason: null
            };
        }

        const hakem = gameState.hakem;

        if (!hakem) {
            return {
                valid: false,
                reason: 'NO_HAKEM',
                message: 'حاکم مشخص نیست'
            };
        }

        return {
            valid: true,
            hakemCanChooseTrump: true,
            hakem: hakem
        };
    }

    /**
     * آیا بازیکن می‌تواند حکم انتخاب کند
     * @param {number} playerIndex - ایندکس بازیکن
     * @param {number} hakemIndex - ایندکس حاکم
     * @returns {Object}
     */
    canChooseTrump(playerIndex, hakemIndex) {
        if (!this.activeRules.hakemChoosesTrump) {
            return {
                can: true,
                reason: 'HAKEM_RULE_DISABLED'
            };
        }

        if (playerIndex !== hakemIndex) {
            return {
                can: false,
                reason: 'NOT_HAKEM',
                message: 'فقط حاکم می‌تواند حکم انتخاب کند'
            };
        }

        return {
            can: true,
            reason: null
        };
    }

    /**
     * تعیین حاکم بعدی
     * @param {number} currentHakemIndex - ایندکس حاکم فعلی
     * @param {number} playerCount - تعداد بازیکنان
     * @param {Object} roundResult - نتیجه Round
     * @returns {number} ایندکس حاکم بعدی
     */
    determineNextHakem(currentHakemIndex, playerCount, roundResult = null) {
        // در حکم ایرانی، حاکم بعدی معمولاً بازیکن بعدی است
        // مگر اینکه قانون خاصی وجود داشته باشد

        // اگر تیمی که حاکم بوده Round را باخته، حاکم عوض می‌شود
        if (roundResult && roundResult.hakemTeamLost) {
            // حاکم بعدی از تیم برنده
            const hakemTeam = currentHakemIndex % 2 === 0 ? 'team1' : 'team2';
            const winningTeam = roundResult.winner;

            if (hakemTeam !== winningTeam) {
                // حاکم از تیم بازنده بوده، حاکم بعدی از تیم برنده
                const nextHakem = (currentHakemIndex + 1) % playerCount;
                return nextHakem;
            }
        }

        // در غیر این صورت، حاکم بعدی بازیکن بعدی است
        return (currentHakemIndex + 1) % playerCount;
    }

    // ============================================================
    // بخش ۵: قوانین Dealer (توزیع‌کننده)
    // ============================================================

    /**
     * تعیین Dealer بعدی
     * @param {number} currentDealerIndex - ایندکس Dealer فعلی
     * @param {number} playerCount - تعداد بازیکنان
     * @returns {number} ایندکس Dealer بعدی
     */
    determineNextDealer(currentDealerIndex, playerCount) {
        if (!this.activeRules.dealerRotates) {
            return currentDealerIndex;
        }

        return (currentDealerIndex + 1) % playerCount;
    }

    /**
     * تعیین بازیکن شروع‌کننده Round
     * @param {number} dealerIndex - ایندکس Dealer
     * @param {number} playerCount - تعداد بازیکنان
     * @param {Object} previousTrickWinner - برنده Trick قبلی
     * @returns {number} ایندکس بازیکن شروع‌کننده
     */
    determineRoundStarter(dealerIndex, playerCount, previousTrickWinner = null) {
        // اگر Trick قبلی برنده دارد، او شروع می‌کند
        if (previousTrickWinner !== null) {
            return previousTrickWinner;
        }

        // در غیر این صورت، بازیکن بعد از Dealer شروع می‌کند
        return (dealerIndex + 1) % playerCount;
    }

    // ============================================================
    // بخش ۶: قوانین امتیازدهی
    // ============================================================

    /**
     * محاسبه امتیاز Round
     * @param {Object} scores - امتیازهای فعلی
     * @param {number} tricksWonTeam1 - تعداد Trick های برده شده تیم 1
     * @param {number} tricksWonTeam2 - تعداد Trick های برده شده تیم 2
     * @returns {Object} نتیجه
     */
    calculateRoundScore(scores, tricksWonTeam1, tricksWonTeam2) {
        const totalTricks = tricksWonTeam1 + tricksWonTeam2;
        const expectedTricks = CONFIG.GAME.CARDS.PER_PLAYER * 2; // 26 Trick در یک Round

        // بررسی صحت تعداد Trick ها
        if (totalTricks !== expectedTricks) {
            console.warn(`⚠️ Total tricks mismatch: ${totalTricks} vs expected ${expectedTricks}`);
        }

        // محاسبه امتیاز
        const newScores = {
            team1: scores.team1 + tricksWonTeam1,
            team2: scores.team2 + tricksWonTeam2
        };

        // تعیین برنده Round
        let winner = null;
        let isKot = false;
        let isDoubleKot = false;

        if (tricksWonTeam1 > tricksWonTeam2) {
            winner = 'team1';
            if (tricksWonTeam2 === 0) {
                isKot = true;
            }
        } else if (tricksWonTeam2 > tricksWonTeam1) {
            winner = 'team2';
            if (tricksWonTeam1 === 0) {
                isKot = true;
            }
        } else {
            winner = 'draw';
        }

        // محاسبه Kot Bonus
        let kotBonus = 0;
        if (isKot && this.activeRules.kotAllowed) {
            kotBonus = this.activeRules.kotBonus;
            this.stats.kotCount++;

            // اضافه کردن Kot bonus به امتیاز تیم برنده
            newScores[winner] += kotBonus;
        }

        return {
            scores: newScores,
            winner: winner,
            isKot: isKot,
            isDoubleKot: isDoubleKot,
            kotBonus: kotBonus,
            tricksWon: {
                team1: tricksWonTeam1,
                team2: tricksWonTeam2
            }
        };
    }

    /**
     * محاسبه امتیاز Trick
     * @param {Object} trickResult - نتیجه Trick
     * @returns {Object} امتیاز
     */
    calculateTrickScore(trickResult) {
        // در حکم، هر Trick ارزش 1 امتیاز دارد
        return {
            value: CONFIG.GAME.SCORING.TRICK_VALUE,
            winner: trickResult.winner,
            winnerTeam: trickResult.winnerTeam
        };
    }

    // ============================================================
    // بخش : قوانین Kot
    // ============================================================

    /**
     * بررسی Kot
     * @param {number} tricksWonTeam1 - تعداد Trick های تیم 1
     * @param {number} tricksWonTeam2 - تعداد Trick های تیم 2
     * @returns {Object} نتیجه
     */
    checkKot(tricksWonTeam1, tricksWonTeam2) {
        if (!this.activeRules.kotAllowed) {
            return {
                isKot: false,
                team: null,
                bonus: 0
            };
        }

        const expectedTricks = CONFIG.GAME.CARDS.PER_PLAYER * 2;

        // Kot وقتی رخ می‌دهد که یک تیم همه Trick ها را ببرد
        if (tricksWonTeam1 === expectedTricks && tricksWonTeam2 === 0) {
            return {
                isKot: true,
                team: 'team1',
                bonus: this.activeRules.kotBonus
            };
        }

        if (tricksWonTeam2 === expectedTricks && tricksWonTeam1 === 0) {
            return {
                isKot: true,
                team: 'team2',
                bonus: this.activeRules.kotBonus
            };
        }

        return {
            isKot: false,
            team: null,
            bonus: 0
        };
    }

    /**
     * بررسی Double Kot (حالت خاص)
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     */
    checkDoubleKot(gameState) {
        if (!this.activeRules.doubleKotAllowed) {
            return {
                isDoubleKot: false,
                team: null,
                bonus: 0
            };
        }

        // Double Kot وقتی رخ می‌دهد که یک تیم دو Round متوالی Kot کند
        const roundWinners = gameState.roundWinners || [];

        if (roundWinners.length >= 2) {
            const lastTwo = roundWinners.slice(-2);

            if (lastTwo[0].isKot && lastTwo[1].isKot &&
                lastTwo[0].winner === lastTwo[1].winner) {
                this.stats.doubleKotCount++;

                return {
                    isDoubleKot: true,
                    team: lastTwo[0].winner,
                    bonus: this.activeRules.kotBonus * 2
                };
            }
        }

        return {
            isDoubleKot: false,
            team: null,
            bonus: 0
        };
    }

    // ============================================================
    // بخش ۸: قوانین پایان بازی
    // ============================================================

    /**
     * بررسی پایان Round
     * @param {Array} playerHands - دست بازیکنان
     * @returns {Object} نتیجه
     */
    checkRoundComplete(playerHands) {
        const allEmpty = playerHands.every(hand => hand.length === 0);

        return {
            complete: allEmpty,
            remainingCards: playerHands.reduce((sum, hand) => sum + hand.length, 0)
        };
    }

    /**
     * بررسی پایان Match
     * @param {Array} roundWinners - برنده‌های Round ها
     * @param {number} roundsToWin - تعداد Round لازم برای پیروزی
     * @returns {Object} نتیجه
     */
    checkMatchComplete(roundWinners, roundsToWin = null) {
        const targetRounds = roundsToWin || this.activeRules.firstToWinRounds;

        const team1Wins = roundWinners.filter(r => r.winner === 'team1').length;
        const team2Wins = roundWinners.filter(r => r.winner === 'team2').length;

        let matchWinner = null;
        let isComplete = false;

        if (team1Wins >= targetRounds) {
            matchWinner = 'team1';
            isComplete = true;
        } else if (team2Wins >= targetRounds) {
            matchWinner = 'team2';
            isComplete = true;
        }

        return {
            complete: isComplete,
            winner: matchWinner,
            team1Wins: team1Wins,
            team2Wins: team2Wins,
            roundsToWin: targetRounds,
            roundsRemaining: {
                team1: Math.max(0, targetRounds - team1Wins),
                team2: Math.max(0, targetRounds - team2Wins)
            }
        };
    }

    /**
     * تعیین برنده Match
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     */
    determineMatchWinner(gameState) {
        const roundWinners = gameState.roundWinners || [];
        const check = this.checkMatchComplete(roundWinners);

        if (!check.complete) {
            return {
                winner: null,
                complete: false,
                reason: 'MATCH_NOT_COMPLETE'
            };
        }

        return {
            winner: check.winner,
            complete: true,
            score: {
                team1: check.team1Wins,
                team2: check.team2Wins
            },
            rounds: roundWinners
        };
    }

    // ============================================================
    // بخش ۹: اعتبارسنجی کامل حرکت
    // ============================================================

    /**
     * اعتبارسنجی کامل یک حرکت
     * @param {Object} card - کارت
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     */
    validateMove(card, hand, gameState) {
        this.stats.totalValidations++;

        const errors = [];
        const warnings = [];

        // ۱. بررسی وجود کارت در دست
        if (!hand.some(c => c.id === card.id)) {
            errors.push({
                code: 'CARD_NOT_IN_HAND',
                message: 'این کارت در دست شما نیست'
            });
        }

        // ۲. بررسی Follow Suit
        const leadSuit = gameState.leadSuit || gameState.currentTrickLeadSuit;
        const followSuitCheck = this.checkFollowSuit(card, hand, leadSuit);

        if (!followSuitCheck.valid) {
            errors.push({
                code: followSuitCheck.reason,
                message: followSuitCheck.message
            });
        }

        // ۳. بررسی قوانین Trump
        const trump = gameState.trump;
        const trumpCheck = this.checkTrumpRules(card, trump, leadSuit, hand);

        if (!trumpCheck.valid) {
            errors.push({
                code: trumpCheck.reason,
                message: trumpCheck.message
            });
        }

        // ۴. بررسی نوبت
        if (gameState.currentPlayerIndex !== undefined &&
            gameState.currentPlayerIndex !== gameState.playingPlayerIndex) {
            errors.push({
                code: 'NOT_YOUR_TURN',
                message: 'نوبت شما نیست'
            });
        }

        // ۵. بررسی وضعیت بازی
        if (gameState.status !== 'playing') {
            errors.push({
                code: 'GAME_NOT_PLAYING',
                message: 'بازی در حال انجام نیست'
            });
        }

        const isValid = errors.length === 0;

        if (isValid) {
            this.stats.validMoves++;
        } else {
            this.stats.invalidMoves++;
        }

        return {
            valid: isValid,
            errors: errors,
            warnings: warnings,
            card: card,
            isTrumpPlay: trumpCheck.isTrumpPlay,
            mustFollow: followSuitCheck.mustFollow
        };
    }

    /**
     * دریافت تمام حرکت‌های معتبر
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Array} کارت‌های معتبر
     */
    getValidMoves(hand, gameState) {
        const leadSuit = gameState.leadSuit || gameState.currentTrickLeadSuit;
        const trump = gameState.trump;

        return hand.filter(card => {
            const validation = this.validateMove(card, hand, {
                ...gameState,
                playingPlayerIndex: gameState.currentPlayerIndex
            });
            return validation.valid;
        });
    }

    // ============================================================
    // بخش ۱۰: تعیین برنده Trick
    // ============================================================

    /**
     * تعیین برنده Trick
     * @param {Array} playedCards - کارت‌های بازی‌شده
     * @param {string} trump - خال حکم
     * @param {string} leadSuit - خال شروع
     * @returns {Object} نتیجه
     */
    determineTrickWinner(playedCards, trump, leadSuit) {
        if (!playedCards || playedCards.length === 0) {
            return {
                winner: null,
                winningCard: null,
                reason: 'NO_CARDS'
            };
        }

        let winnerIndex = 0;
        let winningCard = playedCards[0].card;
        let winningValue = this.getCardValue(winningCard, trump);

        for (let i = 1; i < playedCards.length; i++) {
            const currentCard = playedCards[i].card;
            const currentValue = this.getCardValue(currentCard, trump);

            // اگر کارت فعلی حکم است و برنده فعلی حکم نیست
            if (this.isTrump(currentCard, trump) && !this.isTrump(winningCard, trump)) {
                winnerIndex = i;
                winningCard = currentCard;
                winningValue = currentValue;
                continue;
            }

            // اگر هر دو حکم هستند یا هیچکدام حکم نیستند
            if (this.isTrump(currentCard, trump) === this.isTrump(winningCard, trump)) {
                // اگر هر دو از خال شروع هستند
                if (currentCard.suit === leadSuit && winningCard.suit === leadSuit) {
                    if (currentValue > winningValue) {
                        winnerIndex = i;
                        winningCard = currentCard;
                        winningValue = currentValue;
                    }
                }
                // اگر هر دو حکم هستند
                else if (this.isTrump(currentCard, trump)) {
                    if (currentValue > winningValue) {
                        winnerIndex = i;
                        winningCard = currentCard;
                        winningValue = currentValue;
                    }
                }
            }
        }

        return {
            winner: playedCards[winnerIndex].playerIndex,
            winningCard: winningCard,
            winningValue: winningValue,
            trickSize: playedCards.length
        };
    }

    // ============================================================
    // بخش ۱۱: توابع کمکی
    // ============================================================

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
     * دریافت اطلاعات کامل قوانین
     * @returns {Object}
     */
    getRulesInfo() {
        return {
            activeRules: this.activeRules,
            stats: this.stats,
            version: '1.0.0',
            gameType: 'Hokm Iranian'
        };
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const info = this.getRulesInfo();

        console.log('📜 RulesEngine Status:');
        console.log('  Game Type:', info.gameType);
        console.log('  Total Validations:', info.stats.totalValidations);
        console.log('  Valid Moves:', info.stats.validMoves);
        console.log('  Invalid Moves:', info.stats.invalidMoves);
        console.log('  Kot Count:', info.stats.kotCount);
        console.log('  Trump Plays:', info.stats.trumpPlays);
        console.log('  Suit Follows:', info.stats.suitFollows);
        console.log('  Suit Violations:', info.stats.suitViolations);
        console.log('  Active Rules:');
        Object.entries(info.activeRules).forEach(([key, value]) => {
            console.log(`    ${key}:`, value);
        });
    }

    /**
     * ریست آمار
     */
    resetStats() {
        this.stats = {
            totalValidations: 0,
            validMoves: 0,
            invalidMoves: 0,
            kotCount: 0,
            doubleKotCount: 0,
            trumpPlays: 0,
            suitFollows: 0,
            suitViolations: 0
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
                    console.error(`❌ Rules event listener error:`, error);
                }
            });
        }

        eventBus.emit(`rules:${event}`, data);
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
const rulesEngine = new RulesEngine();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RulesEngine, rulesEngine };
} else {
    window.RulesEngine = RulesEngine;
    window.rulesEngine = rulesEngine;
}

console.log('✅ RulesEngine loaded');
