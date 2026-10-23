# Welcome to Linked Workspace

**Work on Markdown files already on your computer, without moving them.** A link is a shortcut to an existing file or folder, not a new copy.

## Start in three steps

1. **Link:** In Explorer, open the menu beside **Linked Workspace**. Choose **Link file** for one or more Markdown files, or **Link folder** to include Markdown files in a folder and its subfolders.
2. **Edit:** Click a file in the sidebar. Your work is kept as a local recovery draft in the app.
3. **Save:** Press **Ctrl+S** (or **Cmd+S** on Mac) to update the original file.

```text
Your file on disk
       |
      Link
       v
Edit in Markdown Viewer
       |
      Save
       v
Your file on disk is updated
```

> Editing keeps a draft. **Only Save updates the linked original.** Closing a tab does not remove its link.

## Link or import?

| You want to... | Choose |
| --- | --- |
| Work on the original file where it already lives | **Link file** or **Link folder** in Linked Workspace |
| Work on a separate copy inside the app | **+ > From files** (or drag a file into the app) |
| Start a new document inside the app | **+ > New document** |

The app's regular **Workspace**, also called the **Vault**, holds independent documents. Linked Workspace points to originals outside it. Hover over a linked file to see its location on your computer.

## Everyday actions

Right-click a linked file or folder to see its actions.

| Action | What happens |
| --- | --- |
| **Save As** | Creates another file and link. Leaves the previous original unchanged. |
| **Remove linked file / folder** | Removes the link from the app. Does **not** delete the original. |
| **Convert to Workspace copy** | Keeps an independent copy of your draft in the Vault. Leaves the original unchanged. |
| **Rescan folder** | Finds new files and restores removed or converted links whose originals still exist. |
| **Reload from disk** | Replaces your draft with the original file. Asks before discarding unsaved changes. |

**Group your links:** Right-click a linked folder and choose **Link file** or **Link folder**. This only groups links in the sidebar; it never moves originals. Grouping is remembered when you reopen the app. If you remove the parent folder's link, separately added links remain available outside that group.

## See a warning?

Hover over the warning icon for details. If another app changed the original, your draft is kept. Choose **Reload from disk** to use the disk version, or **Save** to keep your edits after confirming. If the original is missing or unavailable, use **Save As** to keep your work in a new file.

> Keep backups of important originals. Workspace backups keep recovery drafts; they are not a backup of every external file.

<details>
<summary>More about folders, copies, and recovery</summary>

- **Folder copies:** Convert a linked folder or drag it into the Vault to copy its current drafts and subfolders. Previously removed links are not included. Converting the whole folder removes its link; converting a subfolder keeps the parent linked. Reopening an original never replaces its independent Vault copy.
- **Export a Vault folder:** **Save As linked folder...** creates a new external folder and link. The Vault copy stays unchanged. Existing destination names get a copy suffix. Only Markdown documents are exported, not images or other assets.
- **Interrupted operations:** Folder copies and exports are not all-or-nothing. A partial completion message means some files were copied; completed copies and remaining drafts are kept. Read the destination in the message before retrying.
- **Removed links:** Background refreshes respect removals, even when linked folders overlap. **Rescan folder** or linking the same folder again can restore those links.
- **Recovery:** The app stores recovery drafts separately from originals. Do not reorganize this internal storage manually. Restoring a backup recovers drafts without reconnecting their original paths. Link the originals explicitly to reconnect.
- **Secret Workspace:** Convert a linked file to a Vault copy before moving that copy into Secret Workspace.

</details>

This guide opens in Split view: edit on one side, read on the other. It is an editable guide inside the app, not an external file. You can edit or delete it without affecting your originals.
