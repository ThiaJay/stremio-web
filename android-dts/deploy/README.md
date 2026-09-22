# Stremio DTS deployment kit

This folder is the Commander independent device deployment path.

Place the correctly signed replacement APK beside the scripts and name it stremio-dts-fix.apk.

Run Run-Deploy.cmd.

The script locates adb or downloads Google's official Android Platform Tools package. It requires exactly one already authorised Android device unless ANDROID_SERIAL is set.

The installer uses adb install with replacement only. It never calls adb uninstall, pm clear or any command intended to remove the installed Stremio package or its data.

If Android rejects the APK because its signing certificate differs from the installed official Stremio application, deployment stops and the official installation remains in place.

A preinstall receipt containing the device identifier, APK SHA 256 and package state is written locally before the install attempt.

This kit does not bypass Android signature security. A build intended to replace the official application must be signed compatibly with the installed package.
