The plan and usage card on the teacher's profile: what SahayakAI did this month, the plan, and the quota.

**Use**
- Once, near the top of Me (Profile), under the teacher's name.
- `plan` with `planTone="saffron"` for a free or trial plan; `planTone="leaf"` with `showQuota={false}` for a school plan without a monthly quota.

**The consumer provides** `stats` (up to three: "31 made", "14h saved", "3 classes"), `used` (0-100), `quotaText` (the spoken value, e.g. "62% used, resets on 1 Nov"), `live` (VIDYA Live minutes `left` and `total`, with translated `label` and `leftText`), the `note`, and translated `title`, `plan` and labels.

**Rules**
- Count what the teacher gained (made, hours saved, classes), not what she spent.
- The note promises the rule that matters: "Quota is per conversation; refining never locks you out mid-task." Keep it whenever the bar shows.
- The bar is a real progressbar (`ProgressBar`, 6px, saffron); its value is also spoken through `quotaText`.
- Stats are a `<dl>`: each reads label then value, and draws value on top.
- Values 26px `font-display`; labels and note 12px `text-body` (the 12px floor); the eyebrow is the section's heading.
- **VIDYA Live minutes** show on every plan, because Live is metered: "VIDYA Live" and "18 min left" over a 6px indigo bar of minutes used. At 5 minutes or fewer the count turns saffron-700. This is the one place a teacher reads her minutes; Live itself only adds a quiet pill near the end (see `LiveHeader`).
