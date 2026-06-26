import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/desktop_window_stub.dart'
    if (dart.library.io) 'core/desktop_window_desktop.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await configureDesktopWindow();
  runApp(const SgccExamApp());
}
