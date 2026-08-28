/**
 * ============================================================
 * HOKM MASTER - Sound Manager
 * سیستم مدیریت صدا و موسیقی بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت کامل سیستم صوتی بازی است. شامل
 * پخش افکت‌های صوتی، موسیقی پس‌زمینه، کنترل حجم صدا،
 * mute/unmute، preload صداها، sound packs مختلف، دسته‌بندی
 * صداها، و آمار کامل.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - storage (از فایل storage.js)
 * 
 * ============================================================
 */

class SoundManager {

    constructor() {
        /**
         * Audio context برای Web Audio API
         * @type {AudioContext|null}
         */
        this.audioContext = null;

        /**
         * صدا‌های preload شده
         * @type {Map<string, HTMLAudioElement>}
         */
        this.sounds = new Map();

        /**
         * موسیقی‌های پس‌زمینه
         * @type {Map<string, HTMLAudioElement>}
         */
        this.musicTracks = new Map();

        /**
         * موسیقی فعلی در حال پخش
         * @type {Object|null}
         */
        this.currentMusic = null;

        /**
         * دسته‌بندی صداها
         * @type {Object}
         */
        this.soundCategories = {
            card: ['card_play', 'card_deal', 'card_flip', 'card_shuffle'],
            game: ['trick_win', 'round_win', 'match_win', 'match_lose', 'kot', 'double_kot'],
            ui: ['button_click', 'menu_open', 'menu_close', 'notification', 'error'],
            reward: ['coin_earn', 'gem_earn', 'level_up', 'achievement', 'mission_complete'],
            social: ['friend_request', 'chat_message', 'invite_received'],
            system: ['login', 'logout', 'update', 'maintenance']
        };

        /**
         * Sound packs موجود
         * @type {Object}
         */
        this.soundPacks = {
            default: {
                name: 'پیش‌فرض',
                description: 'صداهای استاندارد بازی',
                sounds: {},
                music: {}
            },
            classic: {
                name: 'کلاسیک',
                description: 'صداهای سنتی و کلاسیک',
                sounds: {},
                music: {}
            },
            modern: {
                name: 'مدرن',
                description: 'صداهای مدرن و امروزی',
                sounds: {},
                music: {}
            },
            minimal: {
                name: 'مینیمال',
                description: 'صداهای ساده و کم‌حجم',
                sounds: {},
                music: {}
            }
        };

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
         * آیا Sound Manager فعال است
         * @type {boolean}
         */
        this.enabled = true;

        /**
         * آیا صداها فعال هستند
         * @type {boolean}
         */
        this.soundsEnabled = true;

        /**
         * آیا موسیقی فعال است
         * @type {boolean}
         */
        this.musicEnabled = true;

        /**
         * آمار Sound Manager
         * @type {Object}
         */
        this.stats = {
            totalSoundsPlayed: 0,
            totalMusicPlayed: 0,
            totalSoundsPreloaded: 0,
            totalSoundsFailed: 0,
            currentVolume: 0.7,
            currentMusicVolume: 0.5,
            currentSfxVolume: 0.7,
            lastSoundPlayedAt: null,
            lastMusicPlayedAt: null
        };

        /**
         * پیکربندی
         * @type {Object}
         */
        this.config = {
            enableSounds: true,
            enableMusic: true,
            masterVolume: 0.7,
            sfxVolume: 0.7,
            musicVolume: 0.5,
            enablePreload: true,
            enableWebAudioAPI: true,
            enableFadeIn: true,
            enableFadeOut: true,
            fadeInDuration: 500,
            fadeOutDuration: 500,
            maxConcurrentSounds: 10,
            soundPack: 'default',
            musicLoop: true,
            autoPlayMusic: false
        };

        /**
         * صداهای در حال پخش
         * @type {Array<Object>}
         */
        this.playingSounds = [];

        /**
         * حداکثر صداهای همزمان
         * @type {number}
         */
        this.maxConcurrentSounds = 10;

        // راه‌اندازی اولیه
        this._init();
    }

    /**
     * راه‌اندازی اولیه
     * @private
     */
    _init() {
        // ایجاد Audio Context
        if (this.config.enableWebAudioAPI && typeof AudioContext !== 'undefined') {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (error) {
                console.warn('⚠️ Web Audio API not available:', error);
            }
        }

        // بارگذاری داده‌ها
        this._loadData();

        // preload صداها
        if (this.config.enablePreload) {
            this._preloadSounds();
        }

        if (this.debug) {
            console.log('🔊 SoundManager initialized');
            console.log('  Sounds Enabled:', this.soundsEnabled);
            console.log('  Music Enabled:', this.musicEnabled);
            console.log('  Sound Pack:', this.config.soundPack);
        }
    }

    // ============================================================
    // بخش ۱: Preload صداها
    // ============================================================

    /**
     * preload کردن صداها
     * @private
     */
    _preloadSounds() {
        const soundPack = this.soundPacks[this.config.soundPack];
        if (!soundPack) return;

        // preload افکت‌های صوتی
        const allSounds = [
            ...this.soundCategories.card,
            ...this.soundCategories.game,
            ...this.soundCategories.ui,
            ...this.soundCategories.reward,
            ...this.soundCategories.social,
            ...this.soundCategories.system
        ];

        allSounds.forEach(soundName => {
            this._preloadSound(soundName, 'sfx');
        });

        // preload موسیقی‌ها
        const musicTracks = ['menu', 'game', 'victory', 'defeat', 'lobby'];
        musicTracks.forEach(musicName => {
            this._preloadSound(musicName, 'music');
        });

        if (this.debug) {
            console.log(` Preloaded ${this.sounds.size + this.musicTracks.size} audio files`);
        }
    }

    /**
     * preload یک صدا
     * @param {string} soundName - نام صدا
     * @param {string} type - نوع (sfx/music)
     * @private
     */
    _preloadSound(soundName, type = 'sfx') {
        const soundPack = this.soundPacks[this.config.soundPack];
        const soundPath = type === 'sfx' 
            ? soundPack.sounds[soundName] 
            : soundPack.music[soundName];

        if (!soundPath) {
            // استفاده از مسیر پیش‌فرض
            const basePath = type === 'sfx' ? '/sounds/sfx/' : '/sounds/music/';
            const fullPath = `${basePath}${soundName}.mp3`;

            const audio = new Audio(fullPath);
            audio.preload = 'auto';
            audio.volume = type === 'sfx' ? this.stats.currentSfxVolume : this.stats.currentMusicVolume;

            audio.addEventListener('canplaythrough', () => {
                this.stats.totalSoundsPreloaded++;

                if (type === 'sfx') {
                    this.sounds.set(soundName, audio);
                } else {
                    this.musicTracks.set(soundName, audio);
                }

                if (this.debug) {
                    console.log(`✅ Preloaded: ${soundName}`);
                }
            });

            audio.addEventListener('error', (error) => {
                this.stats.totalSoundsFailed++;
                console.warn(`⚠️ Failed to preload: ${soundName}`, error);
            });

            audio.load();
        }
    }

    /**
     * preload کردن یک sound pack کامل
     * @param {string} packName - نام pack
     * @returns {Promise<Object>} نتیجه
     */
    async preloadSoundPack(packName) {
        const soundPack = this.soundPacks[packName];
        if (!soundPack) {
            return {
                success: false,
                error: 'PACK_NOT_FOUND',
                message: 'Sound pack یافت نشد'
            };
        }

        const allSounds = [
            ...Object.values(soundPack.sounds),
            ...Object.values(soundPack.music)
        ];

        let loaded = 0;
        let failed = 0;

        const promises = allSounds.map(soundPath => {
            return new Promise((resolve) => {
                const audio = new Audio(soundPath);
                audio.preload = 'auto';

                audio.addEventListener('canplaythrough', () => {
                    loaded++;
                    resolve();
                });

                audio.addEventListener('error', () => {
                    failed++;
                    resolve();
                });

                audio.load();
            });
        });

        await Promise.all(promises);

        if (this.debug) {
            console.log(`📦 Sound pack "${packName}" preloaded: ${loaded} loaded, ${failed} failed`);
        }

        return {
            success: true,
            loaded,
            failed,
            total: allSounds.length
        };
    }

    // ============================================================
    // بخش ۲: پخش افکت‌های صوتی
    // ============================================================

    /**
     * پخش افکت صوتی
     * @param {string} soundName - نام صدا
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    playSound(soundName, options = {}) {
        if (!this.enabled || !this.soundsEnabled) {
            return {
                success: false,
                error: 'SOUNDS_DISABLED',
                message: 'صداها غیرفعال هستند'
            };
        }

        const {
            volume = null,
            loop = false,
            category = null,
            onStart = null,
            onEnd = null,
            data = {}
        } = options;

        // بررسی محدودیت همزمان
        if (this.playingSounds.length >= this.maxConcurrentSounds) {
            this._stopOldestSound();
        }

        // دریافت یا ایجاد صدا
        let audio = this.sounds.get(soundName);

        if (!audio) {
            audio = this._createSound(soundName);
            if (!audio) {
                return {
                    success: false,
                    error: 'SOUND_NOT_FOUND',
                    message: `صدای "${soundName}" یافت نشد`
                };
            }
        }

        // کلون کردن برای پخش همزمان
        const soundClone = audio.cloneNode();
        soundClone.volume = volume !== null ? volume : this.stats.currentSfxVolume * this.stats.currentVolume;
        soundClone.loop = loop;

        // پخش صدا
        const playPromise = soundClone.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                // اضافه کردن به لیست پخش
                const soundInfo = {
                    name: soundName,
                    audio: soundClone,
                    category,
                    volume: soundClone.volume,
                    loop,
                    startedAt: Date.now(),
                    data
                };

                this.playingSounds.push(soundInfo);
                this.stats.totalSoundsPlayed++;
                this.stats.lastSoundPlayedAt = Date.now();

                // اجرای onStart
                if (onStart) {
                    try {
                        onStart(soundInfo);
                    } catch (error) {
                        console.error(' onStart error:', error);
                    }
                }

                // گوش دادن به پایان
                soundClone.addEventListener('ended', () => {
                    this._removePlayingSound(soundInfo);

                    if (onEnd) {
                        try {
                            onEnd(soundInfo);
                        } catch (error) {
                            console.error('❌ onEnd error:', error);
                        }
                    }

                    this._emit('sound-ended', { soundInfo });
                });

                this._emit('sound-played', { soundInfo });

                if (this.debug) {
                    console.log(`🔊 Sound played: ${soundName}`);
                }
            }).catch(error => {
                console.warn('⚠️ Sound play failed:', error);
                this.stats.totalSoundsFailed++;
            });
        }

        return {
            success: true,
            soundName,
            audio: soundClone
        };
    }

    /**
     * ایجاد صدا جدید
     * @param {string} soundName - نام صدا
     * @returns {HTMLAudioElement|null}
     * @private
     */
    _createSound(soundName) {
        const soundPack = this.soundPacks[this.config.soundPack];
        const soundPath = soundPack.sounds[soundName];

        if (!soundPath) {
            // مسیر پیش‌فرض
            const fullPath = `/sounds/sfx/${soundName}.mp3`;
            const audio = new Audio(fullPath);
            audio.preload = 'auto';
            this.sounds.set(soundName, audio);
            return audio;
        }

        const audio = new Audio(soundPath);
        audio.preload = 'auto';
        this.sounds.set(soundName, audio);
        return audio;
    }

    /**
     * حذف صدا از لیست پخش
     * @param {Object} soundInfo - اطلاعات صدا
     * @private
     */
    _removePlayingSound(soundInfo) {
        const index = this.playingSounds.findIndex(s => s.audio === soundInfo.audio);
        if (index !== -1) {
            this.playingSounds.splice(index, 1);
        }
    }

    /**
     * توقف قدیمی‌ترین صدا
     * @private
     */
    _stopOldestSound() {
        if (this.playingSounds.length === 0) return;

        const oldest = this.playingSounds.reduce((oldest, current) =>
            current.startedAt < oldest.startedAt ? current : oldest
        );

        this.stopSound(oldest.name);
    }

    // ============================================================
    // بخش ۳: پخش موسیقی
    // ============================================================

    /**
     * پخش موسیقی
     * @param {string} musicName - نام موسیقی
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    playMusic(musicName, options = {}) {
        if (!this.enabled || !this.musicEnabled) {
            return {
                success: false,
                error: 'MUSIC_DISABLED',
                message: 'موسیقی غیرفعال است'
            };
        }

        const {
            volume = null,
            loop = this.config.musicLoop,
            fadeIn = this.config.enableFadeIn,
            onStart = null,
            onEnd = null,
            data = {}
        } = options;

        // توقف موسیقی فعلی
        if (this.currentMusic) {
            this.stopMusic();
        }

        // دریافت یا ایجاد موسیقی
        let audio = this.musicTracks.get(musicName);

        if (!audio) {
            audio = this._createMusic(musicName);
            if (!audio) {
                return {
                    success: false,
                    error: 'MUSIC_NOT_FOUND',
                    message: `موسیقی "${musicName}" یافت نشد`
                };
            }
        }

        // تنظیمات
        audio.volume = 0; // شروع از صفر برای fade in
        audio.loop = loop;

        // پخش موسیقی
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.currentMusic = {
                    name: musicName,
                    audio,
                    volume: volume !== null ? volume : this.stats.currentMusicVolume * this.stats.currentVolume,
                    loop,
                    startedAt: Date.now(),
                    data
                };

                this.stats.totalMusicPlayed++;
                this.stats.lastMusicPlayedAt = Date.now();

                // Fade in
                if (fadeIn) {
                    this._fadeInMusic(audio, this.currentMusic.volume);
                } else {
                    audio.volume = this.currentMusic.volume;
                }

                // اجرای onStart
                if (onStart) {
                    try {
                        onStart(this.currentMusic);
                    } catch (error) {
                        console.error(' onStart error:', error);
                    }
                }

                // گوش دادن به پایان
                audio.addEventListener('ended', () => {
                    if (onEnd) {
                        try {
                            onEnd(this.currentMusic);
                        } catch (error) {
                            console.error(' onEnd error:', error);
                        }
                    }

                    this._emit('music-ended', { music: this.currentMusic });
                });

                this._emit('music-played', { music: this.currentMusic });

                if (this.debug) {
                    console.log(`🎵 Music played: ${musicName}`);
                }
            }).catch(error => {
                console.warn('️ Music play failed:', error);
                this.stats.totalSoundsFailed++;
            });
        }

        return {
            success: true,
            musicName,
            audio
        };
    }

    /**
     * ایجاد موسیقی جدید
     * @param {string} musicName - نام موسیقی
     * @returns {HTMLAudioElement|null}
     * @private
     */
    _createMusic(musicName) {
        const soundPack = this.soundPacks[this.config.soundPack];
        const musicPath = soundPack.music[musicName];

        if (!musicPath) {
            const fullPath = `/sounds/music/${musicName}.mp3`;
            const audio = new Audio(fullPath);
            audio.preload = 'auto';
            this.musicTracks.set(musicName, audio);
            return audio;
        }

        const audio = new Audio(musicPath);
        audio.preload = 'auto';
        this.musicTracks.set(musicName, audio);
        return audio;
    }

    /**
     * توقف موسیقی
     * @returns {Object} نتیجه
     */
    stopMusic() {
        if (!this.currentMusic) {
            return {
                success: false,
                error: 'NO_MUSIC_PLAYING',
                message: 'موسیقی در حال پخش نیست'
            };
        }

        const music = this.currentMusic;

        // Fade out
        if (this.config.enableFadeOut) {
            this._fadeOutMusic(music.audio).then(() => {
                music.audio.pause();
                music.audio.currentTime = 0;
            });
        } else {
            music.audio.pause();
            music.audio.currentTime = 0;
        }

        this.currentMusic = null;

        this._emit('music-stopped', { music });

        if (this.debug) {
            console.log(`⏹️ Music stopped: ${music.name}`);
        }

        return {
            success: true,
            music
        };
    }

    /**
     * pause کردن موسیقی
     * @returns {Object} نتیجه
     */
    pauseMusic() {
        if (!this.currentMusic) {
            return {
                success: false,
                error: 'NO_MUSIC_PLAYING',
                message: 'موسیقی در حال پخش نیست'
            };
        }

        this.currentMusic.audio.pause();

        this._emit('music-paused', { music: this.currentMusic });

        if (this.debug) {
            console.log(`⏸️ Music paused: ${this.currentMusic.name}`);
        }

        return {
            success: true,
            music: this.currentMusic
        };
    }

    /**
     * resume کردن موسیقی
     * @returns {Object} نتیجه
     */
    resumeMusic() {
        if (!this.currentMusic) {
            return {
                success: false,
                error: 'NO_MUSIC_PLAYING',
                message: 'موسیقی در حال پخش نیست'
            };
        }

        this.currentMusic.audio.play();

        this._emit('music-resumed', { music: this.currentMusic });

        if (this.debug) {
            console.log(`▶️ Music resumed: ${this.currentMusic.name}`);
        }

        return {
            success: true,
            music: this.currentMusic
        };
    }

    /**
     * Fade in موسیقی
     * @param {HTMLAudioElement} audio - عنصر audio
     * @param {number} targetVolume - حجم هدف
     * @private
     */
    _fadeInMusic(audio, targetVolume) {
        const duration = this.config.fadeInDuration;
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = targetVolume / steps;

        let currentStep = 0;

        const fadeInterval = setInterval(() => {
            currentStep++;
            audio.volume = Math.min(targetVolume, currentStep * volumeStep);

            if (currentStep >= steps) {
                clearInterval(fadeInterval);
            }
        }, stepTime);
    }

    /**
     * Fade out موسیقی
     * @param {HTMLAudioElement} audio - عنصر audio
     * @returns {Promise<void>}
     * @private
     */
    _fadeOutMusic(audio) {
        return new Promise((resolve) => {
            const duration = this.config.fadeOutDuration;
            const steps = 20;
            const stepTime = duration / steps;
            const volumeStep = audio.volume / steps;

            let currentStep = 0;

            const fadeInterval = setInterval(() => {
                currentStep++;
                audio.volume = Math.max(0, audio.volume - volumeStep);

                if (currentStep >= steps) {
                    clearInterval(fadeInterval);
                    resolve();
                }
            }, stepTime);
        });
    }

    // ============================================================
    // بخش ۴: کنترل صداها
    // ============================================================

    /**
     * توقف یک صدا
     * @param {string} soundName - نام صدا
     * @returns {Object} نتیجه
     */
    stopSound(soundName) {
        const soundInfo = this.playingSounds.find(s => s.name === soundName);
        if (!soundInfo) {
            return {
                success: false,
                error: 'SOUND_NOT_PLAYING',
                message: 'صدا در حال پخش نیست'
            };
        }

        soundInfo.audio.pause();
        soundInfo.audio.currentTime = 0;
        this._removePlayingSound(soundInfo);

        this._emit('sound-stopped', { soundName });

        if (this.debug) {
            console.log(`️ Sound stopped: ${soundName}`);
        }

        return {
            success: true,
            soundName
        };
    }

    /**
     * توقف تمام صداها
     * @returns {number} تعداد متوقف شده
     */
    stopAllSounds() {
        const count = this.playingSounds.length;

        this.playingSounds.forEach(soundInfo => {
            soundInfo.audio.pause();
            soundInfo.audio.currentTime = 0;
        });

        this.playingSounds = [];

        if (this.debug) {
            console.log(`⏹️ All sounds stopped: ${count}`);
        }

        return count;
    }

    /**
     * pause کردن تمام صداها
     * @returns {number} تعداد متوقف شده
     */
    pauseAllSounds() {
        const count = this.playingSounds.length;

        this.playingSounds.forEach(soundInfo => {
            soundInfo.audio.pause();
        });

        if (this.debug) {
            console.log(`️ All sounds paused: ${count}`);
        }

        return count;
    }

    /**
     * resume کردن تمام صداها
     * @returns {number} تعداد ادامه یافته
     */
    resumeAllSounds() {
        const count = this.playingSounds.length;

        this.playingSounds.forEach(soundInfo => {
            soundInfo.audio.play();
        });

        if (this.debug) {
            console.log(`▶️ All sounds resumed: ${count}`);
        }

        return count;
    }

    // ============================================================
    // بخش ۵: کنترل حجم صدا
    // ============================================================

    /**
     * تنظیم حجم اصلی
     * @param {number} volume - حجم (0 تا 1)
     * @returns {Object} نتیجه
     */
    setMasterVolume(volume) {
        if (volume < 0 || volume > 1) {
            return {
                success: false,
                error: 'INVALID_VOLUME',
                message: 'حجم باید بین 0 و 1 باشد'
            };
        }

        this.stats.currentVolume = volume;
        this.config.masterVolume = volume;

        // به‌روزرسانی تمام صداها
        this._updateAllVolumes();

        this._emit('master-volume-changed', { volume });

        if (this.debug) {
            console.log(`🔊 Master volume: ${volume}`);
        }

        return {
            success: true,
            volume
        };
    }

    /**
     * تنظیم حجم افکت‌ها
     * @param {number} volume - حجم (0 تا 1)
     * @returns {Object} نتیجه
     */
    setSfxVolume(volume) {
        if (volume < 0 || volume > 1) {
            return {
                success: false,
                error: 'INVALID_VOLUME',
                message: 'حجم باید بین 0 و 1 باشد'
            };
        }

        this.stats.currentSfxVolume = volume;
        this.config.sfxVolume = volume;

        this._updateAllVolumes();

        this._emit('sfx-volume-changed', { volume });

        if (this.debug) {
            console.log(`🔊 SFX volume: ${volume}`);
        }

        return {
            success: true,
            volume
        };
    }

    /**
     * تنظیم حجم موسیقی
     * @param {number} volume - حجم (0 تا 1)
     * @returns {Object} نتیجه
     */
    setMusicVolume(volume) {
        if (volume < 0 || volume > 1) {
            return {
                success: false,
                error: 'INVALID_VOLUME',
                message: 'حجم باید بین 0 و 1 باشد'
            };
        }

        this.stats.currentMusicVolume = volume;
        this.config.musicVolume = volume;

        this._updateAllVolumes();

        this._emit('music-volume-changed', { volume });

        if (this.debug) {
            console.log(`🎵 Music volume: ${volume}`);
        }

        return {
            success: true,
            volume
        };
    }

    /**
     * به‌روزرسانی حجم تمام صداها
     * @private
     */
    _updateAllVolumes() {
        // به‌روزرسانی صداها
        this.playingSounds.forEach(soundInfo => {
            soundInfo.audio.volume = this.stats.currentSfxVolume * this.stats.currentVolume;
        });

        // به‌روزرسانی موسیقی
        if (this.currentMusic) {
            this.currentMusic.audio.volume = this.stats.currentMusicVolume * this.stats.currentVolume;
        }
    }

    /**
     * Mute کردن صداها
     * @returns {Object} نتیجه
     */
    muteSounds() {
        this.soundsEnabled = false;
        this.stopAllSounds();

        this._emit('sounds-muted');

        if (this.debug) {
            console.log('🔇 Sounds muted');
        }

        return {
            success: true,
            muted: true
        };
    }

    /**
     * Unmute کردن صداها
     * @returns {Object} نتیجه
     */
    unmuteSounds() {
        this.soundsEnabled = true;

        this._emit('sounds-unmuted');

        if (this.debug) {
            console.log('🔊 Sounds unmuted');
        }

        return {
            success: true,
            muted: false
        };
    }

    /**
     * Mute کردن موسیقی
     * @returns {Object} نتیجه
     */
    muteMusic() {
        this.musicEnabled = false;
        this.stopMusic();

        this._emit('music-muted');

        if (this.debug) {
            console.log(' Music muted');
        }

        return {
            success: true,
            muted: true
        };
    }

    /**
     * Unmute کردن موسیقی
     * @returns {Object} نتیجه
     */
    unmuteMusic() {
        this.musicEnabled = true;

        this._emit('music-unmuted');

        if (this.debug) {
            console.log('🔊 Music unmuted');
        }

        return {
            success: true,
            muted: false
        };
    }

    // ============================================================
    // بخش ۶: Sound Packs
    // ============================================================

    /**
     * تغییر sound pack
     * @param {string} packName - نام pack
     * @returns {Object} نتیجه
     */
    async setSoundPack(packName) {
        if (!this.soundPacks[packName]) {
            return {
                success: false,
                error: 'PACK_NOT_FOUND',
                message: 'Sound pack یافت نشد'
            };
        }

        const oldPack = this.config.soundPack;
        this.config.soundPack = packName;

        // preload pack جدید
        await this.preloadSoundPack(packName);

        this._emit('sound-pack-changed', {
            oldPack,
            newPack: packName
        });

        if (this.debug) {
            console.log(`🎨 Sound pack changed: ${oldPack} → ${packName}`);
        }

        return {
            success: true,
            oldPack,
            newPack: packName
        };
    }

    /**
     * دریافت sound packs موجود
     * @returns {Array<Object>}
     */
    getSoundPacks() {
        return Object.entries(this.soundPacks).map(([key, pack]) => ({
            id: key,
            ...pack,
            isCurrent: key === this.config.soundPack
        }));
    }

    // ============================================================
    // بخش ۷: صداهای خاص بازی
    // ============================================================

    /**
     * پخش صدای بازی کارت
     * @returns {Object}
     */
    playCardPlaySound() {
        return this.playSound('card_play', { category: 'card' });
    }

    /**
     * پخش صدای deal کارت
     * @returns {Object}
     */
    playCardDealSound() {
        return this.playSound('card_deal', { category: 'card' });
    }

    /**
     * پخش صدای برد دست
     * @returns {Object}
     */
    playTrickWinSound() {
        return this.playSound('trick_win', { category: 'game' });
    }

    /**
     * پخش صدای برد راند
     * @returns {Object}
     */
    playRoundWinSound() {
        return this.playSound('round_win', { category: 'game' });
    }

    /**
     * پخش صدای برد بازی
     * @returns {Object}
     */
    playMatchWinSound() {
        return this.playSound('match_win', { category: 'game' });
    }

    /**
     * پخش صدای باخت بازی
     * @returns {Object}
     */
    playMatchLoseSound() {
        return this.playSound('match_lose', { category: 'game' });
    }

    /**
     * پخش صدای Kot
     * @returns {Object}
     */
    playKotSound() {
        return this.playSound('kot', { category: 'game' });
    }

    /**
     * پخش صدای Double Kot
     * @returns {Object}
     */
    playDoubleKotSound() {
        return this.playSound('double_kot', { category: 'game' });
    }

    /**
     * پخش صدای کلیک دکمه
     * @returns {Object}
     */
    playButtonClickSound() {
        return this.playSound('button_click', { category: 'ui' });
    }

    /**
     * پخش صدای اعلان
     * @returns {Object}
     */
    playNotificationSound() {
        return this.playSound('notification', { category: 'ui' });
    }

    /**
     * پخش صدای کسب سکه
     * @returns {Object}
     */
    playCoinEarnSound() {
        return this.playSound('coin_earn', { category: 'reward' });
    }

    /**
     * پخش صدای کسب الماس
     * @returns {Object}
     */
    playGemEarnSound() {
        return this.playSound('gem_earn', { category: 'reward' });
    }

    /**
     * پخش صدای level up
     * @returns {Object}
     */
    playLevelUpSound() {
        return this.playSound('level_up', { category: 'reward' });
    }

    /**
     * پخش صدای achievement
     * @returns {Object}
     */
    playAchievementSound() {
        return this.playSound('achievement', { category: 'reward' });
    }

    // ============================================================
    // بخش ۸: دریافت اطلاعات
    // ============================================================

    /**
     * دریافت موسیقی فعلی
     * @returns {Object|null}
     */
    getCurrentMusic() {
        return this.currentMusic;
    }

    /**
     * دریافت صداها در حال پخش
     * @returns {Array<Object>}
     */
    getPlayingSounds() {
        return [...this.playingSounds];
    }

    /**
     * دریافت صداها بر اساس دسته
     * @param {string} category - دسته
     * @returns {Array<Object>}
     */
    getSoundsByCategory(category) {
        return this.playingSounds.filter(s => s.category === category);
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

        this._emit('config-updated', { config: this.config });

        if (this.debug) {
            console.log('🔊 Sound Manager config updated');
        }

        return {
            success: true,
            config: this.config
        };
    }

    /**
     * فعال/غیرفعال کردن Sound Manager
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        if (!enabled) {
            this.stopAllSounds();
            this.stopMusic();
        }

        this._emit('sound-manager-toggled', { enabled });

        if (this.debug) {
            console.log(` Sound Manager ${enabled ? 'enabled' : 'disabled'}`);
        }

        return {
            success: true,
            enabled
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
            playingSoundsCount: this.playingSounds.length,
            currentMusic: this.currentMusic?.name || null,
            soundPack: this.config.soundPack,
            byCategory: this._getStatsByCategory()
        };
    }

    /**
     * دریافت آمار بر اساس دسته
     * @returns {Object}
     * @private
     */
    _getStatsByCategory() {
        const stats = {};
        this.playingSounds.forEach(sound => {
            const category = sound.category || 'unknown';
            stats[category] = (stats[category] || 0) + 1;
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
            soundsEnabled: this.soundsEnabled,
            musicEnabled: this.musicEnabled,
            playingSounds: this.playingSounds.length,
            currentMusic: this.currentMusic?.name || null,
            masterVolume: this.stats.currentVolume,
            sfxVolume: this.stats.currentSfxVolume,
            musicVolume: this.stats.currentMusicVolume
        };
    }

    // ============================================================
    // بخش ۱۱: توابع کمکی
    // ============================================================

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('sound_manager_stats', this.stats);
            storage.set('sound_manager_config', this.config);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const stats = storage.get('sound_manager_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            const config = storage.get('sound_manager_config');
            if (config) this.config = { ...this.config, ...config };
        }
    }

    // ============================================================
    // بخش ۱۲: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    async reset() {
        await this.stopAllSounds();
        this.stopMusic();

        this.stats = {
            totalSoundsPlayed: 0,
            totalMusicPlayed: 0,
            totalSoundsPreloaded: 0,
            totalSoundsFailed: 0,
            currentVolume: 0.7,
            currentMusicVolume: 0.5,
            currentSfxVolume: 0.7,
            lastSoundPlayedAt: null,
            lastMusicPlayedAt: null
        };

        this._saveData();

        if (this.debug) {
            console.log('🔄 SoundManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🔊 SoundManager Status:');
        console.log('  Enabled:', summary.enabled);
        console.log('  Sounds Enabled:', summary.soundsEnabled);
        console.log('  Music Enabled:', summary.musicEnabled);
        console.log('  Playing Sounds:', summary.playingSounds);
        console.log('  Current Music:', summary.currentMusic);
        console.log('  Master Volume:', summary.masterVolume);
        console.log('  SFX Volume:', summary.sfxVolume);
        console.log('  Music Volume:', summary.musicVolume);
        console.log('  Sound Pack:', stats.soundPack);
        console.log('  By Category:', stats.byCategory);
    }

    // ============================================================
    // بخش ۳: Event System
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
                    console.error(`❌ Sound Manager event listener error:`, error);
                }
            });
        }

        eventBus.emit(`sound:${event}`, data);
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
const soundManager = new SoundManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SoundManager, soundManager };
} else {
    window.SoundManager = SoundManager;
    window.soundManager = soundManager;
}

console.log('✅ SoundManager loaded - 4 sound packs available');
