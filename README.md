# Bot Browser

A SillyTavern extension for browsing your characters like a website (think JanitorAI): see each bot's creator's notes at a glance, filter by tags, sort, and search, without opening every card one by one. Works on desktop and mobile.

## Features

- **Creator's notes on every card**: the beginning is shown, with Show more / Show less per card, and Expand all / Collapse all for the whole list
- **Search** across names, creator's notes and tags
- **Tag filters**: pick one or several tags (a bot must have all selected tags). Tags are sorted by how many bots use them, with a "find a tag" box. You can also click a tag on any card to filter by it
- **Sorting**: newest first, oldest first, A to Z, Z to A, recently chatted (your choice is remembered)
- **Open chat** straight from a card (button or avatar)
- **Responsive**: multi-column grid on desktop, single-column full-screen layout on phones with large touch targets
- **Fast with big libraries**: cards load in batches as you scroll

## Installation

1. Create a folder named `bot-browser` in your SillyTavern extensions directory:
   - Per user: `SillyTavern/data/<your-user>/extensions/` (usually `default-user`)
   - Or for all users: `SillyTavern/public/scripts/extensions/third-party/`
2. Put `manifest.json`, `index.js` and `style.css` inside it.
3. Restart SillyTavern and refresh the page.

## Usage

Open the browser with either:

- the grid icon next to the group-chats button in the character list, or
- **Bot Browser** in the wand (extensions) menu.

Press **Esc**, tap the X, or click outside the window to close it.

## Notes

- Creator's notes are shown as plain text: HTML is stripped, and markdown is not rendered.
- "Newest" and "Oldest" use the date SillyTavern stores for each character. Some imported bots may not have one, in which case they are ordered by their position in the list.
- Preferences (the sort order) are stored in your browser's local storage.
- If the list icon doesn't appear on your SillyTavern version, use the wand menu entry instead.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension metadata |
| `index.js` | Logic: data, filters, rendering, entry points |
| `style.css` | Styling (uses SillyTavern theme colors) |
