import { App, Modal, Setting } from 'obsidian';
import type CoNotesPlugin from '../main';
import type { NoteSource } from '../types';
import type { SourcePeriodKey } from '../utils/sourceCategories';

const MARKER_SYMBOL_PRESETS = ['✓', '✅', '⭐', '🔥', '❤️', '📌', '🎯', '💡', '🏆', '❗', '☑️', '✔️'];

export class SourceConfigModal extends Modal {
	private readonly plugin: CoNotesPlugin;
	private readonly source: NoteSource;
	private readonly period: SourcePeriodKey;
	private readonly onSave: () => Promise<void>;

	constructor(
		app: App,
		plugin: CoNotesPlugin,
		source: NoteSource,
		period: SourcePeriodKey,
		onSave: () => Promise<void>,
	) {
		super(app);
		this.plugin = plugin;
		this.source = source;
		this.period = period;
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('co-notes-source-config-modal');
		const tr = this.plugin.t.bind(this.plugin);
		contentEl.createEl('h3', { text: tr('settings.sourceDetails') });

		let pathTemplate = this.source.pathTemplate;
		let checkboxProperty = this.source.checkboxProperty ?? '';
		let markerSymbol = this.source.markerSymbol ?? '';

		new Setting(contentEl).setName(tr('settings.pathTemplate')).addText((text) => {
			text.setValue(pathTemplate)
				.setPlaceholder(getDefaultPath(this.period))
				.onChange((value) => {
					pathTemplate = value;
				});
			text.inputEl.addClass('co-notes-source-detail-path');
		});

		new Setting(contentEl).setName(tr('settings.checkboxProperty')).addText((text) => {
			text.setValue(checkboxProperty)
				.setPlaceholder(tr('settings.checkboxPropertyPlaceholder'))
				.onChange((value) => {
					checkboxProperty = value;
				});
		});

		new Setting(contentEl).setName(tr('settings.markerSymbol')).addDropdown((dropdown) => {
			const symbols = markerSymbol && !MARKER_SYMBOL_PRESETS.includes(markerSymbol)
				? [markerSymbol, ...MARKER_SYMBOL_PRESETS]
				: MARKER_SYMBOL_PRESETS;
			dropdown.addOption('', tr('settings.markerSymbolDefault'));
			for (const symbol of symbols) dropdown.addOption(symbol, symbol);
			dropdown.setValue(markerSymbol).onChange((value) => {
				markerSymbol = value;
			});
		});

		new Setting(contentEl).addButton((button) => {
			button.setButtonText(tr('settings.save')).setCta().onClick(() => {
				this.source.pathTemplate = pathTemplate;
				this.source.checkboxProperty = checkboxProperty.trim() || undefined;
				this.source.markerSymbol = markerSymbol || undefined;
				void this.onSave().then(() => this.close());
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function getDefaultPath(period: SourcePeriodKey): string {
	if (period === 'weeklySources') return 'weekly/{GGGG}/{GGGG}-W{WW}';
	if (period === 'monthlySources') return 'monthly/{YYYY}/{YYYY}-{MM}';
	return 'daily/{YYYY}/{MM}/{YYYY-MM-DD}';
}
