import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';

let tempDir;
let formatPath;
let getFilePath;
let getCalendarDayType;
let getIsoWeekReferenceDate;
let getLeadingDayCount;
let extractDateFromPath;
let extractMonthlyDateFromPath;
let extractWeeklyDateFromPath;

before(async () => {
	tempDir = await mkdtemp(join(tmpdir(), 'co-notes-date-utils-'));
	const outfile = join(tempDir, 'dateUtils.mjs');

	await build({
		entryPoints: ['src/utils/dateUtils.ts'],
		bundle: true,
		format: 'esm',
		platform: 'node',
		outfile,
		plugins: [
			{
				name: 'obsidian-moment',
				setup(buildContext) {
					buildContext.onResolve({ filter: /^obsidian$/ }, () => ({
						path: 'obsidian',
						namespace: 'obsidian-moment',
					}));
					buildContext.onLoad(
						{ filter: /^obsidian$/, namespace: 'obsidian-moment' },
						() => ({
							contents: `
								export function moment(date) {
									const pad = (value) => String(value).padStart(2, '0');
									const values = {
										YYYY: String(date.getFullYear()),
										MM: pad(date.getMonth() + 1),
										DD: pad(date.getDate()),
										HH: pad(date.getHours()),
										mm: pad(date.getMinutes()),
										ss: pad(date.getSeconds()),
									};
									return {
										format: (expression) => expression.replace(
											/YYYY|MM|DD|HH|mm|ss/g,
											(token) => values[token],
										),
									};
								}
							`,
							resolveDir: process.cwd(),
						}),
					);
				},
			},
		],
	});

	({
		formatPath,
		getFilePath,
		getCalendarDayType,
		getIsoWeekReferenceDate,
		getLeadingDayCount,
		extractDateFromPath,
		extractMonthlyDateFromPath,
		extractWeeklyDateFromPath,
	} = await import(pathToFileURL(outfile).href));
});

after(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

const date = new Date(2026, 10, 5, 8, 9, 7);

test('formats brace-wrapped tokens without changing business', () => {
	assert.equal(formatPath('business/{YYYY}/{MM}/{DD}', date), 'business/2026/11/05');
});

test('keeps unwrapped moment tokens and seconds tokens literal', () => {
	assert.equal(
		formatPath('daily/YYYY/MM/YYYY-MM-DD business ss', date),
		'daily/YYYY/MM/YYYY-MM-DD business ss',
	);
});

test('formats combined date and time expressions inside braces', () => {
	assert.equal(
		formatPath('journal/{YYYY-MM-DD}_{HH-mm-ss}', date),
		'journal/2026-11-05_08-09-07',
	);
});

test('preserves square-bracket literal compatibility', () => {
	assert.equal(formatPath('notes/[business]/{YYYY}', date), 'notes/business/2026');
});

test('keeps an unclosed brace expression literal', () => {
	assert.equal(formatPath('business/{YYYY/ss', date), 'business/{YYYY/ss');
});

test('appends the markdown extension exactly once', () => {
	assert.equal(getFilePath('business/{YYYY-MM-DD}', date), 'business/2026-11-05.md');
	assert.equal(getFilePath('business/{YYYY-MM-DD}.md', date), 'business/2026-11-05.md');
});

test('classifies weekdays and weekends for calendar styling', () => {
	assert.equal(getCalendarDayType(new Date(2026, 10, 20)), 'workday'); // Friday
	assert.equal(getCalendarDayType(new Date(2026, 10, 21)), 'weekend'); // Saturday
	assert.equal(getCalendarDayType(new Date(2026, 10, 22)), 'weekend'); // Sunday
	assert.equal(getCalendarDayType(new Date(2026, 10, 23)), 'workday'); // Monday
});

test('calculates leading cells for Monday and Sunday calendar rows', () => {
	const january2027 = new Date(2027, 0, 1); // Friday
	assert.equal(getLeadingDayCount(january2027, 'monday'), 4);
	assert.equal(getLeadingDayCount(january2027, 'sunday'), 5);
});

test('uses Thursday to assign ISO weeks consistently to Monday-starting rows', () => {
	const previousYearRow = getIsoWeekReferenceDate(new Date(2026, 11, 28), 'monday');
	const newYearRow = getIsoWeekReferenceDate(new Date(2027, 0, 4), 'monday');

	assert.equal(previousYearRow.toDateString(), new Date(2026, 11, 31).toDateString());
	assert.equal(newYearRow.toDateString(), new Date(2027, 0, 7).toDateString());
});

test('does not label an all-new-year Sunday-starting row as the previous ISO week', () => {
	const previousYearRow = getIsoWeekReferenceDate(new Date(2026, 11, 27), 'sunday');
	const newYearRow = getIsoWeekReferenceDate(new Date(2027, 0, 3), 'sunday');

	assert.equal(previousYearRow.toDateString(), new Date(2026, 11, 31).toDateString());
	assert.equal(newYearRow.toDateString(), new Date(2027, 0, 7).toDateString());
});

test('extracts ISO week reference dates for weekly navigation', () => {
	assert.equal(
		extractWeeklyDateFromPath('weekly/2026/2026-W01.md')?.toDateString(),
		new Date(2026, 0, 1).toDateString(),
	);
	assert.equal(
		extractWeeklyDateFromPath('weekly/2027-W01.md')?.toDateString(),
		new Date(2027, 0, 7).toDateString(),
	);
	assert.equal(extractWeeklyDateFromPath('weekly/2026-W54.md'), null);
});

test('extracts month starts without confusing daily paths', () => {
	assert.equal(
		extractMonthlyDateFromPath('monthly/2026/11.md')?.toDateString(),
		new Date(2026, 10, 1).toDateString(),
	);
	assert.equal(
		extractMonthlyDateFromPath('monthly/2026-11.md')?.toDateString(),
		new Date(2026, 10, 1).toDateString(),
	);
	assert.equal(extractMonthlyDateFromPath('daily/2026/11/22.md'), null);
	assert.equal(extractDateFromPath('daily/2026/11/22.md')?.toDateString(), new Date(2026, 10, 22).toDateString());
});
