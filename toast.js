/**
 * ============================================================
 * HOKM MASTER - Toast Notification Manager
 * سیستم مدیریت اعلان‌های Toast
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل اعلان‌های Toast (اعلان‌های کوچک
 * و موقت) در اپلیکیشن است. شامل انواع مختلف Toast (موفقیت،
 * خطا، هشدار، اطلاعات، بارگذاری)، مدیریت صف، موقعیت‌های مختلف
 * نمایش، انیمیشن‌ها، دکمه‌های اکشن، progress indicator،
 * grouping، و آمار کامل.
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

class ToastManager {

    constructor() {
        /**
         * Toast های فعال
         * @type {Array<Object>}
         */
        this.activeToasts = [];

        /**
         * صف Toast های در انتظار
         * @type {Array<Object>}
         */
        this.toastQueue = [];

        /**
         * حداکثر Toast همزمان
         * @type {number}
         */
        this.maxVisibleToasts = 3;

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
         * آیا Toast Manager فعال است
         * @type {boolean}
         */
        this.enabled = true;

        /**
         * آمار Toast Manager
         * @type {Object}
         */
        this.stats = {
            totalToastsShown: 0,
            totalToastsDismissed: 0,
            totalToastsExpired: 0,
            totalToastsClicked: 0,
            totalToastsActioned: 0,
            averageDisplayTime: 0,
            lastToastAt: null
        };

        /**
         * پیکربندی
         * @type {Object}
         */
        this.config = {
            defaultDuration: 3000,
            defaultPosition: 'top-right',
            defaultType: 'info',
            maxVisible: 3,
            enableQueue: true,
            enableAnimations: true,
            animationDuration: 300,
            enableProgressBar: true,
            enableCloseButton: true,
            enableStacking: true,
            stackGap: 10,
            pauseOnHover: true,
            groupSimilar: true,
            groupInterval: 1000
        };

        /**
         * آیکون‌های Toast
         * @type {Object}
         */
        this.icons = {
            success: '✅',
            error: '',
            warning: '⚠️',
            info: 'ℹ️',
            loading: '⏳',
            question: '❓'
        };

        /**
         * رنگ‌های Toast
         * @type {Object}
         */
        this.colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6',
            loading: '#6b7280',
            question: '#8b5cf6'
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // ایجاد container Toast
        this._createToastContainer();

        // بارگذاری داده‌ها
        this._loadData();

        if (this.debug) {
            console.log('🍞 ToastManager initialized');
            console.log('  Max Visible:', this.config.maxVisible);
            console.log('  Default Position:', this.config.defaultPosition);
        }
    }

    // ============================================================
    // بخش ۱: نمایش Toast
    // ============================================================

    /**
     * نمایش Toast
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    show(options = {}) {
        if (!this.enabled) {
            return {
                success: false,
                error: 'TOAST_MANAGER_DISABLED',
                message: 'Toast Manager غیرفعال است'
            };
        }

        const {
            message,
            title = null,
            type = this.config.defaultType,
            duration = this.config.defaultDuration,
            position = this.config.defaultPosition,
            icon = null,
            closable = true,
            pauseOnHover = this.config.pauseOnHover,
            progressBar = this.config.enableProgressBar,
            actions = [],
            onClick = null,
            onDismiss = null,
            data = {},
            group = null,
            priority = 'normal', // low, normal, high, urgent
            id = null
        } = options;

        if (!message) {
            return {
                success: false,
                error: 'NO_MESSAGE',
                message: 'پیام Toast الزامی است'
            };
        }

        // بررسی grouping
        if (this.config.groupSimilar && group) {
            const existingToast = this._findGroupedToast(group);
            if (existingToast) {
                existingToast.count = (existingToast.count || 1) + 1;
                existingToast.lastUpdateAt = Date.now();
                this._updateToastDOM(existingToast);
                this._resetToastTimer(existingToast);

                return {
                    success: true,
                    toast: existingToast,
                    grouped: true
                };
            }
        }

        // ایجاد Toast
        const toast = {
            id: id || Utils.generateUUID(),
            message,
            title,
            type,
            duration,
            position,
            icon: icon || this.icons[type],
            color: this.colors[type],
            closable,
            pauseOnHover,
            progressBar,
            actions,
            onClick,
            onDismiss,
            data,
            group,
            priority,
            createdAt: Date.now(),
            expiresAt: Date.now() + duration,
            remainingTime: duration,
            isPaused: false,
            count: 1,
            lastUpdateAt: Date.now(),
            isDismissed: false,
            isExpired: false,
            timer: null,
            element: null
        };

        // بررسی محدودیت نمایش
        if (this.activeToasts.length >= this.maxVisibleToasts) {
            if (this.config.enableQueue) {
                this.toastQueue.push(toast);

                if (this.debug) {
                    console.log(`📋 Toast queued: ${message.substring(0, 30)}...`);
                }

                return {
                    success: true,
                    toast,
                    queued: true
                };
            } else {
                // حذف قدیمی‌ترین Toast
                this._dismissOldestToast();
            }
        }

        // نمایش Toast
        this._displayToast(toast);

        return {
            success: true,
            toast
        };
    }

    /**
     * نمایش Toast موفقیت
     * @param {string} message - پیام
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    success(message, options = {}) {
        return this.show({ ...options, message, type: 'success' });
    }

    /**
     * نمایش Toast خطا
     * @param {string} message - پیام
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    error(message, options = {}) {
        return this.show({ ...options, message, type: 'error', duration: options.duration || 5000 });
    }

    /**
     * نمایش Toast هشدار
     * @param {string} message - پیام
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    warning(message, options = {}) {
        return this.show({ ...options, message, type: 'warning' });
    }

    /**
     * نمایش Toast اطلاعات
     * @param {string} message - پیام
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    info(message, options = {}) {
        return this.show({ ...options, message, type: 'info' });
    }

    /**
     * نمایش Toast بارگذاری
     * @param {string} message - پیام
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    loading(message, options = {}) {
        return this.show({
            ...options,
            message,
            type: 'loading',
            duration: options.duration || 0, // بدون انقضا
            closable: options.closable !== undefined ? options.closable : false
        });
    }

    /**
     * نمایش Toast سؤال
     * @param {string} message - پیام
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    question(message, options = {}) {
        return this.show({ ...options, message, type: 'question' });
    }

    // ============================================================
    // بخش ۲: مدیریت نمایش
    // ============================================================

    /**
     * نمایش Toast در DOM
     * @param {Object} toast - Toast
     * @private
     */
    _displayToast(toast) {
        // اضافه کردن به لیست فعال
        this.activeToasts.push(toast);

        // ایجاد عنصر DOM
        const element = this._createToastElement(toast);
        toast.element = element;

        // اضافه کردن به container
        const container = this._getToastContainer(toast.position);
        container.appendChild(element);

        // اعمال انیمیشن ورود
        if (this.config.enableAnimations) {
            this._animateToastIn(element);
        }

        // شروع تایمر
        if (toast.duration > 0) {
            this._startToastTimer(toast);
        }

        // setup event listeners
        this._setupToastListeners(toast);

        // به‌روزرسانی آمار
        this.stats.totalToastsShown++;
        this.stats.lastToastAt = Date.now();

        this._emit('toast-shown', { toast });

        if (this.debug) {
            console.log(` Toast shown: ${toast.message.substring(0, 30)}...`);
        }
    }

    /**
     * ایجاد عنصر Toast
     * @param {Object} toast - Toast
     * @returns {HTMLElement}
     * @private
     */
    _createToastElement(toast) {
        const element = document.createElement('div');
        element.className = `toast toast-${toast.type} toast-${toast.position}`;
        element.id = `toast-${toast.id}`;
        element.dataset.toastId = toast.id;

        // Icon
        const iconElement = document.createElement('span');
        iconElement.className = 'toast-icon';
        iconElement.textContent = toast.icon;
        element.appendChild(iconElement);

        // Content
        const content = document.createElement('div');
        content.className = 'toast-content';

        if (toast.title) {
            const title = document.createElement('div');
            title.className = 'toast-title';
            title.textContent = toast.title;
            content.appendChild(title);
        }

        const message = document.createElement('div');
        message.className = 'toast-message';
        message.textContent = toast.message;
        content.appendChild(message);

        // نمایش تعداد در صورت grouping
        if (toast.count > 1) {
            const countBadge = document.createElement('span');
            countBadge.className = 'toast-count-badge';
            countBadge.textContent = toast.count;
            message.appendChild(countBadge);
        }

        element.appendChild(content);

        // Actions
        if (toast.actions && toast.actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'toast-actions';

            toast.actions.forEach(action => {
                const actionBtn = document.createElement('button');
                actionBtn.className = `toast-action-btn toast-action-${action.variant || 'default'}`;
                actionBtn.textContent = action.text;
                actionBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this._handleToastAction(toast, action);
                });
                actionsContainer.appendChild(actionBtn);
            });

            element.appendChild(actionsContainer);
        }

        // Close button
        if (toast.closable && this.config.enableCloseButton) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.setAttribute('aria-label', 'بستن');
            closeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.dismissToast(toast.id);
            });
            element.appendChild(closeBtn);
        }

        // Progress bar
        if (toast.progressBar && toast.duration > 0) {
            const progressBar = document.createElement('div');
            progressBar.className = 'toast-progress-bar';
            progressBar.style.width = '100%';
            element.appendChild(progressBar);
        }

        return element;
    }

    /**
     * به‌روزرسانی Toast در DOM
     * @param {Object} toast - Toast
     * @private
     */
    _updateToastDOM(toast) {
        const element = document.getElementById(`toast-${toast.id}`);
        if (!element) return;

        // به‌روزرسانی تعداد
        const countBadge = element.querySelector('.toast-count-badge');
        if (countBadge) {
            countBadge.textContent = toast.count;
        } else if (toast.count > 1) {
            const messageEl = element.querySelector('.toast-message');
            if (messageEl) {
                const badge = document.createElement('span');
                badge.className = 'toast-count-badge';
                badge.textContent = toast.count;
                messageEl.appendChild(badge);
            }
        }

        // اعمال انیمیشن pulse
        element.classList.add('toast-updated');
        setTimeout(() => {
            element.classList.remove('toast-updated');
        }, 500);
    }

    /**
     * دریافت container Toast
     * @param {string} position - موقعیت
     * @returns {HTMLElement}
     * @private
     */
    _getToastContainer(position) {
        let container = document.getElementById(`toast-container-${position}`);

        if (!container) {
            container = document.createElement('div');
            container.id = `toast-container-${position}`;
            container.className = `toast-container toast-container-${position}`;

            const mainContainer = document.getElementById('toast-container');
            if (mainContainer) {
                mainContainer.appendChild(container);
            }
        }

        return container;
    }

    /**
     * ایجاد container اصلی Toast
     * @private
     */
    _createToastContainer() {
        if (typeof document === 'undefined') return;

        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container-main';
            document.body.appendChild(container);
        }
    }

    // ============================================================
    // بخش ۳: انیمیشن‌ها
    // ============================================================

    /**
     * انیمیشن ورود Toast
     * @param {HTMLElement} element - عنصر
     * @private
     */
    _animateToastIn(element) {
        element.classList.add('toast-entering');

        setTimeout(() => {
            element.classList.remove('toast-entering');
            element.classList.add('toast-entered');
        }, this.config.animationDuration);
    }

    /**
     * انیمیشن خروج Toast
     * @param {HTMLElement} element - عنصر
     * @returns {Promise<void>}
     * @private
     */
    async _animateToastOut(element) {
        element.classList.add('toast-exiting');

        await Utils.sleep(this.config.animationDuration);

        element.classList.remove('toast-exiting');
    }

    // ============================================================
    // بخش ۴: تایمر و انقضا
    // ============================================================

    /**
     * شروع تایمر Toast
     * @param {Object} toast - Toast
     * @private
     */
    _startToastTimer(toast) {
        if (toast.timer) {
            clearInterval(toast.timer);
        }

        const startTime = Date.now();
        const initialRemaining = toast.remainingTime;

        toast.timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = initialRemaining - elapsed;

            if (remaining <= 0) {
                this._expireToast(toast);
            } else {
                toast.remainingTime = remaining;
                this._updateProgressBar(toast);
            }
        }, 100);
    }

    /**
     * ریست تایمر Toast
     * @param {Object} toast - Toast
     * @private
     */
    _resetToastTimer(toast) {
        if (toast.duration > 0) {
            toast.expiresAt = Date.now() + toast.duration;
            toast.remainingTime = toast.duration;
            this._startToastTimer(toast);
        }
    }

    /**
     * به‌روزرسانی progress bar
     * @param {Object} toast - Toast
     * @private
     */
    _updateProgressBar(toast) {
        if (!toast.progressBar) return;

        const element = document.getElementById(`toast-${toast.id}`);
        if (!element) return;

        const progressBar = element.querySelector('.toast-progress-bar');
        if (progressBar) {
            const percentage = (toast.remainingTime / toast.duration) * 100;
            progressBar.style.width = `${percentage}%`;
        }
    }

    /**
     * انقضای Toast
     * @param {Object} toast - Toast
     * @private
     */
    async _expireToast(toast) {
        if (toast.isExpired || toast.isDismissed) return;

        toast.isExpired = true;
        toast.isDismissed = true;

        // متوقف کردن تایمر
        if (toast.timer) {
            clearInterval(toast.timer);
            toast.timer = null;
        }

        // انیمیشن خروج
        if (toast.element) {
            await this._animateToastOut(toast.element);
            toast.element.remove();
        }

        // حذف از لیست فعال
        this.activeToasts = this.activeToasts.filter(t => t.id !== toast.id);

        // اجرای onDismiss
        if (toast.onDismiss) {
            try {
                toast.onDismiss(toast);
            } catch (error) {
                console.error('❌ onDismiss error:', error);
            }
        }

        // به‌روزرسانی آمار
        this.stats.totalToastsExpired++;

        this._emit('toast-expired', { toast });

        // بررسی صف
        this._processQueue();

        if (this.debug) {
            console.log(` Toast expired: ${toast.message.substring(0, 30)}...`);
        }
    }

    // ============================================================
    // بخش ۵: dismiss کردن
    // ============================================================

    /**
     * dismiss کردن Toast
     * @param {string} toastId - شناسه Toast
     * @returns {Object} نتیجه
     */
    async dismissToast(toastId) {
        const toast = this.activeToasts.find(t => t.id === toastId);
        if (!toast) {
            return {
                success: false,
                error: 'TOAST_NOT_FOUND',
                message: 'Toast یافت نشد'
            };
        }

        if (toast.isDismissed) {
            return {
                success: false,
                error: 'TOAST_ALREADY_DISMISSED',
                message: 'Toast قبلاً dismiss شده است'
            };
        }

        toast.isDismissed = true;

        // متوقف کردن تایمر
        if (toast.timer) {
            clearInterval(toast.timer);
            toast.timer = null;
        }

        // انیمیشن خروج
        if (toast.element) {
            await this._animateToastOut(toast.element);
            toast.element.remove();
        }

        // حذف از لیست فعال
        this.activeToasts = this.activeToasts.filter(t => t.id !== toastId);

        // اجرای onDismiss
        if (toast.onDismiss) {
            try {
                toast.onDismiss(toast);
            } catch (error) {
                console.error('❌ onDismiss error:', error);
            }
        }

        // به‌روزرسانی آمار
        this.stats.totalToastsDismissed++;

        this._emit('toast-dismissed', { toast });

        // بررسی صف
        this._processQueue();

        if (this.debug) {
            console.log(`🗑️ Toast dismissed: ${toast.message.substring(0, 30)}...`);
        }

        return {
            success: true,
            toast
        };
    }

    /**
     * dismiss کردن تمام Toast ها
     * @returns {number} تعداد dismiss شده
     */
    async dismissAllToasts() {
        const count = this.activeToasts.length;

        // کپی از آرایه برای جلوگیری از مشکل حین iteration
        const toastsToDismiss = [...this.activeToasts];

        for (const toast of toastsToDismiss) {
            await this.dismissToast(toast.id);
        }

        // پاک کردن صف
        this.toastQueue = [];

        if (this.debug) {
            console.log(`🗑️ All toasts dismissed: ${count}`);
        }

        return count;
    }

    /**
     * dismiss کردن Toast های یک نوع خاص
     * @param {string} type - نوع
     * @returns {number} تعداد dismiss شده
     */
    async dismissToastsByType(type) {
        const toastsToDismiss = this.activeToasts.filter(t => t.type === type);
        const count = toastsToDismiss.length;

        for (const toast of toastsToDismiss) {
            await this.dismissToast(toast.id);
        }

        return count;
    }

    /**
     * dismiss کردن قدیمی‌ترین Toast
     * @private
     */
    async _dismissOldestToast() {
        if (this.activeToasts.length === 0) return;

        const oldest = this.activeToasts.reduce((oldest, current) =>
            current.createdAt < oldest.createdAt ? current : oldest
        );

        await this.dismissToast(oldest.id);
    }

    // ============================================================
    // بخش ۶: مدیریت صف
    // ============================================================

    /**
     * پردازش صف
     * @private
     */
    _processQueue() {
        if (this.toastQueue.length === 0) return;
        if (this.activeToasts.length >= this.maxVisibleToasts) return;

        const nextToast = this.toastQueue.shift();
        if (nextToast) {
            this._displayToast(nextToast);
        }
    }

    /**
     * دریافت صف Toast
     * @returns {Array<Object>}
     */
    getToastQueue() {
        return [...this.toastQueue];
    }

    /**
     * پاک کردن صف
     * @returns {number} تعداد پاکسازی شده
     */
    clearToastQueue() {
        const count = this.toastQueue.length;
        this.toastQueue = [];

        if (this.debug) {
            console.log(`🗑️ Toast queue cleared: ${count}`);
        }

        return count;
    }

    // ============================================================
    // بخش ۷: Event Listeners
    // ============================================================

    /**
     * setup event listeners برای Toast
     * @param {Object} toast - Toast
     * @private
     */
    _setupToastListeners(toast) {
        const element = document.getElementById(`toast-${toast.id}`);
        if (!element) return;

        // کلیک روی Toast
        element.addEventListener('click', () => {
            this.stats.totalToastsClicked++;

            if (toast.onClick) {
                try {
                    toast.onClick(toast);
                } catch (error) {
                    console.error(' onClick error:', error);
                }
            }

            this._emit('toast-clicked', { toast });
        });

        // pause on hover
        if (toast.pauseOnHover && toast.duration > 0) {
            element.addEventListener('mouseenter', () => {
                toast.isPaused = true;
                if (toast.timer) {
                    clearInterval(toast.timer);
                    toast.timer = null;
                }
            });

            element.addEventListener('mouseleave', () => {
                toast.isPaused = false;
                if (toast.duration > 0 && !toast.isDismissed && !toast.isExpired) {
                    this._startToastTimer(toast);
                }
            });
        }
    }

    /**
     * مدیریت اکشن Toast
     * @param {Object} toast - Toast
     * @param {Object} action - اکشن
     * @private
     */
    _handleToastAction(toast, action) {
        this.stats.totalToastsActioned++;

        if (action.onClick) {
            try {
                action.onClick(toast, action);
            } catch (error) {
                console.error('❌ Action onClick error:', error);
            }
        }

        if (action.dismissOnClick !== false) {
            this.dismissToast(toast.id);
        }

        this._emit('toast-action', { toast, action });
    }

    // ============================================================
    // بخش ۸: Grouping
    // ============================================================

    /**
     * پیدا کردن Toast گروه‌بندی شده
     * @param {string} group - گروه
     * @returns {Object|null}
     * @private
     */
    _findGroupedToast(group) {
        const recentTime = Date.now() - this.config.groupInterval;

        return this.activeToasts.find(t =>
            t.group === group && t.lastUpdateAt >= recentTime
        );
    }

    // ============================================================
    // بخش ۹: تنظیمات
    // ============================================================

    /**
     * به‌روزرسانی پیکربندی
     * @param {Object} newConfig - پیکربندی جدید
     * @returns {Object} نتیجه
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };

        // به‌روزرسانی maxVisible
        if (newConfig.maxVisible !== undefined) {
            this.maxVisibleToasts = newConfig.maxVisible;
        }

        this._emit('config-updated', { config: this.config });

        if (this.debug) {
            console.log(' Toast Manager config updated');
        }

        return {
            success: true,
            config: this.config
        };
    }

    /**
     * فعال/غیرفعال کردن Toast Manager
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        this._emit('toast-manager-toggled', { enabled });

        if (this.debug) {
            console.log(` Toast Manager ${enabled ? 'enabled' : 'disabled'}`);
        }

        return {
            success: true,
            enabled
        };
    }

    /**
     * تغییر موقعیت پیش‌فرض
     * @param {string} position - موقعیت
     * @returns {Object} نتیجه
     */
    setDefaultPosition(position) {
        const validPositions = [
            'top-left', 'top-center', 'top-right',
            'bottom-left', 'bottom-center', 'bottom-right'
        ];

        if (!validPositions.includes(position)) {
            return {
                success: false,
                error: 'INVALID_POSITION',
                message: 'موقعیت نامعتبر است'
            };
        }

        return this.updateConfig({ defaultPosition: position });
    }

    /**
     * تغییر مدت زمان پیش‌فرض
     * @param {number} duration - مدت (میلی‌ثانیه)
     * @returns {Object} نتیجه
     */
    setDefaultDuration(duration) {
        if (duration < 0) {
            return {
                success: false,
                error: 'INVALID_DURATION',
                message: 'مدت زمان نمی‌تواند منفی باشد'
            };
        }

        return this.updateConfig({ defaultDuration: duration });
    }

    // ============================================================
    // بخش ۱۰: دریافت اطلاعات
    // ============================================================

    /**
     * دریافت Toast بر اساس شناسه
     * @param {string} toastId - شناسه
     * @returns {Object|null}
     */
    getToast(toastId) {
        return this.activeToasts.find(t => t.id === toastId) || null;
    }

    /**
     * دریافت تمام Toast های فعال
     * @returns {Array<Object>}
     */
    getActiveToasts() {
        return [...this.activeToasts];
    }

    /**
     * دریافت Toast ها بر اساس نوع
     * @param {string} type - نوع
     * @returns {Array<Object>}
     */
    getToastsByType(type) {
        return this.activeToasts.filter(t => t.type === type);
    }

    /**
     * دریافت Toast ها بر اساس موقعیت
     * @param {string} position - موقعیت
     * @returns {Array<Object>}
     */
    getToastsByPosition(position) {
        return this.activeToasts.filter(t => t.position === position);
    }

    // ============================================================
    // بخش ۱۱: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            activeToasts: this.activeToasts.length,
            queuedToasts: this.toastQueue.length,
            maxVisible: this.maxVisibleToasts,
            byType: this._getStatsByType(),
            byPosition: this._getStatsByPosition()
        };
    }

    /**
     * دریافت آمار بر اساس نوع
     * @returns {Object}
     * @private
     */
    _getStatsByType() {
        const stats = {};
        this.activeToasts.forEach(toast => {
            stats[toast.type] = (stats[toast.type] || 0) + 1;
        });
        return stats;
    }

    /**
     * دریافت آمار بر اساس موقعیت
     * @returns {Object}
     * @private
     */
    _getStatsByPosition() {
        const stats = {};
        this.activeToasts.forEach(toast => {
            stats[toast.position] = (stats[toast.position] || 0) + 1;
        });
        return stats;
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        return {
            enabled: this.enabled,
            activeToasts: this.activeToasts.length,
            queuedToasts: this.toastQueue.length,
            totalShown: this.stats.totalToastsShown,
            totalDismissed: this.stats.totalToastsDismissed,
            totalExpired: this.stats.totalToastsExpired
        };
    }

    // ============================================================
    // بخش ۱۲: توابع کمکی
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('toast_manager_stats', this.stats);
            storage.set('toast_manager_config', this.config);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const stats = storage.get('toast_manager_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            const config = storage.get('toast_manager_config');
            if (config) this.config = { ...this.config, ...config };
        }
    }

    // ============================================================
    // بخش ۱۳: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    async reset() {
        await this.dismissAllToasts();

        this.stats = {
            totalToastsShown: 0,
            totalToastsDismissed: 0,
            totalToastsExpired: 0,
            totalToastsClicked: 0,
            totalToastsActioned: 0,
            averageDisplayTime: 0,
            lastToastAt: null
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 ToastManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🍞 ToastManager Status:');
        console.log('  Enabled:', summary.enabled);
        console.log('  Active Toasts:', summary.activeToasts);
        console.log('  Queued Toasts:', summary.queuedToasts);
        console.log('  Total Shown:', summary.totalShown);
        console.log('  Total Dismissed:', summary.totalDismissed);
        console.log('  Total Expired:', summary.totalExpired);
        console.log('  By Type:', stats.byType);
        console.log('  By Position:', stats.byPosition);
    }

    // ============================================================
    // بخش ۱۴: Event System
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
                    console.error(`❌ Toast Manager event listener error:`, error);
                }
            });
        }

        eventBus.emit(`toast:${event}`, data);
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
const toastManager = new ToastManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ToastManager, toastManager };
} else {
    window.ToastManager = ToastManager;
    window.toastManager = toastManager;
}

console.log('✅ ToastManager loaded');
