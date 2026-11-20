import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';

let tempDir;
let addActionHandlers;

before(async () => {
	tempDir = await mkdtemp(join(tmpdir(), 'co-notes-action-events-'));
	const outfile = join(tempDir, 'actionEvents.mjs');
	await build({
		entryPoints: ['src/utils/actionEvents.ts'],
		bundle: true,
		format: 'esm',
		platform: 'node',
		outfile,
	});
	({ addActionHandlers } = await import(pathToFileURL(outfile).href));
});

after(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

class FakeElement {
	listeners = new Map();

	addEventListener(type, listener) {
		const listeners = this.listeners.get(type) ?? [];
		listeners.push(listener);
		this.listeners.set(type, listeners);
	}

	dispatch(type, init = {}) {
		const event = {
			button: 0,
			detail: 1,
			defaultPrevented: false,
			propagationStopped: false,
			preventDefault() {
				this.defaultPrevented = true;
			},
			stopPropagation() {
				this.propagationStopped = true;
			},
			...init,
		};
		for (const listener of this.listeners.get(type) ?? []) {
			listener(event);
		}
		return event;
	}
}

test('runs on the first primary pointerdown without duplicating the click', () => {
	const element = new FakeElement();
	let calls = 0;
	addActionHandlers(element, () => calls++);

	const pointerEvent = element.dispatch('pointerdown');
	element.dispatch('click');

	assert.equal(calls, 1);
	assert.equal(pointerEvent.defaultPrevented, true);
	assert.equal(pointerEvent.propagationStopped, true);
});

test('ignores non-primary pointer buttons', () => {
	const element = new FakeElement();
	let calls = 0;
	addActionHandlers(element, () => calls++);

	const event = element.dispatch('pointerdown', { button: 2 });

	assert.equal(calls, 0);
	assert.equal(event.defaultPrevented, false);
	assert.equal(event.propagationStopped, false);
});

test('retains keyboard and assistive-technology click activation', () => {
	const element = new FakeElement();
	let calls = 0;
	addActionHandlers(element, () => calls++);

	const event = element.dispatch('click', { detail: 0 });

	assert.equal(calls, 1);
	assert.equal(event.defaultPrevented, true);
	assert.equal(event.propagationStopped, true);
});
