import { App, Notice, PluginSettingTab, setIcon, type SettingDefinitionItem } from 'obsidian';
import type CoNotesPlugin from './main';
import { resolveLanguage, t } from './i18n';
import {
	CoNotesSettings,
	CalendarViewConfig,
	NoteSource,
	NoteCategory,
	DEFAULT_COLORS,
	DEFAULT_DAY_CELL_MIN_HEIGHT,
	DEFAULT_SOURCE_INDICATOR_HEIGHT,
	generateId,
	MAX_DAY_CELL_MIN_HEIGHT,
	MAX_SOURCE_INDICATOR_HEIGHT,
	MIN_DAY_CELL_MIN_HEIGHT,
	MIN_SOURCE_INDICATOR_HEIGHT,
	normalizeDayCellMinHeight,
	normalizeSourceIndicatorHeight,
} from './types';
import { createSettingsExport, parseSettingsImport } from './utils/settingsTransfer';
import { HOLIDAY_COUNTRY_OPTIONS, isHolidayCountry } from './utils/holidays';
import {
	getPeriodSources,
	normalizeSourceCategories,
	reorderSourcesByCategory,
	type SourcePeriodKey,
} from './utils/sourceCategories';
import { SourceConfigModal } from './views/SourceConfigModal';

export type { CoNotesSettings };

const MARKER_SYMBOL_PRESETS = ['✓', '✅', '⭐', '🔥', '❤️', '📌', '🎯', '💡', '🏆', '❗', '☑️', '✔️'];

export const DEFAULT_SETTINGS: CoNotesSettings = {
	confirmBeforeCreate: true,
	globalSourceIndicatorHeight: DEFAULT_SOURCE_INDICATOR_HEIGHT,
	globalDayCellMinHeight: DEFAULT_DAY_CELL_MIN_HEIGHT,
	highlightWeekends: true,
	holidayCountry: '',
	language: 'system',
	weekStart: 'monday',
	calendarViews: [
		{
			id: generateId(),
			name: 'Daily notes',
			categories: [
				{ id: 'category-a', name: 'A diary', color: DEFAULT_COLORS[0] ?? '#4a9eff' },
				{ id: 'category-b', name: 'B diary', color: DEFAULT_COLORS[1] ?? '#ff6b6b' },
			],
			sources: [
				{
					id: generateId(),
					categoryId: 'category-a',
					name: 'A diary',
					pathTemplate: 'daily/{YYYY}/{MM}/{YYYY-MM-DD}',
					color: DEFAULT_COLORS[0] ?? '#4a9eff',
				},
				{
					id: generateId(),
					categoryId: 'category-b',
					name: 'B diary',
					pathTemplate: 'daily-b/{YYYY}/{MM}/{YYYY-MM-DD}',
					color: DEFAULT_COLORS[1] ?? '#ff6b6b',
				},
			],
		},
	],
};

export class CoNotesSettingTab extends PluginSettingTab {
	plugin: CoNotesPlugin;

	constructor(app: App, plugin: CoNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const language = resolveLanguage(this.plugin.settings.language);
		const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string>) =>
			t(language, key, vars);

		return [
			{
				name: tr('settings.calendarViewsHeading'),
				desc: tr('settings.calendarViewsDesc'),
				render: (setting) => {
					setting.settingEl.addClass('co-notes-settings-custom');
					this.renderCalendarViewSettings(setting.controlEl);
				},
			},
			{
				name: tr('settings.language.name'),
				desc: tr('settings.language.desc'),
				control: {
					type: 'dropdown',
					key: 'language',
					options: {
						system: tr('settings.language.option.system'),
						'zh-CN': tr('settings.language.option.zh-CN'),
						en: tr('settings.language.option.en'),
					},
				},
			},
			{
				name: tr('settings.weekStart.name'),
				desc: tr('settings.weekStart.desc'),
				control: {
					type: 'dropdown',
					key: 'weekStart',
					options: {
						monday: tr('settings.weekStart.option.monday'),
						sunday: tr('settings.weekStart.option.sunday'),
					},
				},
			},
			{
				name: tr('settings.highlightWeekends.name'),
				desc: tr('settings.highlightWeekends.desc'),
				control: { type: 'toggle', key: 'highlightWeekends' },
			},
			{
				name: tr('settings.holidayCountry.name'),
				desc: tr('settings.holidayCountry.desc'),
				control: {
					type: 'dropdown',
					key: 'holidayCountry',
					options: {
						'': tr('settings.holidayCountry.option.none'),
						...HOLIDAY_COUNTRY_OPTIONS,
					},
				},
			},
			{
				name: tr('settings.confirmBeforeCreate.name'),
				desc: tr('settings.confirmBeforeCreate.desc'),
				control: { type: 'toggle', key: 'confirmBeforeCreate' },
			},
			{
				name: tr('settings.sourceIndicatorHeight.name'),
				desc: tr('settings.sourceIndicatorHeight.desc'),
				control: {
					type: 'number',
					key: 'globalSourceIndicatorHeight',
					min: MIN_SOURCE_INDICATOR_HEIGHT,
					max: MAX_SOURCE_INDICATOR_HEIGHT,
					step: 1,
				},
			},
			{
				name: tr('settings.dayCellMinHeight.name'),
				desc: tr('settings.dayCellMinHeight.desc'),
				control: {
					type: 'number',
					key: 'globalDayCellMinHeight',
					min: MIN_DAY_CELL_MIN_HEIGHT,
					max: MAX_DAY_CELL_MIN_HEIGHT,
					step: 1,
				},
			},
			{
				name: tr('settings.transfer.name'),
				desc: tr('settings.transfer.desc'),
				render: (setting) => {
					const actions = setting.controlEl.createDiv('co-notes-settings-transfer-actions');
					const exportBtn = actions.createEl('button', {
						text: tr('settings.export.button'),
						cls: 'co-notes-btn',
						attr: { type: 'button' },
					});
					exportBtn.addEventListener('click', () => this.exportSettings());

					const importInput = actions.createEl('input', {
						cls: 'co-notes-settings-import-input',
						attr: { type: 'file', accept: '.json,application/json' },
					});
					const importBtn = actions.createEl('button', {
						text: tr('settings.import.button'),
						cls: 'co-notes-btn',
						attr: { type: 'button' },
					});
					importBtn.addEventListener('click', () => importInput.click());
					importInput.addEventListener('change', () => {
						const file = importInput.files?.[0];
						importInput.value = '';
						if (file) {
							void this.importSettings(file);
						}
					});
				},
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		switch (key) {
			case 'language':
				if (value === 'system' || value === 'zh-CN' || value === 'en') {
					this.plugin.settings.language = value;
				}
				break;
			case 'weekStart':
				if (value === 'monday' || value === 'sunday') {
					this.plugin.settings.weekStart = value;
				}
				break;
			case 'highlightWeekends':
				this.plugin.settings.highlightWeekends = value === true;
				break;
			case 'holidayCountry':
				if (isHolidayCountry(value)) {
					this.plugin.settings.holidayCountry = value;
				}
				break;
			case 'confirmBeforeCreate':
				this.plugin.settings.confirmBeforeCreate = value === true;
				break;
			case 'globalSourceIndicatorHeight':
				this.plugin.settings.globalSourceIndicatorHeight =
					normalizeSourceIndicatorHeight(value);
				break;
			case 'globalDayCellMinHeight':
				this.plugin.settings.globalDayCellMinHeight = normalizeDayCellMinHeight(value);
				break;
			default:
				return;
		}

		await this.plugin.saveSettings();
		this.update();
	}

	private exportSettings(): void {
		try {
			const { contents, filename } = createSettingsExport(this.plugin.settings);
			const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
			const link = activeDocument.createEl('a');
			link.href = url;
			link.download = filename;
			activeDocument.body.appendChild(link);
			link.click();
			link.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 0);
			new Notice(this.plugin.t('settings.export.success'));
		} catch {
			new Notice(this.plugin.t('settings.export.failed'));
		}
	}

	private async importSettings(file: File): Promise<void> {
		const previousSettings = this.plugin.settings;
		try {
			this.plugin.settings = parseSettingsImport(await file.text());
			await this.plugin.saveSettings();
		} catch {
			this.plugin.settings = previousSettings;
			new Notice(this.plugin.t('settings.import.failed'));
			return;
		}

		this.update();
		new Notice(this.plugin.t('settings.import.success'));
	}

	private renderCalendarViewSettings(containerEl: HTMLElement): void {
		containerEl.empty();
		const tr = this.plugin.t.bind(this.plugin);
		const viewsContainer = containerEl.createDiv('co-notes-settings-views');
		this.renderCalendarViews(viewsContainer);

		const addBtn = containerEl.createEl('button', {
			text: tr('settings.addCalendarView'),
			cls: 'co-notes-btn co-notes-btn-cta',
		});
		addBtn.addEventListener('click', () => {
			void this.addCalendarView();
		});

		containerEl.createDiv({
			cls: 'co-notes-settings-footer-divider',
		});
		containerEl.createDiv({
			text: tr('settings.pathTemplateHint'),
			cls: 'co-notes-field-hint',
		});
	}

	private async addCalendarView(): Promise<void> {
		const colorIndex = this.plugin.settings.calendarViews.length % DEFAULT_COLORS.length;
		const categoryId = generateId();
		const category: NoteCategory = {
			id: categoryId,
			name: this.plugin.t('settings.newSource', { label: 'A' }),
			color: DEFAULT_COLORS[colorIndex] ?? '#4a9eff',
		};
		const newView: CalendarViewConfig = {
			id: generateId(),
			categories: [category],
			name: this.plugin.t('settings.newCalendarView'),
			sources: [
				{
					id: generateId(),
					categoryId,
					name: category.name,
					pathTemplate: 'daily/{YYYY}/{MM}/{YYYY-MM-DD}',
					color: category.color,
				},
			],
		};
		this.plugin.settings.calendarViews.push(newView);
		await this.plugin.saveSettings();
		this.update();
	}

	private renderCalendarViews(container: HTMLElement): void {
		container.empty();
		const views = this.plugin.settings.calendarViews;
		for (let i = 0; i < views.length; i++) {
			const config = views[i];
			if (config) {
				this.renderCalendarViewConfig(container, config, i);
			}
		}
	}

	private renderCalendarViewConfig(
		container: HTMLElement,
		config: CalendarViewConfig,
		index: number,
	): void {
		const card = container.createDiv('co-notes-settings-view-card');
		const tr = this.plugin.t.bind(this.plugin);

		// ── Card header ───────────────────────────────────────────────────────
		const cardHeader = card.createDiv('co-notes-settings-view-header');

		const nameRow = cardHeader.createDiv('co-notes-settings-view-name');
		nameRow.createSpan({ text: tr('settings.viewName'), cls: 'co-notes-label' });

		const nameInput = nameRow.createEl('input', {
			cls: 'co-notes-view-name-input',
			attr: { type: 'text', value: config.name },
		});
		nameInput.addEventListener('change', () => {
			config.name = nameInput.value;
			void this.plugin.saveSettings();
		});

		const actions = cardHeader.createDiv('co-notes-settings-view-actions');

		const openBtn = actions.createEl('button', {
			text: tr('settings.openView'),
			cls: 'co-notes-btn',
		});
		openBtn.addEventListener('click', () => {
			void this.plugin.openCalendarView(config.id);
		});

		const deleteBtn = actions.createEl('button', {
			text: tr('settings.delete'),
			cls: 'co-notes-btn co-notes-btn-danger',
		});
		deleteBtn.addEventListener('click', () => {
			void this.deleteCalendarView(index);
		});

		// ── Shared source categories ──────────────────────────────────────────
		card.createDiv({
			text: tr('settings.categories'),
			cls: 'co-notes-settings-section-title',
		});
		const categoriesContainer = card.createDiv('co-notes-settings-sources');
		for (const [categoryIndex, category] of (config.categories ?? []).entries()) {
			this.renderCategoryConfig(categoriesContainer, config, category, categoryIndex);
		}
		const addCategoryBtn = card.createEl('button', {
			text: tr('settings.addCategory'),
			cls: 'co-notes-btn co-notes-btn-secondary',
		});
		addCategoryBtn.addEventListener('click', () => void this.addCategory(config));

		card.createDiv({
			text: tr('settings.periodOrder'),
			cls: 'co-notes-settings-section-title co-notes-settings-period-order-title',
		});
		const periodColumns = card.createDiv('co-notes-settings-period-columns');
		for (const key of ['sources', 'weeklySources', 'monthlySources'] as const) {
			this.renderPeriodOrderColumn(periodColumns, config, key);
		}
	}

	private renderCategoryConfig(
		container: HTMLElement,
		config: CalendarViewConfig,
		category: NoteCategory,
		categoryIndex: number,
	): void {
		const tr = this.plugin.t.bind(this.plugin);
		const card = container.createDiv('co-notes-settings-category-item');
		const header = card.createDiv('co-notes-settings-category-header');
		const colorInput = header.createEl('input', {
			cls: 'co-notes-color-input',
			attr: { type: 'color', value: category.color, 'aria-label': tr('settings.categoryColor') },
		});
		colorInput.addEventListener('change', () => {
			category.color = colorInput.value;
			normalizeSourceCategories(config);
			void this.plugin.saveSettings().then(() => this.update());
		});

		const nameInput = header.createEl('input', {
			cls: 'co-notes-text-input co-notes-category-name-input',
			attr: { type: 'text', value: category.name, 'aria-label': tr('settings.sourceName') },
		});
		nameInput.addEventListener('change', () => {
			category.name = nameInput.value;
			normalizeSourceCategories(config);
			void this.plugin.saveSettings().then(() => this.update());
		});

		const deleteBtn = header.createEl('button', {
			cls: 'co-notes-btn co-notes-btn-icon co-notes-btn-danger co-notes-ghost-icon',
			attr: { 'aria-label': tr('settings.deleteCategory'), title: tr('settings.deleteCategory') },
		});
		setIcon(deleteBtn, 'trash-2');
		deleteBtn.addEventListener('click', () => {
			void this.deleteCategory(config, categoryIndex);
		});

		const periods = card.createDiv('co-notes-settings-category-periods');
		for (const key of ['sources', 'weeklySources', 'monthlySources'] as const) {
			const source = getPeriodSources(config, key).find(
				(candidate) => candidate.categoryId === category.id,
			);
			const periodRow = periods.createDiv(
				`co-notes-settings-category-period${source ? ' has-source' : ''}`,
			);
			const periodLabel = tr(getPeriodLabelKey(key));
			const toggleBtn = periodRow.createEl('button', {
				text: `${source ? '✓' : '+'} ${periodLabel}`,
				cls: `co-notes-period-toggle${source ? ' is-enabled' : ''}`,
				attr: source ? { title: tr('settings.removePeriod') } : {},
			});
			toggleBtn.addEventListener('click', () => {
				if (source) {
					config[key] = getPeriodSources(config, key).filter((item) => item.id !== source.id);
					void this.plugin.saveSettings().then(() => this.update());
				} else {
					void this.addPeriodSource(config, category, key);
				}
			});
			if (source) {
				const configureBtn = periodRow.createEl('button', {
					cls: 'co-notes-btn co-notes-btn-icon co-notes-ghost-icon co-notes-category-configure',
					attr: { 'aria-label': tr('settings.configure'), title: tr('settings.configure') },
				});
				setIcon(configureBtn, 'settings-2');
				configureBtn.addEventListener('click', () => {
					new SourceConfigModal(this.app, this.plugin, source, key, async () => {
						await this.plugin.saveSettings();
					}).open();
				});
			}
		}
	}

	private renderPeriodOrderColumn(
		container: HTMLElement,
		config: CalendarViewConfig,
		key: SourcePeriodKey,
	): void {
		const tr = this.plugin.t.bind(this.plugin);
		const column = container.createDiv('co-notes-settings-period-column');
		column.createDiv({ text: tr(getPeriodLabelKey(key)), cls: 'co-notes-settings-period-title' });
		const sources = getPeriodSources(config, key);
		for (const [index, source] of sources.entries()) {
			const row = column.createDiv('co-notes-settings-period-source');
			row.createSpan({ text: String(index + 1), cls: 'co-notes-category-order' });
			this.addSourceDragHandle(row, config, key, source.id);
			const dot = row.createSpan('co-notes-legend-dot');
			dot.style.backgroundColor = source.color;
			row.createSpan({ text: source.name, cls: 'co-notes-period-source-name' });
		}
	}

	private async addCategory(config: CalendarViewConfig): Promise<void> {
		const categoryId = generateId();
		const category: NoteCategory = {
			id: categoryId,
			name: this.plugin.t('settings.newSource', {
				label: String.fromCharCode(65 + (config.categories?.length ?? 0)),
			}),
			color: DEFAULT_COLORS[(config.categories?.length ?? 0) % DEFAULT_COLORS.length] ?? '#4a9eff',
		};
		config.categories = [...(config.categories ?? []), category];
		await this.addPeriodSource(config, category, 'sources');
	}

	private async addPeriodSource(
		config: CalendarViewConfig,
		category: NoteCategory,
		key: SourcePeriodKey,
	): Promise<void> {
		config[key] = [
			...getPeriodSources(config, key),
			{
				id: generateId(),
				categoryId: category.id,
				name: category.name,
				color: category.color,
				pathTemplate: getDefaultSourcePath(key),
			},
		];
		await this.plugin.saveSettings();
		this.update();
	}

	private async deleteCategory(config: CalendarViewConfig, categoryIndex: number): Promise<void> {
		const category = config.categories?.[categoryIndex];
		if (!category) return;
		config.categories?.splice(categoryIndex, 1);
		for (const key of ['sources', 'weeklySources', 'monthlySources'] as const) {
			config[key] = getPeriodSources(config, key).filter(
				(source) => source.categoryId !== category.id,
			);
		}
		await this.plugin.saveSettings();
		this.update();
	}

	private addCategoryDragHandle(
		container: HTMLElement,
		config: CalendarViewConfig,
		categoryId: string,
	): void {
		const handle = container.createEl('button', {
			text: '⠿',
			cls: 'co-notes-source-drag-handle',
			attr: {
				type: 'button',
				draggable: 'true',
				'aria-label': this.plugin.t('settings.dragToReorder'),
				title: this.plugin.t('settings.dragToReorder'),
			},
		});
		const card = container.parentElement;
		if (!card) return;
		const data = JSON.stringify({ configId: config.id, categoryId });
		handle.addEventListener('dragstart', (event: DragEvent) => {
			event.dataTransfer?.setData('text/plain', data);
			if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
			card.addClass('co-notes-source-dragging');
		});
		handle.addEventListener('dragend', () => card.removeClass('co-notes-source-dragging'));
		card.addEventListener('dragover', (event: DragEvent) => {
			event.preventDefault();
			card.addClass('co-notes-source-drag-over');
		});
		card.addEventListener('dragleave', () => card.removeClass('co-notes-source-drag-over'));
		card.addEventListener('drop', (event: DragEvent) => {
			event.preventDefault();
			card.removeClass('co-notes-source-drag-over');
			const payload = readCategoryDragPayload(event.dataTransfer?.getData('text/plain'));
			if (!payload || payload.configId !== config.id || payload.categoryId === categoryId) return;
			const categories = config.categories ?? [];
			const fromIndex = categories.findIndex((category) => category.id === payload.categoryId);
			const targetIndex = categories.findIndex((category) => category.id === categoryId);
			if (fromIndex < 0 || targetIndex < 0) return;
			const [dragged] = categories.splice(fromIndex, 1);
			if (!dragged) return;
			categories.splice(targetIndex, 0, dragged);
			reorderSourcesByCategory(config);
			void this.plugin.saveSettings().then(() => this.update());
		});
	}

	private renderOptionalSourceConfig(
		container: HTMLElement,
		config: CalendarViewConfig,
		key: 'weeklySources' | 'monthlySources',
		labelKey: 'settings.weeklySource' | 'settings.monthlySource',
		hintKey: 'settings.weeklySourceHint' | 'settings.monthlySourceHint',
		defaultPath: string,
	): void {
		const tr = this.plugin.t.bind(this.plugin);
		const section = container.createDiv('co-notes-settings-optional-source');

		section.createDiv({
			text: tr(labelKey),
			cls: 'co-notes-settings-section-title',
		});

		const sources = config[key] ?? [];
		for (let i = 0; i < sources.length; i++) {
			const source = sources[i];
			if (source) {
				this.renderOptionalSourceRow(section, config, key, source, i, defaultPath);
			}
		}

		const addBtn = section.createEl('button', {
			text: `+ ${tr(labelKey)}`,
			cls: 'co-notes-btn co-notes-btn-secondary',
		});
		addBtn.addEventListener('click', () => {
			const list = config[key] ?? [];
			const color =
				list.length === 0
					? key === 'weeklySources'
						? '#845ef7'
						: '#20c997'
					: (DEFAULT_COLORS[list.length % DEFAULT_COLORS.length] ?? '#4a9eff');
			config[key] = [
				...list,
				{
					id: generateId(),
					name: tr(labelKey),
					pathTemplate: defaultPath,
					color,
				},
			];
			void this.plugin.saveSettings().then(() => this.update());
		});

		section.createDiv({ text: tr(hintKey), cls: 'co-notes-field-hint' });
	}

	private renderOptionalSourceRow(
		section: HTMLElement,
		config: CalendarViewConfig,
		key: 'weeklySources' | 'monthlySources',
		source: NoteSource,
		index: number,
		defaultPath: string,
	): void {
		const tr = this.plugin.t.bind(this.plugin);
		const row = section.createDiv('co-notes-settings-source-item');
		this.addSourceDragHandle(row, config, key, source.id);

		// Color picker
		const colorWrap = row.createDiv('co-notes-settings-source-color');
		const colorInput = colorWrap.createEl('input', {
			cls: 'co-notes-color-input',
			attr: { type: 'color', value: source.color },
		});
		colorInput.addEventListener('change', () => {
			source.color = colorInput.value;
			void this.plugin.saveSettings();
		});

		// Name field
		const nameField = row.createDiv('co-notes-settings-source-field');
		nameField.createEl('label', { text: tr('settings.sourceName'), cls: 'co-notes-field-label' });
		const nameInput = nameField.createEl('input', {
			cls: 'co-notes-text-input',
			attr: { type: 'text', value: source.name },
		});
		nameInput.addEventListener('change', () => {
			source.name = nameInput.value;
			void this.plugin.saveSettings();
		});

		// Path template field
		const pathField = row.createDiv('co-notes-settings-source-field co-notes-path-field');
		pathField.createEl('label', { text: tr('settings.pathTemplate'), cls: 'co-notes-field-label' });
		const pathInput = pathField.createEl('input', {
			cls: 'co-notes-text-input co-notes-path-input',
			attr: {
				type: 'text',
				value: source.pathTemplate,
				placeholder: defaultPath,
			},
		});
		pathInput.addEventListener('change', () => {
			source.pathTemplate = pathInput.value;
			void this.plugin.saveSettings();
		});

		// Checkbox property field
		const checkboxField = row.createDiv('co-notes-settings-source-field');
		checkboxField.createEl('label', {
			text: tr('settings.checkboxProperty'),
			cls: 'co-notes-field-label',
		});
		const checkboxInput = checkboxField.createEl('input', {
			cls: 'co-notes-text-input',
			attr: {
				type: 'text',
				value: source.checkboxProperty ?? '',
				placeholder: tr('settings.checkboxPropertyPlaceholder'),
			},
		});
		checkboxInput.addEventListener('change', () => {
			source.checkboxProperty = checkboxInput.value.trim() || undefined;
			void this.plugin.saveSettings();
		});

		// Marker symbol field (dropdown)
		const markerField = row.createDiv('co-notes-settings-source-field co-notes-marker-field');
		markerField.createEl('label', {
			text: tr('settings.markerSymbol'),
			cls: 'co-notes-field-label',
		});
		const markerSelect = markerField.createEl('select', {
			cls: 'dropdown co-notes-marker-select',
		});
		const currentSymbol = source.markerSymbol ?? '';
		markerSelect.createEl('option', {
			text: tr('settings.markerSymbolDefault'),
			attr: { value: '' },
		});
		const symbolOptions =
			currentSymbol && !MARKER_SYMBOL_PRESETS.includes(currentSymbol)
				? [currentSymbol, ...MARKER_SYMBOL_PRESETS]
				: MARKER_SYMBOL_PRESETS;
		for (const symbol of symbolOptions) {
			markerSelect.createEl('option', {
				text: symbol,
				attr: { value: symbol },
			});
		}
		markerSelect.value = currentSymbol;
		markerSelect.addEventListener('change', () => {
			source.markerSymbol = markerSelect.value || undefined;
			void this.plugin.saveSettings();
		});

		// Remove button
		const actionsWrap = row.createDiv('co-notes-settings-source-actions');
		const removeBtn = actionsWrap.createEl('button', {
			text: '×',
			cls: 'co-notes-btn co-notes-btn-icon co-notes-btn-danger',
		});
		removeBtn.addEventListener('click', () => {
			config[key] = (config[key] ?? []).filter((_, i) => i !== index);
			void this.plugin.saveSettings().then(() => this.update());
		});
	}

	private async deleteCalendarView(index: number): Promise<void> {
		this.plugin.settings.calendarViews.splice(index, 1);
		await this.plugin.saveSettings();
		this.update();
	}

	private async addSource(config: CalendarViewConfig): Promise<void> {
		const colorIndex = config.sources.length % DEFAULT_COLORS.length;
		const newSource: NoteSource = {
			id: generateId(),
			name: this.plugin.t('settings.newSource', {
				label: String.fromCharCode(65 + config.sources.length),
			}),
			pathTemplate: 'daily/{YYYY}/{MM}/{YYYY-MM-DD}',
			color: DEFAULT_COLORS[colorIndex] ?? '#4a9eff',
		};
		config.sources.push(newSource);
		await this.plugin.saveSettings();
		this.update();
	}

	private renderSourceConfig(
		container: HTMLElement,
		config: CalendarViewConfig,
		source: NoteSource,
		sourceIndex: number,
	): void {
		const row = container.createDiv('co-notes-settings-source-item');
		const tr = this.plugin.t.bind(this.plugin);
		this.addSourceDragHandle(row, config, 'sources', source.id);

		// Color picker
		const colorWrap = row.createDiv('co-notes-settings-source-color');
		const colorInput = colorWrap.createEl('input', {
			cls: 'co-notes-color-input',
			attr: { type: 'color', value: source.color },
		});
		colorInput.addEventListener('change', () => {
			source.color = colorInput.value;
			void this.plugin.saveSettings();
		});

		// Name field
		const nameField = row.createDiv('co-notes-settings-source-field');
		nameField.createEl('label', { text: tr('settings.sourceName'), cls: 'co-notes-field-label' });
		const nameInput = nameField.createEl('input', {
			cls: 'co-notes-text-input',
			attr: { type: 'text', value: source.name },
		});
		nameInput.addEventListener('change', () => {
			source.name = nameInput.value;
			void this.plugin.saveSettings();
		});

		// Path template field
		const pathField = row.createDiv('co-notes-settings-source-field co-notes-path-field');
		pathField.createEl('label', { text: tr('settings.pathTemplate'), cls: 'co-notes-field-label' });
		const pathInput = pathField.createEl('input', {
			cls: 'co-notes-text-input co-notes-path-input',
			attr: {
				type: 'text',
				value: source.pathTemplate,
				placeholder: tr('settings.pathTemplatePlaceholder'),
			},
		});
		pathInput.addEventListener('change', () => {
			source.pathTemplate = pathInput.value;
			void this.plugin.saveSettings();
		});

		// Checkbox property field
		const checkboxField = row.createDiv('co-notes-settings-source-field');
		checkboxField.createEl('label', {
			text: tr('settings.checkboxProperty'),
			cls: 'co-notes-field-label',
		});
		const checkboxInput = checkboxField.createEl('input', {
			cls: 'co-notes-text-input',
			attr: {
				type: 'text',
				value: source.checkboxProperty ?? '',
				placeholder: tr('settings.checkboxPropertyPlaceholder'),
			},
		});
		checkboxInput.addEventListener('change', () => {
			source.checkboxProperty = checkboxInput.value.trim() || undefined;
			void this.plugin.saveSettings();
		});

		// Marker symbol field (dropdown)
		const markerField = row.createDiv('co-notes-settings-source-field co-notes-marker-field');
		markerField.createEl('label', {
			text: tr('settings.markerSymbol'),
			cls: 'co-notes-field-label',
		});
		const markerSelect = markerField.createEl('select', {
			cls: 'dropdown co-notes-marker-select',
		});

		const currentSymbol = source.markerSymbol ?? '';
		markerSelect.createEl('option', {
			text: tr('settings.markerSymbolDefault'),
			attr: { value: '' },
		});
		// Keep a previously saved custom symbol selectable even if it is not a preset
		const symbolOptions =
			currentSymbol && !MARKER_SYMBOL_PRESETS.includes(currentSymbol)
				? [currentSymbol, ...MARKER_SYMBOL_PRESETS]
				: MARKER_SYMBOL_PRESETS;
		for (const symbol of symbolOptions) {
			markerSelect.createEl('option', {
				text: symbol,
				attr: { value: symbol },
			});
		}
		markerSelect.value = currentSymbol;

		markerSelect.addEventListener('change', () => {
			source.markerSymbol = markerSelect.value || undefined;
			void this.plugin.saveSettings();
		});

		const actionsWrap = row.createDiv('co-notes-settings-source-actions');

		// Delete button
		const deleteBtn = actionsWrap.createEl('button', {
			text: '×',
			cls: 'co-notes-btn co-notes-btn-icon co-notes-btn-danger',
		});
		deleteBtn.addEventListener('click', () => {
			void this.deleteSource(config, sourceIndex);
		});
	}

	private async deleteSource(config: CalendarViewConfig, sourceIndex: number): Promise<void> {
		config.sources.splice(sourceIndex, 1);
		await this.plugin.saveSettings();
		this.update();
	}

	private addSourceDragHandle(
		row: HTMLElement,
		config: CalendarViewConfig,
		key: 'sources' | 'weeklySources' | 'monthlySources',
		sourceId: string,
	): void {
		const handle = row.createEl('button', {
			text: '⠿',
			cls: 'co-notes-source-drag-handle',
			attr: {
				type: 'button',
				draggable: 'true',
				'aria-label': this.plugin.t('settings.dragToReorder'),
				title: this.plugin.t('settings.dragToReorder'),
			},
		});
		const dragData = JSON.stringify({ configId: config.id, key, sourceId });

		handle.addEventListener('dragstart', (event: DragEvent) => {
			if (!event.dataTransfer) return;
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', dragData);
			row.addClass('co-notes-source-dragging');
		});
		handle.addEventListener('dragend', () => {
			row.removeClass('co-notes-source-dragging');
			row.parentElement
				?.querySelectorAll('.co-notes-source-drag-over')
				.forEach((element) => element.removeClass('co-notes-source-drag-over'));
		});

		row.addEventListener('dragover', (event: DragEvent) => {
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
			row.addClass('co-notes-source-drag-over');
		});
		row.addEventListener('dragleave', (event: DragEvent) => {
			if (!(event.relatedTarget instanceof Node) || !row.contains(event.relatedTarget)) {
				row.removeClass('co-notes-source-drag-over');
			}
		});
		row.addEventListener('drop', (event: DragEvent) => {
			event.preventDefault();
			row.removeClass('co-notes-source-drag-over');
			const payload = readSourceDragPayload(event.dataTransfer?.getData('text/plain'));
			if (
				!payload ||
				payload.configId !== config.id ||
				payload.key !== key ||
				payload.sourceId === sourceId
			) {
				return;
			}
			void this.reorderSource(config, key, payload.sourceId, sourceId);
		});
	}

	private async reorderSource(
		config: CalendarViewConfig,
		key: 'sources' | 'weeklySources' | 'monthlySources',
		sourceId: string,
		targetId: string,
	): Promise<void> {
		const sources = config[key] ?? [];
		const sourceIndex = sources.findIndex((source) => source.id === sourceId);
		const targetIndex = sources.findIndex((source) => source.id === targetId);
		if (sourceIndex < 0 || targetIndex < 0) return;

		const [source] = sources.splice(sourceIndex, 1);
		if (!source) return;
		sources.splice(targetIndex, 0, source);
		config[key] = sources;
		await this.plugin.saveSettings();
		this.update();
	}
}

function readSourceDragPayload(
	value: string | undefined,
): { configId: string; key: string; sourceId: string } | null {
	if (!value) return null;
	try {
		const payload: unknown = JSON.parse(value);
		if (typeof payload !== 'object' || payload === null) return null;
		const record = payload as Record<string, unknown>;
		return typeof record.configId === 'string' &&
			typeof record.key === 'string' &&
			typeof record.sourceId === 'string'
			? { configId: record.configId, key: record.key, sourceId: record.sourceId }
			: null;
	} catch {
		return null;
	}
}

function getDefaultSourcePath(key: SourcePeriodKey): string {
	if (key === 'weeklySources') return 'weekly/{GGGG}/{GGGG}-W{WW}';
	if (key === 'monthlySources') return 'monthly/{YYYY}/{YYYY}-{MM}';
	return 'daily/{YYYY}/{MM}/{YYYY-MM-DD}';
}

function getPeriodLabelKey(
	key: SourcePeriodKey,
): 'settings.dailyPeriod' | 'settings.weeklyPeriod' | 'settings.monthlyPeriod' {
	if (key === 'weeklySources') return 'settings.weeklyPeriod';
	if (key === 'monthlySources') return 'settings.monthlyPeriod';
	return 'settings.dailyPeriod';
}

function readCategoryDragPayload(
	value: string | undefined,
): { configId: string; categoryId: string } | null {
	if (!value) return null;
	try {
		const payload: unknown = JSON.parse(value);
		if (typeof payload !== 'object' || payload === null) return null;
		const record = payload as Record<string, unknown>;
		return typeof record.configId === 'string' && typeof record.categoryId === 'string'
			? { configId: record.configId, categoryId: record.categoryId }
			: null;
	} catch {
		return null;
	}
}
