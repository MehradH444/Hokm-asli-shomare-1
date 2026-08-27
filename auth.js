/**
 * ============================================================
 * HOKM MASTER - Authentication Manager
 * سیستم مدیریت احراز هویت
 * ============================================================
 * 
 * این فایل مسئول مدیریت تمام عملیات احراز هویت کاربران است
 * شامل ورود با موبایل، OTP، مهمان، ثبت‌نام، بازیابی حساب،
 * مدیریت session و token.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - storage (از فایل storage.js)
 * - eventBus, EVENTS (از فایل events.js)
 * 
 * ============================================================
 */

class AuthManager {

    constructor() {
        /**
         * کاربر فعلی
         * @type {Object|null}
         */
        this.currentUser = null;

        /**
         * session فعلی
         * @type {Object|null}
         */
        this.session = null;

        /**
         * OTP موقت برای تأیید
         * @type {Object|null}
         */
        this.tempOTP = null;

        /**
         * آیا در حال بارگذاری است
         * @type {boolean}
         */
        this.isLoading = false;

        /**
         * تعداد تلاش‌های ناموفق ورود
         * @type {number}
         */
        this.failedAttempts = 0;

        /**
         * زمان قفل شدن حساب
         * @type {number|null}
         */
        this.lockoutUntil = null;

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

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بررسی session موجود
        this._checkExistingSession();

        // بررسی انقضای OTP
        this._checkOTPExpiry();

        if (this.debug) {
            console.log('🔐 AuthManager initialized');
            console.log('  Current user:', this.currentUser ? '✅' : '❌');
            console.log('  Session:', this.session ? '✅' : '❌');
        }
    }

    // ============================================================
    // بخش ۱: بررسی وضعیت
    // ============================================================

    /**
     * بررسی session موجود
     * @private
     */
    _checkExistingSession() {
        try {
            const user = storage.getUserProfile();
            const sessionData = storage.get(CONFIG.STORAGE_KEYS.SESSION);

            if (user && sessionData) {
                // بررسی انقضای session
                if (sessionData.expiry && Date.now() > sessionData.expiry) {
                    this._clearSession();
                    eventBus.emit(EVENTS.AUTH.SESSION_EXPIRED);
                    return;
                }

                this.currentUser = user;
                this.session = sessionData;

                if (this.debug) {
                    console.log('✅ Existing session restored');
                }
            }
        } catch (error) {
            console.error('❌ Failed to check existing session:', error);
        }
    }

    /**
     * بررسی انقضای OTP
     * @private
     */
    _checkOTPExpiry() {
        const tempOTP = storage.get(CONFIG.STORAGE_KEYS.TEMP_OTP);

        if (tempOTP && tempOTP.expiry && Date.now() > tempOTP.expiry) {
            storage.remove(CONFIG.STORAGE_KEYS.TEMP_OTP);
            this.tempOTP = null;

            if (this.debug) {
                console.log('🗑️ Expired OTP cleared');
            }
        } else if (tempOTP) {
            this.tempOTP = tempOTP;
        }
    }

    /**
     * آیا کاربر لاگین است
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.currentUser !== null && this.session !== null;
    }

    /**
     * آیا کاربر مهمان است
     * @returns {boolean}
     */
    isGuest() {
        return this.currentUser?.isGuest === true;
    }

    /**
     * دریافت کاربر فعلی
     * @returns {Object|null}
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * دریافت session فعلی
     * @returns {Object|null}
     */
    getSession() {
        return this.session;
    }

    /**
     * دریافت token
     * @returns {string|null}
     */
    getToken() {
        return this.session?.token || null;
    }

    /**
     * بررسی قفل بودن حساب
     * @returns {boolean}
     */
    isLocked() {
        if (!this.lockoutUntil) return false;
        return Date.now() < this.lockoutUntil;
    }

    /**
     * دریافت زمان باقی‌مانده تا رفع قفل
     * @returns {number} میلی‌ثانیه
     */
    getLockoutRemaining() {
        if (!this.lockoutUntil) return 0;
        return Math.max(0, this.lockoutUntil - Date.now());
    }

    // ============================================================
    // بخش ۲: ورود با موبایل
    // ============================================================

    /**
     * شروع فرآیند ورود با موبایل
     * @param {string} phone - شماره موبایل
     * @returns {Promise<Object>} نتیجه
     */
    async loginWithPhone(phone) {
        if (this.isLoading) {
            return {
                success: false,
                error: 'REQUEST_IN_PROGRESS',
                message: 'لطفاً صبر کنید، درخواست قبلی در حال پردازش است'
            };
        }

        // بررسی قفل بودن
        if (this.isLocked()) {
            const remaining = this.getLockoutRemaining();
            return {
                success: false,
                error: 'ACCOUNT_LOCKED',
                message: `حساب شما قفل شده است. ${Utils.formatDuration(Math.ceil(remaining / 1000))} صبر کنید`,
                lockoutRemaining: remaining
            };
        }

        // اعتبارسنجی شماره
        if (!Utils.validatePhone(phone)) {
            return {
                success: false,
                error: 'INVALID_PHONE',
                message: 'شماره موبایل معتبر نیست'
            };
        }

        this.isLoading = true;

        try {
            eventBus.emit(EVENTS.AUTH.LOGIN_STARTED, { phone });

            // تولید OTP
            const otp = this._generateOTP();

            // ذخیره OTP موقت
            this.tempOTP = {
                phone: phone,
                otp: otp,
                attempts: 0,
                createdAt: Date.now(),
                expiry: Date.now() + CONFIG.AUTH.OTP.EXPIRY_MS
            };

            storage.set(CONFIG.STORAGE_KEYS.TEMP_OTP, this.tempOTP, {
                encrypt: true
            });

            // شبیه‌سازی ارسال SMS (در production از API استفاده می‌شود)
            await this._sendOTP(phone, otp);

            eventBus.emit(EVENTS.AUTH.OTP_SENT, {
                phone: phone,
                expiry: this.tempOTP.expiry
            });

            if (this.debug) {
                console.log('📱 OTP sent:', otp);
            }

            return {
                success: true,
                phone: phone,
                otp: otp, // فقط برای debug
                expiry: this.tempOTP.expiry
            };

        } catch (error) {
            console.error('❌ Login with phone failed:', error);
            
            eventBus.emit(EVENTS.AUTH.LOGIN_FAILED, {
                phone: phone,
                error: error.message
            });

            return {
                success: false,
                error: 'SEND_FAILED',
                message: 'خطا در ارسال کد تأیید. لطفاً دوباره تلاش کنید'
            };

        } finally {
            this.isLoading = false;
        }
    }

    /**
     * ارسال OTP (شبیه‌سازی)
     * @param {string} phone - شماره موبایل
     * @param {string} otp - کد OTP
     * @returns {Promise<void>}
     * @private
     */
    async _sendOTP(phone, otp) {
        // در production اینجا API call می‌شود
        // مثلاً: await api.sendOTP(phone, otp);
        
        return new Promise(resolve => {
            setTimeout(resolve, 500); // شبیه‌سازی تاخیر شبکه
        });
    }

    /**
     * تولید OTP تصادفی
     * @returns {string}
     * @private
     */
    _generateOTP() {
        const length = CONFIG.AUTH.OTP.LENGTH;
        let otp = '';
        
        for (let i = 0; i < length; i++) {
            otp += Math.floor(Math.random() * 10).toString();
        }
        
        return otp;
    }

    /**
     * تأیید OTP
     * @param {string} phone - شماره موبایل
     * @param {string} otp - کد وارد شده
     * @returns {Promise<Object>} نتیجه
     */
    async verifyOTP(phone, otp) {
        if (this.isLoading) {
            return {
                success: false,
                error: 'REQUEST_IN_PROGRESS',
                message: 'لطفاً صبر کنید'
            };
        }

        // بررسی وجود OTP موقت
        if (!this.tempOTP) {
            return {
                success: false,
                error: 'OTP_NOT_FOUND',
                message: 'کد تأیید یافت نشد. لطفاً دوباره درخواست دهید'
            };
        }

        // بررسی تطابق شماره
        if (this.tempOTP.phone !== phone) {
            return {
                success: false,
                error: 'PHONE_MISMATCH',
                message: 'شماره موبایل مطابقت ندارد'
            };
        }

        // بررسی انقضا
        if (Date.now() > this.tempOTP.expiry) {
            this._clearTempOTP();
            return {
                success: false,
                error: 'OTP_EXPIRED',
                message: 'کد تأیید منقضی شده است'
            };
        }

        // بررسی تعداد تلاش
        if (this.tempOTP.attempts >= CONFIG.AUTH.OTP.MAX_ATTEMPTS) {
            this._lockAccount();
            return {
                success: false,
                error: 'MAX_ATTEMPTS_EXCEEDED',
                message: 'تعداد تلاش‌های ناموفق به حد مجاز رسید. حساب قفل شد'
            };
        }

        this.isLoading = true;

        try {
            // تبدیل اعداد فارسی به انگلیسی
            const normalizedOTP = Utils.toEnglishNumber(otp).trim();

            // بررسی صحت کد
            if (normalizedOTP !== this.tempOTP.otp) {
                this.tempOTP.attempts++;
                this.failedAttempts++;

                const remainingAttempts = CONFIG.AUTH.OTP.MAX_ATTEMPTS - this.tempOTP.attempts;

                eventBus.emit(EVENTS.AUTH.OTP_FAILED, {
                    phone: phone,
                    attempts: this.tempOTP.attempts,
                    remainingAttempts: remainingAttempts
                });

                return {
                    success: false,
                    error: 'INVALID_OTP',
                    message: `کد وارد شده صحیح نیست. ${Utils.toPersianNumber(remainingAttempts)} تلاش باقی مانده`,
                    remainingAttempts: remainingAttempts
                };
            }

            // OTP صحیح است
            eventBus.emit(EVENTS.AUTH.OTP_VERIFIED, { phone });

            // دریافت یا ایجاد کاربر
            const user = await this._getOrCreateUser(phone);

            // ایجاد session
            const session = this._createSession(user);

            // ذخیره داده‌ها
            this.currentUser = user;
            this.session = session;

            storage.saveUserProfile(user);
            storage.set(CONFIG.STORAGE_KEYS.SESSION, session, {
                encrypt: true
            });
            storage.set(CONFIG.STORAGE_KEYS.TOKEN, session.token, {
                encrypt: true
            });

            // پاک کردن OTP موقت
            this._clearTempOTP();

            // ریست تلاش‌های ناموفق
            this.failedAttempts = 0;

            eventBus.emit(EVENTS.AUTH.LOGIN_SUCCESS, {
                user: user,
                session: session,
                isFirstLogin: user.isFirstLogin
            });

            if (this.debug) {
                console.log('✅ Login successful:', user.username);
            }

            return {
                success: true,
                user: user,
                session: session
            };

        } catch (error) {
            console.error('❌ OTP verification failed:', error);

            eventBus.emit(EVENTS.AUTH.LOGIN_FAILED, {
                phone: phone,
                error: error.message
            });

            return {
                success: false,
                error: 'VERIFICATION_FAILED',
                message: 'خطا در تأیید کد. لطفاً دوباره تلاش کنید'
            };

        } finally {
            this.isLoading = false;
        }
    }

    /**
     * دریافت یا ایجاد کاربر
     * @param {string} phone - شماره موبایل
     * @returns {Promise<Object>} کاربر
     * @private
     */
    async _getOrCreateUser(phone) {
        // بررسی کاربر موجود
        const existingUsers = storage.get('hokm_users_registry', {
            defaultValue: {}
        });

        const userId = existingUsers[phone];

        if (userId) {
            // کاربر موجود را بارگذاری کن
            const user = storage.get(`hokm_user_${userId}`);
            
            if (user) {
                user.lastLogin = Date.now();
                user.isFirstLogin = false;
                storage.set(`hokm_user_${userId}`, user);
                return user;
            }
        }

        // ایجاد کاربر جدید
        const user = this._createNewUser(phone);

        // ثبت در registry
        existingUsers[phone] = user.id;
        storage.set('hokm_users_registry', existingUsers);

        // ذخیره کاربر
        storage.set(`hokm_user_${user.id}`, user);

        user.isFirstLogin = true;

        return user;
    }

    /**
     * ایجاد کاربر جدید
     * @param {string} phone - شماره موبایل
     * @returns {Object} کاربر جدید
     * @private
     */
    _createNewUser(phone) {
        const userId = Utils.generateUUID();
        const username = this._generateUsername();

        return {
            id: userId,
            phone: phone,
            username: username,
            email: null,
            isGuest: false,
            isFirstLogin: true,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            profile: {
                avatar: CONFIG.CUSTOMIZATION.AVATARS.DEFAULT_ID,
                frame: CONFIG.CUSTOMIZATION.FRAMES.DEFAULT_ID,
                title: CONFIG.CUSTOMIZATION.TITLES.DEFAULT_ID,
                cardBack: CONFIG.CUSTOMIZATION.CARD_BACKS.DEFAULT_ID,
                table: CONFIG.CUSTOMIZATION.TABLES.DEFAULT_ID,
                level: 1,
                xp: 0,
                xpToNextLevel: 100,
                coins: CONFIG.CURRENCY.COINS.INITIAL_AMOUNT,
                gems: CONFIG.CURRENCY.GEMS.INITIAL_AMOUNT,
                tickets: CONFIG.CURRENCY.TICKETS.INITIAL_AMOUNT,
                eventTokens: CONFIG.CURRENCY.EVENT_TOKENS.INITIAL_AMOUNT,
                rating: CONFIG.LEAGUE.DEFAULT_RATING,
                league: {
                    tier: CONFIG.LEAGUE.DEFAULT_TIER,
                    season: 1,
                    progress: 0
                },
                vip: {
                    active: false,
                    expiry: null,
                    plan: null
                },
                stats: {
                    totalGames: 0,
                    wins: 0,
                    losses: 0,
                    winRate: 0,
                    tricksWon: 0,
                    kotCount: 0,
                    bestStreak: 0,
                    currentStreak: 0,
                    totalPlayTime: 0,
                    averageGameDuration: 0,
                    coinsEarned: 0,
                    coinsSpent: 0,
                    xpEarned: 0,
                    missionsCompleted: 0,
                    achievementsUnlocked: 0,
                    tournamentsWon: 0,
                    friendsAdded: 0
                },
                settings: {
                    sound: true,
                    music: true,
                    vibration: true,
                    notifications: true,
                    language: CONFIG.LANGUAGE.DEFAULT,
                    theme: 'dark',
                    graphics: 'medium',
                    animations: true
                }
            },
            inventory: {
                avatars: [CONFIG.CUSTOMIZATION.AVATARS.DEFAULT_ID],
                frames: [CONFIG.CUSTOMIZATION.FRAMES.DEFAULT_ID],
                cardBacks: [CONFIG.CUSTOMIZATION.CARD_BACKS.DEFAULT_ID],
                tables: [CONFIG.CUSTOMIZATION.TABLES.DEFAULT_ID],
                titles: [CONFIG.CUSTOMIZATION.TITLES.DEFAULT_ID],
                emotes: [],
                effects: []
            },
            equipment: {
                avatar: CONFIG.CUSTOMIZATION.AVATARS.DEFAULT_ID,
                frame: CONFIG.CUSTOMIZATION.FRAMES.DEFAULT_ID,
                cardBack: CONFIG.CUSTOMIZATION.CARD_BACKS.DEFAULT_ID,
                table: CONFIG.CUSTOMIZATION.TABLES.DEFAULT_ID,
                title: CONFIG.CUSTOMIZATION.TITLES.DEFAULT_ID,
                emote: null,
                effect: null
            },
            missions: {
                daily: [],
                weekly: [],
                monthly: [],
                lastDailyReset: null,
                lastWeeklyReset: null,
                lastMonthlyReset: null
            },
            achievements: {
                unlocked: [],
                progress: {}
            },
            dailyReward: {
                currentDay: 1,
                lastClaimed: null,
                streak: 0,
                cycle: 1
            },
            tutorial: {
                completed: false,
                currentStep: 0,
                watchedSteps: []
            }
        };
    }

    /**
     * تولید نام کاربری تصادفی
     * @returns {string}
     * @private
     */
    _generateUsername() {
        const prefix = 'Player';
        const number = Math.floor(10000 + Math.random() * 90000);
        return `${prefix}${number}`;
    }

    /**
     * ایجاد session
     * @param {Object} user - کاربر
     * @returns {Object} session
     * @private
     */
    _createSession(user) {
        const token = CONFIG.AUTH.SESSION.TOKEN_PREFIX + Utils.generateUUID();
        const expiry = Date.now() + CONFIG.AUTH.SESSION.EXPIRY_MS;

        return {
            token: token,
            userId: user.id,
            phone: user.phone,
            username: user.username,
            createdAt: Date.now(),
            expiry: expiry,
            device: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height
            },
            ip: null, // در production از سرور دریافت می‌شود
            lastActivity: Date.now()
        };
    }

    // ============================================================
    // بخش ۳: ورود مهمان
    // ============================================================

    /**
     * ورود به عنوان مهمان
     * @returns {Promise<Object>} نتیجه
     */
    async loginAsGuest() {
        if (this.isLoading) {
            return {
                success: false,
                error: 'REQUEST_IN_PROGRESS',
                message: 'لطفاً صبر کنید'
            };
        }

        this.isLoading = true;

        try {
            eventBus.emit(EVENTS.AUTH.LOGIN_STARTED, { guest: true });

            const user = this._createGuestUser();
            const session = this._createSession(user);

            this.currentUser = user;
            this.session = session;

            storage.saveUserProfile(user);
            storage.set(CONFIG.STORAGE_KEYS.SESSION, session, {
                encrypt: true
            });

            eventBus.emit(EVENTS.AUTH.GUEST_LOGIN, {
                user: user,
                session: session
            });

            if (this.debug) {
                console.log('👤 Guest login successful:', user.username);
            }

            return {
                success: true,
                user: user,
                session: session
            };

        } catch (error) {
            console.error('❌ Guest login failed:', error);

            eventBus.emit(EVENTS.AUTH.LOGIN_FAILED, {
                error: error.message
            });

            return {
                success: false,
                error: 'GUEST_LOGIN_FAILED',
                message: 'خطا در ورود به عنوان مهمان'
            };

        } finally {
            this.isLoading = false;
        }
    }

    /**
     * ایجاد کاربر مهمان
     * @returns {Object} کاربر مهمان
     * @private
     */
    _createGuestUser() {
        const userId = CONFIG.AUTH.GUEST.PREFIX + Utils.generateUUID();
        const username = `Guest${Math.floor(1000 + Math.random() * 9000)}`;

        return {
            id: userId,
            phone: null,
            username: username,
            email: null,
            isGuest: true,
            isFirstLogin: true,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            guestExpiry: Date.now() + CONFIG.AUTH.GUEST.EXPIRY_MS,
            gamesPlayed: 0,
            maxGames: CONFIG.AUTH.GUEST.MAX_GUEST_GAMES,
            profile: {
                avatar: CONFIG.CUSTOMIZATION.AVATARS.DEFAULT_ID,
                frame: CONFIG.CUSTOMIZATION.FRAMES.DEFAULT_ID,
                title: CONFIG.CUSTOMIZATION.TITLES.DEFAULT_ID,
                cardBack: CONFIG.CUSTOMIZATION.CARD_BACKS.DEFAULT_ID,
                table: CONFIG.CUSTOMIZATION.TABLES.DEFAULT_ID,
                level: 1,
                xp: 0,
                xpToNextLevel: 100,
                coins: CONFIG.CURRENCY.COINS.INITIAL_AMOUNT,
                gems: CONFIG.CURRENCY.GEMS.INITIAL_AMOUNT,
                tickets: 0,
                eventTokens: 0,
                rating: CONFIG.LEAGUE.DEFAULT_RATING,
                league: {
                    tier: CONFIG.LEAGUE.DEFAULT_TIER,
                    season: 1,
                    progress: 0
                },
                vip: {
                    active: false,
                    expiry: null,
                    plan: null
                },
                stats: {
                    totalGames: 0,
                    wins: 0,
                    losses: 0,
                    winRate: 0,
                    tricksWon: 0,
                    kotCount: 0,
                    bestStreak: 0,
                    currentStreak: 0,
                    totalPlayTime: 0,
                    averageGameDuration: 0,
                    coinsEarned: 0,
                    coinsSpent: 0,
                    xpEarned: 0,
                    missionsCompleted: 0,
                    achievementsUnlocked: 0,
                    tournamentsWon: 0,
                    friendsAdded: 0
                },
                settings: {
                    sound: true,
                    music: true,
                    vibration: true,
                    notifications: true,
                    language: CONFIG.LANGUAGE.DEFAULT,
                    theme: 'dark',
                    graphics: 'medium',
                    animations: true
                }
            },
            inventory: {
                avatars: [CONFIG.CUSTOMIZATION.AVATARS.DEFAULT_ID],
                frames: [CONFIG.CUSTOMIZATION.FRAMES.DEFAULT_ID],
                cardBacks: [CONFIG.CUSTOMIZATION.CARD_BACKS.DEFAULT_ID],
                tables: [CONFIG.CUSTOMIZATION.TABLES.DEFAULT_ID],
                titles: [CONFIG.CUSTOMIZATION.TITLES.DEFAULT_ID],
                emotes: [],
                effects: []
            },
            equipment: {
                avatar: CONFIG.CUSTOMIZATION.AVATARS.DEFAULT_ID,
                frame: CONFIG.CUSTOMIZATION.FRAMES.DEFAULT_ID,
                cardBack: CONFIG.CUSTOMIZATION.CARD_BACKS.DEFAULT_ID,
                table: CONFIG.CUSTOMIZATION.TABLES.DEFAULT_ID,
                title: CONFIG.CUSTOMIZATION.TITLES.DEFAULT_ID,
                emote: null,
                effect: null
            }
        };
    }

    /**
     * بررسی محدودیت مهمان
     * @returns {Object} نتیجه بررسی
     */
    checkGuestLimits() {
        if (!this.isGuest()) {
            return {
                allowed: true,
                reason: null
            };
        }

        const user = this.currentUser;

        // بررسی انقضای حساب مهمان
        if (user.guestExpiry && Date.now() > user.guestExpiry) {
            return {
                allowed: false,
                reason: 'GUEST_EXPIRED',
                message: 'مهلت حساب مهمان شما به پایان رسیده است'
            };
        }

        // بررسی تعداد بازی
        if (user.gamesPlayed >= user.maxGames) {
            return {
                allowed: false,
                reason: 'MAX_GAMES_REACHED',
                message: `شما به حداکثر ${Utils.toPersianNumber(user.maxGames)} بازی مهمان رسیده‌اید`,
                conversionBonus: {
                    coins: CONFIG.AUTH.GUEST.CONVERSION_BONUS_COINS,
                    xp: CONFIG.AUTH.GUEST.CONVERSION_BONUS_XP
                }
            };
        }

        return {
            allowed: true,
            gamesRemaining: user.maxGames - user.gamesPlayed
        };
    }

    /**
     * تبدیل حساب مهمان به حساب دائمی
     * @param {string} phone - شماره موبایل
     * @returns {Promise<Object>} نتیجه
     */
    async convertGuestToPermanent(phone) {
        if (!this.isGuest()) {
            return {
                success: false,
                error: 'NOT_GUEST',
                message: 'حساب فعلی مهمان نیست'
            };
        }

        if (!Utils.validatePhone(phone)) {
            return {
                success: false,
                error: 'INVALID_PHONE',
                message: 'شماره موبایل معتبر نیست'
            };
        }

        this.isLoading = true;

        try {
            // شروع فرآیند OTP
            const otpResult = await this.loginWithPhone(phone);

            if (!otpResult.success) {
                return otpResult;
            }

            // ذخیره کاربر مهمان فعلی برای انتقال داده‌ها
            const guestData = this.currentUser;

            // ذخیره در حافظه موقت برای استفاده بعد از تأیید OTP
            storage.set(CONFIG.STORAGE_KEYS.TEMP, {
                type: 'guest_conversion',
                guestData: guestData,
                phone: phone
            }, {
                ttl: 600000 // 10 دقیقه
            });

            return {
                success: true,
                message: 'کد تأیید ارسال شد',
                phone: phone,
                otp: otpResult.otp
            };

        } catch (error) {
            console.error('❌ Guest conversion failed:', error);
            return {
                success: false,
                error: 'CONVERSION_FAILED',
                message: 'خطا در تبدیل حساب'
            };
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * تکمیل تبدیل حساب مهمان
     * @param {string} phone - شماره موبایل
     * @param {string} otp - کد OTP
     * @returns {Promise<Object>} نتیجه
     */
    async completeGuestConversion(phone, otp) {
        // تأیید OTP
        const verifyResult = await this.verifyOTP(phone, otp);

        if (!verifyResult.success) {
            return verifyResult;
        }

        // دریافت داده‌های مهمان
        const tempData = storage.get(CONFIG.STORAGE_KEYS.TEMP);

        if (!tempData || tempData.type !== 'guest_conversion') {
            return {
                success: false,
                error: 'GUEST_DATA_NOT_FOUND',
                message: 'داده‌های حساب مهمان یافت نشد'
            };
        }

        const guestData = tempData.guestData;
        const newUser = verifyResult.user;

        // انتقال داده‌ها از حساب مهمان به حساب جدید
        newUser.profile = {
            ...newUser.profile,
            coins: guestData.profile.coins + CONFIG.AUTH.GUEST.CONVERSION_BONUS_COINS,
            gems: guestData.profile.gems + CONFIG.AUTH.GUEST.CONVERSION_BONUS_XP,
            xp: guestData.profile.xp,
            level: guestData.profile.level,
            stats: guestData.profile.stats,
            inventory: guestData.inventory,
            equipment: guestData.equipment
        };

        // ذخیره کاربر به‌روز شده
        storage.saveUserProfile(newUser);

        // پاک کردن داده موقت
        storage.remove(CONFIG.STORAGE_KEYS.TEMP);

        // به‌روزرسانی currentUser
        this.currentUser = newUser;

        eventBus.emit(EVENTS.AUTH.LOGIN_SUCCESS, {
            user: newUser,
            converted: true,
            bonus: {
                coins: CONFIG.AUTH.GUEST.CONVERSION_BONUS_COINS,
                xp: CONFIG.AUTH.GUEST.CONVERSION_BONUS_XP
            }
        });

        return {
            success: true,
            user: newUser,
            bonus: {
                coins: CONFIG.AUTH.GUEST.CONVERSION_BONUS_COINS,
                xp: CONFIG.AUTH.GUEST.CONVERSION_BONUS_XP
            }
        };
    }

    // ============================================================
    // بخش ۴: ثبت‌نام
    // ============================================================

    /**
     * ثبت‌نام با ایمیل
     * @param {Object} data - داده‌های ثبت‌نام
     * @param {string} data.email - ایمیل
     * @param {string} data.username - نام کاربری
     * @param {string} data.password - رمز عبور
     * @returns {Promise<Object>} نتیجه
     */
    async register(data) {
        if (this.isLoading) {
            return {
                success: false,
                error: 'REQUEST_IN_PROGRESS',
                message: 'لطفاً صبر کنید'
            };
        }

        // اعتبارسنجی
        const validation = this._validateRegistration(data);
        if (!validation.valid) {
            return {
                success: false,
                error: 'VALIDATION_FAILED',
                message: validation.errors.join('، ')
            };
        }

        this.isLoading = true;

        try {
            eventBus.emit(EVENTS.AUTH.REGISTER_STARTED, {
                email: data.email,
                username: data.username
            });

            // بررسی تکراری بودن ایمیل و username
            const existingUsers = storage.get('hokm_users_registry', {
                defaultValue: { emails: {}, usernames: {} }
            });

            if (existingUsers.emails && existingUsers.emails[data.email]) {
                return {
                    success: false,
                    error: 'EMAIL_EXISTS',
                    message: 'این ایمیل قبلاً ثبت شده است'
                };
            }

            if (existingUsers.usernames && existingUsers.usernames[data.username]) {
                return {
                    success: false,
                    error: 'USERNAME_EXISTS',
                    message: 'این نام کاربری قبلاً گرفته شده است'
                };
            }

            // ایجاد کاربر جدید
            const user = this._createNewUser(null);
            user.email = data.email;
            user.username = data.username;
            user.passwordHash = this._hashPassword(data.password);

            // ثبت در registry
            existingUsers.emails = existingUsers.emails || {};
            existingUsers.usernames = existingUsers.usernames || {};
            existingUsers.emails[data.email] = user.id;
            existingUsers.usernames[data.username] = user.id;
            storage.set('hokm_users_registry', existingUsers);

            // ذخیره کاربر
            storage.set(`hokm_user_${user.id}`, user);

            // ایجاد session
            const session = this._createSession(user);

            this.currentUser = user;
            this.session = session;

            storage.saveUserProfile(user);
            storage.set(CONFIG.STORAGE_KEYS.SESSION, session, {
                encrypt: true
            });

            eventBus.emit(EVENTS.AUTH.REGISTER_SUCCESS, {
                user: user,
                session: session
            });

            return {
                success: true,
                user: user,
                session: session
            };

        } catch (error) {
            console.error('❌ Registration failed:', error);

            eventBus.emit(EVENTS.AUTH.REGISTER_FAILED, {
                error: error.message
            });

            return {
                success: false,
                error: 'REGISTRATION_FAILED',
                message: 'خطا در ثبت‌نام'
            };

        } finally {
            this.isLoading = false;
        }
    }

    /**
     * اعتبارسنجی داده‌های ثبت‌نام
     * @param {Object} data - داده‌ها
     * @returns {Object} نتیجه اعتبارسنجی
     * @private
     */
    _validateRegistration(data) {
        const errors = [];

        if (!data.email || !Utils.validateEmail(data.email)) {
            errors.push('ایمیل معتبر نیست');
        }

        if (!data.username || !Utils.validateUsername(data.username)) {
            errors.push('نام کاربری معتبر نیست (3-30 کاراکتر)');
        }

        if (!data.password) {
            errors.push('رمز عبور الزامی است');
        } else {
            const passwordValidation = Utils.validatePassword(data.password);
            if (!passwordValidation.valid) {
                errors.push(...passwordValidation.errors);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * هش کردن رمز عبور
     * @param {string} password - رمز عبور
     * @returns {string} هش
     * @private
     */
    _hashPassword(password) {
        // در production از bcrypt یا argon2 استفاده شود
        // این یک شبیه‌سازی ساده است
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'hash_' + Math.abs(hash).toString(16);
    }

    // ============================================================
    // بخش ۵: بازیابی حساب
    // ============================================================

    /**
     * درخواست بازیابی رمز عبور
     * @param {string} email - ایمیل
     * @returns {Promise<Object>} نتیجه
     */
    async requestPasswordRecovery(email) {
        if (!Utils.validateEmail(email)) {
            return {
                success: false,
                error: 'INVALID_EMAIL',
                message: 'ایمیل معتبر نیست'
            };
        }

        this.isLoading = true;

        try {
            // بررسی وجود ایمیل
            const existingUsers = storage.get('hokm_users_registry', {
                defaultValue: { emails: {} }
            });

            const userId = existingUsers.emails?.[email];

            if (!userId) {
                // برای امنیت، حتی اگر ایمیل وجود نداشته باشد پیام موفقیت نمایش می‌دهیم
                return {
                    success: true,
                    message: 'اگر ایمیل ثبت شده باشد، لینک بازیابی ارسال می‌شود'
                };
            }

            // تولید token بازیابی
            const recoveryToken = Utils.generateUUID();
            const expiry = Date.now() + 3600000; // 1 ساعت

            storage.set(`hokm_recovery_${recoveryToken}`, {
                userId: userId,
                email: email,
                expiry: expiry
            }, {
                ttl: 3600000
            });

            // در production اینجا ایمیل ارسال می‌شود
            // await api.sendRecoveryEmail(email, recoveryToken);

            return {
                success: true,
                message: 'لینک بازیابی به ایمیل شما ارسال شد',
                token: recoveryToken // فقط برای debug
            };

        } catch (error) {
            console.error('❌ Password recovery failed:', error);
            return {
                success: false,
                error: 'RECOVERY_FAILED',
                message: 'خطا در ارسال لینک بازیابی'
            };
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * تغییر رمز عبور با token بازیابی
     * @param {string} token - token بازیابی
     * @param {string} newPassword - رمز عبور جدید
     * @returns {Promise<Object>} نتیجه
     */
    async resetPassword(token, newPassword) {
        const recoveryData = storage.get(`hokm_recovery_${token}`);

        if (!recoveryData) {
            return {
                success: false,
                error: 'INVALID_TOKEN',
                message: 'لینک بازیابی نامعتبر است'
            };
        }

        if (Date.now() > recoveryData.expiry) {
            storage.remove(`hokm_recovery_${token}`);
            return {
                success: false,
                error: 'TOKEN_EXPIRED',
                message: 'لینک بازیابی منقضی شده است'
            };
        }

        // اعتبارسنجی رمز جدید
        const validation = Utils.validatePassword(newPassword);
        if (!validation.valid) {
            return {
                success: false,
                error: 'INVALID_PASSWORD',
                message: validation.errors.join('، ')
            };
        }

        // دریافت کاربر
        const user = storage.get(`hokm_user_${recoveryData.userId}`);
        if (!user) {
            return {
                success: false,
                error: 'USER_NOT_FOUND',
                message: 'کاربر یافت نشد'
            };
        }

        // به‌روزرسانی رمز
        user.passwordHash = this._hashPassword(newPassword);
        storage.set(`hokm_user_${recoveryData.userId}`, user);

        // پاک کردن token
        storage.remove(`hokm_recovery_${token}`);

        return {
            success: true,
            message: 'رمز عبور با موفقیت تغییر کرد'
        };
    }

    // ============================================================
    // بخش ۶: خروج
    // ============================================================

    /**
     * خروج از حساب
     * @param {boolean} clearData - آیا داده‌های محلی پاک شوند
     * @returns {Object} نتیجه
     */
    logout(clearData = false) {
        if (!this.isLoggedIn()) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'شما وارد نشده‌اید'
            };
        }

        const username = this.currentUser.username;

        eventBus.emit(EVENTS.AUTH.LOGOUT, {
            user: this.currentUser,
            session: this.session
        });

        this._clearSession();

        if (clearData) {
            storage.clear(true);
        }

        eventBus.emit(EVENTS.AUTH.LOGOUT_SUCCESS, {
            username: username
        });

        if (this.debug) {
            console.log('👋 Logged out:', username);
        }

        return {
            success: true,
            username: username
        };
    }

    /**
     * پاک کردن session
     * @private
     */
    _clearSession() {
        this.currentUser = null;
        this.session = null;

        storage.remove(CONFIG.STORAGE_KEYS.SESSION);
        storage.remove(CONFIG.STORAGE_KEYS.TOKEN);
    }

    /**
     * پاک کردن OTP موقت
     * @private
     */
    _clearTempOTP() {
        this.tempOTP = null;
        storage.remove(CONFIG.STORAGE_KEYS.TEMP_OTP);
    }

    // ============================================================
    // بخش : مدیریت حساب
    // ============================================================

    /**
     * تغییر نام کاربری
     * @param {string} newUsername - نام کاربری جدید
     * @returns {Object} نتیجه
     */
    changeUsername(newUsername) {
        if (!this.isLoggedIn()) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'شما وارد نشده‌اید'
            };
        }

        if (!Utils.validateUsername(newUsername)) {
            return {
                success: false,
                error: 'INVALID_USERNAME',
                message: 'نام کاربری معتبر نیست'
            };
        }

        // بررسی تکراری نبودن
        const existingUsers = storage.get('hokm_users_registry', {
            defaultValue: { usernames: {} }
        });

        if (existingUsers.usernames && existingUsers.usernames[newUsername]) {
            return {
                success: false,
                error: 'USERNAME_EXISTS',
                message: 'این نام کاربری قبلاً گرفته شده است'
            };
        }

        const oldUsername = this.currentUser.username;

        // به‌روزرسانی کاربر
        this.currentUser.username = newUsername;
        storage.saveUserProfile(this.currentUser);

        // به‌روزرسانی registry
        if (existingUsers.usernames) {
            delete existingUsers.usernames[oldUsername];
            existingUsers.usernames[newUsername] = this.currentUser.id;
            storage.set('hokm_users_registry', existingUsers);
        }

        // به‌روزرسانی session
        if (this.session) {
            this.session.username = newUsername;
            storage.set(CONFIG.STORAGE_KEYS.SESSION, this.session, {
                encrypt: true
            });
        }

        eventBus.emit(EVENTS.PROFILE.NAME_CHANGED, {
            oldUsername: oldUsername,
            newUsername: newUsername
        });

        return {
            success: true,
            oldUsername: oldUsername,
            newUsername: newUsername
        };
    }

    /**
     * حذف حساب کاربری
     * @param {string} password - رمز عبور برای تأیید
     * @returns {Promise<Object>} نتیجه
     */
    async deleteAccount(password) {
        if (!this.isLoggedIn()) {
            return {
                success: false,
                error: 'NOT_LOGGED_IN',
                message: 'شما وارد نشده‌اید'
            };
        }

        // تأیید رمز عبور (برای کاربران غیر مهمان)
        if (!this.isGuest() && this.currentUser.passwordHash) {
            const hashedPassword = this._hashPassword(password);
            if (hashedPassword !== this.currentUser.passwordHash) {
                return {
                    success: false,
                    error: 'INVALID_PASSWORD',
                    message: 'رمز عبور اشتباه است'
                };
            }
        }

        const userId = this.currentUser.id;
        const username = this.currentUser.username;

        // علامت‌گذاری برای حذف (با تاخیر 30 روزه)
        this.currentUser.markedForDeletion = true;
        this.currentUser.deletionDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
        storage.saveUserProfile(this.currentUser);

        eventBus.emit(EVENTS.AUTH.ACCOUNT_DELETED, {
            userId: userId,
            username: username,
            deletionDate: this.currentUser.deletionDate
        });

        // خروج
        this.logout(false);

        return {
            success: true,
            message: 'حساب شما برای حذف علامت‌گذاری شد. 30 روز فرصت دارید نظر خود را تغییر دهید',
            deletionDate: this.currentUser.deletionDate
        };
    }

    // ============================================================
    // بخش ۸: امنیت
    // ============================================================

    /**
     * قفل کردن حساب
     * @private
     */
    _lockAccount() {
        this.lockoutUntil = Date.now() + CONFIG.AUTH.OTP.LOCKOUT_DURATION_MS;

        eventBus.emit(EVENTS.SECURITY.RATE_LIMIT_HIT, {
            reason: 'max_otp_attempts',
            lockoutUntil: this.lockoutUntil
        });

        if (this.debug) {
            console.log(' Account locked until:', new Date(this.lockoutUntil).toLocaleString('fa-IR'));
        }
    }

    /**
     * به‌روزرسانی آخرین فعالیت
     */
    updateLastActivity() {
        if (this.session) {
            this.session.lastActivity = Date.now();
            storage.set(CONFIG.STORAGE_KEYS.SESSION, this.session, {
                encrypt: true
            });
        }
    }

    /**
     * بررسی انقضای session
     * @returns {boolean} منقضی شده یا خیر
     */
    isSessionExpired() {
        if (!this.session) return true;
        return Date.now() > this.session.expiry;
    }

    /**
     * تمدید session
     * @returns {boolean} موفقیت
     */
    refreshSession() {
        if (!this.session || !this.currentUser) {
            return false;
        }

        this.session.expiry = Date.now() + CONFIG.AUTH.SESSION.EXPIRY_MS;
        this.session.lastActivity = Date.now();

        storage.set(CONFIG.STORAGE_KEYS.SESSION, this.session, {
            encrypt: true
        });

        eventBus.emit(EVENTS.AUTH.SESSION_REFRESHED, {
            session: this.session
        });

        return true;
    }

    // ============================================================
    // بخش ۹: توابع کمکی
    // ============================================================

    /**
     * دریافت اطلاعات احراز هویت
     * @returns {Object}
     */
    getAuthInfo() {
        return {
            isLoggedIn: this.isLoggedIn(),
            isGuest: this.isGuest(),
            isLocked: this.isLocked(),
            isLoading: this.isLoading,
            failedAttempts: this.failedAttempts,
            lockoutRemaining: this.getLockoutRemaining(),
            sessionExpired: this.isSessionExpired(),
            user: this.currentUser ? {
                id: this.currentUser.id,
                username: this.currentUser.username,
                isGuest: this.currentUser.isGuest
            } : null
        };
    }

    /**
     * لاگ وضعیت احراز هویت
     */
    logStatus() {
        const info = this.getAuthInfo();
        
        console.log('🔐 Auth Status:');
        console.log('  Logged In:', info.isLoggedIn ? '✅' : '❌');
        console.log('  Is Guest:', info.isGuest ? '✅' : '');
        console.log('  Is Locked:', info.isLocked ? '🔒' : '');
        console.log('  Is Loading:', info.isLoading ? '⏳' : '✅');
        console.log('  Failed Attempts:', info.failedAttempts);
        console.log('  Session Expired:', info.sessionExpired ? '❌' : '✅');
        
        if (info.user) {
            console.log('  User:', info.user.username);
        }
    }

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
     * انتشار رویداد داخلی
     * @param {string} event - رویداد
     * @param {*} data - داده
     * @private
     */
    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Auth event listener error:`, error);
                }
            });
        }
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const authManager = new AuthManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, authManager };
} else {
    window.AuthManager = AuthManager;
    window.authManager = authManager;
}

console.log('✅ AuthManager loaded');
