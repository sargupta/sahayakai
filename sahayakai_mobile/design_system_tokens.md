# SAHAYAK DESIGN TOKEN SCHEMA (FIGMA → FLUTTER READY)

## 1. Token Naming Convention

```
{layer}.{category}.{role}.{state}.{variant}
```

Examples:

* `base.color.primary.default`
* `studio.wizard.color.accent`
* `locale.hi.typography.body.fontFamily`
* `motion.aiThinking.curve.standard`

---

## 2. Token Layers

### 2.1 Base Layer (Material You Compatible)

```
base/
 ├── color/
 │   ├── primary
 │   ├── secondary
 │   ├── surface
 │   ├── background
 │   ├── error
 │   ├── success
 │   ├── warning
 │   └── outline
 │
 ├── typography/
 │   ├── display
 │   ├── headline
 │   ├── title
 │   ├── body
 │   └── label
 │
 ├── spacing/
 ├── radius/
 ├── elevation/
 └── motion/
```

---

## 3. Brand Layer — Saffron Core

### 3.1 Color Tokens

```
brand.color.saffron.primary
brand.color.saffron.deep
brand.color.saffron.light
brand.color.ink
brand.color.paper
brand.color.royalBlue
brand.color.indigo
brand.color.forestGreen
brand.color.plum
brand.color.rose
brand.color.slate
```

### 3.2 Typography Tokens

```
brand.typography.latin.primary = "Inter"
brand.typography.indic.primary = "Outfit"
brand.typography.arabic.primary = "Noto Naskh Arabic"
brand.typography.cjk.primary = "Noto Sans CJK"
```

---

## 4. Studio Overlay Tokens

Each Studio overrides:

```
studio.{name}.color.primary
studio.{name}.color.surface
studio.{name}.color.accent
studio.{name}.color.gradient.start
studio.{name}.color.gradient.end

studio.{name}.motion.curve
studio.{name}.motion.duration.short
studio.{name}.motion.duration.standard

studio.{name}.layout.density
studio.{name}.radius.card
studio.{name}.radius.sheet
```

### Example: Wizard Studio

```
studio.wizard.color.primary = brand.color.saffron.primary
studio.wizard.color.accent = #FFB703
studio.wizard.motion.curve = easeOutCubic
studio.wizard.layout.density = medium
```

### Example: Director’s Cut Studio

```
studio.director.color.primary = #5B2D8B
studio.director.color.surface = #0F0A1F
studio.director.motion.curve = cinematicEase
studio.director.layout.density = spacious
```

---

## 5. Locale Layer (Internationalisation)

```
locale.{lang}.typography.fontFamily
locale.{lang}.typography.lineHeightScale
locale.{lang}.layout.densityMultiplier
locale.{lang}.numeral.system
locale.{lang}.direction
locale.{lang}.voice.tone
```

### Example: Hindi (hi-IN)

```
locale.hi.typography.fontFamily = brand.typography.indic.primary
locale.hi.typography.lineHeightScale = 1.15
locale.hi.layout.densityMultiplier = 1.1
locale.hi.direction = ltr
locale.hi.voice.tone = warm
```

### Example: Arabic (ar)

```
locale.ar.direction = rtl
locale.ar.typography.fontFamily = brand.typography.arabic.primary
locale.ar.layout.densityMultiplier = 1.2
```

---

## 6. Motion Tokens (AI Native)

```
motion.ai.thinking.curve
motion.ai.thinking.duration
motion.success.curve
motion.error.curve
motion.voice.waveform.speed
motion.page.transition.standard
motion.page.transition.modal
```

---

## 7. Accessibility Tokens

```
accessibility.contrast.high
accessibility.textScale.max
accessibility.motion.reduce
accessibility.focus.outlineWidth
```

---

## 8. Festival / Event Overlay (Remote Config)

```
event.diwali.color.primary
event.diwali.color.glow
event.diwali.motion.sparkle
event.ramadan.color.surface
event.christmas.color.accent
```

---

## 9. Component Semantic Tokens

Instead of hard color references:

```
component.button.primary.bg
component.button.primary.text
component.card.surface
component.chip.selected.bg
component.slider.track.active
component.voice.mic.glow
component.ai.loader.gradient
```

These resolve dynamically via:
Base → Brand → Studio → Locale → Event → Accessibility

---

## 10. Figma Variable Structure

In Figma Variables Panel:

### Collections

1. **Base**
2. **Brand**
3. **Studio**
4. **Locale**
5. **Event**
6. **Accessibility**
7. **Component Semantic**

Each variable has modes:

* Light
* Dark
* HighContrast
* Festival
* ReducedMotion

---

## 11. Mapping to Flutter

Each Figma token maps to:

```dart
class SahayakColors extends ThemeExtension<SahayakColors> {
  final Color primary;
  final Color accent;
  final Color studioSurface;
  final Gradient aiLoader;
}
```

Bound by:

* `StudioProvider`
* `LocaleProvider`
* `RemoteConfigProvider`
