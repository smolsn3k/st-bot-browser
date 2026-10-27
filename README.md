# Bot Browser

A SillyTavern extension for browsing your characters like a website (think JanitorAI): see each bot's creator's notes at a glance, filter by tags, sort, and search, without opening every card one by one. Works on desktop and mobile.

## Features

- **Creator's notes on every card**: the beginning is shown, with Show more / Show less per card, and Expand all / Collapse all for the whole list
- **Show more on the card, Show less on top**: Show more is at the bottom of a collapsed card. Once expanded, Show less moves to the card header, which sticks to the top while you scroll through long notes, so you never have to scroll down to collapse it
- **Search** across names, creator's notes and tags
- **Tag filters with exclude**: open **Tags**, choose **Include** or **Exclude** at the top of the panel, then tap tags. Included tags must all be present, excluded tags (red, −) must be absent. Tags are sorted by how many bots use them, with a "find a tag" box. Tapping a tag on a card cycles include, exclude, off
- **Sorting**: newest first, oldest first, A to Z, Z to A, recently chatted
- **Favorites**: tap the star on any card, then switch to the **Favorites** tab (with a count) to see only those bots. Search, tag filters and sorting work there too
- **Surprise me**: type how many bots you want (the number is required) and tap **Surprise me** to get that many random bots. It picks from the bots that match your selected tags (included and excluded), or from all bots if no tags are selected. Search text and the Favorites tab still apply, so on the Favorites tab you get random favorites. If fewer bots match than you asked for, you get all of them. **Shuffle again** rerolls, **Show all** returns to the normal list, and changing any filter also does
- **Open chat** straight from a card (button or avatar)
- **Settings (gear icon)**:
  - **Language**: Auto, English or Русский
  - **Opacity**: make the window see-through (20% to 100%)
  - **Sync favorites**: off = favorites are saved only in this browser; on = saved in your SillyTavern settings and shared across devices. Turning it on merges this browser's favorites into the synced list; turning it off keeps a copy in this browser
- **Follows your SillyTavern theme**: search bars, dropdowns and buttons use the theme colors
- **Responsive**: multi-column grid on desktop, single-column full-screen layout on phones with large touch targets
- **Fast with big libraries**: cards load in batches as you scroll

## Installation

Install it with SillyTavern's built-in extension installer:

1. In SillyTavern, open the **Extensions** panel (the stacked-blocks icon in the top bar).
2. Click **Install extension**.
3. Paste this URL and confirm:

   ```
   https://github.com/smolsn3k/st-bot-browser
   ```

4. Reload the page if SillyTavern doesn't do it for you.

To update later, open **Extensions → Manage extensions** and click the update button next to Bot Browser, or use **Update all**.

## Usage

Open the browser with either:

- the grid icon next to the group-chats button in the character list, or
- **Bot Browser** in the wand (extensions) menu.

Press **Esc**, tap the X, or click outside the window to close it.

## Notes

- Creator's notes are shown as plain text: HTML is stripped, and markdown is not rendered.
- "Newest" and "Oldest" use the date SillyTavern stores for each character. Some imported bots may not have one, in which case they are ordered by their position in the list.
- Settings (sort order, language, opacity, the sync switch) are stored in your browser's local storage. Synced favorites are stored under `bot_browser` in SillyTavern's extension settings and are keyed by the character's avatar filename.
- If the list icon doesn't appear on your SillyTavern version, use the wand menu entry instead.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension metadata |
| `index.js` | Logic: data, filters, rendering, translations, entry points |
| `style.css` | Styling (uses SillyTavern theme colors) |
