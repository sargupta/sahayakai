# Parity scores — video-storyteller (recommender mode)

- Cells scored: 42
- Pass rate: 40.5%
- Canary-ready: NO

Thresholds: jaccard ≥ 0.1, topical ≥ 0.4, message cosine ≥ 0.75, script ≥ 0.90, no bleed.

| Cell | Lang | Structural | Jaccard | Topical | Msg cos | Script | Bleed | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bn-g3-hindi-kahaani.json | bn | 1 | 0.587 | 0.680 | 0.892 | 94.8% | no | PASS |
| bn-g3-math-fractions.json | bn | 1 | 0.048 | 0.800 | 0.840 | 98.2% | no | FAIL |
| bn-g3-science-watercycle.json | bn | 1 | 0.068 | 0.640 | 0.902 | 95.1% | no | FAIL |
| bn-g7-math-algebra.json | bn | 1 | 0.061 | 0.800 | 0.886 | 98.4% | no | FAIL |
| en-g3-hindi-kahaani.json | en | 1 | 0.456 | 0.880 | 0.905 | 100.0% | no | PASS |
| en-g3-math-fractions.json | en | 1 | 0.453 | 0.760 | 0.903 | 100.0% | no | PASS |
| en-g3-science-watercycle.json | en | 1 | 0.437 | 0.640 | 0.895 | 100.0% | no | PASS |
| en-g7-math-algebra.json | en | 1 | 0.448 | 0.920 | 0.907 | 100.0% | no | PASS |
| gu-g3-hindi-kahaani.json | gu | 1 | 0.044 | 0.760 | 0.865 | 96.6% | no | FAIL |
| gu-g3-math-fractions.json | gu | 1 | 0.081 | 0.880 | 0.937 | 96.7% | no | FAIL |
| gu-g3-science-watercycle.json | gu | 1 | 0.061 | 0.720 | 0.889 | 94.7% | no | FAIL |
| gu-g7-math-algebra.json | gu | 1 | 0.027 | 0.750 | 0.943 | 95.8% | no | FAIL |
| hi-g3-hindi-kahaani.json | hi | 1 | 0.069 | 0.900 | 0.800 | 100.0% | no | FAIL |
| hi-g3-math-fractions.json | hi | 1 | 0.140 | 0.800 | 0.864 | 90.5% | no | PASS |
| hi-g3-science-watercycle.json | hi | 1 | 0.060 | 0.680 | 0.926 | 100.0% | no | FAIL |
| hi-g7-math-algebra.json | hi | 1 | 0.063 | 0.720 | 0.875 | 100.0% | no | FAIL |
| kn-g3-hindi-kahaani.json | kn | 1 | 0.068 | 0.720 | 0.928 | 97.2% | no | FAIL |
| kn-g3-math-fractions.json | kn | 1 | 0.055 | 0.950 | 0.888 | 100.0% | no | FAIL |
| kn-g3-science-watercycle.json | kn | 1 | 0.100 | 0.800 | 0.876 | 100.0% | no | PASS |
| kn-g7-math-algebra.json | kn | 1 | 0.088 | 0.800 | 0.882 | 97.0% | no | FAIL |
| ml-g3-hindi-kahaani.json | ml | 1 | 0.532 | 0.957 | 0.918 | 100.0% | no | PASS |
| ml-g3-math-fractions.json | ml | 1 | 0.077 | 0.960 | 0.870 | 97.2% | no | FAIL |
| ml-g3-science-watercycle.json | ml | 1 | 0.078 | 0.480 | 0.891 | 100.0% | no | FAIL |
| ml-g7-math-algebra.json | ml | 1 | 0.067 | 0.720 | 0.891 | 100.0% | no | FAIL |
| mr-g3-hindi-kahaani.json | mr | 1 | 0.106 | 0.520 | 0.913 | 97.1% | no | PASS |
| mr-g3-math-fractions.json | mr | 1 | 0.131 | 0.680 | 0.900 | 100.0% | no | PASS |
| mr-g3-science-watercycle.json | mr | 1 | 0.139 | 0.450 | 0.882 | 96.5% | no | PASS |
| mr-g7-math-algebra.json | mr | 1 | 0.067 | 0.850 | 0.925 | 91.6% | no | FAIL |
| or-g3-hindi-kahaani.json | or | 1 | 0.092 | 0.680 | 0.906 | 99.0% | no | FAIL |
| or-g3-math-fractions.json | or | 1 | 0.063 | 0.760 | 0.821 | 93.8% | no | FAIL |
| or-g3-science-watercycle.json | or | 1 | 0.468 | 0.636 | 0.875 | 98.7% | no | PASS |
| pa-g3-hindi-kahaani.json | pa | 1 | 0.470 | 0.760 | 0.870 | 98.1% | no | PASS |
| pa-g3-math-fractions.json | pa | 1 | 0.541 | 0.800 | 0.846 | 98.1% | no | PASS |
| pa-g3-science-watercycle.json | pa | 1 | 0.115 | 0.560 | 0.934 | 98.4% | no | PASS |
| ta-g3-hindi-kahaani.json | ta | 1 | 0.105 | 0.920 | 0.895 | 97.1% | no | PASS |
| ta-g3-math-fractions.json | ta | 1 | 0.063 | 0.840 | 0.901 | 96.9% | no | FAIL |
| ta-g3-science-watercycle.json | ta | 1 | 0.063 | 0.600 | 0.946 | 97.5% | no | FAIL |
| ta-g7-math-algebra.json | ta | 1 | 0.075 | 0.700 | 0.782 | 100.0% | no | FAIL |
| te-g3-hindi-kahaani.json | te | 1 | 0.386 | 0.950 | 0.909 | 100.0% | no | PASS |
| te-g3-math-fractions.json | te | 1 | 0.065 | 1.000 | 0.896 | 100.0% | no | FAIL |
| te-g3-science-watercycle.json | te | 1 | 0.017 | 0.640 | 0.906 | 100.0% | no | FAIL |
| te-g7-math-algebra.json | te | 1 | 0.064 | 0.880 | 0.902 | 100.0% | no | FAIL |

## Failures
- **bn-g3-math-fractions.json** — jaccard
- **bn-g3-science-watercycle.json** — jaccard
- **bn-g7-math-algebra.json** — jaccard
- **gu-g3-hindi-kahaani.json** — jaccard
- **gu-g3-math-fractions.json** — jaccard
- **gu-g3-science-watercycle.json** — jaccard
- **gu-g7-math-algebra.json** — jaccard
- **hi-g3-hindi-kahaani.json** — jaccard
- **hi-g3-science-watercycle.json** — jaccard
- **hi-g7-math-algebra.json** — jaccard
- **kn-g3-hindi-kahaani.json** — jaccard
- **kn-g3-math-fractions.json** — jaccard
- **kn-g7-math-algebra.json** — jaccard
- **ml-g3-math-fractions.json** — jaccard
- **ml-g3-science-watercycle.json** — jaccard
- **ml-g7-math-algebra.json** — jaccard
- **mr-g7-math-algebra.json** — jaccard
- **or-g3-hindi-kahaani.json** — jaccard
- **or-g3-math-fractions.json** — jaccard
- **ta-g3-math-fractions.json** — jaccard
- **ta-g3-science-watercycle.json** — jaccard
- **ta-g7-math-algebra.json** — jaccard
- **te-g3-math-fractions.json** — jaccard
- **te-g3-science-watercycle.json** — jaccard
- **te-g7-math-algebra.json** — jaccard
