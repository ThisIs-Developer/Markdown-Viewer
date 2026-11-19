/* Portable document recovery. The file and its independent key stay user-held. */
(function(root) {
  'use strict';
  const C = root.MarkdownShareCrypto;
  // Backups embed media as base64 data URLs. The snapshot's 8 MiB limit does not
  // apply to portable recovery. Bound recovery separately to support a full
  // 10 MiB managed video without allowing unbounded allocations.
  const LIMIT = 64 * 1024 * 1024;
  function validate(value) {
    if (!C.exactKeys(value, ['content', 'title', 'reviewThreads', 'createdAt']) || typeof value.content !== 'string' ||
        typeof value.title !== 'string' || value.title.length > 512 || !Array.isArray(value.reviewThreads) ||
        value.reviewThreads.length > 5000 || !Number.isSafeInteger(value.createdAt)) throw new Error('Invalid recovery document.');
    return value;
  }
  async function create(value) {
    const payload = validate(value), key = C.random();
    const encrypted = await C.seal(payload, key, 'document-recovery', LIMIT);
    const file = JSON.stringify({ format: 'markdown-viewer-recovery', version: 1, encrypted });
    // Verify the complete file format before offering it for download.
    await restore(file, key);
    return { file, key };
  }
  async function restore(file, key) {
    if (typeof file !== 'string' || file.length > Math.ceil((LIMIT + 16) * 4 / 3) + 1024) throw new Error('Recovery file is too large.');
    const record = JSON.parse(file);
    if (!C.exactKeys(record, ['format', 'version', 'encrypted']) || record.format !== 'markdown-viewer-recovery' || record.version !== 1) {
      throw new Error('Unsupported recovery file.');
    }
    try { return validate(await C.open(record.encrypted, key.trim(), 'document-recovery', LIMIT)); }
    catch (_) { throw new Error('Unable to restore. Check the recovery key and file.'); }
  }
  function attach(options) {
    let active = null;
    function dialog(isExport) {
      if (active) return null;
      const modal = document.createElement('div');
      modal.id = 'sharing-recovery-modal'; modal.className = 'reset-modal-overlay';
      modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'recovery-title');
      modal.innerHTML = '<div class="reset-modal-box reset-modal-box--wide app-modal-box"><div class="modal-header"><p id="recovery-title" class="reset-modal-message"></p></div><div class="modal-body"><p id="recovery-description"></p><label for="recovery-key">Recovery key</label><input id="recovery-key" class="rename-modal-input" autocomplete="off" spellcheck="false"><div id="recovery-controls"></div><p id="recovery-status" role="status"></p></div><div class="modal-footer"><button id="recovery-cancel" class="reset-modal-btn reset-modal-cancel">Cancel</button><button id="recovery-action" class="reset-modal-btn"></button></div></div>';
      modal.querySelector('#recovery-title').textContent = isExport ? 'Encrypted document recovery' : 'Restore encrypted document';
      modal.querySelector('#recovery-description').textContent = isExport
        ? 'Keep this key separately from the file. Both are required to restore this document and its comments. Encrypted managed attachments are embedded; external links remain links. Maximum recovery content: 64 MiB, including embedded media. Very large documents may need a separate source-file backup.'
        : 'Choose a recovery file and enter its key. A new local document will be created; existing documents are preserved.';
      const key = modal.querySelector('#recovery-key'), action = modal.querySelector('#recovery-action'), status = modal.querySelector('#recovery-status');
      const close = () => { options.closeModal(modal); key.value = ''; modal.remove(); active = null; };
      modal.querySelector('#recovery-cancel').onclick = close;
      document.body.appendChild(modal); active = modal;
      options.openModal(modal, { focusTarget: key, onClose: close });
      return { modal, key, action, status, close, controls: modal.querySelector('#recovery-controls') };
    }
    document.getElementById('export-recovery')?.addEventListener('click', async event => {
      event.preventDefault();
      const source = options.getDocument(); if (!source) return;
      const ui = dialog(true); if (!ui) return;
      ui.key.readOnly = true; ui.action.disabled = true; ui.action.textContent = 'Download encrypted file';
      ui.status.textContent = 'Preparing encrypted recovery…';
      try {
        const content = await root.MarkdownShareMedia.inlineMarkdown(source.content, options.base(), LIMIT);
        const result = await create({ ...source, content, createdAt: Date.now() });
        if (!ui.modal.isConnected) return;
        ui.key.value = result.key;
        const label = document.createElement('label'), confirm = document.createElement('input');
        confirm.type = 'checkbox'; confirm.id = 'recovery-key-saved';
        label.append(confirm, document.createTextNode(' I have saved the recovery key separately.'));
        ui.controls.append(label);
        confirm.onchange = () => { ui.action.disabled = !confirm.checked; };
        ui.status.textContent = 'Copy the key before downloading. The service cannot recover a lost key.';
        ui.action.onclick = () => {
          options.download(new Blob([result.file], { type: 'application/json' }), 'document.mvrecovery'); ui.close();
        };
      } catch (error) { ui.status.textContent = error.message; }
    });
    document.getElementById('import-recovery')?.addEventListener('click', event => {
      event.preventDefault();
      const ui = dialog(false); if (!ui) return;
      const input = document.createElement('input'); input.type = 'file'; input.id = 'recovery-file'; input.accept = '.mvrecovery,application/json';
      input.setAttribute('aria-label', 'Encrypted recovery file'); ui.controls.append(input);
      ui.action.textContent = 'Restore as new document';
      ui.action.onclick = async () => {
        ui.action.disabled = true;
        try {
          const file = input.files[0];
          if (!file || file.size > Math.ceil((LIMIT + 16) * 4 / 3) + 1024) throw new Error('Select a recovery file up to 90 MiB.');
          const payload = await restore(await file.text(), ui.key.value);
          if (!ui.modal.isConnected) return;
          await options.restoreDocument(payload); ui.close();
        } catch (error) { ui.status.textContent = error.message; ui.action.disabled = false; }
      };
    });
  }
  root.MarkdownShareRecovery = Object.freeze({ LIMIT, create, restore, attach });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MarkdownShareRecovery;
})(globalThis);
