/**
 * ============================================================
 * HOKM MASTER - Card Engine
 * موتور مدیریت کارت‌های بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل کارت‌های بازی حکم است. شامل
 * ساخت Deck استاندارد 52 تایی، Shuffle، Deal، Sort، مقایسه
 * کارت‌ها، اعتبارسنجی و تمام عملیات مربوط به کارت.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * 
 * ============================================================
 */

class CardEngine {

    constructor() {
        /**
         * Deck اصلی کارت‌ها
         * @type {Array<Object>}
         */
        this.deck = [];

        /**
         * کارت‌های بازی‌شده در دست فعلی
         * @type {Array<Object>}
         */
        this.playedCards = [];

        /**
         * کارت‌های هر بازیکن
         * @type {Object} { player0: [], player1: [], ... }
         */
        this.playerHands = {};

        /**
         * خال حکم فعلی
         * @type {string|null}
         */
        this.trump = null;

        /**
         * خال شروع دست (Lead Suit)
         * @type {string|null}
         */
        this.leadSuit = null;

        /**
         * شماره دست فعلی
         * @type {number}
         */
        this.currentTrick = 0;

        /**
         * تاریخچه تمام دست‌ها
         * @type {Array}
         */
        this.trickHistory = [];

        /**
         * آیا debug mode فعال است
         * @type {boolean}
         */
        this.debug = CONFIG.DEBUG.ENABLED;

        /**
         * شنوندگان رویداد
         * @type {Map}
         */
        this.listeners = new Map();

        /**
         * آمار کارت
         * @type {Object}
         */
        this.stats = {
            totalDeals: 0,
            totalShuffles: 0,
            totalTricks: 0,
            totalTrumpChanges: 0
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        if (this.debug) {
            console.log('🃏 CardEngine initialized');
        }
    }

    // ============================================================
    // بخش ۱: تعریف کارت‌ها
    // ============================================================

    /**
     * ساخت کارت تکی
     * @param {string} suit - خال (spades, hearts, diamonds, clubs)
     * @param {string} rank - رتبه (2-10, J, Q, K, A)
     * @returns {Object} کارت
     */
    createCard(suit, rank) {
        if (!this._isValidSuit(suit)) {
            throw new Error(`Invalid suit: ${suit}`);
        }

        if (!this._isValidRank(rank)) {
            throw new Error(`Invalid rank: ${rank}`);
        }

        return {
            id: `${suit}_${rank}`,
            suit: suit,
            rank: rank,
            symbol: CONFIG.GAME.CARDS.SUIT_SYMBOLS[suit],
            color: CONFIG.GAME.CARDS.SUIT_COLORS[suit],
            value: CONFIG.GAME.CARDS.RANK_VALUES[rank],
            trumpValue: CONFIG.GAME.CARDS.TRUMP_RANK_VALUES[rank],
            isRed: suit === 'hearts' || suit === 'diamonds',
            isBlack: suit === 'spades' || suit === 'clubs',
            name: this._getCardName(suit, rank),
            nameFa: this._getCardNameFa(suit, rank)
        };
    }

    /**
     * ساخت Deck کامل 52 تایی
     * @returns {Array<Object>} Deck کامل
     */
    createDeck() {
        const deck = [];
        const suits = Object.values(CONFIG.GAME.CARDS.SUITS);
        const ranks = CONFIG.GAME.CARDS.RANKS;

        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push(this.createCard(suit, rank));
            }
        }

        if (this.debug) {
            console.log(`🃏 Deck created: ${deck.length} cards`);
        }

        return deck;
    }

    /**
     * بررسی اعتبار خال
     * @param {string} suit - خال
     * @returns {boolean}
     * @private
     */
    _isValidSuit(suit) {
        return Object.values(CONFIG.GAME.CARDS.SUITS).includes(suit);
    }

    /**
     * بررسی اعتبار رتبه
     * @param {string} rank - رتبه
     * @returns {boolean}
     * @private
     */
    _isValidRank(rank) {
        return CONFIG.GAME.CARDS.RANKS.includes(rank);
    }

    /**
     * دریافت نام انگلیسی کارت
     * @param {string} suit - خال
     * @param {string} rank - رتبه
     * @returns {string}
     * @private
     */
    _getCardName(suit, rank) {
        return `${rank} of ${suit}`;
    }

    /**
     * دریافت نام فارسی کارت
     * @param {string} suit - خال
     * @param {string} rank - رتبه
     * @returns {string}
     * @private
     */
    _getCardNameFa(suit, rank) {
        const suitNames = {
            spades: 'پیک',
            hearts: 'دل',
            diamonds: 'خشت',
            clubs: 'گشنیز'
        };

        const rankNames = {
            '2': 'دو',
            '3': 'سه',
            '4': 'چهار',
            '5': 'پنج',
            '6': 'شش',
            '7': 'هفت',
            '8': 'هشت',
            '9': 'نه',
            '10': 'ده',
            'J': 'سرباز',
            'Q': 'بی‌بی',
            'K': 'شاه',
            'A': 'آس'
        };

        return `${rankNames[rank]} ${suitNames[suit]}`;
    }

    // ============================================================
    // بخش ۲: Shuffle و Deal
    // ============================================================

    /**
     * Shuffle کردن Deck با الگوریتم Fisher-Yates
     * @param {Array} deck - Deck ورودی
     * @returns {Array} Deck شافل شده
     */
    shuffle(deck = null) {
        const targetDeck = deck || this.deck;

        if (!targetDeck || targetDeck.length === 0) {
            throw new Error('Deck is empty');
        }

        const shuffled = [...targetDeck];
        const algorithm = CONFIG.GAME.CARDS.SHUFFLE_ALGORITHM;

        if (algorithm === 'fisher-yates') {
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
        }

        if (deck) {
            return shuffled;
        }

        this.deck = shuffled;
        this.stats.totalShuffles++;

        this._emit('shuffled', { deck: shuffled });

        if (this.debug) {
            console.log(` Deck shuffled (${shuffled.length} cards)`);
        }

        return shuffled;
    }

    /**
     * برش Deck (Cut)
     * @param {number} position - موقعیت برش
     * @returns {Array} Deck برش خورده
     */
    cut(position = null) {
        if (!this.deck || this.deck.length === 0) {
            throw new Error('Deck is empty');
        }

        const cutPos = position || Math.floor(this.deck.length / 2);
        const top = this.deck.slice(0, cutPos);
        const bottom = this.deck.slice(cutPos);

        this.deck = [...bottom, ...top];

        this._emit('cut', { position: cutPos });

        return this.deck;
    }

    /**
     * Deal کردن کارت به بازیکنان
     * @param {number} playerCount - تعداد بازیکنان
     * @param {number} cardsPerPlayer - کارت برای هر بازیکن
     * @returns {Object} دست بازیکنان
     */
    deal(playerCount = 4, cardsPerPlayer = null) {
        if (!this.deck || this.deck.length === 0) {
            this.deck = this.createDeck();
            this.shuffle();
        }

        const perPlayer = cardsPerPlayer || CONFIG.GAME.CARDS.PER_PLAYER;
        const totalNeeded = playerCount * perPlayer;

        if (this.deck.length < totalNeeded) {
            throw new Error(`Not enough cards in deck. Need ${totalNeeded}, have ${this.deck.length}`);
        }

        // پاک کردن دست‌های قبلی
        this.playerHands = {};
        for (let i = 0; i < playerCount; i++) {
            this.playerHands[`player${i}`] = [];
        }

        // توزیع کارت‌ها
        let cardIndex = 0;
        for (let round = 0; round < perPlayer; round++) {
            for (let player = 0; player < playerCount; player++) {
                const card = this.deck[cardIndex++];
                this.playerHands[`player${player}`].push(card);
            }
        }

        // حذف کارت‌های deal شده از deck
        this.deck = this.deck.slice(cardIndex);

        this.stats.totalDeals++;

        this._emit('dealt', {
            playerHands: this.playerHands,
            remainingDeck: this.deck.length
        });

        if (this.debug) {
            console.log(`🎴 Cards dealt: ${playerCount} players × ${perPlayer} cards`);
        }

        return this.playerHands;
    }

    /**
     * دریافت کارت از Deck
     * @param {number} count - تعداد کارت
     * @returns {Array} کارت‌های دریافت شده
     */
    draw(count = 1) {
        if (this.deck.length < count) {
            throw new Error(`Not enough cards. Need ${count}, have ${this.deck.length}`);
        }

        const drawn = this.deck.splice(0, count);
        this._emit('drawn', { cards: drawn });

        return drawn;
    }

    // ============================================================
    // بخش : مرتب‌سازی
    // ============================================================

    /**
     * مرتب‌سازی دست بازیکن
     * @param {Array} hand - دست بازیکن
     * @param {string} sortBy - معیار مرتب‌سازی (suit, rank, value)
     * @param {string} order - ترتیب (asc, desc)
     * @returns {Array} دست مرتب شده
     */
    sortHand(hand, sortBy = 'suit', order = 'asc') {
        if (!Array.isArray(hand)) {
            throw new Error('Hand must be an array');
        }

        const sorted = [...hand];

        sorted.sort((a, b) => {
            let valA, valB;

            switch (sortBy) {
                case 'suit':
                    valA = this._suitOrder(a.suit);
                    valB = this._suitOrder(b.suit);
                    if (valA === valB) {
                        valA = a.value;
                        valB = b.value;
                    }
                    break;

                case 'rank':
                    valA = a.value;
                    valB = b.value;
                    break;

                case 'value':
                    valA = this.getCardValue(a);
                    valB = this.getCardValue(b);
                    break;

                default:
                    valA = a.value;
                    valB = b.value;
            }

            return order === 'asc' ? valA - valB : valB - valA;
        });

        return sorted;
    }

    /**
     * مرتب‌سازی بر اساس خال و سپس رتبه
     * @param {Array} hand - دست
     * @returns {Array}
     */
    sortBySuitThenRank(hand) {
        return this.sortHand(hand, 'suit', 'asc');
    }

    /**
     * مرتب‌سازی بر اساس رتبه
     * @param {Array} hand - دست
     * @returns {Array}
     */
    sortByRank(hand) {
        return this.sortHand(hand, 'rank', 'asc');
    }

    /**
     * مرتب‌سازی بر اساس ارزش (با در نظر گرفتن حکم)
     * @param {Array} hand - دست
     * @returns {Array}
     */
    sortByValue(hand) {
        return this.sortHand(hand, 'value', 'asc');
    }

    /**
     * ترتیب خال‌ها
     * @param {string} suit - خال
     * @returns {number}
     * @private
     */
    _suitOrder(suit) {
        const order = {
            spades: 0,
            hearts: 1,
            diamonds: 2,
            clubs: 3
        };
        return order[suit] || 0;
    }

    // ============================================================
    // بخش ۴: ارزش کارت
    // ============================================================

    /**
     * دریافت ارزش کارت (با در نظر گرفتن حکم)
     * @param {Object} card - کارت
     * @returns {number} ارزش کارت
     */
    getCardValue(card) {
        if (!card) return 0;

        if (this.trump && card.suit === this.trump) {
            return card.trumpValue;
        }

        return card.value;
    }

    /**
     * مقایسه دو کارت
     * @param {Object} card1 - کارت اول
     * @param {Object} card2 - کارت دوم
     * @returns {number} نتیجه مقایسه
     */
    compareCards(card1, card2) {
        const value1 = this.getCardValue(card1);
        const value2 = this.getCardValue(card2);

        return value1 - value2;
    }

    /**
     * آیا کارت از کارت دیگر بزرگتر است
     * @param {Object} card1 - کارت اول
     * @param {Object} card2 - کارت دوم
     * @returns {boolean}
     */
    isHigher(card1, card2) {
        return this.getCardValue(card1) > this.getCardValue(card2);
    }

    /**
     * آیا کارت از کارت دیگر کوچکتر است
     * @param {Object} card1 - کارت اول
     * @param {Object} card2 - کارت دوم
     * @returns {boolean}
     */
    isLower(card1, card2) {
        return this.getCardValue(card1) < this.getCardValue(card2);
    }

    /**
     * آیا کارت حکم است
     * @param {Object} card - کارت
     * @returns {boolean}
     */
    isTrump(card) {
        return this.trump !== null && card.suit === this.trump;
    }

    // ============================================================
    // بخش ۵: اعتبارسنجی بازی
    // ============================================================

    /**
     * آیا بازی کردن کارت مجاز است
     * @param {Object} card - کارت
     * @param {Array} hand - دست بازیکن
     * @returns {Object} نتیجه اعتبارسنجی
     */
    validatePlay(card, hand) {
        // بررسی وجود کارت در دست
        if (!this._isCardInHand(card, hand)) {
            return {
                valid: false,
                reason: 'CARD_NOT_IN_HAND',
                message: 'این کارت در دست شما نیست'
            };
        }

        // اگر اولین کارت دست است، هر کارتی مجاز است
        if (!this.leadSuit) {
            return { valid: true };
        }

        // بررسی Follow Suit
        if (card.suit !== this.leadSuit) {
            const hasLeadSuit = hand.some(c => c.suit === this.leadSuit);
            
            if (hasLeadSuit) {
                return {
                    valid: false,
                    reason: 'MUST_FOLLOW_SUIT',
                    message: `باید خال ${this._getSuitNameFa(this.leadSuit)} بازی کنید`
                };
            }
        }

        return { valid: true };
    }

    /**
     * بررسی وجود کارت در دست
     * @param {Object} card - کارت
     * @param {Array} hand - دست
     * @returns {boolean}
     * @private
     */
    _isCardInHand(card, hand) {
        return hand.some(c => c.id === card.id);
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
    // بخش ۶: مدیریت دست (Trick)
    // ============================================================

    /**
     * شروع دست جدید
     * @param {string} leadSuit - خال شروع
     * @returns {Object} اطلاعات دست
     */
    startTrick(leadSuit = null) {
        this.playedCards = [];
        this.leadSuit = leadSuit;
        this.currentTrick++;

        this._emit('trick-started', {
            trickNumber: this.currentTrick,
            leadSuit: leadSuit
        });

        return {
            trickNumber: this.currentTrick,
            leadSuit: leadSuit
        };
    }

    /**
     * بازی کردن کارت در دست
     * @param {Object} card - کارت
     * @param {number} playerIndex - ایندکس بازیکن
     * @returns {Object} نتیجه
     */
    playCard(card, playerIndex) {
        const validation = this.validatePlay(card, this.playerHands[`player${playerIndex}`] || []);

        if (!validation.valid) {
            return validation;
        }

        // حذف کارت از دست بازیکن
        const hand = this.playerHands[`player${playerIndex}`];
        const cardIndex = hand.findIndex(c => c.id === card.id);
        
        if (cardIndex === -1) {
            return {
                valid: false,
                reason: 'CARD_NOT_FOUND',
                message: 'کارت یافت نشد'
            };
        }

        hand.splice(cardIndex, 1);

        // اضافه کردن به کارت‌های بازی‌شده
        this.playedCards.push({
            card: card,
            playerIndex: playerIndex,
            playedAt: Date.now()
        });

        // اگر اولین کارت است، خال شروع را تنظیم کن
        if (!this.leadSuit) {
            this.leadSuit = card.suit;
        }

        this._emit('card-played', {
            card: card,
            playerIndex: playerIndex,
            trickNumber: this.currentTrick
        });

        if (this.debug) {
            console.log(`🎴 Player ${playerIndex} played: ${card.nameFa}`);
        }

        return {
            valid: true,
            card: card,
            playerIndex: playerIndex
        };
    }

    /**
     * تعیین برنده دست
     * @returns {Object} نتیجه
     */
    determineTrickWinner() {
        if (this.playedCards.length === 0) {
            return {
                winner: null,
                card: null
            };
        }

        let winnerIndex = 0;
        let highestValue = -1;

        for (let i = 0; i < this.playedCards.length; i++) {
            const played = this.playedCards[i];
            const card = played.card;
            const value = this.getCardValue(card);

            const currentWinner = this.playedCards[winnerIndex].card;
            const currentWinnerValue = this.getCardValue(currentWinner);

            if (value > currentWinnerValue) {
                winnerIndex = i;
                highestValue = value;
            }
        }

        const winner = this.playedCards[winnerIndex];

        // ذخیره در تاریخچه
        this.trickHistory.push({
            trickNumber: this.currentTrick,
            cards: [...this.playedCards],
            winner: winner,
            leadSuit: this.leadSuit,
            completedAt: Date.now()
        });

        this.stats.totalTricks++;

        this._emit('trick-won', {
            winner: winner,
            trickNumber: this.currentTrick,
            cards: this.playedCards
        });

        if (this.debug) {
            console.log(`🏆 Player ${winner.playerIndex} won trick ${this.currentTrick}`);
        }

        return {
            winner: winner,
            card: winner.card,
            trickNumber: this.currentTrick
        };
    }

    /**
     * پایان دست
     * @returns {Object} نتیجه
     */
    endTrick() {
        const result = this.determineTrickWinner();

        this.playedCards = [];
        this.leadSuit = null;

        this._emit('trick-ended', result);

        return result;
    }

    // ============================================================
    // بخش : مدیریت حکم
    // ============================================================

    /**
     * تنظیم خال حکم
     * @param {string} suit - خال حکم
     * @returns {Object} نتیجه
     */
    setTrump(suit) {
        if (!this._isValidSuit(suit)) {
            return {
                success: false,
                error: 'INVALID_SUIT',
                message: 'خال نامعتبر است'
            };
        }

        const oldTrump = this.trump;
        this.trump = suit;
        this.stats.totalTrumpChanges++;

        this._emit('trump-set', {
            suit: suit,
            oldTrump: oldTrump
        });

        if (this.debug) {
            console.log(` Trump set to: ${this._getSuitNameFa(suit)}`);
        }

        return {
            success: true,
            suit: suit,
            oldTrump: oldTrump
        };
    }

    /**
     * دریافت خال حکم فعلی
     * @returns {string|null}
     */
    getTrump() {
        return this.trump;
    }

    /**
     * پاک کردن حکم
     * @returns {void}
     */
    clearTrump() {
        this.trump = null;
        this._emit('trump-cleared');
    }

    // ============================================================
    // بخش : اطلاعات و آمار
    // ============================================================

    /**
     * دریافت اطلاعات کامل کارت
     * @param {Object} card - کارت
     * @returns {Object}
     */
    getCardInfo(card) {
        if (!card) return null;

        return {
            ...card,
            isTrump: this.isTrump(card),
            currentValue: this.getCardValue(card),
            canBeat: (otherCard) => this.isHigher(card, otherCard),
            canLose: (otherCard) => this.isLower(card, otherCard)
        };
    }

    /**
     * دریافت آمار کارت‌ها
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            deckSize: this.deck.length,
            trump: this.trump,
            leadSuit: this.leadSuit,
            currentTrick: this.currentTrick,
            playedCardsCount: this.playedCards.length,
            trickHistoryLength: this.trickHistory.length
        };
    }

    /**
     * دریافت خلاصه بازی
     * @returns {Object}
     */
    getGameSummary() {
        return {
            trump: this.trump,
            currentTrick: this.currentTrick,
            totalTricks: this.stats.totalTricks,
            playerHands: Object.keys(this.playerHands).map(key => ({
                player: key,
                cardCount: this.playerHands[key].length,
                cards: this.playerHands[key]
            })),
            trickHistory: this.trickHistory
        };
    }

    // ============================================================
    // بخش ۹: Reset و Cleanup
    // ============================================================

    /**
     * ریست کامل موتور کارت
     * @returns {void}
     */
    reset() {
        this.deck = [];
        this.playedCards = [];
        this.playerHands = {};
        this.trump = null;
        this.leadSuit = null;
        this.currentTrick = 0;
        this.trickHistory = [];

        this._emit('reset');

        if (this.debug) {
            console.log('🔄 CardEngine reset');
        }
    }

    /**
     * شروع بازی جدید
     * @param {number} playerCount - تعداد بازیکنان
     * @returns {Object} دست بازیکنان
     */
    startNewGame(playerCount = 4) {
        this.reset();

        this.deck = this.createDeck();
        this.shuffle();

        const hands = this.deal(playerCount);

        this._emit('game-started', {
            playerCount: playerCount,
            hands: hands
        });

        return hands;
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
                    console.error(`❌ CardEngine event listener error:`, error);
                }
            });
        }

        // انتشار در eventBus اصلی
        eventBus.emit(`card:${event}`, data);
    }

    /**
     * پاک کردن تمام شنوندگان
     */
    clearListeners() {
        this.listeners.clear();
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();

        console.log('🃏 CardEngine Status:');
        console.log('  Deck Size:', stats.deckSize);
        console.log('  Trump:', stats.trump ? this._getSuitNameFa(stats.trump) : 'None');
        console.log('  Lead Suit:', stats.leadSuit ? this._getSuitNameFa(stats.leadSuit) : 'None');
        console.log('  Current Trick:', stats.currentTrick);
        console.log('  Total Tricks:', stats.totalTricks);
        console.log('  Total Deals:', stats.totalDeals);
        console.log('  Total Shuffles:', stats.totalShuffles);
        console.log('  Player Hands:', Object.keys(this.playerHands).length);
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const cardEngine = new CardEngine();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CardEngine, cardEngine };
} else {
    window.CardEngine = CardEngine;
    window.cardEngine = cardEngine;
}

console.log('✅ CardEngine loaded');
