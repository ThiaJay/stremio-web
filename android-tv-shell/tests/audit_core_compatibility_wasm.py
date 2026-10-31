#!/usr/bin/env python3
"""Audit a rebuilt Core WASM without publishing binary contents."""
from __future__ import annotations

import argparse
from pathlib import Path

KNOWN_FEATURES = {
    "mutable-globals", "sign-ext", "bulk-memory", "reference-types",
    "simd128", "relaxed-simd", "atomics", "multivalue",
    "nontrapping-fptoint", "exception-handling", "extended-const",
    "tail-call", "multimemory", "multi-memory", "memory64", "gc",
    "typed-funcref", "wide-arithmetic", "call-indirect-overlong",
    "bulk-memory-opt", "fp16",
}
API30_SAFE_ENABLED = {
    "mutable-globals", "sign-ext", "bulk-memory", "multivalue",
    "nontrapping-fptoint",
}


class WasmAuditError(ValueError):
    pass


def _uleb(data: memoryview, offset: int) -> tuple[int, int]:
    value = 0
    for shift in range(0, 35, 7):
        if offset >= len(data):
            raise WasmAuditError("truncated uleb")
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if byte & 0x80 == 0:
            return value, offset
    raise WasmAuditError("oversized uleb")


def _name(data: memoryview, offset: int) -> tuple[str, int]:
    size, offset = _uleb(data, offset)
    if size > len(data) - offset:
        raise WasmAuditError("invalid name length")
    try:
        value = bytes(data[offset:offset + size]).decode("utf-8")
    except UnicodeDecodeError as error:
        raise WasmAuditError("invalid utf8 name") from error
    return value, offset + size


def parse_target_features(raw: bytes) -> list[tuple[str, str]] | None:
    data = memoryview(raw)
    if len(data) < 8 or bytes(data[:8]) != b"\0asm\1\0\0\0":
        raise WasmAuditError("invalid wasm header")
    features = None
    offset = 8
    while offset < len(data):
        kind = data[offset]
        offset += 1
        size, offset = _uleb(data, offset)
        if size > len(data) - offset:
            raise WasmAuditError("invalid section length")
        section = data[offset:offset + size]
        offset += size
        if kind != 0:
            continue
        section_name, cursor = _name(section, 0)
        if section_name != "target_features":
            continue
        if features is not None:
            raise WasmAuditError("duplicate target_features section")
        count, cursor = _uleb(section, cursor)
        if count > 64:
            raise WasmAuditError("oversized target feature count")
        found = []
        for _ in range(count):
            if cursor >= len(section):
                raise WasmAuditError("truncated target feature")
            sign = chr(section[cursor])
            cursor += 1
            feature, cursor = _name(section, cursor)
            if sign not in {"+", "-"} or not feature or len(feature) > 63:
                raise WasmAuditError("invalid target feature")
            if feature not in KNOWN_FEATURES:
                raise WasmAuditError("unrecognised target feature")
            found.append((sign, feature))
        if cursor != len(section):
            raise WasmAuditError("target feature trailing data")
        features = found
    return features


def audit(raw: bytes, bounded: bool = True) -> list[tuple[str, str]]:
    if bounded and not 100_000 < len(raw) < 12_000_000:
        raise WasmAuditError("wasm size outside reviewed bound")
    features = parse_target_features(raw) or []
    enabled = {feature for sign, feature in features if sign == "+"}
    if "reference-types" in enabled:
        raise WasmAuditError("reference types remain enabled")
    unexpected = enabled - API30_SAFE_ENABLED
    if unexpected:
        raise WasmAuditError("unqualified enabled target feature")
    return features


def _encode_uleb(value: int) -> bytes:
    output = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            output.append(byte | 0x80)
        else:
            output.append(byte)
            return bytes(output)


def _encode_name(value: str) -> bytes:
    raw = value.encode("utf-8")
    return _encode_uleb(len(raw)) + raw


def _fixture(features: list[tuple[str, str]] | None) -> bytes:
    raw = bytearray(b"\0asm\1\0\0\0")
    if features is not None:
        payload = bytearray(_encode_name("target_features"))
        payload.extend(_encode_uleb(len(features)))
        for sign, feature in features:
            payload.append(ord(sign))
            payload.extend(_encode_name(feature))
        raw.append(0)
        raw.extend(_encode_uleb(len(payload)))
        raw.extend(payload)
    return bytes(raw)


def self_test() -> None:
    assert audit(_fixture(None), bounded=False) == []
    safe = [("+", "bulk-memory"), ("+", "multivalue"),
            ("-", "reference-types")]
    assert audit(_fixture(safe), bounded=False) == safe
    for rejected in [
        [("+", "reference-types")],
        [("+", "simd128")],
    ]:
        try:
            audit(_fixture(rejected), bounded=False)
        except WasmAuditError:
            pass
        else:
            raise AssertionError("unsafe feature fixture was accepted")
    for malformed in [b"", b"\0asm\1\0\0\0\0\x7f"]:
        try:
            audit(malformed, bounded=False)
        except WasmAuditError:
            pass
        else:
            raise AssertionError("malformed fixture was accepted")
    print("CORE_COMPATIBILITY_WASM_AUDITOR_SELF_TEST_PASS")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("wasm", nargs="?")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    if args.wasm:
        raw = Path(args.wasm).read_bytes()
        features = audit(raw)
        print("CORE_COMPATIBILITY_WASM_CONTAINER_PASS")
        print("CORE_COMPATIBILITY_REFERENCE_TYPES_NOT_ENABLED")
        for sign, feature in sorted(features):
            print("CORE_COMPATIBILITY_FEATURE_" +
                  ("ENABLED_" if sign == "+" else "DISABLED_") +
                  feature.upper().replace("-", "_"))
    if not args.self_test and not args.wasm:
        parser.error("provide --self-test and/or a wasm path")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
