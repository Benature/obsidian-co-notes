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
import type CoNotesPlugin from '../main';
import { getMonthLabels, getWeekdayLabels } from '../i18n';
import {
	type CalendarViewConfig,
	type NoteSource,
	normalizeDayCellMinHeight,
	normalizeSourceIndicatorHeight,
} from '../types';
import {
	getFilePath,
	getIsoWeekNumber,
	getIsoWeekReferenceDate,
	getLeadingDayCount,
	isSameDay,
} from '../utils/dateUtils';
import { addActionHandlers } from '../utils/actionEvents';

export const CALENDAR_VIEW_TYPE = 'co-notes-calendar';

export class CalendarView extends ItemView {
	private plugin: CoNotesPlugin;
	private configId = '';
	private currentYear: number;
	private currentMonth: number;
	private viewMode: 'month' | 'year' = 'month';

	constructor(leaf: WorkspaceLeaf, plugin: CoNotesPlugin) {
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
		container.addClass('co-notes-calendar-container');
		container.toggleClass('co-notes-year-mode', this.viewMode === 'year');
		const tr = this.plugin.t.bind(this.plugin);

		const config = this.getConfig();
		if (!config) {
			container.createDiv({
				cls: 'co-notes-empty-state',
				text: tr('calendar.configMissing'),
			});
			return;
		}

		container.style.setProperty(
			'--co-notes-source-indicator-min-height',
			`${getSourceIndicatorHeight(this.plugin)}px`,
		);
		container.style.setProperty(
			'--co-notes-day-cell-min-height',
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
		const weekStart = this.plugin.settings.weekStart;

		// ── Header ────────────────────────────────────────────────────────────
		const header = container.createDiv('co-notes-calendar-header');

		const leftControls = header.createDiv('co-notes-header-left');
		const monthNavGroup = leftControls.createDiv('co-notes-nav-group');
		const prevBtn = monthNavGroup.createEl('button', { cls: 'co-notes-nav-btn co-notes-caret-btn', text: '▲' });
		const nextBtn = monthNavGroup.createEl('button', { cls: 'co-notes-nav-btn co-notes-caret-btn', text: '▼' });

		// Quick year / month switchers (year first, then month)
		const switcher = header.createDiv('co-notes-header-switcher');
		const yearSelect = switcher.createEl('select', {
			cls: 'co-notes-year-select',
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

		const monthSelect = switcher.createEl('select', {
			cls: 'co-notes-month-select',
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

		const rightControls = header.createDiv('co-notes-header-right');

		// Year view toggle is always available
		const yearBtn = rightControls.createEl('button', {
			cls: 'co-notes-today-btn',
			text: tr('calendar.yearView'),
			attr: { title: tr('calendar.yearView') },
		});
		addActionHandlers(yearBtn, () => {
			this.viewMode = 'year';
			this.render();
		});

		const noteNavGroup = rightControls.createDiv('co-notes-nav-group');
		const prevNoteBtn = noteNavGroup.createEl('button', {
			cls: 'co-notes-nav-btn co-notes-note-nav-btn co-notes-prev-note-btn',
			text: '←',
			attr: { 'aria-label': tr('calendar.previousNote'), title: tr('calendar.previousNote') },
		});
		const nextNoteBtn = noteNavGroup.createEl('button', {
			cls: 'co-notes-nav-btn co-notes-note-nav-btn co-notes-next-note-btn',
			text: '→',
			attr: { 'aria-label': tr('calendar.nextNote'), title: tr('calendar.nextNote') },
		});
		addActionHandlers(prevNoteBtn, () => {
			void this.plugin.navigateToAdjacentNote('prev');
		});
		addActionHandlers(nextNoteBtn, () => {
			void this.plugin.navigateToAdjacentNote('next');
		});

		const todayBtn = rightControls.createEl('button', {
			cls: 'co-notes-nav-btn co-notes-today-icon-btn',
			attr: { 'aria-label': tr('calendar.today'), title: tr('calendar.today') },
		});
		setIcon(todayBtn, 'rotate-ccw');

		addActionHandlers(prevBtn, () => {
			if (this.currentMonth === 0) {
				this.currentMonth = 11;
				this.currentYear--;
			} else {
				this.currentMonth--;
			}
			this.render();
		});

		addActionHandlers(nextBtn, () => {
			if (this.currentMonth === 11) {
				this.currentMonth = 0;
				this.currentYear++;
			} else {
				this.currentMonth++;
			}
			this.render();
		});

		addActionHandlers(todayBtn, () => {
			const now = new Date();
			this.currentYear = now.getFullYear();
			this.currentMonth = now.getMonth();
			this.render();
		});

		// ── Calendar grid ─────────────────────────────────────────────────────
		const grid = container.createDiv('co-notes-calendar-grid');
		const weeklySources = config.weeklySources ?? [];
		const hasWeekly = weeklySources.length > 0;
		if (hasWeekly) {
			grid.addClass('co-notes-calendar-with-weekly');
			grid.style.setProperty('--co-notes-weekly-columns', String(weeklySources.length));
		}

		// Header row: optional weekly columns + 7 weekday columns
		if (hasWeekly) {
			for (let i = 0; i < weeklySources.length; i++) {
				grid.createDiv({
					text: tr('calendar.weekHeader'),
					cls: 'co-notes-day-header co-notes-weekly-header',
				});
			}
		}
		const dayNames = getWeekdayLabels(language, weekStart);
		for (const name of dayNames) {
			grid.createDiv({ text: name, cls: 'co-notes-day-header' });
		}

		const firstDay = new Date(this.currentYear, this.currentMonth, 1);
		const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
		const prevMonthDays = new Date(this.currentYear, this.currentMonth, 0).getDate();
		const leadingEmptyCells = getLeadingDayCount(firstDay, weekStart);
		const weekRows = Math.ceil((leadingEmptyCells + daysInMonth) / 7);
		grid.style.setProperty('--co-notes-calendar-week-rows', String(weekRows));

		// Render week by week so the weekly notes sit at the start of each row
		for (let week = 0; week < weekRows; week++) {
			if (hasWeekly) {
				const weekStartDate = new Date(
					this.currentYear,
					this.currentMonth,
					1 - leadingEmptyCells + week * 7,
				);
				const weekReferenceDate = getIsoWeekReferenceDate(weekStartDate, weekStart);
				for (const weeklySource of weeklySources) {
					this.renderWeeklyCell(grid, weeklySource, weekReferenceDate, activeFilePath);
				}
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
					'co-notes-day-cell' +
						(isToday ? ' co-notes-today' : '') +
						(isOtherMonth ? ' co-notes-day-other-month' : ''),
				);
				cell.createDiv({ text: String(date.getDate()), cls: 'co-notes-day-number' });

				if (config.sources.length > 0) {
					const sourcesWrap = cell.createDiv('co-notes-day-sources');
					let sourceIndex = 0;
					for (const rowLength of getSourceRowLengths(config.sources.length)) {
						const sourcesRow = sourcesWrap.createDiv('co-notes-day-sources-row');
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
								cls: `co-notes-source-indicator ${exists ? 'exists' : 'missing'}${isActive ? ' active' : ''}`,
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
										cls: 'co-notes-source-marker',
									});
									markerSpan.style.color = getContrastColor(source.color);
								}
							}

							indicator.title = `${source.name}${exists ? '' : tr('calendar.missingNoteSuffix')}`;

							addActionHandlers(indicator, () => {
								void this.openOrCreateNote(filePath);
							});
						}
					}
				}

				if (hasActiveNote) {
					cell.addClass('co-notes-day-cell-active');
				}
			}
		}

		// ── Legend (bottom) ───────────────────────────────────────────────────
		this.renderLegend(container, [...config.sources, ...(config.weeklySources ?? [])]);
	}

	private renderLegend(container: HTMLElement, sources: NoteSource[]): void {
		if (sources.length === 0) {
			return;
		}
		const legend = container.createDiv('co-notes-legend');
		for (const source of sources) {
			const item = legend.createDiv('co-notes-legend-item');
			const dot = item.createDiv('co-notes-legend-dot');
			dot.style.backgroundColor = source.color;
			item.createSpan({ text: source.name });
		}
	}

	private renderWeeklyCell(
		grid: HTMLElement,
		source: NoteSource,
		weekReferenceDate: Date,
		activeFilePath: string | null,
	): void {
		const tr = this.plugin.t.bind(this.plugin);
		const filePath = getFilePath(source.pathTemplate, weekReferenceDate);
		const file = this.app.vault.getAbstractFileByPath(filePath);
		const exists = file instanceof TFile;
		const isActive = activeFilePath !== null && activeFilePath === filePath;

		const cell = grid.createDiv('co-notes-weekly-cell');
		if (isActive) {
			cell.addClass('co-notes-weekly-cell-active');
		}

		cell.createDiv({
			text: `W${getIsoWeekNumber(weekReferenceDate)}`,
			cls: 'co-notes-weekly-number',
		});

		const indicator = cell.createDiv({
			cls: `co-notes-weekly-indicator ${exists ? 'exists' : 'missing'}`,
		});
		if (exists) {
			indicator.style.backgroundColor = source.color;
		}

		if (exists && source.checkboxProperty) {
			const checked = isCheckboxChecked(this.app, file, source.checkboxProperty);
			if (checked) {
				const markerSpan = indicator.createSpan({
					text: source.markerSymbol || '✓',
					cls: 'co-notes-source-marker',
				});
				markerSpan.style.color = getContrastColor(source.color);
			}
		}

		cell.title = `${source.name}${exists ? '' : tr('calendar.missingNoteSuffix')}`;
		addActionHandlers(cell, () => {
			void this.openOrCreateNote(filePath);
		});
	}

	private renderYearCalendar(container: HTMLElement, config: CalendarViewConfig): void {
		const language = this.plugin.getLanguage();
		const tr = this.plugin.t.bind(this.plugin);
		const activeFilePath = this.app.workspace.getActiveFile()?.path ?? null;
		const today = new Date();

		// ── Header ────────────────────────────────────────────────────────────
		const header = container.createDiv('co-notes-calendar-header');

		const leftControls = header.createDiv('co-notes-header-left');
		const yearNavGroup = leftControls.createDiv('co-notes-nav-group');
		const prevBtn = yearNavGroup.createEl('button', { cls: 'co-notes-nav-btn co-notes-caret-btn', text: '▲' });
		const nextBtn = yearNavGroup.createEl('button', { cls: 'co-notes-nav-btn co-notes-caret-btn', text: '▼' });

		addActionHandlers(prevBtn, () => {
			this.currentYear--;
			this.render();
		});
		addActionHandlers(nextBtn, () => {
			this.currentYear++;
			this.render();
		});

		header.createSpan({
			cls: 'co-notes-month-title',
			text: String(this.currentYear),
		});

		const rightControls = header.createDiv('co-notes-header-right');
		const monthBtn = rightControls.createEl('button', {
			cls: 'co-notes-today-btn',
			text: tr('calendar.monthView'),
		});
		addActionHandlers(monthBtn, () => {
			this.viewMode = 'month';
			this.render();
		});

		const todayBtn = rightControls.createEl('button', {
			cls: 'co-notes-nav-btn co-notes-today-icon-btn',
			attr: { 'aria-label': tr('calendar.today'), title: tr('calendar.today') },
		});
		setIcon(todayBtn, 'rotate-ccw');
		addActionHandlers(todayBtn, () => {
			const now = new Date();
			this.currentYear = now.getFullYear();
			this.currentMonth = now.getMonth();
			this.viewMode = 'month';
			this.render();
		});

		// ── Month grid ────────────────────────────────────────────────────────
		const grid = container.createDiv('co-notes-year-grid');
		const monthLabels = getMonthLabels(language);
		const monthlySources = config.monthlySources ?? [];

		for (let m = 0; m < 12; m++) {
			const monthDate = new Date(this.currentYear, m, 1);
			const isCurrentMonth =
				today.getFullYear() === this.currentYear && today.getMonth() === m;

			const cell = grid.createDiv(
				'co-notes-month-cell' + (isCurrentMonth ? ' co-notes-current-month' : ''),
			);
			// Month name + monthly-note indicator share one row
			const nameRow = cell.createDiv('co-notes-month-name-row');
			nameRow.createDiv({
				text: monthLabels[m] ?? String(m + 1),
				cls: 'co-notes-month-name',
			});

			for (const monthlySource of monthlySources) {
				const filePath = getFilePath(monthlySource.pathTemplate, monthDate);
				const file = this.app.vault.getAbstractFileByPath(filePath);
				const exists = file instanceof TFile;
				const isActive = activeFilePath !== null && activeFilePath === filePath;

				const indicator = nameRow.createDiv({
					cls: `co-notes-monthly-indicator ${exists ? 'exists' : 'missing'}${isActive ? ' active' : ''}`,
				});
				// A small colored dot next to the month name; only fill with the
				// source color when the note exists (missing shows a dashed outline).
				if (exists) {
					indicator.style.backgroundColor = monthlySource.color;
				}

				if (exists && monthlySource.checkboxProperty) {
					const checked = isCheckboxChecked(this.app, file, monthlySource.checkboxProperty);
					if (checked) {
						const markerSpan = indicator.createSpan({
							text: monthlySource.markerSymbol || '✓',
							cls: 'co-notes-source-marker',
						});
						markerSpan.style.color = getContrastColor(monthlySource.color);
					}
				}

				// Clicking the monthly-note indicator opens/creates the monthly note
				indicator.title = `${monthlySource.name}${exists ? '' : tr('calendar.missingNoteSuffix')}`;
				addActionHandlers(indicator, () => {
					void this.openOrCreateNote(filePath);
				});
			}

			// Daily-note count bar chart: one bar per source
			if (config.sources.length > 0) {
				const daysInMonth = new Date(this.currentYear, m + 1, 0).getDate();
				const chart = cell.createDiv('co-notes-month-chart');
				for (const source of config.sources) {
					const count = this.countNotesInMonth(source, this.currentYear, m);
					const ratio = daysInMonth > 0 ? count / daysInMonth : 0;
					const item = chart.createDiv('co-notes-month-chart-item');
					item.createSpan({
						text: String(count),
						cls: 'co-notes-month-chart-count',
					});
					const track = item.createDiv('co-notes-month-chart-track');
					const bar = track.createDiv('co-notes-month-chart-bar');
					bar.style.height = count > 0 ? `${Math.max(ratio * 100, 5)}%` : '0%';
					if (count > 0) {
						bar.style.backgroundColor = source.color;
					}
					bar.title = `${source.name}: ${count}/${daysInMonth}`;
				}
			}

			// Clicking anywhere else on the month cell jumps to that month view
			cell.title = monthLabels[m] ?? String(m + 1);
			addActionHandlers(cell, () => {
				this.currentMonth = m;
				this.viewMode = 'month';
				this.render();
			});
		}

		// ── Legend (bottom) ───────────────────────────────────────────────────
		this.renderLegend(container, [...config.sources, ...(config.monthlySources ?? [])]);
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
	private readonly plugin: CoNotesPlugin;
	private readonly filePath: string;
	private readonly onSubmit: (confirmed: boolean) => void;

	constructor(
		app: App,
		plugin: CoNotesPlugin,
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

function confirmCreateNote(app: App, plugin: CoNotesPlugin, filePath: string): Promise<boolean> {
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

function getSourceIndicatorHeight(plugin: CoNotesPlugin): number {
	return normalizeSourceIndicatorHeight(plugin.settings.globalSourceIndicatorHeight);
}

function getDayCellMinHeight(plugin: CoNotesPlugin): number {
	return normalizeDayCellMinHeight(plugin.settings.globalDayCellMinHeight);
}
