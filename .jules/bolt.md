## 2024-05-18 - [Optimize getBgColor]
**Learning:** `getBgColor` is called heavily in components like ChatMessage, Toolbelt, ChatSidebar, MediaControlHub, etc., often dynamically with state/prop updates (e.g. ChatMessage iterates over list of messages, calling `getBgColor` for each). The current implementation parses hex color strings and slices string every single time.
**Action:** Implementing a memoized version/caching mechanism for `getBgColor` avoids repeated string parsing, slicing, and hex conversions. This improves render time, especially for components listing many items.
