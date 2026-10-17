# Welcome to Linked Workspace

Linked Workspace lets you edit Markdown files where they already live on your computer.

## Link a file or folder

Use **Link Markdown files** or **Link Markdown folder** in the Explorer toolbar or the Linked Workspace menu. A linked folder includes Markdown files in its subfolders.

Right-click a linked folder or subfolder to add existing file or folder links inside it. This only groups links in the sidebar: originals stay in their current locations. Grouping survives reopening the app and does not change which source a folder scans. Removing or converting the parent source folder keeps independently grouped links available outside that group.

Dropping an external Markdown file imports an independent Vault copy. Use the explicit linking actions when you want to keep an original file linked.

Linked documents use a file-with-arrow icon; linked folders use a folder-with-arrow icon. Hover over a linked document to see its original path.

## Drafts and saving

Editing automatically stores a recovery draft inside the application's **Linked Workspace** storage folder. It does **not** automatically overwrite your original file.

Linked-folder recovery drafts mirror the source subfolders under a separate recovery root. ID suffixes distinguish roots and documents with identical names. These are internal recovery copies, not the original files; do not manually reorganize this storage.

- **Ctrl+S** or **Save** updates the original linked file.
- **Save As** creates a new external file and a separate link. The previous document and original remain unchanged.
- Saving a Vault document externally keeps its independent Vault copy and activates the new linked document.

The Save shortcut works across keyboard layouts, including Greek. Ordinary Save updates the original directly and reports success. Conflict and missing-original warnings still require confirmation.

## Independent Vault copies

**Convert to Workspace copy** turns a linked draft into an independent Vault document without changing the original. You can also drag a linked document into the Vault or one of its folders.

Linked documents cannot move directly into Secret Workspace. Convert to an independent Vault copy first, then move that copy into Secret Workspace.

Reopening the original creates or activates its link; it never replaces the independent Vault copy.

You can also **Convert to Workspace copy** on a linked folder or subfolder, or drag it into the Vault or one of its folders. This converts the currently linked drafts and preserves their subfolder structure. Excluded files are not included. A complete root conversion removes the folder link; a subfolder conversion keeps the root linked.

If a conversion stops partway through, completed copies remain in the Vault and the remaining drafts stay linked. The notification reports partial completion. Retrying uses the remembered destination when it is still available. Existing destination folders are not silently merged; a separate copy name is used when needed.

## Save a Vault folder externally

On a normal Vault folder, **Save As linked folder…** lets you choose an external parent directory. It creates a new folder inside that directory, preserves the subfolder structure, adds the new linked folder, and activates a linked copy. The Vault folder and documents remain independent and unchanged.

Existing destination names get a copy suffix rather than being overwritten. This exports Markdown documents, not a complete archive of images or other assets. If writing or linking stops partway through, the notification identifies the destination; partial external copies are kept, and Vault drafts remain available.

## External changes and rescanning

The application checks linked sources for external changes. If your local draft conflicts with a changed original, it keeps the draft and shows a warning.

Hover over the warning icon to see the source status. **Reload from disk** replaces your draft with the original and asks before discarding unsaved changes. Saving over a conflicting original also requires confirmation. If the original is missing or unreadable, your draft is retained; do not assume the source was deleted just because access failed.

**Rescan folder** discovers new files and restores links previously removed or converted, if the originals still exist. Re-linking the same folder does the same. Automatic background refreshes respect removed links instead of restoring them.

## Closing and removing

Closing a tab keeps its document in the workspace. **Remove linked file** or **Remove linked folder** removes links from the application, not the originals from disk.

## Backups and safety

Workspace backups include internal recovery drafts, not copies taken from external originals. Restoring a backup keeps linked drafts as recovered documents without reconnecting their original paths or enabling writes to those originals. Link originals explicitly when you want to reconnect them.

Multi-file conversion and external folder saving are not all-or-nothing operations. The application validates drafts and destinations and verifies writes, but the desktop filesystem APIs cannot make a whole folder write atomic or eliminate every race with another program. Keep backups of important originals, and review any incomplete-operation message before retrying.

This guide is an internal, editable document, not a link to an external file. You can delete it without deleting any source file; it will not reappear on every launch.
