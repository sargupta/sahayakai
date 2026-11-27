"use client";

/* Generated from the founder-approved Claude Design source (Features.dc.html, 2026-11-27).
   Markup only; the switch state lives in features-page.tsx. */
import { useLanguage } from "@/context/language-context";
import { type CompareProps, useCompareView } from "./features-compare";

/** Lesson plan, quiz, virtual field trip and assessment scanner. */
export function ToolCardsA({ sel, pick }: CompareProps) {
  const { t } = useLanguage();
  const { on, knob } = useCompareView(sel);
  return (
    <>
      <article className="card">
        <div>
          <h3 style={{ margin: "0", fontSize: "30px", lineHeight: 1.08 }}>
            {t("Lesson plan")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("Structured lesson plans mapped to the prescribed textbook.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Lesson plan")}
        >
          <span className="knob" style={knob(4)} />
          <button
            type="button"
            aria-pressed={sel[4] === 0}
            onClick={() => pick(4, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[4] === 1}
            onClick={() => pick(4, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[4] === 2}
            onClick={() => pick(4, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(4, 0)}`}>
            <div className="fit">
              <div
                className="rv t1"
                style={{ position: "absolute", left: "22px", top: "20px" }}
              >
                <span
                  className="chip "
                  style={{
                    background: "var(--hp-clay-89-3)",
                    color: "var(--hp-clay-28)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="13"
                    height="13"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 12.5A6.5 6.5 0 0 1 7.5 5a6.5 6.5 0 1 0 7.5 7.5z" />
                  </svg>
                  {t("10:40 pm")}
                </span>
              </div>
              <div className="rv t1" style={{}}>
                <div
                  className="paper"
                  style={{
                    width: "300px",
                    maxWidth: "100%",
                    transform: "rotate(-1.5deg)",
                  }}
                >
                  <div
                    className="hw"
                    style={{ fontSize: "20px", color: "var(--hp-indigo-36)" }}
                  >
                    {t("Tue, Class 7, Fractions")}
                  </div>
                  <div style={{ height: "150px" }}></div>
                </div>
              </div>
              <div
                className="rv t2"
                style={{ position: "absolute", right: "24%", bottom: "22%" }}
              >
                <svg
                  aria-hidden="true"
                  width="34"
                  height="34"
                  viewBox="0 0 20 20"
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: "var(--hp-clay-41)" }}
                >
                  <path d="M13.5 3.5l3 3L7 16l-4 1 1-4z" />
                </svg>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(4, 1)}`}>
            <div className="fit">
              <div className="cw rv t1">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "11px 14px",
                    borderBottom: "1px solid var(--hp-slate-94-2)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--hp-slate-33)",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      background: "var(--hp-slate-84)",
                    }}
                  ></span>
                  {t("General AI assistant")}
                  <span
                    style={{
                      marginLeft: "auto",
                      letterSpacing: "2px",
                      color: "var(--hp-slate-74)",
                    }}
                  >
                    {"•••"}
                  </span>
                </div>
                <div
                  style={{
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "82%",
                      background: "var(--hp-slate-93)",
                      color: "var(--hp-indigo-15)",
                      borderRadius: "14px 14px 4px 14px",
                      padding: "8px 12px",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    {t("Lesson plan on fractions")}
                  </div>
                  <div style={{ paddingLeft: "30px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          width: "100%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "96%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "100%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "92%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "100%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "88%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "70%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                    </div>
                  </div>
                </div>
                <div
                  className="rv t3"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    background: "var(--hp-slate-97-2)",
                    borderTop: "1px solid var(--hp-slate-94-2)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--hp-slate-40)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H4zM16 4h-5a2 2 0 0 0-2 2" />
                  </svg>
                  {t("Your textbook: not referenced")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(4, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-saffron-84), transparent 65%), var(--hp-saffron-94)",
            }}
          >
            <div className="fit">
              <div className="aw rv t1" style={{ width: "340px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(23,19,16,.06)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "relative",
                      flex: "none",
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        inset: "0",
                        borderRadius: "9999px",
                        background:
                          "radial-gradient(circle at 32% 26%,var(--hp-saffron-94-2) 0%,var(--hp-saffron-78) 26%,var(--hp-saffron) 62%,var(--hp-saffron-deep) 100%)",
                        boxShadow:
                          "0 6px 18px rgba(255,120,30,.45), inset 0 -4px 10px rgba(150,60,0,.25)",
                      }}
                    ></span>
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--hp-ink)",
                    }}
                  >
                    {t("Lesson plan, Class 7")}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "12px",
                      color: "var(--hp-muted)",
                    }}
                  >
                    {t("SahayakAI")}
                  </span>
                </div>
                <div
                  style={{
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "9px",
                  }}
                >
                  <div
                    className="rv t1"
                    style={{
                      borderLeft: "3px solid var(--hp-accent)",
                      padding: "2px 0 2px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--hp-accent)",
                      }}
                    >
                      {t("Objective")}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "var(--hp-ink)",
                        lineHeight: 1.4,
                      }}
                    >
                      {t("Compare fractions with unlike denominators")}
                    </div>
                  </div>
                  <div
                    className="rv t2"
                    style={{
                      borderLeft: "3px solid var(--hp-indigo-36)",
                      padding: "2px 0 2px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--hp-indigo-36)",
                      }}
                    >
                      {t("Activity")}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "var(--hp-ink)",
                        lineHeight: 1.4,
                      }}
                    >
                      {t("Fraction strips in pairs, then share on the board")}
                    </div>
                  </div>
                  <div
                    className="rv t3"
                    style={{
                      borderLeft: "3px solid var(--hp-success)",
                      padding: "2px 0 2px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--hp-success)",
                      }}
                    >
                      {t("Closing question")}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "var(--hp-ink)",
                        lineHeight: 1.4,
                      }}
                    >
                      {t("Which is larger, 3/4 or 2/3? How do you know?")}
                    </div>
                  </div>
                  <div className="rv t4">
                    <span
                      className="chip "
                      style={{
                        background: "var(--hp-indigo-94)",
                        color: "var(--hp-indigo-36)",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="13"
                        height="13"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 4h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H4zM16 4h-5a2 2 0 0 0-2 2" />
                      </svg>
                      {t("CBSE, NCERT Ganita Prakash 7, Chapter 8")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(4, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "Plans are prepared from a blank page, often late in the evening.",
            )}
          </p>
          <p className={`capx ${on(4, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t(
              "Output depends on the prompt and does not reference the prescribed textbook.",
            )}
          </p>
          <p className={`capx ${on(4, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t(
              "Objectives, activities and assessment questions, mapped to the chapter being taught.",
            )}
          </p>
        </div>
      </article>
      <article className="card">
        <div>
          <h3 style={{ margin: "0", fontSize: "30px", lineHeight: 1.08 }}>
            {t("Quiz")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("Formative assessment drawn from the current chapter.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Quiz")}
        >
          <span className="knob" style={knob(5)} />
          <button
            type="button"
            aria-pressed={sel[5] === 0}
            onClick={() => pick(5, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[5] === 1}
            onClick={() => pick(5, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[5] === 2}
            onClick={() => pick(5, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(5, 0)}`}>
            <div className="fit">
              <div className="rv t1 hw" style={{}}>
                <div
                  className="paper"
                  style={{
                    width: "280px",
                    maxWidth: "100%",
                    transform: "rotate(2deg)",
                  }}
                >
                  <div
                    className="hw"
                    style={{
                      fontSize: "20px",
                      color: "var(--hp-indigo-36)",
                      marginBottom: "6px",
                    }}
                  >
                    {t("Quiz, Class 7")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      fontSize: "18px",
                      lineHeight: "27px",
                      color: "var(--hp-stone-21)",
                    }}
                  >
                    <span>{t("1. Which is bigger, 3/4 or")}</span>
                    <span style={{ color: "var(--hp-stone-21)" }}></span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      fontSize: "18px",
                      lineHeight: "27px",
                      color: "var(--hp-stone-21)",
                    }}
                  >
                    <span>{"2."}</span>
                    <span style={{ color: "var(--hp-stone-21)" }}></span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      fontSize: "18px",
                      lineHeight: "27px",
                      color: "var(--hp-stone-21)",
                    }}
                  >
                    <span>{"3."}</span>
                    <span style={{ color: "var(--hp-stone-21)" }}></span>
                  </div>
                  <div style={{ height: "40px" }}></div>
                </div>
              </div>
              <div
                className="rv t2"
                style={{ position: "absolute", left: "22px", bottom: "22px" }}
              >
                <span
                  className="chip "
                  style={{
                    background: "var(--hp-clay-89-3)",
                    color: "var(--hp-clay-28)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="13"
                    height="13"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13.5 3.5l3 3L7 16l-4 1 1-4z" />
                  </svg>
                  {t("Written by hand")}
                </span>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(5, 1)}`}>
            <div className="fit">
              <div className="cw rv t1">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "11px 14px",
                    borderBottom: "1px solid var(--hp-slate-94-2)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--hp-slate-33)",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      background: "var(--hp-slate-84)",
                    }}
                  ></span>
                  {t("General AI assistant")}
                  <span
                    style={{
                      marginLeft: "auto",
                      letterSpacing: "2px",
                      color: "var(--hp-slate-74)",
                    }}
                  >
                    {"•••"}
                  </span>
                </div>
                <div
                  style={{
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "82%",
                      background: "var(--hp-slate-93)",
                      color: "var(--hp-indigo-15)",
                      borderRadius: "14px 14px 4px 14px",
                      padding: "8px 12px",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    {t("Five questions on fractions")}
                  </div>
                  <div
                    style={{
                      paddingLeft: "30px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        color: "var(--hp-slate-33)",
                      }}
                    >
                      <b style={{ fontWeight: 600 }}>{t("Q1")}</b>
                      <span
                        style={{
                          flex: "1",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        color: "var(--hp-slate-33)",
                      }}
                    >
                      <b style={{ fontWeight: 600 }}>{t("Q2")}</b>
                      <span
                        style={{
                          flex: "1",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        color: "var(--hp-slate-33)",
                      }}
                    >
                      <b style={{ fontWeight: 600 }}>{t("Q3")}</b>
                      <span
                        style={{
                          flex: "1",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        className="chip "
                        style={{
                          background: "var(--hp-saffron-91)",
                          color: "var(--hp-saffron-25)",
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          width="13"
                          height="13"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M10 3l8 14H2z" />
                          <path d="M10 8v4M10 14.5v.01" />
                        </svg>
                        {t("Not in this chapter")}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        color: "var(--hp-slate-33)",
                      }}
                    >
                      <b style={{ fontWeight: 600 }}>{t("Q4")}</b>
                      <span
                        style={{
                          flex: "1",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                    </div>
                  </div>
                </div>
                <div
                  className="rv t3"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    background: "var(--hp-slate-97-2)",
                    borderTop: "1px solid var(--hp-slate-94-2)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--hp-slate-40)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="10" cy="10" r="7" />
                    <path d="M10 9v4M10 6.5v.01" />
                  </svg>
                  {t("Answers: check them yourself")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(5, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-indigo-92), transparent 65%), var(--hp-indigo-96)",
            }}
          >
            <div className="fit">
              <div className="aw rv t1" style={{ width: "340px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(23,19,16,.06)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "relative",
                      flex: "none",
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        inset: "0",
                        borderRadius: "9999px",
                        background:
                          "radial-gradient(circle at 32% 26%,var(--hp-saffron-94-2) 0%,var(--hp-saffron-78) 26%,var(--hp-saffron) 62%,var(--hp-saffron-deep) 100%)",
                        boxShadow:
                          "0 6px 18px rgba(255,120,30,.45), inset 0 -4px 10px rgba(150,60,0,.25)",
                      }}
                    ></span>
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--hp-ink)",
                    }}
                  >
                    {t("Quiz, fractions")}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "12px",
                      color: "var(--hp-muted)",
                    }}
                  >
                    {t("SahayakAI")}
                  </span>
                </div>
                <div
                  style={{
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "9px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "var(--hp-muted)",
                    }}
                  >
                    <span>{t("Question 1 of 5")}</span>
                    <span style={{ display: "flex", gap: "4px" }}>
                      <span
                        style={{
                          width: "18px",
                          height: "4px",
                          borderRadius: "4px",
                          background: "var(--hp-saffron)",
                        }}
                      ></span>
                      <span
                        style={{
                          width: "18px",
                          height: "4px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-89)",
                        }}
                      ></span>
                      <span
                        style={{
                          width: "18px",
                          height: "4px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-89)",
                        }}
                      ></span>
                      <span
                        style={{
                          width: "18px",
                          height: "4px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-89)",
                        }}
                      ></span>
                      <span
                        style={{
                          width: "18px",
                          height: "4px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-89)",
                        }}
                      ></span>
                    </span>
                  </div>
                  <div
                    className="d"
                    style={{ fontSize: "18px", lineHeight: 1.25 }}
                  >
                    {t("Which fraction is the largest?")}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                      gap: "8px",
                    }}
                  >
                    <div
                      className="rv t2 okopt"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: "12px",
                        fontSize: "14px",
                        fontWeight: 600,
                        border: "1.5px solid var(--hp-success)",
                        background: "var(--hp-green-91)",
                      }}
                    >
                      {t("A. 3/4")}
                      <svg
                        aria-hidden="true"
                        width="15"
                        height="15"
                        viewBox="0 0 20 20"
                        fill="none"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ stroke: "var(--hp-success)" }}
                      >
                        <path d="M4 10.5l4 4 8-9" />
                      </svg>
                    </div>
                    <div
                      className=""
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: "12px",
                        fontSize: "14px",
                        fontWeight: 600,
                        border: "1.5px solid rgba(23,19,16,.1)",
                        background: "var(--hp-white)",
                      }}
                    >
                      {t("B. 2/3")}
                    </div>
                    <div
                      className=""
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: "12px",
                        fontSize: "14px",
                        fontWeight: 600,
                        border: "1.5px solid rgba(23,19,16,.1)",
                        background: "var(--hp-white)",
                      }}
                    >
                      {t("C. 1/2")}
                    </div>
                    <div
                      className=""
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: "12px",
                        fontSize: "14px",
                        fontWeight: 600,
                        border: "1.5px solid rgba(23,19,16,.1)",
                        background: "var(--hp-white)",
                      }}
                    >
                      {t("D. 1/4")}
                    </div>
                  </div>
                  <div className="rv t3">
                    <span
                      className="chip "
                      style={{
                        background: "var(--hp-success)",
                        color: "var(--hp-white)",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="13"
                        height="13"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 10.5l4 4 8-9" />
                      </svg>
                      {t("Answers included")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(5, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "Assessments are written by hand, so they are conducted less often.",
            )}
          </p>
          <p className={`capx ${on(5, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t("Each generated question must be checked against the chapter.")}
          </p>
          <p className={`capx ${on(5, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t(
              "Chapter-specific questions, prepared on request, with answers included.",
            )}
          </p>
        </div>
      </article>
      <article className="card">
        <div>
          <h3 style={{ margin: "0", fontSize: "30px", lineHeight: 1.08 }}>
            {t("Virtual field trip")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("Guided visual visits to the places the curriculum describes.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Virtual field trip")}
        >
          <span className="knob" style={knob(6)} />
          <button
            type="button"
            aria-pressed={sel[6] === 0}
            onClick={() => pick(6, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[6] === 1}
            onClick={() => pick(6, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[6] === 2}
            onClick={() => pick(6, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(6, 0)}`}>
            <div className="fit">
              <div className="rv t1" style={{}}>
                <div
                  style={{
                    display: "flex",
                    width: "340px",
                    maxWidth: "100%",
                    background: "var(--hp-stone-99)",
                    borderRadius: "6px",
                    boxShadow: "0 18px 40px rgba(60,40,20,.15)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      flex: "1",
                      padding: "16px",
                      borderRight: "1px solid var(--hp-clay-89-2)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--hp-clay-36)",
                        marginBottom: "8px",
                      }}
                    >
                      {t("Chapter 5, The delta")}
                    </div>
                    <span
                      style={{
                        display: "block",
                        height: "70px",
                        background:
                          "linear-gradient(160deg,var(--hp-clay-82),var(--hp-clay-70))",
                        borderRadius: "3px",
                        filter: "grayscale(1)",
                      }}
                    ></span>
                    <div style={{ marginTop: "10px" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            width: "96%",
                            height: "5px",
                            borderRadius: "4px",
                            background: "var(--hp-clay-86)",
                          }}
                        ></span>
                        <span
                          style={{
                            display: "block",
                            width: "80%",
                            height: "5px",
                            borderRadius: "4px",
                            background: "var(--hp-clay-86)",
                          }}
                        ></span>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: "1", padding: "16px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          width: "100%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "92%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "96%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "88%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "100%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "70%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "94%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "60%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(6, 1)}`}>
            <div className="fit">
              <div className="cw rv t1">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "11px 14px",
                    borderBottom: "1px solid var(--hp-slate-94-2)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--hp-slate-33)",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      background: "var(--hp-slate-84)",
                    }}
                  ></span>
                  {t("General AI assistant")}
                  <span
                    style={{
                      marginLeft: "auto",
                      letterSpacing: "2px",
                      color: "var(--hp-slate-74)",
                    }}
                  >
                    {"•••"}
                  </span>
                </div>
                <div
                  style={{
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "82%",
                      background: "var(--hp-slate-93)",
                      color: "var(--hp-indigo-15)",
                      borderRadius: "14px 14px 4px 14px",
                      padding: "8px 12px",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    {t("Describe the Sundarbans")}
                  </div>
                  <div style={{ paddingLeft: "30px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          width: "100%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "94%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "100%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "90%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "96%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "60%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                    </div>
                  </div>
                </div>
                <div
                  className="rv t3"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    background: "var(--hp-slate-97-2)",
                    borderTop: "1px solid var(--hp-slate-94-2)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--hp-slate-40)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="14" height="12" rx="2" />
                    <path d="M3 13l4-4 4 4 2-2 4 4" />
                  </svg>
                  {t("Pictures shown to the class: none")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(6, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-green-86), transparent 65%), var(--hp-stone-92)",
            }}
          >
            <div className="fit">
              <div
                className="rv t1"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "400px",
                  maxWidth: "100%",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    border: "10px solid var(--hp-stone-16)",
                    borderRadius: "14px",
                    overflow: "hidden",
                    boxShadow: "0 30px 60px -12px rgba(30,40,80,.35)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 400 200"
                    width="100%"
                    height="100%"
                    preserveAspectRatio="xMidYMid slice"
                    style={{ display: "block" }}
                  >
                    <defs>
                      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0"
                          style={{ stopColor: "var(--hp-saffron-84)" }}
                        />
                        <stop
                          offset="1"
                          style={{ stopColor: "var(--hp-indigo-92)" }}
                        />
                      </linearGradient>
                    </defs>
                    <rect width="400" height="200" fill="url(#sky)" />
                    <circle
                      className="flt"
                      cx="300"
                      cy="62"
                      r="26"
                      style={{ fill: "var(--hp-saffron-70)" }}
                    />
                    <g className="drift">
                      <path
                        d="M-40 130 L40 80 L95 118 L160 70 L230 120 L300 84 L380 126 L460 96 L460 200 L-40 200Z"
                        style={{ fill: "var(--hp-green-74)" }}
                      />
                    </g>
                    <path
                      d="M0 150 C80 128 140 160 220 142 C290 128 340 150 400 138 L400 200 L0 200Z"
                      style={{ fill: "var(--hp-green-55)" }}
                    />
                    <path
                      className="flow"
                      d="M0 178 C70 160 120 186 200 170 C270 156 330 180 400 166"
                      fill="none"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray="40 14"
                      style={{ stroke: "var(--hp-indigo-72)" }}
                    />
                  </svg>
                  <div
                    className="rv t3"
                    style={{
                      position: "absolute",
                      left: "12px",
                      bottom: "12px",
                    }}
                  >
                    <span
                      className="chip "
                      style={{
                        background: "var(--hp-ink)",
                        color: "var(--hp-white)",
                      }}
                    >
                      {t("Stop 2 of 5, the river delta")}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    width: "60px",
                    height: "14px",
                    background: "var(--hp-stone-16)",
                    borderRadius: "0 0 6px 6px",
                  }}
                ></span>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(6, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "The topic is limited to a textbook description and a single image.",
            )}
          </p>
          <p className={`capx ${on(6, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t(
              "The place is described in text but cannot be shown to the class.",
            )}
          </p>
          <p className={`capx ${on(6, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t("A guided, visual visit presented on the classroom display.")}
          </p>
        </div>
      </article>
      <article className="card">
        <div>
          <h3 style={{ margin: "0", fontSize: "30px", lineHeight: 1.08 }}>
            {t("Assessment scanner")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t(
              "Answer scripts evaluated against the teacher’s key, for her confirmation.",
            )}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Assessment scanner")}
        >
          <span className="knob" style={knob(7)} />
          <button
            type="button"
            aria-pressed={sel[7] === 0}
            onClick={() => pick(7, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[7] === 1}
            onClick={() => pick(7, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[7] === 2}
            onClick={() => pick(7, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(7, 0)}`}>
            <div className="fit">
              <div className="rv t1" style={{}}>
                <div
                  style={{
                    position: "relative",
                    width: "270px",
                    height: "160px",
                    marginTop: "40px",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "0px",
                      top: "0px",
                      width: "230px",
                      height: "150px",
                      background: "var(--hp-stone-99)",
                      border: "1px solid var(--hp-clay-86)",
                      borderRadius: "4px",
                      boxShadow: "0 4px 10px rgba(60,40,20,.08)",
                      transform: "rotate(1.5deg)",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      left: "6px",
                      top: "-7px",
                      width: "230px",
                      height: "150px",
                      background: "var(--hp-stone-99)",
                      border: "1px solid var(--hp-clay-86)",
                      borderRadius: "4px",
                      boxShadow: "0 4px 10px rgba(60,40,20,.08)",
                      transform: "rotate(-1.5deg)",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "-14px",
                      width: "230px",
                      height: "150px",
                      background: "var(--hp-stone-99)",
                      border: "1px solid var(--hp-clay-86)",
                      borderRadius: "4px",
                      boxShadow: "0 4px 10px rgba(60,40,20,.08)",
                      transform: "rotate(1.5deg)",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      left: "18px",
                      top: "-21px",
                      width: "230px",
                      height: "150px",
                      background: "var(--hp-stone-99)",
                      border: "1px solid var(--hp-clay-86)",
                      borderRadius: "4px",
                      boxShadow: "0 4px 10px rgba(60,40,20,.08)",
                      transform: "rotate(-1.5deg)",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      left: "24px",
                      top: "-28px",
                      width: "230px",
                      height: "150px",
                      background: "var(--hp-stone-99)",
                      border: "1px solid var(--hp-clay-86)",
                      borderRadius: "4px",
                      boxShadow: "0 4px 10px rgba(60,40,20,.08)",
                      transform: "rotate(1.5deg)",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      left: "30px",
                      top: "-35px",
                      width: "230px",
                      height: "150px",
                      background: "var(--hp-stone-99)",
                      border: "1px solid var(--hp-clay-86)",
                      borderRadius: "4px",
                      boxShadow: "0 4px 10px rgba(60,40,20,.08)",
                      transform: "rotate(-1.5deg)",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      left: "36px",
                      top: "-42px",
                      width: "230px",
                      height: "150px",
                      background: "var(--hp-stone-99)",
                      border: "1px solid var(--hp-clay-86)",
                      borderRadius: "4px",
                      boxShadow: "0 4px 10px rgba(60,40,20,.08)",
                      transform: "rotate(1.5deg)",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      right: "-40px",
                      bottom: "-10px",
                      transform: "rotate(-30deg)",
                      width: "120px",
                      height: "12px",
                      borderRadius: "6px",
                      background:
                        "linear-gradient(90deg,var(--hp-red-46) 80%,var(--hp-stone-21) 80%)",
                    }}
                  ></div>
                </div>
              </div>
              <div
                className="rv t2"
                style={{ position: "absolute", left: "22px", top: "20px" }}
              >
                <span
                  className="chip "
                  style={{
                    background: "var(--hp-clay-89-3)",
                    color: "var(--hp-clay-28)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="13"
                    height="13"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 12.5A6.5 6.5 0 0 1 7.5 5a6.5 6.5 0 1 0 7.5 7.5z" />
                  </svg>
                  {t("Tonight, at home")}
                </span>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(7, 1)}`}>
            <div className="fit">
              <div className="cw rv t1">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "11px 14px",
                    borderBottom: "1px solid var(--hp-slate-94-2)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--hp-slate-33)",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      background: "var(--hp-slate-84)",
                    }}
                  ></span>
                  {t("General AI assistant")}
                  <span
                    style={{
                      marginLeft: "auto",
                      letterSpacing: "2px",
                      color: "var(--hp-slate-74)",
                    }}
                  >
                    {"•••"}
                  </span>
                </div>
                <div
                  style={{
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "flex-end",
                      width: "120px",
                      height: "70px",
                      borderRadius: "12px",
                      background:
                        "linear-gradient(160deg,var(--hp-stone-94),var(--hp-clay-83))",
                      border: "1px solid var(--hp-slate-90)",
                    }}
                  ></div>
                  <div
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "82%",
                      background: "var(--hp-slate-93)",
                      color: "var(--hp-indigo-15)",
                      borderRadius: "14px 14px 4px 14px",
                      padding: "8px 12px",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    {t("Mark this answer")}
                  </div>
                  <div style={{ display: "flex", gap: "8px", maxWidth: "92%" }}>
                    <span
                      style={{
                        flex: "none",
                        width: "22px",
                        height: "22px",
                        borderRadius: "9999px",
                        background: "var(--hp-slate-84)",
                      }}
                    ></span>
                    <div
                      style={{
                        fontSize: "13px",
                        lineHeight: 1.45,
                        color: "var(--hp-indigo-20)",
                      }}
                    >
                      {t("I can review this one answer for you.")}
                    </div>
                  </div>
                </div>
                <div
                  className="rv t3"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    background: "var(--hp-slate-97-2)",
                    borderTop: "1px solid var(--hp-slate-94-2)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--hp-slate-40)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="4.5" y="9" width="11" height="8" rx="2" />
                    <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
                  </svg>
                  {t("Student data outside school systems")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(7, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-indigo-92), transparent 65%), var(--hp-indigo-96)",
            }}
          >
            <div className="fit">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "22px",
                }}
              >
                <div
                  className="rv t1"
                  style={{
                    position: "relative",
                    width: "190px",
                    height: "250px",
                    borderRadius: "26px",
                    background: "var(--hp-stone-16)",
                    padding: "12px",
                    boxSizing: "border-box",
                    boxShadow: "0 30px 60px -14px rgba(30,40,80,.4)",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      borderRadius: "16px",
                      overflow: "hidden",
                      background: "var(--hp-stone-99)",
                      padding: "18px 14px",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "14px",
                      }}
                    >
                      <span
                        style={{
                          flex: "1",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-83)",
                        }}
                      ></span>
                      <span
                        className="rv t2"
                        style={{ color: "var(--hp-success)" }}
                      >
                        <svg
                          aria-hidden="true"
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="none"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ stroke: "var(--hp-success)" }}
                        >
                          <path d="M4 10.5l4 4 8-9" />
                        </svg>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "14px",
                      }}
                    >
                      <span
                        style={{
                          flex: "1",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-83)",
                        }}
                      ></span>
                      <span
                        className="rv t3"
                        style={{ color: "var(--hp-success)" }}
                      >
                        <svg
                          aria-hidden="true"
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="none"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ stroke: "var(--hp-success)" }}
                        >
                          <path d="M4 10.5l4 4 8-9" />
                        </svg>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "14px",
                      }}
                    >
                      <span
                        style={{
                          flex: "1",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-83)",
                        }}
                      ></span>
                      <span
                        className="rv t4"
                        style={{ color: "var(--hp-red-41)" }}
                      >
                        <svg
                          aria-hidden="true"
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="none"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ stroke: "var(--hp-red-41)" }}
                        >
                          <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "14px",
                      }}
                    >
                      <span
                        style={{
                          flex: "1",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-83)",
                        }}
                      ></span>
                      <span
                        className="rv t5"
                        style={{ color: "var(--hp-success)" }}
                      >
                        <svg
                          aria-hidden="true"
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="none"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ stroke: "var(--hp-success)" }}
                        >
                          <path d="M4 10.5l4 4 8-9" />
                        </svg>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "14px",
                      }}
                    >
                      <span
                        style={{
                          flex: "1",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-83)",
                        }}
                      ></span>
                      <span
                        className="rv t6"
                        style={{ color: "var(--hp-success)" }}
                      >
                        <svg
                          aria-hidden="true"
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="none"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ stroke: "var(--hp-success)" }}
                        >
                          <path d="M4 10.5l4 4 8-9" />
                        </svg>
                      </span>
                    </div>
                    <span className="scanl"></span>
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        left: "8px",
                        borderWidth: "3px 0 0 3px",
                        borderColor: "var(--hp-white)",
                        width: "22px",
                        height: "22px",
                        borderStyle: "solid",
                      }}
                    ></span>
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        borderWidth: "3px 3px 0 0",
                        borderColor: "var(--hp-white)",
                        width: "22px",
                        height: "22px",
                        borderStyle: "solid",
                      }}
                    ></span>
                    <span
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        left: "8px",
                        borderWidth: "0 0 3px 3px",
                        borderColor: "var(--hp-white)",
                        width: "22px",
                        height: "22px",
                        borderStyle: "solid",
                      }}
                    ></span>
                    <span
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        right: "8px",
                        borderWidth: "0 3px 3px 0",
                        borderColor: "var(--hp-white)",
                        width: "22px",
                        height: "22px",
                        borderStyle: "solid",
                      }}
                    ></span>
                  </div>
                </div>
                <div className="aw rv t4" style={{ width: "200px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      padding: "12px 16px",
                      borderBottom: "1px solid rgba(23,19,16,.06)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "relative",
                        flex: "none",
                        display: "inline-block",
                        width: "16px",
                        height: "16px",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          inset: "0",
                          borderRadius: "9999px",
                          background:
                            "radial-gradient(circle at 32% 26%,var(--hp-saffron-94-2) 0%,var(--hp-saffron-78) 26%,var(--hp-saffron) 62%,var(--hp-saffron-deep) 100%)",
                          boxShadow:
                            "0 6px 18px rgba(255,120,30,.45), inset 0 -4px 10px rgba(150,60,0,.25)",
                        }}
                      ></span>
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--hp-ink)",
                      }}
                    >
                      {t("Proposed marks")}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "12px",
                        color: "var(--hp-muted)",
                      }}
                    >
                      {t("SahayakAI")}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "9px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "6px",
                      }}
                    >
                      <span
                        className="d num"
                        style={{ fontSize: "44px", lineHeight: 1 }}
                      >
                        {"8"}
                      </span>
                      <span
                        style={{ fontSize: "16px", color: "var(--hp-muted)" }}
                      >
                        {t("of 10")}
                      </span>
                    </div>
                    <div
                      style={{ fontSize: "12px", color: "var(--hp-muted)" }}
                    >
                      {t("Checked against your answer key")}
                    </div>
                    <span
                      style={{
                        alignSelf: "flex-start",
                        background: "var(--hp-ink)",
                        color: "var(--hp-white)",
                        borderRadius: "9999px",
                        padding: "8px 18px",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {t("Confirm")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(7, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t("Answer scripts are evaluated manually at home.")}
          </p>
          <p className={`capx ${on(7, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t(
              "Scripts are reviewed one at a time, outside the school’s systems.",
            )}
          </p>
          <p className={`capx ${on(7, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t(
              "Every script is scanned, marks are proposed against the key, and the teacher confirms.",
            )}
          </p>
        </div>
      </article>
    </>
  );
}
