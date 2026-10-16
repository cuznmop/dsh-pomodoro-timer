/**
 * Browser half of the Pomodoro bundle.
 *
 * Contributes two slot entries:
 *   - `sidebar.panellist` + `main` (key `pomodoro-timer`): the timer page.
 *   - `conversation.composer.dock`: a compact countdown pill that opens the page.
 *
 * The timer itself is one module-level singleton store shared by both entries,
 * so the countdown keeps running while the page is not the active panel. It
 * survives a page reload through localStorage and is disposed with the plugin.
 */
window.__ModuleLoader__.load({
	id: 'dsh-pomodoro-timer',
	factory(require) {
		const React = require('react');
		const h = React.createElement;

		/**
		 * Dictionary namespace, panel id, and storage key are namespaced with
		 * `-timer` so this plugin can coexist with community Pomodoro plugins that
		 * own the plain `pomodoro` id, namespace, and storage key.
		 */
		const NS = 'pomodoroTimer';
		/** Id shared by the sidebar entry and the main panel it opens. */
		const PANEL_ID = 'pomodoro-timer';
		const STORAGE_KEY = 'dsh.plugin.pomodoro-timer.v1';

		const FOCUS = 'focus';
		const SHORT = 'shortBreak';
		const LONG = 'longBreak';

		const zh = {
			panel: '番茄钟',
			title: '番茄钟',
			subtitle: '专注一段时间，然后休息一下。',
			'phase.focus': '专注',
			'phase.shortBreak': '短休息',
			'phase.longBreak': '长休息',
			'action.start': '开始',
			'action.pause': '暂停',
			'action.resume': '继续',
			'action.reset': '重置',
			'action.skip': '跳过',
			'stat.round': '本轮第 {round} 个番茄',
			'stat.completed': '今天完成 {completed} 个',
			'stat.idle': '还没开始',
			'settings.title': '设置',
			'settings.hint': '修改时长会重置当前阶段的剩余时间。',
			'settings.focus': '专注时长（分钟）',
			'settings.short': '短休息（分钟）',
			'settings.long': '长休息（分钟）',
			'settings.every': '每几个番茄后长休息',
			'settings.autoNext': '自动进入下一阶段',
			'settings.sound': '阶段结束时提示音',
			'settings.resetStats': '清除统计',
			'dock.open': '打开番茄钟',
		};
		const en = {
			panel: 'Pomodoro',
			title: 'Pomodoro timer',
			subtitle: 'Focus for a while, then take a break.',
			'phase.focus': 'Focus',
			'phase.shortBreak': 'Short break',
			'phase.longBreak': 'Long break',
			'action.start': 'Start',
			'action.pause': 'Pause',
			'action.resume': 'Resume',
			'action.reset': 'Reset',
			'action.skip': 'Skip',
			'stat.round': 'Pomodoro {round} of this round',
			'stat.completed': '{completed} completed today',
			'stat.idle': 'Not started',
			'settings.title': 'Settings',
			'settings.hint': 'Changing a duration resets the time left in the current phase.',
			'settings.focus': 'Focus length (minutes)',
			'settings.short': 'Short break (minutes)',
			'settings.long': 'Long break (minutes)',
			'settings.every': 'Pomodoros before a long break',
			'settings.autoNext': 'Start the next phase automatically',
			'settings.sound': 'Chime when a phase ends',
			'settings.resetStats': 'Clear statistics',
			'dock.open': 'Open the Pomodoro timer',
		};

		const DEFAULT_SETTINGS = {
			focusMinutes: 25,
			shortMinutes: 5,
			longMinutes: 15,
			longEvery: 4,
			autoNext: true,
			sound: true,
		};

		// ---------------------------------------------------------------- store

		const clampMinutes = (value, fallback) => {
			const number = Math.round(Number(value));
			if (!Number.isFinite(number)) return fallback;
			return Math.min(180, Math.max(1, number));
		};
		const clampEvery = (value, fallback) => {
			const number = Math.round(Number(value));
			if (!Number.isFinite(number)) return fallback;
			return Math.min(12, Math.max(1, number));
		};

		const normalizeSettings = (raw) => {
			const source = raw !== null && typeof raw === 'object' ? raw : {};
			return {
				focusMinutes: clampMinutes(source.focusMinutes, DEFAULT_SETTINGS.focusMinutes),
				shortMinutes: clampMinutes(source.shortMinutes, DEFAULT_SETTINGS.shortMinutes),
				longMinutes: clampMinutes(source.longMinutes, DEFAULT_SETTINGS.longMinutes),
				longEvery: clampEvery(source.longEvery, DEFAULT_SETTINGS.longEvery),
				autoNext: source.autoNext === void 0 ? DEFAULT_SETTINGS.autoNext : source.autoNext !== false,
				sound: source.sound === void 0 ? DEFAULT_SETTINGS.sound : source.sound !== false,
			};
		};

		const today = () => new Date().toISOString().slice(0, 10);

		/**
		 * Create the timer store: one singleton owning the countdown, the phase
		 * machine, the persisted state, and the notification chime.
		 * @returns the store handle used by both slot entries.
		 */
		function createPomodoro() {
			const settings = normalizeSettings(null);
			let state = {
				settings,
				phase: FOCUS,
				running: false,
				remainingMs: settings.focusMinutes * 60000,
				endsAt: null,
				round: 0,
				completed: 0,
				day: today(),
			};
			const listeners = new Set();
			let ticker = null;
			let audio = null;

			const durationOf = (phase, from = state.settings) =>
				(phase === FOCUS
					? from.focusMinutes
					: phase === SHORT
						? from.shortMinutes
						: from.longMinutes) * 60000;

			const save = () => {
				try {
					window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
				} catch (error) {
					void error;
				}
			};
			const emit = () => {
				for (const listener of [...listeners]) {
					try {
						listener();
					} catch (error) {
						console.error('pomodoro-timer: listener failed', error);
					}
				}
			};
			const commit = (patch, persist) => {
				state = { ...state, ...patch };
				if (persist !== false) save();
				emit();
			};

			const stopTicker = () => {
				if (ticker === null) return;
				window.clearInterval(ticker);
				ticker = null;
			};
			const tick = () => {
				if (!state.running || state.endsAt === null) {
					stopTicker();
					return;
				}
				const remaining = state.endsAt - Date.now();
				if (remaining > 0) {
					commit({ remainingMs: remaining }, false);
					return;
				}
				advance(true);
			};
			const ensureTicker = () => {
				if (ticker !== null) return;
				ticker = window.setInterval(tick, 250);
			};

			const chime = () => {
				if (!state.settings.sound) return;
				try {
					const Ctor = window.AudioContext ?? window.webkitAudioContext;
					if (Ctor === void 0) return;
					audio = audio ?? new Ctor();
					if (audio.state === 'suspended') void audio.resume();
					const origin = audio.currentTime;
					[660, 880, 1320].forEach((frequency, index) => {
						const at = origin + index * 0.16;
						const oscillator = audio.createOscillator();
						const gain = audio.createGain();
						oscillator.type = 'sine';
						oscillator.frequency.value = frequency;
						gain.gain.setValueAtTime(0.0001, at);
						gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
						gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
						oscillator.connect(gain);
						gain.connect(audio.destination);
						oscillator.start(at);
						oscillator.stop(at + 0.16);
					});
				} catch (error) {
					void error;
				}
			};

			const start = () => {
				const remaining = state.remainingMs > 0 ? state.remainingMs : durationOf(state.phase);
				state = { ...state, running: true, remainingMs: remaining, endsAt: Date.now() + remaining };
				ensureTicker();
				save();
				emit();
			};
			const pause = () => {
				const remaining = state.endsAt === null ? state.remainingMs : Math.max(0, state.endsAt - Date.now());
				stopTicker();
				commit({ running: false, endsAt: null, remainingMs: remaining });
			};
			const reset = () => {
				stopTicker();
				commit({ running: false, endsAt: null, remainingMs: durationOf(state.phase) });
			};
			/** Roll the day counter over at the first event of a new day. */
			const rollDay = () => {
				const now = today();
				if (state.day === now) return {};
				return { day: now, completed: 0, round: 0 };
			};
			/**
			 * Leave the current phase.
			 * @param credit - whether a finished focus phase counts toward the round.
			 */
			const advance = (credit) => {
				const finished = state.phase;
				const rollover = rollDay();
				const credited = finished === FOCUS && credit ? 1 : 0;
				const round = (rollover.round ?? state.round) + credited;
				const completed = (rollover.completed ?? state.completed) + credited;
				const every = Math.max(1, state.settings.longEvery);
				const next =
					finished === FOCUS
						? (credit ? round : round + 1) % every === 0
							? LONG
							: SHORT
						: FOCUS;
				stopTicker();
				state = {
					...state,
					...rollover,
					phase: next,
					round,
					completed,
					running: false,
					endsAt: null,
					remainingMs: durationOf(next),
				};
				if (credit) chime();
				if (state.settings.autoNext) start();
				else {
					save();
					emit();
				}
			};

			/** Restore a persisted run so a page reload does not lose the countdown. */
			const restore = () => {
				let raw = null;
				try {
					raw = window.localStorage.getItem(STORAGE_KEY);
				} catch (error) {
					void error;
				}
				if (raw === null) return;
				let parsed = null;
				try {
					parsed = JSON.parse(raw);
				} catch (error) {
					void error;
					return;
				}
				if (parsed === null || typeof parsed !== 'object') return;
				const restoredSettings = normalizeSettings(parsed.settings);
				const phase = parsed.phase === SHORT || parsed.phase === LONG ? parsed.phase : FOCUS;
				const running = parsed.running === true && typeof parsed.endsAt === 'number';
				const remaining = running
					? Math.max(0, parsed.endsAt - Date.now())
					: typeof parsed.remainingMs === 'number' && parsed.remainingMs > 0
						? parsed.remainingMs
						: durationOf(phase, restoredSettings);
				state = {
					settings: restoredSettings,
					phase,
					running: running && remaining > 0,
					remainingMs: remaining > 0 ? remaining : durationOf(phase, restoredSettings),
					endsAt: running && remaining > 0 ? parsed.endsAt : null,
					round: Number.isFinite(parsed.round) ? Math.max(0, Math.round(parsed.round)) : 0,
					completed: Number.isFinite(parsed.completed) ? Math.max(0, Math.round(parsed.completed)) : 0,
					day: typeof parsed.day === 'string' ? parsed.day : today(),
				};
				if (state.running) ensureTicker();
			};

			return {
				subscribe(listener) {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				getSnapshot: () => state,
				restore,
				start,
				pause,
				toggle() {
					if (state.running) pause();
					else start();
				},
				reset,
				skip: () => advance(false),
				updateSettings(patch) {
					const settings = normalizeSettings({ ...state.settings, ...patch });
					state = {
						...state,
						settings,
						remainingMs: state.running ? state.remainingMs : durationOf(state.phase, settings),
					};
					save();
					emit();
				},
				resetStats() {
					commit({ round: 0, completed: 0, day: today() });
				},
				dispose() {
					stopTicker();
					listeners.clear();
					if (audio !== null) {
						try {
							void audio.close();
						} catch (error) {
							void error;
						}
						audio = null;
					}
				},
			};
		}

		// -------------------------------------------------------------- helpers

		const useSyncExternalStore = React.useSyncExternalStore;
		/** Subscribe one component to a store handle. */
		function useStore(store) {
			if (useSyncExternalStore !== void 0) {
				return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
			}
			const [value, setValue] = React.useState(store.getSnapshot);
			React.useEffect(() => store.subscribe(() => setValue(store.getSnapshot())), [store]);
			return value;
		}

		const formatClock = (ms) => {
			const total = Math.max(0, Math.ceil(ms / 1000));
			const minutes = Math.floor(total / 60);
			const seconds = total % 60;
			return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
		};

		const TOKEN = {
			primary: 'var(--dsw-alias-label-primary)',
			secondary: 'var(--dsw-alias-label-secondary)',
			tertiary: 'var(--dsw-alias-label-tertiary)',
			layer1: 'var(--dsw-alias-bg-layer-1)',
			layer2: 'var(--dsw-alias-bg-layer-2)',
			border1: 'var(--dsw-alias-border-l1)',
			border2: 'var(--dsw-alias-border-l2)',
			brand: 'var(--dsw-alias-brand-primary)',
			success: 'var(--dsw-alias-state-success-primary)',
			hover: 'var(--dsw-alias-interactive-bg-hover)',
		};

		const PHASE_COLOR = {
			[FOCUS]: 'var(--dsw-alias-state-warn-primary)',
			[SHORT]: TOKEN.success,
			[LONG]: TOKEN.brand,
		};

		/** Theme-colored clock glyph used by the sidebar row. */
		function ClockGlyph({ size, active }) {
			return h(
				'svg',
				{
					width: size,
					height: size,
					viewBox: '0 0 24 24',
					fill: 'none',
					'aria-hidden': true,
					style: { display: 'block' },
				},
				h('circle', {
					cx: 12,
					cy: 12.6,
					r: 8.2,
					stroke: 'currentColor',
					strokeWidth: active ? 2.1 : 1.8,
				}),
				h('path', {
					d: 'M12 12.6V7.9',
					stroke: 'currentColor',
					strokeWidth: active ? 2.1 : 1.8,
					strokeLinecap: 'round',
				}),
				h('path', {
					d: 'M12 12.6l3.4 2.3',
					stroke: 'currentColor',
					strokeWidth: active ? 2.1 : 1.8,
					strokeLinecap: 'round',
				}),
				h('path', {
					d: 'M9.4 3.2c1.3-1.6 3.9-1.6 5.2 0',
					stroke: 'currentColor',
					strokeWidth: active ? 2.1 : 1.8,
					strokeLinecap: 'round',
				}),
			);
		}

		/** Host-styled button with a hover state and a focus ring. */
		function Button({ label, onClick, variant, disabled }) {
			const [hover, setHover] = React.useState(false);
			const primary = variant === 'primary';
			const background = primary
				? hover
					? 'var(--dsw-alias-button-primary-hover)'
					: 'var(--dsw-alias-button-primary-fill)'
				: hover
					? TOKEN.hover
					: TOKEN.layer2;
			return h(
				'button',
				{
					type: 'button',
					onClick,
					disabled,
					onMouseEnter: () => setHover(true),
					onMouseLeave: () => setHover(false),
					onFocus: () => setHover(true),
					onBlur: () => setHover(false),
					style: {
						font: 'inherit',
						fontSize: 13,
						lineHeight: '20px',
						padding: '6px 14px',
						borderRadius: 8,
						border: `1px solid ${primary ? 'transparent' : TOKEN.border2}`,
						background,
						color: primary ? 'var(--dsw-alias-label-primary-foreground)' : TOKEN.primary,
						cursor: disabled ? 'default' : 'pointer',
						opacity: disabled ? 0.5 : 1,
						outline: hover ? `1px solid ${TOKEN.border2}` : 'none',
					},
				},
				label,
			);
		}

		/** Numeric setting row. */
		function NumberField({ label, value, min, max, onChange }) {
			return h(
				'label',
				{ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
				h('span', { style: { fontSize: 13, color: TOKEN.secondary } }, label),
				h('input', {
					type: 'number',
					value,
					min,
					max,
					onChange: (event) => onChange(event.target.value),
					style: {
						width: 74,
						font: 'inherit',
						fontSize: 13,
						padding: '4px 8px',
						borderRadius: 6,
						border: `1px solid ${TOKEN.border2}`,
						background: TOKEN.layer2,
						color: TOKEN.primary,
						textAlign: 'right',
					},
				}),
			);
		}

		/** Switch row matching the host's `role="switch"` control. */
		function SwitchRow({ label, checked, onChange }) {
			return h(
				'div',
				{ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
				h('span', { style: { fontSize: 13, color: TOKEN.secondary } }, label),
				h(
					'button',
					{
						type: 'button',
						role: 'switch',
						'aria-checked': checked,
						'aria-label': label,
						onClick: () => onChange(!checked),
						style: {
							position: 'relative',
							width: 38,
							height: 22,
							padding: 0,
							borderRadius: 11,
							border: 'none',
							cursor: 'pointer',
							background: checked ? TOKEN.brand : TOKEN.border2,
							transition: 'background 120ms ease',
						},
					},
					h('span', {
						style: {
							position: 'absolute',
							top: 3,
							left: checked ? 19 : 3,
							width: 16,
							height: 16,
							borderRadius: 8,
							background: 'var(--dsw-alias-switch-thumb, #fff)',
							transition: 'left 120ms ease',
						},
					}),
				),
			);
		}

		/** Progress ring with the remaining time in its center. */
		function Ring({ progress, color, children }) {
			const radius = 66;
			const circumference = 2 * Math.PI * radius;
			return h(
				'div',
				{ style: { position: 'relative', width: 160, height: 160, flex: '0 0 auto' } },
				h(
					'svg',
					{ width: 160, height: 160, viewBox: '0 0 160 160', 'aria-hidden': true },
					h('circle', {
						cx: 80,
						cy: 80,
						r: radius,
						fill: 'none',
						stroke: TOKEN.border1,
						strokeWidth: 8,
					}),
					h('circle', {
						cx: 80,
						cy: 80,
						r: radius,
						fill: 'none',
						stroke: color,
						strokeWidth: 8,
						strokeLinecap: 'round',
						strokeDasharray: circumference,
						strokeDashoffset: circumference * (1 - Math.min(1, Math.max(0, progress))),
						transform: 'rotate(-90 80 80)',
						style: { transition: 'stroke-dashoffset 240ms linear' },
					}),
				),
				h(
					'div',
					{
						style: {
							position: 'absolute',
							inset: 0,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 2,
						},
					},
					children,
				),
			);
		}

		const cardStyle = {
			background: TOKEN.layer1,
			border: `1px solid ${TOKEN.border1}`,
			borderRadius: 12,
			padding: 20,
		};

		/**
		 * The Pomodoro page rendered in the `main` panel for this plugin's id.
		 * @param props - slot props: the injected store handle and the bound `t`.
		 */
		function PomodoroPage({ pomodoro, t }) {
			const state = useStore(pomodoro);
			const total = state.phase === FOCUS
				? state.settings.focusMinutes * 60000
				: state.phase === SHORT
					? state.settings.shortMinutes * 60000
					: state.settings.longMinutes * 60000;
			const progress = total === 0 ? 0 : 1 - state.remainingMs / total;
			const phaseLabel = t(`phase.${state.phase}`);
			const started = state.running || state.completed > 0 || state.remainingMs < total;
			return h(
				'div',
				{
					style: {
						height: '100%',
						overflowY: 'auto',
						padding: '28px 32px 40px',
						color: TOKEN.primary,
					},
				},
				h(
					'div',
					{ style: { maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 } },
					h(
						'header',
						null,
						h('h1', { style: { margin: 0, fontSize: 20, fontWeight: 600 } }, t('title')),
						h('p', { style: { margin: '6px 0 0', fontSize: 13, color: TOKEN.tertiary } }, t('subtitle')),
					),
					h(
						'div',
						{ style: { ...cardStyle, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' } },
						h(
							Ring,
							{ progress, color: PHASE_COLOR[state.phase] },
							h('span', { style: { fontSize: 12, color: TOKEN.tertiary } }, phaseLabel),
							h(
								'span',
								{
									style: {
										fontSize: 30,
										fontWeight: 600,
										fontVariantNumeric: 'tabular-nums',
										color: TOKEN.primary,
									},
								},
								formatClock(state.remainingMs),
							),
						),
						h(
							'div',
							{ style: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 220, flex: '1 1 220px' } },
							h(
								'div',
								{ style: { display: 'flex', flexDirection: 'column', gap: 4 } },
								h(
									'span',
									{ style: { fontSize: 15, fontWeight: 600 } },
									phaseLabel,
								),
								h(
									'span',
									{ style: { fontSize: 12, color: TOKEN.tertiary } },
									started
										? `${t('stat.round', { round: state.round })} · ${t('stat.completed', { completed: state.completed })}`
										: t('stat.idle'),
								),
							),
							h(
								'div',
								{ style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
								h(Button, {
									label: state.running ? t('action.pause') : started ? t('action.resume') : t('action.start'),
									variant: 'primary',
									onClick: () => pomodoro.toggle(),
								}),
								h(Button, { label: t('action.reset'), onClick: () => pomodoro.reset() }),
								h(Button, { label: t('action.skip'), onClick: () => pomodoro.skip() }),
							),
						),
					),
					h(
						'section',
						{ style: { ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 } },
						h('h2', { style: { margin: 0, fontSize: 14, fontWeight: 600 } }, t('settings.title')),
						h(
							'div',
							{
								style: {
									display: 'grid',
									gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
									gap: 12,
								},
							},
							h(NumberField, {
								label: t('settings.focus'),
								value: state.settings.focusMinutes,
								min: 1,
								max: 180,
								onChange: (value) => pomodoro.updateSettings({ focusMinutes: value }),
							}),
							h(NumberField, {
								label: t('settings.short'),
								value: state.settings.shortMinutes,
								min: 1,
								max: 180,
								onChange: (value) => pomodoro.updateSettings({ shortMinutes: value }),
							}),
							h(NumberField, {
								label: t('settings.long'),
								value: state.settings.longMinutes,
								min: 1,
								max: 180,
								onChange: (value) => pomodoro.updateSettings({ longMinutes: value }),
							}),
							h(NumberField, {
								label: t('settings.every'),
								value: state.settings.longEvery,
								min: 1,
								max: 12,
								onChange: (value) => pomodoro.updateSettings({ longEvery: value }),
							}),
							h(SwitchRow, {
								label: t('settings.autoNext'),
								checked: state.settings.autoNext,
								onChange: (value) => pomodoro.updateSettings({ autoNext: value }),
							}),
							h(SwitchRow, {
								label: t('settings.sound'),
								checked: state.settings.sound,
								onChange: (value) => pomodoro.updateSettings({ sound: value }),
							}),
						),
						h(
							'div',
							{ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
							h('span', { style: { fontSize: 12, color: TOKEN.tertiary } }, t('settings.hint')),
							h(Button, { label: t('settings.resetStats'), onClick: () => pomodoro.resetStats() }),
						),
					),
				),
			);
		}

		/** Compact countdown in the composer dock; opens the page when clicked. */
		function DockPill({ pomodoro, t, open }) {
			const state = useStore(pomodoro);
			const [hover, setHover] = React.useState(false);
			const total = state.phase === FOCUS
				? state.settings.focusMinutes * 60000
				: state.phase === SHORT
					? state.settings.shortMinutes * 60000
					: state.settings.longMinutes * 60000;
			const started = state.running || state.remainingMs < total;
			return h(
				'button',
				{
					type: 'button',
					title: t('dock.open'),
					'aria-label': t('dock.open'),
					onClick: open,
					onMouseEnter: () => setHover(true),
					onMouseLeave: () => setHover(false),
					style: {
						display: 'inline-flex',
						alignItems: 'center',
						gap: 6,
						font: 'inherit',
						fontSize: 12,
						lineHeight: '18px',
						padding: '3px 9px',
						borderRadius: 999,
						border: `1px solid ${TOKEN.border1}`,
						background: hover ? TOKEN.hover : 'transparent',
						color: state.running ? PHASE_COLOR[state.phase] : TOKEN.tertiary,
						cursor: 'pointer',
						fontVariantNumeric: 'tabular-nums',
					},
				},
				h(ClockGlyph, { size: 13, active: state.running }),
				h('span', null, started ? formatClock(state.remainingMs) : t('panel')),
			);
		}

		// ---------------------------------------------------------------- plugin

		return {
			inject: ['slots', 'locale'],
			apply(ctx) {
				ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'pomodoro-timer: dictionaries');
				const t = ctx.locale.bind(NS);
				const pomodoro = createPomodoro();
				ctx.effect(
					() => () => {
						pomodoro.dispose();
					},
					'pomodoro-timer: timer',
				);
				pomodoro.restore();
				const openPanel = () => {
					const layout = ctx.get('layout');
					if (layout !== void 0 && typeof layout.selectPanel === 'function') layout.selectPanel(PANEL_ID);
				};

				ctx.slots.inject('sidebar.panellist', () =>
					ctx.slots.register(
						{
							name: 'sidebar.panellist',
							id: PANEL_ID,
							order: 20,
							label: () => t('panel'),
							locale: NS,
						},
						ClockGlyph,
					),
				);
				ctx.slots.inject('main', () =>
					ctx.slots.register(
						{
							name: 'main',
							key: PANEL_ID,
							locale: NS,
							inject: () => ({ pomodoro }),
						},
						PomodoroPage,
					),
				);
				ctx.slots.inject('conversation.composer.dock', () =>
					ctx.slots.register(
						{
							name: 'conversation.composer.dock',
							id: 'pomodoro-timer',
							order: 30,
							locale: NS,
							inject: () => ({ pomodoro, open: openPanel }),
						},
						DockPill,
					),
				);
			},
		};
	},
});
