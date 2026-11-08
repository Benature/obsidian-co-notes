import {
	App,
	ItemView,
	Modal,
	Notice,
	Setting,
	TFile,
	ViewStateResult,
	WorkspaceLeaf,
} from 'obsidian';
import type ParallelNotesPlugin from '../main';
import { formatMonthLabel, getWeekdayLabels } from '../i18n';
import {
	type CalendarViewConfig,
	normalizeDayCellMinHeight,
	normalizeSourceIndicatorHeight,
} from '../types';
import { getFilePath, isSameDay } from '../utils/dateUtils';

export const CALENDAR_VIEW_TYPE = 'parallel-notes-calendar';

export class CalendarView extends ItemView {
	private plugin: ParallelNotesPlugin;
	private configId = '';
	private currentYear: number;
	private currentMonth: number;

	constructor(leaf: WorkspaceLeaf, plugin: ParallelNotesPlugin) {
		super(leaf);
		this.plugin = plugin;
		const now = new Date();
		this.currentYear = now.getFullYear();
		this.currentMonth = now.getMonth();
	}

	getViewType(): string {
		return CALENDAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		const config = this.getConfig();
		return config ? config.name : this.plugin.t('calendar.defaultTitle');
	}

	getIcon(): string {
		return 'calendar';
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		if (
			state !== null &&
			typeof state === 'object' &&
			'configId' in state &&
			typeof (state as Record<string, unknown>)['configId'] === 'string'
		) {
			this.configId = (state as Record<string, unknown>)['configId'] as string;
		}
		await super.setState(state, result);
		this.render();
	}

	getState(): Record<string, unknown> {
		const parentState = super.getState();
		return { ...parentState, configId: this.configId };
	}

	private getConfig(): CalendarViewConfig | undefined {
		return this.plugin.settings.calendarViews.find(v => v.id === this.configId);
	}

	async onOpen(): Promise<void> {
		// Use pointerdown instead of click: Obsidian consumes the first click
		// when it activates an unfocused view, so click would require two clicks.
		// Event delegation also survives re-renders that replace the buttons.
		this.contentEl.addEventListener('pointerdown', (e: PointerEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target) {
				return;
			}
			if (target.closest('.parallel-notes-prev-note-btn')) {
				e.preventDefault();
				void this.plugin.navigateToAdjacentNote('prev');
			} else if (target.closest('.parallel-notes-next-note-btn')) {
				e.preventDefault();
				void this.plugin.navigateToAdjacentNote('next');
			}
		});

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.render();
			}),
		);
		this.registerEvent(
			this.app.workspace.on('file-open', () => {
				this.render();
			}),
		);
		this.render();
	}

	async onClose(): Promise<void> {}

	public refresh(): void {
		this.render();
	}

	public setMonth(year: number, month: number): void {
		this.currentYear = year;
		this.currentMonth = month;
		this.render();
	}

	private render(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass('parallel-notes-calendar-container');
		const tr = this.plugin.t.bind(this.plugin);

		const config = this.getConfig();
		if (!config) {
			container.createDiv({
				cls: 'parallel-notes-empty-state',
				text: tr('calendar.configMissing'),
			});
			return;
		}

		container.style.setProperty(
			'--parallel-notes-source-indicator-min-height',
			`${getSourceIndicatorHeight(this.plugin)}px`,
		);
		container.style.setProperty(
			'--parallel-notes-day-cell-min-height',
			`${getDayCellMinHeight(this.plugin)}px`,
		);
		this.renderCalendar(container, config);
	}

	private renderCalendar(container: HTMLElement, config: CalendarViewConfig): void {
		const today = new Date();
		const language = this.plugin.getLanguage();
		const tr = this.plugin.t.bind(this.plugin);
		const activeFilePath = this.app.workspace.getActiveFile()?.path ?? null;

		// ── Header ────────────────────────────────────────────────────────────
		const header = container.createDiv('parallel-notes-calendar-header');

		const leftControls = header.createDiv('parallel-notes-header-left');
		const prevBtn = leftControls.createEl('button', { cls: 'parallel-notes-nav-btn', text: '‹' });
		const nextBtn = leftControls.createEl('button', { cls: 'parallel-notes-nav-btn', text: '›' });

		header.createSpan({
			cls: 'parallel-notes-month-title',
			text: formatMonthLabel(new Date(this.currentYear, this.currentMonth, 1), language),
		});

		const rightControls = header.createDiv('parallel-notes-header-right');

		const prevNoteBtn = rightControls.createEl('button', {
			cls: 'parallel-notes-nav-btn parallel-notes-note-nav-btn parallel-notes-prev-note-btn',
			text: '←',
			attr: { 'aria-label': tr('calendar.previousNote'), title: tr('calendar.previousNote') },
		});
		const nextNoteBtn = rightControls.createEl('button', {
			cls: 'parallel-notes-nav-btn parallel-notes-note-nav-btn parallel-notes-next-note-btn',
			text: '→',
			attr: { 'aria-label': tr('calendar.nextNote'), title: tr('calendar.nextNote') },
		});

		const todayBtn = rightControls.createEl('button', {
			cls: 'parallel-notes-today-btn',
			text: tr('calendar.today'),
		});

		prevBtn.addEventListener('click', () => {
			if (this.currentMonth === 0) {
				this.currentMonth = 11;
				this.currentYear--;
			} else {
				this.currentMonth--;
			}
			this.render();
		});

		nextBtn.addEventListener('click', () => {
			if (this.currentMonth === 11) {
				this.currentMonth = 0;
				this.currentYear++;
			} else {
				this.currentMonth++;
			}
			this.render();
		});

		todayBtn.addEventListener('click', () => {
			const now = new Date();
			this.currentYear = now.getFullYear();
			this.currentMonth = now.getMonth();
			this.render();
		});

		// ── Legend ────────────────────────────────────────────────────────────
		if (config.sources.length > 0) {
			const legend = container.createDiv('parallel-notes-legend');
			for (const source of config.sources) {
				const item = legend.createDiv('parallel-notes-legend-item');
				const dot = item.createDiv('parallel-notes-legend-dot');
				dot.style.backgroundColor = source.color;
				item.createSpan({ text: source.name });
			}
		}

		// ── Calendar grid ─────────────────────────────────────────────────────
		const grid = container.createDiv('parallel-notes-calendar-grid');

		const dayNames = getWeekdayLabels(language);
		for (const name of dayNames) {
			grid.createDiv({ text: name, cls: 'parallel-notes-day-header' });
		}

		const firstDay = new Date(this.currentYear, this.currentMonth, 1);
		const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
		const leadingEmptyCells = firstDay.getDay();
		const weekRows = Math.ceil((leadingEmptyCells + daysInMonth) / 7);
		grid.style.setProperty('--parallel-notes-calendar-week-rows', String(weekRows));

		// Leading empty cells
		for (let i = 0; i < leadingEmptyCells; i++) {
			grid.createDiv('parallel-notes-day-cell parallel-notes-day-empty');
		}

		// Day cells
		for (let d = 1; d <= daysInMonth; d++) {
			const date = new Date(this.currentYear, this.currentMonth, d);
			const isToday = isSameDay(date, today);
			let hasActiveNote = false;

			const cell = grid.createDiv(
				'parallel-notes-day-cell' + (isToday ? ' parallel-notes-today' : ''),
			);
			cell.createDiv({ text: String(d), cls: 'parallel-notes-day-number' });

			if (config.sources.length > 0) {
				const sourcesWrap = cell.createDiv('parallel-notes-day-sources');
				let sourceIndex = 0;
				for (const rowLength of getSourceRowLengths(config.sources.length)) {
					const sourcesRow = sourcesWrap.createDiv('parallel-notes-day-sources-row');
					sourcesRow.style.gridTemplateColumns = `repeat(${rowLength}, minmax(0, 1fr))`;

					for (let i = 0; i < rowLength; i++) {
						const source = config.sources[sourceIndex++];
						if (!source) {
							continue;
						}

						const filePath = getFilePath(source.pathTemplate, date);
						const file = this.app.vault.getAbstractFileByPath(filePath);
						const exists = file instanceof TFile;
						const isActive = activeFilePath !== null && activeFilePath === filePath;
						if (isActive) {
							hasActiveNote = true;
						}

						const indicator = sourcesRow.createDiv({
							cls: `parallel-notes-source-indicator ${exists ? 'exists' : 'missing'}${isActive ? ' active' : ''}`,
						});
						if (exists) {
							indicator.style.backgroundColor = source.color;
						}

						if (exists && source.checkboxProperty) {
							const checked = isCheckboxChecked(this.app, file, source.checkboxProperty);
							if (checked) {
								indicator.addClass('has-marker');
								const markerSpan = indicator.createSpan({
									text: source.markerSymbol || '✓',
									cls: 'parallel-notes-source-marker',
								});
								markerSpan.style.color = getContrastColor(source.color);
							}
						}

						indicator.title = `${source.name}${exists ? '' : tr('calendar.missingNoteSuffix')}`;

						indicator.addEventListener('click', (e: MouseEvent) => {
							e.stopPropagation();
							void this.openOrCreateNote(filePath);
						});
					}
				}
			}

			if (hasActiveNote) {
				cell.addClass('parallel-notes-day-cell-active');
			}
		}

		const trailingEmptyCells = weekRows * 7 - (leadingEmptyCells + daysInMonth);
		for (let i = 0; i < trailingEmptyCells; i++) {
			grid.createDiv('parallel-notes-day-cell parallel-notes-day-empty');
		}
	}

	private async openOrCreateNote(filePath: string): Promise<void> {
		let file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			if (this.plugin.settings.confirmBeforeCreate) {
				const shouldCreate = await confirmCreateNote(this.app, this.plugin, filePath);
				if (!shouldCreate) {
					return;
				}
			}

			const dir = filePath.substring(0, filePath.lastIndexOf('/'));
			if (dir) {
				await ensureFolder(this.app, dir);
			}
			try {
				file = await this.app.vault.create(filePath, '');
				// Refresh so the new note is reflected
				this.render();
			} catch {
				new Notice(this.plugin.t('calendar.createNoteFailed', { path: filePath }));
				return;
			}
		}

		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
	}
}

class ConfirmCreateNoteModal extends Modal {
	private readonly plugin: ParallelNotesPlugin;
	private readonly filePath: string;
	private readonly onSubmit: (confirmed: boolean) => void;

	constructor(
		app: App,
		plugin: ParallelNotesPlugin,
		filePath: string,
		onSubmit: (confirmed: boolean) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.filePath = filePath;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', { text: this.plugin.t('calendar.confirmCreateTitle') });
		contentEl.createEl('p', {
			text: this.plugin.t('calendar.confirmCreateDesc'),
		});
		contentEl.createEl('code', {
			text: this.filePath,
		});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText(this.plugin.t('calendar.cancel')).onClick(() => {
					this.onSubmit(false);
					this.close();
				});
			})
			.addButton((button) => {
				button.setButtonText(this.plugin.t('calendar.create')).setCta().onClick(() => {
					this.onSubmit(true);
					this.close();
				});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function confirmCreateNote(app: App, plugin: ParallelNotesPlugin, filePath: string): Promise<boolean> {
	return new Promise((resolve) => {
		let resolved = false;
		const modal = new ConfirmCreateNoteModal(app, plugin, filePath, (confirmed) => {
			resolved = true;
			resolve(confirmed);
		});

		modal.onClose = () => {
			modal.contentEl.empty();
			if (!resolved) {
				resolve(false);
			}
		};

		modal.open();
	});
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
	if (!folderPath) return;
	const parts = folderPath.split('/');
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			try {
				await app.vault.createFolder(current);
			} catch {
				// folder may already exist (race condition)
			}
		}
	}
}

/**
 * Return black or white depending on the background color brightness (YIQ),
 * so the marker stays readable on any source color.
 */
function getContrastColor(hexColor: string): string {
	let hex = hexColor.replace('#', '').trim();
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((c) => c + c)
			.join('');
	}
	if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
		return '#fff';
	}
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	const yiq = (r * 299 + g * 587 + b * 114) / 1000;
	return yiq >= 128 ? '#000' : '#fff';
}

function isCheckboxChecked(app: App, file: TFile, property: string): boolean {
	const cache = app.metadataCache.getFileCache(file);
	const frontmatter = cache?.frontmatter;
	if (!frontmatter) {
		return false;
	}
	const value: unknown = frontmatter[property];
	return value === true || value === 'true';
}

function getSourceRowLengths(sourceCount: number): number[] {
	if (sourceCount <= 0) {
		return [];
	}

	const rows = Math.ceil(sourceCount / Math.ceil(Math.sqrt(sourceCount)));
	const baseSize = Math.floor(sourceCount / rows);
	const remainder = sourceCount % rows;

	return Array.from({ length: rows }, (_, index) => baseSize + (index >= rows - remainder ? 1 : 0));
}

function getSourceIndicatorHeight(plugin: ParallelNotesPlugin): number {
	return normalizeSourceIndicatorHeight(plugin.settings.globalSourceIndicatorHeight);
}

function getDayCellMinHeight(plugin: ParallelNotesPlugin): number {
	return normalizeDayCellMinHeight(plugin.settings.globalDayCellMinHeight);
}
