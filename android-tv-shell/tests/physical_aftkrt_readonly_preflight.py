#!/usr/bin/env python3
"""Strictly read-only AFTKRT pre-installation identification and policy check.

Requires an explicit, already-authorised ADB target. Never installs, pairs,
connects, launches, signs, captures screens, reads accounts or edits settings.
"""
import argparse
import re
import shutil
import subprocess
import sys

OFFICIAL = "com.stremio.one"
LAB = "org.thiajay.stremioenhanced.tv"

def checked(adb, serial, *args):
    # Never send any ADB operations to the other discovered unauthorised device.
    result = subprocess.run(
        [adb, "-s", serial, "shell", *args],
        stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=15)
    if result.returncode:
        raise RuntimeError("DEVICE_READ_FAILED")
    return result.stdout.strip()

def evaluate(adb, serial):
    if not re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}:5555", serial):
        raise RuntimeError("ADB_TARGET_NOT_EXPLICIT_PRIVATE_TCP")
    import ipaddress
    host = ipaddress.IPv4Address(serial.split(":")[0])
    if not host.is_private or host.is_loopback or host.is_link_local:
        raise RuntimeError("ADB_TARGET_NOT_PRIVATE_LAN")

    version = subprocess.run([adb, "devices", "-l"],
                             stdin=subprocess.DEVNULL, capture_output=True,
                             text=True, timeout=15)
    if version.returncode:
        raise RuntimeError("ADB_LIST_FAILED")
    states = {}
    for line in version.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 2 and ":" in parts[0]:
            states[parts[0]] = parts[1]
    if states.get(serial) != "device":
        raise RuntimeError("TARGET_NOT_AUTHORISED")
    model = checked(adb, serial, "getprop", "ro.product.model")
    manufacturer = checked(adb, serial, "getprop", "ro.product.manufacturer")
    api = checked(adb, serial, "getprop", "ro.build.version.sdk")
    abi = checked(adb, serial, "getprop", "ro.product.cpu.abi")
    if model.upper() != "AFTKRT" or manufacturer.lower() != "amazon":
        raise RuntimeError("NOT_VERIFIED_AMAZON_AFTKRT")
    if api != "30" or abi != "armeabi-v7a":
        raise RuntimeError("HARDWARE_API_OR_ABI_CHANGED")

    official = checked(adb, serial, "pm", "path", OFFICIAL)
    if not official.startswith("package:"):
        raise RuntimeError("OFFICIAL_STREMIO_NOT_INSTALLED")
    lab = checked(adb, serial, "pm", "path", LAB)
    if lab:
        raise RuntimeError("EXISTING_LAB_PACKAGE_REQUIRES_RECONCILIATION")
    package = checked(adb, serial, "dumpsys", "package", OFFICIAL)
    found = re.search(r"(?m)^\s*versionName=([^\s]+)", package)
    if not found or found.group(1) != "1.11.2":
        raise RuntimeError("OFFICIAL_PACKAGE_VERSION_CHANGED")

    webview = checked(adb, serial, "dumpsys", "webviewupdate")
    if ("com.amazon.webview.chromium" not in webview or
            "Valid package com.amazon.webview.chromium" not in webview):
        raise RuntimeError("EXPECTED_AMAZON_WEBVIEW_UNAVAILABLE")
    # Do not print identifiers or package dumps. The entire operation is read-only.
    return ("AFTKRT_READ_ONLY_HARDWARE_PRESERVATION_PASS "
            "API30 ARMV7 WEBVIEW_VALID "
            "OFFICIAL_STREMIO_1_11_2_UNCHANGED "
            "SEPARATE_LAB_PACKAGE_NOT_PRESENT")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True, help="Exact authorised ADB TCP transport")
    args = parser.parse_args()
    adb = shutil.which("adb")
    if adb is None:
        print("AFTKRT_HOLD_ADB_MISSING")
        return 2
    try:
        print(evaluate(adb, args.serial))
        return 0
    except Exception as ex:
        # Only our own fixed categories, never serials, stderr or package dumps.
        code = str(ex)
        categories = {
            "ADB_TARGET_NOT_EXPLICIT_PRIVATE_TCP",
            "ADB_TARGET_NOT_PRIVATE_LAN",
            "ADB_LIST_FAILED",
            "TARGET_NOT_AUTHORISED",
            "NOT_VERIFIED_AMAZON_AFTKRT",
            "HARDWARE_API_OR_ABI_CHANGED",
            "OFFICIAL_STREMIO_NOT_INSTALLED",
            "EXISTING_LAB_PACKAGE_REQUIRES_RECONCILIATION",
            "OFFICIAL_PACKAGE_VERSION_CHANGED",
            "EXPECTED_AMAZON_WEBVIEW_UNAVAILABLE",
            "DEVICE_READ_FAILED",
        }
        print("AFTKRT_HOLD_" + (code if code in categories else "UNEXPECTED_READ_ERROR"))
        return 2

if __name__ == "__main__":
    sys.exit(main())
