/**
 * ============================================================
 * HOKM MASTER - OTP Manager
 * مدیریت رابط کاربری و منطق OTP
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل فرآیند ورود کد OTP از سمت
 * کاربر است. شامل مدیریت input ها، تایمر، ارسال مجدد،
 * اعتبارسنجی، و تعامل با authManager.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - storage (از فایل storage.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - authManager (از فایل auth.js)
 * 
 * ============================================================
 */

class OTPManager {

    constructor() {
        /**
         * شماره موبایل فعلی
         * @type {string|null}
         */
        this.phone = null;

        /**
         * تایمر ارسال مجدد
         * @type {number|null}
         */
        this.resendTimer = null;

        /**
         * زمان باقی‌مانده تا ارسال مجدد
         * @type {number}
         */
        this.countdown = 0;

        /**
         * زمان انقضای OTP
         * @type {number|null}
         */
        this.expiryTime = null;

        /**
         * تایمر انقضا
         * @type {number|null}
         */
        this.expiryTimer = null;

        /**
         * تعداد خانه‌های OTP
         * @type {number}
         */
        this.inputCount = CONFIG.AUTH.OTP.LENGTH;

        /**
         * آیا در حال بارگذاری است
         * @type {boolean}
         */
        this.isVerifying = false;

        /**
         * آیا در حال ارسال مجدد است
         * @type {boolean}
         */
        this.isResending = false;

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
         * مرجع input های DOM
         * @type {Array<HTMLElement>}
         */
        this.inputs = [];

        /**
         * آیا OTP از طریق paste وارد شده
         * @type {boolean}
         */
        this.isPasteMode = false;

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بررسی OTP موقت موجود
        this._checkExistingOTP();

        if (this.debug) {
            console.log('🔢 OTPManager initialized');
        }
    }

    /**
     * بررسی OTP موقت موجود
     * @private
     */
    _checkExistingOTP() {
        const tempOTP = storage.get(CONFIG.STORAGE_KEYS.TEMP_OTP, {
            decrypt: true
        });

        if (tempOTP && tempOTP.phone && tempOTP.expiry && Date.now() < tempOTP.expiry) {
            this.phone = tempOTP.phone;
            this.expiryTime = tempOTP.expiry;

            if (this.debug) {
                console.log('📱 Existing OTP found for:', this.phone);
            }
        }
    }

    // ============================================================
    // بخش ۱: راه‌اندازی UI
    // ============================================================

    /**
     * راه‌اندازی کامل UI برای OTP
     * @param {Object} options - گزینه‌ها
     * @param {string} options.phone - شماره موبایل
     * @param {number} options.expiry - زمان انقضا
     * @param {boolean} options.autoFocus - آیا فوکوس خودکار
     * @returns {void}
     */
    setup(options = {}) {
        const {
            phone = null,
            expiry = null,
            autoFocus = true
        } = options;

        if (phone) {
            this.phone = phone;
        }

        if (expiry) {
            this.expiryTime = expiry;
        }

        // پیدا کردن input ها
        this._findInputs();

        // تنظیم event listeners
        this._setupInputListeners();

        // تنظیم دکمه‌ها
        this._setupButtonListeners();

        // نمایش شماره موبایل
        this._displayPhone();

        // شروع تایمرها
        if (this.expiryTime) {
            this._startExpiryTimer();
        }

        this._startResendTimer();

        // فوکوس خودکار
        if (autoFocus && this.inputs.length > 0) {
            setTimeout(() => {
                this.inputs[0].focus();
            }, 300);
        }

        if (this.debug) {
            console.log('✅ OTP UI setup complete');
        }
    }

    /**
     * پیدا کردن input های OTP
     * @private
     */
    _findInputs() {
        this.inputs = [];

        // روش ۱: جستجو با data-index
        const indexedInputs = document.querySelectorAll('.code-input[data-index]');
        if (indexedInputs.length > 0) {
            indexedInputs.forEach(input => {
                this.inputs[parseInt(input.dataset.index)] = input;
            });
            return;
        }

        // روش ۲: جستجو با container
        const container = document.getElementById('code-inputs');
        if (container) {
            const allInputs = container.querySelectorAll('input');
            allInputs.forEach((input, index) => {
                this.inputs[index] = input;
            });
            return;
        }

        // روش ۳: جستجو با class
        const classInputs = document.querySelectorAll('.otp-input, .code-input');
        classInputs.forEach((input, index) => {
            this.inputs[index] = input;
        });

        if (this.inputs.length === 0) {
            console.warn('⚠️ No OTP inputs found in DOM');
        }
    }

    /**
     * تنظیم event listeners برای input ها
     * @private
     */
    _setupInputListeners() {
        this.inputs.forEach((input, index) => {
            if (!input) return;

            // محدود کردن به اعداد
            input.setAttribute('inputmode', 'numeric');
            input.setAttribute('autocomplete', 'one-time-code');
            input.setAttribute('maxlength', '1');
            input.setAttribute('type', 'tel');

            // Input event
            input.addEventListener('input', (e) => this._handleInput(e, index));

            // Keydown event
            input.addEventListener('keydown', (e) => this._handleKeydown(e, index));

            // Focus event
            input.addEventListener('focus', (e) => this._handleFocus(e, index));

            // Blur event
            input.addEventListener('blur', (e) => this._handleBlur(e, index));

            // Paste event
            input.addEventListener('paste', (e) => this._handlePaste(e));

            // Touch event برای موبایل
            input.addEventListener('touchstart', () => {
                setTimeout(() => input.select(), 50);
            });
        });
    }

    /**
     * تنظیم event listeners برای دکمه‌ها
     * @private
     */
    _setupButtonListeners() {
        // دکمه تأیید
        const verifyBtn = document.getElementById('btn-verify-code');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => this.verify());
        }

        // دکمه ارسال مجدد
        const resendBtn = document.getElementById('btn-resend');
        if (resendBtn) {
            resendBtn.addEventListener('click', () => this.resend());
        }

        // دکمه تغییر شماره
        const changePhoneBtn = document.getElementById('btn-change-phone');
        if (changePhoneBtn) {
            changePhoneBtn.addEventListener('click', () => this.changePhone());
        }

        // دکمه بازگشت
        const backBtn = document.getElementById('back-to-login');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.cleanup();
                eventBus.emit(EVENTS.UI.SCREEN_CHANGE, 'login-screen');
            });
        }
    }

    /**
     * نمایش شماره موبایل
     * @private
     */
    _displayPhone() {
        if (!this.phone) return;

        const displayElement = document.getElementById('display-phone');
        if (displayElement) {
            const formatted = Utils.formatPhone(this.phone);
            displayElement.textContent = `+۹۸ ${formatted}`;
        }
    }

    // ============================================================
    // بخش ۲: مدیریت Input
    // ============================================================

    /**
     * مدیریت ورودی کاربر
     * @param {Event} event - رویداد
     * @param {number} index - ایندکس input
     * @private
     */
    _handleInput(event, index) {
        const input = event.target;
        let value = input.value;

        // تبدیل اعداد فارسی/عربی به انگلیسی
        value = Utils.toEnglishNumber(value);

        // فقط اعداد مجاز هستند
        value = value.replace(/\D/g, '');

        // محدود کردن به یک کاراکتر
        if (value.length > 1) {
            value = value.slice(-1);
        }

        input.value = value;

        if (value) {
            input.classList.add('filled');
            this._emit('input', { index, value });

            // رفتن به input بعدی
            if (index < this.inputs.length - 1) {
                this.inputs[index + 1].focus();
            }

            // بررسی تکمیل
            this._checkComplete();
        } else {
            input.classList.remove('filled');
        }
    }

    /**
     * مدیریت keydown
     * @param {Event} event - رویداد
     * @param {number} index - ایندکس
     * @private
     */
    _handleKeydown(event, index) {
        const input = event.target;

        // Backspace
        if (event.key === 'Backspace') {
            if (!input.value && index > 0) {
                // برگشت به input قبلی
                this.inputs[index - 1].focus();
                this.inputs[index - 1].value = '';
                this.inputs[index - 1].classList.remove('filled');
                event.preventDefault();
            } else {
                input.value = '';
                input.classList.remove('filled');
            }
        }

        // Arrow keys
        if (event.key === 'ArrowLeft' && index < this.inputs.length - 1) {
            this.inputs[index + 1].focus();
            event.preventDefault();
        }

        if (event.key === 'ArrowRight' && index > 0) {
            this.inputs[index - 1].focus();
            event.preventDefault();
        }

        // Enter
        if (event.key === 'Enter') {
            this.verify();
            event.preventDefault();
        }

        // Tab
        if (event.key === 'Tab') {
            if (event.shiftKey && index > 0) {
                this.inputs[index - 1].focus();
                event.preventDefault();
            } else if (!event.shiftKey && index < this.inputs.length - 1) {
                this.inputs[index + 1].focus();
                event.preventDefault();
            }
        }
    }

    /**
     * مدیریت focus
     * @param {Event} event - رویداد
     * @param {number} index - ایندکس
     * @private
     */
    _handleFocus(event, index) {
        const input = event.target;
        input.select();
        input.classList.add('focused');

        this._emit('focus', { index });
    }

    /**
     * مدیریت blur
     * @param {Event} event - رویداد
     * @param {number} index - ایندکس
     * @private
     */
    _handleBlur(event, index) {
        const input = event.target;
        input.classList.remove('focused');

        this._emit('blur', { index });
    }

    /**
     * مدیریت paste
     * @param {Event} event - رویداد
     * @private
     */
    _handlePaste(event) {
        event.preventDefault();

        const clipboardData = event.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        let pastedData = clipboardData.getData('text');

        // تبدیل اعداد فارسی/عربی
        pastedData = Utils.toEnglishNumber(pastedData);

        // فقط اعداد
        pastedData = pastedData.replace(/\D/g, '');

        if (pastedData.length !== this.inputCount) {
            Utils.showToast(`کد باید ${Utils.toPersianNumber(this.inputCount)} رقم باشد`, 'error');
            return;
        }

        this.isPasteMode = true;

        // پر کردن تمام input ها
        const digits = pastedData.split('');
        digits.forEach((digit, index) => {
            if (this.inputs[index]) {
                this.inputs[index].value = digit;
                this.inputs[index].classList.add('filled');
            }
        });

        // فوکوس روی آخرین input
        if (this.inputs[this.inputs.length - 1]) {
            this.inputs[this.inputs.length - 1].focus();
        }

        this._emit('paste', { code: pastedData });

        // بررسی تکمیل
        setTimeout(() => {
            this._checkComplete();
            this.isPasteMode = false;
        }, 100);
    }

    /**
     * بررسی تکمیل کد
     * @private
     */
    _checkComplete() {
        const code = this.getCode();

        if (code.length === this.inputCount) {
            this._emit('complete', { code });

            // تأیید خودکار بعد از تاخیر کوتاه
            setTimeout(() => {
                if (!this.isVerifying) {
                    this.verify();
                }
            }, 300);
        }
    }

    // ============================================================
    // بخش ۳: دریافت و مدیریت کد
    // ============================================================

    /**
     * دریافت کد وارد شده
     * @returns {string} کد
     */
    getCode() {
        return this.inputs
            .map(input => input ? input.value : '')
            .join('');
    }

    /**
     * دریافت کد به صورت آرایه
     * @returns {Array<string>} آرایه ارقام
     */
    getCodeArray() {
        return this.inputs
            .map(input => input ? input.value : '');
    }

    /**
     * آیا کد کامل وارد شده
     * @returns {boolean}
     */
    isComplete() {
        return this.getCode().length === this.inputCount;
    }

    /**
     * پاک کردن تمام input ها
     * @returns {void}
     */
    clear() {
        this.inputs.forEach(input => {
            if (input) {
                input.value = '';
                input.classList.remove('filled');
                input.classList.remove('error');
            }
        });

        if (this.inputs[0]) {
            this.inputs[0].focus();
        }

        this._emit('clear');
    }

    /**
     * تنظیم کد (برای autofill)
     * @param {string} code - کد
     * @returns {void}
     */
    setCode(code) {
        const digits = Utils.toEnglishNumber(code).replace(/\D/g, '').split('');

        digits.forEach((digit, index) => {
            if (this.inputs[index]) {
                this.inputs[index].value = digit;
                this.inputs[index].classList.add('filled');
            }
        });

        this._checkComplete();
    }

    // ============================================================
    // بخش ۴: تأیید کد
    // ============================================================

    /**
     * تأیید کد OTP
     * @returns {Promise<Object>} نتیجه
     */
    async verify() {
        if (this.isVerifying) {
            return {
                success: false,
                error: 'ALREADY_VERIFYING',
                message: 'لطفاً صبر کنید'
            };
        }

        const code = this.getCode();

        // اعتبارسنجی
        if (code.length !== this.inputCount) {
            this._showError('لطفاً کد کامل را وارد کنید');
            this._shakeInputs();
            return {
                success: false,
                error: 'INCOMPLETE_CODE',
                message: 'لطفاً کد کامل را وارد کنید'
            };
        }

        // بررسی انقضا
        if (this.expiryTime && Date.now() > this.expiryTime) {
            this._showError('کد منقضی شده است. لطفاً کد جدید درخواست دهید');
            this.clear();
            return {
                success: false,
                error: 'OTP_EXPIRED',
                message: 'کد منقضی شده است'
            };
        }

        this.isVerifying = true;
        this._setLoadingState(true);

        try {
            this._emit('verify-start', { code });

            const result = await authManager.verifyOTP(this.phone, code);

            if (result.success) {
                this._showSuccess('ورود موفقیت‌آمیز بود');
                this._emit('verify-success', result);

                // پاکسازی بعد از تأخیر کوتاه
                setTimeout(() => {
                    this.cleanup();
                }, 1000);

            } else {
                this._showError(result.message || 'کد وارد شده صحیح نیست');
                this._shakeInputs();

                // پاک کردن input ها بعد از تاخیر
                setTimeout(() => {
                    this.clear();
                }, 1000);

                this._emit('verify-failed', result);
            }

            return result;

        } catch (error) {
            console.error('❌ OTP verification error:', error);
            this._showError('خطا در تأیید کد');
            this._shakeInputs();

            return {
                success: false,
                error: 'VERIFICATION_ERROR',
                message: 'خطا در تأیید کد'
            };

        } finally {
            this.isVerifying = false;
            this._setLoadingState(false);
        }
    }

    // ============================================================
    // بخش : ارسال مجدد
    // ============================================================

    /**
     * ارسال مجدد کد OTP
     * @returns {Promise<Object>} نتیجه
     */
    async resend() {
        if (this.isResending) {
            return {
                success: false,
                error: 'ALREADY_RESENDING',
                message: 'لطفاً صبر کنید'
            };
        }

        if (this.countdown > 0) {
            return {
                success: false,
                error: 'COOLDOWN_ACTIVE',
                message: `لطفاً ${Utils.toPersianNumber(this.countdown)} ثانیه صبر کنید`,
                countdown: this.countdown
            };
        }

        if (!this.phone) {
            return {
                success: false,
                error: 'NO_PHONE',
                message: 'شماره موبایل مشخص نیست'
            };
        }

        this.isResending = true;
        this._setResendLoading(true);

        try {
            this._emit('resend-start');

            const result = await authManager.loginWithPhone(this.phone);

            if (result.success) {
                // به‌روزرسانی زمان انقضا
                this.expiryTime = result.expiry;
                this._startExpiryTimer();

                // ریست تایمر ارسال مجدد
                this._startResendTimer();

                // پاک کردن input ها
                this.clear();

                this._showSuccess('کد جدید ارسال شد');
                this._emit('resend-success', result);

            } else {
                this._showError(result.message || 'خطا در ارسال کد جدید');
                this._emit('resend-failed', result);
            }

            return result;

        } catch (error) {
            console.error('❌ OTP resend error:', error);
            this._showError('خطا در ارسال کد جدید');

            return {
                success: false,
                error: 'RESEND_ERROR',
                message: 'خطا در ارسال کد جدید'
            };

        } finally {
            this.isResending = false;
            this._setResendLoading(false);
        }
    }

    /**
     * شروع تایمر ارسال مجدد
     * @private
     */
    _startResendTimer() {
        this._stopResendTimer();

        this.countdown = CONFIG.AUTH.OTP.RESEND_COOLDOWN_SECONDS;

        const countdownElement = document.getElementById('countdown');
        const resendBtn = document.getElementById('btn-resend');
        const timerDisplay = document.getElementById('timer-display');

        if (resendBtn) {
            resendBtn.classList.add('disabled');
            resendBtn.disabled = true;
        }

        if (timerDisplay) {
            timerDisplay.style.display = 'flex';
        }

        this.resendTimer = setInterval(() => {
            this.countdown--;

            if (countdownElement) {
                countdownElement.textContent = Utils.toPersianNumber(this.countdown);
            }

            if (this.countdown <= 0) {
                this._stopResendTimer();

                if (resendBtn) {
                    resendBtn.classList.remove('disabled');
                    resendBtn.disabled = false;
                }

                if (timerDisplay) {
                    timerDisplay.style.display = 'none';
                }

                this._emit('resend-ready');
            }
        }, 1000);
    }

    /**
     * توقف تایمر ارسال مجدد
     * @private
     */
    _stopResendTimer() {
        if (this.resendTimer) {
            clearInterval(this.resendTimer);
            this.resendTimer = null;
        }
    }

    /**
     * شروع تایمر انقضا
     * @private
     */
    _startExpiryTimer() {
        this._stopExpiryTimer();

        this.expiryTimer = setInterval(() => {
            if (this.expiryTime && Date.now() > this.expiryTime) {
                this._stopExpiryTimer();
                this._handleExpiry();
            }
        }, 1000);
    }

    /**
     * توقف تایمر انقضا
     * @private
     */
    _stopExpiryTimer() {
        if (this.expiryTimer) {
            clearInterval(this.expiryTimer);
            this.expiryTimer = null;
        }
    }

    /**
     * مدیریت انقضای OTP
     * @private
     */
    _handleExpiry() {
        this._showError('کد منقضی شده است. لطفاً کد جدید درخواست دهید');
        this.clear();

        this._emit('expired');
    }

    // ============================================================
    // بخش ۶: تغییر شماره
    // ============================================================

    /**
     * تغییر شماره موبایل
     * @returns {void}
     */
    changePhone() {
        this.cleanup();
        this._emit('change-phone', { phone: this.phone });
        eventBus.emit(EVENTS.UI.SCREEN_CHANGE, 'login-screen');
    }

    // ============================================================
    // بخش ۷: UI Feedback
    // ============================================================

    /**
     * نمایش خطا
     * @param {string} message - پیام
     * @private
     */
    _showError(message) {
        Utils.showToast(message, 'error');

        this.inputs.forEach(input => {
            if (input) {
                input.classList.add('error');
            }
        });

        setTimeout(() => {
            this.inputs.forEach(input => {
                if (input) {
                    input.classList.remove('error');
                }
            });
        }, 2000);
    }

    /**
     * نمایش موفقیت
     * @param {string} message - پیام
     * @private
     */
    _showSuccess(message) {
        Utils.showToast(message, 'success');

        this.inputs.forEach(input => {
            if (input) {
                input.classList.add('success');
            }
        });
    }

    /**
     * انیمیشن shake
     * @private
     */
    _shakeInputs() {
        const container = document.getElementById('code-inputs');
        if (container) {
            container.style.animation = 'shake 0.5s';
            setTimeout(() => {
                container.style.animation = '';
            }, 500);
        }
    }

    /**
     * تنظیم حالت loading
     * @param {boolean} loading - آیا loading
     * @private
     */
    _setLoadingState(loading) {
        const verifyBtn = document.getElementById('btn-verify-code');
        if (verifyBtn) {
            if (loading) {
                verifyBtn.classList.add('loading');
                verifyBtn.disabled = true;
            } else {
                verifyBtn.classList.remove('loading');
                verifyBtn.disabled = false;
            }
        }
    }

    /**
     * تنظیم حالت loading برای resend
     * @param {boolean} loading - آیا loading
     * @private
     */
    _setResendLoading(loading) {
        const resendBtn = document.getElementById('btn-resend');
        if (resendBtn) {
            if (loading) {
                resendBtn.classList.add('loading');
                resendBtn.disabled = true;
            } else {
                resendBtn.classList.remove('loading');
                resendBtn.disabled = false;
            }
        }
    }

    // ============================================================
    // بخش ۸: Cleanup
    // ============================================================

    /**
     * پاکسازی کامل
     * @returns {void}
     */
    cleanup() {
        this._stopResendTimer();
        this._stopExpiryTimer();

        this.phone = null;
        this.expiryTime = null;
        this.countdown = 0;
        this.isVerifying = false;
        this.isResending = false;

        this.inputs = [];

        this._emit('cleanup');

        if (this.debug) {
            console.log('🧹 OTPManager cleaned up');
        }
    }

    /**
     * دریافت وضعیت فعلی
     * @returns {Object}
     */
    getStatus() {
        return {
            phone: this.phone,
            isComplete: this.isComplete(),
            code: this.getCode(),
            countdown: this.countdown,
            isExpired: this.expiryTime ? Date.now() > this.expiryTime : false,
            isVerifying: this.isVerifying,
            isResending: this.isResending,
            expiryTime: this.expiryTime
        };
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
                    console.error(`❌ OTP event listener error:`, error);
                }
            });
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const status = this.getStatus();

        console.log('🔢 OTP Status:');
        console.log('  Phone:', status.phone || 'N/A');
        console.log('  Is Complete:', status.isComplete ? '✅' : '❌');
        console.log('  Countdown:', status.countdown);
        console.log('  Is Expired:', status.isExpired ? '' : '✅');
        console.log('  Is Verifying:', status.isVerifying ? '' : '✅');
        console.log('  Is Resending:', status.isResending ? '' : '✅');
    }
}

// ============================================================
// Singleton Instance
// ============================================================
const otpManager = new OTPManager();

// ============================================================
// Auto-setup وقتی DOM آماده است
// ============================================================
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // بررسی آیا صفحه OTP فعال است
        const otpScreen = document.getElementById('otp-screen');
        if (otpScreen && otpScreen.classList.contains('active')) {
            otpManager.setup({
                autoFocus: true
            });
        }
    });
}

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OTPManager, otpManager };
} else {
    window.OTPManager = OTPManager;
    window.otpManager = otpManager;
}

console.log('✅ OTPManager loaded');
