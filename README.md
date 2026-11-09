# Co Notes

[English](./README.md) | [中文](./README.zh-CN.md)

`Co Notes` is an Obsidian plugin that lets you visualize notes from multiple folders on a calendar.

Instead of being limited to a single daily note location, you can define multiple note sources, group them into different calendar views, and see at a glance which notes already exist for each day. Clicking a source indicator opens the note if it exists, or creates it if it does not.

## Features

- Multiple calendar views for different workflows
- Multiple note sources per view
- Color-coded source indicators
- Support for notes stored across different folders
- Click to open existing notes or create missing notes
- Configurable note path templates with brace-wrapped moment-style date formats
- Adjustable source indicator height and day cell minimum height
- Chinese and English UI support

## How it works

Each calendar view contains one or more note sources.

Each source has:

- A name
- A color
- A path template

For every day in the month, Co Notes checks whether the note for each source exists. If it exists, the source indicator is filled with the configured color. If it is missing, the indicator stays empty. Clicking the indicator opens the note or creates it for you.

## Example use cases

- Track personal and work daily notes in separate folders
- Compare notes from multiple journals in one calendar
- Build different calendar views for different projects or time horizons
- Keep parallel note systems without changing your folder structure

## Path templates

Path templates parse only moment-style date formats inside braces, such as `{YYYY}`, `{MM}`, `{DD}`, `{ddd}`, and `{dddd}`. Formats can also be combined within one pair of braces, such as `{YYYY-MM-DD}`.

Examples:

- `daily/{YYYY}/{MM}/{YYYY-MM-DD}`
- `work-log/{YYYY}/{YYYY-MM-DD}`
- `journal/{YYYY}/{MM}/{YYYY-MM-DD}_{ddd}`

Co Notes keeps normal path text outside braces as-is, so the `ss` in `business/{YYYY-MM-DD}` is not parsed as seconds. It automatically appends `.md` if it is missing.

## Usage

1. Open **Settings -> Community plugins -> Co Notes**.
2. Create or edit a calendar view.
3. Add one or more note sources to that view.
4. Set the path template for each source.
5. Open the view from the settings page, command palette, or ribbon icon.
6. Click any source indicator in the calendar to open or create the target note.

## Settings

Co Notes currently supports:

- Plugin UI language: system, Chinese, or English
- Confirm before creating a missing note
- Global source indicator height
- Global day cell minimum height
- Multiple calendar views
- Multiple note sources per calendar view

## Commands

Co Notes registers one command per calendar view:

- `Open calendar: <view name>`

This makes it easy to open specific views from the command palette.

## Installation for development

```bash
npm install
```

Start watch mode:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

## Manual installation

Copy the release files into:

```text
<your-vault>/.obsidian/plugins/co-notes/
```

Required files:

- `main.js`
- `manifest.json`
- `styles.css`

Then reload Obsidian and enable **Co Notes** in **Settings -> Community plugins**.

## Release notes

When publishing a new version:

1. Update `manifest.json`.
2. Update `versions.json`.
3. Create a GitHub release tagged with the exact plugin version, without a `v` prefix.
4. Upload `main.js`, `manifest.json`, and `styles.css` as release assets.

## License

`0-BSD`
