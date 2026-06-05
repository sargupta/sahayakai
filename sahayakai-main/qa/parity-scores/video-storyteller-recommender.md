# Parity scores — video-storyteller (recommender mode)

- Cells scored: 42
- Pass rate: 61.9%
- Canary-ready: NO

Thresholds: jaccard ≥ 0.1, topical ≥ 0.4, message cosine ≥ 0.75, script ≥ 0.90, no bleed.

| Cell | Lang | Structural | Jaccard | Topical | Msg cos | Script | Bleed | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bn-g3-hindi-kahaani.json | bn | 1 | 0.150 | 0.000 | 0.870 | 21.9% | YES (hi) | FAIL |
| bn-g3-math-fractions.json | bn | 1 | 0.342 | 0.000 | 0.895 | 93.5% | no | PASS |
| bn-g3-science-watercycle.json | bn | 1 | 0.418 | 0.000 | 0.932 | 93.5% | no | PASS |
| bn-g7-math-algebra.json | bn | 1 | 0.286 | 0.000 | 0.894 | 99.6% | no | PASS |
| en-g3-hindi-kahaani.json | en | 1 | 0.434 | 0.857 | 0.912 | 100.0% | no | PASS |
| en-g3-math-fractions.json | en | 1 | 0.543 | 0.960 | 0.913 | 100.0% | no | PASS |
| en-g3-science-watercycle.json | en | 1 | 0.487 | 0.500 | 0.897 | 100.0% | no | PASS |
| en-g7-math-algebra.json | en | 1 | 0.406 | 0.880 | 0.908 | 100.0% | no | PASS |
| gu-g3-hindi-kahaani.json | gu | 1 | 0.226 | 0.000 | 0.867 | 88.1% | no | FAIL |
| gu-g3-math-fractions.json | gu | 1 | 0.333 | 0.000 | 0.884 | 91.7% | no | PASS |
| gu-g3-science-watercycle.json | gu | 1 | 0.058 | 0.520 | 0.899 | 16.7% | no | FAIL |
| gu-g7-math-algebra.json | gu | 1 | 0.349 | 0.000 | 0.870 | 90.6% | no | PASS |
| hi-g3-hindi-kahaani.json | hi | 1 | 0.474 | 0.000 | 0.854 | 100.0% | no | PASS |
| hi-g3-math-fractions.json | hi | 1 | 0.303 | 0.000 | 0.830 | 100.0% | no | PASS |
| hi-g3-science-watercycle.json | hi | 1 | 0.326 | 0.000 | 0.910 | 99.3% | no | PASS |
| hi-g7-math-algebra.json | hi | 1 | 0.386 | 0.000 | 0.916 | 95.0% | no | PASS |
| kn-g3-hindi-kahaani.json | kn | 1 | 0.053 | 0.000 | 0.903 | 17.5% | YES (hi) | FAIL |
| kn-g3-math-fractions.json | kn | 1 | 0.248 | 0.240 | 0.853 | 72.2% | no | FAIL |
| kn-g3-science-watercycle.json | kn | 1 | 0.103 | 0.480 | 0.905 | 24.4% | no | FAIL |
| kn-g7-math-algebra.json | kn | 1 | 0.342 | 0.000 | 0.894 | 92.6% | no | PASS |
| ml-g3-hindi-kahaani.json | ml | 1 | 0.064 | 0.000 | 0.910 | 94.0% | no | FAIL |
| ml-g3-math-fractions.json | ml | 1 | 0.123 | 0.682 | 0.856 | 43.2% | no | FAIL |
| ml-g3-science-watercycle.json | ml | 1 | 0.225 | 0.000 | 0.904 | 100.0% | no | PASS |
| ml-g7-math-algebra.json | ml | 1 | 0.329 | 0.000 | 0.881 | 93.9% | no | PASS |
| mr-g3-hindi-kahaani.json | mr | 1 | 0.352 | 0.000 | 0.882 | 91.6% | no | PASS |
| mr-g3-math-fractions.json | mr | 1 | 0.300 | 0.000 | 0.937 | 97.1% | no | PASS |
| mr-g3-science-watercycle.json | mr | 1 | 0.364 | 0.000 | 0.886 | 93.6% | no | PASS |
| mr-g7-math-algebra.json | mr | 1 | 0.411 | 0.000 | 0.906 | 95.4% | no | PASS |
| or-g3-hindi-kahaani.json | or | 1 | 0.106 | 0.840 | 0.908 | 20.1% | no | FAIL |
| or-g3-math-fractions.json | or | 1 | 0.083 | 0.720 | 0.765 | 21.1% | no | FAIL |
| or-g3-science-watercycle.json | or | 1 | 0.512 | 0.720 | 0.898 | 14.4% | no | FAIL |
| pa-g3-hindi-kahaani.json | pa | 1 | 0.103 | 0.000 | 0.914 | 22.3% | YES (hi) | FAIL |
| pa-g3-math-fractions.json | pa | 1 | 0.524 | 0.720 | 0.864 | 15.1% | no | FAIL |
| pa-g3-science-watercycle.json | pa | 1 | 0.107 | 0.480 | 0.920 | 21.1% | no | FAIL |
| ta-g3-hindi-kahaani.json | ta | 1 | 0.024 | 0.000 | 0.898 | 28.5% | YES (hi) | FAIL |
| ta-g3-math-fractions.json | ta | 1 | 0.337 | 0.000 | 0.899 | 94.8% | no | PASS |
| ta-g3-science-watercycle.json | ta | 1 | 0.378 | 0.000 | 0.943 | 93.4% | no | PASS |
| ta-g7-math-algebra.json | ta | 1 | 0.307 | 0.000 | 0.804 | 94.5% | no | PASS |
| te-g3-hindi-kahaani.json | te | 1 | 0.041 | 0.000 | 0.918 | 100.0% | no | FAIL |
| te-g3-math-fractions.json | te | 1 | 0.352 | 0.000 | 0.916 | 98.7% | no | PASS |
| te-g3-science-watercycle.json | te | 1 | 0.270 | 0.000 | 0.885 | 92.8% | no | PASS |
| te-g7-math-algebra.json | te | 1 | 0.362 | 0.000 | 0.919 | 93.3% | no | PASS |

## Failures
- **bn-g3-hindi-kahaani.json** — topical, script, bleed
- **gu-g3-hindi-kahaani.json** — script
- **gu-g3-science-watercycle.json** — jaccard, script
- **kn-g3-hindi-kahaani.json** — jaccard, script, bleed
- **kn-g3-math-fractions.json** — script
- **kn-g3-science-watercycle.json** — script
- **ml-g3-hindi-kahaani.json** — jaccard, topical
- **ml-g3-math-fractions.json** — script
- **or-g3-hindi-kahaani.json** — script
- **or-g3-math-fractions.json** — jaccard, script
- **or-g3-science-watercycle.json** — script
- **pa-g3-hindi-kahaani.json** — topical, script, bleed
- **pa-g3-math-fractions.json** — script
- **pa-g3-science-watercycle.json** — script
- **ta-g3-hindi-kahaani.json** — jaccard, script, bleed
- **te-g3-hindi-kahaani.json** — jaccard, topical
