#!/usr/bin/env python3
"""CI-only acceptance: launch the shipped GUI, import Markdown, verify real vault IO."""
import json
import os
import pathlib
import signal
import subprocess
import sys
import tempfile
import time

assert os.environ.get('GITHUB_ACTIONS') == 'true', 'Run only on a disposable GitHub Actions runner'
application = pathlib.Path(sys.argv[1]).resolve()
is_mac = sys.platform == 'darwin'
vault = pathlib.Path.home() / 'Documents' / 'Markdown Viewer Vault'
assert not vault.exists(), 'Refusing to touch a pre-existing vault'
fixture_dir = pathlib.Path(tempfile.mkdtemp(prefix='markdown-viewer-smoke-'))
fixture = fixture_dir / 'Packaging 日本 test.md'
body = '# Desktop packaging smoke test\n\nNative import and persistent vault: 日本 ✓\n'
fixture.write_text(body)
executable = application / 'Contents/MacOS/markdown-viewer' if is_mac else application
log = open(fixture_dir / 'runtime.log', 'w')


def app_pids():
    if not is_mac:
        return [process.pid] if process.poll() is None else []
    listing = subprocess.run(['pgrep', '-f', str(executable)], capture_output=True, text=True)
    return [int(pid) for pid in listing.stdout.split()]


def start(arguments):
    command = ['open', '-W', '-n', str(application), '--args', *arguments] if is_mac else [str(executable), *arguments]
    return subprocess.Popen(command, cwd=fixture_dir, stdout=log, stderr=subprocess.STDOUT)


def stop():
    for pid in app_pids():
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    process.wait(timeout=20)


process = start([str(fixture)])
try:
    stored = None
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f'GUI exited before creating its vault: {process.returncode}')
        try:
            index = json.loads((vault / '.markdown-viewer/index.json').read_text())
            for document in index['documents']:
                candidate = vault / document['vaultRelativePath']
                if candidate.read_text() == body:
                    stored = candidate
                    break
        except (FileNotFoundError, KeyError, json.JSONDecodeError):
            pass
        if stored:
            break
        time.sleep(0.5)
    assert stored, 'Native GUI did not persist the launch-file content into the vault'
    assert app_pids(), 'Native GUI is not running'
    print('PASS: native GUI imported Unicode Markdown and created the real Documents vault', flush=True)
    stop()
    process = start([])
    time.sleep(10)
    assert process.poll() is None and app_pids(), 'Native GUI failed to reopen'
    assert stored.read_text() == body, 'Persisted document changed after relaunch'
    index = json.loads((vault / '.markdown-viewer/index.json').read_text())
    assert any(vault / item['vaultRelativePath'] == stored for item in index['documents'])
    print('PASS: native GUI relaunched with the same indexed document and bytes', flush=True)
finally:
    try:
        stop()
    finally:
        log.close()
        print((fixture_dir / 'runtime.log').read_text())
