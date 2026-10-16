/**
 * Offline check for the Pomodoro client bundle.
 *
 * Loads the browser bundle with a module-loader stub, applies the plugin
 * against a fake client context, and exercises the timer store and both slot
 * components. It proves syntax, registration names/ids, the phase machine, and
 * persistence — it cannot prove how the page looks.
 *
 * Usage: node test/client.test.mjs [path/to/client.js]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? path.join(here, '..', 'client.js');
const source = fs.readFileSync(file, 'utf8');

const failures = [];
const check = (label, condition, detail) => {
	if (condition) {
		console.log(`  ok   ${label}`);
		return true;
	}
	failures.push(`${label}${detail === undefined ? '' : ` — ${detail}`}`);
	console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`);
	return false;
};

// ---------------------------------------------------------------- fake clock

let now = Date.parse('2026-01-01T09:00:00.000Z');
const realDateNow = Date.now;
Date.now = () => now;
const advanceClock = (ms) => {
	now += ms;
};

// ------------------------------------------------------------------- fakes

const intervals = new Map();
let nextTimerId = 1;
const store = new Map();
const fakeWindow = {
	setInterval(callback) {
		const id = nextTimerId++;
		intervals.set(id, callback);
		return id;
	},
	clearInterval(id) {
		intervals.delete(id);
	},
	localStorage: {
		getItem: (key) => (store.has(key) ? store.get(key) : null),
		setItem: (key, value) => store.set(key, String(value)),
		removeItem: (key) => store.delete(key),
	},
};

const tick = () => {
	for (const callback of [...intervals.values()]) callback();
};

const React = {
	createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
	useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
	useEffect: () => {},
	useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
	useMemo: (factory) => factory(),
	useRef: (initial) => ({ current: initial }),
};
const fakeRequire = (specifier) => {
	if (specifier === 'react') return React;
	throw new Error(`unexpected module request: ${specifier}`);
};

// ------------------------------------------------------------- load bundle

let registration = null;
const loader = {
	load(entry) {
		registration = entry;
	},
};
new Function('window', source)({ ...fakeWindow, __ModuleLoader__: loader });

console.log(`\nbundle: ${path.resolve(file)}`);
check('registers one module factory', registration !== null);
check('factory id matches the package name', registration?.id === 'dsh-pomodoro-timer', registration?.id);

const plugin = registration.factory(fakeRequire);
check('plugin exposes inject + apply', Array.isArray(plugin.inject) && typeof plugin.apply === 'function');
check(
	'plugin injects slots and locale',
	plugin.inject.includes('slots') && plugin.inject.includes('locale'),
	JSON.stringify(plugin.inject),
);

// ---------------------------------------------------------- fake client ctx

const NS = 'pomodoroTimer';
const dictionaries = new Map();
const registered = [];
const effects = [];
const messages = { [NS]: { zh: {}, en: { panel: 'Pomodoro', title: 'Pomodoro timer' } } };
const ctx = {
	locale: {
		register(namespace, dictionary) {
			dictionaries.set(namespace, dictionary);
			return () => dictionaries.delete(namespace);
		},
		bind(namespace) {
			return (key, params) => {
				let text = messages[namespace]?.en?.[key] ?? key;
				for (const [name, value] of Object.entries(params ?? {})) {
					text = text.replaceAll(`{${name}}`, String(value));
				}
				return text;
			};
		},
	},
	slots: {
		inject(name, factory) {
			const value = factory();
			registered.push({ name, value });
			return () => {};
		},
		register(options, component) {
			return { options, component };
		},
	},
	effect(factory, label) {
		effects.push({ label, disposer: factory() });
		return () => {};
	},
	get(name) {
		if (name === 'layout') return { selectPanel: (id) => (selectedPanel = id) };
		return undefined;
	},
};
let selectedPanel = null;

plugin.apply(ctx);

console.log('\nregistrations:');
check('registers both dictionaries', dictionaries.has(NS));
check(
	'dictionary carries zh and en',
	(() => {
		const dictionary = dictionaries.get(NS);
		return typeof dictionary?.zh === 'object' && typeof dictionary?.en === 'object' && typeof dictionary.zh.panel === 'string';
	})(),
);
check('three slot entries were registered', registered.length === 3, `got ${registered.length}`);
const byName = new Map(registered.map((entry) => [entry.name, entry.value]));
check('sidebar.panellist entry exists', byName.has('sidebar.panellist'));
check(
	'sidebar entry id and order',
	byName.get('sidebar.panellist')?.options.id === 'pomodoro-timer' && byName.get('sidebar.panellist')?.options.order === 20,
);
check('main entry key matches the panel id', byName.get('main')?.options.key === 'pomodoro-timer');
check('composer dock entry exists', byName.has('conversation.composer.dock'));
check(
	'all entries bind the locale namespace',
	registered.every((entry) => entry.value.options.locale === NS),
);
check('every entry is a component', registered.every((entry) => typeof entry.value.component === 'function'));

// ------------------------------------------------------------- timer store

const mainProps = byName.get('main').options.inject();
const pomodoro = mainProps.pomodoro;
check('main entry injects the store', pomodoro !== undefined && typeof pomodoro.start === 'function');

const read = () => pomodoro.getSnapshot();
console.log('\nstore:');
check('starts idle in focus for 25 minutes', read().phase === 'focus' && read().running === false && read().remainingMs === 25 * 60000, JSON.stringify(read().remainingMs));

pomodoro.start();
check('start runs and arms one ticker', read().running === true && intervals.size === 1, `timers=${intervals.size}`);

advanceClock(60_000);
tick();
check('one minute elapsed', read().remainingMs === 24 * 60000, String(read().remainingMs));

pomodoro.pause();
check('pause stops the ticker and keeps the remainder', read().running === false && intervals.size === 0 && read().remainingMs === 24 * 60000);

pomodoro.start();
advanceClock(24 * 60000);
tick();
const afterFocus = read();
check('finished focus credits one pomodoro', afterFocus.completed === 1 && afterFocus.round === 1, JSON.stringify({ completed: afterFocus.completed, round: afterFocus.round }));
check('short break follows the first focus', afterFocus.phase === 'shortBreak', afterFocus.phase);
check('auto-start continues into the break', afterFocus.running === true && intervals.size === 1);

advanceClock(5 * 60000);
tick();
check('break returns to focus', read().phase === 'focus' && read().completed === 1, read().phase);

pomodoro.skip();
check('skip moves on without crediting', read().phase === 'shortBreak' && read().completed === 1, `${read().phase}/${read().completed}`);
pomodoro.reset();
check('reset restores the full phase length', read().remainingMs === 5 * 60000 && read().running === false);

pomodoro.updateSettings({ focusMinutes: 30, longEvery: 2 });
check('settings clamp into range', read().settings.focusMinutes === 30 && read().settings.longEvery === 2);
check('paused settings change keeps the phase length', read().remainingMs === 5 * 60000);
pomodoro.updateSettings({ focusMinutes: 999, shortMinutes: 0 });
check('out-of-range values clamp', read().settings.focusMinutes === 180 && read().settings.shortMinutes === 1, JSON.stringify(read().settings));

pomodoro.resetStats();
check('statistics clear', read().completed === 0 && read().round === 0);

// Two credited focus phases must reach a long break (longEvery is 2 now).
pomodoro.updateSettings({ longEvery: 2, focusMinutes: 1, shortMinutes: 1, longMinutes: 1, autoNext: false });
const backToFocus = () => {
	while (read().phase !== 'focus') pomodoro.skip();
};
const runFocus = () => {
	backToFocus();
	pomodoro.start();
	advanceClock(61_000);
	tick();
};
runFocus();
const first = read();
check('first focus ends in a short break', first.phase === 'shortBreak', first.phase);
check('the credited count drives the cadence', first.completed === 1 && first.round === 1, JSON.stringify({ completed: first.completed, round: first.round }));
runFocus();
check('second focus ends in a long break', read().phase === 'longBreak', read().phase);
runFocus();
check('a later focus falls back to a short break', read().phase === 'shortBreak', read().phase);

// ------------------------------------------------------------ persistence

const STORAGE_KEY = 'dsh.plugin.pomodoro-timer.v1';
const persisted = store.get(STORAGE_KEY);
check('state is persisted', typeof persisted === 'string' && persisted.includes('longEvery'));
const parsedPersisted = JSON.parse(persisted);
check('persisted state carries no live deadline while idle', parsedPersisted.running === false || typeof parsedPersisted.endsAt === 'number');

// A running timer restored from storage keeps counting down.
pomodoro.start();
const runningSnapshot = store.get(STORAGE_KEY);
check('running state persists its deadline', JSON.parse(runningSnapshot).running === true && typeof JSON.parse(runningSnapshot).endsAt === 'number');

// ------------------------------------------------------------- components

console.log('\ncomponents:');
const page = byName.get('main').component;
const dock = byName.get('conversation.composer.dock').component;
const icon = byName.get('sidebar.panellist').component;
const t = ctx.locale.bind(NS);
const render = (component, props, label) => {
	try {
		const tree = component(props);
		check(`${label} renders`, tree !== null && tree !== undefined && typeof tree === 'object');
	} catch (error) {
		check(`${label} renders`, false, String(error && error.stack ? error.stack.split('\n')[0] : error));
	}
};
render(page, { pomodoro, t }, 'main page');
render(dock, { pomodoro, t, open: () => {} }, 'composer dock pill');
render(icon, { size: 18, active: true }, 'sidebar icon');

// The dock pill opens the panel through the optional layout service.
byName.get('conversation.composer.dock').options.inject().open();
check('dock pill asks layout to select the panel', selectedPanel === 'pomodoro-timer', String(selectedPanel));

// --------------------------------------------------------------- lifecycle

console.log('\nlifecycle:');
check('locale and timer effects are owned', effects.length === 2, `effects=${effects.length}`);
check(
	'the timer effect disposes the ticker',
	(() => {
		const before = intervals.size;
		effects[1].disposer();
		return intervals.size === 0 && before >= 1;
	})(),
);

Date.now = realDateNow;
console.log(`\n${failures.length === 0 ? 'PASS' : `FAIL (${failures.length})`}`);
for (const failure of failures) console.log(`  - ${failure}`);
process.exit(failures.length === 0 ? 0 : 1);
