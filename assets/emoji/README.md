# Emoji picker metadata

`catalog.json` contains categories, Unicode search characters, descriptions, aliases, and search tags from [GitHub's gemoji database](https://github.com/github/gemoji/blob/ee6e06c648e85d601756b573d356327d4e51031d/db/emoji.json), under the accompanying MIT [LICENSE](LICENSE).

The picker loads this bundled file on demand and matches it against the existing GitHub emoji API response. Aliases share a tile; GitHub-specific entries appear in their own category. Search runs locally. Images continue to load from the URLs returned by GitHub. Only images near the visible rows are requested, and tiles are reused across category and search changes while the picker is open. A neutral shimmer stays visible until each image is decoded; native emoji are not used as temporary images.

Skin-tone variants use the existing JoyPixels runtime and visual-settings adapter to match the document preview's supported aliases and tone rules. The picker loads that runtime on demand when a non-default tone is selected. Artwork continues to use GitHub image URLs; the bundled metadata and inserted shortcodes are unchanged. If a tone variant's image fails to load, the final fallback is a native emoji in that tone. It is never displayed ahead of a pending image.

To refresh the pinned source, update the revision in `scripts/update-emoji-catalog.mjs` and run `node scripts/update-emoji-catalog.mjs`. Normal builds do not download or regenerate this data.
