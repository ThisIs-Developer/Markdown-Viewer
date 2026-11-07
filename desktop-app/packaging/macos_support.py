"""Native dependency baselines, shared by compilation, validation and app metadata.

Neutralino uses std::filesystem, whose Apple libc++ implementation starts in 10.15.
Apple Silicon first shipped with macOS 11. These are architecture/dependency
requirements, not an application-imposed Monterey cutoff. Older OS acceptance
also requires testing its installed WebKit; load commands alone cannot prove it.
"""
import plistlib
import sys
import json
import pathlib

METADATA = json.loads(pathlib.Path(__file__).with_name('metadata.json').read_text())

DEPLOYMENT_TARGETS = {'x86_64': '10.15', 'arm64': '11.0'}
CPU_ARCHITECTURES = {0x1000007: 'x86_64', 0x100000c: 'arm64'}
PACKAGE_ARCHITECTURES = {'x64': ['x86_64'], 'arm64': ['arm64'], 'universal': ['x86_64', 'arm64']}


def packed_version(version):
    parts = [int(part) for part in version.split('.')]
    parts += [0] * (3 - len(parts))
    return (parts[0] << 16) | (parts[1] << 8) | parts[2]


def app_metadata(version, package_arch):
    architectures = PACKAGE_ARCHITECTURES[package_arch]
    minimums = {arch: DEPLOYMENT_TARGETS[arch] for arch in architectures}
    return {
        'CFBundleExecutable': 'markdown-viewer',
        'CFBundleIdentifier': 'com.markdownviewer.desktop',
        'CFBundleName': METADATA['name'],
        'CFBundleDisplayName': METADATA['name'],
        'CFBundlePackageType': 'APPL',
        'CFBundleShortVersionString': version,
        'CFBundleVersion': version.split('-')[0],
        'CFBundleIconFile': 'MarkdownViewer',
        'CFBundleGetInfoString': f"{METADATA['name']} {version}, {METADATA['developer']}, {METADATA['license']}",
        'NSHumanReadableCopyright': METADATA['copyright'],
        'LSApplicationCategoryType': 'public.app-category.productivity',
        'LSMinimumSystemVersion': min(minimums.values(), key=packed_version),
        'LSMinimumSystemVersionByArchitecture': minimums,
        'NSHighResolutionCapable': True,
        'NSDocumentsFolderUsageDescription': 'Markdown Viewer saves your documents in the Markdown Viewer Vault in Documents.',
    }


if __name__ == '__main__':
    if sys.argv[1] == 'target':
        print(DEPLOYMENT_TARGETS[sys.argv[2]])
    elif sys.argv[1] == 'plist':
        with open(sys.argv[4], 'wb') as target:
            plistlib.dump(app_metadata(sys.argv[2], sys.argv[3]), target)
    else:
        raise SystemExit('Usage: macos_support.py target <architecture> | plist <version> <package-arch> <output>')
