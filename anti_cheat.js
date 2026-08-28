/**
 * ============================================================
 * HOKM MASTER - Anti-Cheat System
 * سیستم تشخیص و جلوگیری از تقلب در بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم ضد تقلب است. شامل
 * تشخیص تقلب‌های رایج، تحلیل رفتار بازیکن، fingerprint
 * دستگاه، تحلیل الگوهای بازی، سیستم گزارش‌دهی، اقدامات
 * تنبیهی، و آمار امنیتی.
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
 * 
 * ============================================================
 */

class AntiCheatSystem {

    constructor() {
        /**
         * قوانین تشخیص تقلب
         * @type {Array<Object>}
         */
        this.rules = this._defineRules();

        /**
         * هشدارهای فعال
         * @type {Array<Object>}
         */
        this.activeWarnings = [];

        /**
         * بازیکنان مشکوک
         * @type {Map<string, Object>}
         */
        this.suspiciousPlayers = new Map();

        /**
         * بازیکنان مسدود شده
         * @type {Map<string, Object>}
         */
        this.bannedPlayers = new Map();

        /**
         * گزارش‌های دریافتی
         * @type {Array<Object>}
         */
        this.reports = [];

        /**
         * fingerprint دستگاه‌ها
         * @type {Map<string, Object>}
         */
        this.deviceFingerprints = new Map();

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
         * آمار سیستم ضد تقلب
         * @type {Object}
         */
        this.stats = {
            totalGamesAnalyzed: 0,
            totalCheatsDetected: 0,
            totalWarningsIssued: 0,
            totalBansIssued: 0,
            totalReportsReceived: 0,
            totalReportsValidated: 0,
            totalReportsDismissed: 0,
            falsePositiveRate: 0,
            detectionAccuracy: 0,
            lastAnalysisAt: null,
            activeSuspiciousPlayers: 0,
            activeBannedPlayers: 0
        };

        /**
         * محدودیت‌ها و آستانه‌ها
         * @type {Object}
         */
        this.thresholds = {
            // سرعت بازی
            minMoveTimeMs: 300,
            maxMoveTimeMs: 120000,
            averageMoveTimeMs: 5000,
            suspiciousMoveTimeRatio: 0.3,

            // برد/باخت
            maxWinStreak: 15,
            maxWinRate: 0.85,
            minGamesForAnalysis: 20,

            // گزارش‌ها
            maxReportsPerPlayer: 10,
            reportValidationThreshold: 3,

            // امتیاز تقلب
            warningThreshold: 50,
            tempBanThreshold: 75,
            permanentBanThreshold: 90,

            // session
            maxSessionDurationHours: 12,
            maxGamesPerSession: 100,

            // device
            maxAccountsPerDevice: 3,
            maxIpChangesPerHour: 5
        };

        /**
         * وضعیت سیستم
         * @type {string} 'active' | 'passive' | 'disabled'
         */
        this.status = 'active';

        /**
         * تاریخچه تحلیل‌ها
         * @type {Array<Object>}
         */
        this.analysisHistory = [];

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

        // ایجاد fingerprint دستگاه فعلی
        this._createDeviceFingerprint();

        // بررسی بازیکنان مسدود شده
        this._checkBannedPlayers();

        if (this.debug) {
            console.log('🛡️ AntiCheatSystem initialized');
            console.log('  Status:', this.status);
            console.log('  Rules:', this.rules.length);
            console.log('  Banned Players:', this.bannedPlayers.size);
            console.log('  Suspicious Players:', this.suspiciousPlayers.size);
        }
    }

    // ============================================================
    // بخش ۱: تعریف قوانین
    // ============================================================

    /**
     * تعریف قوانین تشخیص تقلب
     * @returns {Array<Object>}
     * @private
     */
    _defineRules() {
        return [
            {
                id: 'impossible_card',
                name: 'کارت غیرممکن',
                description: 'بازیکن کارتی را بازی کرده که نباید داشته باشد',
                severity: 'critical', // low, medium, high, critical
                points: 100,
                action: 'permanent_ban',
                enabled: true
            },
            {
                id: 'superhuman_speed',
                name: 'سرعت غیرانسانی',
                description: 'بازیکن با سرعت غیرممکن بازی می‌کند',
                severity: 'high',
                points: 70,
                action: 'temp_ban',
                enabled: true
            },
            {
                id: 'perfect_prediction',
                name: 'پیش‌بینی کامل',
                description: 'بازیکن همیشه کارت‌های حریف را درست حدس می‌زند',
                severity: 'high',
                points: 60,
                action: 'investigation',
                enabled: true
            },
            {
                id: 'abnormal_win_rate',
                name: 'نرخ برد غیرعادی',
                description: 'نرخ برد بازیکن به طور غیرعادی بالا است',
                severity: 'medium',
                points: 40,
                action: 'warning',
                enabled: true
            },
            {
                id: 'abnormal_win_streak',
                name: 'رشته برد غیرعادی',
                description: 'بازیکن تعداد زیادی بازی متوالی برده است',
                severity: 'medium',
                points: 35,
                action: 'warning',
                enabled: true
            },
            {
                id: 'collusion_pattern',
                name: 'الگوی تبانی',
                description: 'دو بازیکن به طور مکرر با هم بازی می‌کنند و یکی همیشه می‌برد',
                severity: 'high',
                points: 65,
                action: 'investigation',
                enabled: true
            },
            {
                id: 'device_mismatch',
                name: 'عدم تطابق دستگاه',
                description: 'بازیکن از دستگاه‌های متعدد با الگوی مشکوک استفاده می‌کند',
                severity: 'medium',
                points: 45,
                action: 'investigation',
                enabled: true
            },
            {
                id: 'session_anomaly',
                name: 'ناهنجاری session',
                description: 'session بازی غیرعادی طولانی یا با الگوی مشکوک',
                severity: 'low',
                points: 25,
                action: 'monitor',
                enabled: true
            },
            {
                id: 'rating_manipulation',
                name: 'دستکاری rating',
                description: 'الگوی غیرعادی در تغییرات rating',
                severity: 'medium',
                points: 50,
                action: 'investigation',
                enabled: true
            },
            {
                id: 'bot_behavior',
                name: 'رفتار ربات',
                description: 'الگوی بازی شبیه به ربات است',
                severity: 'high',
                points: 75,
                action: 'temp_ban',
                enabled: true
            },
            {
                id: 'card_count_mismatch',
                name: 'عدم تطابق تعداد کارت',
                description: 'تعداد کارت‌های بازیکن با قوانین مطابقت ندارد',
                severity: 'critical',
                points: 90,
                action: 'permanent_ban',
                enabled: true
            },
            {
                id: 'trick_anomaly',
                name: 'ناهنجاری در دست',
                description: 'الگوی برنده شدن دست‌ها غیرعادی است',
                severity: 'medium',
                points: 30,
                action: 'monitor',
                enabled: true
            },
            {
                id: 'multiple_accounts',
                name: 'حساب‌های متعدد',
                description: 'چندین حساب از یک دستگاه یا IP',
                severity: 'high',
                points: 55,
                action: 'investigation',
                enabled: true
            },
            {
                id: 'impossible_kot',
                name: 'کت غیرممکن',
                description: 'بازیکن کتی ثبت کرده که از نظر آماری غیرممکن است',
                severity: 'high',
                points: 70,
                action: 'investigation',
                enabled: true
            },
            {
                id: 'report_abuse',
                name: 'سوءاستفاده از گزارش',
                description: 'بازیکن به طور مکرر گزارش‌های نادرست ارسال می‌کند',
                severity: 'medium',
                points: 40,
                action: 'warning',
                enabled: true
            }
        ];
    }

    // ============================================================
    // بخش ۲: تحلیل بازی
    // ============================================================

    /**
     * تحلیل یک بازی کامل
     * @param {Object} gameData - داده بازی
     * @returns {Object} نتیجه تحلیل
     */
    analyzeGame(gameData) {
        if (this.status === 'disabled') {
            return {
                success: false,
                error: 'SYSTEM_DISABLED',
                message: 'سیستم ضد تقلب غیرفعال است'
            };
        }

        const {
            gameId,
            players,
            moves,
            tricks,
            duration,
            winner,
            mode,
            timestamp
        } = gameData;

        const analysis = {
            gameId,
            timestamp: Date.now(),
            violations: [],
            suspiciousPlayers: [],
            score: 0,
            isValid: true,
            recommendations: []
        };

        // اجرای تمام قوانین
        this.rules.forEach(rule => {
            if (!rule.enabled) return;

            const violation = this._checkRule(rule, gameData);
            if (violation) {
                analysis.violations.push(violation);
                analysis.score += rule.points;
            }
        });

        // تحلیل‌های اضافی
        const speedAnalysis = this._analyzeMoveSpeed(moves, players);
        if (speedAnalysis.suspicious) {
            analysis.violations.push(speedAnalysis.violation);
            analysis.score += speedAnalysis.points;
        }

        const patternAnalysis = this._analyzePlayPattern(moves, players);
        if (patternAnalysis.suspicious) {
            analysis.violations.push(patternAnalysis.violation);
            analysis.score += patternAnalysis.points;
        }

        const trickAnalysis = this._analyzeTrickDistribution(tricks, players);
        if (trickAnalysis.suspicious) {
            analysis.violations.push(trickAnalysis.violation);
            analysis.score += trickAnalysis.points;
        }

        // تعیین وضعیت
        if (analysis.score >= this.thresholds.permanentBanThreshold) {
            analysis.isValid = false;
            analysis.recommendations.push('permanent_ban');
        } else if (analysis.score >= this.thresholds.tempBanThreshold) {
            analysis.isValid = false;
            analysis.recommendations.push('temp_ban');
        } else if (analysis.score >= this.thresholds.warningThreshold) {
            analysis.recommendations.push('warning');
        }

        // به‌روزرسانی آمار
        this.stats.totalGamesAnalyzed++;
        this.stats.lastAnalysisAt = Date.now();

        if (analysis.violations.length > 0) {
            this.stats.totalCheatsDetected++;
        }

        // ذخیره در تاریخچه
        this.analysisHistory.push(analysis);
        if (this.analysisHistory.length > 1000) {
            this.analysisHistory.shift();
        }

        // اعمال اقدامات
        if (analysis.recommendations.length > 0) {
            this._applyRecommendations(analysis, gameData);
        }

        this._emit('game-analyzed', { analysis, gameData });

        if (this.debug && analysis.violations.length > 0) {
            console.log(` Game ${gameId} analyzed: ${analysis.violations.length} violations, score: ${analysis.score}`);
        }

        return {
            success: true,
            analysis
        };
    }

    /**
     * بررسی یک قانون خاص
     * @param {Object} rule - قانون
     * @param {Object} gameData - داده بازی
     * @returns {Object|null} تخلف
     * @private
     */
    _checkRule(rule, gameData) {
        switch (rule.id) {
            case 'impossible_card':
                return this._checkImpossibleCard(rule, gameData);
            case 'superhuman_speed':
                return this._checkSuperhumanSpeed(rule, gameData);
            case 'perfect_prediction':
                return this._checkPerfectPrediction(rule, gameData);
            case 'abnormal_win_rate':
                return this._checkAbnormalWinRate(rule, gameData);
            case 'abnormal_win_streak':
                return this._checkAbnormalWinStreak(rule, gameData);
            case 'collusion_pattern':
                return this._checkCollusionPattern(rule, gameData);
            case 'device_mismatch':
                return this._checkDeviceMismatch(rule, gameData);
            case 'session_anomaly':
                return this._checkSessionAnomaly(rule, gameData);
            case 'rating_manipulation':
                return this._checkRatingManipulation(rule, gameData);
            case 'bot_behavior':
                return this._checkBotBehavior(rule, gameData);
            case 'card_count_mismatch':
                return this._checkCardCountMismatch(rule, gameData);
            case 'trick_anomaly':
                return this._checkTrickAnomaly(rule, gameData);
            case 'multiple_accounts':
                return this._checkMultipleAccounts(rule, gameData);
            case 'impossible_kot':
                return this._checkImpossibleKot(rule, gameData);
            case 'report_abuse':
                return this._checkReportAbuse(rule, gameData);
            default:
                return null;
        }
    }

    // ============================================================
    // بخش ۳: بررسی قوانین خاص
    // ============================================================

    /**
     * بررسی کارت غیرممکن
     * @private
     */
    _checkImpossibleCard(rule, gameData) {
        const { players, moves } = gameData;

        for (const player of players) {
            const playerMoves = moves.filter(m => m.playerId === player.id);
            const cardsPlayed = playerMoves.map(m => m.card);

            // بررسی تکراری نبودن کارت‌ها
            const uniqueCards = new Set(cardsPlayed.map(c => `${c.suit}:${c.rank}`));
            if (uniqueCards.size !== cardsPlayed.length) {
                return {
                    ruleId: rule.id,
                    playerId: player.id,
                    severity: rule.severity,
                    points: rule.points,
                    evidence: 'Duplicate cards played',
                    timestamp: Date.now()
                };
            }

            // بررسی تطابق با دست اولیه
            if (player.initialCards) {
                const initialSet = new Set(player.initialCards.map(c => `${c.suit}:${c.rank}`));
                for (const card of cardsPlayed) {
                    if (!initialSet.has(`${card.suit}:${card.rank}`)) {
                        return {
                            ruleId: rule.id,
                            playerId: player.id,
                            severity: rule.severity,
                            points: rule.points,
                            evidence: `Card ${card.suit}:${card.rank} not in initial hand`,
                            timestamp: Date.now()
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * بررسی سرعت غیرانسانی
     * @private
     */
    _checkSuperhumanSpeed(rule, gameData) {
        const { moves } = gameData;
        if (moves.length < 5) return null;

        const moveTimes = [];
        for (let i = 1; i < moves.length; i++) {
            const timeDiff = moves[i].timestamp - moves[i - 1].timestamp;
            moveTimes.push(timeDiff);
        }

        const avgTime = moveTimes.reduce((sum, t) => sum + t, 0) / moveTimes.length;
        const fastMoves = moveTimes.filter(t => t < this.thresholds.minMoveTimeMs);
        const fastRatio = fastMoves.length / moveTimes.length;

        if (fastRatio > this.thresholds.suspiciousMoveTimeRatio && avgTime < this.thresholds.minMoveTimeMs * 2) {
            return {
                ruleId: rule.id,
                playerId: moves[0].playerId,
                severity: rule.severity,
                points: rule.points,
                evidence: `Average move time: ${avgTime}ms, fast move ratio: ${(fastRatio * 100).toFixed(1)}%`,
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * بررسی پیش‌بینی کامل
     * @private
     */
    _checkPerfectPrediction(rule, gameData) {
        // تحلیل اینکه آیا بازیکن همیشه کارت‌های حریف را درست پیش‌بینی کرده
        // این نیاز به داده‌های بیشتری دارد
        return null;
    }

    /**
     * بررسی نرخ برد غیرعادی
     * @private
     */
    _checkAbnormalWinRate(rule, gameData) {
        const { players } = gameData;

        for (const player of players) {
            const stats = player.stats || {};
            const totalGames = stats.totalGames || 0;
            const wins = stats.wins || 0;

            if (totalGames >= this.thresholds.minGamesForAnalysis) {
                const winRate = wins / totalGames;
                if (winRate > this.thresholds.maxWinRate) {
                    return {
                        ruleId: rule.id,
                        playerId: player.id,
                        severity: rule.severity,
                        points: rule.points,
                        evidence: `Win rate: ${(winRate * 100).toFixed(1)}% over ${totalGames} games`,
                        timestamp: Date.now()
                    };
                }
            }
        }

        return null;
    }

    /**
     * بررسی رشته برد غیرعادی
     * @private
     */
    _checkAbnormalWinStreak(rule, gameData) {
        const { players } = gameData;

        for (const player of players) {
            const stats = player.stats || {};
            const currentStreak = stats.currentStreak || 0;

            if (currentStreak >= this.thresholds.maxWinStreak) {
                return {
                    ruleId: rule.id,
                    playerId: player.id,
                    severity: rule.severity,
                    points: rule.points,
                    evidence: `Win streak: ${currentStreak}`,
                    timestamp: Date.now()
                };
            }
        }

        return null;
    }

    /**
     * بررسی الگوی تبانی
     * @private
     */
    _checkCollusionPattern(rule, gameData) {
        // نیاز به تحلیل تاریخی بازی‌های مشترک
        return null;
    }

    /**
     * بررسی عدم تطابق دستگاه
     * @private
     */
    _checkDeviceMismatch(rule, gameData) {
        const { players } = gameData;

        for (const player of players) {
            const fingerprint = this.deviceFingerprints.get(player.id);
            if (fingerprint && fingerprint.deviceChanges > 5) {
                return {
                    ruleId: rule.id,
                    playerId: player.id,
                    severity: rule.severity,
                    points: rule.points,
                    evidence: `Device changes: ${fingerprint.deviceChanges}`,
                    timestamp: Date.now()
                };
            }
        }

        return null;
    }

    /**
     * بررسی ناهنجاری session
     * @private
     */
    _checkSessionAnomaly(rule, gameData) {
        const { duration, players } = gameData;

        if (duration > this.thresholds.maxSessionDurationHours * 60 * 60 * 1000) {
            return {
                ruleId: rule.id,
                playerId: players[0]?.id,
                severity: rule.severity,
                points: rule.points,
                evidence: `Session duration: ${(duration / 3600000).toFixed(1)} hours`,
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * بررسی دستکاری rating
     * @private
     */
    _checkRatingManipulation(rule, gameData) {
        // نیاز به تحلیل تاریخی rating
        return null;
    }

    /**
     * بررسی رفتار ربات
     * @private
     */
    _checkBotBehavior(rule, gameData) {
        const { moves } = gameData;
        if (moves.length < 10) return null;

        // بررسی یکنواختی زمان بین حرکت‌ها
        const moveTimes = [];
        for (let i = 1; i < moves.length; i++) {
            moveTimes.push(moves[i].timestamp - moves[i - 1].timestamp);
        }

        const avg = moveTimes.reduce((sum, t) => sum + t, 0) / moveTimes.length;
        const variance = moveTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / moveTimes.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = stdDev / avg;

        // اگر ضریب تغییرات خیلی کم باشد، احتمال ربات بودن بالاست
        if (coefficientOfVariation < 0.1 && moveTimes.length > 20) {
            return {
                ruleId: rule.id,
                playerId: moves[0].playerId,
                severity: rule.severity,
                points: rule.points,
                evidence: `Move time CV: ${coefficientOfVariation.toFixed(3)} (too uniform)`,
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * بررسی عدم تطابق تعداد کارت
     * @private
     */
    _checkCardCountMismatch(rule, gameData) {
        const { players, moves } = gameData;

        for (const player of players) {
            const playerMoves = moves.filter(m => m.playerId === player.id);
            if (playerMoves.length !== 13) { // هر بازیکن باید 13 کارت بازی کند
                return {
                    ruleId: rule.id,
                    playerId: player.id,
                    severity: rule.severity,
                    points: rule.points,
                    evidence: `Cards played: ${playerMoves.length} (expected 13)`,
                    timestamp: Date.now()
                };
            }
        }

        return null;
    }

    /**
     * بررسی ناهنجاری در دست
     * @private
     */
    _checkTrickAnomaly(rule, gameData) {
        const { tricks, players } = gameData;

        for (const player of players) {
            const wonTricks = tricks.filter(t => t.winnerId === player.id).length;
            // اگر بازیکن همه 13 دست را برده، مشکوک است (مگر در کت)
            if (wonTricks === 13 && !gameData.isKot) {
                return {
                    ruleId: rule.id,
                    playerId: player.id,
                    severity: rule.severity,
                    points: rule.points,
                    evidence: `Won all 13 tricks without kot declaration`,
                    timestamp: Date.now()
                };
            }
        }

        return null;
    }

    /**
     * بررسی حساب‌های متعدد
     * @private
     */
    _checkMultipleAccounts(rule, gameData) {
        // نیاز به تحلیل دستگاه و IP
        return null;
    }

    /**
     * بررسی کت غیرممکن
     * @private
     */
    _checkImpossibleKot(rule, gameData) {
        const { tricks, players } = gameData;

        for (const player of players) {
            if (player.declaredKot) {
                const wonTricks = tricks.filter(t => t.winnerId === player.id).length;
                if (wonTricks < 7) { // کت یعنی حداقل 7 دست
                    return {
                        ruleId: rule.id,
                        playerId: player.id,
                        severity: rule.severity,
                        points: rule.points,
                        evidence: `Declared kot but won only ${wonTricks} tricks`,
                        timestamp: Date.now()
                    };
                }
            }
        }

        return null;
    }

    /**
     * بررسی سوءاستفاده از گزارش
     * @private
     */
    _checkReportAbuse(rule, gameData) {
        // بررسی تاریخچه گزارش‌های بازیکن
        return null;
    }

    // ============================================================
    // بخش ۴: تحلیل‌های پیشرفته
    // ============================================================

    /**
     * تحلیل سرعت حرکت‌ها
     * @param {Array} moves - حرکت‌ها
     * @param {Array} players - بازیکنان
     * @returns {Object}
     * @private
     */
    _analyzeMoveSpeed(moves, players) {
        const result = { suspicious: false, violation: null, points: 0 };

        if (moves.length < 10) return result;

        const playerMoveTimes = {};
        players.forEach(p => {
            playerMoveTimes[p.id] = [];
        });

        for (let i = 1; i < moves.length; i++) {
            const timeDiff = moves[i].timestamp - moves[i - 1].timestamp;
            const playerId = moves[i].playerId;

            if (playerMoveTimes[playerId]) {
                playerMoveTimes[playerId].push(timeDiff);
            }
        }

        for (const [playerId, times] of Object.entries(playerMoveTimes)) {
            if (times.length < 5) continue;

            const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
            const min = Math.min(...times);

            if (min < this.thresholds.minMoveTimeMs && avg < this.thresholds.averageMoveTimeMs * 0.3) {
                result.suspicious = true;
                result.violation = {
                    ruleId: 'superhuman_speed_advanced',
                    playerId,
                    severity: 'high',
                    points: 50,
                    evidence: `Min: ${min}ms, Avg: ${avg.toFixed(0)}ms`,
                    timestamp: Date.now()
                };
                result.points = 50;
                break;
            }
        }

        return result;
    }

    /**
     * تحلیل الگوی بازی
     * @param {Array} moves - حرکت‌ها
     * @param {Array} players - بازیکنان
     * @returns {Object}
     * @private
     */
    _analyzePlayPattern(moves, players) {
        const result = { suspicious: false, violation: null, points: 0 };

        // بررسی الگوی تکراری در انتخاب کارت
        const playerCardChoices = {};
        players.forEach(p => {
            playerCardChoices[p.id] = [];
        });

        moves.forEach(move => {
            if (playerCardChoices[move.playerId]) {
                playerCardChoices[move.playerId].push({
                    suit: move.card.suit,
                    rank: move.card.rank,
                    position: move.position
                });
            }
        });

        // تحلیل الگو (ساده)
        for (const [playerId, choices] of Object.entries(playerCardChoices)) {
            if (choices.length < 10) continue;

            // بررسی تکرار الگو
            const patterns = {};
            for (let i = 0; i < choices.length - 2; i++) {
                const pattern = `${choices[i].suit}-${choices[i + 1].suit}-${choices[i + 2].suit}`;
                patterns[pattern] = (patterns[pattern] || 0) + 1;
            }

            const maxPatternCount = Math.max(...Object.values(patterns));
            if (maxPatternCount > 3) {
                result.suspicious = true;
                result.violation = {
                    ruleId: 'repetitive_pattern',
                    playerId,
                    severity: 'medium',
                    points: 30,
                    evidence: `Repetitive suit pattern detected: ${maxPatternCount} times`,
                    timestamp: Date.now()
                };
                result.points = 30;
                break;
            }
        }

        return result;
    }

    /**
     * تحلیل توزیع دست‌ها
     * @param {Array} tricks - دست‌ها
     * @param {Array} players - بازیکنان
     * @returns {Object}
     * @private
     */
    _analyzeTrickDistribution(tricks, players) {
        const result = { suspicious: false, violation: null, points: 0 };

        if (tricks.length !== 13) return result;

        const trickCounts = {};
        players.forEach(p => {
            trickCounts[p.id] = 0;
        });

        tricks.forEach(trick => {
            if (trickCounts[trick.winnerId] !== undefined) {
                trickCounts[trick.winnerId]++;
            }
        });

        // بررسی توزیع غیرعادی
        const counts = Object.values(trickCounts);
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);

        if (maxCount >= 11 && minCount <= 1) {
            const dominantPlayer = Object.keys(trickCounts).find(k => trickCounts[k] === maxCount);
            result.suspicious = true;
            result.violation = {
                ruleId: 'extreme_trick_distribution',
                playerId: dominantPlayer,
                severity: 'medium',
                points: 40,
                evidence: `Trick distribution: ${counts.join(', ')}`,
                timestamp: Date.now()
            };
            result.points = 40;
        }

        return result;
    }

    // ============================================================
    // بخش ۵: fingerprint دستگاه
    // ============================================================

    /**
     * ایجاد fingerprint دستگاه
     * @returns {Object}
     * @private
     */
    _createDeviceFingerprint() {
        const user = authManager?.getCurrentUser();
        if (!user) return null;

        const fingerprint = {
            userId: user.id,
            userAgent: navigator?.userAgent || 'unknown',
            screenResolution: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown',
            colorDepth: typeof screen !== 'undefined' ? screen.colorDepth : 0,
            timezone: Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone || 'unknown',
            language: navigator?.language || 'unknown',
            platform: navigator?.platform || 'unknown',
            canvasHash: this._generateCanvasHash(),
            webglHash: this._generateWebGLHash(),
            audioHash: this._generateAudioHash(),
            fonts: this._detectFonts(),
            plugins: this._detectPlugins(),
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
            deviceChanges: 0,
            ipChanges: 0
        };

        this.deviceFingerprints.set(user.id, fingerprint);
        this._saveData();

        return fingerprint;
    }

    /**
     * تولید hash canvas
     * @returns {string}
     * @private
     */
    _generateCanvasHash() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 50;

            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, 200, 50);
            ctx.fillStyle = '#069';
            ctx.fillText('Hokm Master Anti-Cheat', 2, 2);

            return canvas.toDataURL().slice(-20);
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * تولید hash WebGL
     * @returns {string}
     * @private
     */
    _generateWebGLHash() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            if (!gl) return 'no-webgl';

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debugInfo) return 'no-debug-info';

            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

            return `${vendor}-${renderer}`.slice(-30);
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * تولید hash audio
     * @returns {string}
     * @private
     */
    _generateAudioHash() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const analyser = audioContext.createAnalyser();
            const gain = audioContext.createGain();
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

            gain.gain.value = 0;
            oscillator.type = 'triangle';
            oscillator.connect(scriptProcessor);
            scriptProcessor.connect(analyser);
            analyser.connect(gain);
            gain.connect(audioContext.destination);

            oscillator.start(0);

            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);

            oscillator.stop();
            audioContext.close();

            return Array.from(data).slice(0, 20).join(',');
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * تشخیص فونت‌های نصب شده
     * @returns {Array<string>}
     * @private
     */
    _detectFonts() {
        const baseFonts = ['monospace', 'sans-serif', 'serif'];
        const testFonts = [
            'Arial', 'Verdana', 'Times New Roman', 'Courier New',
            'Georgia', 'Palatino', 'Garamond', 'Bookman',
            'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact'
        ];

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const testString = 'mmmmmmmmmmlli';
        const testSize = '72px';

        const baseWidths = {};
        baseFonts.forEach(font => {
            ctx.font = `${testSize} ${font}`;
            baseWidths[font] = ctx.measureText(testString).width;
        });

        const detected = [];
        testFonts.forEach(font => {
            let isDetected = false;
            baseFonts.forEach(baseFont => {
                ctx.font = `${testSize} ${font}, ${baseFont}`;
                const width = ctx.measureText(testString).width;
                if (width !== baseWidths[baseFont]) {
                    isDetected = true;
                }
            });
            if (isDetected) detected.push(font);
        });

        return detected;
    }

    /**
     * تشخیص پلاگین‌ها
     * @returns {Array<string>}
     * @private
     */
    _detectPlugins() {
        const plugins = [];
        if (navigator?.plugins) {
            for (let i = 0; i < navigator.plugins.length; i++) {
                plugins.push(navigator.plugins[i].name);
            }
        }
        return plugins;
    }

    // ============================================================
    // بخش ۶: سیستم گزارش‌دهی
    // ============================================================

    /**
     * ارسال گزارش تقلب
     * @param {Object} reportData - داده گزارش
     * @returns {Object} نتیجه
     */
    submitReport(reportData) {
        const user = authManager?.getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'برای ارسال گزارش باید وارد شوید'
            };
        }

        const {
            reportedPlayerId,
            reason,
            description,
            gameId,
            evidence
        } = reportData;

        // اعتبارسنجی
        if (!reportedPlayerId || !reason) {
            return {
                success: false,
                error: 'INVALID_DATA',
                message: 'داده‌های گزارش ناقص است'
            };
        }

        if (reportedPlayerId === user.id) {
            return {
                success: false,
                error: 'SELF_REPORT',
                message: 'نمی‌توانید خودتان را گزارش دهید'
            };
        }

        // بررسی محدودیت گزارش
        const userReports = this.reports.filter(r => r.reporterId === user.id);
        const recentReports = userReports.filter(r => Date.now() - r.timestamp < 24 * 60 * 60 * 1000);

        if (recentReports.length >= this.thresholds.maxReportsPerPlayer) {
            return {
                success: false,
                error: 'REPORT_LIMIT_REACHED',
                message: `حداکثر ${this.thresholds.maxReportsPerPlayer} گزارش در 24 ساعت`
            };
        }

        // بررسی تکراری نبودن
        const duplicateReport = this.reports.find(r =>
            r.reportedPlayerId === reportedPlayerId &&
            r.reporterId === user.id &&
            Date.now() - r.timestamp < 60 * 60 * 1000
        );

        if (duplicateReport) {
            return {
                success: false,
                error: 'DUPLICATE_REPORT',
                message: 'شما اخیراً این بازیکن را گزارش داده‌اید'
            };
        }

        const report = {
            id: Utils.generateUUID(),
            reporterId: user.id,
            reporterUsername: user.username,
            reportedPlayerId,
            reason,
            description: description || '',
            gameId: gameId || null,
            evidence: evidence || null,
            status: 'pending', // pending, validated, dismissed, action_taken
            priority: 'normal', // low, normal, high, urgent
            timestamp: Date.now(),
            validatedAt: null,
            actionTaken: null
        };

        this.reports.push(report);
        this.stats.totalReportsReceived++;

        // بررسی اعتبار گزارش
        this._validateReport(report);

        this._emit('report-submitted', { report });

        if (this.debug) {
            console.log(`📝 Report submitted against player: ${reportedPlayerId}`);
        }

        return {
            success: true,
            report
        };
    }

    /**
     * اعتبارسنجی گزارش
     * @param {Object} report - گزارش
     * @private
     */
    _validateReport(report) {
        // شمارش گزارش‌های مشابه علیه همین بازیکن
        const similarReports = this.reports.filter(r =>
            r.reportedPlayerId === report.reportedPlayerId &&
            r.status === 'pending' &&
            Date.now() - r.timestamp < 7 * 24 * 60 * 60 * 1000
        );

        if (similarReports.length >= this.thresholds.reportValidationThreshold) {
            report.priority = 'high';
            report.status = 'validated';
            this.stats.totalReportsValidated++;

            // شروع بررسی خودکار
            this._investigatePlayer(report.reportedPlayerId);

            this._emit('report-validated', { report });
        }
    }

    /**
     * بررسی بازیکن مشکوک
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     */
    investigatePlayer(playerId) {
        return this._investigatePlayer(playerId);
    }

    /**
     * بررسی بازیکن مشکوک (داخلی)
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object} نتیجه
     * @private
     */
    _investigatePlayer(playerId) {
        const playerReports = this.reports.filter(r =>
            r.reportedPlayerId === playerId && r.status !== 'dismissed'
        );

        const playerGames = this.analysisHistory.filter(a =>
            a.gameData?.players?.some(p => p.id === playerId)
        );

        const totalScore = playerGames.reduce((sum, a) => sum + a.score, 0);
        const avgScore = playerGames.length > 0 ? totalScore / playerGames.length : 0;

        const investigation = {
            playerId,
            reportCount: playerReports.length,
            gamesAnalyzed: playerGames.length,
            averageViolationScore: avgScore,
            totalViolationScore: totalScore,
            recommendation: 'none',
            timestamp: Date.now()
        };

        if (avgScore >= this.thresholds.permanentBanThreshold) {
            investigation.recommendation = 'permanent_ban';
        } else if (avgScore >= this.thresholds.tempBanThreshold) {
            investigation.recommendation = 'temp_ban';
        } else if (avgScore >= this.thresholds.warningThreshold) {
            investigation.recommendation = 'warning';
        } else if (playerReports.length >= 5) {
            investigation.recommendation = 'monitor';
        }

        // ذخیره در لیست مشکوک‌ها
        this.suspiciousPlayers.set(playerId, {
            ...investigation,
            lastInvestigatedAt: Date.now()
        });

        this.stats.activeSuspiciousPlayers = this.suspiciousPlayers.size;

        this._emit('player-investigated', { investigation });

        if (this.debug) {
            console.log(`🔍 Player investigated: ${playerId}, recommendation: ${investigation.recommendation}`);
        }

        return {
            success: true,
            investigation
        };
    }

    // ============================================================
    // بخش ۷: اقدامات تنبیهی
    // ============================================================

    /**
     * اعمال توصیه‌ها
     * @param {Object} analysis - تحلیل
     * @param {Object} gameData - داده بازی
     * @private
     */
    _applyRecommendations(analysis, gameData) {
        analysis.recommendations.forEach(recommendation => {
            switch (recommendation) {
                case 'permanent_ban':
                    this._issuePermanentBan(analysis, gameData);
                    break;
                case 'temp_ban':
                    this._issueTempBan(analysis, gameData);
                    break;
                case 'warning':
                    this._issueWarning(analysis, gameData);
                    break;
                case 'investigation':
                    this._startInvestigation(analysis, gameData);
                    break;
                case 'monitor':
                    this._startMonitoring(analysis, gameData);
                    break;
            }
        });
    }

    /**
     * صدور ban دائمی
     * @private
     */
    _issuePermanentBan(analysis, gameData) {
        const playerId = this._getPrimaryViolator(analysis);
        if (!playerId) return;

        const ban = {
            playerId,
            type: 'permanent',
            reason: analysis.violations.map(v => v.ruleId).join(', '),
            evidence: analysis.violations,
            issuedAt: Date.now(),
            expiresAt: null,
            issuedBy: 'anti-cheat-system',
            appealable: true
        };

        this.bannedPlayers.set(playerId, ban);
        this.stats.totalBansIssued++;
        this.stats.activeBannedPlayers = this.bannedPlayers.size;

        this._emit('player-banned', { ban, analysis });

        if (this.debug) {
            console.log(`🚫 Player permanently banned: ${playerId}`);
        }
    }

    /**
     * صدور ban موقت
     * @private
     */
    _issueTempBan(analysis, gameData) {
        const playerId = this._getPrimaryViolator(analysis);
        if (!playerId) return;

        const banDuration = this._calculateBanDuration(analysis.score);

        const ban = {
            playerId,
            type: 'temporary',
            reason: analysis.violations.map(v => v.ruleId).join(', '),
            evidence: analysis.violations,
            issuedAt: Date.now(),
            expiresAt: Date.now() + banDuration,
            issuedBy: 'anti-cheat-system',
            appealable: true
        };

        this.bannedPlayers.set(playerId, ban);
        this.stats.totalBansIssued++;
        this.stats.activeBannedPlayers = this.bannedPlayers.size;

        this._emit('player-temp-banned', { ban, analysis });

        if (this.debug) {
            console.log(`⏸️ Player temporarily banned: ${playerId} for ${banDuration / 3600000} hours`);
        }
    }

    /**
     * صدور اخطار
     * @private
     */
    _issueWarning(analysis, gameData) {
        const playerId = this._getPrimaryViolator(analysis);
        if (!playerId) return;

        const warning = {
            id: Utils.generateUUID(),
            playerId,
            reason: analysis.violations.map(v => v.ruleId).join(', '),
            evidence: analysis.violations,
            issuedAt: Date.now(),
            expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 روز
        };

        this.activeWarnings.push(warning);
        this.stats.totalWarningsIssued++;

        this._emit('player-warned', { warning, analysis });

        if (this.debug) {
            console.log(`⚠️ Player warned: ${playerId}`);
        }
    }

    /**
     * شروع بررسی
     * @private
     */
    _startInvestigation(analysis, gameData) {
        const playerId = this._getPrimaryViolator(analysis);
        if (!playerId) return;

        this._investigatePlayer(playerId);
    }

    /**
     * شروع نظارت
     * @private
     */
    _startMonitoring(analysis, gameData) {
        const playerId = this._getPrimaryViolator(analysis);
        if (!playerId) return;

        this.suspiciousPlayers.set(playerId, {
            playerId,
            monitoringStartedAt: Date.now(),
            reason: analysis.violations.map(v => v.ruleId).join(', '),
            level: 'enhanced'
        });

        this._emit('player-monitored', { playerId, analysis });
    }

    /**
     * محاسبه مدت ban
     * @param {number} score - امتیاز تقلب
     * @returns {number} میلی‌ثانیه
     * @private
     */
    _calculateBanDuration(score) {
        if (score >= 90) return 30 * 24 * 60 * 60 * 1000; // 30 روز
        if (score >= 80) return 14 * 24 * 60 * 60 * 1000; // 14 روز
        if (score >= 75) return 7 * 24 * 60 * 60 * 1000; // 7 روز
        if (score >= 70) return 3 * 24 * 60 * 60 * 1000; // 3 روز
        return 24 * 60 * 60 * 1000; // 1 روز
    }

    /**
     * دریافت اصلی‌ترین متخلف
     * @param {Object} analysis - تحلیل
     * @returns {string|null}
     * @private
     */
    _getPrimaryViolator(analysis) {
        if (analysis.violations.length === 0) return null;

        const violationCounts = {};
        analysis.violations.forEach(v => {
            violationCounts[v.playerId] = (violationCounts[v.playerId] || 0) + 1;
        });

        return Object.keys(violationCounts).reduce((a, b) =>
            violationCounts[a] > violationCounts[b] ? a : b
        );
    }

    // ============================================================
    // بخش ۸: بررسی بازیکنان مسدود
    // ============================================================

    /**
     * بررسی بازیکنان مسدود شده
     * @private
     */
    _checkBannedPlayers() {
        const now = Date.now();

        this.bannedPlayers.forEach((ban, playerId) => {
            if (ban.type === 'temporary' && ban.expiresAt && now > ban.expiresAt) {
                // ban منقضی شده
                this.bannedPlayers.delete(playerId);
                this.stats.activeBannedPlayers = this.bannedPlayers.size;

                this._emit('ban-expired', { playerId, ban });

                if (this.debug) {
                    console.log(`✅ Ban expired for player: ${playerId}`);
                }
            }
        });
    }

    /**
     * بررسی آیا بازیکن مسدود است
     * @param {string} playerId - شناسه بازیکن
     * @returns {Object}
     */
    isPlayerBanned(playerId) {
        const ban = this.bannedPlayers.get(playerId);
        if (!ban) {
            return { banned: false };
        }

        if (ban.type === 'temporary' && ban.expiresAt && Date.now() > ban.expiresAt) {
            this.bannedPlayers.delete(playerId);
            return { banned: false };
        }

        return {
            banned: true,
            ban,
            remainingTime: ban.type === 'temporary' ? ban.expiresAt - Date.now() : null
        };
    }

    /**
     * دریافت لیست بازیکنان مسدود
     * @returns {Array<Object>}
     */
    getBannedPlayers() {
        return Array.from(this.bannedPlayers.values());
    }

    /**
     * دریافت لیست بازیکنان مشکوک
     * @returns {Array<Object>}
     */
    getSuspiciousPlayers() {
        return Array.from(this.suspiciousPlayers.values());
    }

    /**
     * دریافت لیست اخطارها
     * @returns {Array<Object>}
     */
    getActiveWarnings() {
        return [...this.activeWarnings];
    }

    // ============================================================
    // بخش ۹: مدیریت گزارش‌ها
    // ============================================================

    /**
     * دریافت گزارش‌ها
     * @param {Object} options - گزینه‌ها
     * @returns {Array<Object>}
     */
    getReports(options = {}) {
        const {
            status = null,
            playerId = null,
            limit = 50,
            offset = 0
        } = options;

        let reports = [...this.reports];

        if (status) {
            reports = reports.filter(r => r.status === status);
        }

        if (playerId) {
            reports = reports.filter(r =>
                r.reportedPlayerId === playerId || r.reporterId === playerId
            );
        }

        reports.sort((a, b) => b.timestamp - a.timestamp);

        return reports.slice(offset, offset + limit);
    }

    /**
     * به‌روزرسانی وضعیت گزارش
     * @param {string} reportId - شناسه گزارش
     * @param {string} status - وضعیت جدید
     * @param {string} action - اقدام انجام شده
     * @returns {Object} نتیجه
     */
    updateReportStatus(reportId, status, action = null) {
        const report = this.reports.find(r => r.id === reportId);
        if (!report) {
            return {
                success: false,
                error: 'REPORT_NOT_FOUND',
                message: 'گزارش یافت نشد'
            };
        }

        report.status = status;
        report.actionTaken = action;
        report.validatedAt = Date.now();

        if (status === 'validated') {
            this.stats.totalReportsValidated++;
        } else if (status === 'dismissed') {
            this.stats.totalReportsDismissed++;
        }

        this._emit('report-status-updated', { report });

        return {
            success: true,
            report
        };
    }

    // ============================================================
    // بخش ۱۰: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            rulesCount: this.rules.length,
            activeRulesCount: this.rules.filter(r => r.enabled).length,
            suspiciousPlayersCount: this.suspiciousPlayers.size,
            bannedPlayersCount: this.bannedPlayers.size,
            activeWarningsCount: this.activeWarnings.length,
            reportsCount: this.reports.length,
            pendingReportsCount: this.reports.filter(r => r.status === 'pending').length
        };
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        return {
            status: this.status,
            totalGamesAnalyzed: this.stats.totalGamesAnalyzed,
            cheatsDetected: this.stats.totalCheatsDetected,
            bansIssued: this.stats.totalBansIssued,
            detectionRate: this.stats.totalGamesAnalyzed > 0 ?
                (this.stats.totalCheatsDetected / this.stats.totalGamesAnalyzed * 100).toFixed(2) + '%' : '0%',
            activeBans: this.bannedPlayers.size,
            activeWarnings: this.activeWarnings.length
        };
    }

    /**
     * دریافت تاریخچه تحلیل‌ها
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getAnalysisHistory(limit = 50) {
        return this.analysisHistory.slice(-limit).reverse();
    }

    // ============================================================
    // بخش ۱۱: کنترل سیستم
    // ============================================================

    /**
     * تغییر وضعیت سیستم
     * @param {string} status - وضعیت جدید
     * @returns {Object} نتیجه
     */
    setSystemStatus(status) {
        const validStatuses = ['active', 'passive', 'disabled'];
        if (!validStatuses.includes(status)) {
            return {
                success: false,
                error: 'INVALID_STATUS',
                message: 'وضعیت نامعتبر است'
            };
        }

        const oldStatus = this.status;
        this.status = status;

        this._emit('system-status-changed', { oldStatus, newStatus: status });

        if (this.debug) {
            console.log(`🛡️ Anti-cheat system status changed: ${oldStatus} → ${status}`);
        }

        return {
            success: true,
            oldStatus,
            newStatus: status
        };
    }

    /**
     * فعال/غیرفعال کردن یک قانون
     * @param {string} ruleId - شناسه قانون
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setRuleEnabled(ruleId, enabled) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (!rule) {
            return {
                success: false,
                error: 'RULE_NOT_FOUND',
                message: 'قانون یافت نشد'
            };
        }

        rule.enabled = enabled;

        this._emit('rule-toggled', { rule });

        return {
            success: true,
            rule
        };
    }

    /**
     * به‌روزرسانی آستانه‌ها
     * @param {Object} newThresholds - آستانه‌های جدید
     * @returns {Object} نتیجه
     */
    updateThresholds(newThresholds) {
        this.thresholds = {
            ...this.thresholds,
            ...newThresholds
        };

        this._emit('thresholds-updated', { thresholds: this.thresholds });

        return {
            success: true,
            thresholds: this.thresholds
        };
    }

    // ============================================================
    // بخش ۱۲: ذخیره و بارگذاری
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('anticheat_bans', Array.from(this.bannedPlayers.entries()));
            storage.set('anticheat_suspicious', Array.from(this.suspiciousPlayers.entries()));
            storage.set('anticheat_warnings', this.activeWarnings);
            storage.set('anticheat_reports', this.reports);
            storage.set('anticheat_stats', this.stats);
            storage.set('anticheat_fingerprints', Array.from(this.deviceFingerprints.entries()));
            storage.set('anticheat_rules', this.rules);
            storage.set('anticheat_thresholds', this.thresholds);
            storage.set('anticheat_status', this.status);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const bans = storage.get('anticheat_bans');
            if (bans) this.bannedPlayers = new Map(bans);

            const suspicious = storage.get('anticheat_suspicious');
            if (suspicious) this.suspiciousPlayers = new Map(suspicious);

            const warnings = storage.get('anticheat_warnings');
            if (warnings) this.activeWarnings = warnings;

            const reports = storage.get('anticheat_reports');
            if (reports) this.reports = reports;

            const stats = storage.get('anticheat_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            const fingerprints = storage.get('anticheat_fingerprints');
            if (fingerprints) this.deviceFingerprints = new Map(fingerprints);

            const rules = storage.get('anticheat_rules');
            if (rules) this.rules = rules;

            const thresholds = storage.get('anticheat_thresholds');
            if (thresholds) this.thresholds = { ...this.thresholds, ...thresholds };

            const status = storage.get('anticheat_status');
            if (status) this.status = status;
        }
    }

    // ============================================================
    // بخش ۱۳: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    reset() {
        this.activeWarnings = [];
        this.suspiciousPlayers.clear();
        this.bannedPlayers.clear();
        this.reports = [];
        this.deviceFingerprints.clear();
        this.analysisHistory = [];

        this.stats = {
            totalGamesAnalyzed: 0,
            totalCheatsDetected: 0,
            totalWarningsIssued: 0,
            totalBansIssued: 0,
            totalReportsReceived: 0,
            totalReportsValidated: 0,
            totalReportsDismissed: 0,
            falsePositiveRate: 0,
            detectionAccuracy: 0,
            lastAnalysisAt: null,
            activeSuspiciousPlayers: 0,
            activeBannedPlayers: 0
        };

        this.status = 'active';
        this.rules = this._defineRules();

        this._saveData();

        if (this.debug) {
            console.log('🔄 AntiCheatSystem reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('️ AntiCheatSystem Status:');
        console.log('  System Status:', summary.status);
        console.log('  Games Analyzed:', summary.totalGamesAnalyzed);
        console.log('  Cheats Detected:', summary.cheatsDetected);
        console.log('  Detection Rate:', summary.detectionRate);
        console.log('  Active Bans:', summary.activeBans);
        console.log('  Active Warnings:', summary.activeWarnings);
        console.log('  Suspicious Players:', stats.suspiciousPlayersCount);
        console.log('  Pending Reports:', stats.pendingReportsCount);
        console.log('  Active Rules:', stats.activeRulesCount, '/', stats.rulesCount);
    }

    // ============================================================
    // بخش ۴: Event System
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
                    console.error(`❌ AntiCheat event listener error:`, error);
                }
            });
        }

        eventBus.emit(`anticheat:${event}`, data);
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
const antiCheatSystem = new AntiCheatSystem();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AntiCheatSystem, antiCheatSystem };
} else {
    window.AntiCheatSystem = AntiCheatSystem;
    window.antiCheatSystem = antiCheatSystem;
}

console.log('✅ AntiCheatSystem loaded - 15 rules defined');
