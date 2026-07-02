#!/usr/bin/env bash
# F16 — 10 subjects × 5 probes. Drives probe-lesson-plan.mjs + probe-quiz.mjs.
# Requires: SAHAYAK_ID_TOKEN, node ≥18.
set -u
cd "$(dirname "$0")"
: "${SAHAYAK_ID_TOKEN:?need SAHAYAK_ID_TOKEN (gcloud auth print-identity-token --impersonate-service-account=…)}"

# Guard: these 50 probes bill Gemini. probe-*.mjs default to localhost and
# refuse the prod deployment unless QA_ALLOW_PROD=1 (see ../_qa-base.mjs).
# Echo the resolved target up front so the operator knows where 50 billed
# generations are about to land.
echo "[F16] target: ${SAHAYAK_BASE:-${QA_BASE_URL:-http://localhost:3000}}  (QA_ALLOW_PROD=${QA_ALLOW_PROD:-0})"

LP() { node ./probe-lesson-plan.mjs "$@" || true; }
QZ() { node ./probe-quiz.mjs        "$@" || true; }

# ── 10A Mathematics (1–12) — NCERT chapter alignment, notation, age
LP --subject=Mathematics --grade="Class 3"  --chapter="Long and Short"             --topic="Long and Short"
LP --subject=Mathematics --grade="Class 7"  --chapter="Fractions and Decimals"     --topic="Fractions and Decimals"
LP --subject=Mathematics --grade="Class 10" --chapter="Quadratic Equations"        --topic="Quadratic Equations"
QZ --subject=Mathematics --grade="Class 8"  --topic="Linear Equations in One Variable"
QZ --subject=Mathematics --grade="Class 11" --topic="Trigonometric Functions"

# ── 10B Physics (11–12)
LP --subject=Physics --grade="Class 11" --chapter="Units and Measurements"          --topic="Units and Measurements"
LP --subject=Physics --grade="Class 12" --chapter="Electromagnetic Induction"       --topic="Electromagnetic Induction"
LP --subject=Physics --grade="Class 11" --chapter="Laws of Motion"                  --topic="Laws of Motion"
QZ --subject=Physics --grade="Class 12" --topic="Ray Optics and Optical Instruments"
QZ --subject=Physics --grade="Class 11" --topic="Thermodynamics"

# ── 10C Chemistry (11–12)
LP --subject=Chemistry --grade="Class 11" --chapter="Some Basic Concepts of Chemistry" --topic="Mole concept"
LP --subject=Chemistry --grade="Class 12" --chapter="Electrochemistry"                 --topic="Electrochemistry"
LP --subject=Chemistry --grade="Class 12" --chapter="The Solid State"                  --topic="Solid State"   # P1: rationalized OUT
QZ --subject=Chemistry --grade="Class 11" --topic="Chemical Bonding and Molecular Structure"
QZ --subject=Chemistry --grade="Class 12" --topic="Coordination Compounds"

# ── 10D Biology (11–12)
LP --subject=Biology --grade="Class 11" --chapter="Cell: The Unit of Life"             --topic="Cell"
LP --subject=Biology --grade="Class 12" --chapter="Principles of Inheritance and Variation" --topic="Mendelian Genetics"
LP --subject=Biology --grade="Class 11" --chapter="Photosynthesis in Higher Plants"    --topic="Photosynthesis"
QZ --subject=Biology --grade="Class 12" --topic="Human Reproduction"
QZ --subject=Biology --grade="Class 11" --topic="Plant Kingdom"

# ── 10E Social Science (6–10) — dates, geography, polity
LP --subject="Social Studies" --grade="Class 8"  --chapter="The National Movement"     --topic="Indian National Movement"
LP --subject="Social Studies" --grade="Class 10" --topic="French Revolution"
LP --subject="Social Studies" --grade="Class 7"  --topic="Tribes, Nomads and Settled Communities"
QZ --subject="Social Studies" --grade="Class 9"  --topic="The French Revolution"
QZ --subject="Social Studies" --grade="Class 10" --topic="Nationalism in India"

# ── 10F Hindi as subject — grammar & kavita
LP --subject=Hindi --grade="Class 6"  --topic="संज्ञा"                                 --language=Hindi
LP --subject=Hindi --grade="Class 9"  --topic="क्रिया विशेषण"                         --language=Hindi
LP --subject=Hindi --grade="Class 10" --topic="समास"                                   --language=Hindi
QZ --subject=Hindi --grade="Class 7"  --topic="कारक"                                   --language=Hindi
QZ --subject=Hindi --grade="Class 10" --topic="रस अलंकार"                              --language=Hindi

# ── 10G English — NCERT prose alignment
LP --subject=English --grade="Class 7" --topic="Three Questions (Honeycomb)"
LP --subject=English --grade="Class 9" --topic="The Road Not Taken (Beehive)"
LP --subject=English --grade="Class 10" --topic="A Letter to God (First Flight)"
QZ --subject=English --grade="Class 8" --topic="The Best Christmas Present in the World"
QZ --subject=English --grade="Class 9" --topic="The Fun They Had"

# ── 10H Sanskrit — śloka, vyākaraṇa, devanāgarī
LP --subject=Sanskrit --grade="Class 8"  --topic="सुभाषितानि"                          --language=Sanskrit
LP --subject=Sanskrit --grade="Class 10" --topic="शुचिपर्यावरणम्"                       --language=Sanskrit
LP --subject=Sanskrit --grade="Class 9"  --topic="सूक्तिमौक्तिकम्"                     --language=Sanskrit
QZ --subject=Sanskrit --grade="Class 7"  --topic="सन्धि"                                --language=Sanskrit
QZ --subject=Sanskrit --grade="Class 10" --topic="कारक एवं उपपद विभक्ति"             --language=Sanskrit

# ── 10I Regional languages as TAUGHT subjects
LP --subject=Bengali  --grade="Class 7"  --topic="অপরিচিতা"          --language=Bengali
LP --subject=Tamil    --grade="Class 8"  --topic="திருக்குறள்"        --language=Tamil
LP --subject=Telugu   --grade="Class 9"  --topic="భారతదేశం"          --language=Telugu
QZ --subject=Marathi  --grade="Class 6"  --topic="अव्यय"              --language=Marathi
QZ --subject=Kannada  --grade="Class 10" --topic="ಚೆಲುವ"              --language=Kannada

# ── 10J CS/IT (9–12) — code correctness, algorithms
LP --subject="Information Technology" --grade="Class 9"  --topic="Digital Documentation"
LP --subject="Information Technology" --grade="Class 10" --topic="Database Management System"
LP --subject="Information Technology" --grade="Class 11" --topic="Python: Lists and Tuples"
QZ --subject="Information Technology" --grade="Class 12" --topic="SQL — SELECT, JOIN, GROUP BY"
QZ --subject="Information Technology" --grade="Class 11" --topic="Sorting Algorithms"

echo "DONE — 50 probes. Inspect ./out/ for raw JSON outputs."
