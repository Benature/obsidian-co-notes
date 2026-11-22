import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';

let tempDir;
let isHolidayCountry;
let parseChinaHolidays;
let parseNagerHolidays;

before(async () => {
	tempDir = await mkdtemp(join(tmpdir(), 'co-notes-holidays-'));
	const outfile = join(tempDir, 'holidays.mjs');
	await build({
		entryPoints: ['src/utils/holidays.ts'],
		bundle: true,
		format: 'esm',
		platform: 'node',
		outfile,
		plugins: [{
			name: 'obsidian-stub',
			setup(context) {
				context.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'stub' }));
				context.onLoad({ filter: /^obsidian$/, namespace: 'stub' }, () => ({
					contents: 'export function requestUrl() { throw new Error("Not used in parser tests"); }',
				}));
			},
		}],
	});
	({ isHolidayCountry, parseChinaHolidays, parseNagerHolidays } = await import(pathToFileURL(outfile).href));
});

after(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

test('validates ISO country codes and the disabled option', () => {
	assert.equal(isHolidayCountry(''), true);
	assert.equal(isHolidayCountry('CN'), true);
	assert.equal(isHolidayCountry('GB'), true);
	assert.equal(isHolidayCountry('cn'), false);
	assert.equal(isHolidayCountry('China'), false);
	assert.equal(isHolidayCountry(undefined), false);
});

test('parses Chinese holidays and adjusted workdays', () => {
	const days = parseChinaHolidays({ days: [
		{ name: '元旦', date: '2026-01-01', isOffDay: true },
		{ name: '元旦', date: '2026-01-04', isOffDay: false },
	] });
	assert.deepEqual(days, [
		{ name: '元旦', date: '2026-01-01', isOffDay: true },
		{ name: '元旦', date: '2026-01-04', isOffDay: false },
	]);
});

test('parses nationwide Nager holidays and omits regional entries', () => {
	const days = parseNagerHolidays([
		{ name: 'New Year', date: '2026-01-01', global: true },
		{ name: 'Regional holiday', date: '2026-01-06', global: false },
	]);
	assert.deepEqual(days, [{ name: 'New Year', date: '2026-01-01', isOffDay: true }]);
});
