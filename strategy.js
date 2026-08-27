/**
 * ============================================================
 * HOKM MASTER - AI Strategy Engine
 * موتور استراتژی‌های هوش مصنوعی
 * ============================================================
 * 
 * این فایل مسئول پیاده‌سازی استراتژی‌های مختلف بازی برای
 * هوش مصنوعی است. شامل استراتژی‌های حمله، دفاع، متعادل،
 * انتخاب حکم، بازی کارت، مدیریت Trump، همکاری با هم‌تیمی،
 * پایان بازی، Bluff، و محاسبه احتمال.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - cardEngine (از فایل cards.js)
 * - aiLevelsManager (از فایل levels.js)
 * 
 * ============================================================
 */

class AIStrategyEngine {

    constructor() {
        /**
         * مرجع CardEngine
         * @type {CardEngine}
         */
        this.cardEngine = null;

        /**
         * مرجع AILevelsManager
         * @type {AILevelsManager}
         */
        this.levelsManager = null;

        /**
         * استراتژی فعلی
         * @type {string} 'aggressive' | 'defensive' | 'balanced' | 'adaptive'
         */
        this.currentStrategy = 'balanced';

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
         * آمار استراتژی
         * @type {Object}
         */
        this.stats = {
            totalDecisions: 0,
            aggressivePlays: 0,
            defensivePlays: 0,
            balancedPlays: 0,
            successfulBluffs: 0,
            failedBluffs: 0,
            trumpSaves: 0,
            trumpPlays: 0
        };

        /**
         * حافظه استراتژی (برای یادگیری)
         * @type {Array}
         */
        this.strategyMemory = [];

        /**
         * حداکثر اندازه حافظه
         * @type {number}
         */
        this.maxMemorySize = 100;

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

        if (typeof aiLevelsManager !== 'undefined') {
            this.levelsManager = aiLevelsManager;
        }

        if (this.debug) {
            console.log('🧠 AIStrategyEngine initialized');
            console.log('  Current Strategy:', this.currentStrategy);
        }
    }

    // ============================================================
    // بخش : استراتژی‌های اصلی
    // ============================================================

    /**
     * استراتژی تهاجمی - بازی کارت‌های بالا برای بردن دست
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    aggressiveStrategy(hand, gameState) {
        this.stats.aggressivePlays++;

        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        // بازی بالاترین کارت معتبر
        const sorted = this.cardEngine ?
            this.cardEngine.sortByValue(validCards) :
            validCards.sort((a, b) => b.value - a.value);

        const selectedCard = sorted[0];

        this._recordDecision('aggressive', selectedCard, gameState);

        return selectedCard;
    }

    /**
     * استراتژی دفاعی - بازی کارت‌های پایین برای حفظ کارت‌های بالا
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    defensiveStrategy(hand, gameState) {
        this.stats.defensivePlays++;

        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        // بازی پایین‌ترین کارت معتبر
        const sorted = this.cardEngine ?
            this.cardEngine.sortByValue(validCards) :
            validCards.sort((a, b) => a.value - b.value);

        const selectedCard = sorted[0];

        this._recordDecision('defensive', selectedCard, gameState);

        return selectedCard;
    }

    /**
     * استراتژی متعادل - ترکیب حمله و دفاع
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    balancedStrategy(hand, gameState) {
        this.stats.balancedPlays++;

        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        // تحلیل وضعیت
        const analysis = this._analyzeGameState(gameState);

        let selectedCard;

        if (analysis.shouldWin) {
            // باید این دست را ببریم - بازی کارت بالا
            const highCards = validCards.filter(c => c.value >= 10);
            if (highCards.length > 0) {
                const sorted = this.cardEngine ?
                    this.cardEngine.sortByValue(highCards) :
                    highCards.sort((a, b) => b.value - a.value);
                selectedCard = sorted[0];
            } else {
                const sorted = this.cardEngine ?
                    this.cardEngine.sortByValue(validCards) :
                    validCards.sort((a, b) => b.value - a.value);
                selectedCard = sorted[0];
            }
        } else {
            // نیازی به بردن نیست - بازی کارت پایین
            const sorted = this.cardEngine ?
                this.cardEngine.sortByValue(validCards) :
                validCards.sort((a, b) => a.value - b.value);
            selectedCard = sorted[0];
        }

        this._recordDecision('balanced', selectedCard, gameState);

        return selectedCard;
    }

    /**
     * استراتژی تطبیقی - تغییر استراتژی بر اساس وضعیت
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    adaptiveStrategy(hand, gameState) {
        const analysis = this._analyzeGameState(gameState);

        // انتخاب استراتژی بر اساس تحلیل
        if (analysis.winProbability > 0.7) {
            return this.aggressiveStrategy(hand, gameState);
        } else if (analysis.winProbability < 0.3) {
            return this.defensiveStrategy(hand, gameState);
        } else {
            return this.balancedStrategy(hand, gameState);
        }
    }

    // ============================================================
    // بخش ۲: استراتژی انتخاب حکم
    // ============================================================

    /**
     * انتخاب حکم بهینه
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {string} خال انتخاب شده
     */
    selectTrumpStrategy(hand, gameState) {
        if (!hand || hand.length === 0) {
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

        const suitHighCards = {
            spades: 0,
            hearts: 0,
            diamonds: 0,
            clubs: 0
        };

        hand.forEach(card => {
            suitCounts[card.suit]++;
            suitValues[card.suit] += card.value;

            if (card.rank === 'A' || card.rank === 'K' || card.rank === 'Q') {
                suitHighCards[card.suit]++;
            }
        });

        // امتیازدهی به هر خال
        const suitScores = {};
        Object.keys(suitCounts).forEach(suit => {
            suitScores[suit] = (suitCounts[suit] * 10) +
                              (suitValues[suit] * 0.5) +
                              (suitHighCards[suit] * 20);
        });

        // انتخاب خال با بالاترین امتیاز
        let bestSuit = null;
        let bestScore = -1;

        Object.keys(suitScores).forEach(suit => {
            if (suitScores[suit] > bestScore) {
                bestScore = suitScores[suit];
                bestSuit = suit;
            }
        });

        this._emit('trump-selected', {
            suit: bestSuit,
            score: bestScore,
            hand: hand
        });

        return bestSuit;
    }

    // ============================================================
    // بخش ۳: استراتژی بازی کارت
    // ============================================================

    /**
     * استراتژی بازی کارت وقتی شروع‌کننده هستیم
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    leadingCardStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        const analysis = this._analyzeGameState(gameState);

        // اگر تیم ما عقب است، بازی تهاجمی
        if (analysis.teamScore < analysis.opponentScore) {
            return this._playHighCard(validCards, gameState);
        }

        // اگر تیم ما جلو است، بازی محافظه‌کارانه
        if (analysis.teamScore > analysis.opponentScore) {
            return this._playLowCard(validCards, gameState);
        }

        // بازی متعادل
        return this._playMediumCard(validCards, gameState);
    }

    /**
     * استراتژی بازی کارت وقتی باید Follow Suit کنیم
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    followingCardStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        const currentTrick = gameState.currentTrick || [];
        const leadSuit = gameState.leadSuit;

        // پیدا کردن بالاترین کارت فعلی در دست
        let highestCurrentCard = null;
        let highestValue = -1;

        currentTrick.forEach(played => {
            const value = this.cardEngine ?
                this.cardEngine.getCardValue(played.card) :
                played.card.value;

            if (value > highestValue) {
                highestValue = value;
                highestCurrentCard = played;
            }
        });

        // آیا می‌توانیم این دست را ببریم؟
        const winningCards = validCards.filter(card => {
            const cardValue = this.cardEngine ?
                this.cardEngine.getCardValue(card) :
                card.value;
            return cardValue > highestValue;
        });

        if (winningCards.length > 0) {
            // می‌توانیم ببریم - آیا باید ببریم؟
            const analysis = this._analyzeGameState(gameState);

            if (analysis.shouldWin) {
                // بازی کوچکترین کارت برنده (صرفه‌جویی)
                const sorted = this.cardEngine ?
                    this.cardEngine.sortByValue(winningCards) :
                    winningCards.sort((a, b) => a.value - b.value);
                return sorted[0];
            }
        }

        // نمی‌توانیم ببریم یا نباید ببریم - بازی کارت پایین
        return this._playLowCard(validCards, gameState);
    }

    /**
     * بازی کارت بالا
     * @param {Array} cards - کارت‌ها
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _playHighCard(cards, gameState) {
        const sorted = this.cardEngine ?
            this.cardEngine.sortByValue(cards) :
            cards.sort((a, b) => b.value - a.value);
        return sorted[0];
    }

    /**
     * بازی کارت پایین
     * @param {Array} cards - کارت‌ها
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _playLowCard(cards, gameState) {
        const sorted = this.cardEngine ?
            this.cardEngine.sortByValue(cards) :
            cards.sort((a, b) => a.value - b.value);
        return sorted[0];
    }

    /**
     * بازی کارت متوسط
     * @param {Array} cards - کارت‌ها
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _playMediumCard(cards, gameState) {
        const sorted = this.cardEngine ?
            this.cardEngine.sortByValue(cards) :
            cards.sort((a, b) => a.value - b.value);
        return sorted[Math.floor(sorted.length / 2)];
    }

    // ============================================================
    // بخش ۴: استراتژی مدیریت Trump
    // ============================================================

    /**
     * آیا باید از Trump استفاده کنیم
     * @param {Object} card - کارت
     * @param {Object} gameState - وضعیت بازی
     * @returns {boolean}
     */
    shouldPlayTrump(card, gameState) {
        if (!gameState.trump) return false;
        if (card.suit !== gameState.trump) return false;

        const analysis = this._analyzeGameState(gameState);

        // اگر دست مهم است و Trump داریم
        if (analysis.isImportantTrick && card.value >= 10) {
            return true;
        }

        // اگر هم‌تیمی در حال بردن است و ما Trump داریم
        if (analysis.partnerIsWinning && card.value < 10) {
            return false; // ذخیره Trump
        }

        // اگر حریف در حال بردن است و ما Trump داریم
        if (analysis.opponentIsWinning) {
            return card.value >= 8; // فقط Trump های قوی
        }

        return false;
    }

    /**
     * استراتژی ذخیره Trump
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    saveTrumpStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        // جدا کردن Trump ها
        const trumpCards = validCards.filter(c => c.suit === gameState.trump);
        const nonTrumpCards = validCards.filter(c => c.suit !== gameState.trump);

        // اگر کارت غیر Trump داریم، آن را بازی کن
        if (nonTrumpCards.length > 0) {
            return this._playLowCard(nonTrumpCards, gameState);
        }

        // مجبور به بازی Trump هستیم
        return this._playLowCard(trumpCards, gameState);
    }

    // ============================================================
    // بخش : استراتژی همکاری با هم‌تیمی
    // ============================================================

    /**
     * استراتژی سیگنال به هم‌تیمی
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    partnerSignalStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        const analysis = this._analyzeGameState(gameState);

        // سیگنال قوی: بازی آس یا شاه
        if (analysis.needStrongSignal) {
            const highCards = validCards.filter(c =>
                c.rank === 'A' || c.rank === 'K'
            );
            if (highCards.length > 0) {
                return highCards[0];
            }
        }

        // سیگنال ضعیف: بازی کارت پایین
        if (analysis.needWeakSignal) {
            return this._playLowCard(validCards, gameState);
        }

        // سیگنال عادی
        return this.balancedStrategy(hand, gameState);
    }

    /**
     * استراتژی فداکاری برای هم‌تیمی
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    sacrificeForPartnerStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        const analysis = this._analyzeGameState(gameState);

        // اگر هم‌تیمی می‌تواند دست را ببرد، کارت پایین بازی کن
        if (analysis.partnerCanWin) {
            return this._playLowCard(validCards, gameState);
        }

        // در غیر این صورت، بازی متعادل
        return this.balancedStrategy(hand, gameState);
    }

    // ============================================================
    // بخش ۶: استراتژی پایان بازی
    // ============================================================

    /**
     * استراتژی پایان بازی (3 کارت آخر)
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    endgameStrategy(hand, gameState) {
        if (hand.length > 3) {
            return this.balancedStrategy(hand, gameState);
        }

        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        const analysis = this._analyzeGameState(gameState);

        // اگر تیم ما جلو است، بازی محافظه‌کارانه
        if (analysis.teamScore > analysis.opponentScore) {
            return this._playLowCard(validCards, gameState);
        }

        // اگر تیم ما عقب است، بازی تهاجمی
        if (analysis.teamScore < analysis.opponentScore) {
            return this._playHighCard(validCards, gameState);
        }

        // اگر مساوی است، بازی کارت برنده
        const winningCards = validCards.filter(card => {
            const currentTrick = gameState.currentTrick || [];
            const highestValue = Math.max(...currentTrick.map(p =>
                this.cardEngine ? this.cardEngine.getCardValue(p.card) : p.card.value
            ));
            const cardValue = this.cardEngine ?
                this.cardEngine.getCardValue(card) :
                card.value;
            return cardValue > highestValue;
        });

        if (winningCards.length > 0) {
            return this._playLowCard(winningCards, gameState);
        }

        return this._playHighCard(validCards, gameState);
    }

    // ============================================================
    // بخش ۷: استراتژی Bluff
    // ============================================================

    /**
     * استراتژی Bluff (فریب)
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} کارت انتخاب شده
     */
    bluffStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        const analysis = this._analyzeGameState(gameState);

        // Bluff: بازی کارت بالا وقتی ضعیف هستیم
        if (analysis.isWeakPosition) {
            const highCards = validCards.filter(c => c.value >= 10);
            if (highCards.length > 0) {
                this.stats.successfulBluffs++;
                return highCards[0];
            }
        }

        // Bluff معکوس: بازی کارت پایین وقتی قوی هستیم
        if (analysis.isStrongPosition) {
            const lowCards = validCards.filter(c => c.value <= 5);
            if (lowCards.length > 0) {
                return lowCards[0];
            }
        }

        return this.balancedStrategy(hand, gameState);
    }

    /**
     * بررسی موفقیت Bluff
     * @param {Object} bluffResult - نتیجه Bluff
     * @returns {void}
     */
    recordBluffResult(bluffResult) {
        if (bluffResult.success) {
            this.stats.successfulBluffs++;
        } else {
            this.stats.failedBluffs++;
        }
    }

    // ============================================================
    // بخش ۸: محاسبه احتمال و ریسک
    // ============================================================

    /**
     * محاسبه احتمال برد دست
     * @param {Object} card - کارت
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {number} احتمال بین 0 و 1
     */
    calculateWinProbability(card, hand, gameState) {
        const currentTrick = gameState.currentTrick || [];
        const trump = gameState.trump;

        if (currentTrick.length === 0) {
            return 0.5; // بدون اطلاعات
        }

        const cardValue = this.cardEngine ?
            this.cardEngine.getCardValue(card) :
            card.value;

        const highestCurrentValue = Math.max(...currentTrick.map(p =>
            this.cardEngine ? this.cardEngine.getCardValue(p.card) : p.card.value
        ));

        // اگر کارت ما بالاتر است
        if (cardValue > highestCurrentValue) {
            // محاسبه احتمال اینکه بازیکنان بعدی کارت بالاتر داشته باشند
            const remainingPlayers = 4 - currentTrick.length - 1;
            const unknownCards = 52 - hand.length - currentTrick.length;
            const higherCards = this._countHigherCards(card, trump, unknownCards);

            const probability = Math.pow(1 - (higherCards / unknownCards), remainingPlayers);
            return Math.max(0, Math.min(1, probability));
        }

        return 0;
    }

    /**
     * شمارش کارت‌های بالاتر
     * @param {Object} card - کارت
     * @param {string} trump - حکم
     * @param {number} unknownCards - کارت‌های ناشناخته
     * @returns {number}
     * @private
     */
    _countHigherCards(card, trump, unknownCards) {
        const cardValue = this.cardEngine ?
            this.cardEngine.getCardValue(card) :
            card.value;

        // تخمین ساده
        const totalCards = 52;
        const averageHigher = (totalCards - cardValue) / totalCards;
        return Math.round(averageHigher * unknownCards);
    }

    /**
     * محاسبه ریسک بازی یک کارت
     * @param {Object} card - کارت
     * @param {Object} gameState - وضعیت بازی
     * @returns {number} ریسک بین 0 و 1
     */
    calculateRisk(card, gameState) {
        const isTrump = card.suit === gameState.trump;
        const isHighCard = card.value >= 10;
        const isLastTrick = gameState.tricksRemaining <= 1;

        let risk = 0;

        // ریسک بازی Trump
        if (isTrump) {
            risk += 0.3;
        }

        // ریسک بازی کارت بالا
        if (isHighCard) {
            risk += 0.2;
        }

        // ریسک در دست آخر
        if (isLastTrick) {
            risk += 0.2;
        }

        return Math.min(1, risk);
    }

    // ============================================================
    // بخش ۹: تحلیل وضعیت بازی
    // ============================================================

    /**
     * تحلیل کامل وضعیت بازی
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object} تحلیل
     */
    _analyzeGameState(gameState) {
        const teamScore = gameState.scores?.team1 || 0;
        const opponentScore = gameState.scores?.team2 || 0;
        const tricksRemaining = gameState.tricksRemaining || 26;
        const currentTrick = gameState.currentTrick || [];

        const isImportantTrick = tricksRemaining <= 5 ||
                                Math.abs(teamScore - opponentScore) <= 2;

        const partnerIsWinning = currentTrick.length > 0 &&
            this._isPartnerLeading(currentTrick, gameState);

        const opponentIsWinning = currentTrick.length > 0 &&
            this._isOpponentLeading(currentTrick, gameState);

        const winProbability = this._calculateOverallWinProbability(gameState);

        return {
            teamScore,
            opponentScore,
            tricksRemaining,
            isImportantTrick,
            partnerIsWinning,
            opponentIsWinning,
            winProbability,
            shouldWin: teamScore < opponentScore || isImportantTrick,
            isWeakPosition: teamScore < opponentScore - 3,
            isStrongPosition: teamScore > opponentScore + 3,
            needStrongSignal: partnerIsWinning && isImportantTrick,
            needWeakSignal: !partnerIsWinning && !isImportantTrick,
            partnerCanWin: partnerIsWinning && currentTrick.length < 4
        };
    }

    /**
     * آیا هم‌تیمی در حال بردن است
     * @param {Array} currentTrick - دست فعلی
     * @param {Object} gameState - وضعیت بازی
     * @returns {boolean}
     * @private
     */
    _isPartnerLeading(currentTrick, gameState) {
        if (currentTrick.length === 0) return false;

        const myTeam = gameState.currentPlayerTeam;
        const lastPlayed = currentTrick[currentTrick.length - 1];

        return lastPlayed.playerTeam === myTeam;
    }

    /**
     * آیا حریف در حال بردن است
     * @param {Array} currentTrick - دست فعلی
     * @param {Object} gameState - وضعیت بازی
     * @returns {boolean}
     * @private
     */
    _isOpponentLeading(currentTrick, gameState) {
        if (currentTrick.length === 0) return false;

        const myTeam = gameState.currentPlayerTeam;
        const lastPlayed = currentTrick[currentTrick.length - 1];

        return lastPlayed.playerTeam !== myTeam;
    }

    /**
     * محاسبه احتمال برد کلی
     * @param {Object} gameState - وضعیت بازی
     * @returns {number}
     * @private
     */
    _calculateOverallWinProbability(gameState) {
        const teamScore = gameState.scores?.team1 || 0;
        const opponentScore = gameState.scores?.team2 || 0;
        const tricksRemaining = gameState.tricksRemaining || 26;

        if (tricksRemaining === 0) {
            return teamScore > opponentScore ? 1 : 0;
        }

        const scoreDiff = teamScore - opponentScore;
        const baseProbability = 0.5 + (scoreDiff / 52);

        return Math.max(0, Math.min(1, baseProbability));
    }

    // ============================================================
    // بخش ۱۰: انتخاب استراتژی
    // ============================================================

    /**
     * انتخاب بهترین استراتژی بر اساس وضعیت
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @param {string} level - سطح AI
     * @returns {Object} کارت انتخاب شده
     */
    selectBestStrategy(hand, gameState, level = 'normal') {
        this.stats.totalDecisions++;

        const levelInfo = this.levelsManager ?
            this.levelsManager.getLevelInfo(level) :
            null;

        const strategies = levelInfo?.strategies || {};

        // بر اساس استراتژی‌های فعال
        if (strategies.optimalPlay) {
            return this._optimalPlayStrategy(hand, gameState);
        }

        if (strategies.psychologicalPlay) {
            return this.bluffStrategy(hand, gameState);
        }

        if (strategies.adaptToOpponents) {
            return this.adaptiveStrategy(hand, gameState);
        }

        // بر اساس تعداد کارت‌های باقی‌مانده
        if (hand.length <= 3) {
            return this.endgameStrategy(hand, gameState);
        }

        // بر اساس وضعیت بازی
        const analysis = this._analyzeGameState(gameState);

        if (analysis.isImportantTrick) {
            return this.balancedStrategy(hand, gameState);
        }

        return this.balancedStrategy(hand, gameState);
    }

    /**
     * استراتژی بازی بهینه
     * @param {Array} hand - دست بازیکن
     * @param {Object} gameState - وضعیت بازی
     * @returns {Object}
     * @private
     */
    _optimalPlayStrategy(hand, gameState) {
        const validCards = this._getValidCards(hand, gameState);

        if (validCards.length === 0) {
            return hand[0];
        }

        // محاسبه امتیاز برای هر کارت
        const cardScores = validCards.map(card => {
            const winProb = this.calculateWinProbability(card, hand, gameState);
            const risk = this.calculateRisk(card, gameState);
            const value = this.cardEngine ?
                this.cardEngine.getCardValue(card) :
                card.value;

            return {
                card,
                score: (winProb * 0.6) + ((1 - risk) * 0.3) + (value / 100 * 0.1)
            };
        });

        // مرتب‌سازی بر اساس امتیاز
        cardScores.sort((a, b) => b.score - a.score);

        return cardScores[0].card;
    }

    // ============================================================
    // بخش ۱۱: توابع کمکی
    // ============================================================

    /**
     * دریافت کارت‌های معتبر
     * @param {Array} hand - دست
     * @param {Object} gameState - وضعیت بازی
     * @returns {Array}
     * @private
     */
    _getValidCards(hand, gameState) {
        if (!this.cardEngine) return hand;

        const leadSuit = gameState.leadSuit;
        const trump = gameState.trump;

        return hand.filter(card => {
            const validation = this.cardEngine.validatePlay(card, hand);
            return validation.valid;
        });
    }

    /**
     * ثبت تصمیم در حافظه
     * @param {string} strategy - استراتژی
     * @param {Object} card - کارت
     * @param {Object} gameState - وضعیت بازی
     * @private
     */
    _recordDecision(strategy, card, gameState) {
        this.strategyMemory.push({
            strategy,
            card,
            gameState: {
                trump: gameState.trump,
                leadSuit: gameState.leadSuit,
                teamScore: gameState.scores?.team1,
                opponentScore: gameState.scores?.team2
            },
            timestamp: Date.now()
        });

        if (this.strategyMemory.length > this.maxMemorySize) {
            this.strategyMemory.shift();
        }
    }

    /**
     * دریافت آمار استراتژی
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            currentStrategy: this.currentStrategy,
            memorySize: this.strategyMemory.length
        };
    }

    /**
     * ریست آمار
     */
    resetStats() {
        this.stats = {
            totalDecisions: 0,
            aggressivePlays: 0,
            defensivePlays: 0,
            balancedPlays: 0,
            successfulBluffs: 0,
            failedBluffs: 0,
            trumpSaves: 0,
            trumpPlays: 0
        };
        this.strategyMemory = [];
    }

    // ============================================================
    // بخش ۲: Event System
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
                    console.error(`❌ Strategy event listener error:`, error);
                }
            });
        }

        eventBus.emit(`ai-strategy:${event}`, data);
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

        console.log('🧠 AIStrategyEngine Status:');
        console.log('  Current Strategy:', stats.currentStrategy);
        console.log('  Total Decisions:', stats.totalDecisions);
        console.log('  Aggressive Plays:', stats.aggressivePlays);
        console.log('  Defensive Plays:', stats.defensivePlays);
        console.log('  Balanced Plays:', stats.balancedPlays);
        console.log('  Successful Bluffs:', stats.successfulBluffs);
        console.log('  Failed Bluffs:', stats.failedBluffs);
        console.log('  Memory Size:', stats.memorySize);
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const aiStrategyEngine = new AIStrategyEngine();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIStrategyEngine, aiStrategyEngine };
} else {
    window.AIStrategyEngine = AIStrategyEngine;
    window.aiStrategyEngine = aiStrategyEngine;
}

console.log('✅ AIStrategyEngine loaded');
