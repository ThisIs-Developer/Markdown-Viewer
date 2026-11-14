import importlib.util
import pathlib
import plistlib
import struct
import sys
import unittest

packaging = pathlib.Path(__file__).resolve().parents[2] / 'desktop-app/packaging'
sys.path.insert(0, str(packaging))
from macos_support import app_metadata
spec = importlib.util.spec_from_file_location('verify_macos', packaging / 'verify-macos.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def macho(minimum, cpu=0x1000007, framework=False):
    commands = struct.pack('<IIIIII', 0x32, 24, 1, minimum, 0x0e0500, 0)
    if framework:
        name = b'/System/Library/Frameworks/ScreenCaptureKit.framework/ScreenCaptureKit\0'
        commands += struct.pack('<IIIIII', 0xc, 24 + len(name), 24, 0, 0, 0) + name
    return struct.pack('<IIIIIIII', 0xfeedfacf, cpu, 3, 2, 2 if framework else 1, len(commands), 0, 0) + commands


def universal(second):
    first = macho(0x0a0f00)
    header = struct.pack('>II', 0xcafebabe, 2)
    header += struct.pack('>IIIII', 0x1000007, 3, 48, len(first), 0)
    header += struct.pack('>IIIII', 0x100000c, 0, 48 + len(first), len(second), 0)
    return header + first + second


class Compatibility(unittest.TestCase):
    def test_accepts_intel_catalina_and_apple_silicon_big_sur(self):
        self.assertEqual(verifier.verify(macho(0x0a0f00), 'x64'), ['x86_64'])
        self.assertEqual(verifier.verify(macho(0x0b0000, 0x100000c), 'arm64'), ['arm64'])

    def test_rejects_the_previous_monterey_cutoff_and_upstream_sonoma(self):
        for minimum in [0x0c0000, 0x0e0000]:
            for cpu in [0x1000007, 0x100000c]:
                with self.subTest(minimum=minimum, cpu=cpu), self.assertRaises(AssertionError):
                    verifier.inspect(macho(minimum, cpu))

    def test_rejects_mandatory_framework_missing_on_older_macs(self):
        with self.assertRaises(AssertionError):
            verifier.inspect(macho(0x0a0f00, framework=True))

    def test_checks_both_universal_slices_against_their_own_baselines(self):
        self.assertEqual(verifier.verify(universal(macho(0x0b0000, 0x100000c)), 'universal'), ['x86_64', 'arm64'])
        with self.assertRaises(AssertionError):
            verifier.inspect(universal(macho(0x0c0000, 0x100000c)))
        with self.assertRaises(AssertionError):
            verifier.verify(universal(macho(0x0a0f00)), 'universal')

    def test_rejects_an_architecture_mislabeled_as_another_download(self):
        with self.assertRaises(AssertionError):
            verifier.verify(macho(0x0b0000, 0x100000c), 'x64')
        with self.assertRaises(AssertionError):
            verifier.verify(macho(0x0a0f00), 'universal')

    def test_legacy_intel_load_command_is_accepted(self):
        binary = bytearray(macho(0x0a0f00))
        # Older Intel targets use LC_VERSION_MIN_MACOSX instead of LC_BUILD_VERSION.
        struct.pack_into('<II', binary, 32, 0x24, 16)
        struct.pack_into('<II', binary, 40, 0x0a0f00, 0x0e0500)
        self.assertEqual(verifier.verify(bytes(binary), 'x64'), ['x86_64'])

    def test_finder_metadata_keeps_the_intel_and_arm_requirements_separate(self):
        for arch, minimum, expected in [
            ('x64', '10.15', {'x86_64': '10.15'}),
            ('arm64', '11.0', {'arm64': '11.0'}),
            ('universal', '10.15', {'x86_64': '10.15', 'arm64': '11.0'}),
        ]:
            with self.subTest(arch=arch):
                # Round-trip the actual plist data used by the disk-image packager.
                metadata = plistlib.loads(plistlib.dumps(app_metadata('3.10.6', arch)))
                self.assertEqual(metadata['LSMinimumSystemVersion'], minimum)
                self.assertEqual(metadata['LSMinimumSystemVersionByArchitecture'], expected)
                self.assertEqual(metadata['CFBundleIdentifier'], 'com.markdownviewer.desktop')
                self.assertEqual(metadata['CFBundleExecutable'], 'markdown-viewer')
                self.assertEqual(metadata['CFBundleIconFile'], 'MarkdownViewer')
                self.assertEqual(metadata['NSHumanReadableCopyright'], 'Copyright 2024 ThisIs-Developer')
                self.assertEqual(metadata['LSApplicationCategoryType'], 'public.app-category.productivity')
                self.assertEqual(metadata['CFBundleGetInfoString'], 'Markdown Viewer 3.10.6, ThisIs-Developer, Apache-2.0')


if __name__ == '__main__':
    unittest.main()
