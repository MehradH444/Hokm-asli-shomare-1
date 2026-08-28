/**
 * ============================================================
 * HOKM MASTER - Animation Manager
 * سیستم مدیریت انیمیشن‌های رابط کاربری
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل انیمیشن‌ها در اپلیکیشن است.
 * شامل انواع انیمیشن (fade, slide, scale, rotate, bounce,
 * shake)، کنترل انیمیشن (play, pause, stop, reverse)،
 * انیمیشن‌های ترکیبی، easing functions، timeline management،
 * بهینه‌سازی performance، و آمار کامل.
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

class AnimationManager {

    constructor() {
        /**
         * انیمیشن‌های فعال
         * @type {Map<string, Object>}
         */
        this.activeAnimations = new Map();

        /**
         * انیمیشن‌های ثبت شده
         * @type {Map<string, Object>}
         */
        this.registeredAnimations = new Map();

        /**
         * Easing functions
         * @type {Object}
         */
        this.easingFunctions = this._defineEasingFunctions();

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
         * آیا Animation Manager فعال است
         * @type {boolean}
         */
        this.enabled = true;

        /**
         * آیا انیمیشن‌ها فعال هستند
         * @type {boolean}
         */
        this.animationsEnabled = true;

        /**
         * آمار Animation Manager
         * @type {Object}
         */
        this.stats = {
            totalAnimationsCreated: 0,
            totalAnimationsPlayed: 0,
            totalAnimationsCompleted: 0,
            totalAnimationsCancelled: 0,
            totalAnimationsPaused: 0,
            averageDuration: 0,
            currentActiveCount: 0,
            lastAnimationAt: null
        };

        /**
         * پیکربندی
         * @type {Object}
         */
        this.config = {
            enableAnimations: true,
            enableReducedMotion: false,
            enablePerformanceOptimization: true,
            maxConcurrentAnimations: 20,
            defaultDuration: 300,
            defaultEasing: 'ease-in-out',
            enableGPUAcceleration: true,
            enableRequestAnimationFrame: true,
            fpsLimit: 60
        };

        /**
         * Animation frame ID
         * @type {number|null}
         */
        this.animationFrameId = null;

        /**
         * آخرین زمان frame
         * @type {number}
         */
        this.lastFrameTime = 0;

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // بررسی reduced motion
        this._checkReducedMotion();

        // شروع animation loop
        if (this.config.enableRequestAnimationFrame) {
            this._startAnimationLoop();
        }

        // بارگذاری داده‌ها
        this._loadData();

        if (this.debug) {
            console.log('🎬 AnimationManager initialized');
            console.log('  Animations Enabled:', this.animationsEnabled);
            console.log('  Reduced Motion:', this.config.enableReducedMotion);
        }
    }

    // ============================================================
    // بخش ۱: تعریف Easing Functions
    // ============================================================

    /**
     * تعریف توابع easing
     * @returns {Object}
     * @private
     */
    _defineEasingFunctions() {
        return {
            'linear': (t) => t,
            'ease-in': (t) => t * t,
            'ease-out': (t) => t * (2 - t),
            'ease-in-out': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            'ease-in-quad': (t) => t * t,
            'ease-out-quad': (t) => t * (2 - t),
            'ease-in-out-quad': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            'ease-in-cubic': (t) => t * t * t,
            'ease-out-cubic': (t) => (--t) * t * t + 1,
            'ease-in-out-cubic': (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
            'ease-in-quart': (t) => t * t * t * t,
            'ease-out-quart': (t) => 1 - (--t) * t * t * t,
            'ease-in-out-quart': (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
            'ease-in-quint': (t) => t * t * t * t * t,
            'ease-out-quint': (t) => 1 + (--t) * t * t * t * t,
            'ease-in-out-quint': (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
            'ease-in-sine': (t) => 1 - Math.cos((t * Math.PI) / 2),
            'ease-out-sine': (t) => Math.sin((t * Math.PI) / 2),
            'ease-in-out-sine': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
            'ease-in-expo': (t) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
            'ease-out-expo': (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
            'ease-in-out-expo': (t) => {
                if (t === 0) return 0;
                if (t === 1) return 1;
                return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
            },
            'ease-in-circ': (t) => 1 - Math.sqrt(1 - t * t),
            'ease-out-circ': (t) => Math.sqrt(1 - (--t) * t),
            'ease-in-out-circ': (t) => t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
            'ease-in-back': (t) => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return c3 * t * t * t - c1 * t * t;
            },
            'ease-out-back': (t) => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            },
            'ease-in-out-back': (t) => {
                const c1 = 1.70158;
                const c2 = c1 * 1.525;
                return t < 0.5
                    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
                    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
            },
            'ease-in-elastic': (t) => {
                if (t === 0) return 0;
                if (t === 1) return 1;
                return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3));
            },
            'ease-out-elastic': (t) => {
                if (t === 0) return 0;
                if (t === 1) return 1;
                return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
            },
            'ease-in-bounce': (t) => 1 - this.easingFunctions['ease-out-bounce'](1 - t),
            'ease-out-bounce': (t) => {
                const n1 = 7.5625;
                const d1 = 2.75;
                if (t < 1 / d1) return n1 * t * t;
                else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
                else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
                else return n1 * (t -= 2.625 / d1) * t + 0.984375;
            },
            'ease-in-out-bounce': (t) => {
                return t < 0.5
                    ? (1 - this.easingFunctions['ease-out-bounce'](1 - 2 * t)) / 2
                    : (1 + this.easingFunctions['ease-out-bounce'](2 * t - 1)) / 2;
            }
        };
    }

    // ============================================================
    // بخش ۲: ایجاد انیمیشن
    // ============================================================

    /**
     * ایجاد انیمیشن جدید
     * @param {Object} animationConfig - پیکربندی انیمیشن
     * @returns {Object} نتیجه
     */
    createAnimation(animationConfig) {
        if (!this.enabled || !this.animationsEnabled) {
            return {
                success: false,
                error: 'ANIMATIONS_DISABLED',
                message: 'انیمیشن‌ها غیرفعال هستند'
            };
        }

        // بررسی reduced motion
        if (this.config.enableReducedMotion) {
            return {
                success: false,
                error: 'REDUCED_MOTION',
                message: 'انیمیشن‌ها به دلیل reduced motion غیرفعال هستند'
            };
        }

        // بررسی محدودیت همزمان
        if (this.activeAnimations.size >= this.config.maxConcurrentAnimations) {
            return {
                success: false,
                error: 'MAX_ANIMATIONS_REACHED',
                message: `حداکثر ${this.config.maxConcurrentAnimations} انیمیشن همزمان`
            };
        }

        const {
            name,
            element,
            type,
            duration = this.config.defaultDuration,
            delay = 0,
            easing = this.config.defaultEasing,
            iterations = 1,
            direction = 'normal',
            fillMode = 'none',
            properties = {},
            keyframes = null,
            onStart = null,
            onUpdate = null,
            onComplete = null,
            onCancel = null,
            data = {}
        } = animationConfig;

        if (!element) {
            return {
                success: false,
                error: 'NO_ELEMENT',
                message: 'عنصر برای انیمیشن الزامی است'
            };
        }

        const animation = {
            id: Utils.generateUUID(),
            name: name || `${type}_${Date.now()}`,
            element,
            type,
            duration,
            delay,
            easing,
            iterations,
            direction,
            fillMode,
            properties,
            keyframes,
            lifecycle: {
                onStart,
                onUpdate,
                onComplete,
                onCancel
            },
            data: { ...data },
            createdAt: Date.now(),
            startTime: null,
            currentTime: 0,
            progress: 0,
            isPlaying: false,
            isPaused: false,
            isCompleted: false,
            isCancelled: false,
            currentIteration: 0,
            animationFrameId: null
        };

        this.activeAnimations.set(animation.id, animation);
        this.stats.totalAnimationsCreated++;

        this._emit('animation-created', { animation });

        if (this.debug) {
            console.log(`🎬 Animation created: ${animation.name}`);
        }

        return {
            success: true,
            animation
        };
    }

    /**
     * ایجاد انیمیشن fade
     * @param {HTMLElement} element - عنصر
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    fade(element, options = {}) {
        const {
            from = 0,
            to = 1,
            duration = 300,
            easing = 'ease-in-out'
        } = options;

        return this.createAnimation({
            element,
            type: 'fade',
            duration,
            easing,
            properties: {
                opacity: { from, to }
            }
        });
    }

    /**
     * ایجاد انیمیشن slide
     * @param {HTMLElement} element - عنصر
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    slide(element, options = {}) {
        const {
            direction = 'left', // left, right, up, down
            distance = 100,
            duration = 300,
            easing = 'ease-in-out'
        } = options;

        const property = direction === 'left' || direction === 'right' ? 'translateX' : 'translateY';
        const value = (direction === 'left' || direction === 'up') ? -distance : distance;

        return this.createAnimation({
            element,
            type: 'slide',
            duration,
            easing,
            properties: {
                transform: {
                    from: `${property}(${value}px)`,
                    to: `${property}(0px)`
                }
            }
        });
    }

    /**
     * ایجاد انیمیشن scale
     * @param {HTMLElement} element - عنصر
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    scale(element, options = {}) {
        const {
            from = 0,
            to = 1,
            duration = 300,
            easing = 'ease-in-out'
        } = options;

        return this.createAnimation({
            element,
            type: 'scale',
            duration,
            easing,
            properties: {
                transform: {
                    from: `scale(${from})`,
                    to: `scale(${to})`
                }
            }
        });
    }

    /**
     * ایجاد انیمیشن rotate
     * @param {HTMLElement} element - عنصر
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    rotate(element, options = {}) {
        const {
            from = 0,
            to = 360,
            duration = 500,
            easing = 'ease-in-out'
        } = options;

        return this.createAnimation({
            element,
            type: 'rotate',
            duration,
            easing,
            properties: {
                transform: {
                    from: `rotate(${from}deg)`,
                    to: `rotate(${to}deg)`
                }
            }
        });
    }

    /**
     * ایجاد انیمیشن bounce
     * @param {HTMLElement} element - عنصر
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    bounce(element, options = {}) {
        const {
            distance = 50,
            duration = 600,
            easing = 'ease-out-bounce'
        } = options;

        return this.createAnimation({
            element,
            type: 'bounce',
            duration,
            easing,
            properties: {
                transform: {
                    from: `translateY(-${distance}px)`,
                    to: 'translateY(0)'
                }
            }
        });
    }

    /**
     * ایجاد انیمیشن shake
     * @param {HTMLElement} element - عنصر
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    shake(element, options = {}) {
        const {
            intensity = 10,
            duration = 500,
            iterations = 3
        } = options;

        return this.createAnimation({
            element,
            type: 'shake',
            duration,
            iterations,
            easing: 'ease-in-out',
            keyframes: [
                { transform: 'translateX(0)' },
                { transform: `translateX(-${intensity}px)` },
                { transform: `translateX(${intensity}px)` },
                { transform: `translateX(-${intensity}px)` },
                { transform: `translateX(${intensity}px)` },
                { transform: 'translateX(0)' }
            ]
        });
    }

    /**
     * ایجاد انیمیشن pulse
     * @param {HTMLElement} element - عنصر
     * @param {Object} options - گزینه‌ها
     * @returns {Object}
     */
    pulse(element, options = {}) {
        const {
            scale = 1.1,
            duration = 500,
            iterations = 2
        } = options;

        return this.createAnimation({
            element,
            type: 'pulse',
            duration,
            iterations,
            easing: 'ease-in-out',
            keyframes: [
                { transform: 'scale(1)' },
                { transform: `scale(${scale})` },
                { transform: 'scale(1)' }
            ]
        });
    }

    // ============================================================
    // بخش : کنترل انیمیشن
    // ============================================================

    /**
     * پخش انیمیشن
     * @param {string} animationId - شناسه انیمیشن
     * @returns {Object} نتیجه
     */
    playAnimation(animationId) {
        const animation = this.activeAnimations.get(animationId);
        if (!animation) {
            return {
                success: false,
                error: 'ANIMATION_NOT_FOUND',
                message: 'انیمیشن یافت نشد'
            };
        }

        if (animation.isPlaying) {
            return {
                success: false,
                error: 'ALREADY_PLAYING',
                message: 'انیمیشن در حال پخش است'
            };
        }

        // اجرای onStart
        if (animation.lifecycle.onStart) {
            try {
                animation.lifecycle.onStart(animation);
            } catch (error) {
                console.error(' onStart error:', error);
            }
        }

        animation.isPlaying = true;
        animation.isPaused = false;
        animation.isCompleted = false;
        animation.isCancelled = false;
        animation.startTime = Date.now() - animation.currentTime;

        // شروع animation loop
        this._animateFrame(animation);

        this.stats.totalAnimationsPlayed++;
        this.stats.lastAnimationAt = Date.now();

        this._emit('animation-played', { animation });

        if (this.debug) {
            console.log(`▶️ Animation played: ${animation.name}`);
        }

        return {
            success: true,
            animation
        };
    }

    /**
     * توقف موقت انیمیشن
     * @param {string} animationId - شناسه انیمیشن
     * @returns {Object} نتیجه
     */
    pauseAnimation(animationId) {
        const animation = this.activeAnimations.get(animationId);
        if (!animation) {
            return {
                success: false,
                error: 'ANIMATION_NOT_FOUND',
                message: 'انیمیشن یافت نشد'
            };
        }

        if (!animation.isPlaying || animation.isPaused) {
            return {
                success: false,
                error: 'NOT_PLAYING',
                message: 'انیمیشن در حال پخش نیست'
            };
        }

        animation.isPaused = true;
        animation.isPlaying = false;

        // متوقف کردن animation frame
        if (animation.animationFrameId) {
            cancelAnimationFrame(animation.animationFrameId);
            animation.animationFrameId = null;
        }

        this.stats.totalAnimationsPaused++;

        this._emit('animation-paused', { animation });

        if (this.debug) {
            console.log(`⏸️ Animation paused: ${animation.name}`);
        }

        return {
            success: true,
            animation
        };
    }

    /**
     * ادامه انیمیشن متوقف شده
     * @param {string} animationId - شناسه انیمیشن
     * @returns {Object} نتیجه
     */
    resumeAnimation(animationId) {
        const animation = this.activeAnimations.get(animationId);
        if (!animation) {
            return {
                success: false,
                error: 'ANIMATION_NOT_FOUND',
                message: 'انیمیشن یافت نشد'
            };
        }

        if (!animation.isPaused) {
            return {
                success: false,
                error: 'NOT_PAUSED',
                message: 'انیمیشن متوقف نیست'
            };
        }

        return this.playAnimation(animationId);
    }

    /**
     * توقف کامل انیمیشن
     * @param {string} animationId - شناسه انیمیشن
     * @returns {Object} نتیجه
     */
    stopAnimation(animationId) {
        const animation = this.activeAnimations.get(animationId);
        if (!animation) {
            return {
                success: false,
                error: 'ANIMATION_NOT_FOUND',
                message: 'انیمیشن یافت نشد'
            };
        }

        // متوقف کردن animation frame
        if (animation.animationFrameId) {
            cancelAnimationFrame(animation.animationFrameId);
            animation.animationFrameId = null;
        }

        animation.isPlaying = false;
        animation.isPaused = false;
        animation.isCompleted = false;
        animation.isCancelled = true;
        animation.currentTime = 0;
        animation.progress = 0;

        // اجرای onCancel
        if (animation.lifecycle.onCancel) {
            try {
                animation.lifecycle.onCancel(animation);
            } catch (error) {
                console.error('❌ onCancel error:', error);
            }
        }

        // حذف از لیست فعال
        this.activeAnimations.delete(animationId);

        this.stats.totalAnimationsCancelled++;

        this._emit('animation-stopped', { animation });

        if (this.debug) {
            console.log(`⏹️ Animation stopped: ${animation.name}`);
        }

        return {
            success: true,
            animation
        };
    }

    /**
     * معکوس کردن انیمیشن
     * @param {string} animationId - شناسه انیمیشن
     * @returns {Object} نتیجه
     */
    reverseAnimation(animationId) {
        const animation = this.activeAnimations.get(animationId);
        if (!animation) {
            return {
                success: false,
                error: 'ANIMATION_NOT_FOUND',
                message: 'انیمیشن یافت نشد'
            };
        }

        // معکوس کردن direction
        if (animation.direction === 'normal') {
            animation.direction = 'reverse';
        } else if (animation.direction === 'reverse') {
            animation.direction = 'normal';
        }

        this._emit('animation-reversed', { animation });

        if (this.debug) {
            console.log(`🔄 Animation reversed: ${animation.name}`);
        }

        return {
            success: true,
            animation
        };
    }

    /**
     * توقف تمام انیمیشن‌ها
     * @returns {number} تعداد متوقف شده
     */
    async stopAllAnimations() {
        const count = this.activeAnimations.size;
        const animationIds = Array.from(this.activeAnimations.keys());

        for (const id of animationIds) {
            this.stopAnimation(id);
        }

        if (this.debug) {
            console.log(`⏹️ All animations stopped: ${count}`);
        }

        return count;
    }

    // ============================================================
    // بخش ۴: Animation Loop
    // ============================================================

    /**
     * شروع animation loop
     * @private
     */
    _startAnimationLoop() {
        const loop = (timestamp) => {
            if (!this.enabled || !this.animationsEnabled) {
                this.animationFrameId = null;
                return;
            }

            // محاسبه delta time
            const deltaTime = timestamp - this.lastFrameTime;
            this.lastFrameTime = timestamp;

            // به‌روزرسانی تمام انیمیشن‌های فعال
            this.activeAnimations.forEach((animation, id) => {
                if (animation.isPlaying && !animation.isPaused) {
                    this._updateAnimation(animation, deltaTime);
                }
            });

            this.animationFrameId = requestAnimationFrame(loop);
        };

        this.animationFrameId = requestAnimationFrame(loop);
    }

    /**
     * به‌روزرسانی یک انیمیشن
     * @param {Object} animation - انیمیشن
     * @param {number} deltaTime - delta time
     * @private
     */
    _updateAnimation(animation, deltaTime) {
        // محاسبه زمان فعلی
        animation.currentTime = Date.now() - animation.startTime;

        // بررسی delay
        if (animation.currentTime < animation.delay) {
            return;
        }

        // محاسبه progress
        const adjustedTime = animation.currentTime - animation.delay;
        animation.progress = Math.min(1, adjustedTime / animation.duration);

        // اعمال easing
        const easingFn = this.easingFunctions[animation.easing] || this.easingFunctions['ease-in-out'];
        const easedProgress = easingFn(animation.progress);

        // اعمال direction
        let finalProgress = easedProgress;
        if (animation.direction === 'reverse') {
            finalProgress = 1 - easedProgress;
        } else if (animation.direction === 'alternate') {
            finalProgress = animation.currentIteration % 2 === 0 ? easedProgress : 1 - easedProgress;
        }

        // به‌روزرسانی عنصر
        this._applyAnimationProperties(animation, finalProgress);

        // اجرای onUpdate
        if (animation.lifecycle.onUpdate) {
            try {
                animation.lifecycle.onUpdate(animation, finalProgress);
            } catch (error) {
                console.error('❌ onUpdate error:', error);
            }
        }

        // بررسی تکمیل
        if (animation.progress >= 1) {
            animation.currentIteration++;

            if (animation.currentIteration >= animation.iterations) {
                this._completeAnimation(animation);
            } else {
                // شروع iteration بعدی
                animation.startTime = Date.now();
                animation.progress = 0;
            }
        }
    }

    /**
     * اعمال خواص انیمیشن بر روی عنصر
     * @param {Object} animation - انیمیشن
     * @param {number} progress - پیشرفت
     * @private
     */
    _applyAnimationProperties(animation, progress) {
        const { element, properties, keyframes } = animation;

        if (!element) return;

        // اگر keyframes دارد
        if (keyframes && keyframes.length > 0) {
            const keyframeIndex = Math.floor(progress * (keyframes.length - 1));
            const keyframe = keyframes[keyframeIndex];

            for (const [property, value] of Object.entries(keyframe)) {
                element.style[property] = value;
            }

            return;
        }

        // اعمال properties
        for (const [property, config] of Object.entries(properties)) {
            const { from, to } = config;

            if (typeof from === 'number' && typeof to === 'number') {
                // انیمیشن عددی
                const currentValue = from + (to - from) * progress;
                element.style[property] = currentValue;
            } else if (typeof from === 'string' && typeof to === 'string') {
                // انیمیشن رشته‌ای (مثل transform)
                element.style[property] = this._interpolateString(from, to, progress);
            }
        }

        // GPU acceleration
        if (this.config.enableGPUAcceleration) {
            element.style.willChange = 'transform, opacity';
        }
    }

    /**
     * درون‌یابی رشته
     * @param {string} from - مقدار مبدأ
     * @param {string} to - مقدار مقصد
     * @param {number} progress - پیشرفت
     * @returns {string}
     * @private
     */
    _interpolateString(from, to, progress) {
        // استخراج اعداد از رشته
        const fromNumbers = from.match(/-?\d+(\.\d+)?/g) || [];
        const toNumbers = to.match(/-?\d+(\.\d+)?/g) || [];

        if (fromNumbers.length !== toNumbers.length) {
            return progress < 0.5 ? from : to;
        }

        let result = to;
        for (let i = 0; i < fromNumbers.length; i++) {
            const fromNum = parseFloat(fromNumbers[i]);
            const toNum = parseFloat(toNumbers[i]);
            const currentNum = fromNum + (toNum - fromNum) * progress;
            result = result.replace(toNumbers[i], currentNum);
        }

        return result;
    }

    /**
     * تکمیل انیمیشن
     * @param {Object} animation - انیمیشن
     * @private
     */
    _completeAnimation(animation) {
        animation.isPlaying = false;
        animation.isCompleted = true;
        animation.progress = 1;

        // اعمال fill mode
        if (animation.fillMode === 'forwards') {
            // حفظ حالت نهایی
        } else if (animation.fillMode === 'backwards') {
            // بازگشت به حالت اولیه
        } else if (animation.fillMode === 'both') {
            // هر دو
        } else {
            // حذف تغییرات
            for (const property of Object.keys(animation.properties)) {
                element.style[property] = '';
            }
        }

        // حذف GPU acceleration
        if (this.config.enableGPUAcceleration) {
            animation.element.style.willChange = 'auto';
        }

        // اجرای onComplete
        if (animation.lifecycle.onComplete) {
            try {
                animation.lifecycle.onComplete(animation);
            } catch (error) {
                console.error('❌ onComplete error:', error);
            }
        }

        // حذف از لیست فعال
        this.activeAnimations.delete(animation.id);

        // به‌روزرسانی آمار
        this.stats.totalAnimationsCompleted++;

        this._emit('animation-completed', { animation });

        if (this.debug) {
            console.log(`✅ Animation completed: ${animation.name}`);
        }
    }

    // ============================================================
    // بخش ۵: Reduced Motion
    // ============================================================

    /**
     * بررسی reduced motion
     * @private
     */
    _checkReducedMotion() {
        if (typeof window !== 'undefined' && window.matchMedia) {
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            
            if (prefersReducedMotion.matches) {
                this.config.enableReducedMotion = true;
                this.animationsEnabled = false;

                if (this.debug) {
                    console.log('♿ Reduced motion detected, animations disabled');
                }
            }

            // گوش دادن به تغییرات
            prefersReducedMotion.addEventListener('change', (e) => {
                this.config.enableReducedMotion = e.matches;
                this.animationsEnabled = !e.matches;

                this._emit('reduced-motion-changed', { enabled: e.matches });

                if (this.debug) {
                    console.log(`♿ Reduced motion ${e.matches ? 'enabled' : 'disabled'}`);
                }
            });
        }
    }

    // ============================================================
    // بخش ۶: انیمیشن‌های CSS
    // ============================================================

    /**
     * اعمال انیمیشن CSS
     * @param {HTMLElement} element - عنصر
     * @param {string} animationName - نام انیمیشن CSS
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    applyCSSAnimation(element, animationName, options = {}) {
        const {
            duration = 300,
            easing = 'ease-in-out',
            delay = 0,
            iterations = 1,
            direction = 'normal',
            fillMode = 'none'
        } = options;

        element.style.animationName = animationName;
        element.style.animationDuration = `${duration}ms`;
        element.style.animationTimingFunction = easing;
        element.style.animationDelay = `${delay}ms`;
        element.style.animationIterationCount = iterations;
        element.style.animationDirection = direction;
        element.style.animationFillMode = fillMode;

        return {
            success: true,
            element,
            animationName
        };
    }

    /**
     * حذف انیمیشن CSS
     * @param {HTMLElement} element - عنصر
     * @returns {Object} نتیجه
     */
    removeCSSAnimation(element) {
        element.style.animationName = '';
        element.style.animationDuration = '';
        element.style.animationTimingFunction = '';
        element.style.animationDelay = '';
        element.style.animationIterationCount = '';
        element.style.animationDirection = '';
        element.style.animationFillMode = '';

        return {
            success: true,
            element
        };
    }

    // ============================================================
    // بخش ۷: Transition های CSS
    // ============================================================

    /**
     * اعمال transition CSS
     * @param {HTMLElement} element - عنصر
     * @param {Object} properties - خواص
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    applyCSSTransition(element, properties, options = {}) {
        const {
            duration = 300,
            easing = 'ease-in-out',
            delay = 0
        } = options;

        const transitionProperties = Object.keys(properties).join(', ');
        element.style.transition = `${transitionProperties} ${duration}ms ${easing} ${delay}ms`;

        // اعمال خواص جدید
        for (const [property, value] of Object.entries(properties)) {
            element.style[property] = value;
        }

        return {
            success: true,
            element,
            properties
        };
    }

    /**
     * حذف transition CSS
     * @param {HTMLElement} element - عنصر
     * @returns {Object} نتیجه
     */
    removeCSSTransition(element) {
        element.style.transition = '';
        return {
            success: true,
            element
        };
    }

    // ============================================================
    // بخش ۸: انیمیشن‌های ترکیبی
    // ============================================================

    /**
     * ایجاد انیمیشن ترکیبی
     * @param {Array<Object>} animations - آرایه انیمیشن‌ها
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    createCombinedAnimation(animations, options = {}) {
        const {
            sequence = false, // true = sequential, false = parallel
            stagger = 0,
            onComplete = null
        } = options;

        if (sequence) {
            // انیمیشن‌های متوالی
            return this._createSequentialAnimation(animations, stagger, onComplete);
        } else {
            // انیمیشن‌های موازی
            return this._createParallelAnimation(animations, stagger, onComplete);
        }
    }

    /**
     * ایجاد انیمیشن متوالی
     * @param {Array} animations - انیمیشن‌ها
     * @param {number} stagger - فاصله زمانی
     * @param {Function} onComplete - callback تکمیل
     * @returns {Object}
     * @private
     */
    _createSequentialAnimation(animations, stagger, onComplete) {
        let currentIndex = 0;
        const animationIds = [];

        const playNext = () => {
            if (currentIndex >= animations.length) {
                if (onComplete) onComplete();
                return;
            }

            const animation = animations[currentIndex];
            const result = this.createAnimation(animation);

            if (result.success) {
                animationIds.push(result.animation.id);
                this.playAnimation(result.animation.id);

                // صبر برای تکمیل
                setTimeout(() => {
                    currentIndex++;
                    playNext();
                }, animation.duration + stagger);
            }
        };

        playNext();

        return {
            success: true,
            animationIds,
            type: 'sequential'
        };
    }

    /**
     * ایجاد انیمیشن موازی
     * @param {Array} animations - انیمیشن‌ها
     * @param {number} stagger - فاصله زمانی
     * @param {Function} onComplete - callback تکمیل
     * @returns {Object}
     * @private
     */
    _createParallelAnimation(animations, stagger, onComplete) {
        const animationIds = [];
        let completedCount = 0;

        animations.forEach((animation, index) => {
            setTimeout(() => {
                const result = this.createAnimation(animation);

                if (result.success) {
                    animationIds.push(result.animation.id);

                    // اضافه کردن onComplete برای شمارش
                    const originalOnComplete = animation.lifecycle?.onComplete;
                    result.animation.lifecycle.onComplete = () => {
                        if (originalOnComplete) originalOnComplete(result.animation);
                        completedCount++;

                        if (completedCount === animations.length && onComplete) {
                            onComplete();
                        }
                    };

                    this.playAnimation(result.animation.id);
                }
            }, index * stagger);
        });

        return {
            success: true,
            animationIds,
            type: 'parallel'
        };
    }

    // ============================================================
    // بخش ۹: دریافت اطلاعات
    // ============================================================

    /**
     * دریافت انیمیشن بر اساس شناسه
     * @param {string} animationId - شناسه
     * @returns {Object|null}
     */
    getAnimation(animationId) {
        return this.activeAnimations.get(animationId) || null;
    }

    /**
     * دریافت تمام انیمیشن‌های فعال
     * @returns {Array<Object>}
     */
    getActiveAnimations() {
        return Array.from(this.activeAnimations.values());
    }

    /**
     * دریافت انیمیشن‌های یک عنصر
     * @param {HTMLElement} element - عنصر
     * @returns {Array<Object>}
     */
    getAnimationsByElement(element) {
        return Array.from(this.activeAnimations.values()).filter(a => a.element === element);
    }

    /**
     * دریافت انیمیشن‌های یک نوع
     * @param {string} type - نوع
     * @returns {Array<Object>}
     */
    getAnimationsByType(type) {
        return Array.from(this.activeAnimations.values()).filter(a => a.type === type);
    }

    // ============================================================
    // بخش ۱۰: تنظیمات
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
            console.log(' Animation Manager config updated');
        }

        return {
            success: true,
            config: this.config
        };
    }

    /**
     * فعال/غیرفعال کردن Animation Manager
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        if (!enabled) {
            this.stopAllAnimations();
        }

        this._emit('animation-manager-toggled', { enabled });

        if (this.debug) {
            console.log(` Animation Manager ${enabled ? 'enabled' : 'disabled'}`);
        }

        return {
            success: true,
            enabled
        };
    }

    /**
     * فعال/غیرفعال کردن انیمیشن‌ها
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setAnimationsEnabled(enabled) {
        this.animationsEnabled = enabled;

        if (!enabled) {
            this.stopAllAnimations();
        }

        this._emit('animations-toggled', { enabled });

        if (this.debug) {
            console.log(` Animations ${enabled ? 'enabled' : 'disabled'}`);
        }

        return {
            success: true,
            enabled
        };
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
            activeAnimations: this.activeAnimations.size,
            maxConcurrent: this.config.maxConcurrentAnimations,
            byType: this._getStatsByType(),
            averageFPS: this._calculateAverageFPS()
        };
    }

    /**
     * دریافت آمار بر اساس نوع
     * @returns {Object}
     * @private
     */
    _getStatsByType() {
        const stats = {};
        this.activeAnimations.forEach(animation => {
            stats[animation.type] = (stats[animation.type] || 0) + 1;
        });
        return stats;
    }

    /**
     * محاسبه میانگین FPS
     * @returns {number}
     * @private
     */
    _calculateAverageFPS() {
        // در production از performance API استفاده می‌شود
        return 60;
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        return {
            enabled: this.enabled,
            animationsEnabled: this.animationsEnabled,
            reducedMotion: this.config.enableReducedMotion,
            activeAnimations: this.activeAnimations.size,
            totalCreated: this.stats.totalAnimationsCreated,
            totalCompleted: this.stats.totalAnimationsCompleted
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
            storage.set('animation_manager_stats', this.stats);
            storage.set('animation_manager_config', this.config);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const stats = storage.get('animation_manager_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            const config = storage.get('animation_manager_config');
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
        await this.stopAllAnimations();

        this.stats = {
            totalAnimationsCreated: 0,
            totalAnimationsPlayed: 0,
            totalAnimationsCompleted: 0,
            totalAnimationsCancelled: 0,
            totalAnimationsPaused: 0,
            averageDuration: 0,
            currentActiveCount: 0,
            lastAnimationAt: null
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 AnimationManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🎬 AnimationManager Status:');
        console.log('  Enabled:', summary.enabled);
        console.log('  Animations Enabled:', summary.animationsEnabled);
        console.log('  Reduced Motion:', summary.reducedMotion);
        console.log('  Active Animations:', summary.activeAnimations);
        console.log('  Total Created:', summary.totalCreated);
        console.log('  Total Completed:', summary.totalCompleted);
        console.log('  By Type:', stats.byType);
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
                    console.error(`❌ Animation Manager event listener error:`, error);
                }
            });
        }

        eventBus.emit(`animation:${event}`, data);
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
const animationManager = new AnimationManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnimationManager, animationManager };
} else {
    window.AnimationManager = AnimationManager;
    window.animationManager = animationManager;
}

console.log('✅ AnimationManager loaded - 28 easing functions defined');
