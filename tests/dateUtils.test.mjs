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

	({ formatPath, getFilePath } = await import(pathToFileURL(outfile).href));
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
