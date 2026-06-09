# i18n quality backlog — literal vs. idiomatic

This file tracks translation entries in `src/context/language-context.tsx`
that read as **dictionary-literal** rather than **idiomatic Indian SaaS
usage**. Many were committed in earlier passes when the priority was
"any translation > English fallback"; the tighter pass is to make every
visible string sound natural to the audience.

## Convention

For tech UI terms, real Indian SaaS sites (Razorpay, Zoho, Freshworks,
Postman, BYJU'S Learning App, Khan Academy India) consistently use
**transliteration** for words that have no clean native equivalent:

| Term | Bad (literal) | Good (idiomatic) |
|---|---|---|
| Product | उत्पाद (FMCG) | प्रोडक्ट |
| Pricing | कीमत (price tag) | मूल्य / प्लान्स |
| Visual Aid Designer | दृश्य सहायक डिज़ाइनर | विज़ुअल एड डिज़ाइनर |
| Content Creator | सामग्री निर्माता | कंटेंट क्रिएटर |
| Virtual Field Trip | आभासी क्षेत्र यात्रा | वर्चुअल फील्ड ट्रिप |
| Teacher Training | शिक्षक प्रशिक्षण (formal) | टीचर ट्रेनिंग |
| Settings | सेटिंग्स | (already good) |
| Dashboard | डैशबोर्ड | (transliterate) |
| Notifications | सूचनाएँ | (acceptable) |

The same pattern applies in Tamil, Telugu, Bengali, Marathi, Gujarati,
Kannada, Malayalam, Punjabi, Odia. Where I am confident, I have already
applied transliterations. Where I am not, the entry stays awkward and
needs review by a native speaker.

## Already fixed (commit pending)

- Product (all 11 languages → transliterated)
- Pricing (all 11 → "मूल्य" + equivalents)
- Visual Aid Designer (all 11 → transliterated)
- Content Creator (all 11 → transliterated)
- Virtual Field Trip (all 11 → transliterated)
- Teacher Training (all 11 → transliterated)

## Outstanding — likely awkward, needs review pass

These were not changed in the focused fix and may still read literal:

- "Run the school" → "विद्यालय का संचालन करते हैं" (verbose; should be "स्कूल चलाते हैं")
- "Group discussion" → "समूह चर्चा" (formal; "ग्रुप चर्चा" or "ग्रुप डिस्कशन" more natural)
- "Withdraw request" → "अनुरोध वापस लें" (formal)
- "Detailed impact dashboard" — verify each word renders well
- "AI-powered parent messages" — verify
- All 5 E's pillar names (Engage, Explore, Explain, Elaborate, Evaluate) — currently formal Hindi, fine for Bloom's-taxonomy context but worth confirming
- All 7 weekday/time strings (Today, Saved on, etc.)

## Approach for the rest

The dictionary has 322 keys × 11 languages ≈ 3,500 individual values.
Auditing every one for idiomatic quality is a multi-hour native-review
job. Recommended path:

1. **Triage by visibility** — fix nav, CTAs, hero, top-level page titles
   first (highest impact per fix). Skip rarely-seen toast messages
   until after.
2. **Hindi first**, then propagate the pattern to other 10. Hindi has
   the most users and the most established SaaS convention.
3. **Get a native speaker** for each language to do a final pass — I
   can produce reasonable transliterations but cannot guarantee that
   every Tamil / Malayalam / Punjabi etc. line reads naturally. Mark
   reviewed ones with a `// REVIEWED-BY: <name>, YYYY-MM` comment so
   the work doesn't get re-flagged.

## Why the literals existed in the first place

Earlier i18n commits prioritized **coverage** over **register**. A
machine-translated value is technically a value, so the audit "are all
keys translated?" returned green. But "are all keys idiomatic?" was
never asked. The new `scripts/audit-i18n-source.sh` catches missing
translations; it does NOT catch awkward ones. That second-order
quality is what this backlog tracks.
