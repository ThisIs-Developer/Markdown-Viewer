# Changelog

All notable code changes to **Markdown Viewer** are documented here.
Non-code commits (documentation, planning, README-only updates) are excluded.

---

## v3.5.4

- **Description:** Preserved multiline `$$...$$` LaTeX blocks during markdown parsing to ensure complex MathJax equations render correctly. Added a custom markdown extension in both web and desktop scripts to tokenize and retain display math as atomic units, preventing unwanted line-breaks inside equations.
- **Date:** 2026-05-15
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/e23425aa39064f108963a111793d621b5eb2cd50

---

## v3.5.3

- **Description:** Added automated UI testing skill to improve reliability of Markdown Viewer interface validation.
- **Date:** 2026-05-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/32489532e60d2b6e0b27b58d1d25b3c95b509701

---

## v3.5.2

- **Description:** Repositioned the RTL/LTR direction toggle button and improved its behavior so it only affects the editor and preview panes, not the full page.
- **Date:** 2026-05-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/121ceef5a06fb9b359185c95090da7b0c4b8146a

---

## v3.5.1

- **Description:** Introduced testing skill definitions for Markdown Viewer UI features to support automated test coverage.
- **Date:** 2026-05-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/25b5d20d414d02343ea65c2df67b92ecbecfbc4b

---

## v3.5.0

- **Description:** Moved the RTL/LTR toggle from the header toolbar to the formatting toolbar, next to the Align Right button. Changed the label to show L or R text instead of an icon, and scoped direction changes to only the editor and preview area.
- **Date:** 2026-05-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/32a0a3e08d1b2c4833cc249ada28e6e12195bcac

---

## v3.4.12

- **Description:** Added text alignment toolbar buttons (left, center, right, justify) and improved rendering of GitHub-style alert blocks.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/d2071b33f1bac39b5d8a0df532909ec3b3b8cc3a

---

## v3.4.10

- **Description:** Fixed an edge case where inserting alignment markup would fail silently on invalid values — now skips gracefully.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/85e5d364f3472147a4afdbc2c43d349f35465674

---

## v3.4.9

- **Description:** Added a warning when an unexpected alignment value is encountered during markdown processing.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/3268d7d333ef41e458996244ea0672bfd37b3b11

---

## v3.4.8

- **Description:** Renamed the GitHub alert marker regular expression internally for improved code clarity.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/dd0d1148c57f37816f8ce7078307ba63981aba7d

---

## v3.4.7

- **Description:** Tightened the regex pattern used to match GitHub-style alert markers to reduce false positives.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/c3c9dc54a58c3d8e2e61b9ff653bb611b2931b87

---

## v3.4.6

- **Description:** Hardened the alignment insertion logic and renamed the alert regex for consistency.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/61e994ee4cc14650ffc46e7dac4334547ac1b757

---

## v3.4.5

- **Description:** Added alignment toolbar actions and fixed alert block parsing to correctly identify GitHub-style callouts.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/deb480d8a4d0ff72b52d97522b913abdde96e86e

---

## v3.4.4

- **Description:** Fixed preview rendering of line breaks and added wrap-aware line numbers to the editor panel.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/d53a414c4e3776f975d147372d4482792641f6b7

---

## v3.4.3

- **Description:** Optimised line number rendering performance — updates now run more efficiently on large documents.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ab3839f119cbd75da7d22473a49c77b600ae139f

---

## v3.4.2

- **Description:** Removed a redundant line number width recalculation call that was causing unnecessary reflows.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/0d85b187c96efc56a5fa41bdf99f2b5a11717ae4

---

## v3.4.1

- **Description:** Clarified internal constants used for line number gutter sizing, improving code readability.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4ec2f29ef0cc60ca178055f3a7229944d83237df

---

## v3.4.0

- **Description:** Fixed preview line breaks that were rendering incorrectly and added persistent line numbers to the editor with wrap-aware positioning.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4224079bd3c332b0eae0fc7fead05b4dc9b27d94

---

## v3.3.12

- **Description:** Overhauled the toolbar and view system with an improved UI layout, better modal handling, and a more consistent editing experience.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a525ffe149f8eb64c5c2729213e00084854016b5

---

## v3.3.11

- **Description:** Fixed the sync scroll toggle to remain visible across all view modes — editor, preview, and split.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/d0ce2c119c51e1dfa42c4314701d58a8bbd56c3c

---

## v3.3.10

- **Description:** Synced desktop app resource files to align with the latest browser version changes.
- **Date:** 2026-05-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4c51778ce8efac260f7cb72624e67c5ea1d88c90

---

## v3.3.8

- **Description:** Simplified the find-and-replace match indexing logic for cleaner navigation through search results.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/5d26c77f14a6fe4e1bc5c669fc95934d74e6d6c4

---

## v3.3.7

- **Description:** Refined the view toggle behaviour and fixed version number wiring in the UI.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/2dc31c8b5a46cad3d74aef7f29d0e8e4bfaa4b41

---

## v3.3.6

- **Description:** Hardened error handling in the markdown renderer and improved find navigation stability.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/faa7078ff9a9a8d814ac0a82fdde6485e52d367a

---

## v3.3.5

- **Description:** Implemented toolbar view mode updates and revised modal layout for a more consistent experience.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/0b37a2cdacd261be47767bb8c935c7ef5509b033

---

## v3.3.4

- **Description:** Fixed rendering of GitHub emoji shortcodes that were not covered by the JoyPixels library.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ad2ea3e3b84c3ee452f1aa8233604fdac15a76ae

---

## v3.3.3

- **Description:** Added retry logic for emoji lookup failures to handle edge cases where shortcodes initially fail to resolve.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/560884e74302a1b8876f6056fce1369111808ec8

---

## v3.3.2

- **Description:** Fixed emoji shortcode rendering so all standard GitHub emoji names display correctly in preview.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4a56585697555d150621a43f2cef4fb69f7e545e

---

## v3.3.1

- **Description:** Enhanced the table insert popup and emoji picker with improved layout and usability.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4a18e3fc80613cedbe334c27fb5fed129e18226f

---

## v3.3.0

- **Description:** Added toolbar modals for inserting tables, emoji, special symbols, and GitHub-style alert blocks directly from the formatting toolbar.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/b2da4d63485b279505ac35e05577ba14aa78c385

---

## v3.2.12

- **Description:** Fixed the reference link toolbar button icon and widened the link, image, and reference insertion modals.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a6c1909f8657d196e1304a0c4a843c723cf75bba

---

## v3.2.11

- **Description:** Added URL validation when inserting reference links — invalid URLs are now rejected before insertion.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/c367455edbbcad95dc03c96ccdfad462da17e73e

---

## v3.2.10

- **Description:** Simplified internal reference link matching logic for better accuracy and maintainability.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/9dc506605e77728b6fb8678745ef531821f4864b

---

## v3.2.9

- **Description:** Added inline documentation for the reference definition regex to clarify its matching behaviour.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/c1f47a750ad4bca6b66a19daa5fa232e0d24ab0b

---

## v3.2.8

- **Description:** Fixed reference token sorting so numerically keyed references appear in the correct order.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/09e3d5b6f8a39cdd79f7265f1d9e49e0a4fd406a

---

## v3.2.7

- **Description:** Fixed reference link definition parsing to correctly extract URL and title components.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4ad4123dd199f01ec2d0ea21260fe1526ca3ae6d

---

## v3.2.6

- **Description:** Updated reference link previews in the modal and increased modal widths for better readability.
- **Date:** 2026-05-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/7d35f9163c410467ffc0656a781f9b4c0bfb225d

---

## v3.2.5

- **Description:** Modal-based insertion for links, references, and images — all three toolbar buttons now open a dialog for consistent UX.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/80fe0b862cad7bde342389fa2c1cca688c3edc65

---

## v3.2.4

- **Description:** Tightened reference icon display and improved edge-case handling in the reference preview.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/c3d3980100dfc31c75dcaf32107370ae62c6e936

---

## v3.2.3

- **Description:** Refined the reference link preview and fixed image upload handling inside the insertion modal.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6d03e43c94951fd3edd18dc7f1e152fce61f9c9f

---

## v3.2.2

- **Description:** Improved reference detection accuracy and updated label text in the reference insertion modal.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a67552b795884845483cbf0de8eb15d5c4e1a35c

---

## v3.2.1

- **Description:** Sanitised title field inputs in the link and image insertion modals to prevent unexpected characters.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/eba538de43050123d859fe23302be61bcd791bca

---

## v3.2.0

- **Description:** Introduced a modal-based UI for inserting links, references, and images from the editor toolbar.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/47ed137be382dab3a34a8efe89ab446229216b1f

---

## v3.1.5

- **Description:** Implemented smart list continuation in the editor — pressing Enter inside a list automatically continues the list item.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/3499907ccef58c978f59e9854bb3a8f20bcc9587

---

## v3.1.4

- **Description:** Added a Markdown formatting toolbar with styling buttons and updated the visual layout.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6c370ea69e82aed37743a835c1bd8c26081e2ef5

---

## v3.1.3

- **Description:** Initial implementation of the Markdown formatting toolbar with editing options for bold, italic, headings, and more.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/42b31e4c847d3b13b772185d09105206823f8862

---

## v3.1.2

- **Description:** Refined button sizes and header dimensions across the toolbar for a consistent layout.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/f6eb342e940d4f953038606dd9d1b1cb75e16cf8

---

## v3.1.1

- **Description:** Added icons to dropdown menu items for import and export actions to improve visual clarity.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4b4fa9f22d607eb49719b3adaf94a43c6f3d383b

---

## v3.1.0

- **Description:** Implemented a tab action dropdown menu with options to rename, duplicate, or delete individual document tabs.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/80bbdcc35e8d464110c2e764b074f0f1248d6cb4

---

## v3.0.2

- **Description:** Removed the dedicated drag-and-drop banner and replaced it with a full-window drop target with a subtle editor hint.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/444d6a1bff1a0492eceaf6c85d049f8a7c2d32dc

---

## v3.0.1

- **Description:** Fixed the drag-leave handler to correctly ignore non-file drag events, preventing the depth counter from going out of sync.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/c7cfdd61b3ceda8333f21f28de383b2b42ef4f90

---

## v3.0.0

- **Description:** Replaced the fixed dropzone banner with a full-window drag-and-drop overlay that activates on file drag.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/9d1904e3649ac1d838196a105c0482bb1f044ab2

---

## v2.9.9

- **Description:** Fixed the stats container (word count, reading time) to display correctly across all viewport widths above 768px.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/9ab3f4f2d5ba7b3a74b935fee46311eb64886928

---

## v2.9.8

- **Description:** Consolidated conflicting navbar media queries that caused a Bootstrap breakpoint conflict hiding the stats bar.
- **Date:** 2026-05-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/63a053eaab970a8c01e45e48b7baf743852a4061

---

## v2.9.7

- **Description:** Fixed the stats container visibility in the 768–991px viewport range where it was previously hidden.
- **Date:** 2026-05-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/77abb998715749784e725e652f7b474e9551198f

---

## v2.9.6

- **Description:** Fixed toolbar overflow at medium screen widths — buttons switch to icon-only and the header no longer wraps.
- **Date:** 2026-05-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a0505287061f3721d7e7153a056fb720b8319f7b

---

## v2.9.5

- **Description:** Prevented the header left and right sections from wrapping at narrow widths using flex and white-space constraints.
- **Date:** 2026-05-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/f5f55d69b4a03706e86cca6c17f113e416bb1cec

---

## v2.9.4

- **Description:** Restored bordered icon-only toolbar buttons to match the intended design reference.
- **Date:** 2026-05-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/662c4ccaf308c0a1e997c5255979961a36678cfd

---

## v2.9.3

- **Description:** Switched toolbar buttons to icon-only style at medium widths and centred the view mode group in the header.
- **Date:** 2026-05-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/07c78f513034bdd06cda7645297e64c4d7d4c8e4

---

## v2.9.2

- **Description:** Fixed the view mode group alignment by applying flex:1 for a proper three-column header layout.
- **Date:** 2026-05-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/0d5d21ca28f16776431bb6ae85b7c7152e69d13c

---

## v2.9.0

- **Description:** Fixed toolbar overflow at medium viewport widths (768–1079px) by hiding button text labels and switching to icon-only display.
- **Date:** 2026-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/cb457e0eb967c5a5a1f3601309cfd6cc7bea7336

---

## v2.7.10

- **Description:** Fixed the release workflow to exclude the staging directory from the source tarball, preventing a self-referencing tar error.
- **Date:** 2026-04-28
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/620cdc0016662e58fbf245f3cd3b949120a2a21e

---

## v2.7.9

- **Description:** Excluded the staging directory from the release source tarball to prevent the tar command from referencing itself.
- **Date:** 2026-04-28
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/1af85a70c8fb4e6cb83b52142d5c20b1d25e2a0e

---

## v2.7.8

- **Description:** Fixed the Ctrl+C keyboard shortcut on Windows to correctly copy selected text instead of always copying the full document.
- **Date:** 2026-04-28
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/440da15482d44a9b02671069dd6e18e0178543de

---

## v2.7.7

- **Description:** Prevented Ctrl+C from copying the entire markdown document when text is already selected in the editor on Windows.
- **Date:** 2026-04-28
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a59cf5caa71d21a433ef4fa433d6ce855f551130

---

## v2.7.4

- **Description:** Fixed pane widths not resetting when switching between tabs with different view modes (e.g. split to preview).
- **Date:** 2026-04-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/7e82536955655d80f0c60b57ee97609fcb8c0884

---

## v2.7.3

- **Description:** Fixed split-view pane widths to always reset when entering a non-split mode, regardless of the previous mode.
- **Date:** 2026-04-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6f7772c3d09e7145787c7efc9e4e7ca633d8fb37

---

## v2.7.2

- **Description:** Fixed exported HTML files to correctly render LaTeX math equations using MathJax.
- **Date:** 2026-04-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/beb6b944eae59458a42d1fcc0dd8ff0ad1e3c70e

---

## v2.7.1

- **Description:** Fixed the MathJax configuration in HTML exports so both inline and block math equations render correctly.
- **Date:** 2026-04-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/1d0219c57a0b502ea4a8cb75c46974f7e3233a64

---

## v2.6.10

- **Description:** Persisted sync scrolling state and dark/light theme preference across page reloads using localStorage.
- **Date:** 2026-04-02
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/d918c7155af501db86d4f94efd2705e9dcaf91be

---

## v2.6.9

- **Description:** Enabled single-dollar sign inline LaTeX rendering via updated MathJax configuration.
- **Date:** 2026-04-02
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/0611723baa20624d032b551ce870868a628539aa

---

## v2.6.8

- **Description:** Normalised script tag indentation in both index files for code consistency.
- **Date:** 2026-04-02
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4144576011aa79dfe16e602eb341b443f273bda0

---

## v2.6.7

- **Description:** Fixed inline MathJax delimiters and reverted unintended resource changes from the branch.
- **Date:** 2026-04-02
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/50734aee96712b73a933a3ccf8644a16008baea4

---

## v2.6.2

- **Description:** Persisted sync scroll and theme settings to localStorage so they survive page refreshes.
- **Date:** 2026-03-28
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/9a2f258e878f1e03f873b577d8331633fe846bac

---

## v2.6.1

- **Description:** Added support for GitHub-style YAML frontmatter — frontmatter blocks are now parsed and hidden from preview.
- **Date:** 2026-03-27
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4b2ee58d938172280b1768b1e1c74e49871e9920

---

## v2.6.0

- **Description:** Added YAML frontmatter support, allowing metadata blocks at the top of markdown files to be parsed and displayed correctly.
- **Date:** 2026-03-26
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/f1451352d2afbddd5f69af3439f67a308f25f3f2

---

## v2.5.8

- **Description:** Added GitHub-style alert/admonition rendering for NOTE, TIP, IMPORTANT, WARNING, and CAUTION blocks.
- **Date:** 2026-03-25
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/f8b70ec3111c893e9826148fb3b244dfdc079529

---

## v2.5.7

- **Description:** Adjusted the alert icon fallback viewBox dimensions to display Font Awesome icons correctly.
- **Date:** 2026-03-25
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/60981e96242cfd9b3a4fc40ef89d02e661c182f5

---

## v2.5.6

- **Description:** Switched alert block icons to use Font Awesome SVG paths for wider compatibility.
- **Date:** 2026-03-25
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ffd9143dd03d0977e88d928900859fb2fdb52a08

---

## v2.5.5

- **Description:** Updated alert block icons to use official GitHub Octicon SVG paths for NOTE, TIP, WARNING, IMPORTANT, and CAUTION.
- **Date:** 2026-03-25
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a89d5f414f11782ffaa2e24bcc61f973d4953a4e

---

## v2.5.4

- **Description:** Hardened alert icon rendering and fixed the note icon path that was displaying incorrectly.
- **Date:** 2026-03-25
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/7093e325313a21d54c5f9989257c42d256976aaf

---

## v2.5.3

- **Description:** Matched GitHub's alert title colours and icon style for NOTE, TIP, IMPORTANT, WARNING, and CAUTION callouts.
- **Date:** 2026-03-25
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/0aa30d8d0d401d82fbcf3deb52a6ecd35af28585

---

## v2.5.2

- **Description:** Improved readability of the admonition marker parsing code without changing behaviour.
- **Date:** 2026-03-25
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/433bbbad55f2946b9f6e599b7d3c36b6fd5a7f28

---

## v2.5.1

- **Description:** Fixed handling of GitHub alert markers that appear on the same line as content.
- **Date:** 2026-03-25
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/7090d872f0a753e6115b5b9adcd0110cb1f64659

---

## v2.5.0

- **Description:** Added initial GitHub-style admonition parsing and CSS styling for alert blocks.
- **Date:** 2026-03-25
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/74eae5acad02ebbcef766ce912dd1bf682be5805

---

## v2.4.5

- **Description:** Set the GitHub import modal width to 60% of the viewport on desktop and tablet for better readability.
- **Date:** 2026-03-20
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6ae149a365983c258ec15f4c6fd122641c40281d

---

## v2.4.4

- **Description:** Styled the GitHub import modal to 60vw width on desktop and tablet screens.
- **Date:** 2026-03-20
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/dce38f2be1181a2d312ab87ab78c4d3bee061a13

---

## v2.4.3

- **Description:** Added multi-file selection support to the GitHub import modal with a select-all toggle and selected file count.
- **Date:** 2026-03-20
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/87831ebd5e2cd31bd5c8d75ab66c7d62dbc3af65

---

## v2.4.2

- **Description:** Added select-all and deselect-all controls to the GitHub import file browser modal.
- **Date:** 2026-03-20
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6c5ec91d0f39c5afc1bd05123a364dd839fbe82b

---

## v2.4.1

- **Description:** Addressed code review feedback and finalised the GitHub import file browser implementation.
- **Date:** 2026-03-20
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/cb10d4829f558b9acb6f24f5749129b3140b6060

---

## v2.4.0

- **Description:** Added a mini file browser inside the GitHub import modal with rate-limiting support for the GitHub API.
- **Date:** 2026-03-20
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/9c764986c7e174b7ae53aaf2ea213d413b6bc092

---

## v2.3.4

- **Description:** Fixed the desktop app to open a markdown file passed as a command-line argument on launch.
- **Date:** 2026-03-20
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6142e6a907851d8e308a36278a29933a78644ea7

---

## v2.3.3

- **Description:** Fixed CLI file argument handling — the desktop app now reads the file path from launch arguments and loads it into the editor automatically.
- **Date:** 2026-03-20
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ca0148f3e7c5f6905608c797ac83ae452c18b9ed

---

## v2.3.2

- **Description:** Improved GitHub import modal readability and usability on both desktop and mobile screen sizes.
- **Date:** 2026-03-19
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/60d4c000c0d4cfa09bb4ef53e5953ba3014eaca3

---

## v2.3.1

- **Description:** Hardened the GitHub import modal's disable/enable state handling during async fetch operations.
- **Date:** 2026-03-19
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a207b2fb11248aae2ff8bd4fc32a10f2a2365286

---

## v2.3.0

- **Description:** Enlarged the GitHub import modal for better readability and introduced usability improvements.
- **Date:** 2026-03-19
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/359a903102cbfc20c48bd4fa400652a30d4ea878

---

## v2.2.8

- **Description:** Removed accidental desktop resource file churn that had been included in the PR.
- **Date:** 2026-03-19
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/f6ca4884cb2237b965e724e3da21d530f6599565

---

## v2.2.7

- **Description:** Addressed code review feedback on GitHub import error and loading state messaging.
- **Date:** 2026-03-19
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/26b5430a73de443665529353ad44874f9746d421

---

## v2.2.6

- **Description:** Merged import actions into a single dropdown and added a GitHub URL import modal to the toolbar.
- **Date:** 2026-03-19
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/8d45c6a0c7a4634a3155cc70d71820fb14066974

---

## v2.2.2

- **Description:** Added GitHub URL-based markdown import with support for repo, tree, blob, and raw URLs — including file discovery and selection.
- **Date:** 2026-03-19
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/b2c3c85e4d7619bd30645015275155d61b62be69

---

## v2.2.1

- **Description:** Addressed code review feedback on the GitHub import file selection prompt text.
- **Date:** 2026-03-19
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/eca1c6365c8a652db2f5d3c0cb98988933ad45a2

---

## v2.2.0

- **Description:** Added GitHub URL markdown import — users can now paste a GitHub URL and import markdown files directly.
- **Date:** 2026-03-19
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/cac85189dff4eb4015a1d43562db5454fe22da31

---

## v2.1.9

- **Description:** Implemented document tab support in the mobile menu with full feature parity to desktop tabs.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6c16a5fe16aa215a6fa283c7dc9b130a9df3ba51

---

## v2.1.8

- **Description:** Aligned the mobile tab UI with desktop — added the three-dot dropdown menu and a Reset all files button to the mobile tab list.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/448fc5c593e1ab99392742dca63cf97468490b7c

---

## v2.1.7

- **Description:** Added a Documents section to the mobile menu showing all open tabs with switch, add, and delete support.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/323c642158b783a27bc5e182dc2c844ff0329974

---

## v2.1.5

- **Description:** Fixed the tab three-dot dropdown menu to always remain visible and no longer be clipped by the scroll container.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ed0169b3f12eab609e6f3527931836ee5ab492d0

---

## v2.1.4

- **Description:** Fixed the tab action dropdown being clipped by the overflow scroll container by switching to position:fixed with dynamic positioning.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/68c4b22d095070333eee3dab684aadbb4ccd056d

---

## v2.1.3

- **Description:** Fixed the three-dot menu button being hidden on inactive tabs by setting a default reduced opacity.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/d6585ed251096eb490392ad2c277f3e6caae58f1

---

## v2.1.2

- **Description:** Fixed Document tab bar visibility by replacing sticky positioning with relative on the app header.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/854f3262a29fe0935b42dab3f1f40cd19f958e2a

---

## v2.1.1

- **Description:** Fixed document tab bar not appearing by adding z-index and position rules to the tab bar element.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/874d8f7f812aea5a6e584b40683bfba4e9875d9f

---

## v2.0.7

- **Description:** Changed overflow properties on focusable elements to improve keyboard focus ring visibility.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/7d8b9c0081fdc3c7eeae1abfa4ce23e289ef7ac4

---

## v2.0.6

- **Description:** Removed overflow:hidden from link styles and increased z-index to prevent dropdowns being clipped.
- **Date:** 2026-03-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4d4a088668fda0c2473c5181c1079e2890747917

---

## v2.0.5

- **Description:** Overhauled the document tabs UI with a three-dot context menu, sequential tab naming, a reset button, and delete-last-tab support.
- **Date:** 2026-03-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/0663392b578780c0986dff52b9991596eeb4bb85

---

## v2.0.4

- **Description:** Added three-dot context menu to tabs with rename, duplicate, and delete actions; sequential tab naming; and a reset all button.
- **Date:** 2026-03-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/cedd372640d718aea697a88e210786ca0db17930

---

## v2.0.1

- **Description:** Added multi-tab workspace with localStorage-based session persistence across page reloads.
- **Date:** 2026-03-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/2fed8d5003bd008d34562cb8ddaaacf33f9cf515

---

## v2.0.0

- **Description:** Implemented full Document Tabs and Session Management — tab bar, drag-and-drop reordering, localStorage persistence, keyboard shortcuts (Ctrl+T, Ctrl+W), and up to 20 tabs.
- **Date:** 2026-03-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/d8510fc8ea736e1727fcab2cc1b54f6a968070db

---

## v1.8.8

- **Description:** Implemented CSS-variable-based syntax highlighting for dark mode so code blocks theme correctly.
- **Date:** 2026-03-07
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/01effc7d914129f2e71485de6871f28daf1027de

---

## v1.8.7

- **Description:** Implemented CSS-variable-based syntax highlighting for dark mode — code blocks now adapt to the active theme without a hard-coded colour scheme.
- **Date:** 2026-03-06
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a01f20473fbd5934617999ca8f9e616c75e99127

---

## v1.8.6

- **Description:** Changed the Markdown logo image source to a more reliable CDN-hosted URL.
- **Date:** 2026-03-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a46877e47593ffef464772e90dc6e44a91de90f0

---

## v1.8.5

- **Description:** Updated the Markdown logo image source in the script to fix broken logo display.
- **Date:** 2026-03-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/c2a5a64d2d072989440f2119738af05ed293ddde

---

## v1.8.4

- **Description:** Fixed the Ctrl+C keyboard shortcut — it now respects text selection and only copies the full document when nothing is selected.
- **Date:** 2026-03-05
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/c6df362d586fcc80235a3dff5f1fb6279449c043

---

## v1.8.3

- **Description:** Fixed Ctrl+C to copy only the selected text when a selection exists, instead of always copying the full markdown source.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ae80a331bb792ae4f1078e457c730771e305372c

---

## v1.8.1

- **Description:** Removed the Share via URL modal — clicking the Share button now copies the URL directly to the clipboard.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/331c7d4c00409309d0850cfba1b0a310b320e06c

---

## v1.8.0

- **Description:** Replaced the Share modal with a direct clipboard copy on button click for a faster sharing experience.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/e5fb3aeec59eca9cab897ea34dbd4c2eb555bc03

---

## v1.7.10

- **Description:** Removed the generated URL display from the share modal in preparation for the modal-less share flow.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/b0e64a6d018dd4ac6427e238d81bcb9803a75552

---

## v1.7.9

- **Description:** Removed URL display from the share modal (earlier iteration of the share UX cleanup).
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/1215fdabf4c66aa530ca17e9e26993d381c9fad8

---

## v1.7.8

- **Description:** Removed URL display from share modal — clean-up iteration.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6f09af509e94e790bd109d8a663274f9a3dca173

---

## v1.7.7

- **Description:** Replaced the blocking browser alert for large markdown share URLs with a proper share modal.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/65077841db3401cd8ae0b85968a30d21357e677a

---

## v1.7.5

- **Description:** Fixed an invalid SRI integrity hash for pako.min.js and prevented highlight.js from double-highlighting already-processed code blocks.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/73579688c5be737feef83aa22cef176a0810ed88

---

## v1.7.4

- **Description:** Fixed the invalid SRI hash for pako.min.js and added a guard to skip re-highlighting already processed code blocks.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/bfc7301f1813ebfb19dd40003c10cb271225cc9b

---

## v1.7.2

- **Description:** Fixed an invalid Docker image tag that caused PR build failures by switching to a static sha- prefix.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/84249045eb1ccdb82f0823efa6d257c728f94b27

---

## v1.7.1

- **Description:** Fixed invalid Docker image tag on PR events by using a static sha- prefix instead of a dynamic one.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/92c2fdf0094ceade0b1523c34576f95b387cec29

---

## v1.7.0

- **Description:** Added a Share button that encodes the current markdown as a compressed URL using pako, allowing documents to be shared via link.
- **Date:** 2026-03-04
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/c857f3b5ac62a98b0afc45098aa8daf3d89b0ee9

---

## v1.6.5

- **Description:** Fixed Mermaid diagram toolbar — Copy button now visible, toolbar order corrected, modal resized, and Copy action in modal works.
- **Date:** 2026-03-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/efa5f2b8d0904429d025409c0270f7d602dd2d45

---

## v1.6.4

- **Description:** Updated Mermaid toolbar UI: corrected button label, fixed toolbar order, resized modal, and added a working Copy button inside the modal.
- **Date:** 2026-03-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/3abcdd743e5d018818c5fde6ddb4ee7826d7f786

---

## v1.6.2

- **Description:** Added copy, export (PNG/SVG), and zoom toolbar controls for rendered Mermaid diagrams.
- **Date:** 2026-03-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/03b4b596047611f65b3033536fd6d0b41b2c8ead

---

## v1.6.1

- **Description:** Addressed code review feedback — rounded diagram dimensions, used CSS variable backgrounds, and added timestamps to exported filenames.
- **Date:** 2026-02-27
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4de24246577a00bfebff0cf25d087d6b6d84dd7b

---

## v1.6.0

- **Description:** Added a toolbar above each rendered Mermaid diagram with copy, export, and zoom controls.
- **Date:** 2026-02-27
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/d75d01cc803921014ccfa1b2aa9092d72ffba349

---

## v1.5.5

- **Description:** Merged the Neutralinojs desktop app port — Markdown Viewer now ships as a native desktop application.
- **Date:** 2026-02-18
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/cc0c33f4c3aa930ccc24b68b38bcfc018878d385

---

## v1.5.4

- **Description:** Fixed desktop app build output being empty on fresh clones by adding an idempotent binary setup script.
- **Date:** 2026-02-18
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/cbc523a0bd3a764c68d618cd612da703747bc84d

---

## v1.5.3

- **Description:** Removed the local Neutralinojs dependency and switched all commands to use npx for a lighter setup.
- **Date:** 2026-02-17
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/b782511070e844585562b76f9c508cbaefad4507

---

## v1.5.2

- **Description:** Added the full Neutralinojs desktop app — build scripts, Dockerfile, GitHub Actions CI/CD workflow, and README.
- **Date:** 2026-02-17
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/7b12698630f9176a0456d5e54f65afc20e28b212

---

## v1.5.0

- **Description:** Initial implementation of the Markdown Viewer desktop application using Neutralinojs.
- **Date:** 2026-02-10
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/167fb64bbab593895e78e6eed7641ddc0beede21

---

## v1.4.4

- **Description:** Fixed the Tab key in the editor — it now inserts two spaces instead of moving focus to the next element.
- **Date:** 2026-01-22
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/2745de84c5259ffa1bd83cb2d481da7e759c024f

---

## v1.4.3

- **Description:** Added a Tab key handler to the editor textarea that inserts two spaces instead of triggering browser focus change.
- **Date:** 2026-01-22
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/5abab83159e01a01cc10ff5a17597348aac50a63

---

## v1.4.1

- **Description:** Merged community feature improvements — three view mode buttons, resizable split view, sync button scoped to split mode only, and improved PDF export.
- **Date:** 2026-01-22
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/177805d1b51765f9b9143878a59eee9d17817f2c

---

## v1.4.0

- **Description:** Added Editor/Split/Preview view mode buttons, resizable split pane, sync scrolling scoped to split mode, and improved PDF rendering for graphics, tables, and formulas.
- **Date:** 2026-01-10
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/9ab5ad89217cbea79abebff444db9b9be4e1b7cb

---

## v1.3.7

- **Description:** Merged various feature improvements from the feature branch into main.
- **Date:** 2025-10-11
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/78e0dcad4f457113b7fafa8fda0b4885a4c46ed4

---

## v1.3.6

- **Description:** Merged Docker support contributed by the community — Markdown Viewer can now be run in a container.
- **Date:** 2025-10-11
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/525152bcfdfa491f327ee2c3cad494f8f5762423

---

## v1.3.5

- **Description:** Refactored PDF export for better quality and improved UI responsiveness across screen sizes.
- **Date:** 2025-09-29
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/294422e68c73fda69122095f5118a20b995353df

---

## v1.3.1

- **Description:** Merged optimised PDF export with a progress UI and renamed the Toggle Mode button.
- **Date:** 2025-05-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/8a8c93c4475c17056347a858d3fd1fe5ce230da0

---

## v1.3.0

- **Description:** Optimised the PDF export pipeline, added a progress indicator during export, and renamed the Toggle Mode button.
- **Date:** 2025-05-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ae15e31900840156418799fcffe263c728d4d47a

---

## v1.2.3

- **Description:** Improved PDF export rendering quality for complex markdown elements.
- **Date:** 2025-05-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/fc6fdc036045d166b94404a4c087c660fb93ea6d

---

## v1.2.2

- **Description:** Fixed PDF export by replacing html2pdf with jsPDF and html2canvas for more reliable output.
- **Date:** 2025-05-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/f06b8d0491d643abfa9effd7f0832ed77714e368

---

## v1.1.3

- **Description:** Updated meta tags and SEO attributes and made minor UI adjustments.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a443f1e4f758da011cdeacf71e1369ff8e445c60

---

## v1.1.2

- **Description:** Updated media queries, added a GitHub link to the header, and removed the Tips page.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/55718693eaf48cccd56541cf40c858d0c1387418

---

## v1.1.1

- **Description:** Updated page description and keyword meta tags for better SEO.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/28a346ab6269163c686fb56fa810fd04609aa837

---

## v1.1.0

- **Description:** Removed an incorrect image tag link that was breaking the page layout.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a5d48820f39328f9666ff7e120c36bad36c87fed

---

## v1.0.9

- **Description:** Removed a broken image tag link from the source.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/9d0f5be04e1d23726444795f63764d2086032b87

---

## v1.0.8

- **Description:** Updated the welcome markdown example content shown on first load.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/95fc984aa345423f2d8e23eade316ecbc0384aa5

---

## v1.0.7

- **Description:** Updated the default welcome markdown example to a simpler and cleaner demonstration.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a569b5bc8e4a9e46737cb7a9a4c2ed3d04cada59

---

## v1.0.6

- **Description:** Added emoji support using the JoyPixels (emoji-toolkit) library for rendering emoji shortcodes.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/b834a2725ec3799238dd5cb7eb81c9482127c344

---

## v1.0.5

- **Description:** Added support for rendering GitHub emoji shortcodes using the JoyPixels library.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/960fbc5e5705c4809cb14224a985ed06373508cf

---

## v1.0.4

- **Description:** Updated Mermaid to v11.6.0 and fixed a dark mode initialisation bug that caused incorrect theme on first load.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/dbcfdd4c3de048d5e505f3697b2b443af9df1ceb

---

## v1.0.3

- **Description:** Fixed the initial Mermaid diagram theme to correctly reflect the active light or dark mode on load.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/5380946a5a03b750fe2954fab743a92401a83272

---

## v1.0.2

- **Description:** Updated Mermaid to the latest version for improved diagram compatibility and rendering.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/da92568df567392024679c88bab900da54d00836

---

## v1.0.1

- **Description:** Merged Mermaid diagram and LaTeX math support into main.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4e1fb019ebd9e45087132987eef2c87414bad73f

---

## v1.0.0

- **Description:** Added support for rendering Mermaid diagrams and LaTeX math expressions in the markdown preview.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/cc53828c4ac3a164c0f4df64cd34e78ae2d15fe7

---

## v0.5.6

- **Description:** Updated the Copy button to copy raw Markdown instead of rendered HTML.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/e7a661106a282ef5abdda85be88efdc4f20e6377

---

## v0.5.5

- **Description:** Changed the copy button from copyHtmlBtn to copyMdBtn — the button now copies the markdown source.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6f838dfeddbd1918a0805f3e985a297cec0c2b43

---

## v0.5.4

- **Description:** Added a mobile hamburger menu with full access to all editor features on small screens.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/a93c940aaa988d0dd4d8a1c3f7c54c26b4d10a37

---

## v0.5.3

- **Description:** Updated the application name displayed in the navbar.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/c3a3fa465c6ce45462a472700ceb377f8be655cc

---

## v0.5.2

- **Description:** Fixed UI layout issues for mobile media query breakpoints.
- **Date:** 2025-05-03
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/85689c8a31ca10a0b3d4b064ea6698f72ca7f58f

---

## v0.5.1

- **Description:** Added a favicon and SEO meta tags for improved branding and search engine discoverability.
- **Date:** 2025-05-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/d54a170d27e772225ac0562231e1ea01361711e3

---

## v0.5.0

- **Description:** Added a favicon and SEO meta tags (description, keywords, Open Graph) to the page.
- **Date:** 2025-05-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/b761575f3b8ef85ec6c4306ca81667a396548432

---

## v0.4.10

- **Description:** Removed unwanted padding from the editor panel for a cleaner layout.
- **Date:** 2025-05-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ec49a606141a7652c0a00f17e2af586a36199778

---

## v0.4.9

- **Description:** Added a drag-and-drop toggle and applied various CSS fixes for the dropzone area.
- **Date:** 2025-05-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/8734259c64b8a35f292c7f2b786bbac8adbacbbf

---

## v0.4.8

- **Description:** Fixed a toolbar rendering issue causing misaligned buttons.
- **Date:** 2025-05-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/5be5e86d04505549152cd4f737e37605866099be

---

## v0.4.7

- **Description:** Added a close button to the drag-and-drop zone so it can be dismissed after use.
- **Date:** 2025-05-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/9fc7eeca6142231ae03777b37f3f0abf6daac1ee

---

## v0.4.6

- **Description:** Merged the new UI overhaul with theme toggle, dropzone support, and improved markdown rendering.
- **Date:** 2025-05-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/6bf47347647cb7803bdf94e441d2bdce94d3e3c6

---

## v0.4.5

- **Description:** Removed the legacy LivePage directory from the repository.
- **Date:** 2025-05-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ab4b5c05cfeadd2e388c25cf07dc80a3a6014e24

---

## v0.4.4

- **Description:** Updated sync scrolling and the stats card display.
- **Date:** 2025-05-01
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/bc0526b1210eb49b07ce9e4fbea07a05388ade29

---

## v0.4.3

- **Description:** Updated sync scrolling behaviour and refined the stats card.
- **Date:** 2025-04-30
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/8f72846e07f413014aca8cbcd260c1e13cd838d9

---

## v0.4.2

- **Description:** Fixed code block bracket colouring in dark mode toggle.
- **Date:** 2025-04-30
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/127d274a2ab78662f7d3752378f855dcc6d078b2

---

## v0.4.1

- **Description:** Fixed an incorrect file path reference.
- **Date:** 2025-04-30
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/1129d0efaf0569d20affd5272a59e37d4dd77287

---

## v0.4.0

- **Description:** Introduced a new UI design for the editor.
- **Date:** 2025-04-30
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/59c4a86cfb7825601787c4f05a259e0a5342a451

---

## v0.3.13

- **Description:** Updated the index link in the navigation.
- **Date:** 2024-08-23
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/8bdfb0d7270bb9ec060b0eeba8946da5712b1d2f

---

## v0.3.12

- **Description:** Updated multiple source files with general improvements.
- **Date:** 2024-08-23
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/3ac144069faf7ec17a9cdd8629eb6dd10581aac3

---

## v0.3.11

- **Description:** Fixed a CSS styling issue.
- **Date:** 2024-04-13
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/65401c5ae6ed5ebc6c640e5e8d2167e488b648a2

---

## v0.3.6

- **Description:** Added tooltip support at the 1200px media query breakpoint.
- **Date:** 2024-04-12
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/faf12c3723f61ae148c644c4164b845b1dd517f0

---

## v0.3.5

- **Description:** Fixed a CSS layout issue.
- **Date:** 2024-04-12
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/b370daac7b1ca68ad75fdeb27525c1a1e116e518

---

## v0.3.4

- **Description:** Added additional toolbar buttons with tooltips.
- **Date:** 2024-04-12
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/10b87b5cd6de5c8ecc8cb30bb0ad7e8f37dbe6ca

---

## v0.3.3

- **Description:** Fixed a spelling error in the UI.
- **Date:** 2024-04-12
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/4bef4bda95890d5ff696b11915f828993aab40b4

---

## v0.3.2

- **Description:** Added a reading stats panel showing word count, character count, and estimated reading time.
- **Date:** 2024-04-12
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/b60b9020912e81d8c00551de19155ab5e47a7f57

---

## v0.3.0

- **Description:** Added a Tips page and updated media query handling.
- **Date:** 2024-04-11
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/eceb56e475549d9582aef3a25ed18b403b93735a

---

## v0.2.4

- **Description:** Updated CSS styles for layout refinements.
- **Date:** 2024-04-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/7cd66bad4778f65c6932a8089bdb6a7072b28d83

---

## v0.2.3

- **Description:** Updated CSS styles for additional layout fixes.
- **Date:** 2024-04-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/1b19bc664c2968ea217d2dbd6e8de8b91ab5a2b0

---

## v0.2.2

- **Description:** Removed unused JavaScript code for a cleaner codebase.
- **Date:** 2024-04-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/bfd248c48044ccd4beae4977fc1e00d00bd9058f

---

## v0.2.1

- **Description:** Added file import functionality to load markdown files into the editor.
- **Date:** 2024-04-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/dd9548dcc76f64a9315143ee0d18b18315f566a9

---

## v0.2.0

- **Description:** Added a live preview panel that renders markdown content in real time.
- **Date:** 2024-04-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/3d6ff67f8fc0d52f35cb9e6a98cc3f197073356a

---

## v0.1.7

- **Description:** Updated element colours for improved visual style.
- **Date:** 2024-04-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/801f830768cee83ab70ead1882f78486edba05b9

---

## v0.1.6

- **Description:** Fixed a border layout issue in the editor.
- **Date:** 2024-04-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/29578f1fd0da242572d64a9daded27023516387e

---

## v0.1.5

- **Description:** Fixed the page layout and added the logo to the navigation bar.
- **Date:** 2024-04-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/9fad69c959aa64d56396c5948a8f2f5f34af5b11

---

## v0.1.4

- **Description:** Fixed navbar and media query layout issues.
- **Date:** 2024-04-09
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/42db836fc05cda88edd52668fa8f7f6b90ad955a

---

## v0.1.3

- **Description:** Updated the overall page layout.
- **Date:** 2024-04-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/ecf02617c6d244e2dddac170f0c5550e3e8dc7e1

---

## v0.1.2

- **Description:** Added navigation and export functionality.
- **Date:** 2024-04-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/37a3ef0e31900f24a71d323733496db5621b9464

---

## v0.1.1

- **Description:** Added the initial markdown editor page.
- **Date:** 2024-04-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/2b37ae90bb8e60418469b806cfc3b67ad9ff2059

---

## v0.1.0

- **Description:** Initial commit — project created.
- **Date:** 2024-04-08
- **URL:** https://github.com/ThisIs-Developer/Markdown-Viewer/commit/5d34b992c1d8c4ad4dfd3cf79b5a627f28a163b1

---
