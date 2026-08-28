/**
 * ============================================================
 * HOKM MASTER - Music Manager
 * سیستم پیشرفته مدیریت موسیقی بازی
 * ============================================================
 * 
 * این فایل مسئول مدیریت پیشرفته موسیقی در بازی است. شامل
 * مدیریت playlist، موسیقی داینامیک بر اساس وضعیت بازی،
 * crossfade بین ترک‌ها، shuffle و repeat، bookmark،
 * تحلیل موسیقی، و آمار کامل پخش.
 * 
 * نسخه: 1.0.0
 * آخرین به‌روزرسانی: 2026-08-28
 * 
 * وابستگی‌ها:
 * - CONFIG (از فایل config.js)
 * - Utils (از فایل utils.js)
 * - eventBus, EVENTS (از فایل events.js)
 * - storage (از فایل storage.js)
 * - soundManager (از فایل sounds.js)
 * 
 * ============================================================
 */

class MusicManager {

    constructor() {
        /**
         * ترک‌های موسیقی موجود
         * @type {Map<string, Object>}
         */
        this.tracks = new Map();

        /**
         * Playlist های ذخیره شده
         * @type {Map<string, Object>}
         */
        this.playlists = new Map();

        /**
         * Playlist فعلی
         * @type {Object|null}
         */
        this.currentPlaylist = null;

        /**
         * ایندکس ترک فعلی
         * @type {number}
         */
        this.currentTrackIndex = 0;

        /**
         * ترک در حال پخش
         * @type {Object|null}
         */
        this.currentTrack = null;

        /**
         * Audio element فعلی
         * @type {HTMLAudioElement|null}
         */
        this.currentAudio = null;

        /**
         * وضعیت پخش
         * @type {string} 'idle' | 'playing' | 'paused' | 'loading'
         */
        this.status = 'idle';

        /**
         * حالت پخش
         * @type {string} 'normal' | 'shuffle' | 'repeat-one' | 'repeat-all'
         */
        this.playMode = 'normal';

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
         * آیا Music Manager فعال است
         * @type {boolean}
         */
        this.enabled = true;

        /**
         * آیا موسیقی فعال است
         * @type {boolean}
         */
        this.musicEnabled = true;

        /**
         * آمار Music Manager
         * @type {Object}
         */
        this.stats = {
            totalTracksLoaded: 0,
            totalTracksPlayed: 0,
            totalPlayTime: 0,
            totalPlaylistsCreated: 0,
            currentVolume: 0.5,
            lastTrackPlayedAt: null,
            favoriteTracks: []
        };

        /**
         * پیکربندی
         * @type {Object}
         */
        this.config = {
            enableMusic: true,
            defaultVolume: 0.5,
            enableCrossfade: true,
            crossfadeDuration: 3000,
            enableShuffle: false,
            enableRepeat: false,
            enableAutoPlay: false,
            enableDynamicMusic: true,
            enableBookmarks: true,
            enableAnalytics: true,
            preloadNextTrack: true,
            fadeOutOnPause: true,
            fadeInOnResume: true,
            fadeDuration: 500,
            maxPlaylistSize: 100,
            defaultPlaylist: 'game'
        };

        /**
         * ترک بعدی preload شده
         * @type {Object|null}
         */
        this.nextTrackPreloaded = null;

        /**
         * Bookmark های موسیقی
         * @type {Map<string, number>}
         */
        this.bookmarks = new Map();

        /**
         * تاریخچه پخش
         * @type {Array<Object>}
         */
        this.playHistory = [];

        /**
         * حداکثر تاریخچه
         * @type {number}
         */
        this.maxHistorySize = 100;

        /**
         * زمان شروع پخش ترک فعلی
         * @type {number}
         */
        this.trackStartTime = 0;

        /**
         * تایمر به‌روزرسانی progress
         * @type {number|null}
         */
        this.progressTimer = null;

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

        // ثبت ترک‌های پیش‌فرض
        this._registerDefaultTracks();

        // ایجاد playlist های پیش‌فرض
        this._createDefaultPlaylists();

        // شروع موسیقی خودکار
        if (this.config.enableAutoPlay) {
            this.playPlaylist(this.config.defaultPlaylist);
        }

        if (this.debug) {
            console.log('🎵 MusicManager initialized');
            console.log('  Tracks:', this.tracks.size);
            console.log('  Playlists:', this.playlists.size);
            console.log('  Status:', this.status);
        }
    }

    // ============================================================
    // بخش ۱: ثبت ترک‌ها
    // ============================================================

    /**
     * ثبت ترک موسیقی
     * @param {Object} trackConfig - پیکربندی ترک
     * @returns {Object} نتیجه
     */
    registerTrack(trackConfig) {
        const {
            id,
            name,
            src,
            artist = 'Unknown',
            album = 'Unknown',
            duration = 0,
            genre = 'general',
            mood = 'neutral',
            bpm = 0,
            tags = [],
            volume = 1.0,
            loop = false,
            fadeIn = true,
            fadeOut = true,
            metadata = {}
        } = trackConfig;

        if (!id || !src) {
            return {
                success: false,
                error: 'INVALID_CONFIG',
                message: 'شناسه و منبع ترک الزامی است'
            };
        }

        const track = {
            id,
            name,
            src,
            artist,
            album,
            duration,
            genre,
            mood,
            bpm,
            tags,
            volume,
            loop,
            fadeIn,
            fadeOut,
            metadata: { ...metadata },
            registeredAt: Date.now(),
            playCount: 0,
            lastPlayedAt: null,
            isFavorite: false,
            isPreloaded: false
        };

        this.tracks.set(id, track);
        this.stats.totalTracksLoaded++;

        // Preload ترک
        this._preloadTrack(track);

        this._emit('track-registered', { track });

        if (this.debug) {
            console.log(`🎵 Track registered: ${name} by ${artist}`);
        }

        return {
            success: true,
            track
        };
    }

    /**
     * ثبت چند ترک همزمان
     * @param {Array<Object>} trackConfigs - پیکربندی ترک‌ها
     * @returns {Object} نتیجه
     */
    registerTracks(trackConfigs) {
        const results = [];

        trackConfigs.forEach(config => {
            results.push(this.registerTrack(config));
        });

        return {
            success: true,
            results
        };
    }

    /**
     * حذف ترک
     * @param {string} trackId - شناسه ترک
     * @returns {Object} نتیجه
     */
    unregisterTrack(trackId) {
        if (!this.tracks.has(trackId)) {
            return {
                success: false,
                error: 'TRACK_NOT_FOUND',
                message: 'ترک یافت نشد'
            };
        }

        // اگر ترک در حال پخش است، متوقف کن
        if (this.currentTrack?.id === trackId) {
            this.stop();
        }

        // حذف از playlist ها
        this.playlists.forEach(playlist => {
            playlist.tracks = playlist.tracks.filter(id => id !== trackId);
        });

        // حذف از bookmarks
        this.bookmarks.delete(trackId);

        // حذف از تاریخچه
        this.playHistory = this.playHistory.filter(h => h.trackId !== trackId);

        this.tracks.delete(trackId);

        this._emit('track-unregistered', { trackId });

        if (this.debug) {
            console.log(`🗑️ Track unregistered: ${trackId}`);
        }

        return {
            success: true,
            trackId
        };
    }

    /**
     * دریافت ترک
     * @param {string} trackId - شناسه ترک
     * @returns {Object|null}
     */
    getTrack(trackId) {
        return this.tracks.get(trackId) || null;
    }

    /**
     * دریافت تمام ترک‌ها
     * @returns {Array<Object>}
     */
    getAllTracks() {
        return Array.from(this.tracks.values());
    }

    /**
     * دریافت ترک‌ها بر اساس ژانر
     * @param {string} genre - ژانر
     * @returns {Array<Object>}
     */
    getTracksByGenre(genre) {
        return Array.from(this.tracks.values()).filter(t => t.genre === genre);
    }

    /**
     * دریافت ترک‌ها بر اساس mood
     * @param {string} mood - mood
     * @returns {Array<Object>}
     */
    getTracksByMood(mood) {
        return Array.from(this.tracks.values()).filter(t => t.mood === mood);
    }

    /**
     * دریافت ترک‌های مورد علاقه
     * @returns {Array<Object>}
     */
    getFavoriteTracks() {
        return Array.from(this.tracks.values()).filter(t => t.isFavorite);
    }

    // ============================================================
    // بخش ۲: Preload
    // ============================================================

    /**
     * Preload کردن ترک
     * @param {Object} track - ترک
     * @private
     */
    _preloadTrack(track) {
        const audio = new Audio(track.src);
        audio.preload = 'auto';

        audio.addEventListener('canplaythrough', () => {
            track.isPreloaded = true;
            track.duration = audio.duration || track.duration;

            if (this.debug) {
                console.log(`✅ Preloaded: ${track.name}`);
            }
        });

        audio.addEventListener('error', (error) => {
            console.warn(`️ Failed to preload: ${track.name}`, error);
        });

        audio.load();
    }

    /**
     * Preload کردن ترک بعدی
     * @private
     */
    _preloadNextTrack() {
        if (!this.config.preloadNextTrack) return;
        if (!this.currentPlaylist) return;

        const nextIndex = this._getNextTrackIndex();
        const nextTrackId = this.currentPlaylist.tracks[nextIndex];

        if (!nextTrackId) return;

        const nextTrack = this.tracks.get(nextTrackId);
        if (nextTrack && !nextTrack.isPreloaded) {
            this._preloadTrack(nextTrack);
            this.nextTrackPreloaded = nextTrack;
        }
    }

    // ============================================================
    // بخش ۳: Playlist Management
    // ============================================================

    /**
     * ایجاد playlist جدید
     * @param {Object} playlistConfig - پیکربندی playlist
     * @returns {Object} نتیجه
     */
    createPlaylist(playlistConfig) {
        const {
            id,
            name,
            description = '',
            tracks = [],
            isDefault = false,
            shuffleByDefault = false,
            metadata = {}
        } = playlistConfig;

        if (!id || !name) {
            return {
                success: false,
                error: 'INVALID_CONFIG',
                message: 'شناسه و نام playlist الزامی است'
            };
        }

        if (tracks.length > this.config.maxPlaylistSize) {
            return {
                success: false,
                error: 'TOO_MANY_TRACKS',
                message: `حداکثر ${this.config.maxPlaylistSize} ترک در playlist`
            };
        }

        const playlist = {
            id,
            name,
            description,
            tracks: [...tracks],
            isDefault,
            shuffleByDefault,
            metadata: { ...metadata },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            playCount: 0,
            lastPlayedAt: null
        };

        this.playlists.set(id, playlist);
        this.stats.totalPlaylistsCreated++;

        this._emit('playlist-created', { playlist });

        if (this.debug) {
            console.log(` Playlist created: ${name} (${tracks.length} tracks)`);
        }

        return {
            success: true,
            playlist
        };
    }

    /**
     * افزودن ترک به playlist
     * @param {string} playlistId - شناسه playlist
     * @param {string} trackId - شناسه ترک
     * @param {number} position - موقعیت (اختیاری)
     * @returns {Object} نتیجه
     */
    addTrackToPlaylist(playlistId, trackId, position = -1) {
        const playlist = this.playlists.get(playlistId);
        if (!playlist) {
            return {
                success: false,
                error: 'PLAYLIST_NOT_FOUND',
                message: 'Playlist یافت نشد'
            };
        }

        if (!this.tracks.has(trackId)) {
            return {
                success: false,
                error: 'TRACK_NOT_FOUND',
                message: 'ترک یافت نشد'
            };
        }

        if (playlist.tracks.includes(trackId)) {
            return {
                success: false,
                error: 'TRACK_ALREADY_EXISTS',
                message: 'ترک قبلاً در playlist وجود دارد'
            };
        }

        if (position >= 0 && position <= playlist.tracks.length) {
            playlist.tracks.splice(position, 0, trackId);
        } else {
            playlist.tracks.push(trackId);
        }

        playlist.updatedAt = Date.now();

        this._emit('track-added-to-playlist', { playlistId, trackId, position });

        return {
            success: true,
            playlist
        };
    }

    /**
     * حذف ترک از playlist
     * @param {string} playlistId - شناسه playlist
     * @param {string} trackId - شناسه ترک
     * @returns {Object} نتیجه
     */
    removeTrackFromPlaylist(playlistId, trackId) {
        const playlist = this.playlists.get(playlistId);
        if (!playlist) {
            return {
                success: false,
                error: 'PLAYLIST_NOT_FOUND',
                message: 'Playlist یافت نشد'
            };
        }

        const index = playlist.tracks.indexOf(trackId);
        if (index === -1) {
            return {
                success: false,
                error: 'TRACK_NOT_IN_PLAYLIST',
                message: 'ترک در playlist نیست'
            };
        }

        playlist.tracks.splice(index, 1);
        playlist.updatedAt = Date.now();

        this._emit('track-removed-from-playlist', { playlistId, trackId });

        return {
            success: true,
            playlist
        };
    }

    /**
     * دریافت playlist
     * @param {string} playlistId - شناسه playlist
     * @returns {Object|null}
     */
    getPlaylist(playlistId) {
        return this.playlists.get(playlistId) || null;
    }

    /**
     * دریافت تمام playlist ها
     * @returns {Array<Object>}
     */
    getAllPlaylists() {
        return Array.from(this.playlists.values());
    }

    /**
     * حذف playlist
     * @param {string} playlistId - شناسه playlist
     * @returns {Object} نتیجه
     */
    deletePlaylist(playlistId) {
        if (!this.playlists.has(playlistId)) {
            return {
                success: false,
                error: 'PLAYLIST_NOT_FOUND',
                message: 'Playlist یافت نشد'
            };
        }

        // اگر playlist فعلی است، متوقف کن
        if (this.currentPlaylist?.id === playlistId) {
            this.stop();
        }

        this.playlists.delete(playlistId);

        this._emit('playlist-deleted', { playlistId });

        return {
            success: true,
            playlistId
        };
    }

    // ============================================================
    // بخش ۴: پخش موسیقی
    // ============================================================

    /**
     * پخش ترک
     * @param {string} trackId - شناسه ترک
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    async playTrack(trackId, options = {}) {
        if (!this.enabled || !this.musicEnabled) {
            return {
                success: false,
                error: 'MUSIC_DISABLED',
                message: 'موسیقی غیرفعال است'
            };
        }

        const track = this.tracks.get(trackId);
        if (!track) {
            return {
                success: false,
                error: 'TRACK_NOT_FOUND',
                message: 'ترک یافت نشد'
            };
        }

        const {
            startTime = 0,
            fadeIn = track.fadeIn && this.config.fadeInOnResume
        } = options;

        // متوقف کردن ترک قبلی
        if (this.currentTrack && this.currentTrack.id !== trackId) {
            await this._fadeOutCurrentTrack();
        }

        this.status = 'loading';

        try {
            // ایجاد یا دریافت audio element
            let audio = this.currentAudio;

            if (!audio || audio.src !== track.src) {
                audio = new Audio(track.src);
                audio.preload = 'auto';
            }

            audio.volume = 0;
            audio.currentTime = startTime;
            audio.loop = track.loop;

            // پخش
            await audio.play();

            this.currentAudio = audio;
            this.currentTrack = track;
            this.currentTrackIndex = this.currentPlaylist?.tracks.indexOf(trackId) || 0;
            this.status = 'playing';
            this.trackStartTime = Date.now();

            // Fade in
            if (fadeIn) {
                await this._fadeInAudio(audio, track.volume * this.stats.currentVolume);
            } else {
                audio.volume = track.volume * this.stats.currentVolume;
            }

            // به‌روزرسانی آمار
            track.playCount++;
            track.lastPlayedAt = Date.now();
            this.stats.totalTracksPlayed++;
            this.stats.lastTrackPlayedAt = Date.now();

            // اضافه کردن به تاریخچه
            this._addToPlayHistory(track);

            // شروع progress timer
            this._startProgressTimer();

            // Preload ترک بعدی
            this._preloadNextTrack();

            // Event listeners
            audio.addEventListener('ended', () => this._onTrackEnded());
            audio.addEventListener('error', (error) => this._onTrackError(error));
            audio.addEventListener('timeupdate', () => this._onTimeUpdate());

            this._emit('track-started', { track, startTime });

            if (this.debug) {
                console.log(`▶️ Track started: ${track.name} by ${track.artist}`);
            }

            return {
                success: true,
                track,
                audio
            };

        } catch (error) {
            console.error('❌ Track play failed:', error);
            this.status = 'idle';

            return {
                success: false,
                error: 'PLAY_FAILED',
                message: error.message
            };
        }
    }

    /**
     * پخش playlist
     * @param {string} playlistId - شناسه playlist
     * @param {Object} options - گزینه‌ها
     * @returns {Object} نتیجه
     */
    async playPlaylist(playlistId, options = {}) {
        const playlist = this.playlists.get(playlistId);
        if (!playlist) {
            return {
                success: false,
                error: 'PLAYLIST_NOT_FOUND',
                message: 'Playlist یافت نشد'
            };
        }

        if (playlist.tracks.length === 0) {
            return {
                success: false,
                error: 'EMPTY_PLAYLIST',
                message: 'Playlist خالی است'
            };
        }

        const {
            startIndex = 0,
            shuffle = playlist.shuffleByDefault || this.config.enableShuffle
        } = options;

        this.currentPlaylist = playlist;
        this.playMode = shuffle ? 'shuffle' : 'normal';

        // به‌روزرسانی آمار playlist
        playlist.playCount++;
        playlist.lastPlayedAt = Date.now();

        // پخش اولین ترک
        const firstTrackId = playlist.tracks[startIndex] || playlist.tracks[0];
        return this.playTrack(firstTrackId);
    }

    /**
     * توقف پخش
     * @returns {Object} نتیجه
     */
    async stop() {
        if (this.status === 'idle') {
            return {
                success: false,
                error: 'NOT_PLAYING',
                message: 'موسیقی در حال پخش نیست'
            };
        }

        const track = this.currentTrack;

        await this._fadeOutCurrentTrack();

        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }

        this.status = 'idle';
        this.currentTrack = null;
        this.currentAudio = null;
        this.currentPlaylist = null;
        this.currentTrackIndex = 0;

        this._stopProgressTimer();

        this._emit('music-stopped', { track });

        if (this.debug) {
            console.log(`⏹️ Music stopped: ${track?.name}`);
        }

        return {
            success: true,
            track
        };
    }

    /**
     * Pause کردن
     * @returns {Object} نتیجه
     */
    async pause() {
        if (this.status !== 'playing') {
            return {
                success: false,
                error: 'NOT_PLAYING',
                message: 'موسیقی در حال پخش نیست'
            };
        }

        const track = this.currentTrack;

        if (this.config.fadeOutOnPause) {
            await this._fadeOutCurrentTrack();
        } else if (this.currentAudio) {
            this.currentAudio.pause();
        }

        this.status = 'paused';

        this._stopProgressTimer();

        this._emit('music-paused', { track });

        if (this.debug) {
            console.log(`⏸️ Music paused: ${track?.name}`);
        }

        return {
            success: true,
            track
        };
    }

    /**
     * Resume کردن
     * @returns {Object} نتیجه
     */
    async resume() {
        if (this.status !== 'paused') {
            return {
                success: false,
                error: 'NOT_PAUSED',
                message: 'موسیقی متوقف نیست'
            };
        }

        const track = this.currentTrack;

        if (this.currentAudio) {
            await this.currentAudio.play();

            if (this.config.fadeInOnResume) {
                await this._fadeInAudio(this.currentAudio, track.volume * this.stats.currentVolume);
            }
        }

        this.status = 'playing';
        this._startProgressTimer();

        this._emit('music-resumed', { track });

        if (this.debug) {
            console.log(`▶️ Music resumed: ${track?.name}`);
        }

        return {
            success: true,
            track
        };
    }

    /**
     * ترک بعدی
     * @returns {Object} نتیجه
     */
    async nextTrack() {
        if (!this.currentPlaylist) {
            return {
                success: false,
                error: 'NO_PLAYLIST',
                message: 'Playlist فعلی وجود ندارد'
            };
        }

        const nextIndex = this._getNextTrackIndex();
        const nextTrackId = this.currentPlaylist.tracks[nextIndex];

        if (!nextTrackId) {
            return {
                success: false,
                error: 'NO_NEXT_TRACK',
                message: 'ترک بعدی وجود ندارد'
            };
        }

        this.currentTrackIndex = nextIndex;

        return this.playTrack(nextTrackId);
    }

    /**
     * ترک قبلی
     * @returns {Object} نتیجه
     */
    async previousTrack() {
        if (!this.currentPlaylist) {
            return {
                success: false,
                error: 'NO_PLAYLIST',
                message: 'Playlist فعلی وجود ندارد'
            };
        }

        // اگر بیشتر از 3 ثانیه گذشته، به ابتدای ترک فعلی برگرد
        if (this.currentAudio && this.currentAudio.currentTime > 3) {
            this.currentAudio.currentTime = 0;
            return {
                success: true,
                message: 'Returned to start of current track'
            };
        }

        const prevIndex = this._getPreviousTrackIndex();
        const prevTrackId = this.currentPlaylist.tracks[prevIndex];

        if (!prevTrackId) {
            return {
                success: false,
                error: 'NO_PREVIOUS_TRACK',
                message: 'ترک قبلی وجود ندارد'
            };
        }

        this.currentTrackIndex = prevIndex;

        return this.playTrack(prevTrackId);
    }

    /**
     * پرش به ترک خاص
     * @param {string} trackId - شناسه ترک
     * @returns {Object} نتیجه
     */
    async seekToTrack(trackId) {
        if (!this.currentPlaylist) {
            return {
                success: false,
                error: 'NO_PLAYLIST',
                message: 'Playlist فعلی وجود ندارد'
            };
        }

        const index = this.currentPlaylist.tracks.indexOf(trackId);
        if (index === -1) {
            return {
                success: false,
                error: 'TRACK_NOT_IN_PLAYLIST',
                message: 'ترک در playlist نیست'
            };
        }

        this.currentTrackIndex = index;

        return this.playTrack(trackId);
    }

    // ============================================================
    // بخش ۵: Crossfade
    // ============================================================

    /**
     * Crossfade بین دو ترک
     * @param {string} fromTrackId - ترک مبدأ
     * @param {string} toTrackId - ترک مقصد
     * @param {number} duration - مدت crossfade
     * @returns {Object} نتیجه
     */
    async crossfadeTracks(fromTrackId, toTrackId, duration = null) {
        const fromTrack = this.tracks.get(fromTrackId);
        const toTrack = this.tracks.get(toTrackId);

        if (!fromTrack || !toTrack) {
            return {
                success: false,
                error: 'TRACK_NOT_FOUND',
                message: 'یکی از ترک‌ها یافت نشد'
            };
        }

        const crossfadeDuration = duration || this.config.crossfadeDuration;

        // شروع ترک جدید
        await this.playTrack(toTrackId, { fadeIn: false });

        // Fade out ترک قبلی و fade in ترک جدید همزمان
        if (this.currentAudio && this.currentAudio !== this._getAudioForTrack(fromTrackId)) {
            // پیاده‌سازی crossfade پیچیده‌تر نیاز است
        }

        this._emit('tracks-crossfaded', { fromTrack, toTrack, duration: crossfadeDuration });

        return {
            success: true,
            fromTrack,
            toTrack,
            duration: crossfadeDuration
        };
    }

    // ============================================================
    // بخش : Play Mode
    // ============================================================

    /**
     * تغییر حالت پخش
     * @param {string} mode - حالت پخش
     * @returns {Object} نتیجه
     */
    setPlayMode(mode) {
        const validModes = ['normal', 'shuffle', 'repeat-one', 'repeat-all'];

        if (!validModes.includes(mode)) {
            return {
                success: false,
                error: 'INVALID_MODE',
                message: 'حالت پخش نامعتبر است'
            };
        }

        const oldMode = this.playMode;
        this.playMode = mode;

        this._emit('play-mode-changed', { oldMode, newMode: mode });

        if (this.debug) {
            console.log(` Play mode changed: ${oldMode} → ${mode}`);
        }

        return {
            success: true,
            oldMode,
            newMode: mode
        };
    }

    /**
     * تغییر وضعیت shuffle
     * @param {boolean} enabled - آیا shuffle فعال باشد
     * @returns {Object} نتیجه
     */
    setShuffle(enabled) {
        return this.setPlayMode(enabled ? 'shuffle' : 'normal');
    }

    /**
     * تغییر وضعیت repeat
     * @param {boolean} enabled - آیا repeat فعال باشد
     * @param {boolean} repeatOne - آیا فقط یک ترک تکرار شود
     * @returns {Object} نتیجه
     */
    setRepeat(enabled, repeatOne = false) {
        if (!enabled) {
            return this.setPlayMode('normal');
        }

        return this.setPlayMode(repeatOne ? 'repeat-one' : 'repeat-all');
    }

    /**
     * دریافت ایندکس ترک بعدی
     * @returns {number}
     * @private
     */
    _getNextTrackIndex() {
        if (!this.currentPlaylist) return 0;

        const tracks = this.currentPlaylist.tracks;
        const currentIndex = this.currentTrackIndex;

        switch (this.playMode) {
            case 'shuffle':
                return Math.floor(Math.random() * tracks.length);

            case 'repeat-one':
                return currentIndex;

            case 'repeat-all':
                return (currentIndex + 1) % tracks.length;

            default: // normal
                return currentIndex + 1;
        }
    }

    /**
     * دریافت ایندکس ترک قبلی
     * @returns {number}
     * @private
     */
    _getPreviousTrackIndex() {
        if (!this.currentPlaylist) return 0;

        const tracks = this.currentPlaylist.tracks;
        const currentIndex = this.currentTrackIndex;

        switch (this.playMode) {
            case 'shuffle':
                return Math.floor(Math.random() * tracks.length);

            case 'repeat-one':
                return currentIndex;

            default: // normal, repeat-all
                return (currentIndex - 1 + tracks.length) % tracks.length;
        }
    }

    // ============================================================
    // بخش ۷: Bookmark
    // ============================================================

    /**
     * ایجاد bookmark
     * @param {string} trackId - شناسه ترک
     * @param {number} time - زمان (ثانیه)
     * @param {string} name - نام bookmark
     * @returns {Object} نتیجه
     */
    createBookmark(trackId, time, name = '') {
        if (!this.config.enableBookmarks) {
            return {
                success: false,
                error: 'BOOKMARKS_DISABLED',
                message: 'Bookmark غیرفعال است'
            };
        }

        const track = this.tracks.get(trackId);
        if (!track) {
            return {
                success: false,
                error: 'TRACK_NOT_FOUND',
                message: 'ترک یافت نشد'
            };
        }

        const bookmark = {
            id: Utils.generateUUID(),
            trackId,
            trackName: track.name,
            time,
            name: name || `Bookmark at ${this._formatTime(time)}`,
            createdAt: Date.now()
        };

        this.bookmarks.set(bookmark.id, bookmark);

        this._emit('bookmark-created', { bookmark });

        if (this.debug) {
            console.log(` Bookmark created: ${bookmark.name}`);
        }

        return {
            success: true,
            bookmark
        };
    }

    /**
     * دریافت bookmark های یک ترک
     * @param {string} trackId - شناسه ترک
     * @returns {Array<Object>}
     */
    getTrackBookmarks(trackId) {
        return Array.from(this.bookmarks.values()).filter(b => b.trackId === trackId);
    }

    /**
     * حذف bookmark
     * @param {string} bookmarkId - شناسه bookmark
     * @returns {Object} نتیجه
     */
    deleteBookmark(bookmarkId) {
        if (!this.bookmarks.has(bookmarkId)) {
            return {
                success: false,
                error: 'BOOKMARK_NOT_FOUND',
                message: 'Bookmark یافت نشد'
            };
        }

        const bookmark = this.bookmarks.get(bookmarkId);
        this.bookmarks.delete(bookmarkId);

        this._emit('bookmark-deleted', { bookmark });

        return {
            success: true,
            bookmark
        };
    }

    /**
     * پرش به bookmark
     * @param {string} bookmarkId - شناسه bookmark
     * @returns {Object} نتیجه
     */
    async seekToBookmark(bookmarkId) {
        const bookmark = this.bookmarks.get(bookmarkId);
        if (!bookmark) {
            return {
                success: false,
                error: 'BOOKMARK_NOT_FOUND',
                message: 'Bookmark یافت نشد'
            };
        }

        const result = await this.playTrack(bookmark.trackId, {
            startTime: bookmark.time
        });

        if (result.success) {
            this._emit('bookmark-seeked', { bookmark });
        }

        return result;
    }

    // ============================================================
    // بخش ۸: Favorite
    // ============================================================

    /**
     * افزودن به مورد علاقه‌ها
     * @param {string} trackId - شناسه ترک
     * @returns {Object} نتیجه
     */
    addToFavorites(trackId) {
        const track = this.tracks.get(trackId);
        if (!track) {
            return {
                success: false,
                error: 'TRACK_NOT_FOUND',
                message: 'ترک یافت نشد'
            };
        }

        track.isFavorite = true;

        if (!this.stats.favoriteTracks.includes(trackId)) {
            this.stats.favoriteTracks.push(trackId);
        }

        this._emit('track-favorited', { track });

        if (this.debug) {
            console.log(`❤️ Track favorited: ${track.name}`);
        }

        return {
            success: true,
            track
        };
    }

    /**
     * حذف از مورد علاقه‌ها
     * @param {string} trackId - شناسه ترک
     * @returns {Object} نتیجه
     */
    removeFromFavorites(trackId) {
        const track = this.tracks.get(trackId);
        if (!track) {
            return {
                success: false,
                error: 'TRACK_NOT_FOUND',
                message: 'ترک یافت نشد'
            };
        }

        track.isFavorite = false;
        this.stats.favoriteTracks = this.stats.favoriteTracks.filter(id => id !== trackId);

        this._emit('track-unfavorited', { track });

        return {
            success: true,
            track
        };
    }

    // ============================================================
    // بخش : موسیقی داینامیک
    // ============================================================

    /**
     * تغییر موسیقی بر اساس وضعیت بازی
     * @param {string} gameState - وضعیت بازی
     * @returns {Object} نتیجه
     */
    async setDynamicMusic(gameState) {
        if (!this.config.enableDynamicMusic) {
            return {
                success: false,
                error: 'DYNAMIC_MUSIC_DISABLED',
                message: 'موسیقی داینامیک غیرفعال است'
            };
        }

        const moodMap = {
            'menu': 'relaxed',
            'lobby': 'casual',
            'playing': 'focused',
            'winning': 'excited',
            'losing': 'tense',
            'victory': 'triumphant',
            'defeat': 'somber',
            'kot': 'dramatic',
            'tournament': 'epic'
        };

        const mood = moodMap[gameState] || 'neutral';
        const tracks = this.getTracksByMood(mood);

        if (tracks.length === 0) {
            return {
                success: false,
                error: 'NO_TRACKS_FOR_MOOD',
                message: `ترکی برای mood "${mood}" یافت نشد`
            };
        }

        // انتخاب ترک تصادفی از mood مناسب
        const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];

        return this.playTrack(randomTrack.id);
    }

    // ============================================================
    // بخش ۱۰: کنترل حجم صدا
    // ============================================================

    /**
     * تنظیم حجم موسیقی
     * @param {number} volume - حجم (0 تا 1)
     * @returns {Object} نتیجه
     */
    setVolume(volume) {
        if (volume < 0 || volume > 1) {
            return {
                success: false,
                error: 'INVALID_VOLUME',
                message: 'حجم باید بین 0 و 1 باشد'
            };
        }

        this.stats.currentVolume = volume;
        this.config.defaultVolume = volume;

        if (this.currentAudio) {
            this.currentAudio.volume = volume * (this.currentTrack?.volume || 1);
        }

        this._emit('volume-changed', { volume });

        if (this.debug) {
            console.log(`🔊 Music volume: ${volume}`);
        }

        return {
            success: true,
            volume
        };
    }

    /**
     * Mute کردن موسیقی
     * @returns {Object} نتیجه
     */
    mute() {
        this.musicEnabled = false;

        if (this.currentAudio) {
            this.currentAudio.volume = 0;
        }

        this._emit('music-muted');

        if (this.debug) {
            console.log('🔇 Music muted');
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
    unmute() {
        this.musicEnabled = true;

        if (this.currentAudio && this.currentTrack) {
            this.currentAudio.volume = this.stats.currentVolume * this.currentTrack.volume;
        }

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
    // بخش ۱۱: Fade In/Out
    // ============================================================

    /**
     * Fade in audio
     * @param {HTMLAudioElement} audio - عنصر audio
     * @param {number} targetVolume - حجم هدف
     * @returns {Promise<void>}
     * @private
     */
    async _fadeInAudio(audio, targetVolume) {
        const duration = this.config.fadeDuration;
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = targetVolume / steps;

        return new Promise((resolve) => {
            let currentStep = 0;

            const fadeInterval = setInterval(() => {
                currentStep++;
                audio.volume = Math.min(targetVolume, currentStep * volumeStep);

                if (currentStep >= steps) {
                    clearInterval(fadeInterval);
                    resolve();
                }
            }, stepTime);
        });
    }

    /**
     * Fade out ترک فعلی
     * @returns {Promise<void>}
     * @private
     */
    async _fadeOutCurrentTrack() {
        if (!this.currentAudio) return;

        const duration = this.config.fadeDuration;
        const steps = 20;
        const stepTime = duration / steps;
        const initialVolume = this.currentAudio.volume;
        const volumeStep = initialVolume / steps;

        return new Promise((resolve) => {
            let currentStep = 0;

            const fadeInterval = setInterval(() => {
                currentStep++;
                this.currentAudio.volume = Math.max(0, this.currentAudio.volume - volumeStep);

                if (currentStep >= steps) {
                    clearInterval(fadeInterval);
                    resolve();
                }
            }, stepTime);
        });
    }

    // ============================================================
    // بخش ۱۲: Event Handlers
    // ============================================================

    /**
     * مدیریت پایان ترک
     * @private
     */
    async _onTrackEnded() {
        const track = this.currentTrack;

        this._emit('track-ended', { track });

        // بر اساس play mode
        if (this.playMode === 'repeat-one') {
            await this.playTrack(track.id, { startTime: 0 });
        } else if (this.playMode === 'repeat-all' || this.playMode === 'normal') {
            await this.nextTrack();
        } else if (this.playMode === 'shuffle') {
            await this.nextTrack();
        }
    }

    /**
     * مدیریت خطای ترک
     * @param {Event} error - خطا
     * @private
     */
    _onTrackError(error) {
        console.error('❌ Track error:', error);

        this._emit('track-error', {
            track: this.currentTrack,
            error
        });

        // تلاش برای پخش ترک بعدی
        this.nextTrack();
    }

    /**
     * مدیریت به‌روزرسانی زمان
     * @private
     */
    _onTimeUpdate() {
        // این متد می‌تواند برای به‌روزرسانی UI استفاده شود
    }

    // ============================================================
    // بخش ۳: Progress Timer
    // ============================================================

    /**
     * شروع progress timer
     * @private
     */
    _startProgressTimer() {
        this._stopProgressTimer();

        this.progressTimer = setInterval(() => {
            if (this.currentAudio && this.currentTrack) {
                const currentTime = this.currentAudio.currentTime;
                const duration = this.currentAudio.duration || this.currentTrack.duration;
                const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

                this._emit('progress-updated', {
                    track: this.currentTrack,
                    currentTime,
                    duration,
                    progress
                });
            }
        }, 500);
    }

    /**
     * توقف progress timer
     * @private
     */
    _stopProgressTimer() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }

    // ============================================================
    // بخش ۱۴: تاریخچه پخش
    // ============================================================

    /**
     * اضافه کردن به تاریخچه پخش
     * @param {Object} track - ترک
     * @private
     */
    _addToPlayHistory(track) {
        const historyEntry = {
            trackId: track.id,
            trackName: track.name,
            artist: track.artist,
            playedAt: Date.now(),
            duration: this.currentAudio?.duration || track.duration,
            completed: false
        };

        this.playHistory.push(historyEntry);

        if (this.playHistory.length > this.maxHistorySize) {
            this.playHistory.shift();
        }
    }

    /**
     * دریافت تاریخچه پخش
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     */
    getPlayHistory(limit = 50) {
        return this.playHistory.slice(-limit).reverse();
    }

    /**
     * پاک کردن تاریخچه
     * @returns {number} تعداد پاکسازی شده
     */
    clearPlayHistory() {
        const count = this.playHistory.length;
        this.playHistory = [];

        return count;
    }

    // ============================================================
    // بخش ۱۵: ثبت ترک‌های پیش‌فرض
    // ============================================================

    /**
     * ثبت ترک‌های پیش‌فرض
     * @private
     */
    _registerDefaultTracks() {
        const defaultTracks = [
            {
                id: 'menu_theme',
                name: 'منوی اصلی',
                src: '/sounds/music/menu.mp3',
                artist: 'Hokm Master',
                album: 'Original Soundtrack',
                genre: 'ambient',
                mood: 'relaxed',
                bpm: 80
            },
            {
                id: 'game_theme',
                name: 'تم بازی',
                src: '/sounds/music/game.mp3',
                artist: 'Hokm Master',
                album: 'Original Soundtrack',
                genre: 'electronic',
                mood: 'focused',
                bpm: 120
            },
            {
                id: 'victory_theme',
                name: 'پیروزی',
                src: '/sounds/music/victory.mp3',
                artist: 'Hokm Master',
                album: 'Original Soundtrack',
                genre: 'orchestral',
                mood: 'triumphant',
                bpm: 140
            },
            {
                id: 'defeat_theme',
                name: 'شکست',
                src: '/sounds/music/defeat.mp3',
                artist: 'Hokm Master',
                album: 'Original Soundtrack',
                genre: 'ambient',
                mood: 'somber',
                bpm: 60
            },
            {
                id: 'lobby_theme',
                name: 'لابی',
                src: '/sounds/music/lobby.mp3',
                artist: 'Hokm Master',
                album: 'Original Soundtrack',
                genre: 'casual',
                mood: 'casual',
                bpm: 100
            },
            {
                id: 'tournament_theme',
                name: 'تورنمنت',
                src: '/sounds/music/tournament.mp3',
                artist: 'Hokm Master',
                album: 'Original Soundtrack',
                genre: 'epic',
                mood: 'epic',
                bpm: 130
            },
            {
                id: 'kot_theme',
                name: 'کت',
                src: '/sounds/music/kot.mp3',
                artist: 'Hokm Master',
                album: 'Original Soundtrack',
                genre: 'dramatic',
                mood: 'dramatic',
                bpm: 150
            },
            {
                id: 'relaxing_1',
                name: 'آرامش ۱',
                src: '/sounds/music/relaxing_1.mp3',
                artist: 'Hokm Master',
                album: 'Chill Collection',
                genre: 'ambient',
                mood: 'relaxed',
                bpm: 70
            },
            {
                id: 'energetic_1',
                name: 'انرژی ۱',
                src: '/sounds/music/energetic_1.mp3',
                artist: 'Hokm Master',
                album: 'Energy Collection',
                genre: 'electronic',
                mood: 'excited',
                bpm: 128
            },
            {
                id: 'tense_1',
                name: 'تنش ۱',
                src: '/sounds/music/tense_1.mp3',
                artist: 'Hokm Master',
                album: 'Tension Collection',
                genre: 'suspense',
                mood: 'tense',
                bpm: 110
            }
        ];

        this.registerTracks(defaultTracks);
    }

    /**
     * ایجاد playlist های پیش‌فرض
     * @private
     */
    _createDefaultPlaylists() {
        const defaultPlaylists = [
            {
                id: 'game',
                name: 'بازی',
                description: 'موسیقی‌های مناسب برای بازی',
                tracks: ['game_theme', 'tournament_theme', 'energetic_1'],
                isDefault: true
            },
            {
                id: 'menu',
                name: 'منو',
                description: 'موسیقی‌های منو و لابی',
                tracks: ['menu_theme', 'lobby_theme', 'relaxing_1'],
                isDefault: true
            },
            {
                id: 'victory',
                name: 'پیروزی',
                description: 'موسیقی‌های پیروزی و موفقیت',
                tracks: ['victory_theme', 'energetic_1'],
                isDefault: true
            },
            {
                id: 'all',
                name: 'همه',
                description: 'تمام موسیقی‌ها',
                tracks: Array.from(this.tracks.keys()),
                isDefault: true,
                shuffleByDefault: true
            }
        ];

        defaultPlaylists.forEach(playlist => {
            this.createPlaylist(playlist);
        });
    }

    // ============================================================
    // بخش ۶: دریافت اطلاعات
    // ============================================================

    /**
     * دریافت ترک فعلی
     * @returns {Object|null}
     */
    getCurrentTrack() {
        return this.currentTrack;
    }

    /**
     * دریافت playlist فعلی
     * @returns {Object|null}
     */
    getCurrentPlaylist() {
        return this.currentPlaylist;
    }

    /**
     * دریافت وضعیت پخش
     * @returns {Object}
     */
    getPlaybackStatus() {
        return {
            status: this.status,
            currentTrack: this.currentTrack,
            currentPlaylist: this.currentPlaylist,
            currentTrackIndex: this.currentTrackIndex,
            playMode: this.playMode,
            currentTime: this.currentAudio?.currentTime || 0,
            duration: this.currentAudio?.duration || this.currentTrack?.duration || 0,
            progress: this.currentAudio && this.currentTrack?.duration
                ? (this.currentAudio.currentTime / this.currentTrack.duration) * 100
                : 0,
            volume: this.stats.currentVolume,
            isFavorite: this.currentTrack?.isFavorite || false
        };
    }

    /**
     * دریافت ترک بعدی
     * @returns {Object|null}
     */
    getNextTrack() {
        if (!this.currentPlaylist) return null;

        const nextIndex = this._getNextTrackIndex();
        const nextTrackId = this.currentPlaylist.tracks[nextIndex];

        return this.tracks.get(nextTrackId) || null;
    }

    /**
     * دریافت ترک قبلی
     * @returns {Object|null}
     */
    getPreviousTrack() {
        if (!this.currentPlaylist) return null;

        const prevIndex = this._getPreviousTrackIndex();
        const prevTrackId = this.currentPlaylist.tracks[prevIndex];

        return this.tracks.get(prevTrackId) || null;
    }

    // ============================================================
    // بخش ۱۷: تنظیمات
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
            console.log(' Music Manager config updated');
        }

        return {
            success: true,
            config: this.config
        };
    }

    /**
     * فعال/غیرفعال کردن Music Manager
     * @param {boolean} enabled - آیا فعال باشد
     * @returns {Object} نتیجه
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        if (!enabled) {
            this.stop();
        }

        this._emit('music-manager-toggled', { enabled });

        if (this.debug) {
            console.log(` Music Manager ${enabled ? 'enabled' : 'disabled'}`);
        }

        return {
            success: true,
            enabled
        };
    }

    // ============================================================
    // بخش ۱۸: آمار و تحلیل
    // ============================================================

    /**
     * دریافت آمار کامل
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            totalTracks: this.tracks.size,
            totalPlaylists: this.playlists.size,
            currentTrack: this.currentTrack?.name || null,
            currentPlaylist: this.currentPlaylist?.name || null,
            status: this.status,
            playMode: this.playMode,
            playHistoryLength: this.playHistory.length,
            bookmarksCount: this.bookmarks.size,
            mostPlayedTracks: this._getMostPlayedTracks(5),
            recentlyPlayedTracks: this.playHistory.slice(-5).reverse()
        };
    }

    /**
     * دریافت پرپخش‌ترین ترک‌ها
     * @param {number} limit - تعداد
     * @returns {Array<Object>}
     * @private
     */
    _getMostPlayedTracks(limit = 5) {
        return Array.from(this.tracks.values())
            .sort((a, b) => b.playCount - a.playCount)
            .slice(0, limit);
    }

    /**
     * دریافت خلاصه وضعیت
     * @returns {Object}
     */
    getSummary() {
        return {
            enabled: this.enabled,
            musicEnabled: this.musicEnabled,
            status: this.status,
            currentTrack: this.currentTrack?.name || null,
            currentArtist: this.currentTrack?.artist || null,
            playMode: this.playMode,
            volume: this.stats.currentVolume,
            totalTracks: this.tracks.size,
            totalPlaylists: this.playlists.size
        };
    }

    // ============================================================
    // بخش ۹: توابع کمکی
    // ============================================================

    /**
     * فرمت زمان
     * @param {number} seconds - ثانیه
     * @returns {string}
     * @private
     */
    _formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * دریافت audio برای ترک
     * @param {string} trackId - شناسه ترک
     * @returns {HTMLAudioElement|null}
     * @private
     */
    _getAudioForTrack(trackId) {
        // در پیاده‌سازی کامل، هر ترک audio element خود را دارد
        return null;
    }

    /**
     * ذخیره داده‌ها
     * @private
     */
    _saveData() {
        if (storage) {
            storage.set('music_manager_stats', this.stats);
            storage.set('music_manager_config', this.config);
            storage.set('music_manager_bookmarks', Array.from(this.bookmarks.entries()));
            storage.set('music_manager_history', this.playHistory);
        }
    }

    /**
     * بارگذاری داده‌ها
     * @private
     */
    _loadData() {
        if (storage) {
            const stats = storage.get('music_manager_stats');
            if (stats) this.stats = { ...this.stats, ...stats };

            const config = storage.get('music_manager_config');
            if (config) this.config = { ...this.config, ...config };

            const bookmarks = storage.get('music_manager_bookmarks');
            if (bookmarks) this.bookmarks = new Map(bookmarks);

            const history = storage.get('music_manager_history');
            if (history) this.playHistory = history;
        }
    }

    // ============================================================
    // بخش ۲۰: کنترل‌ها
    // ============================================================

    /**
     * ریست کامل
     */
    async reset() {
        await this.stop();

        this.tracks.clear();
        this.playlists.clear();
        this.bookmarks.clear();
        this.playHistory = [];

        this.stats = {
            totalTracksLoaded: 0,
            totalTracksPlayed: 0,
            totalPlayTime: 0,
            totalPlaylistsCreated: 0,
            currentVolume: 0.5,
            lastTrackPlayedAt: null,
            favoriteTracks: []
        };

        // ثبت مجدد ترک‌ها و playlist های پیش‌فرض
        this._registerDefaultTracks();
        this._createDefaultPlaylists();

        this._saveData();

        if (this.debug) {
            console.log('🔄 MusicManager reset');
        }
    }

    /**
     * لاگ وضعیت
     */
    logStatus() {
        const stats = this.getStats();
        const summary = this.getSummary();

        console.log('🎵 MusicManager Status:');
        console.log('  Enabled:', summary.enabled);
        console.log('  Music Enabled:', summary.musicEnabled);
        console.log('  Status:', summary.status);
        console.log('  Current Track:', summary.currentTrack);
        console.log('  Current Artist:', summary.currentArtist);
        console.log('  Play Mode:', summary.playMode);
        console.log('  Volume:', summary.volume);
        console.log('  Total Tracks:', summary.totalTracks);
        console.log('  Total Playlists:', summary.totalPlaylists);
        console.log('  Most Played:', stats.mostPlayedTracks.map(t => t.name).join(', '));
    }

    // ============================================================
    // بخش ۲۱: Event System
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
                    console.error(`❌ Music Manager event listener error:`, error);
                }
            });
        }

        eventBus.emit(`music:${event}`, data);
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
const musicManager = new MusicManager();

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MusicManager, musicManager };
} else {
    window.MusicManager = MusicManager;
    window.musicManager = musicManager;
}

console.log('✅ MusicManager loaded - 10 tracks, 4 playlists');
