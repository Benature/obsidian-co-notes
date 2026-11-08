import { App, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type ParallelNotesPlugin from './main';
import { resolveLanguage, t } from './i18n';
import {
	ParallelNotesSettings,
	CalendarViewConfig,
	NoteSource,
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

export type { ParallelNotesSettings };

const MARKER_SYMBOL_PRESETS = ['✓', '✅', '⭐', '🔥', '❤️', '📌', '🎯', '💡', '🏆', '❗', '☑️', '✔️'];

export const DEFAULT_SETTINGS: ParallelNotesSettings = {
	confirmBeforeCreate: true,
	globalSourceIndicatorHeight: DEFAULT_SOURCE_INDICATOR_HEIGHT,
	globalDayCellMinHeight: DEFAULT_DAY_CELL_MIN_HEIGHT,
	language: 'system',
	calendarViews: [
		{
			id: generateId(),
			name: 'Daily notes',
			sources: [
				{
					id: generateId(),
					name: 'A diary',
					pathTemplate: 'daily/{YYYY}/{MM}/{YYYY-MM-DD}',
					color: DEFAULT_COLORS[0] ?? '#4a9eff',
				},
				{
					id: generateId(),
					name: 'B diary',
					pathTemplate: 'daily-b/{YYYY}/{MM}/{YYYY-MM-DD}',
					color: DEFAULT_COLORS[1] ?? '#ff6b6b',
				},
			],
		},
	],
};

export class ParallelNotesSettingTab extends PluginSettingTab {
	plugin: ParallelNotesPlugin;

	constructor(app: App, plugin: ParallelNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const language = resolveLanguage(this.plugin.settings.language);
		const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string>) =>
			t(language, key, vars);

		return [
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
				name: tr('settings.calendarViewsHeading'),
				desc: tr('settings.calendarViewsDesc'),
				render: (setting) => {
					setting.settingEl.addClass('parallel-notes-settings-custom');
					this.renderCalendarViewSettings(setting.controlEl);
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

	private renderCalendarViewSettings(containerEl: HTMLElement): void {
		containerEl.empty();
		const tr = this.plugin.t.bind(this.plugin);
		const viewsContainer = containerEl.createDiv('parallel-notes-settings-views');
		this.renderCalendarViews(viewsContainer);

		const addBtn = containerEl.createEl('button', {
			text: tr('settings.addCalendarView'),
			cls: 'parallel-notes-btn parallel-notes-btn-cta',
		});
		addBtn.addEventListener('click', () => {
			void this.addCalendarView();
		});

		containerEl.createDiv({
			cls: 'parallel-notes-settings-footer-divider',
		});
		containerEl.createDiv({
			text: tr('settings.pathTemplateHint'),
			cls: 'parallel-notes-field-hint',
		});
	}

	private async addCalendarView(): Promise<void> {
		const colorIndex = this.plugin.settings.calendarViews.length % DEFAULT_COLORS.length;
		const newView: CalendarViewConfig = {
			id: generateId(),
			name: this.plugin.t('settings.newCalendarView'),
			sources: [
				{
					id: generateId(),
					name: this.plugin.t('settings.newSource', { label: 'A' }),
					pathTemplate: 'daily/{YYYY}/{MM}/{YYYY-MM-DD}',
					color: DEFAULT_COLORS[colorIndex] ?? '#4a9eff',
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
		const card = container.createDiv('parallel-notes-settings-view-card');
		const tr = this.plugin.t.bind(this.plugin);

		// ── Card header ───────────────────────────────────────────────────────
		const cardHeader = card.createDiv('parallel-notes-settings-view-header');

		const nameRow = cardHeader.createDiv('parallel-notes-settings-view-name');
		nameRow.createSpan({ text: tr('settings.viewName'), cls: 'parallel-notes-label' });

		const nameInput = nameRow.createEl('input', {
			cls: 'parallel-notes-view-name-input',
			attr: { type: 'text', value: config.name },
		});
		nameInput.addEventListener('change', () => {
			config.name = nameInput.value;
			void this.plugin.saveSettings();
		});

		const actions = cardHeader.createDiv('parallel-notes-settings-view-actions');

		const openBtn = actions.createEl('button', {
			text: tr('settings.openView'),
			cls: 'parallel-notes-btn',
		});
		openBtn.addEventListener('click', () => {
			void this.plugin.openCalendarView(config.id);
		});

		const deleteBtn = actions.createEl('button', {
			text: tr('settings.delete'),
			cls: 'parallel-notes-btn parallel-notes-btn-danger',
		});
		deleteBtn.addEventListener('click', () => {
			void this.deleteCalendarView(index);
		});

		// ── Sources ───────────────────────────────────────────────────────────
		card.createDiv({
			text: tr('settings.noteSources'),
			cls: 'parallel-notes-settings-section-title',
		});

		const sourcesContainer = card.createDiv('parallel-notes-settings-sources');
		for (let j = 0; j < config.sources.length; j++) {
			const source = config.sources[j];
			if (source) {
				this.renderSourceConfig(sourcesContainer, config, source, j);
			}
		}

		const addSourceBtn = card.createEl('button', {
			text: tr('settings.addSource'),
			cls: 'parallel-notes-btn parallel-notes-btn-secondary',
		});
		addSourceBtn.addEventListener('click', () => {
			void this.addSource(config);
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
		const row = container.createDiv('parallel-notes-settings-source-item');
		const tr = this.plugin.t.bind(this.plugin);

		// Color picker
		const colorWrap = row.createDiv('parallel-notes-settings-source-color');
		const colorInput = colorWrap.createEl('input', {
			cls: 'parallel-notes-color-input',
			attr: { type: 'color', value: source.color },
		});
		colorInput.addEventListener('change', () => {
			source.color = colorInput.value;
			void this.plugin.saveSettings();
		});

		// Name field
		const nameField = row.createDiv('parallel-notes-settings-source-field');
		nameField.createEl('label', { text: tr('settings.sourceName'), cls: 'parallel-notes-field-label' });
		const nameInput = nameField.createEl('input', {
			cls: 'parallel-notes-text-input',
			attr: { type: 'text', value: source.name },
		});
		nameInput.addEventListener('change', () => {
			source.name = nameInput.value;
			void this.plugin.saveSettings();
		});

		// Path template field
		const pathField = row.createDiv('parallel-notes-settings-source-field parallel-notes-path-field');
		pathField.createEl('label', { text: tr('settings.pathTemplate'), cls: 'parallel-notes-field-label' });
		const pathInput = pathField.createEl('input', {
			cls: 'parallel-notes-text-input parallel-notes-path-input',
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
		const checkboxField = row.createDiv('parallel-notes-settings-source-field');
		checkboxField.createEl('label', {
			text: tr('settings.checkboxProperty'),
			cls: 'parallel-notes-field-label',
		});
		const checkboxInput = checkboxField.createEl('input', {
			cls: 'parallel-notes-text-input',
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
		const markerField = row.createDiv('parallel-notes-settings-source-field parallel-notes-marker-field');
		markerField.createEl('label', {
			text: tr('settings.markerSymbol'),
			cls: 'parallel-notes-field-label',
		});
		const markerSelect = markerField.createEl('select', {
			cls: 'dropdown parallel-notes-marker-select',
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

		const actionsWrap = row.createDiv('parallel-notes-settings-source-actions');

		const moveUpBtn = actionsWrap.createEl('button', {
			text: '↑',
			cls: 'parallel-notes-btn parallel-notes-btn-icon',
		});
		moveUpBtn.disabled = sourceIndex === 0;
		moveUpBtn.addEventListener('click', () => {
			void this.moveSource(config, sourceIndex, -1);
		});

		const moveDownBtn = actionsWrap.createEl('button', {
			text: '↓',
			cls: 'parallel-notes-btn parallel-notes-btn-icon',
		});
		moveDownBtn.disabled = sourceIndex === config.sources.length - 1;
		moveDownBtn.addEventListener('click', () => {
			void this.moveSource(config, sourceIndex, 1);
		});

		// Delete button
		const deleteBtn = actionsWrap.createEl('button', {
			text: '×',
			cls: 'parallel-notes-btn parallel-notes-btn-icon parallel-notes-btn-danger',
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

	private async moveSource(
		config: CalendarViewConfig,
		sourceIndex: number,
		direction: -1 | 1,
	): Promise<void> {
		const targetIndex = sourceIndex + direction;
		if (targetIndex < 0 || targetIndex >= config.sources.length) {
			return;
		}

		const [source] = config.sources.splice(sourceIndex, 1);
		if (!source) {
			return;
		}

		config.sources.splice(targetIndex, 0, source);
		await this.plugin.saveSettings();
		this.update();
	}
}
