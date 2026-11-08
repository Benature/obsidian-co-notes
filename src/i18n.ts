import { getLanguage } from 'obsidian';
import type { ParallelNotesLanguage } from './types';

export type ResolvedLanguage = 'zh-CN' | 'en';

type TranslationKey =
	| 'main.ribbonTooltip'
	| 'main.openCalendarCommand'
	| 'main.goToPreviousNote'
	| 'main.goToNextNote'
	| 'main.noActiveNote'
	| 'main.cannotParseDate'
	| 'main.noMoreNotes'
	| 'main.noteNotInAnySource'
	| 'settings.calendarViewsHeading'
	| 'settings.language.name'
	| 'settings.language.desc'
	| 'settings.language.option.system'
	| 'settings.language.option.zh-CN'
	| 'settings.language.option.en'
	| 'settings.confirmBeforeCreate.name'
	| 'settings.confirmBeforeCreate.desc'
	| 'settings.sourceIndicatorHeight.name'
	| 'settings.sourceIndicatorHeight.desc'
	| 'settings.dayCellMinHeight.name'
	| 'settings.dayCellMinHeight.desc'
	| 'settings.calendarViewsDesc'
	| 'settings.addCalendarView'
	| 'settings.pathTemplateHint'
	| 'settings.newCalendarView'
	| 'settings.newSource'
	| 'settings.viewName'
	| 'settings.openView'
	| 'settings.delete'
	| 'settings.noteSources'
	| 'settings.addSource'
	| 'settings.sourceName'
	| 'settings.pathTemplate'
	| 'settings.pathTemplatePlaceholder'
	| 'settings.checkboxProperty'
	| 'settings.checkboxPropertyPlaceholder'
	| 'settings.markerSymbol'
	| 'settings.markerSymbolDefault'
	| 'calendar.defaultTitle'
	| 'calendar.configMissing'
	| 'calendar.today'
	| 'calendar.missingNoteSuffix'
	| 'calendar.createNoteFailed'
	| 'calendar.confirmCreateTitle'
	| 'calendar.confirmCreateDesc'
	| 'calendar.cancel'
	| 'calendar.create'
	| 'calendar.previousNote'
	| 'calendar.nextNote'
	| 'calendar.weekHeader'
	| 'calendar.yearView'
	| 'calendar.monthView'
	| 'settings.weeklySource'
	| 'settings.monthlySource'
	| 'settings.weeklySourceHint'
	| 'settings.monthlySourceHint';

const translations: Record<ResolvedLanguage, Record<TranslationKey, string>> = {
	'zh-CN': {
		'main.ribbonTooltip': 'Parallel Notes 日历',
		'main.openCalendarCommand': '打开日历：{{name}}',
		'main.goToPreviousNote': '跳转到上一篇日历笔记',
		'main.goToNextNote': '跳转到下一篇日历笔记',
		'main.noActiveNote': '当前没有打开的笔记。',
		'main.cannotParseDate': '无法从当前笔记路径中解析日期。',
		'main.noMoreNotes': '该方向上没有更多已创建的笔记。',
		'main.noteNotInAnySource': '当前笔记不属于任何日历来源。',
		'settings.calendarViewsHeading': '日历视图',
		'settings.language.name': '语言',
		'settings.language.desc': '设置插件界面的显示语言。',
		'settings.language.option.system': '跟随系统',
		'settings.language.option.zh-CN': '中文',
		'settings.language.option.en': 'English',
		'settings.confirmBeforeCreate.name': '创建笔记前确认',
		'settings.confirmBeforeCreate.desc': '点击缺失笔记时，先确认是否创建。',
		'settings.sourceIndicatorHeight.name': '来源格高度',
		'settings.sourceIndicatorHeight.desc':
			'设置所有日历视图里每个笔记来源小格的高度（像素）。',
		'settings.dayCellMinHeight.name': '日期格最低高度',
		'settings.dayCellMinHeight.desc':
			'设置所有日历视图中每天那个大格子的最低高度（像素）。',
		'settings.calendarViewsDesc': '配置日历视图及每个视图的笔记来源。',
		'settings.addCalendarView': '+ 添加日历视图',
		'settings.pathTemplateHint':
			'路径模板只解析花括号内的 moment 风格格式，例如 {YYYY}、{MM}、{DD}、{ddd}。花括号外的文本会原样保留，并会自动补上 .md 后缀。',
		'settings.newCalendarView': '新日历视图',
		'settings.newSource': '来源 {{label}}',
		'settings.viewName': '视图名称',
		'settings.openView': '打开视图',
		'settings.delete': '删除',
		'settings.noteSources': '笔记来源',
		'settings.addSource': '+ 添加笔记来源',
		'settings.sourceName': '名称',
		'settings.pathTemplate': '路径模板',
		'settings.pathTemplatePlaceholder': '例如：daily/{YYYY}/{MM}/{YYYY-MM-DD}_{ddd}',
		'settings.checkboxProperty': 'Checkbox 属性',
		'settings.checkboxPropertyPlaceholder': '例如：done（留空则不标记）',
		'settings.markerSymbol': '标记符号',
		'settings.markerSymbolDefault': '默认 (✓)',
		'calendar.defaultTitle': '日历',
		'calendar.configMissing': '未找到日历配置，请在插件设置中检查。',
		'calendar.today': '今天',
		'calendar.missingNoteSuffix': '（未创建）',
		'calendar.createNoteFailed': '创建笔记失败：{{path}}',
		'calendar.confirmCreateTitle': '创建笔记？',
		'calendar.confirmCreateDesc': '目标文件不存在，是否创建并打开？',
		'calendar.cancel': '取消',
		'calendar.create': '创建',
		'calendar.previousNote': '上一篇笔记',
		'calendar.nextNote': '下一篇笔记',
		'calendar.weekHeader': '周',
		'calendar.yearView': '年历',
		'calendar.monthView': '月历',
		'settings.weeklySource': '周记来源',
		'settings.monthlySource': '月记来源',
		'settings.weeklySourceHint': '在月历每周行左侧显示，路径模板可用 {WW} 等周格式。',
		'settings.monthlySourceHint': '在年历视图中显示，路径模板可用 {YYYY}、{MM}。',
	},
	en: {
		'main.ribbonTooltip': 'Parallel Notes calendar',
		'main.openCalendarCommand': 'Open calendar: {{name}}',
		'main.goToPreviousNote': 'Go to previous calendar note',
		'main.goToNextNote': 'Go to next calendar note',
		'main.noActiveNote': 'No active note.',
		'main.cannotParseDate': 'Cannot parse a date from the current note path.',
		'main.noMoreNotes': 'No more existing notes in that direction.',
		'main.noteNotInAnySource': 'The current note does not belong to any calendar source.',
		'settings.calendarViewsHeading': 'Calendar views',
		'settings.language.name': 'Language',
		'settings.language.desc': 'Choose which language the plugin UI uses.',
		'settings.language.option.system': 'Follow system',
		'settings.language.option.zh-CN': 'Chinese',
		'settings.language.option.en': 'English',
		'settings.confirmBeforeCreate.name': 'Create note confirmation',
		'settings.confirmBeforeCreate.desc':
			'Ask for confirmation before creating a missing note.',
		'settings.sourceIndicatorHeight.name': 'Source cell height',
		'settings.sourceIndicatorHeight.desc':
			'Set the height of each source indicator cell in all calendar views (px).',
		'settings.dayCellMinHeight.name': 'Day cell minimum height',
		'settings.dayCellMinHeight.desc':
			'Set the minimum height of each day cell in all calendar views (px).',
		'settings.calendarViewsDesc':
			'Configure calendar views and the note sources shown in each view.',
		'settings.addCalendarView': '+ Add calendar view',
		'settings.pathTemplateHint':
			'Only moment-style formats inside braces are parsed, such as {YYYY}, {MM}, {DD}, and {ddd}. Text outside braces is kept as-is, and .md is appended automatically.',
		'settings.newCalendarView': 'New calendar view',
		'settings.newSource': 'Source {{label}}',
		'settings.viewName': 'View name',
		'settings.openView': 'Open view',
		'settings.delete': 'Delete',
		'settings.noteSources': 'Note sources',
		'settings.addSource': '+ Add note source',
		'settings.sourceName': 'Name',
		'settings.pathTemplate': 'Path template',
		'settings.pathTemplatePlaceholder': 'e.g. daily/{YYYY}/{MM}/{YYYY-MM-DD}_{ddd}',
		'settings.checkboxProperty': 'Checkbox property',
		'settings.checkboxPropertyPlaceholder': 'e.g. done (empty to disable)',
		'settings.markerSymbol': 'Marker symbol',
		'settings.markerSymbolDefault': 'Default (✓)',
		'calendar.defaultTitle': 'Calendar',
		'calendar.configMissing': 'Calendar config not found. Check the plugin settings.',
		'calendar.today': 'Today',
		'calendar.missingNoteSuffix': ' (missing)',
		'calendar.createNoteFailed': 'Failed to create note: {{path}}',
		'calendar.confirmCreateTitle': 'Create note?',
		'calendar.confirmCreateDesc': 'The target file does not exist. Create and open it?',
		'calendar.cancel': 'Cancel',
		'calendar.create': 'Create',
		'calendar.previousNote': 'Previous note',
		'calendar.nextNote': 'Next note',
		'calendar.weekHeader': 'W',
		'calendar.yearView': 'Year',
		'calendar.monthView': 'Month',
		'settings.weeklySource': 'Weekly note source',
		'settings.monthlySource': 'Monthly note source',
		'settings.weeklySourceHint': 'Shown in a left column of each week row. Week tokens like {WW} are supported.',
		'settings.monthlySourceHint': 'Shown in the year view. Tokens like {YYYY} and {MM} are supported.',
	},
};

const WEEKDAY_LABELS: Record<ResolvedLanguage, string[]> = {
	'zh-CN': ['日', '一', '二', '三', '四', '五', '六'],
	en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const MONTH_LABELS: Record<ResolvedLanguage, string[]> = {
	'zh-CN': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
	en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export function resolveLanguage(language: ParallelNotesLanguage): ResolvedLanguage {
	if (language === 'zh-CN' || language === 'en') {
		return language;
	}

	const obsidianLanguage = getLanguage();
	const browserLanguage = typeof navigator !== 'undefined' ? navigator.language : '';
	return normalizeLanguage(obsidianLanguage) ?? normalizeLanguage(browserLanguage) ?? 'en';
}

export function getWeekdayLabels(language: ResolvedLanguage): string[] {
	return WEEKDAY_LABELS[language];
}

export function getMonthLabels(language: ResolvedLanguage): string[] {
	return MONTH_LABELS[language];
}

export function formatMonthLabel(date: Date, language: ResolvedLanguage): string {
	const locale = language === 'zh-CN' ? 'zh-CN' : 'en-US';
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		year: 'numeric',
	}).format(date);
}

export function t(
	language: ResolvedLanguage,
	key: TranslationKey,
	vars?: Record<string, string>,
): string {
	const template = translations[language][key];
	if (!vars) {
		return template;
	}

	return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? '');
}

function normalizeLanguage(value: string | null | undefined): ResolvedLanguage | null {
	if (!value) {
		return null;
	}

	return value.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}
