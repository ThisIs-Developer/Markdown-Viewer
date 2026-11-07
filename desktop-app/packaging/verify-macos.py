#!/usr/bin/env python3
"""Check every Mach-O slice, including embedded-resource outputs, before shipping."""
import pathlib
import struct
import sys


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
            assert b'ScreenCaptureKit' not in name, 'ScreenCaptureKit prevents macOS 12.0 launch'
        offset += size
    assert minimum is not None and minimum <= 0x0c0000, f'Runtime requires macOS newer than 12.0: {minimum}'
    assert cpu in (0x1000007, 0x100000c), f'Unexpected architecture: {cpu}'
    return [cpu]


if __name__ == '__main__':
    for filename in sys.argv[1:]:
        slices = inspect(pathlib.Path(filename).read_bytes())
        print(f'PASS macOS 12.0 load commands: {filename} ({len(slices)} slices)')
