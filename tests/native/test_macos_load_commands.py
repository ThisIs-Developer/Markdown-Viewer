import importlib.util
import pathlib
import struct
import unittest

script = pathlib.Path(__file__).resolve().parents[2] / 'desktop-app/packaging/verify-macos.py'
spec = importlib.util.spec_from_file_location('verify_macos', script)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def macho(minimum, cpu=0x1000007, framework=False):
    commands = struct.pack('<IIIIII', 0x32, 24, 1, minimum, 0x0e0500, 0)
    if framework:
        name = b'/System/Library/Frameworks/ScreenCaptureKit.framework/ScreenCaptureKit\0'
        commands += struct.pack('<IIIIII', 0xc, 24 + len(name), 24, 0, 0, 0) + name
    return struct.pack('<IIIIIIII', 0xfeedfacf, cpu, 3, 2, 2 if framework else 1, len(commands), 0, 0) + commands


class Compatibility(unittest.TestCase):
    def test_accepts_monterey(self):
        self.assertEqual(verifier.inspect(macho(0x0c0000)), [0x1000007])

    def test_rejects_upstream_sonoma_minimum(self):
        with self.assertRaises(AssertionError):
            verifier.inspect(macho(0x0e0000))

    def test_rejects_mandatory_framework_missing_on_12_0(self):
        with self.assertRaises(AssertionError):
            verifier.inspect(macho(0x0c0000, framework=True))

    def test_checks_both_universal_slices(self):
        def universal(second):
            first = macho(0x0c0000)
            header = struct.pack('>II', 0xcafebabe, 2)
            header += struct.pack('>IIIII', 0x1000007, 3, 48, len(first), 0)
            header += struct.pack('>IIIII', 0x100000c, 0, 48 + len(first), len(second), 0)
            return header + first + second
        self.assertEqual(verifier.inspect(universal(macho(0x0c0000, 0x100000c))), [0x1000007, 0x100000c])
        with self.assertRaises(AssertionError):
            verifier.inspect(universal(macho(0x0e0000, 0x100000c)))


if __name__ == '__main__':
    unittest.main()
