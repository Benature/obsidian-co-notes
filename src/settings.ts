import { App, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type CoNotesPlugin from './main';
import { resolveLanguage, t } from './i18n';
import {
	CoNotesSettings,
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

export type { CoNotesSettings };

const MARKER_SYMBOL_PRESETS = ['✓', '✅', '⭐', '🔥', '❤️', '📌', '🎯', '💡', '🏆', '❗', '☑️', '✔️'];

export const DEFAULT_SETTINGS: CoNotesSettings = {
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
					setting.settingEl.addClass('co-notes-settings-custom');
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

		// ── Sources ───────────────────────────────────────────────────────────
		card.createDiv({
			text: tr('settings.noteSources'),
			cls: 'co-notes-settings-section-title',
		});

		const sourcesContainer = card.createDiv('co-notes-settings-sources');
		for (let j = 0; j < config.sources.length; j++) {
			const source = config.sources[j];
			if (source) {
				this.renderSourceConfig(sourcesContainer, config, source, j);
			}
		}

		const addSourceBtn = card.createEl('button', {
			text: tr('settings.addSource'),
			cls: 'co-notes-btn co-notes-btn-secondary',
		});
		addSourceBtn.addEventListener('click', () => {
			void this.addSource(config);
		});

		// ── Optional weekly / monthly sources ─────────────────────────────────
		this.renderOptionalSourceConfig(
			card,
			config,
			'weeklySource',
			'settings.weeklySource',
			'settings.weeklySourceHint',
			'weekly/{GGGG}/{GGGG}-W{WW}',
		);
		this.renderOptionalSourceConfig(
			card,
			config,
			'monthlySource',
			'settings.monthlySource',
			'settings.monthlySourceHint',
			'monthly/{YYYY}/{YYYY}-{MM}',
		);
	}

	private renderOptionalSourceConfig(
		container: HTMLElement,
		config: CalendarViewConfig,
		key: 'weeklySource' | 'monthlySource',
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

		const source = config[key];
		if (!source) {
			const addBtn = section.createEl('button', {
				text: `+ ${tr(labelKey)}`,
				cls: 'co-notes-btn co-notes-btn-secondary',
			});
			addBtn.addEventListener('click', () => {
				config[key] = {
					id: generateId(),
					name: tr(labelKey),
					pathTemplate: defaultPath,
					color: key === 'weeklySource' ? '#845ef7' : '#20c997',
				};
				void this.plugin.saveSettings().then(() => this.update());
			});
			section.createDiv({ text: tr(hintKey), cls: 'co-notes-field-hint' });
			return;
		}

		const row = section.createDiv('co-notes-settings-source-item');

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
			delete config[key];
			void this.plugin.saveSettings().then(() => this.update());
		});

		section.createDiv({ text: tr(hintKey), cls: 'co-notes-field-hint' });
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

		const moveUpBtn = actionsWrap.createEl('button', {
			text: '↑',
			cls: 'co-notes-btn co-notes-btn-icon',
		});
		moveUpBtn.disabled = sourceIndex === 0;
		moveUpBtn.addEventListener('click', () => {
			void this.moveSource(config, sourceIndex, -1);
		});

		const moveDownBtn = actionsWrap.createEl('button', {
			text: '↓',
			cls: 'co-notes-btn co-notes-btn-icon',
		});
		moveDownBtn.disabled = sourceIndex === config.sources.length - 1;
		moveDownBtn.addEventListener('click', () => {
			void this.moveSource(config, sourceIndex, 1);
		});

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
