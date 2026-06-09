# MVP Quality Improvement Change Log

| Date | Work Unit | Change | Why it changed | User Impact | Risk |
|------|-----------|--------|----------------|-------------|------|
| Dec 15 | **Home Page** | **Removed Blur** | Performance on low-end Android was poor. | Smoother scrolling on budget phones. | Low |
| Dec 15 | **Home Page** | **Mobile Actions** | "Start" text was hidden until hover. | Features are now discoverable on mobile. | Low |
| Dec 15 | **Home Page** | **Safety Disclaimer** | Added "AI can make mistakes" text. | Sets realistic expectations. | Low |
| Dec 15 | **Home Page** | **Rate Limiter** | Added client-side Token Bucket (5/10min). | Prevents accidental quota exhaustion. | Medium |
| Dec 15 | **Home Page** | **Content Safety** | Added regex-based keyword blocklist. | Prevents generation of harmful content. | Low |
| Dec 15 | **Lesson Plan** | **Input Reorder** | Moved "Generate" button above Sidebar on mobile. | Eliminates the "Scroll Wall" friction. | Low |
| Dec 15 | **Lesson Plan** | **Collapsed Settings** | Hid Resources/Difficulty behind "Advanced". | Reduces cognitive load/form fatigue. | Low |
| Dec 15 | **Lesson Plan** | **Unified Layout** | Removed nested borders, added vertical divider. | cleaner, less "patchy" UI. | Low |
