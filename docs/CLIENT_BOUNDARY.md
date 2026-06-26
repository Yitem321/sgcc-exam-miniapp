# Client Boundary

This repository has two independent clients:

- `miniprogram/`: WeChat Mini Program
- `flutter_app/`: Flutter App

They may share backend data contracts, but they must not share frontend implementation code.

## Hard Boundaries

Do not move, copy, or import these across clients:

- WeChat pages
- WeChat components
- WXML
- WXSS
- WeChat page JS
- WeChat routing config
- Flutter Dart pages
- Flutter widgets
- Flutter routes
- Flutter design system components

## Allowed Sharing

The clients may share:

- `server/` API endpoints
- Data field names documented in `docs/API_CONTRACT.md`
- Business concepts such as question bank, practice mode, wrong book, favorites, study records, and AI explanation
- Product behavior descriptions documented in `docs/`

## Not Allowed

- Do not place `.dart` files under `miniprogram/`.
- Do not place `.wxml`, `.wxss`, or WeChat page `.js` files under `flutter_app/lib/`.
- Do not create a shared frontend UI directory unless it contains documentation or generated design references only.
- Do not change one client to match the other by copying page code.
- Do not change public API paths unless the old path remains supported.
- Do not change existing question JSON structure.

## Recommended Workflow

1. Define shared behavior in `docs/API_CONTRACT.md`.
2. Implement backend support in `server/`.
3. Implement WeChat behavior using WeChat-native pages and APIs.
4. Implement Flutter behavior using Dart and Flutter-native widgets.
5. Test both clients against the same server API.

## Common Risk Areas

- Field naming drift: `question_type` vs `questionType` vs `type`.
- Login behavior drift: WeChat login is Mini Program specific.
- Payment behavior drift: WeChat Pay is not a generic Flutter payment implementation.
- Local cache behavior drift: Mini Program and Flutter use different local storage systems.
- UI text encoding issues: fix in each client separately without cross-copying files.
