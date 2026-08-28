/**
 * ============================================================
 * HOKM MASTER - AI Probability Engine
 * موتور محاسبه احتمالات هوش مصنوعی
 * ============================================================
 * 
 * این فایل مسئول محاسبه تمام احتمالات مورد نیاز برای
 * تصمیم‌گیری هوش مصنوعی در بازی حکم است. شامل محاسبه
 * احتمال توزیع کارت‌ها، احتمال وجود کارت خاص در دست حریف،
 * احتمال برد دست/Round/Match، ردیابی کارت‌ها، و شبیه‌سازی
 * Monte Carlo.
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

class AIProbabilityEngine {

    constructor() {
        /**
         * مرجع CardEngine
         * @type {CardEngine}
         */
        this.cardEngine = null;

        /**
         * کارت‌های مشاهده شده (بازی شده)
         * @type {Array<Object>}
         */
        this.observedCards = [];

        /**
         * کارت‌های باقی‌مانده در دست بازیکنان دیگر (تخمین)
         * @type {Object} { playerId: [cards] }
         */
        this.estimatedHands = {};

        /**
         * کارت‌های باقی‌مانده در Deck (اگر هنوز deal نشده)
         * @type {Array<Object>}
         */
        this.remainingDeck = [];

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
         * آمار احتمالات
         * @type {Object}
         */
        this.stats = {
            totalCalculations: 0,
            accuratePredictions: 0,
            failedPredictions: 0,
            monteCarloSimulations: 0
        };

        /**
         * کش محاسبات برای بهینه‌سازی
         * @type {Map}
         */
        this.calculationCache = new Map();

        /**
         * مدت زمان کش (میلی‌ثانیه)
         * @type {number}
         */
        this.cacheTTL = 5000;

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
            console.log('🎲 AIProbabilityEngine initialized');
        }
    }

    // ============================================================
    // بخش : ردیابی کارت‌ها
    // ============================================================

    /**
     * ثبت کارت بازی شده
     * @param {Object} card - کارت
     * @param {number} playerId - شناسه بازیکن
     * @param {number} trickNumber - شماره دست
     * @returns {void}
     */
    recordPlayedCard(card, playerId, trickNumber) {
        const record = {
            card,
            playerId,
            trickNumber,
            timestamp: Date.now()
        };

        this.observedCards.push(record);

        // به‌روزرسانی دست‌های تخمینی
        this._updateEstimatedHands(playerId, card);

        // پاک کردن کش
        this._clearCache();

        if (this.debug) {
            console.log(` Card recorded: ${card.nameFa} by player ${playerId}`);
        }
    }

    /**
     * به‌روزرسانی دست‌های تخمینی
     * @param {number} playerId - شناسه بازیکن
     * @param {Object} card - کارت
     * @private
     */
    _updateEstimatedHands(playerId, card) {
        // حذف کارت از تمام دست‌های تخمینی
        Object.keys(this.estimatedHands).forEach(pid => {
            if (this.estimatedHands[pid]) {
                this.estimatedHands[pid] = this.estimatedHands[pid].filter(
                    c => c.id !== card.id
                );
            }
        });
    }

    /**
     * دریافت کارت‌های مشاهده شده
     * @param {number} playerId - شناسه بازیکن (اختیاری)
     * @returns {Array<Object>}
     */
    getObservedCards(playerId = null) {
        if (playerId !== null) {
            return this.observedCards.filter(record => record.playerId === playerId);
        }
        return [...this.observedCards];
    }

    /**
     * دریافت کارت‌های بازی نشده
     * @returns {Array<Object>}
     */
    getUnplayedCards() {
        if (!this.cardEngine) return [];

        const allCards = this.cardEngine.createDeck();
        const playedCardIds = new Set(this.observedCards.map(r => r.card.id));

        return allCards.filter(card => !playedCardIds.has(card.id));
    }

    /**
     * شمارش کارت‌های باقی‌مانده از هر خال
     * @returns {Object} { spades: n, hearts: n, diamonds: n, clubs: n }
     */
    countRemainingCardsBySuit() {
        const unplayed = this.getUnplayedCards();

        const counts = {
            spades: 0,
            hearts: 0,
            diamonds: 0,
            clubs: 0
        };

        unplayed.forEach(card => {
            counts[card.suit]++;
        });

        return counts;
    }

    // ============================================================
    // بخش ۲: محاسبه احتمال توزیع کارت
    // ============================================================

    /**
     * محاسبه احتمال توزیع کارت‌ها بین بازیکنان
     * @param {Array<Object>} unknownCards - کارت‌های ناشناخته
     * @param {number} playerCount - تعداد بازیکنان
     * @param {number} cardsPerPlayer - کارت برای هر بازیکن
     * @returns {Object} احتمال توزیع
     */
    calculateCardDistribution(unknownCards, playerCount = 4, cardsPerPlayer = 13) {
        this.stats.totalCalculations++;

        const totalUnknown = unknownCards.length;
        const totalNeeded = playerCount * cardsPerPlayer;

        if (totalUnknown < totalNeeded) {
            return {
                possible: false,
                reason: 'NOT_ENOUGH_CARDS',
                probability: 0
            };
        }

        // محاسبه تعداد کل ترکیب‌های ممکن
        const totalCombinations = this._calculateCombinations(totalUnknown, totalNeeded);

        // محاسبه توزیع برای هر بازیکن
        const distributions = [];

        for (let player = 0; player < playerCount; player++) {
            const playerCombinations = this._calculateCombinations(
                totalUnknown - (player * cardsPerPlayer),
                cardsPerPlayer
            );

            distributions.push({
                player,
                combinations: playerCombinations,
                probability: playerCombinations / totalCombinations
            });
        }

        return {
            possible: true,
            totalCombinations,
            distributions,
            unknownCards: totalUnknown,
            playerCount,
            cardsPerPlayer
        };
    }

    /**
     * محاسبه ترکیب‌ها (nCr)
     * @param {number} n - کل
     * @param {number} r - انتخاب
     * @returns {number}
     * @private
     */
    _calculateCombinations(n, r) {
        if (r > n) return 0;
        if (r === 0 || r === n) return 1;

        let result = 1;
        for (let i = 0; i < r; i++) {
            result *= (n - i);
            result /= (i + 1);
        }

        return result;
    }

    // ============================================================
    // بخش ۳: محاسبه احتمال وجود کارت خاص
    // ============================================================

    /**
     * محاسبه احتمال داشتن کارت خاص توسط یک بازیکن
     * @param {Object} card - کارت مورد نظر
     * @param {number} playerId - شناسه بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {number} احتمال بین 0 و 1
     */
    calculateCardOwnershipProbability(card, playerId, gameState) {
        const cacheKey = `card_ownership_${card.id}_${playerId}`;
        const cached = this._getFromCache(cacheKey);

        if (cached !== null) {
            return cached;
        }

        this.stats.totalCalculations++;

        // بررسی آیا کارت قبلاً بازی شده
        const isPlayed = this.observedCards.some(r => r.card.id === card.id);

        if (isPlayed) {
            // کارت بازی شده، احتمال 0 است مگر اینکه توسط همین بازیکن باشد
            const playedByPlayer = this.observedCards.find(
                r => r.card.id === card.id && r.playerId === playerId
            );

            const probability = playedByPlayer ? 1 : 0;
            this._saveToCache(cacheKey, probability);
            return probability;
        }

        // کارت بازی نشده
        const unplayedCards = this.getUnplayedCards();
        const totalUnplayed = unplayedCards.length;

        if (totalUnplayed === 0) {
            this._saveToCache(cacheKey, 0);
            return 0;
        }

        // تعداد بازیکنان و کارت‌های هر بازیکن
        const playerCount = gameState.players?.length || 4;
        const cardsPerPlayer = gameState.players?.[0]?.hand?.length || 13;

        // اگر بازیکن کارت دارد
        const playerHand = gameState.players?.[playerId]?.hand || [];
        const hasCard = playerHand.some(c => c.id === card.id);

        if (hasCard) {
            this._saveToCache(cacheKey, 1);
            return 1;
        }

        // محاسبه احتمال بر اساس تعداد کارت‌های باقی‌مانده
        const totalCardsNeeded = playerCount * cardsPerPlayer;
        const playerCardsRemaining = cardsPerPlayer - playerHand.length;

        if (playerCardsRemaining <= 0) {
            this._saveToCache(cacheKey, 0);
            return 0;
        }

        // احتمال ساده: کارت‌های بازیکن / کل کارت‌های ناشناخته
        const probability = playerCardsRemaining / totalUnplayed;

        const finalProbability = Math.min(1, Math.max(0, probability));
        this._saveToCache(cacheKey, finalProbability);

        return finalProbability;
    }

    /**
     * محاسبه احتمال داشتن خال خاص توسط بازیکن
     * @param {string} suit - خال
     * @param {number} playerId - شناسه بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {number} احتمال
     */
    calculateSuitOwnershipProbability(suit, playerId, gameState) {
        const unplayedCards = this.getUnplayedCards();
        const suitCards = unplayedCards.filter(c => c.suit === suit);

        if (suitCards.length === 0) {
            return 0;
        }

        // محاسبه احتمال برای هر کارت از این خال
        const probabilities = suitCards.map(card =>
            this.calculateCardOwnershipProbability(card, playerId, gameState)
        );

        // احتمال داشتن حداقل یک کارت از این خال
        const probabilityOfNotHaving = probabilities.reduce(
            (acc, prob) => acc * (1 - prob),
            1
        );

        return 1 - probabilityOfNotHaving;
    }

    // ============================================================
    // بخش ۴: محاسبه احتمال برد دست
    // ============================================================

    /**
     * محاسبه احتمال برد دست با یک کارت خاص
     * @param {Object} card - کارت
     * @param {Array<Object>} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {number} احتمال بین 0 و 1
     */
    calculateTrickWinProbability(card, hand, gameState) {
        const cacheKey = `trick_win_${card.id}`;
        const cached = this._getFromCache(cacheKey);

        if (cached !== null) {
            return cached;
        }

        this.stats.totalCalculations++;

        const currentTrick = gameState.currentTrick || [];
        const trump = gameState.trump;
        const leadSuit = gameState.leadSuit;

        // اگر اولین کارت است
        if (currentTrick.length === 0) {
            const probability = this._calculateLeadingCardWinProbability(card, hand, gameState);
            this._saveToCache(cacheKey, probability);
            return probability;
        }

        // محاسبه ارزش کارت فعلی
        const cardValue = this.cardEngine ?
            this.cardEngine.getCardValue(card) :
            card.value;

        // پیدا کردن بالاترین کارت فعلی
        let highestValue = -1;
        currentTrick.forEach(played => {
            const value = this.cardEngine ?
                this.cardEngine.getCardValue(played.card) :
                played.card.value;

            if (value > highestValue) {
                highestValue = value;
            }
        });

        // اگر کارت ما بالاتر است
        if (cardValue > highestValue) {
            // محاسبه احتمال اینکه بازیکنان بعدی کارت بالاتر داشته باشند
            const remainingPlayers = 4 - currentTrick.length - 1;
            const unplayedCards = this.getUnplayedCards();

            // شمارش کارت‌های بالاتر
            const higherCards = unplayedCards.filter(c => {
                const value = this.cardEngine ?
                    this.cardEngine.getCardValue(c) :
                    c.value;
                return value > cardValue;
            });

            const totalHigher = higherCards.length;
            const totalUnplayed = unplayedCards.length;

            if (totalUnplayed === 0) {
                this._saveToCache(cacheKey, 1);
                return 1;
            }

            // احتمال اینکه هیچ بازیکن بعدی کارت بالاتر نداشته باشد
            const probability = Math.pow(
                1 - (totalHigher / totalUnplayed),
                remainingPlayers
            );

            const finalProbability = Math.max(0, Math.min(1, probability));
            this._saveToCache(cacheKey, finalProbability);

            return finalProbability;
        }

        // کارت ما بالاتر نیست
        this._saveToCache(cacheKey, 0);
        return 0;
    }

    /**
     * محاسبه احتمال برد وقتی شروع‌کننده هستیم
     * @param {Object} card - کارت
     * @param {Array<Object>} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {number}
     * @private
     */
    _calculateLeadingCardWinProbability(card, hand, gameState) {
        const unplayedCards = this.getUnplayedCards();
        const trump = gameState.trump;

        const cardValue = this.cardEngine ?
            this.cardEngine.getCardValue(card) :
            card.value;

        const isTrump = card.suit === trump;

        // شمارش کارت‌های بالاتر
        const higherCards = unplayedCards.filter(c => {
            const value = this.cardEngine ?
                this.cardEngine.getCardValue(c) :
                c.value;

            if (isTrump && c.suit !== trump) return false;
            if (!isTrump && c.suit === trump) return true;

            return value > cardValue;
        });

        const totalHigher = higherCards.length;
        const totalUnplayed = unplayedCards.length;

        if (totalUnplayed === 0) {
            return 1;
        }

        // احتمال اینکه هیچ بازیکنی کارت بالاتر نداشته باشد
        const playersToCheck = 3;
        const probability = Math.pow(
            1 - (totalHigher / totalUnplayed),
            playersToCheck
        );

        return Math.max(0, Math.min(1, probability));
    }

    // ============================================================
    // بخش ۵: محاسبه احتمال برد Round
    // ============================================================

    /**
     * محاسبه احتمال برد Round
     * @param {Object} gameState - وضعیت بازی
     * @param {number} playerId - شناسه بازیکن
     * @returns {number} احتمال
     */
    calculateRoundWinProbability(gameState, playerId) {
        const team = gameState.players?.[playerId]?.team;
        if (!team) return 0.5;

        const teamScore = gameState.scores?.[team] || 0;
        const opponentTeam = team === 'team1' ? 'team2' : 'team1';
        const opponentScore = gameState.scores?.[opponentTeam] || 0;

        const tricksRemaining = 26 - (teamScore + opponentScore);

        if (tricksRemaining === 0) {
            return teamScore > opponentScore ? 1 : 0;
        }

        // محاسبه ساده بر اساس امتیاز فعلی
        const scoreDiff = teamScore - opponentScore;
        const baseProbability = 0.5 + (scoreDiff / 52);

        // تنظیم بر اساس تعداد دست‌های باقی‌مانده
        const adjustment = (tricksRemaining / 52) * 0.2;

        const probability = baseProbability + adjustment;

        return Math.max(0, Math.min(1, probability));
    }

    // ============================================================
    // بخش ۶: محاسبه احتمال برد Match
    // ============================================================

    /**
     * محاسبه احتمال برد Match
     * @param {Object} gameState - وضعیت بازی
     * @param {number} playerId - شناسه بازیکن
     * @returns {number} احتمال
     */
    calculateMatchWinProbability(gameState, playerId) {
        const team = gameState.players?.[playerId]?.team;
        if (!team) return 0.5;

        const roundWinners = gameState.roundWinners || [];
        const roundsToWin = gameState.roundsToWin || 2;

        const teamWins = roundWinners.filter(r => r.winner === team).length;
        const opponentTeam = team === 'team1' ? 'team2' : 'team1';
        const opponentWins = roundWinners.filter(r => r.winner === opponentTeam).length;

        // اگر تیم برنده شده
        if (teamWins >= roundsToWin) return 1;
        if (opponentWins >= roundsToWin) return 0;

        // محاسبه بر اساس تعداد Round های برده شده
        const totalRounds = teamWins + opponentWins;
        const remainingRounds = (roundsToWin * 2) - totalRounds - 1;

        const winProbability = teamWins / Math.max(1, totalRounds);
        const momentum = (teamWins - opponentWins) / Math.max(1, totalRounds);

        const probability = 0.5 + (winProbability - 0.5) * 0.6 + momentum * 0.2;

        return Math.max(0, Math.min(1, probability));
    }

    // ============================================================
    // بخش : محاسبه احتمال Kot
    // ============================================================

    /**
     * محاسبه احتمال Kot (برد همه دست‌ها)
     * @param {Object} gameState - وضعیت بازی
     * @param {string} team - تیم
     * @returns {number} احتمال
     */
    calculateKotProbability(gameState, team) {
        const teamScore = gameState.scores?.[team] || 0;
        const opponentTeam = team === 'team1' ? 'team2' : 'team1';
        const opponentScore = gameState.scores?.[opponentTeam] || 0;

        const tricksRemaining = 26 - (teamScore + opponentScore);

        // اگر حریف امتیاز دارد، Kot غیرممکن است
        if (opponentScore > 0) {
            return 0;
        }

        // محاسبه بر اساس تعداد دست‌های باقی‌مانده
        const baseProbability = Math.pow(0.7, tricksRemaining);

        return Math.max(0, Math.min(1, baseProbability));
    }

    // ============================================================
    // بخش ۸: شبیه‌سازی Monte Carlo
    // ============================================================

    /**
     * شبیه‌سازی Monte Carlo برای تصمیم‌گیری
     * @param {Array<Object>} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @param {number} simulations - تعداد شبیه‌سازی
     * @returns {Object} نتیجه
     */
    monteCarloSimulation(hand, gameState, simulations = 100) {
        this.stats.monteCarloSimulations += simulations;

        const unplayedCards = this.getUnplayedCards();
        const playerCount = gameState.players?.length || 4;

        const results = {
            totalSimulations: simulations,
            wins: 0,
            losses: 0,
            averageTricksWon: 0,
            bestCard: null,
            bestCardWinRate: 0
        };

        // شبیه‌سازی برای هر کارت در دست
        hand.forEach(card => {
            let cardWins = 0;

            for (let sim = 0; sim < simulations; sim++) {
                // توزیع تصادفی کارت‌ها
                const simulatedHands = this._simulateCardDistribution(
                    unplayedCards.filter(c => c.id !== card.id),
                    playerCount - 1
                );

                // شبیه‌سازی بازی
                const trickResult = this._simulateTrick(
                    card,
                    simulatedHands,
                    gameState
                );

                if (trickResult.winner === 0) {
                    cardWins++;
                }
            }

            const winRate = cardWins / simulations;

            if (!results.bestCard || winRate > results.bestCardWinRate) {
                results.bestCard = card;
                results.bestCardWinRate = winRate;
            }
        });

        results.wins = Math.round(results.bestCardWinRate * simulations);
        results.losses = simulations - results.wins;
        results.averageTricksWon = results.bestCardWinRate;

        return results;
    }

    /**
     * شبیه‌سازی توزیع کارت‌ها
     * @param {Array<Object>} cards - کارت‌ها
     * @param {number} playerCount - تعداد بازیکنان
     * @returns {Array<Array<Object>>} دست‌های شبیه‌سازی شده
     * @private
     */
    _simulateCardDistribution(cards, playerCount) {
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        const hands = [];

        const cardsPerPlayer = Math.floor(shuffled.length / playerCount);

        for (let i = 0; i < playerCount; i++) {
            hands.push(shuffled.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer));
        }

        return hands;
    }

    /**
     * شبیه‌سازی یک دست
     * @param {Object} card - کارت بازیکن
     * @param {Array<Array<Object>>} simulatedHands - دست‌های شبیه‌سازی شده
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     * @private
     */
    _simulateTrick(card, simulatedHands, gameState) {
        const trump = gameState.trump;
        const leadSuit = card.suit;

        const playedCards = [{ card, playerIndex: 0 }];

        // بازی کارت‌های شبیه‌سازی شده
        simulatedHands.forEach((hand, index) => {
            if (hand.length === 0) return;

            // انتخاب کارت (ساده‌ترین استراتژی)
            const validCards = hand.filter(c => {
                if (!leadSuit) return true;
                const hasLeadSuit = hand.some(c => c.suit === leadSuit);
                if (!hasLeadSuit) return true;
                return c.suit === leadSuit;
            });

            const selectedCard = validCards[0] || hand[0];
            playedCards.push({
                card: selectedCard,
                playerIndex: index + 1
            });
        });

        // تعیین برنده
        let winnerIndex = 0;
        let highestValue = -1;

        playedCards.forEach((played, index) => {
            const value = this.cardEngine ?
                this.cardEngine.getCardValue(played.card) :
                played.card.value;

            if (value > highestValue) {
                highestValue = value;
                winnerIndex = index;
            }
        });

        return {
            winner: winnerIndex,
            playedCards
        };
    }

    // ============================================================
    // بخش ۹: محاسبه Bayesian Probability
    // ============================================================

    /**
     * محاسبه احتمال Bayesian
     * @param {string} hypothesis - فرضیه
     * @param {Object} evidence - شواهد
     * @param {Object} priorProbabilities - احتمالات پیشین
     * @returns {number} احتمال posterior
     */
    calculateBayesianProbability(hypothesis, evidence, priorProbabilities) {
        const prior = priorProbabilities[hypothesis] || 0.5;

        // محاسبه likelihood
        const likelihood = this._calculateLikelihood(hypothesis, evidence);

        // محاسبه marginal likelihood
        const marginalLikelihood = Object.keys(priorProbabilities).reduce(
            (sum, h) => {
                const hPrior = priorProbabilities[h];
                const hLikelihood = this._calculateLikelihood(h, evidence);
                return sum + (hPrior * hLikelihood);
            },
            0
        );

        if (marginalLikelihood === 0) {
            return prior;
        }

        // Bayesian formula: P(H|E) = P(E|H) * P(H) / P(E)
        const posterior = (likelihood * prior) / marginalLikelihood;

        return Math.max(0, Math.min(1, posterior));
    }

    /**
     * محاسبه likelihood
     * @param {string} hypothesis - فرضیه
     * @param {Object} evidence - شواهد
     * @returns {number}
     * @private
     */
    _calculateLikelihood(hypothesis, evidence) {
        // پیاده‌سازی ساده
        return 0.5;
    }

    // ============================================================
    // بخش ۱: پیش‌بینی کارت‌های حریف
    // ============================================================

    /**
     * پیش‌بینی کارت‌های احتمالی حریف
     * @param {number} playerId - شناسه بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Array<Object>} کارت‌های احتمالی
     */
    predictOpponentCards(playerId, gameState) {
        const unplayedCards = this.getUnplayedCards();
        const playerHand = gameState.players?.[playerId]?.hand || [];

        // اگر دست بازیکن مشخص است
        if (playerHand.length > 0) {
            return playerHand;
        }

        // محاسبه احتمال برای هر کارت
        const cardProbabilities = unplayedCards.map(card => ({
            card,
            probability: this.calculateCardOwnershipProbability(card, playerId, gameState)
        }));

        // مرتب‌سازی بر اساس احتمال
        cardProbabilities.sort((a, b) => b.probability - a.probability);

        // بازگرداندن کارت‌های با احتمال بالا
        const cardsPerPlayer = 13;
        return cardProbabilities
            .filter(cp => cp.probability > 0.1)
            .slice(0, cardsPerPlayer)
            .map(cp => cp.card);
    }

    // ============================================================
    // بخش ۱۱: توابع کمکی
    // ============================================================

    /**
     * دریافت از کش
     * @param {string} key - کلید
     * @returns {*|null}
     * @private
     */
    _getFromCache(key) {
        const cached = this.calculationCache.get(key);

        if (!cached) return null;

        if (Date.now() > cached.expiry) {
            this.calculationCache.delete(key);
            return null;
        }

        return cached.value;
    }

    /**
     * ذخیره در کش
     * @param {string} key - کلید
     * @param {*} value - مقدار
     * @private
     */
    _saveToCache(key, value) {
        this.calculationCache.set(key, {
            value,
            expiry: Date.now() + this.cacheTTL
        });
    }

    /**
     * پاک کردن کش
     * @private
     */
    _clearCache() {
        this.calculationCache.clear();
    }

    /**
     * دریافت آمار
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            observedCardsCount: this.observedCards.length,
            cacheSize: this.calculationCache.size
        };
    }

    /**
     * ریست کامل
     */
    reset() {
        this.observedCards = [];
        this.estimatedHands = {};
        this.remainingDeck = [];
        this.calculationCache.clear();

        this.stats = {
            totalCalculations: 0,
            accuratePredictions: 0,
            failedPredictions: 0,
            monteCarloSimulations: 0
        };

        if (this.debug) {
            console.log('🔄 AIProbabilityEngine reset');
        }
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
                    console.error(`❌ Probability event listener error:`, error);
                }
            });
        }

        eventBus.emit(`ai-probability:${event}`, data);
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

        console.log('🎲 AIProbabilityEngine Status:');
        console.log('  Total Calculations:', stats.totalCalculations);
        console.log('  Accurate Predictions:', stats.accuratePredictions);
        console.log('  Failed Predictions:', stats.failedPredictions);
        console.log('  Monte Carlo Simulations:', stats.monteCarloSimulations);
        console.log('  Observed Cards:', stats.observedCardsCount);
        console.log('  Cache Size:', stats.cacheSize);
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const aiProbabilityEngine = new AIProbabilityEngine();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIProbabilityEngine, aiProbabilityEngine };
} else {
    window.AIProbabilityEngine = AIProbabilityEngine;
    window.aiProbabilityEngine = aiProbabilityEngine;
}

console.log('✅ AIProbabilityEngine loaded');
