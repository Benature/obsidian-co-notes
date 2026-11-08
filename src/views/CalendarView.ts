import {
	App,
	ItemView,
	Modal,
	Notice,
	Setting,
	setIcon,
	TFile,
	ViewStateResult,
	WorkspaceLeaf,
} from 'obsidian';
import type ParallelNotesPlugin from '../main';
import { getMonthLabels, getWeekdayLabels } from '../i18n';
import {
	type CalendarViewConfig,
	normalizeDayCellMinHeight,
	normalizeSourceIndicatorHeight,
} from '../types';
import { getFilePath, getIsoWeekNumber, isSameDay } from '../utils/dateUtils';

export const CALENDAR_VIEW_TYPE = 'parallel-notes-calendar';

export class CalendarView extends ItemView {
	private plugin: ParallelNotesPlugin;
	private configId = '';
	private currentYear: number;
	private currentMonth: number;
	private viewMode: 'month' | 'year' = 'month';

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
		if (this.viewMode === 'year') {
			this.renderYearCalendar(container, config);
		} else {
			this.renderCalendar(container, config);
		}
	}

	private renderCalendar(container: HTMLElement, config: CalendarViewConfig): void {
		const today = new Date();
		const language = this.plugin.getLanguage();
		const tr = this.plugin.t.bind(this.plugin);
		const activeFilePath = this.app.workspace.getActiveFile()?.path ?? null;

		// ── Header ────────────────────────────────────────────────────────────
		const header = container.createDiv('parallel-notes-calendar-header');

		const leftControls = header.createDiv('parallel-notes-header-left');
		const monthNavGroup = leftControls.createDiv('parallel-notes-nav-group');
		const prevBtn = monthNavGroup.createEl('button', { cls: 'parallel-notes-nav-btn parallel-notes-caret-btn', text: '▲' });
		const nextBtn = monthNavGroup.createEl('button', { cls: 'parallel-notes-nav-btn parallel-notes-caret-btn', text: '▼' });

		// Quick year / month switchers
		const switcher = header.createDiv('parallel-notes-header-switcher');
		const monthSelect = switcher.createEl('select', {
			cls: 'parallel-notes-month-select',
		});
		const monthLabels = getMonthLabels(language);
		for (let m = 0; m < 12; m++) {
			monthSelect.createEl('option', {
				text: monthLabels[m] ?? String(m + 1),
				attr: { value: String(m) },
			});
		}
		monthSelect.value = String(this.currentMonth);
		monthSelect.addEventListener('change', () => {
			this.currentMonth = Number.parseInt(monthSelect.value, 10);
			this.render();
		});

		const yearSelect = switcher.createEl('select', {
			cls: 'parallel-notes-year-select',
		});
		for (let y = this.currentYear - 10; y <= this.currentYear + 10; y++) {
			yearSelect.createEl('option', {
				text: String(y),
				attr: { value: String(y) },
			});
		}
		yearSelect.value = String(this.currentYear);
		yearSelect.addEventListener('change', () => {
			this.currentYear = Number.parseInt(yearSelect.value, 10);
			this.render();
		});

		const rightControls = header.createDiv('parallel-notes-header-right');

		// Year view toggle (only meaningful when a monthly source is configured)
		if (config.monthlySource) {
			const yearBtn = rightControls.createEl('button', {
				cls: 'parallel-notes-today-btn',
				text: tr('calendar.yearView'),
				attr: { title: tr('calendar.yearView') },
			});
			yearBtn.addEventListener('click', () => {
				this.viewMode = 'year';
				this.render();
			});
		}

		const noteNavGroup = rightControls.createDiv('parallel-notes-nav-group');
		noteNavGroup.createEl('button', {
			cls: 'parallel-notes-nav-btn parallel-notes-note-nav-btn parallel-notes-prev-note-btn',
			text: '←',
			attr: { 'aria-label': tr('calendar.previousNote'), title: tr('calendar.previousNote') },
		});
		noteNavGroup.createEl('button', {
			cls: 'parallel-notes-nav-btn parallel-notes-note-nav-btn parallel-notes-next-note-btn',
			text: '→',
			attr: { 'aria-label': tr('calendar.nextNote'), title: tr('calendar.nextNote') },
		});

		const todayBtn = rightControls.createEl('button', {
			cls: 'parallel-notes-nav-btn parallel-notes-today-icon-btn',
			attr: { 'aria-label': tr('calendar.today'), title: tr('calendar.today') },
		});
		setIcon(todayBtn, 'rotate-ccw');

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

		// ── Calendar grid ─────────────────────────────────────────────────────
		const grid = container.createDiv('parallel-notes-calendar-grid');
		const hasWeekly = !!config.weeklySource;
		if (hasWeekly) {
			grid.addClass('parallel-notes-calendar-with-weekly');
		}

		// Header row: optional weekly column + 7 weekday columns
		if (hasWeekly) {
			grid.createDiv({
				text: tr('calendar.weekHeader'),
				cls: 'parallel-notes-day-header parallel-notes-weekly-header',
			});
		}
		const dayNames = getWeekdayLabels(language);
		for (const name of dayNames) {
			grid.createDiv({ text: name, cls: 'parallel-notes-day-header' });
		}

		const firstDay = new Date(this.currentYear, this.currentMonth, 1);
		const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
		const prevMonthDays = new Date(this.currentYear, this.currentMonth, 0).getDate();
		const leadingEmptyCells = firstDay.getDay();
		const weekRows = Math.ceil((leadingEmptyCells + daysInMonth) / 7);
		grid.style.setProperty('--parallel-notes-calendar-week-rows', String(weekRows));

		// Render week by week so the weekly note sits at the start of each row
		for (let week = 0; week < weekRows; week++) {
			if (hasWeekly && config.weeklySource) {
				const weekStartDate = new Date(
					this.currentYear,
					this.currentMonth,
					1 - leadingEmptyCells + week * 7,
				);
				this.renderWeeklyCell(grid, config.weeklySource, weekStartDate, activeFilePath);
			}

			for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
				const cellIndex = week * 7 + dayOfWeek;
				let date: Date;
				const isOtherMonth =
					cellIndex < leadingEmptyCells || cellIndex >= leadingEmptyCells + daysInMonth;

				if (cellIndex < leadingEmptyCells) {
					// Days from the previous month
					const d = prevMonthDays - leadingEmptyCells + 1 + cellIndex;
					date = new Date(this.currentYear, this.currentMonth - 1, d);
				} else if (cellIndex >= leadingEmptyCells + daysInMonth) {
					// Days from the next month
					const d = cellIndex - leadingEmptyCells - daysInMonth + 1;
					date = new Date(this.currentYear, this.currentMonth + 1, d);
				} else {
					const d = cellIndex - leadingEmptyCells + 1;
					date = new Date(this.currentYear, this.currentMonth, d);
				}

				const isToday = isSameDay(date, today);
				let hasActiveNote = false;

				const cell = grid.createDiv(
					'parallel-notes-day-cell' +
						(isToday ? ' parallel-notes-today' : '') +
						(isOtherMonth ? ' parallel-notes-day-other-month' : ''),
				);
				cell.createDiv({ text: String(date.getDate()), cls: 'parallel-notes-day-number' });

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
		}

		// ── Legend (bottom) ───────────────────────────────────────────────────
		if (config.sources.length > 0) {
			const legend = container.createDiv('parallel-notes-legend');
			for (const source of config.sources) {
				const item = legend.createDiv('parallel-notes-legend-item');
				const dot = item.createDiv('parallel-notes-legend-dot');
				dot.style.backgroundColor = source.color;
				item.createSpan({ text: source.name });
			}
		}
	}

	private renderWeeklyCell(
		grid: HTMLElement,
		source: NonNullable<CalendarViewConfig['weeklySource']>,
		weekStartDate: Date,
		activeFilePath: string | null,
	): void {
		const tr = this.plugin.t.bind(this.plugin);
		const filePath = getFilePath(source.pathTemplate, weekStartDate);
		const file = this.app.vault.getAbstractFileByPath(filePath);
		const exists = file instanceof TFile;
		const isActive = activeFilePath !== null && activeFilePath === filePath;

		const cell = grid.createDiv('parallel-notes-weekly-cell');
		if (isActive) {
			cell.addClass('parallel-notes-weekly-cell-active');
		}

		cell.createDiv({
			text: `W${getIsoWeekNumber(weekStartDate)}`,
			cls: 'parallel-notes-weekly-number',
		});

		const indicator = cell.createDiv({
			cls: `parallel-notes-weekly-indicator ${exists ? 'exists' : 'missing'}`,
		});
		if (exists) {
			indicator.style.backgroundColor = source.color;
		}

		if (exists && source.checkboxProperty) {
			const checked = isCheckboxChecked(this.app, file, source.checkboxProperty);
			if (checked) {
				const markerSpan = indicator.createSpan({
					text: source.markerSymbol || '✓',
					cls: 'parallel-notes-source-marker',
				});
				markerSpan.style.color = getContrastColor(source.color);
			}
		}

		cell.title = `${source.name}${exists ? '' : tr('calendar.missingNoteSuffix')}`;
		cell.addEventListener('click', () => {
			void this.openOrCreateNote(filePath);
		});
	}

	private renderYearCalendar(container: HTMLElement, config: CalendarViewConfig): void {
		const language = this.plugin.getLanguage();
		const tr = this.plugin.t.bind(this.plugin);
		const activeFilePath = this.app.workspace.getActiveFile()?.path ?? null;
		const today = new Date();

		// ── Header ────────────────────────────────────────────────────────────
		const header = container.createDiv('parallel-notes-calendar-header');

		const leftControls = header.createDiv('parallel-notes-header-left');
		const yearNavGroup = leftControls.createDiv('parallel-notes-nav-group');
		const prevBtn = yearNavGroup.createEl('button', { cls: 'parallel-notes-nav-btn parallel-notes-caret-btn', text: '▲' });
		const nextBtn = yearNavGroup.createEl('button', { cls: 'parallel-notes-nav-btn parallel-notes-caret-btn', text: '▼' });

		prevBtn.addEventListener('click', () => {
			this.currentYear--;
			this.render();
		});
		nextBtn.addEventListener('click', () => {
			this.currentYear++;
			this.render();
		});

		header.createSpan({
			cls: 'parallel-notes-month-title',
			text: String(this.currentYear),
		});

		const rightControls = header.createDiv('parallel-notes-header-right');
		const monthBtn = rightControls.createEl('button', {
			cls: 'parallel-notes-today-btn',
			text: tr('calendar.monthView'),
		});
		monthBtn.addEventListener('click', () => {
			this.viewMode = 'month';
			this.render();
		});

		const todayBtn = rightControls.createEl('button', {
			cls: 'parallel-notes-nav-btn parallel-notes-today-icon-btn',
			attr: { 'aria-label': tr('calendar.today'), title: tr('calendar.today') },
		});
		setIcon(todayBtn, 'rotate-ccw');
		todayBtn.addEventListener('click', () => {
			const now = new Date();
			this.currentYear = now.getFullYear();
			this.currentMonth = now.getMonth();
			this.viewMode = 'month';
			this.render();
		});

		// ── Month grid ────────────────────────────────────────────────────────
		const grid = container.createDiv('parallel-notes-year-grid');
		const monthLabels = getMonthLabels(language);
		const monthlySource = config.monthlySource;

		for (let m = 0; m < 12; m++) {
			const monthDate = new Date(this.currentYear, m, 1);
			const isCurrentMonth =
				today.getFullYear() === this.currentYear && today.getMonth() === m;

			const cell = grid.createDiv(
				'parallel-notes-month-cell' + (isCurrentMonth ? ' parallel-notes-current-month' : ''),
			);
			cell.createDiv({
				text: monthLabels[m] ?? String(m + 1),
				cls: 'parallel-notes-month-name',
			});

			// Daily-note count bar chart: one bar per source
			if (config.sources.length > 0) {
				const daysInMonth = new Date(this.currentYear, m + 1, 0).getDate();
				const chart = cell.createDiv('parallel-notes-month-chart');
				for (const source of config.sources) {
					const count = this.countNotesInMonth(source, this.currentYear, m);
					const ratio = daysInMonth > 0 ? count / daysInMonth : 0;
					const bar = chart.createDiv('parallel-notes-month-chart-bar');
					bar.style.height = count > 0 ? `${Math.max(ratio * 100, 5)}%` : '0%';
					if (count > 0) {
						bar.style.backgroundColor = source.color;
					}
					bar.title = `${source.name}: ${count}/${daysInMonth}`;
				}
			}

			if (monthlySource) {
				const filePath = getFilePath(monthlySource.pathTemplate, monthDate);
				const file = this.app.vault.getAbstractFileByPath(filePath);
				const exists = file instanceof TFile;
				const isActive = activeFilePath !== null && activeFilePath === filePath;

				const indicator = cell.createDiv({
					cls: `parallel-notes-monthly-indicator ${exists ? 'exists' : 'missing'}${isActive ? ' active' : ''}`,
				});
				if (exists) {
					indicator.style.backgroundColor = monthlySource.color;
				}

				if (exists && monthlySource.checkboxProperty) {
					const checked = isCheckboxChecked(this.app, file, monthlySource.checkboxProperty);
					if (checked) {
						const markerSpan = indicator.createSpan({
							text: monthlySource.markerSymbol || '✓',
							cls: 'parallel-notes-source-marker',
						});
						markerSpan.style.color = getContrastColor(monthlySource.color);
					}
				}

				// Clicking the monthly-note indicator opens/creates the monthly note
				indicator.title = `${monthlySource.name}${exists ? '' : tr('calendar.missingNoteSuffix')}`;
				indicator.addEventListener('click', (e: MouseEvent) => {
					e.stopPropagation();
					void this.openOrCreateNote(filePath);
				});
			}

			// Clicking anywhere else on the month cell jumps to that month view
			cell.title = monthLabels[m] ?? String(m + 1);
			cell.addEventListener('click', () => {
				this.currentMonth = m;
				this.viewMode = 'month';
				this.render();
			});
		}
	}

	private countNotesInMonth(
		source: CalendarViewConfig['sources'][number],
		year: number,
		month: number,
	): number {
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		let count = 0;
		for (let d = 1; d <= daysInMonth; d++) {
			const date = new Date(year, month, d);
			const filePath = getFilePath(source.pathTemplate, date);
			if (this.app.vault.getAbstractFileByPath(filePath) instanceof TFile) {
				count++;
			}
		}
		return count;
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
