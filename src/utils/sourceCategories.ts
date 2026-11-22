import type { CalendarViewConfig, NoteCategory, NoteSource } from '../types';

export type SourcePeriodKey = 'sources' | 'weeklySources' | 'monthlySources';

export function getPeriodSources(
	config: CalendarViewConfig,
	key: SourcePeriodKey,
): NoteSource[] {
	return config[key] ?? [];
}

/** Add category metadata to legacy settings and keep denormalized source labels in sync. */
export function normalizeSourceCategories(config: CalendarViewConfig): CalendarViewConfig {
	const categories: NoteCategory[] = [];
	const categoriesById = new Map<string, NoteCategory>();

	for (const category of config.categories ?? []) {
		if (!categoriesById.has(category.id)) {
			categories.push(category);
			categoriesById.set(category.id, category);
		}
	}

	for (const key of ['sources', 'weeklySources', 'monthlySources'] as const) {
		for (const source of getPeriodSources(config, key)) {
			const categoryId = source.categoryId ?? source.id;
			let category = categoriesById.get(categoryId);
			if (!category) {
				category = { id: categoryId, name: source.name, color: source.color };
				categories.push(category);
				categoriesById.set(categoryId, category);
			}
			source.categoryId = category.id;
			source.name = category.name;
			source.color = category.color;
		}
	}

	config.categories = categories;
	return config;
}

export function findSourceCategory(
	config: CalendarViewConfig,
	source: NoteSource,
): NoteCategory | undefined {
	return config.categories?.find((category) => category.id === source.categoryId);
}

/** Apply one category order to every period so their calendar grids stay aligned. */
export function reorderSourcesByCategory(config: CalendarViewConfig): void {
	const categoryOrder = new Map(
		(config.categories ?? []).map((category, index) => [category.id, index]),
	);
	for (const key of ['sources', 'weeklySources', 'monthlySources'] as const) {
		config[key] = getPeriodSources(config, key)
			.map((source, index) => ({ source, index }))
			.sort((a, b) => {
				const categoryA = categoryOrder.get(a.source.categoryId ?? '') ?? Number.MAX_SAFE_INTEGER;
				const categoryB = categoryOrder.get(b.source.categoryId ?? '') ?? Number.MAX_SAFE_INTEGER;
				return categoryA - categoryB || a.index - b.index;
			})
			.map(({ source }) => source);
	}
}
