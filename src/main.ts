import { Notice, Plugin, TFile } from 'obsidian';
import type { CoNotesSettings, CalendarViewConfig } from './types';
import { DEFAULT_SETTINGS, CoNotesSettingTab } from './settings';
import { CALENDAR_VIEW_TYPE, CalendarView } from './views/CalendarView';
import { resolveLanguage, t, type ResolvedLanguage } from './i18n';
import { extractDateFromPath, getFilePath } from './utils/dateUtils';
import {
	DEFAULT_DAY_CELL_MIN_HEIGHT,
	DEFAULT_SOURCE_INDICATOR_HEIGHT,
	normalizeDayCellMinHeight,
	normalizeSourceIndicatorHeight,
} from './types';

export default class CoNotesPlugin extends Plugin {
	settings: CoNotesSettings;
	lastActiveFilePath: string | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.lastActiveFilePath = this.app.workspace.getActiveFile()?.path ?? null;

		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file) {
					this.lastActiveFilePath = file.path;
				}
			}),
		);

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				const file = this.app.workspace.getActiveFile();
				if (file) {
					this.lastActiveFilePath = file.path;
				}
			}),
		);

		this.registerView(
			CALENDAR_VIEW_TYPE,
			(leaf) => new CalendarView(leaf, this),
		);

		this.addSettingTab(new CoNotesSettingTab(this.app, this));
		this.registerVaultRefreshEvents();

		this.registerCalendarCommands();
		this.registerNavigationCommands();

		this.addRibbonIcon('calendar', this.t('main.ribbonTooltip'), () => {
			const first = this.settings.calendarViews[0];
			if (first) {
				void this.openCalendarView(first.id);
			}
		});
	}

	onunload(): void {}

	private registerVaultRefreshEvents(): void {
		this.registerEvent(
			this.app.vault.on('create', () => {
				this.refreshAllCalendarViews();
			}),
		);
		this.registerEvent(
			this.app.vault.on('delete', () => {
				this.refreshAllCalendarViews();
			}),
		);
		this.registerEvent(
			this.app.vault.on('rename', () => {
				this.refreshAllCalendarViews();
			}),
		);
		// Refresh markers when a note's frontmatter changes
		this.registerEvent(
			this.app.metadataCache.on('changed', () => {
				this.refreshAllCalendarViews();
			}),
		);
	}

	private registerCalendarCommands(): void {
		for (const config of this.settings.calendarViews) {
			this.addCommand({
				id: `open-calendar-${config.id}`,
				name: this.t('main.openCalendarCommand', { name: config.name }),
				callback: () => {
					void this.openCalendarView(config.id);
				},
			});
		}
	}

	private registerNavigationCommands(): void {
		this.addCommand({
			id: 'go-to-previous-note',
			name: this.t('main.goToPreviousNote'),
			callback: () => {
				void this.navigateToAdjacentNote('prev');
			},
		});

		this.addCommand({
			id: 'go-to-next-note',
			name: this.t('main.goToNextNote'),
			callback: () => {
				void this.navigateToAdjacentNote('next');
			},
		});
	}

	async navigateToAdjacentNote(direction: 'prev' | 'next'): Promise<void> {
		// When the calendar view itself is focused, getActiveFile() returns null.
		// Fall back to the last opened file so navigation still works.
		let activeFile = this.app.workspace.getActiveFile();
		if (!activeFile && this.lastActiveFilePath) {
			const cached = this.app.vault.getAbstractFileByPath(this.lastActiveFilePath);
			if (cached instanceof TFile) {
				activeFile = cached;
			}
		}
		if (!activeFile) {
			new Notice(this.t('main.noActiveNote'));
			return;
		}

		const activeFilePath = activeFile.path;
		const date = extractDateFromPath(activeFilePath);
		if (!date) {
			new Notice(this.t('main.cannotParseDate'));
			return;
		}

		// Find the source that matches the current active note
		for (const config of this.settings.calendarViews) {
			for (const source of config.sources) {
				if (getFilePath(source.pathTemplate, date) !== activeFilePath) {
					continue;
				}

				const step = direction === 'prev' ? -1 : 1;
				const currentDate = new Date(date);

				// Search up to 365 days in the given direction
				for (let i = 0; i < 365; i++) {
					currentDate.setDate(currentDate.getDate() + step);
					const filePath = getFilePath(source.pathTemplate, currentDate);
					const file = this.app.vault.getAbstractFileByPath(filePath);
					if (file instanceof TFile) {
						// Open in a markdown leaf, not in the calendar view itself.
						let leaf = this.app.workspace.getMostRecentLeaf();
						if (!leaf || leaf.view.getViewType() === CALENDAR_VIEW_TYPE) {
							const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
							leaf = markdownLeaves.length > 0 ? markdownLeaves[0]! : this.app.workspace.getLeaf('tab');
						}
						await leaf.openFile(file, { active: true });
						await this.app.workspace.revealLeaf(leaf);
						this.lastActiveFilePath = file.path;
						// Sync calendar views to the month of the opened note
						for (const calLeaf of this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE)) {
							if (calLeaf.view instanceof CalendarView) {
								calLeaf.view.setMonth(currentDate.getFullYear(), currentDate.getMonth());
							}
						}
						return;
					}
				}

				new Notice(this.t('main.noMoreNotes'));
				return;
			}
		}

		new Notice(this.t('main.noteNotInAnySource'));
	}

	async openCalendarView(configId: string, newLeaf = false): Promise<void> {
		const leaf = this.app.workspace.getLeaf(newLeaf);
		await leaf.setViewState({
			type: CALENDAR_VIEW_TYPE,
			state: { configId },
		});
		void this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		const savedData: unknown = await this.loadData();
		const saved = isRecord(savedData) ? (savedData as Partial<CoNotesSettings>) : null;
		const migratedHeights = getMigratedGlobalHeights(saved?.calendarViews);
		this.settings = {
			...DEFAULT_SETTINGS,
			...migratedHeights,
			...(saved ?? {}),
			globalSourceIndicatorHeight: normalizeSourceIndicatorHeight(
				saved?.globalSourceIndicatorHeight ?? migratedHeights.globalSourceIndicatorHeight,
			),
			globalDayCellMinHeight: normalizeDayCellMinHeight(
				saved?.globalDayCellMinHeight ?? migratedHeights.globalDayCellMinHeight,
			),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshAllCalendarViews();
	}

	refreshAllCalendarViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE)) {
			if (leaf.view instanceof CalendarView) {
				leaf.view.refresh();
			}
		}
	}

	getLanguage(): ResolvedLanguage {
		return resolveLanguage(this.settings.language);
	}

	t(key: Parameters<typeof t>[1], vars?: Record<string, string>): string {
		return t(this.getLanguage(), key, vars);
	}
}

function getMigratedGlobalHeights(
	calendarViews: CalendarViewConfig[] | undefined,
): Pick<CoNotesSettings, 'globalSourceIndicatorHeight' | 'globalDayCellMinHeight'> {
	const firstSourceIndicatorHeight = calendarViews?.find(
		(view) => typeof view.sourceIndicatorHeight === 'number',
	)?.sourceIndicatorHeight;
	const firstDayCellMinHeight = calendarViews?.find(
		(view) => typeof view.dayCellMinHeight === 'number',
	)?.dayCellMinHeight;

	return {
		globalSourceIndicatorHeight: normalizeSourceIndicatorHeight(
			firstSourceIndicatorHeight ?? DEFAULT_SOURCE_INDICATOR_HEIGHT,
		),
		globalDayCellMinHeight: normalizeDayCellMinHeight(
			firstDayCellMinHeight ?? DEFAULT_DAY_CELL_MIN_HEIGHT,
		),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
