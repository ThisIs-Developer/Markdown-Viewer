#!/usr/bin/env python3
"""Check every Mach-O slice, including embedded-resource outputs, before shipping."""
import pathlib
import struct
import argparse
from macos_support import CPU_ARCHITECTURES, DEPLOYMENT_TARGETS, PACKAGE_ARCHITECTURES, packed_version


def inspect(data):
    if data[:4] == b'\xca\xfe\xba\xbe':
        count = struct.unpack_from('>I', data, 4)[0]
        slices = []
        for index in range(count):
            _, _, offset, size, _ = struct.unpack_from('>IIIII', data, 8 + index * 20)
            slices.extend(inspect(data[offset:offset + size]))
        assert len(slices) == count
        return slices
    assert data[:4] == b'\xcf\xfa\xed\xfe', 'Expected a 64-bit Mach-O executable'
    cpu = struct.unpack_from('<I', data, 4)[0]
    commands = struct.unpack_from('<I', data, 16)[0]
    offset, minimum = 32, None
    for _ in range(commands):
        command, size = struct.unpack_from('<II', data, offset)
        assert size >= 8 and offset + size <= len(data)
        if command == 0x32:  # LC_BUILD_VERSION
            platform, minimum = struct.unpack_from('<II', data, offset + 8)
            assert platform == 1, 'Expected macOS'
        elif command == 0x24:  # LC_VERSION_MIN_MACOSX
            minimum = struct.unpack_from('<I', data, offset + 8)[0]
        elif command == 0xc:  # LC_LOAD_DYLIB (mandatory, not weak)
            start = struct.unpack_from('<I', data, offset + 8)[0]
            name = data[offset + start:offset + size].split(b'\0')[0]
            assert b'ScreenCaptureKit' not in name, 'Mandatory ScreenCaptureKit prevents older macOS launch'
        offset += size
    assert cpu in CPU_ARCHITECTURES, f'Unexpected architecture: {cpu}'
    target = DEPLOYMENT_TARGETS[CPU_ARCHITECTURES[cpu]]
    assert minimum is not None and 0 < minimum <= packed_version(target), f'{CPU_ARCHITECTURES[cpu]} runtime requires macOS newer than its native dependency baseline {target}: {minimum}'
    return [cpu]


def verify(data, package_arch):
    slices = inspect(data)
    architectures = [CPU_ARCHITECTURES[cpu] for cpu in slices]
    assert sorted(architectures) == sorted(PACKAGE_ARCHITECTURES[package_arch]), f'Wrong slices for {package_arch}: {architectures}'
    return architectures


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--arch', choices=PACKAGE_ARCHITECTURES, required=True)
    parser.add_argument('filenames', nargs='+')
    args = parser.parse_args()
    for filename in args.filenames:
        slices = verify(pathlib.Path(filename).read_bytes(), args.arch)
        print(f'PASS native macOS compatibility load commands: {filename} ({", ".join(slices)})')
