import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:window_manager/window_manager.dart';

Future<void> configureDesktopWindow() async {
  if (!Platform.isWindows && !Platform.isLinux && !Platform.isMacOS) return;

  WidgetsFlutterBinding.ensureInitialized();
  await windowManager.ensureInitialized();

  const size = Size(430, 860);
  const options = WindowOptions(
    size: size,
    minimumSize: size,
    maximumSize: size,
    center: true,
    title: '电力考试刷题',
    backgroundColor: Color(0xFFF3F6F8),
  );

  await windowManager.waitUntilReadyToShow(options, () async {
    await windowManager.show();
    await windowManager.focus();
  });
}
