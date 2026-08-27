/**
 * ============================================================
 * HOKM MASTER - AI Engine
 * موتور هوش مصنوعی بازی حکم
 * ============================================================
 * 
 * این فایل مسئول مدیریت هوش مصنوعی بازیکنان است. AI می‌تواند
 * در 6 سطح مختلف بازی کند و شامل سیستم‌های پیشرفته مانند
 * ردیابی کارت‌ها، محاسبه احتمال، مدیریت حکم، آگاهی از هم‌تیمی،
 * برنامه‌ریزی دست و استراتژی پایان بازی است.
 * 
 * مهم: AI فقط کارت‌های خود را می‌بیند و تقلب نمی‌کند.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - cardEngine (از فایل cards.js)
 * - hokmEngine (از فایل engine.js)
 * 
 * ============================================================
 */

class AIEngine {

    constructor() {
        /**
         * سطح پیش‌فرض AI
         * @type {string}
         */
        this.defaultLevel = CONFIG.AI.DEFAULT_LEVEL;

        /**
         * مرجع CardEngine
         * @type {CardEngine}
         */
        this.cardEngine = null;

        /**
         * مرجع HokmEngine
         * @type {HokmEngine}
         */
        this.hokmEngine = null;

        /**
         * کارت‌های بازی‌شده توسط همه بازیکنان (برای ردیابی)
         * @type {Array<Object>}
         */
        this.playedCards = [];

        /**
         * کارت‌های مشاهده‌شده از دیگران
         * @type {Array<Object>}
         */
        this.observedCards = [];

        /**
         * کارت‌های باقی‌مانده در دست حریفان (تخمین)
         * @type {Object}
         */
        this.remainingCards = {};

        /**
         * تاریخچه دست‌های قبلی
         * @type {Array}
         */
        this.trickHistory = [];

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
         * آمار AI
         * @type {Object}
         */
        this.stats = {
            totalMoves: 0,
            trumpPlays: 0,
            successfulTricks: 0,
            failedTricks: 0,
            partnerTricksWon: 0
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

        if (typeof hokmEngine !== 'undefined') {
            this.hokmEngine = hokmEngine;
        }

        if (this.debug) {
            console.log('🤖 AIEngine initialized');
        }
    }

    // ============================================================
    // بخش ۱: انتخاب کارت برای بازی
    // ============================================================

    /**
     * انتخاب بهترین کارت برای بازی
     * @param {Array} hand - دست بازیکن AI
     * @param {Object} gameState - وضعیت بازی
     * @param {string} level - سطح AI
     * @returns {Object} کارت انتخاب شده
     */
    selectCard(hand, gameState, level = this.defaultLevel) {
        if (!hand || hand.length === 0) {
            throw new Error('Hand is empty');
        }

        const aiConfig = CONFIG.AI.LEVELS[level.toUpperCase()] || CONFIG.AI.LEVELS.NORMAL;

        // شبیه‌سازی تفکر
        const thinkingDelay = CONFIG.AI.THINKING_DELAY_MS + 
            Utils.randomInt(-CONFIG.AI.THINKING_DELAY_VARIANCE_MS, CONFIG.AI.THINKING_DELAY_VARIANCE_MS);

        // اعمال خطای تصادفی بر اساس سطح
        if (Math.random() < aiConfig.ERROR_RATE) {
            return this._makeRandomMove(hand, gameState);
        }

        // انتخاب استراتژی بر اساس سطح
        let selectedCard;

        switch (level.toLowerCase()) {
            case 'beginner':
                selectedCard = this._beginnerStrategy(hand, gameState);
                break;
            case 'easy':
                selectedCard = this._easyStrategy(hand, gameState);
                break;
            case 'normal':
                selectedCard = this._normalStrategy(hand, gameState);
                break;
            case 'hard':
                selectedCard = this._hardStrategy(hand, gameState);
                break;
            case 'expert':
                selectedCard = this._expertStrategy(hand, gameState);
                break;
            case 'master':
                selectedCard = this._masterStrategy(hand, gameState);
                break;
            default:
                selectedCard = this._normalStrategy(hand, gameState);
        }

        this.stats.totalMoves++;

        this._emit('move-made', {
            card: selectedCard,
            level: level,
            thinkingTime: thinkingDelay
        });

        if (this.debug) {
            console.log(` AI (${level}) selected: ${selectedCard.nameFa}`);
        }

        return selectedCard;
    }

    /**
     * انتخاب حکم توسط AI
     * @param {Array} hand - دست بازیکن AI
     * @param {string} level - سطح AI
     * @returns {string} خال انتخاب شده
     */
    selectTrump(hand, level = this.defaultLevel) {
        if (!hand || hand.length === 0) {
            const suits = Object.values(CONFIG.GAME.CARDS.SUITS);
            return suits[Utils.randomInt(0, suits.length - 1)];
        }

        const aiConfig = CONFIG.AI.LEVELS[level.toUpperCase()] || CONFIG.AI.LEVELS.NORMAL;

        // اعمال خطا
        if (Math.random() < aiConfig.ERROR_RATE) {
            const suits = Object.values(CONFIG.GAME.CARDS.SUITS);
            return suits[Utils.randomInt(0, suits.length - 1)];
        }

        // شمارش کارت‌های هر خال
        const suitCounts = {
            spades: 0,
            hearts: 0,
            diamonds: 0,
            clubs: 0
        };

        const suitValues = {
            spades: 0,
            hearts: 0,
            diamonds: 0,
            clubs: 0
        };

        hand.forEach(card => {
            suitCounts[card.suit]++;
            suitValues[card.suit] += card.value;
        });

        // استراتژی انتخاب حکم بر اساس سطح
        let selectedSuit;

        if (level === 'beginner' || level === 'easy') {
            // انتخاب خال با بیشترین کارت
            selectedSuit = Object.keys(suitCounts).reduce((a, b) => 
                suitCounts[a] > suitCounts[b] ? a : b
            );
        } else {
            // انتخاب خال با بیشترین ارزش
            selectedSuit = Object.keys(suitValues).reduce((a, b) => 
                suitValues[a] > suitValues[b] ? a : b
            );

            // اگر آس یا شاه داریم، اولویت با آن خال
            const highCards = hand.filter(c => c.rank === 'A' || c.rank === 'K');
            if (highCards.length > 0) {
                const highCardSuit = highCards[0].suit;
                if (suitCounts[highCardSuit] >= 2) {
                    selectedSuit = highCardSuit;
                }
            }
        }

        this._emit('trump-chosen', {
            suit: selectedSuit,
            level: level,
            hand: hand
        });

        if (this.debug) {
            console.log(`👑 AI (${level}) chose trump: ${selectedSuit}`);
        }

        return selectedSuit;
    }

    // ============================================================
    // بخش ۲: استراتژی‌های مختلف
    // ============================================================

    /**
     * استراتژی مبتدی - کاملاً تصادفی
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _beginnerStrategy(hand, gameState) {
        const randomIndex = Utils.randomInt(0, hand.length - 1);
        return hand[randomIndex];
    }

    /**
     * استراتژی آسان - بازی کارت‌های پایین
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _easyStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        // بازی کوچکترین کارت معتبر
        const sorted = this.cardEngine ? 
            this.cardEngine.sortByValue(validCards) : 
            validCards.sort((a, b) => a.value - b.value);

        return sorted[0];
    }

    /**
     * استراتژی معمولی - تعادل بین حمله و دفاع
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _normalStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        const isLeading = !gameState.leadSuit || gameState.leadSuit === null;
        const currentTrick = gameState.currentTrick || [];

        if (isLeading) {
            // وقتی شروع‌کننده هستیم
            return this._selectLeadingCard(validCards, gameState);
        } else {
            // وقتی باید Follow Suit کنیم
            return this._selectFollowingCard(validCards, gameState, currentTrick);
        }
    }

    /**
     * استراتژی سخت - با ردیابی کارت‌ها
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _hardStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        // استفاده از اطلاعات کارت‌های بازی‌شده
        this._updateCardTracking(gameState);

        const isLeading = !gameState.leadSuit;
        
        if (isLeading) {
            return this._selectLeadingCardAdvanced(validCards, gameState);
        } else {
            return this._selectFollowingCardAdvanced(validCards, gameState);
        }
    }

    /**
     * استراتژی حرفه‌ای - با احتمال و شراکت
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _expertStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        this._updateCardTracking(gameState);

        const probabilities = this._calculateCardProbabilities(hand, gameState);
        const partnerAwareness = this._assessPartnerSituation(gameState);

        return this._selectCardWithProbability(validCards, gameState, probabilities, partnerAwareness);
    }

    /**
     * استراتژی استاد - بهینه‌ترین بازی
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _masterStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        this._updateCardTracking(gameState);

        const probabilities = this._calculateCardProbabilities(hand, gameState);
        const partnerAwareness = this._assessPartnerSituation(gameState);
        const endgameStrategy = this._calculateEndgameStrategy(hand, gameState);

        return this._selectOptimalCard(validCards, gameState, probabilities, partnerAwareness, endgameStrategy);
    }

    // ============================================================
    // بخش ۳: انتخاب کارت پیشرفته
    // ============================================================

    /**
     * انتخاب کارت وقتی شروع‌کننده هستیم
     * @param {Array} validCards - کارت‌های معتبر
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _selectLeadingCard(validCards, gameState) {
        // بازی کارت‌های بالا برای بردن دست
        const highCards = validCards.filter(c => c.value >= 10);
        
        if (highCards.length > 0) {
            const sorted = this.cardEngine ? 
                this.cardEngine.sortByValue(highCards) : 
                highCards.sort((a, b) => b.value - a.value);
            return sorted[0]; // بالاترین کارت
        }

        // اگر کارت بالا نداریم، کارت متوسط بازی کنیم
        const sorted = this.cardEngine ? 
            this.cardEngine.sortByValue(validCards) : 
            validCards.sort((a, b) => b.value - a.value);
        
        return sorted[Math.floor(sorted.length / 2)];
    }

    /**
     * انتخاب کارت وقتی باید Follow Suit کنیم
     * @param {Array} validCards - کارت‌های معتبر
     * @param {Object} gameState - وضعیت بازی
     * @param {Array} currentTrick - کارت‌های فعلی دست
     * @returns {Object}
     * @private
     */
    _selectFollowingCard(validCards, gameState, currentTrick) {
        if (currentTrick.length === 0) {
            return validCards[0];
        }

        // پیدا کردن بالاترین کارت فعلی
        const highestCard = currentTrick.reduce((max, played) => {
            const value = this.cardEngine ? 
                this.cardEngine.getCardValue(played.card) : 
                played.card.value;
            const maxValue = this.cardEngine ? 
                this.cardEngine.getCardValue(max.card) : 
                max.card.value;
            return value > maxValue ? played : max;
        });

        const highestValue = this.cardEngine ? 
            this.cardEngine.getCardValue(highestCard.card) : 
            highestCard.card.value;

        // آیا می‌توانیم این دست را ببریم؟
        const winningCards = validCards.filter(c => {
            const value = this.cardEngine ? 
                this.cardEngine.getCardValue(c) : 
                c.value;
            return value > highestValue;
        });

        if (winningCards.length > 0) {
            // بازی کوچکترین کارت برنده (صرفه‌جویی)
            const sorted = this.cardEngine ? 
                this.cardEngine.sortByValue(winningCards) : 
                winningCards.sort((a, b) => a.value - b.value);
            return sorted[0];
        }

        // نمی‌توانیم ببریم، کوچکترین کارت را بازی کنیم
        const sorted = this.cardEngine ? 
            this.cardEngine.sortByValue(validCards) : 
            validCards.sort((a, b) => a.value - b.value);
        
        return sorted[0];
    }

    /**
     * انتخاب کارت پیشرفته وقتی شروع‌کننده هستیم
     * @param {Array} validCards - کارت‌های معتبر
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _selectLeadingCardAdvanced(validCards, gameState) {
        // تحلیل کارت‌های بازی‌شده
        const remainingInSuit = this._getRemainingCardsBySuit(gameState);

        // انتخاب خالی که کمترین کارت باقی‌مانده را دارد
        let bestSuit = null;
        let minRemaining = Infinity;

        validCards.forEach(card => {
            const remaining = remainingInSuit[card.suit] || 0;
            if (remaining < minRemaining) {
                minRemaining = remaining;
                bestSuit = card.suit;
            }
        });

        // بازی بالاترین کارت از آن خال
        const suitCards = validCards.filter(c => c.suit === bestSuit);
        const sorted = this.cardEngine ? 
            this.cardEngine.sortByValue(suitCards) : 
            suitCards.sort((a, b) => b.value - a.value);

        return sorted[0];
    }

    /**
     * انتخاب کارت پیشرفته وقتی Follow Suit می‌کنیم
     * @param {Array} validCards - کارت‌های معتبر
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _selectFollowingCardAdvanced(validCards, gameState) {
        const currentTrick = gameState.currentTrick || [];
        
        if (currentTrick.length === 0) {
            return validCards[0];
        }

        // محاسبه احتمال برد
        const winProbability = this._calculateWinProbability(validCards, currentTrick, gameState);

        if (winProbability > 0.7) {
            // احتمال برد بالا - بازی کارت برنده
            const winningCards = validCards.filter(c => {
                const value = this.cardEngine ? this.cardEngine.getCardValue(c) : c.value;
                const maxCurrent = Math.max(...currentTrick.map(p => 
                    this.cardEngine ? this.cardEngine.getCardValue(p.card) : p.card.value
                ));
                return value > maxCurrent;
            });

            const sorted = this.cardEngine ? 
                this.cardEngine.sortByValue(winningCards) : 
                winningCards.sort((a, b) => a.value - b.value);
            
            return sorted[0];
        }

        // احتمال برد پایین - بازی کارت پایین
        const sorted = this.cardEngine ? 
            this.cardEngine.sortByValue(validCards) : 
            validCards.sort((a, b) => a.value - b.value);
        
        return sorted[0];
    }

    // ============================================================
    // بخش ۴: ردیابی کارت‌ها
    // ============================================================

    /**
     * به‌روزرسانی ردیابی کارت‌ها
     * @param {Object} gameState - وضعیت بازی
     * @private
     */
    _updateCardTracking(gameState) {
        if (!gameState.history) return;

        gameState.history.forEach(event => {
            if (event.type === 'card_played') {
                const card = event.card;
                const player = event.player;

                if (!this.observedCards.find(c => c.id === card.id)) {
                    this.observedCards.push({
                        ...card,
                        playedBy: player,
                        playedAt: event.timestamp
                    });
                }
            }
        });

        // محاسبه کارت‌های باقی‌مانده
        this._calculateRemainingCards();
    }

    /**
     * محاسبه کارت‌های باقی‌مانده
     * @private
     */
    _calculateRemainingCards() {
        const allCards = this.cardEngine ? this.cardEngine.createDeck() : [];
        
        this.remainingCards = {
            spades: [],
            hearts: [],
            diamonds: [],
            clubs: []
        };

        allCards.forEach(card => {
            const isObserved = this.observedCards.find(c => c.id === card.id);
            if (!isObserved) {
                this.remainingCards[card.suit].push(card);
            }
        });
    }

    /**
     * دریافت کارت‌های باقی‌مانده به تفکیک خال
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _getRemainingCardsBySuit(gameState) {
        this._updateCardTracking(gameState);

        const counts = {
            spades: this.remainingCards.spades.length,
            hearts: this.remainingCards.hearts.length,
            diamonds: this.remainingCards.diamonds.length,
            clubs: this.remainingCards.clubs.length
        };

        return counts;
    }

    // ============================================================
    // بخش ۵: محاسبه احتمال
    // ============================================================

    /**
     * محاسبه احتمال کارت‌ها
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _calculateCardProbabilities(hand, gameState) {
        const probabilities = {};

        hand.forEach(card => {
            const remaining = this.remainingCards[card.suit] || [];
            const higherCards = remaining.filter(c => 
                this.cardEngine ? 
                this.cardEngine.getCardValue(c) > this.cardEngine.getCardValue(card) : 
                c.value > card.value
            );

            probabilities[card.id] = {
                card: card,
                winProbability: 1 - (higherCards.length / Math.max(1, remaining.length)),
                remainingInSuit: remaining.length,
                higherRemaining: higherCards.length
            };
        });

        return probabilities;
    }

    /**
     * محاسبه احتمال برد
     * @param {Array} validCards - کارت‌های معتبر
     * @param {Array} currentTrick - دست فعلی
     * @param {Object} gameState - وضعیت بازی
     * @returns {number} احتمال بین 0 و 1
     * @private
     */
    _calculateWinProbability(validCards, currentTrick, gameState) {
        if (currentTrick.length === 0) return 0.5;

        const maxCurrentValue = Math.max(...currentTrick.map(p => 
            this.cardEngine ? this.cardEngine.getCardValue(p.card) : p.card.value
        ));

        const winningCards = validCards.filter(c => {
            const value = this.cardEngine ? this.cardEngine.getCardValue(c) : c.value;
            return value > maxCurrentValue;
        });

        return winningCards.length / Math.max(1, validCards.length);
    }

    // ============================================================
    // بخش ۶: آگاهی از هم‌تیمی
    // ============================================================

    /**
     * ارزیابی وضعیت هم‌تیمی
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _assessPartnerSituation(gameState) {
        if (!gameState.players) {
            return { partnerStrong: false, partnerWeak: false };
        }

        const myTeam = gameState.players[gameState.currentPlayer]?.team;
        const partner = gameState.players.find(p => p.team === myTeam && p.index !== gameState.currentPlayer);

        if (!partner) {
            return { partnerStrong: false, partnerWeak: false };
        }

        // تحلیل بر اساس دست‌های برده شده
        const partnerTricksWon = partner.tricksWon || 0;
        const avgTricksPerPlayer = (gameState.scores?.team1 + gameState.scores?.team2) / 4;

        return {
            partnerStrong: partnerTricksWon > avgTricksPerPlayer,
            partnerWeak: partnerTricksWon < avgTricksPerPlayer * 0.5,
            partnerTricksWon: partnerTricksWon,
            partnerHandSize: partner.hand?.length || 0
        };
    }

    /**
     * انتخاب کارت با در نظر گرفتن احتمال
     * @param {Array} validCards - کارت‌های معتبر
     * @param {Object} gameState - وضعیت بازی
     * @param {Object} probabilities - احتمالات
     * @param {Object} partnerAwareness - آگاهی از هم‌تیمی
     * @returns {Object}
     * @private
     */
    _selectCardWithProbability(validCards, gameState, probabilities, partnerAwareness) {
        // اگر هم‌تیمی قوی است، کارت پایین بازی کنیم
        if (partnerAwareness.partnerStrong) {
            const sorted = this.cardEngine ? 
                this.cardEngine.sortByValue(validCards) : 
                validCards.sort((a, b) => a.value - b.value);
            return sorted[0];
        }

        // اگر هم‌تیمی ضعیف است، باید قوی بازی کنیم
        if (partnerAwareness.partnerWeak) {
            const highCards = validCards.filter(c => {
                const prob = probabilities[c.id];
                return prob && prob.winProbability > 0.6;
            });

            if (highCards.length > 0) {
                const sorted = this.cardEngine ? 
                    this.cardEngine.sortByValue(highCards) : 
                    highCards.sort((a, b) => b.value - a.value);
                return sorted[0];
            }
        }

        // حالت عادی - انتخاب بر اساس احتمال
        let bestCard = validCards[0];
        let bestProbability = 0;

        validCards.forEach(card => {
            const prob = probabilities[card.id];
            if (prob && prob.winProbability > bestProbability) {
                bestProbability = prob.winProbability;
                bestCard = card;
            }
        });

        return bestCard;
    }

    /**
     * انتخاب کارت بهینه با استراتژی پایان بازی
     * @param {Array} validCards - کارت‌های معتبر
     * @param {Object} gameState - وضعیت بازی
     * @param {Object} probabilities - احتمالات
     * @param {Object} partnerAwareness - آگاهی از هم‌تیمی
     * @param {Object} endgameStrategy - استراتژی پایان بازی
     * @returns {Object}
     * @private
     */
    _selectOptimalCard(validCards, gameState, probabilities, partnerAwareness, endgameStrategy) {
        // اگر در پایان بازی هستیم
        if (endgameStrategy.isEndgame) {
            return this._selectEndgameCard(validCards, gameState, endgameStrategy);
        }

        // استراتژی عادی با احتمال
        return this._selectCardWithProbability(validCards, gameState, probabilities, partnerAwareness);
    }

    // ============================================================
    // بخش ۷: استراتژی پایان بازی
    // ============================================================

    /**
     * محاسبه استراتژی پایان بازی
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _calculateEndgameStrategy(hand, gameState) {
        const cardsRemaining = hand.length;
        const isEndgame = cardsRemaining <= 3;

        return {
            isEndgame: isEndgame,
            cardsRemaining: cardsRemaining,
            shouldPlayHigh: isEndgame && gameState.scores?.team1 === gameState.scores?.team2,
            shouldSaveTrump: isEndgame && this.cardEngine?.getTrump()
        };
    }

    /**
     * انتخاب کارت در پایان بازی
     * @param {Array} validCards - کارت‌های معتبر
     * @param {Object} gameState - وضعیت بازی
     * @param {Object} endgameStrategy - استراتژی پایان بازی
     * @returns {Object}
     * @private
     */
    _selectEndgameCard(validCards, gameState, endgameStrategy) {
        if (endgameStrategy.shouldPlayHigh) {
            // بازی کارت بالا برای بردن
            const sorted = this.cardEngine ? 
                this.cardEngine.sortByValue(validCards) : 
                validCards.sort((a, b) => b.value - a.value);
            return sorted[0];
        }

        if (endgameStrategy.shouldSaveTrump) {
            // ذخیره حکم برای بعد
            const nonTrumpCards = validCards.filter(c => c.suit !== this.cardEngine.getTrump());
            if (nonTrumpCards.length > 0) {
                const sorted = this.cardEngine ? 
                    this.cardEngine.sortByValue(nonTrumpCards) : 
                    nonTrumpCards.sort((a, b) => a.value - b.value);
                return sorted[0];
            }
        }

        // حالت عادی
        const sorted = this.cardEngine ? 
            this.cardEngine.sortByValue(validCards) : 
            validCards.sort((a, b) => a.value - b.value);
        
        return sorted[0];
    }

    // ============================================================
    // بخش ۸: حرکت تصادفی
    // ============================================================

    /**
     * حرکت تصادفی (برای خطا)
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _makeRandomMove(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);
        
        if (validCards.length === 0) {
            return hand[Utils.randomInt(0, hand.length - 1)];
        }

        const randomIndex = Utils.randomInt(0, validCards.length - 1);
        return validCards[randomIndex];
    }

    // ============================================================
    // بخش ۹: توابع کمکی
    // ============================================================

    /**
     * دریافت کارت‌های معتبر برای بازی
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Array}
     * @private
     */
    _getValidCards(hand, gameState) {
        if (!this.cardEngine) return hand;

        return hand.filter(card => {
            const validation = this.cardEngine.validatePlay(card, hand);
            return validation.valid;
        });
    }

    /**
     * دریافت اطلاعات کامل AI
     * @returns {Object}
     */
    getAIInfo() {
        return {
            defaultLevel: this.defaultLevel,
            stats: this.stats,
            observedCardsCount: this.observedCards.length,
            remainingCards: {
                spades: this.remainingCards.spades?.length || 0,
                hearts: this.remainingCards.hearts?.length || 0,
                diamonds: this.remainingCards.diamonds?.length || 0,
                clubs: this.remainingCards.clubs?.length || 0
            }
        };
    }

    /**
     * ریست AI
     * @returns {void}
     */
    reset() {
        this.playedCards = [];
        this.observedCards = [];
        this.remainingCards = {};
        this.trickHistory = [];
        this.stats = {
            totalMoves: 0,
            trumpPlays: 0,
            successfulTricks: 0,
            failedTricks: 0,
            partnerTricksWon: 0
        };

        if (this.debug) {
            console.log('🤖 AIEngine reset');
        }
    }

    // ============================================================
    // بخش ۱۰: Event System
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
                    console.error(`❌ AI event listener error:`, error);
                }
            });
        }

        eventBus.emit(`ai:${event}`, data);
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
        const info = this.getAIInfo();

        console.log('🤖 AI Status:');
        console.log('  Default Level:', info.defaultLevel);
        console.log('  Total Moves:', info.stats.totalMoves);
        console.log('  Observed Cards:', info.observedCardsCount);
        console.log('  Remaining:');
        console.log('    Spades:', info.remainingCards.spades);
        console.log('    Hearts:', info.remainingCards.hearts);
        console.log('    Diamonds:', info.remainingCards.diamonds);
        console.log('    Clubs:', info.remainingCards.clubs);
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const aiEngine = new AIEngine();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIEngine, aiEngine };
} else {
    window.AIEngine = AIEngine;
    window.aiEngine = aiEngine;
}

console.log('✅ AIEngine loaded');
