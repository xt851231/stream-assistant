## 2024-05-24 - [Cache Style Utilities]
**Learning:** Utilities generating styles dynamically, such as parsing hex strings to `rgba`, often perform redundant logic like string replacement (`#`) and hex parsing (`parseInt(x, 16)`) during each component render when styles rely on JS.
**Action:** When identifying style calculation functions called frequently within a component render cycle, cache the intermediate values (like parsed RGB strings) using a simple `Map` keyed by the input string to bypass redundant processing while still applying dynamic values like opacity.
