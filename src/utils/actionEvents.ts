/**
 * Run an action before Obsidian replaces the target while activating its leaf.
 * Pointer-generated clicks are ignored to avoid running the action twice;
 * keyboard and assistive-technology clicks still use the click event.
 */
export function addActionHandlers(element: HTMLElement, action: () => void): void {
	element.addEventListener('pointerdown', (event: PointerEvent) => {
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		action();
	});

	element.addEventListener('click', (event: MouseEvent) => {
		event.stopPropagation();
		if (event.detail !== 0) {
			return;
		}
		event.preventDefault();
		action();
	});
}
