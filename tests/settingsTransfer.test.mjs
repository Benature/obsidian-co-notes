import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';

let tempDir;
let createSettingsExport;
let parseSettingsImport;

before(async () => {
	tempDir = await mkdtemp(join(tmpdir(), 'co-notes-settings-transfer-'));
	const outfile = join(tempDir, 'settingsTransfer.mjs');

	await build({
		entryPoints: ['src/utils/settingsTransfer.ts'],
		bundle: true,
		format: 'esm',
		platform: 'node',
		outfile,
	});

	({ createSettingsExport, parseSettingsImport } = await import(pathToFileURL(outfile).href));
});

after(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

function createSettings() {
	return {
		confirmBeforeCreate: false,
		globalSourceIndicatorHeight: 10,
		globalDayCellMinHeight: 48,
		highlightWeekends: false,
		holidayCountry: 'CN',
		language: 'zh-CN',
		weekStart: 'monday',
		calendarViews: [
			{
				id: 'view-1',
				name: '个人日志',
				categories: [{ id: 'category-1', name: '日记 ✓', color: '#4a9eff' }],
				sources: [
					{
						id: 'source-1',
						categoryId: 'category-1',
						name: '日记 ✓',
						pathTemplate: 'daily/{YYYY-MM-DD}',
						color: '#4a9eff',
						checkboxProperty: 'done',
						markerSymbol: '⭐',
					},
				],
				weeklySources: [
					{
						id: 'weekly-1',
						categoryId: 'category-1',
						name: '日记 ✓',
						pathTemplate: 'weekly/{GGGG}-W{WW}',
						color: '#4a9eff',
					},
				],
				monthlySources: [
					{
						id: 'monthly-1',
						categoryId: 'category-1',
						name: '日记 ✓',
						pathTemplate: 'monthly/{YYYY}-{MM}',
						color: '#4a9eff',
					},
				],
			},
		],
	};
}

test('exports every setting as formatted JSON without mutating it', () => {
	const settings = createSettings();
	const snapshot = structuredClone(settings);

	const result = createSettingsExport(settings, new Date(2026, 10, 9));

	assert.equal(result.filename, 'co-notes-settings-2026-11-09.json');
	assert.deepEqual(JSON.parse(result.contents), settings);
	assert.equal(result.contents, `${JSON.stringify(settings, null, 2)}\n`);
	assert.deepEqual(settings, snapshot);
});

test('uses local calendar dates and pads single-digit months and days', () => {
	const settings = createSettings();
	const result = createSettingsExport(settings, new Date(2026, 0, 5, 23, 59));
	assert.equal(result.filename, 'co-notes-settings-2026-01-05.json');
});

test('round-trips all exported settings through import', () => {
	const settings = createSettings();
	const exported = createSettingsExport(settings, new Date(2026, 10, 9));
	assert.deepEqual(parseSettingsImport(exported.contents), settings);
});

test('defaults missing week start to Monday for legacy settings', () => {
	const legacy = createSettings();
	delete legacy.weekStart;

	assert.equal(parseSettingsImport(JSON.stringify(legacy)).weekStart, 'monday');
});

test('defaults weekend highlighting to enabled for legacy settings', () => {
	const legacy = createSettings();
	delete legacy.highlightWeekends;

	assert.equal(parseSettingsImport(JSON.stringify(legacy)).highlightWeekends, true);
});

test('defaults the holiday country to disabled for legacy settings', () => {
	const legacy = createSettings();
	delete legacy.holidayCountry;

	assert.equal(parseSettingsImport(JSON.stringify(legacy)).holidayCountry, '');
});

test('round-trips Sunday as the configured week start', () => {
	const settings = { ...createSettings(), weekStart: 'sunday' };
	assert.equal(parseSettingsImport(JSON.stringify(settings)).weekStart, 'sunday');
});

test('migrates legacy single weekly/monthly source to arrays on import', () => {
	const legacy = createSettings();
	const view = legacy.calendarViews[0];
	view.weeklySource = view.weeklySources[0];
	delete view.weeklySources;
	view.monthlySource = view.monthlySources[0];
	delete view.monthlySources;

	const imported = parseSettingsImport(JSON.stringify(legacy));
	const expected = createSettings().calendarViews[0];
	assert.deepEqual(imported.calendarViews[0].weeklySources, expected.weeklySources);
	assert.deepEqual(imported.calendarViews[0].monthlySources, expected.monthlySources);
	assert.equal('weeklySource' in imported.calendarViews[0], false);
	assert.equal('monthlySource' in imported.calendarViews[0], false);
});

test('creates shared categories for legacy sources and synchronizes their labels', () => {
	const legacy = createSettings();
	const view = legacy.calendarViews[0];
	delete view.categories;
	for (const source of [view.sources[0], view.weeklySources[0], view.monthlySources[0]]) {
		delete source.categoryId;
	}
	view.weeklySources[0].name = '旧周记';
	view.weeklySources[0].color = '#845ef7';

	const imported = parseSettingsImport(JSON.stringify(legacy)).calendarViews[0];
	assert.equal(imported.categories.length, 3);
	assert.equal(imported.sources[0].categoryId, 'source-1');
	assert.equal(imported.weeklySources[0].name, '旧周记');
	assert.equal(imported.weeklySources[0].color, '#845ef7');
});

test('normalizes imported heights and discards unknown properties', () => {
	const settings = {
		...createSettings(),
		globalSourceIndicatorHeight: 999,
		globalDayCellMinHeight: -10,
		unknown: 'discard me',
	};

	const imported = parseSettingsImport(JSON.stringify(settings));
	assert.equal(imported.globalSourceIndicatorHeight, 48);
	assert.equal(imported.globalDayCellMinHeight, 16);
	assert.equal('unknown' in imported, false);
});

test('rejects malformed or structurally invalid imports', () => {
	const invalidDocuments = [
		'not json',
		'null',
		'[]',
		JSON.stringify({ ...createSettings(), language: 'fr' }),
		JSON.stringify({ ...createSettings(), weekStart: 'saturday' }),
		JSON.stringify({ ...createSettings(), confirmBeforeCreate: 'yes' }),
		JSON.stringify({ ...createSettings(), highlightWeekends: 'yes' }),
		JSON.stringify({ ...createSettings(), holidayCountry: 'cn' }),
		JSON.stringify({ ...createSettings(), calendarViews: {} }),
		JSON.stringify({ ...createSettings(), globalDayCellMinHeight: '48' }),
		JSON.stringify({
			...createSettings(),
			calendarViews: [{ id: 'view-1', name: 'Invalid', sources: [{}] }],
		}),
	];

	for (const contents of invalidDocuments) {
		assert.throws(() => parseSettingsImport(contents), undefined, contents);
	}
});
