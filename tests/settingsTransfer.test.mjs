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
		language: 'zh-CN',
		calendarViews: [
			{
				id: 'view-1',
				name: '个人日志',
				sources: [
					{
						id: 'source-1',
						name: '日记 ✓',
						pathTemplate: 'daily/{YYYY-MM-DD}',
						color: '#4a9eff',
						checkboxProperty: 'done',
						markerSymbol: '⭐',
					},
				],
				weeklySource: {
					id: 'weekly-1',
					name: '周记',
					pathTemplate: 'weekly/{GGGG}-W{WW}',
					color: '#845ef7',
				},
				monthlySource: {
					id: 'monthly-1',
					name: '月记',
					pathTemplate: 'monthly/{YYYY}-{MM}',
					color: '#20c997',
				},
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
		JSON.stringify({ ...createSettings(), confirmBeforeCreate: 'yes' }),
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
