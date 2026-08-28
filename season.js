/**
 * ============================================================
 * HOKM MASTER - Season Manager
 * مدیریت کامل سیستم فصل‌ها در لیگ
 * ============================================================
 * 
 * این فایل مسئول مدیریت چرخه حیات کامل فصل‌ها است. شامل
 * ایجاد فصل جدید، مدیریت زمان فصل، محاسبه رتبه‌بندی پایان
 * فصل، توزیع پاداش‌ها، reset امن، آرشیو فصل‌ها، و آمار
 * تاریخی فصل‌ها.
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
 * - leagueManager (از فایل league.js)
 * - scoringEngine (از فایل scoring.js)
 * 
 * ============================================================
 */

class SeasonManager {

    constructor() {
        /**
         * فصل فعلی
         * @type {Object}
         */
        this.currentSeason = null;

        /**
         * لیست تمام فصل‌ها (فعال + آرشیو)
         * @type {Array<Object>}
         */
        this.allSeasons = [];

        /**
         * آرشیو فصل‌های تکمیل شده
         * @type {Array<Object>}
         */
        this.archivedSeasons = [];

        /**
         * رتبه‌بندی نهایی فصل فعلی
         * @type {Array<Object>}
         */
        this.finalRankings = [];

        /**
         * پاداش‌های توزیع شده در فصل فعلی
         * @type {Array<Object>}
         */
        this.distributedRewards = [];

        /**
         * بازیکنان شرکت‌کننده در فصل فعلی
         * @type {Array<Object>}
         */
        this.seasonParticipants = [];

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
         * آمار فصل
         * @type {Object}
         */
        this.stats = {
            totalSeasonsCreated: 0,
            totalSeasonsCompleted: 0,
            totalParticipants: 0,
            totalRewardsDistributed: 0,
            totalCoinsAwarded: 0,
            totalGemsAwarded: 0,
            averageParticipantsPerSeason: 0,
            longestSeason: 0,
            shortestSeason: Infinity
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بارگذاری داده‌ها
        this._loadData();

        // اگر فصلی وجود ندارد، فصل اول را ایجاد کن
        if (!this.currentSeason) {
            this._createFirstSeason();
        }

        // بررسی وضعیت فصل فعلی
        this._checkSeasonStatus();

        if (this.debug) {
            console.log('📅 SeasonManager initialized');
            console.log('  Current Season:', this.currentSeason?.number || 'None');
            console.log('  Total Seasons:', this.allSeasons.length);
        }
    }

    // ============================================================
    // بخش ۱: مدیریت فصل فعلی
    // ============================================================

    /**
     * ایجاد فصل اول
     * @private
     */
    _createFirstSeason() {
        const season = this._createSeasonObject(1);
        
        this.currentSeason = season;
        this.allSeasons.push(season);
        this.stats.totalSeasonsCreated++;

        this._emit('season-created', { season });

        if (this.debug) {
            console.log('📅 First season created');
        }
    }

    /**
     * ایجاد شیء فصل
     * @param {number} number - شماره فصل
     * @returns {Object}
     * @private
     */
    _createSeasonObject(number) {
        const startDate = Date.now();
        const duration = CONFIG.LEAGUE.SEASON.DURATION_MS;
        const endDate = startDate + duration;

        return {
            number,
            name: `فصل ${Utils.toPersianNumber(number)}`,
            nameEn: `Season ${number}`,
            startDate,
            endDate,
            duration,
            status: 'active', // active, ended, archived
            participants: [],
            finalRankings: [],
            rewards: this._getDefaultSeasonRewards(),
            statistics: {
                totalGames: 0,
                totalPlayers: 0,
                averageRating: 0,
                topTier: 'bronze',
                totalKots: 0,
                totalPerfectGames: 0
            },
            milestones: [],
            createdAt: startDate,
            endedAt: null,
            archivedAt: null
        };
    }

    /**
     * دریافت پاداش‌های پیش‌فرض فصل
     * @returns {Object}
     * @private
     */
    _getDefaultSeasonRewards() {
        return {
            participation: {
                coins: 500,
                xp: 100,
                description: 'پاداش شرکت در فصل'
            },
            tiers: {
                bronze: { coins: 1000, xp: 200 },
                silver: { coins: 2500, xp: 500, frame: 2 },
                gold: { coins: 5000, xp: 1000, frame: 3, title: 1 },
                platinum: { coins: 10000, xp: 2000, gems: 100, frame: 4 },
                diamond: { coins: 25000, xp: 5000, gems: 250, frame: 5, title: 2 },
                master: { coins: 50000, xp: 10000, gems: 500, frame: 6, title: 3, badge: 1 }
            },
            ranks: {
                top1: { coins: 100000, gems: 1000, title: 'قهرمان فصل', badge: 'champion' },
                top10: { coins: 50000, gems: 500, title: 'برتر فصل' },
                top50: { coins: 20000, gems: 200 },
                top100: { coins: 10000, gems: 100 }
            }
        };
    }

    /**
     * دریافت اطلاعات فصل فعلی
     * @returns {Object}
     */
    getCurrentSeason() {
        if (!this.currentSeason) return null;

        const now = Date.now();
        const totalDuration = this.currentSeason.endDate - this.currentSeason.startDate;
        const elapsed = now - this.currentSeason.startDate;
        const remaining = this.currentSeason.endDate - now;

        return {
            ...this.currentSeason,
            progress: Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)),
            daysRemaining: Math.ceil(remaining / (1000 * 60 * 60 * 24)),
            hoursRemaining: Math.ceil(remaining / (1000 * 60 * 60)),
            minutesRemaining: Math.ceil(remaining / (1000 * 60)),
            isEnding: remaining < 86400000, // کمتر از 1 روز
            participantCount: this.currentSeason.participants.length
        };
    }

    /**
     * بررسی وضعیت فصل فعلی
     * @private
     */
    _checkSeasonStatus() {
        if (!this.currentSeason) return;

        const now = Date.now();

        if (now >= this.currentSeason.endDate && this.currentSeason.status === 'active') {
            this._endCurrentSeason();
        }
    }

    // ============================================================
    // بخش ۲: مدیریت شرکت‌کنندگان
    // ============================================================

    /**
     * ثبت‌نام بازیکن در فصل
     * @param {Object} player - اطلاعات بازیکن
     * @returns {Object} نتیجه
     */
    registerPlayer(player) {
        if (!this.currentSeason || this.currentSeason.status !== 'active') {
            return {
                success: false,
                error: 'SEASON_NOT_ACTIVE',
                message: 'فصل فعال نیست'
            };
        }

        // بررسی تکراری نبودن
        const existingPlayer = this.currentSeason.participants.find(p => p.id === player.id);
        if (existingPlayer) {
            return {
                success: false,
                error: 'ALREADY_REGISTERED',
                message: 'بازیکن قبلاً ثبت‌نام کرده است'
            };
        }

        const participant = {
            id: player.id,
            username: player.username,
            rating: player.rating || 1000,
            tier: player.tier || 'bronze',
            registeredAt: Date.now(),
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            points: 0,
            bestStreak: 0,
            currentStreak: 0
        };

        this.currentSeason.participants.push(participant);
        this.seasonParticipants.push(participant);
        this.stats.totalParticipants++;

        this._emit('player-registered', {
            season: this.currentSeason,
            player: participant
        });

        if (this.debug) {
            console.log(` Player registered: ${player.username}`);
        }

        return {
            success: true,
            participant
        };
    }

    /**
     * به‌روزرسانی آمار بازیکن در فصل
     * @param {string} playerId - شناسه بازیکن
     * @param {Object} gameResult - نتیجه بازی
     * @returns {Object} نتیجه
     */
    updatePlayerStats(playerId, gameResult) {
        const participant = this.currentSeason?.participants.find(p => p.id === playerId);

        if (!participant) {
            return {
                success: false,
                error: 'PLAYER_NOT_FOUND',
                message: 'بازیکن در فصل یافت نشد'
            };
        }

        participant.gamesPlayed++;
        this.currentSeason.statistics.totalGames++;

        if (gameResult.isWinner) {
            participant.wins++;
            participant.currentStreak++;
            if (participant.currentStreak > participant.bestStreak) {
                participant.bestStreak = participant.currentStreak;
            }
            participant.points += 10; // 10 امتیاز برای برد
        } else {
            participant.losses++;
            participant.currentStreak = 0;
            participant.points += 2; // 2 امتیاز برای باخت (شرکت)
        }

        participant.winRate = (participant.wins / participant.gamesPlayed) * 100;

        // به‌روزرسانی Rating
        if (gameResult.ratingChange) {
            participant.rating = Math.max(0, participant.rating + gameResult.ratingChange);
        }

        // به‌روزرسانی Tier
        participant.tier = this._getTierFromRating(participant.rating);

        this._emit('player-stats-updated', {
            participant,
            gameResult
        });

        return {
            success: true,
            participant
        };
    }

    /**
     * دریافت Tier از Rating
     * @param {number} rating - Rating
     * @returns {string} Tier
     * @private
     */
    _getTierFromRating(rating) {
        if (rating >= 3000) return 'master';
        if (rating >= 2500) return 'diamond';
        if (rating >= 2000) return 'platinum';
        if (rating >= 1500) return 'gold';
        if (rating >= 1000) return 'silver';
        return 'bronze';
    }

    /**
     * دریافت لیست شرکت‌کنندگان
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getParticipants(options = {}) {
        const {
            tier = null,
            limit = 100,
            offset = 0,
            sortBy = 'points'
        } = options;

        let participants = [...(this.currentSeason?.participants || [])];

        if (tier) {
            participants = participants.filter(p => p.tier === tier);
        }

        // مرتب‌سازی
        participants.sort((a, b) => {
            if (sortBy === 'points') return b.points - a.points;
            if (sortBy === 'rating') return b.rating - a.rating;
            if (sortBy === 'wins') return b.wins - a.wins;
            if (sortBy === 'winRate') return b.winRate - a.winRate;
            return 0;
        });

        return participants.slice(offset, offset + limit);
    }

    /**
     * دریافت تعداد شرکت‌کنندگان
     * @returns {number}
     */
    getParticipantCount() {
        return this.currentSeason?.participants.length || 0;
    }

    // ============================================================
    // بخش ۳: پایان فصل
    // ============================================================

    /**
     * پایان فصل فعلی
     * @returns {Object} نتیجه
     */
    endCurrentSeason() {
        return this._endCurrentSeason();
    }

    /**
     * پایان فصل فعلی (داخلی)
     * @returns {Object} نتیجه
     * @private
     */
    _endCurrentSeason() {
        if (!this.currentSeason || this.currentSeason.status !== 'active') {
            return {
                success: false,
                error: 'SEASON_NOT_ACTIVE',
                message: 'فصل فعال نیست'
            };
        }

        // محاسبه رتبه‌بندی نهایی
        this.finalRankings = this._calculateFinalRankings();

        // به‌روزرسانی وضعیت فصل
        this.currentSeason.status = 'ended';
        this.currentSeason.endedAt = Date.now();
        this.currentSeason.finalRankings = this.finalRankings;
        this.currentSeason.statistics.totalPlayers = this.currentSeason.participants.length;

        // محاسبه آمار فصل
        this._calculateSeasonStatistics();

        this.stats.totalSeasonsCompleted++;

        this._emit('season-ended', {
            season: this.currentSeason,
            rankings: this.finalRankings
        });

        if (this.debug) {
            console.log(`🏁 Season ${this.currentSeason.number} ended`);
        }

        return {
            success: true,
            season: this.currentSeason,
            rankings: this.finalRankings
        };
    }

    /**
     * محاسبه رتبه‌بندی نهایی
     * @returns {Array<Object>}
     * @private
     */
    _calculateFinalRankings() {
        const participants = [...(this.currentSeason?.participants || [])];

        // مرتب‌سازی بر اساس امتیاز، سپس Rating، سپس Win Rate
        participants.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.rating !== a.rating) return b.rating - a.rating;
            return b.winRate - a.winRate;
        });

        // اضافه کردن رتبه
        return participants.map((p, index) => ({
            ...p,
            rank: index + 1,
            percentile: ((index + 1) / participants.length) * 100
        }));
    }

    /**
     * محاسبه آمار فصل
     * @private
     */
    _calculateSeasonStatistics() {
        if (!this.currentSeason) return;

        const participants = this.currentSeason.participants;
        const totalGames = this.currentSeason.statistics.totalGames;
        const totalPlayers = participants.length;

        // محاسبه میانگین Rating
        const averageRating = participants.length > 0 ?
            participants.reduce((sum, p) => sum + p.rating, 0) / participants.length : 0;

        // محاسبه بالاترین Tier
        const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
        let topTier = 'bronze';
        participants.forEach(p => {
            if (tierOrder.indexOf(p.tier) > tierOrder.indexOf(topTier)) {
                topTier = p.tier;
            }
        });

        this.currentSeason.statistics = {
            ...this.currentSeason.statistics,
            totalGames,
            totalPlayers,
            averageRating: Math.round(averageRating),
            topTier,
            duration: this.currentSeason.endedAt - this.currentSeason.startDate
        };

        // به‌روزرسانی آمار کلی
        if (this.currentSeason.statistics.duration > this.stats.longestSeason) {
            this.stats.longestSeason = this.currentSeason.statistics.duration;
        }
        if (this.currentSeason.statistics.duration < this.stats.shortestSeason) {
            this.stats.shortestSeason = this.currentSeason.statistics.duration;
        }
    }

    // ============================================================
    // بخش ۴: توزیع پاداش‌ها
    // ============================================================

    /**
     * توزیع پاداش‌های فصل
     * @param {string} playerId - شناسه بازیکن (اختیاری - اگر null باشد برای همه)
     * @returns {Object} نتیجه
     */
    distributeRewards(playerId = null) {
        if (!this.currentSeason || this.currentSeason.status !== 'ended') {
            return {
                success: false,
                error: 'SEASON_NOT_ENDED',
                message: 'فصل تمام نشده است'
            };
        }

        const rankings = this.finalRankings;
        const rewards = this.currentSeason.rewards;
        const distributed = [];

        const playersToReward = playerId ?
            rankings.filter(p => p.id === playerId) :
            rankings;

        playersToReward.forEach(player => {
            const playerRewards = this._calculatePlayerRewards(player, rewards);
            this._awardRewardsToPlayer(player, playerRewards);

            distributed.push({
                playerId: player.id,
                username: player.username,
                rank: player.rank,
                rewards: playerRewards
            });

            this.distributedRewards.push({
                seasonNumber: this.currentSeason.number,
                playerId: player.id,
                rank: player.rank,
                rewards: playerRewards,
                distributedAt: Date.now()
            });

            this.stats.totalRewardsDistributed++;
        });

        this._emit('rewards-distributed', {
            season: this.currentSeason,
            distributed
        });

        if (this.debug) {
            console.log(`💰 Rewards distributed to ${distributed.length} players`);
        }

        return {
            success: true,
            distributed
        };
    }

    /**
     * محاسبه پاداش‌های بازیکن
     * @param {Object} player - بازیکن
     * @param {Object} rewards - ساختار پاداش‌ها
     * @returns {Object} پاداش‌ها
     * @private
     */
    _calculatePlayerRewards(player, rewards) {
        const playerRewards = {
            coins: 0,
            gems: 0,
            xp: 0,
            items: [],
            title: null,
            frame: null,
            badge: null,
            breakdown: []
        };

        // پاداش شرکت
        if (rewards.participation) {
            playerRewards.coins += rewards.participation.coins || 0;
            playerRewards.xp += rewards.participation.xp || 0;
            playerRewards.breakdown.push({
                type: 'participation',
                coins: rewards.participation.coins,
                xp: rewards.participation.xp
            });
        }

        // پاداش Tier
        const tierReward = rewards.tiers[player.tier];
        if (tierReward) {
            playerRewards.coins += tierReward.coins || 0;
            playerRewards.xp += tierReward.xp || 0;
            playerRewards.gems += tierReward.gems || 0;

            if (tierReward.frame) playerRewards.frame = tierReward.frame;
            if (tierReward.title) playerRewards.title = tierReward.title;
            if (tierReward.badge) playerRewards.badge = tierReward.badge;

            playerRewards.breakdown.push({
                type: 'tier',
                tier: player.tier,
                coins: tierReward.coins,
                xp: tierReward.xp,
                gems: tierReward.gems
            });
        }

        // پاداش رتبه
        if (player.rank === 1 && rewards.ranks.top1) {
            playerRewards.coins += rewards.ranks.top1.coins || 0;
            playerRewards.gems += rewards.ranks.top1.gems || 0;
            playerRewards.title = rewards.ranks.top1.title;
            playerRewards.badge = rewards.ranks.top1.badge;

            playerRewards.breakdown.push({
                type: 'rank',
                rank: 1,
                coins: rewards.ranks.top1.coins,
                gems: rewards.ranks.top1.gems,
                title: rewards.ranks.top1.title
            });
        } else if (player.rank <= 10 && rewards.ranks.top10) {
            playerRewards.coins += rewards.ranks.top10.coins || 0;
            playerRewards.gems += rewards.ranks.top10.gems || 0;
            playerRewards.title = rewards.ranks.top10.title;

            playerRewards.breakdown.push({
                type: 'rank',
                rank: player.rank,
                coins: rewards.ranks.top10.coins,
                gems: rewards.ranks.top10.gems
            });
        } else if (player.rank <= 50 && rewards.ranks.top50) {
            playerRewards.coins += rewards.ranks.top50.coins || 0;
            playerRewards.gems += rewards.ranks.top50.gems || 0;

            playerRewards.breakdown.push({
                type: 'rank',
                rank: player.rank,
                coins: rewards.ranks.top50.coins,
                gems: rewards.ranks.top50.gems
            });
        } else if (player.rank <= 100 && rewards.ranks.top100) {
            playerRewards.coins += rewards.ranks.top100.coins || 0;
            playerRewards.gems += rewards.ranks.top100.gems || 0;

            playerRewards.breakdown.push({
                type: 'rank',
                rank: player.rank,
                coins: rewards.ranks.top100.coins,
                gems: rewards.ranks.top100.gems
            });
        }

        return playerRewards;
    }

    /**
     * اعطای پاداش به بازیکن
     * @param {Object} player - بازیکن
     * @param {Object} rewards - پاداش‌ها
     * @private
     */
    _awardRewardsToPlayer(player, rewards) {
        const user = authManager?.getCurrentUser();
        if (!user || user.id !== player.id) return;

        // به‌روزرسانی پروفایل
        if (rewards.coins > 0) {
            user.profile.coins = (user.profile.coins || 0) + rewards.coins;
            this.stats.totalCoinsAwarded += rewards.coins;
        }

        if (rewards.gems > 0) {
            user.profile.gems = (user.profile.gems || 0) + rewards.gems;
            this.stats.totalGemsAwarded += rewards.gems;
        }

        if (rewards.xp > 0) {
            user.profile.xp = (user.profile.xp || 0) + rewards.xp;
        }

        // اضافه کردن آیتم‌ها به Inventory
        if (!user.profile.inventory) user.profile.inventory = {};

        if (rewards.frame) {
            if (!user.profile.inventory.frames) user.profile.inventory.frames = [];
            if (!user.profile.inventory.frames.includes(rewards.frame)) {
                user.profile.inventory.frames.push(rewards.frame);
            }
        }

        if (rewards.title) {
            if (!user.profile.inventory.titles) user.profile.inventory.titles = [];
            if (!user.profile.inventory.titles.includes(rewards.title)) {
                user.profile.inventory.titles.push(rewards.title);
            }
        }

        if (rewards.badge) {
            if (!user.profile.inventory.badges) user.profile.inventory.badges = [];
            if (!user.profile.inventory.badges.includes(rewards.badge)) {
                user.profile.inventory.badges.push(rewards.badge);
            }
        }

        if (storage) {
            storage.saveUserProfile(user);
        }

        if (this.debug) {
            console.log(`💰 Rewards awarded to ${player.username}:`, rewards);
        }
    }

    // ============================================================
    // بخش ۵: شروع فصل جدید
    // ============================================================

    /**
     * شروع فصل جدید
     * @returns {Object} نتیجه
     */
    startNewSeason() {
        if (this.currentSeason && this.currentSeason.status === 'active') {
            return {
                success: false,
                error: 'SEASON_ALREADY_ACTIVE',
                message: 'یک فصل فعال وجود دارد'
            };
        }

        // آرشیو فصل قبلی
        if (this.currentSeason) {
            this._archiveSeason(this.currentSeason);
        }

        // ایجاد فصل جدید
        const newSeasonNumber = (this.currentSeason?.number || 0) + 1;
        const newSeason = this._createSeasonObject(newSeasonNumber);

        this.currentSeason = newSeason;
        this.allSeasons.push(newSeason);
        this.seasonParticipants = [];
        this.finalRankings = [];
        this.distributedRewards = [];

        this.stats.totalSeasonsCreated++;

        this._emit('new-season-started', {
            season: newSeason,
            previousSeason: this.archivedSeasons[this.archivedSeasons.length - 1]
        });

        if (this.debug) {
            console.log(`🌟 New season started: ${newSeasonNumber}`);
        }

        return {
            success: true,
            season: newSeason
        };
    }

    /**
     * آرشیو فصل
     * @param {Object} season - فصل
     * @private
     */
    _archiveSeason(season) {
        season.status = 'archived';
        season.archivedAt = Date.now();

        this.archivedSeasons.push(season);

        this._emit('season-archived', { season });

        if (this.debug) {
            console.log(`📦 Season ${season.number} archived`);
        }
    }

    // ============================================================
    // بخش ۶: تاریخچه و آمار
    // ============================================================

    /**
     * دریافت تاریخچه فصل‌ها
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getSeasonHistory(limit = 10) {
        return this.archivedSeasons.slice(-limit).reverse();
    }

    /**
     * دریافت جزئیات فصل خاص
     * @param {number} seasonNumber - شماره فصل
     * @returns {Object|null}
     */
    getSeasonDetails(seasonNumber) {
        return this.allSeasons.find(s => s.number === seasonNumber) || null;
    }

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            currentSeason: this.getCurrentSeason(),
            archivedSeasonsCount: this.archivedSeasons.length,
            totalParticipantsAllTime: this.allSeasons.reduce((sum, s) => sum + s.participants.length, 0)
        };
    }

    /**
     * دریافت رتبه‌بندی فصل
     * @param {number} seasonNumber - شماره فصل (اختیاری - پیش‌فرض فصل فعلی)
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getSeasonRankings(seasonNumber = null, limit = 100) {
        let season;

        if (seasonNumber) {
            season = this.allSeasons.find(s => s.number === seasonNumber);
        } else {
            season = this.currentSeason;
        }

        if (!season) return [];

        const rankings = season.finalRankings.length > 0 ?
            season.finalRankings :
            this._calculateFinalRankingsForSeason(season);

        return rankings.slice(0, limit);
    }

    /**
     * محاسبه رتبه‌بندی برای فصل خاص
     * @param {Object} season - فصل
     * @returns {Array<Object>}
     * @private
     */
    _calculateFinalRankingsForSeason(season) {
        const participants = [...season.participants];

        participants.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.rating !== a.rating) return b.rating - a.rating;
            return b.winRate - a.winRate;
        });

        return participants.map((p, index) => ({
            ...p,
            rank: index + 1
        }));
    }

    // ============================================================
    // بخش ۷: Reset و مدیریت
    // ============================================================

    /**
     * Reset امن فصل (فقط در صورت نیاز)
     * @param {string} reason - دلیل reset
     * @returns {Object} نتیجه
     */
    safeReset(reason = 'manual') {
        if (!this.currentSeason) {
            return {
                success: false,
                error: 'NO_SEASON',
                message: 'فصلی وجود ندارد'
            };
        }

        // ذخیره backup
        const backup = {
            season: { ...this.currentSeason },
            participants: [...this.currentSeason.participants],
            rankings: [...this.finalRankings]
        };

        storage?.set('season_backup', backup);

        // Reset
        this.currentSeason.participants = [];
        this.finalRankings = [];
        this.distributedRewards = [];
        this.seasonParticipants = [];

        this._emit('season-reset', {
            season: this.currentSeason,
            reason,
            backup
        });

        if (this.debug) {
            console.log(`🔄 Season reset: ${reason}`);
        }

        return {
            success: true,
            backup
        };
    }

    /**
     * بازیابی از backup
     * @returns {Object} نتیجه
     */
    restoreFromBackup() {
        const backup = storage?.get('season_backup');

        if (!backup) {
            return {
                success: false,
                error: 'NO_BACKUP',
                message: 'Backup یافت نشد'
            };
        }

        if (this.currentSeason) {
            this.currentSeason.participants = backup.participants;
            this.finalRankings = backup.rankings;
        }

        this._emit('season-restored', { backup });

        if (this.debug) {
            console.log('✅ Season restored from backup');
        }

        return {
            success: true,
            backup
        };
    }

    // ============================================================
    // بخش : ذخیره و بارگذاری
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('season_current', this.currentSeason);
            storage.set('season_all', this.allSeasons);
            storage.set('season_archived', this.archivedSeasons);
            storage.set('season_rankings', this.finalRankings);
            storage.set('season_rewards', this.distributedRewards);
            storage.set('season_stats', this.stats);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const current = storage.get('season_current');
            if (current) this.currentSeason = current;

            const all = storage.get('season_all');
            if (all) this.allSeasons = all;

            const archived = storage.get('season_archived');
            if (archived) this.archivedSeasons = archived;

            const rankings = storage.get('season_rankings');
            if (rankings) this.finalRankings = rankings;

            const rewards = storage.get('season_rewards');
            if (rewards) this.distributedRewards = rewards;

            const stats = storage.get('season_stats');
            if (stats) this.stats = { ...this.stats, ...stats };
        }
    }

    // ============================================================
    // بخش ۹: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.currentSeason = null;
        this.allSeasons = [];
        this.archivedSeasons = [];
        this.finalRankings = [];
        this.distributedRewards = [];
        this.seasonParticipants = [];

        this.stats = {
            totalSeasonsCreated: 0,
            totalSeasonsCompleted: 0,
            totalParticipants: 0,
            totalRewardsDistributed: 0,
            totalCoinsAwarded: 0,
            totalGemsAwarded: 0,
            averageParticipantsPerSeason: 0,
            longestSeason: 0,
            shortestSeason: Infinity
        };

        this._createFirstSeason();
        this._saveData();

        if (this.debug) {
            console.log('🔄 SeasonManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const current = this.getCurrentSeason();
        const stats = this.getStats();

        console.log('📅 SeasonManager Status:');
        console.log('  Current Season:', current?.number || 'None');
        console.log('  Status:', current?.status || 'None');
        console.log('  Participants:', current?.participantCount || 0);
        console.log('  Progress:', current?.progress?.toFixed(1) + '%');
        console.log('  Days Remaining:', current?.daysRemaining || 0);
        console.log('  Total Seasons:', stats.totalSeasonsCreated);
        console.log('  Completed:', stats.totalSeasonsCompleted);
        console.log('  Archived:', stats.archivedSeasonsCount);
        console.log('  Total Rewards:', stats.totalRewardsDistributed);
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
                    console.error(`❌ Season event listener error:`, error);
                }
            });
        }

        eventBus.emit(`season:${event}`, data);
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
const seasonManager = new SeasonManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SeasonManager, seasonManager };
} else {
    window.SeasonManager = SeasonManager;
    window.seasonManager = seasonManager;
}

console.log('✅ SeasonManager loaded');
