# Music Search

An [Obsidian](https://obsidian.md) plugin that searches the [MusicBrainz](https://musicbrainz.org) database and creates structured notes for music releases.

## Features

- Search for albums, EPs, singles, and other releases by artist, title, or both
- Rich metadata: genres, tracklist, release date, cover art, MusicBrainz/Discogs/Wikipedia links
- Optionally downloads cover art locally to your vault
- Fully customisable note output via template variables, custom frontmatter fields, or a full template file

## Usage

Open the command palette and run **Search music release**, or click the music note ribbon icon. Type an artist name, album title, or both, then select a result from the list. The plugin fetches full release details and creates a note in your configured folder.

## Settings

| Setting | Description |
|---|---|
| Note destination folder | Where new notes are saved. Leave empty for the vault root. |
| Note file name template | Template for the note filename. Supports all `{{variables}}`. Default: `{{artist}} - {{title}}` |
| Tags | Comma-separated tags added to every note's frontmatter. |
| Album art folder | Folder to save downloaded cover images. When set, `{{coverUrl}}` and `{{coverEmbed}}` resolve to the local vault path instead of a remote URL. Leave empty to use remote URLs. |
| Open note after creation | Automatically open the newly created note. |
| Show cover art in search results | Display album artwork in the release picker. |

### Note Template

Two modes are available, selectable via the **Note Template** tab in settings:

**Custom Fields** — Extends the built-in default template with additional frontmatter fields. Each field can use `{{variables}}` in its value. This is the right choice if you just want to add a few extra properties.

**Template File** — Points to a Markdown file in your vault that is used as the full note template. All `{{variables}}` are substituted. Use this for complete control over note structure.

## Template Variables

| Variable | YAML type | Description |
|---|---|---|
| `{{title}}` | string | Album/release title |
| `{{artist}}` | string | Artist name(s) |
| `{{artistMbid}}` | string | Artist MusicBrainz ID |
| `{{year}}` | string | First release year (e.g. `"1997"`) |
| `{{date}}` | string | First release date (e.g. `1997-05-21`) |
| `{{trackCount}}` | number | Number of tracks |
| `{{trackList}}` | string | Formatted tracklist — use in the note body, not frontmatter |
| `{{genres}}` | string[] | Genres as a YAML list |
| `{{genresInline}}` | string | Genres as a comma-separated string |
| `{{coverUrl}}` | string | Cover art URL, or local vault path if art folder is configured |
| `{{coverEmbed}}` | string | Embedded cover art: `![[path]]` for local files, `![](url)` for remote — use in the note body, not frontmatter |
| `{{mbid}}` | string | MusicBrainz release group ID |
| `{{releaseGroupMbid}}` | string | MusicBrainz release group ID (alias for `{{mbid}}`) |
| `{{mbUrl}}` | string | MusicBrainz release group URL |
| `{{discogsUrl}}` | string | Discogs master release URL |
| `{{wikipediaUrl}}` | string | Wikipedia article URL |
| `{{releaseType}}` | string | Release type (Album, Single, EP, etc.) |
| `{{disambiguation}}` | string | Disambiguation comment |
| `{{tags}}` | string[] | Custom tags from settings |
| `{{DATE}}` | string | Current date in `YYYY-MM-DD` format |
| `{{DATE:FORMAT}}` | string | Current date in a custom format, e.g. `{{DATE:DD/MM/YYYY}}`. Tokens: `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` |

## Default Template

When no template file is set and no custom fields are configured, the plugin generates a note like this:

```markdown
---
tags: []
artist: Radiohead
title: OK Computer
genres:
  - alternative rock
  - art rock
album-art: "https://coverartarchive.org/..."
album-type: Album
track-count: 12
release-date: 1997-05-21
release-year: "1997"
disambiguation:
mbid: a7ccb528-da8a-11e8-b9e4-005056ad73f4
artist-mbid: a74b1b7f-71a5-4011-9441-d0b5e4122711
link-musicbrainz: "https://musicbrainz.org/release-group/..."
link-discogs: "https://www.discogs.com/master/..."
link-wikipedia: "https://en.wikipedia.org/wiki/OK_Computer"
---
![[Radiohead - OK Computer.jpg]]
## Tracklist

1. Airbag (4:44)
2. Paranoid Android (6:23)
...
```

## Data Sources

- **[MusicBrainz](https://musicbrainz.org)** — release metadata, genres, URL relations
- **[Cover Art Archive](https://coverartarchive.org)** — album artwork
- **[Wikidata](https://www.wikidata.org)** / **[Wikipedia](https://en.wikipedia.org)** — Wikipedia article links via Wikidata sitelinks

## Development

```sh
npm install
npm test
npm run build
```

Tests use [Jest](https://jestjs.io) with [ts-jest](https://kulshekhar.github.io/ts-jest/).

## License

AGPL-3.0. See [LICENSE](LICENSE).
