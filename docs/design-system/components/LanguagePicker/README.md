The language choice: the first few languages as chips in their own script, then "+7 more" opening all eleven.

**Use** at onboarding and in Profile, under a "Language" `Eyebrow`. It sets the language VIDYA speaks and writes in. The chips are `saffron` `Chip`s with `strong` text. The "more" chip opens an `OptionSheet` that lists every language by its native name, with the English name as meta, and can be searched by either ("Tamil" finds தமிழ்).

**The consumer provides** either `value` + `onChange` or `defaultValue`, as a code from `SahayakAI.LANGUAGES`. It can also provide `visible` (how many chips show; default 4), `order` (default हिन्दी, मराठी, English, বাংলা; set it to the teacher's region, for example বাংলা first in West Bengal) and a translated `label`. Place it inside the positioned screen so the sheet rises over the whole screen, and dim the page behind to .34 while it is open. Four chips and "+7 more" fit the 320px between the screen gutters on two lines.

**Data:** `SahayakAI.LANGUAGES` lists 11 entries as `[code, native, english]`: en English, hi हिन्दी, kn ಕನ್ನಡ, ta தமிழ், te తెలుగు, mr मराठी, bn বাংলা, gu ગુજરાતી, pa ਪੰਜਾਬੀ, ml മലയാളം, or ଓଡ଼ିଆ.

**Behaviour**
- The chosen language always shows. If it was picked from the sheet, it takes the last chip slot, so the row keeps its length.
- Choosing in the sheet closes it and returns focus to "+7 more".

**Rules**
- Language names are always in their own script, never transliterated or translated, and each chip and row carries its `lang`. Indic names are never letter-spaced.
- The chips are a named group, and only one is pressed at a time.
- "+7 more" is named "+7 more languages" for assistive tech.
