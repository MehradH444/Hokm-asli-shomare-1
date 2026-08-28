/**
 * ============================================================
 * HOKM MASTER - Modal Manager
 * سیستم مدیریت مودال‌ها و پنجره‌های پاپ‌آپ
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل مودال‌ها در اپلیکیشن است. شامل
 * ثبت مودال‌ها، باز و بسته کردن، مدیریت stack، backdrop،
 * انیمیشن‌ها، focus trap، ESC key، مودال‌های تأیید/هشدار/فرم،
 * و آمار کامل.
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

class ModalManager {

    constructor() {
        /**
         * مودال‌های ثبت شده
         * @type {Map<string, Object>}
         */
        this.modals = new Map();

        /**
         * مودال‌های فعال (stack)
         * @type {Array<Object>}
         */
        this.activeModals = [];

        /**
         * حداکثر تعداد مودال همزمان
         * @type {number}
         */
        this.maxConcurrentModals = 5;

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
         * آیا Modal Manager فعال است
         * @type {boolean}
         */
        this.enabled = true;

        /**
         * آمار Modal Manager
         * @type {Object}
         */
        this.stats = {
            totalModalsRegistered: 0,
            totalModalsOpened: 0,
            totalModalsClosed: 0,
            totalConfirmations: 0,
            totalAlerts: 0,
            totalFormSubmissions: 0,
            averageOpenTime: 0,
            lastModalAt: null
        };

        /**
         * پیکربندی
         * @type {Object}
         */
        this.config = {
            enableBackdrop: true,
            enableCloseOnBackdrop: true,
            enableCloseOnEscape: true,
            enableFocusTrap: true,
            enableAnimations: true,
            animationDuration: 300,
            defaultSize: 'medium',
            defaultPosition: 'center'
        };

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // ثبت مودال‌های پیش‌فرض
        this._registerDefaultModals();

        // setup event listeners
        this._setupEventListeners();

        // ایجاد container مودال
        this._createModalContainer();

        if (this.debug) {
            console.log(' ModalManager initialized');
            console.log('  Registered Modals:', this.modals.size);
        }
    }

    // ============================================================
    // بخش ۱: ثبت مودال‌ها
    // ============================================================

    /**
     * ثبت مودال جدید
     * @param {Object} modalConfig - پیکربندی مودال
     * @returns {Object} نتیجه
     */
    registerModal(modalConfig) {
        const {
            name,
            title,
            content,
            size = this.config.defaultSize,
            position = this.config.defaultPosition,
            closable = true,
            closeOnBackdrop = true,
            closeOnEscape = true,
            showBackdrop = true,
            animation = 'fade',
            onOpen = null,
            onClose = null,
            onSubmit = null,
            onConfirm = null,
            onCancel = null,
            buttons = [],
            data = {},
            meta = {}
        } = modalConfig;

        if (!name) {
            return {
                success: false,
                error: 'INVALID_CONFIG',
                message: 'نام مودال الزامی است'
            };
        }

        const modal = {
            name,
            title: title || name,
            content: content || '',
            size,
            position,
            closable,
            closeOnBackdrop,
            closeOnEscape,
            showBackdrop,
            animation,
            lifecycle: {
                onOpen,
                onClose,
                onSubmit,
                onConfirm,
                onCancel
            },
            buttons,
            data: { ...data },
            meta: { ...meta },
            registeredAt: Date.now(),
            isOpen: false,
            openCount: 0,
            lastOpenedAt: null
        };

        this.modals.set(name, modal);
        this.stats.totalModalsRegistered++;

        this._emit('modal-registered', { modal });

        if (this.debug) {
            console.log(` Modal registered: ${name}`);
        }

        return {
            success: true,
            modal
        };
    }

    /**
     * ثبت چند مودال همزمان
     * @param {Array<Object>} modalConfigs - پیکربندی مودال‌ها
     * @returns {Object} نتیجه
     */
    registerModals(modalConfigs) {
        const results = [];

        modalConfigs.forEach(config => {
            results.push(this.registerModal(config));
        });

        return {
            success: true,
            results
        };
    }

    /**
     * حذف مودال
     * @param {string} modalName - نام مودال
     * @returns {Object} نتیجه
     */
    unregisterModal(modalName) {
        if (!this.modals.has(modalName)) {
            return {
                success: false,
                error: 'MODAL_NOT_FOUND',
                message: 'مودال یافت نشد'
            };
        }

        // اگر مودال باز است، ببند
        if (this.isModalOpen(modalName)) {
            this.closeModal(modalName);
        }

        this.modals.delete(modalName);

        this._emit('modal-unregistered', { modalName });

        if (this.debug) {
            console.log(`️ Modal unregistered: ${modalName}`);
        }

        return {
            success: true,
            modalName
        };
    }

    /**
     * دریافت مودال
     * @param {string} modalName - نام مودال
     * @returns {Object|null}
     */
    getModal(modalName) {
        return this.modals.get(modalName) || null;
    }

    /**
     * دریافت تمام مودال‌ها
     * @returns {Array<Object>}
     */
    getAllModals() {
        return Array.from(this.modals.values());
    }

    /**
     * بررسی وجود مودال
     * @param {string} modalName - نام مودال
     * @returns {boolean}
     */
    hasModal(modalName) {
        return this.modals.has(modalName);
    }

    // ============================================================
    // بخش ۲: باز و بسته کردن مودال
    // ============================================================

    /**
     * باز کردن مودال
     * @param {string} modalName - نام مودال
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    async openModal(modalName, options = {}) {
        if (!this.enabled) {
            return {
                success: false,
                error: 'MODAL_MANAGER_DISABLED',
                message: 'Modal Manager غیرفعال است'
            };
        }

        const modal = this.modals.get(modalName);
        if (!modal) {
            return {
                success: false,
                error: 'MODAL_NOT_FOUND',
                message: `مودال "${modalName}" یافت نشد`
            };
        }

        // بررسی محدودیت همزمان
        if (this.activeModals.length >= this.maxConcurrentModals) {
            return {
                success: false,
                error: 'MAX_MODALS_REACHED',
                message: `حداکثر ${this.maxConcurrentModals} مودال همزمان`
            };
        }

        const {
            data = {},
            skipLifecycle = false,
            skipAnimation = false
        } = options;

        // اجرای onOpen
        if (!skipLifecycle && modal.lifecycle.onOpen) {
            try {
                const result = await modal.lifecycle.onOpen(modal, data);
                if (result === false) {
                    return {
                        success: false,
                        error: 'ON_OPEN_REJECTED',
                        message: 'باز کردن مودال رد شد'
                    };
                }
            } catch (error) {
                console.error(`❌ onOpen failed for ${modalName}:`, error);
            }
        }

        // به‌روزرسانی وضعیت
        modal.isOpen = true;
        modal.openCount++;
        modal.lastOpenedAt = Date.now();

        // به‌روزرسانی داده‌ها
        modal.data = { ...modal.data, ...data };

        // اضافه کردن به stack
        this.activeModals.push(modal);

        // نمایش مودال
        this._renderModal(modal);

        // اعمال انیمیشن
        if (!skipAnimation && this.config.enableAnimations) {
            await this._animateModal(modal, 'open');
        }

        // focus trap
        if (this.config.enableFocusTrap) {
            this._setupFocusTrap(modal);
        }

        // به‌روزرسانی آمار
        this.stats.totalModalsOpened++;
        this.stats.lastModalAt = Date.now();

        this._emit('modal-opened', { modal, data });

        if (this.debug) {
            console.log(`✅ Modal opened: ${modalName}`);
        }

        return {
            success: true,
            modal,
            data
        };
    }

    /**
     * بستن مودال
     * @param {string} modalName - نام مودال
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    async closeModal(modalName, options = {}) {
        const modal = this.modals.get(modalName);
        if (!modal) {
            return {
                success: false,
                error: 'MODAL_NOT_FOUND',
                message: 'مودال یافت نشد'
            };
        }

        if (!modal.isOpen) {
            return {
                success: false,
                error: 'MODAL_NOT_OPEN',
                message: 'مودال باز نیست'
            };
        }

        const {
            skipLifecycle = false,
            skipAnimation = false
        } = options;

        // اجرای onClose
        if (!skipLifecycle && modal.lifecycle.onClose) {
            try {
                const result = await modal.lifecycle.onClose(modal);
                if (result === false) {
                    return {
                        success: false,
                        error: 'ON_CLOSE_REJECTED',
                        message: 'بستن مودال رد شد'
                    };
                }
            } catch (error) {
                console.error(` onClose failed for ${modalName}:`, error);
            }
        }

        // اعمال انیمیشن
        if (!skipAnimation && this.config.enableAnimations) {
            await this._animateModal(modal, 'close');
        }

        // به‌روزرسانی وضعیت
        modal.isOpen = false;

        // حذف از stack
        this.activeModals = this.activeModals.filter(m => m.name !== modalName);

        // حذف از DOM
        this._removeModalFromDOM(modal);

        // حذف focus trap
        if (this.config.enableFocusTrap) {
            this._removeFocusTrap(modal);
        }

        // به‌روزرسانی آمار
        this.stats.totalModalsClosed++;

        this._emit('modal-closed', { modal });

        if (this.debug) {
            console.log(` Modal closed: ${modalName}`);
        }

        return {
            success: true,
            modal
        };
    }

    /**
     * بستن تمام مودال‌ها
     * @returns {number} تعداد بسته شده
     */
    async closeAllModals() {
        const count = this.activeModals.length;

        // بستن از بالا به پایین
        for (let i = this.activeModals.length - 1; i >= 0; i--) {
            const modal = this.activeModals[i];
            await this.closeModal(modal.name);
        }

        if (this.debug) {
            console.log(`🗑️ All modals closed: ${count}`);
        }

        return count;
    }

    /**
     * بررسی آیا مودال باز است
     * @param {string} modalName - نام مودال
     * @returns {boolean}
     */
    isModalOpen(modalName) {
        const modal = this.modals.get(modalName);
        return modal?.isOpen || false;
    }

    /**
     * دریافت مودال فعال فعلی
     * @returns {Object|null}
     */
    getActiveModal() {
        return this.activeModals[this.activeModals.length - 1] || null;
    }

    /**
     * دریافت تمام مودال‌های فعال
     * @returns {Array<Object>}
     */
    getActiveModals() {
        return [...this.activeModals];
    }

    // ============================================================
    // بخش ۳: مودال‌های پیش‌ساخته
    // ============================================================

    /**
     * نمایش مودال تأیید
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<boolean>}
     */
    async confirm(options = {}) {
        const {
            title = 'تأیید',
            message = 'آیا مطمئن هستید؟',
            confirmText = 'تأیید',
            cancelText = 'انصراف',
            type = 'warning' // warning, danger, info, success
        } = options;

        return new Promise((resolve) => {
            const modalName = `confirm_${Date.now()}`;

            this.registerModal({
                name: modalName,
                title,
                content: message,
                size: 'small',
                buttons: [
                    {
                        text: cancelText,
                        action: 'cancel',
                        variant: 'secondary'
                    },
                    {
                        text: confirmText,
                        action: 'confirm',
                        variant: type === 'danger' ? 'danger' : 'primary'
                    }
                ],
                onConfirm: () => {
                    this.closeModal(modalName);
                    resolve(true);
                },
                onCancel: () => {
                    this.closeModal(modalName);
                    resolve(false);
                }
            });

            this.openModal(modalName);
            this.stats.totalConfirmations++;
        });
    }

    /**
     * نمایش مودال هشدار
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<void>}
     */
    async alert(options = {}) {
        const {
            title = 'هشدار',
            message = '',
            okText = 'متوجه شدم',
            type = 'info' // info, warning, error, success
        } = options;

        return new Promise((resolve) => {
            const modalName = `alert_${Date.now()}`;

            this.registerModal({
                name: modalName,
                title,
                content: message,
                size: 'small',
                buttons: [
                    {
                        text: okText,
                        action: 'ok',
                        variant: 'primary'
                    }
                ],
                onSubmit: () => {
                    this.closeModal(modalName);
                    resolve();
                }
            });

            this.openModal(modalName);
            this.stats.totalAlerts++;
        });
    }

    /**
     * نمایش مودال فرم
     * @param {Object} options - گزینه‌ها
     * @returns {Promise<Object>}
     */
    async form(options = {}) {
        const {
            title = 'فرم',
            fields = [],
            submitText = 'ثبت',
            cancelText = 'انصراف'
        } = options;

        return new Promise((resolve) => {
            const modalName = `form_${Date.now()}`;

            this.registerModal({
                name: modalName,
                title,
                content: this._generateFormContent(fields),
                size: 'medium',
                buttons: [
                    {
                        text: cancelText,
                        action: 'cancel',
                        variant: 'secondary'
                    },
                    {
                        text: submitText,
                        action: 'submit',
                        variant: 'primary'
                    }
                ],
                onSubmit: (formData) => {
                    this.closeModal(modalName);
                    resolve(formData);
                },
                onCancel: () => {
                    this.closeModal(modalName);
                    resolve(null);
                }
            });

            this.openModal(modalName);
            this.stats.totalFormSubmissions++;
        });
    }

    /**
     * تولید محتوای فرم
     * @param {Array} fields - فیلدها
     * @returns {string} HTML
     * @private
     */
    _generateFormContent(fields) {
        let html = '<div class="modal-form">';

        fields.forEach(field => {
            html += `<div class="form-group">`;
            html += `<label for="${field.name}">${field.label}</label>`;

            if (field.type === 'textarea') {
                html += `<textarea id="${field.name}" name="${field.name}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></textarea>`;
            } else if (field.type === 'select') {
                html += `<select id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>`;
                html += `<option value="">انتخاب کنید</option>`;
                field.options?.forEach(opt => {
                    html += `<option value="${opt.value}">${opt.label}</option>`;
                });
                html += `</select>`;
            } else if (field.type === 'checkbox') {
                html += `<input type="checkbox" id="${field.name}" name="${field.name}" />`;
            } else {
                html += `<input type="${field.type || 'text'}" id="${field.name}" name="${field.name}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} />`;
            }

            html += `</div>`;
        });

        html += '</div>';
        return html;
    }

    // ============================================================
    // بخش ۴: رندر و انیمیشن
    // ============================================================

    /**
     * نمایش مودال در DOM
     * @param {Object} modal - مودال
     * @private
     */
    _renderModal(modal) {
        const container = document.getElementById('modal-container');
        if (!container) return;

        const modalElement = document.createElement('div');
        modalElement.id = `modal-${modal.name}`;
        modalElement.className = `modal modal-${modal.size} modal-${modal.position}`;
        modalElement.dataset.modalName = modal.name;

        // Backdrop
        if (modal.showBackdrop) {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.addEventListener('click', () => {
                if (modal.closeOnBackdrop) {
                    this.closeModal(modal.name);
                }
            });
            modalElement.appendChild(backdrop);
        }

        // Content
        const content = document.createElement('div');
        content.className = 'modal-content';

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `
            <h3 class="modal-title">${modal.title}</h3>
            ${modal.closable ? '<button class="modal-close" aria-label="بستن">&times;</button>' : ''}
        `;

        const closeBtn = header.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal(modal.name);
            });
        }

        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        body.innerHTML = modal.content;

        // Footer (buttons)
        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        modal.buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = `btn btn-${button.variant || 'secondary'}`;
            btn.textContent = button.text;
            btn.addEventListener('click', () => {
                this._handleModalButton(modal, button);
            });
            footer.appendChild(btn);
        });

        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(footer);
        modalElement.appendChild(content);

        container.appendChild(modalElement);
    }

    /**
     * حذف مودال از DOM
     * @param {Object} modal - مودال
     * @private
     */
    _removeModalFromDOM(modal) {
        const modalElement = document.getElementById(`modal-${modal.name}`);
        if (modalElement) {
            modalElement.remove();
        }
    }

    /**
     * اعمال انیمیشن مودال
     * @param {Object} modal - مودال
     * @param {string} direction - جهت (open/close)
     * @returns {Promise<void>}
     * @private
     */
    async _animateModal(modal, direction) {
        const modalElement = document.getElementById(`modal-${modal.name}`);
        if (!modalElement) return;

        const animation = modal.animation || 'fade';
        const duration = this.config.animationDuration;

        modalElement.classList.add(`modal-${animation}-${direction}`);

        await Utils.sleep(duration);

        modalElement.classList.remove(`modal-${animation}-${direction}`);
    }

    /**
     * مدیریت کلیک دکمه مودال
     * @param {Object} modal - مودال
     * @param {Object} button - دکمه
     * @private
     */
    _handleModalButton(modal, button) {
        switch (button.action) {
            case 'confirm':
                if (modal.lifecycle.onConfirm) {
                    modal.lifecycle.onConfirm(modal.data);
                }
                break;
            case 'cancel':
                if (modal.lifecycle.onCancel) {
                    modal.lifecycle.onCancel();
                }
                break;
            case 'submit':
                if (modal.lifecycle.onSubmit) {
                    const formData = this._collectFormData(modal);
                    modal.lifecycle.onSubmit(formData);
                }
                break;
            case 'ok':
                if (modal.lifecycle.onSubmit) {
                    modal.lifecycle.onSubmit();
                }
                break;
            default:
                if (button.onClick) {
                    button.onClick(modal.data);
                }
        }
    }

    /**
     * جمع‌آوری داده‌های فرم
     * @param {Object} modal - مودال
     * @returns {Object}
     * @private
     */
    _collectFormData(modal) {
        const modalElement = document.getElementById(`modal-${modal.name}`);
        if (!modalElement) return {};

        const formData = {};
        const inputs = modalElement.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                formData[input.name] = input.checked;
            } else {
                formData[input.name] = input.value;
            }
        });

        return formData;
    }

    // ============================================================
    // بخش ۵: Focus Trap
    // ============================================================

    /**
     * setup focus trap
     * @param {Object} modal - مودال
     * @private
     */
    _setupFocusTrap(modal) {
        const modalElement = document.getElementById(`modal-${modal.name}`);
        if (!modalElement) return;

        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Focus روی اولین عنصر
        firstElement.focus();

        // ذخیره برای حذف بعدی
        modal._focusTrapHandler = (event) => {
            if (event.key === 'Tab') {
                if (event.shiftKey) {
                    if (document.activeElement === firstElement) {
                        event.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        modalElement.addEventListener('keydown', modal._focusTrapHandler);
    }

    /**
     * حذف focus trap
     * @param {Object} modal - مودال
     * @private
     */
    _removeFocusTrap(modal) {
        const modalElement = document.getElementById(`modal-${modal.name}`);
        if (modalElement && modal._focusTrapHandler) {
            modalElement.removeEventListener('keydown', modal._focusTrapHandler);
            delete modal._focusTrapHandler;
        }
    }

    // ============================================================
    // بخش ۶: Event Listeners
    // ============================================================

    /**
     * setup event listeners
     * @private
     */
    _setupEventListeners() {
        if (typeof document === 'undefined') return;

        // ESC key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.config.enableCloseOnEscape) {
                const activeModal = this.getActiveModal();
                if (activeModal && activeModal.closeOnEscape) {
                    this.closeModal(activeModal.name);
                }
            }
        });
    }

    /**
     * ایجاد container مودال
     * @private
     */
    _createModalContainer() {
        if (typeof document === 'undefined') return;

        let container = document.getElementById('modal-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'modal-container';
            container.className = 'modal-container';
            document.body.appendChild(container);
        }
    }

    // ============================================================
    // بخش ۷: ثبت مودال‌های پیش‌فرض
    // ============================================================

    /**
     * ثبت مودال‌های پیش‌فرض
     * @private
     */
    _registerDefaultModals() {
        const defaultModals = [
            {
                name: 'settings',
                title: 'تنظیمات',
                size: 'large',
                closable: true,
                animation: 'slide-up'
            },
            {
                name: 'profile-edit',
                title: 'ویرایش پروفایل',
                size: 'medium',
                closable: true,
                animation: 'fade'
            },
            {
                name: 'item-details',
                title: 'جزئیات آیتم',
                size: 'medium',
                closable: true,
                animation: 'fade'
            },
            {
                name: 'purchase-confirm',
                title: 'تأیید خرید',
                size: 'small',
                closable: true,
                animation: 'fade'
            },
            {
                name: 'game-invite',
                title: 'دعوت به بازی',
                size: 'small',
                closable: true,
                animation: 'slide-up'
            },
            {
                name: 'friend-request',
                title: 'درخواست دوستی',
                size: 'small',
                closable: true,
                animation: 'fade'
            },
            {
                name: 'tournament-info',
                title: 'اطلاعات تورنمنت',
                size: 'large',
                closable: true,
                animation: 'slide-up'
            },
            {
                name: 'reward-claim',
                title: 'دریافت پاداش',
                size: 'small',
                closable: true,
                animation: 'fade'
            },
            {
                name: 'tutorial',
                title: 'آموزش',
                size: 'large',
                closable: true,
                animation: 'slide-up'
            },
            {
                name: 'help',
                title: 'راهنما',
                size: 'medium',
                closable: true,
                animation: 'fade'
            }
        ];

        this.registerModals(defaultModals);
    }

    // ============================================================
    // بخش ۸: تنظیمات
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

        this._emit('config-updated', { config: this.config });

        if (this.debug) {
            console.log('🪟 Modal Manager config updated');
        }

        return {
            success: true,
            config: this.config
        };
    }

    /**
     * فعال/غیرفعال کردن Modal Manager
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        this._emit('modal-manager-toggled', { enabled });

        if (this.debug) {
            console.log(` Modal Manager ${enabled ? 'enabled' : 'disabled'}`);
        }

        return {
            success: true,
            enabled
        };
    }

    // ============================================================
    // بخش ۹: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            totalModals: this.modals.size,
            activeModals: this.activeModals.length,
            maxConcurrentModals: this.maxConcurrentModals
        };
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        return {
            enabled: this.enabled,
            activeModals: this.activeModals.length,
            totalModals: this.modals.size,
            totalOpened: this.stats.totalModalsOpened,
            totalClosed: this.stats.totalModalsClosed
        };
    }

    /**
     * دریافت پرکاربردترین مودال‌ها
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getTopModals(limit = 10) {
        return Array.from(this.modals.values())
            .sort((a, b) => b.openCount - a.openCount)
            .slice(0, limit);
    }

    // ============================================================
    // بخش ۱۰: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    async reset() {
        await this.closeAllModals();
        this.modals.clear();
        this.activeModals = [];

        this.stats = {
            totalModalsRegistered: 0,
            totalModalsOpened: 0,
            totalModalsClosed: 0,
            totalConfirmations: 0,
            totalAlerts: 0,
            totalFormSubmissions: 0,
            averageOpenTime: 0,
            lastModalAt: null
        };

        this._registerDefaultModals();

        if (this.debug) {
            console.log('🔄 ModalManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🪟 ModalManager Status:');
        console.log('  Enabled:', summary.enabled);
        console.log('  Active Modals:', summary.activeModals);
        console.log('  Total Modals:', summary.totalModals);
        console.log('  Total Opened:', summary.totalOpened);
        console.log('  Total Closed:', summary.totalClosed);
        console.log('  Max Concurrent:', stats.maxConcurrentModals);
    }

    // ============================================================
    // بخش ۱۱: Event System
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
                    console.error(` Modal Manager event listener error:`, error);
                }
            });
        }

        eventBus.emit(`modal-manager:${event}`, data);
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
const modalManager = new ModalManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModalManager, modalManager };
} else {
    window.ModalManager = ModalManager;
    window.modalManager = modalManager;
}

console.log('✅ ModalManager loaded - 10 default modals registered');
