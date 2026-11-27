"use client";

/* Generated from the founder-approved Claude Design source (Features.dc.html, 2026-11-27).
   Markup only; the switch state lives in features-page.tsx. */
import { useLanguage } from "@/context/language-context";
import { type CompareProps, useCompareView } from "./features-compare";

/** The four core capabilities: parent calls, VIDYA, exam papers and the AI Mentor. */
export function CoreCards({ sel, pick }: CompareProps) {
  const { t } = useLanguage();
  const { on, knob } = useCompareView(sel);
  return (
    <>
      <article className="card big">
        <div>
          <h3 style={{ margin: "0", fontSize: "36px", lineHeight: 1.08 }}>
            {t("Calls to parents")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("Dialled by AI, not your staff. In each parent’s own language.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Calls to parents")}
        >
          <span className="knob" style={knob(0)} />
          <button
            type="button"
            aria-pressed={sel[0] === 0}
            onClick={() => pick(0, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[0] === 1}
            onClick={() => pick(0, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[0] === 2}
            onClick={() => pick(0, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(0, 0)}`}>
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
                    <circle cx="10" cy="10" r="7" />
                    <path d="M10 6v4l3 2" />
                  </svg>
                  {t("4:45 pm, after school")}
                </span>
              </div>
              <div className="rv t1 hw" style={{}}>
                <div
                  className="paper"
                  style={{
                    width: "290px",
                    maxWidth: "100%",
                    transform: "rotate(-2.5deg)",
                  }}
                >
                  <div
                    className="hw"
                    style={{
                      fontSize: "21px",
                      color: "var(--hp-indigo-36)",
                      marginBottom: "4px",
                    }}
                  >
                    {t("Class 7 absentees")}
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
                    <span>{t("Roll 04")}</span>
                    <span style={{ color: "var(--hp-red-46)" }}>
                      {t("no answer")}
                    </span>
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
                    <span>{t("Roll 11")}</span>
                    <span style={{ color: "var(--hp-red-46)" }}>
                      {t("no answer")}
                    </span>
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
                    <span>{t("Roll 17")}</span>
                    <span style={{ color: "var(--hp-saffron-37)" }}>
                      {t("call back?")}
                    </span>
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
                    <span>{t("Roll 23")}</span>
                    <span style={{ color: "var(--hp-stone-21)" }}>
                      {t("not yet")}
                    </span>
                  </div>
                </div>
              </div>
              <div
                className="rv t3"
                style={{ position: "absolute", right: "26px", bottom: "26px" }}
              >
                <div
                  className="hw"
                  style={{
                    transform: "rotate(4deg)",
                    background:
                      "linear-gradient(180deg,var(--hp-sun-83),var(--hp-sun-77))",
                    padding: "12px 14px",
                    width: "124px",
                    fontSize: "17px",
                    lineHeight: 1.15,
                    color: "var(--hp-saffron-22)",
                    boxShadow: "0 12px 24px rgba(60,40,20,.18)",
                    borderRadius: "2px",
                  }}
                >
                  {t("Try again tomorrow")}
                </div>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(0, 1)}`}>
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
                    {t("Write a message for an absent student’s parent")}
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
                      {t(
                        "Dear Parent, we noticed that your child has not been in school…",
                      )}
                    </div>
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
                          width: "88%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "64%",
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
                    <path d="M4 3h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a1 1 0 0 1-1 1A14 14 0 0 1 3 4a1 1 0 0 1 1-1z" />
                  </svg>
                  {t("Calls placed: 0")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(0, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-green-86), transparent 65%), var(--hp-stone-92)",
            }}
          >
            <div className="fit">
              <div className="aw rv t1" style={{ width: "380px" }}>
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
                    {t("Parent calls, Class 7")}
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
                      gap: "14px",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "96px",
                        height: "96px",
                        flex: "none",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="96"
                        height="96"
                        viewBox="0 0 96 96"
                      >
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          fill="none"
                          strokeWidth="8"
                          style={{ stroke: "var(--hp-green-90)" }}
                        />
                        <circle
                          className="ringf"
                          cx="48"
                          cy="48"
                          r="40"
                          fill="none"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray="252"
                          strokeDashoffset="252"
                          transform="rotate(-90 48 48)"
                          style={{ stroke: "var(--hp-success)" }}
                        />
                      </svg>
                      <div
                        style={{
                          position: "absolute",
                          inset: "0",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          className="d num"
                          style={{
                            fontSize: "24px",
                            lineHeight: 1,
                            color: "var(--hp-ink)",
                          }}
                        >
                          {"4/4"}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--hp-muted)",
                            marginTop: "3px",
                          }}
                        >
                          {t("reached")}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        flex: "1",
                        minWidth: "0",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        className="rv t1"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          background: "rgba(23,19,16,.035)",
                          fontSize: "13px",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: "var(--hp-ink)",
                            fontWeight: 500,
                          }}
                        >
                          <span
                            style={{
                              flex: "none",
                              width: "24px",
                              height: "24px",
                              borderRadius: "9999px",
                              background: "var(--hp-saffron-88)",
                              color: "var(--hp-saffron-29)",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {"04"}
                          </span>
                          {t("English")}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px",
                              height: "18px",
                            }}
                          >
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "40%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.00s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "80%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.13s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "55%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.26s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "100%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.39s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "65%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.52s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "90%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.65s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "45%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.78s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "75%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.91s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "60%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.04s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "95%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.17s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "50%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.30s",
                              }}
                            ></span>
                            <span
                              className="wv"
                              style={{
                                width: "3px",
                                height: "85%",
                                background: "var(--hp-success)",
                                animationDelay: "-0.43s",
                              }}
                            ></span>
                          </span>
                        </span>
                      </div>
                      <div
                        className="rv t2"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          background: "rgba(23,19,16,.035)",
                          fontSize: "13px",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: "var(--hp-ink)",
                            fontWeight: 500,
                          }}
                        >
                          <span
                            style={{
                              flex: "none",
                              width: "24px",
                              height: "24px",
                              borderRadius: "9999px",
                              background: "var(--hp-saffron-88)",
                              color: "var(--hp-saffron-29)",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {"11"}
                          </span>
                          {t("Hindi")}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            className="chip "
                            style={{
                              background: "var(--hp-green-91)",
                              color: "var(--hp-success-deep)",
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
                            {t("Answered")}
                          </span>
                        </span>
                      </div>
                      <div
                        className="rv t3"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          background: "rgba(23,19,16,.035)",
                          fontSize: "13px",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: "var(--hp-ink)",
                            fontWeight: 500,
                          }}
                        >
                          <span
                            style={{
                              flex: "none",
                              width: "24px",
                              height: "24px",
                              borderRadius: "9999px",
                              background: "var(--hp-saffron-88)",
                              color: "var(--hp-saffron-29)",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {"17"}
                          </span>
                          {t("Kannada")}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            className="chip "
                            style={{
                              background: "var(--hp-green-91)",
                              color: "var(--hp-success-deep)",
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
                            {t("Answered")}
                          </span>
                        </span>
                      </div>
                      <div
                        className="rv t4"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          background: "rgba(23,19,16,.035)",
                          fontSize: "13px",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: "var(--hp-ink)",
                            fontWeight: 500,
                          }}
                        >
                          <span
                            style={{
                              flex: "none",
                              width: "24px",
                              height: "24px",
                              borderRadius: "9999px",
                              background: "var(--hp-saffron-88)",
                              color: "var(--hp-saffron-29)",
                              fontSize: "11px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {"23"}
                          </span>
                          {t("English")}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            className="chip "
                            style={{
                              background: "var(--hp-green-91)",
                              color: "var(--hp-success-deep)",
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
                            {t("Answered")}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rv t5">
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
                      {t("Summaries sent to class teachers")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(0, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "Calls are made manually after school hours, and many go unanswered.",
            )}
          </p>
          <p className={`capx ${on(0, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t(
              "A general assistant can draft the message, but cannot place the call.",
            )}
          </p>
          <p className={`capx ${on(0, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t(
              "Every family is reached in its preferred language, and a summary is recorded for the class teacher.",
            )}
          </p>
        </div>
      </article>
      <article className="card big">
        <div>
          <h3 style={{ margin: "0", fontSize: "36px", lineHeight: 1.08 }}>
            {t("VIDYA")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("Just speak, and it’s done. No menus, no typing, no training.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: VIDYA")}
        >
          <span className="knob" style={knob(1)} />
          <button
            type="button"
            aria-pressed={sel[1] === 0}
            onClick={() => pick(1, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[1] === 1}
            onClick={() => pick(1, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[1] === 2}
            onClick={() => pick(1, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(1, 0)}`}>
            <div className="fit">
              <div className="rv t1" style={{}}>
                <div
                  style={{
                    width: "330px",
                    maxWidth: "100%",
                    background: "var(--hp-white)",
                    border: "1px solid var(--hp-stone-87)",
                    borderRadius: "12px",
                    boxShadow: "0 18px 40px rgba(60,40,20,.14)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--hp-stone-91)",
                    }}
                  >
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "9999px",
                        background: "var(--hp-clay-83)",
                      }}
                    ></span>
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "9999px",
                        background: "var(--hp-clay-83)",
                      }}
                    ></span>
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "9999px",
                        background: "var(--hp-clay-83)",
                      }}
                    ></span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "150px minmax(0,1fr)",
                    }}
                  >
                    <div
                      style={{
                        borderRight: "1px solid var(--hp-stone-91)",
                        padding: "8px",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          padding: "6px 10px 6px 10px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          color: "var(--hp-stone-33)",
                          background: "transparent",
                          fontWeight: 400,
                        }}
                      >
                        {t("Home ›")}
                      </div>
                      <div
                        style={{
                          padding: "6px 10px 6px 20px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          color: "var(--hp-stone-33)",
                          background: "transparent",
                          fontWeight: 400,
                        }}
                      >
                        {t("Academics ›")}
                      </div>
                      <div
                        style={{
                          padding: "6px 10px 6px 30px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          color: "var(--hp-stone-33)",
                          background: "transparent",
                          fontWeight: 400,
                        }}
                      >
                        {t("Classes ›")}
                      </div>
                      <div
                        style={{
                          padding: "6px 10px 6px 40px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          color: "var(--hp-stone-33)",
                          background: "transparent",
                          fontWeight: 400,
                        }}
                      >
                        {t("Class 8 ›")}
                      </div>
                      <div
                        style={{
                          padding: "6px 10px 6px 50px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          color: "var(--hp-ink)",
                          background: "var(--hp-slate-94)",
                          fontWeight: 600,
                        }}
                      >
                        {t("Attendance")}
                      </div>
                      <span
                        style={{
                          position: "absolute",
                          left: "110px",
                          bottom: "2px",
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            fill: "var(--hp-white)",
                            stroke: "var(--hp-ink)",
                          }}
                        >
                          <path d="M5 3l10 6-4.5 1.2L13 16l-2 1-2.5-5.8L5 14z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ padding: "14px" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            width: "90%",
                            height: "8px",
                            borderRadius: "4px",
                            background: "var(--hp-stone-92-2)",
                          }}
                        ></span>
                        <span
                          style={{
                            display: "block",
                            width: "70%",
                            height: "8px",
                            borderRadius: "4px",
                            background: "var(--hp-stone-92-2)",
                          }}
                        ></span>
                        <span
                          style={{
                            display: "block",
                            width: "80%",
                            height: "8px",
                            borderRadius: "4px",
                            background: "var(--hp-stone-92-2)",
                          }}
                        ></span>
                        <span
                          style={{
                            display: "block",
                            width: "60%",
                            height: "8px",
                            borderRadius: "4px",
                            background: "var(--hp-stone-92-2)",
                          }}
                        ></span>
                        <span
                          style={{
                            display: "block",
                            width: "75%",
                            height: "8px",
                            borderRadius: "4px",
                            background: "var(--hp-stone-92-2)",
                          }}
                        ></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="rv t3"
                style={{ position: "absolute", right: "22px", top: "22px" }}
              >
                <div
                  className="hw"
                  style={{
                    transform: "rotate(-4deg)",
                    background:
                      "linear-gradient(180deg,var(--hp-sun-83),var(--hp-sun-77))",
                    padding: "12px 14px",
                    width: "140px",
                    fontSize: "17px",
                    lineHeight: 1.15,
                    color: "var(--hp-saffron-22)",
                    boxShadow: "0 12px 24px rgba(60,40,20,.18)",
                    borderRadius: "2px",
                  }}
                >
                  {t("Where is attendance again?")}
                </div>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(1, 1)}`}>
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
                    {t("Open Class 8 attendance")}
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
                      {t(
                        "I can’t open your school’s software. Here are some general steps that may help…",
                      )}
                    </div>
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
                          width: "80%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-slate-91-2)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "56%",
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
                    <path d="M5 3l10 6-4.5 1.2L13 16l-2 1-2.5-5.8L5 14z" />
                  </svg>
                  {t("Pages opened: 0")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(1, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-saffron-84), transparent 65%), var(--hp-saffron-94)",
            }}
          >
            <div className="fit">
              <div
                className="mstack"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "28px",
                }}
              >
                <div
                  className="rv t1"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px",
                    width: "170px",
                    textAlign: "center",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "relative",
                      flex: "none",
                      display: "inline-block",
                      width: "64px",
                      height: "64px",
                    }}
                  >
                    <span
                      className="pulse"
                      style={{
                        position: "absolute",
                        inset: "0",
                        borderRadius: "9999px",
                        background: "rgba(255,139,43,.35)",
                        animationDelay: "0s",
                      }}
                    ></span>
                    <span
                      className="pulse"
                      style={{
                        position: "absolute",
                        inset: "0",
                        borderRadius: "9999px",
                        background: "rgba(255,139,43,.35)",
                        animationDelay: "-1.2s",
                      }}
                    ></span>
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
                    aria-hidden="true"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "2px",
                      height: "22px",
                    }}
                  >
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "40%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.00s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "80%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.13s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "55%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.26s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "100%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.39s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "65%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.52s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "90%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.65s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "45%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.78s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "75%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.91s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "60%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.04s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "95%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.17s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "50%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.30s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "85%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.43s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "35%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.56s",
                      }}
                    ></span>
                    <span
                      className="wv"
                      style={{
                        width: "3px",
                        height: "70%",
                        background: "var(--hp-accent)",
                        animationDelay: "-0.69s",
                      }}
                    ></span>
                  </span>
                  <div
                    className="d"
                    style={{
                      fontSize: "19px",
                      lineHeight: 1.2,
                      color: "var(--hp-saffron-13)",
                    }}
                  >
                    {t("“Open Class 8 attendance.”")}
                  </div>
                </div>
                <div className="aw rv t2" style={{ width: "250px" }}>
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
                      {t("Class 8 attendance")}
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
                      className="rv t2"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        background: "rgba(23,19,16,.035)",
                        fontSize: "13px",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "var(--hp-ink)",
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            flex: "none",
                            width: "24px",
                            height: "24px",
                            borderRadius: "9999px",
                            background: "var(--hp-saffron-88)",
                            color: "var(--hp-saffron-29)",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {"01"}
                        </span>
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          className="chip "
                          style={{
                            background: "var(--hp-green-91)",
                            color: "var(--hp-success-deep)",
                          }}
                        >
                          {t("Present")}
                        </span>
                      </span>
                    </div>
                    <div
                      className="rv t3"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        background: "rgba(23,19,16,.035)",
                        fontSize: "13px",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "var(--hp-ink)",
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            flex: "none",
                            width: "24px",
                            height: "24px",
                            borderRadius: "9999px",
                            background: "var(--hp-saffron-88)",
                            color: "var(--hp-saffron-29)",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {"02"}
                        </span>
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          className="chip "
                          style={{
                            background: "var(--hp-green-91)",
                            color: "var(--hp-success-deep)",
                          }}
                        >
                          {t("Present")}
                        </span>
                      </span>
                    </div>
                    <div
                      className="rv t4"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        background: "rgba(23,19,16,.035)",
                        fontSize: "13px",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "var(--hp-ink)",
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            flex: "none",
                            width: "24px",
                            height: "24px",
                            borderRadius: "9999px",
                            background: "var(--hp-saffron-88)",
                            color: "var(--hp-saffron-29)",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {"03"}
                        </span>
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          className="chip "
                          style={{
                            background: "var(--hp-red-93)",
                            color: "var(--hp-red-32)",
                          }}
                        >
                          {t("Absent")}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(1, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "Teachers move through several menus to reach a single function.",
            )}
          </p>
          <p className={`capx ${on(1, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t(
              "A general assistant can advise, but cannot act within the school’s systems.",
            )}
          </p>
          <p className={`capx ${on(1, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t(
              "One spoken instruction, in any supported language, opens the right page and completes the task.",
            )}
          </p>
        </div>
      </article>
      <article className="card big">
        <div>
          <h3 style={{ margin: "0", fontSize: "36px", lineHeight: 1.08 }}>
            {t("Exam papers")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("CBSE and ICSE pattern papers in minutes, yours to refine.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Exam papers")}
        >
          <span className="knob" style={knob(2)} />
          <button
            type="button"
            aria-pressed={sel[2] === 0}
            onClick={() => pick(2, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[2] === 1}
            onClick={() => pick(2, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[2] === 2}
            onClick={() => pick(2, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(2, 0)}`}>
            <div className="fit">
              <div
                style={{ position: "relative", width: "100%", height: "100%" }}
              >
                <div
                  className="rv t1"
                  style={{ position: "absolute", left: "3%", top: "10%" }}
                >
                  <div
                    className="paper"
                    style={{
                      width: "170px",
                      maxWidth: "100%",
                      transform: "rotate(-7deg)",
                    }}
                  >
                    <div
                      className="hw"
                      style={{
                        fontSize: "17px",
                        color: "var(--hp-indigo-36)",
                        marginBottom: "6px",
                      }}
                    >
                      {t("2024 paper")}
                    </div>
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
                          width: "92%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "70%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "84%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "60%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                    </div>
                    <span
                      style={{
                        display: "block",
                        marginTop: "8px",
                        width: "70%",
                        height: "10px",
                        background: "rgba(255,214,0,.45)",
                      }}
                    ></span>
                  </div>
                </div>
                <div
                  className="rv t1"
                  style={{ position: "absolute", left: "23%", top: "36%" }}
                >
                  <div
                    className="paper"
                    style={{
                      width: "170px",
                      maxWidth: "100%",
                      transform: "rotate(5deg)",
                    }}
                  >
                    <div
                      className="hw"
                      style={{
                        fontSize: "17px",
                        color: "var(--hp-indigo-36)",
                        marginBottom: "6px",
                      }}
                    >
                      {t("2025 paper")}
                    </div>
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
                          width: "92%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "70%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "84%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "60%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                    </div>
                    <span
                      style={{
                        display: "block",
                        marginTop: "8px",
                        width: "70%",
                        height: "10px",
                        background: "rgba(255,214,0,.45)",
                      }}
                    ></span>
                  </div>
                </div>
                <div
                  className="rv t1"
                  style={{ position: "absolute", left: "46%", top: "14%" }}
                >
                  <div
                    className="paper"
                    style={{
                      width: "170px",
                      maxWidth: "100%",
                      transform: "rotate(-3deg)",
                    }}
                  >
                    <div
                      className="hw"
                      style={{
                        fontSize: "17px",
                        color: "var(--hp-indigo-36)",
                        marginBottom: "6px",
                      }}
                    >
                      {t("Textbook")}
                    </div>
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
                          width: "92%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "70%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "84%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "60%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                    </div>
                    <span
                      style={{
                        display: "block",
                        marginTop: "8px",
                        width: "70%",
                        height: "10px",
                        background: "rgba(255,214,0,.45)",
                      }}
                    ></span>
                  </div>
                </div>
                <div
                  className="rv t3"
                  style={{ position: "absolute", right: "5%", bottom: "8%" }}
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
                    {t("Late evening")}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(2, 1)}`}>
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
                    {t("Make a Class 7 paper on fractions")}
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
                        {t("Outside syllabus?")}
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        color: "var(--hp-slate-33)",
                      }}
                    >
                      <b style={{ fontWeight: 600 }}>{t("Q5")}</b>
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
                        {t("Outside syllabus?")}
                      </span>
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
                    <path d="M10 3l8 14H2z" />
                    <path d="M10 8v4M10 14.5v.01" />
                  </svg>
                  {t("Board alignment: not checked")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(2, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-indigo-92), transparent 65%), var(--hp-indigo-96)",
            }}
          >
            <div className="fit">
              <div
                className="exam-s"
                style={{
                  position: "relative",
                  width: "420px",
                  height: "310px",
                }}
              >
                <div
                  className="rv t2 ex-bp"
                  style={{ position: "absolute", left: "0", top: "40px" }}
                >
                  <div
                    className="aw"
                    style={{
                      width: "170px",
                      padding: "14px",
                      transform: "rotate(-7deg)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        marginBottom: "8px",
                      }}
                    >
                      {t("Blueprint")}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0,1fr))",
                        gap: "4px",
                      }}
                    >
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-72)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-72)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-72)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-72)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "14px",
                          borderRadius: "3px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                    </div>
                  </div>
                </div>
                <div
                  className="rv t3 ex-key"
                  style={{ position: "absolute", right: "0", top: "40px" }}
                >
                  <div
                    className="aw"
                    style={{
                      width: "170px",
                      padding: "14px",
                      transform: "rotate(7deg)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        marginBottom: "8px",
                        textAlign: "right",
                      }}
                    >
                      {t("Answer key")}
                    </div>
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
                          width: "60%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "80%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "50%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "70%",
                          height: "6px",
                          borderRadius: "4px",
                          background: "var(--hp-indigo-92)",
                        }}
                      ></span>
                    </div>
                  </div>
                </div>
                <div
                  className="rv t1 ex-main"
                  style={{ position: "absolute", left: "85px", top: "0" }}
                >
                  <div
                    className="aw"
                    style={{ width: "250px", padding: "16px 18px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      <span>{t("Class 7 Mathematics")}</span>
                      <span>{t("40 marks")}</span>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--hp-muted)",
                        margin: "2px 0 6px",
                      }}
                    >
                      {t("Fractions, NCERT Ganita Prakash 7, Ch 8")}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--hp-indigo-36)",
                        margin: "8px 0 5px",
                      }}
                    >
                      {t("Section A, 10 marks")}
                    </div>
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
                          width: "90%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-indigo-94)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "70%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-indigo-94)",
                        }}
                      ></span>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--hp-indigo-36)",
                        margin: "8px 0 5px",
                      }}
                    >
                      {t("Section B, 15 marks")}
                    </div>
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
                          width: "86%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-indigo-94)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "74%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-indigo-94)",
                        }}
                      ></span>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--hp-indigo-36)",
                        margin: "8px 0 5px",
                      }}
                    >
                      {t("Section C, 15 marks")}
                    </div>
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
                          width: "92%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-indigo-94)",
                        }}
                      ></span>
                    </div>
                  </div>
                </div>
                <div
                  className="rv t4"
                  style={{
                    position: "absolute",
                    left: "0",
                    right: "0",
                    bottom: "0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      justifyContent: "center",
                    }}
                  >
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
                      {t("Paper")}
                    </span>
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
                      {t("Blueprint")}
                    </span>
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
                      {t("Answer key")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(2, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "Papers are compiled from previous papers and the textbook, usually outside school hours.",
            )}
          </p>
          <p className={`capx ${on(2, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t(
              "Questions are generated quickly but are not verified against the prescribed syllabus.",
            )}
          </p>
          <p className={`capx ${on(2, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t(
              "A complete paper, blueprint and answer key, aligned to the board and ready for the teacher’s review.",
            )}
          </p>
        </div>
      </article>
      <article className="card big">
        <div>
          <h3 style={{ margin: "0", fontSize: "36px", lineHeight: 1.08 }}>
            {t("AI Mentor")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("A teaching mentor for every teacher, aligned with NEP 2020.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: AI Mentor")}
        >
          <span className="knob" style={knob(3)} />
          <button
            type="button"
            aria-pressed={sel[3] === 0}
            onClick={() => pick(3, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[3] === 1}
            onClick={() => pick(3, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[3] === 2}
            onClick={() => pick(3, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(3, 0)}`}>
            <div className="fit">
              <div className="rv t1" style={{}}>
                <div
                  style={{
                    width: "280px",
                    background: "var(--hp-stone-99)",
                    borderRadius: "14px",
                    padding: "16px",
                    boxShadow: "0 18px 40px rgba(60,40,20,.15)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--hp-stone-21)",
                      marginBottom: "8px",
                    }}
                  >
                    <span>{t("December")}</span>
                    <span style={{ color: "var(--hp-clay-60)" }}>
                      {t("Staff calendar")}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, minmax(0,1fr))",
                      gap: "3px",
                    }}
                  >
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"1"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"2"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"3"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"4"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"5"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"6"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"7"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"8"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"9"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"10"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"11"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"12"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"13"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"14"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"15"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"16"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"17"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"18"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-accent-deep)",
                        borderRadius: "9999px",
                        outline: "2px solid var(--hp-saffron-49)",
                        outlineOffset: "-1px",
                        fontWeight: 700,
                      }}
                    >
                      {"19"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"20"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"21"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"22"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"23"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"24"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"25"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"26"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"27"}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "var(--hp-clay-36)",
                        borderRadius: "9999px",
                      }}
                    >
                      {"28"}
                    </span>
                  </div>
                </div>
              </div>
              <div
                className="rv t2"
                style={{ position: "absolute", right: "12%", top: "18%" }}
              >
                <div
                  className="hw"
                  style={{
                    fontSize: "19px",
                    color: "var(--hp-accent)",
                    transform: "rotate(-4deg)",
                  }}
                >
                  {t("Training day")}
                </div>
              </div>
              <div
                className="rv t3"
                style={{ position: "absolute", right: "20px", bottom: "20px" }}
              >
                <div
                  className="hw"
                  style={{
                    transform: "rotate(3deg)",
                    background:
                      "linear-gradient(180deg,var(--hp-sun-83),var(--hp-sun-77))",
                    padding: "12px 14px",
                    width: "130px",
                    fontSize: "17px",
                    lineHeight: 1.15,
                    color: "var(--hp-saffron-22)",
                    boxShadow: "0 12px 24px rgba(60,40,20,.18)",
                    borderRadius: "2px",
                  }}
                >
                  {t("Until then, on her own")}
                </div>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(3, 1)}`}>
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
                    {t("My class loses focus after lunch")}
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
                      {t(
                        "Try engaging activities, short breaks and positive reinforcement.",
                      )}
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
                  {t("Your class and board: unknown")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(3, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-red-91), transparent 65%), var(--hp-stone-96-2)",
            }}
          >
            <div className="fit">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  width: "100%",
                  maxWidth: "440px",
                }}
              >
                <div
                  className="rv t1"
                  style={{
                    alignSelf: "flex-end",
                    background: "var(--hp-ink)",
                    color: "var(--hp-white)",
                    borderRadius: "16px 16px 4px 16px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    maxWidth: "80%",
                  }}
                >
                  {t(
                    "My Class 6 loses focus after lunch. What would you suggest?",
                  )}
                </div>
                <div
                  className="m1col"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                    gap: "10px",
                  }}
                >
                  <div
                    className="aw rv t2"
                    style={{
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "9px",
                        background: "var(--hp-saffron-91-2)",
                        color: "var(--hp-accent-deep)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="7" cy="7" r="3" />
                        <path d="M2 17a5 5 0 0 1 10 0M13 5a3 3 0 0 1 0 6M15 17a5 5 0 0 0-2-4" />
                      </svg>
                    </span>
                    <div
                      className="d"
                      style={{ fontSize: "15px", lineHeight: 1.2 }}
                    >
                      {t("Recall walk")}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--hp-muted)",
                        lineHeight: 1.35,
                      }}
                    >
                      {t("Pairs share one idea from the last lesson.")}
                    </div>
                  </div>
                  <div
                    className="aw rv t3"
                    style={{
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "9px",
                        background: "var(--hp-indigo-94)",
                        color: "var(--hp-indigo-36)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="10" cy="10" r="7" />
                        <path d="M10 9v4M10 6.5v.01" />
                      </svg>
                    </span>
                    <div
                      className="d"
                      style={{ fontSize: "15px", lineHeight: 1.2 }}
                    >
                      {t("Open with a puzzle")}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--hp-muted)",
                        lineHeight: 1.35,
                      }}
                    >
                      {t("One question the class solves together.")}
                    </div>
                  </div>
                  <div
                    className="aw rv t4"
                    style={{
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "9px",
                        background: "var(--hp-green-91)",
                        color: "var(--hp-success)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M13.5 3.5l3 3L7 16l-4 1 1-4z" />
                      </svg>
                    </span>
                    <div
                      className="d"
                      style={{ fontSize: "15px", lineHeight: 1.2 }}
                    >
                      {t("Hands first")}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--hp-muted)",
                        lineHeight: 1.35,
                      }}
                    >
                      {t("An activity before the notebook.")}
                    </div>
                  </div>
                </div>
                <div className="rv t5">
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
                    {t("Grounded in NEP 2020 and teacher-training practice")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(3, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "Professional support is available mainly on scheduled training days.",
            )}
          </p>
          <p className={`capx ${on(3, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t(
              "Advice is general and does not reflect the class, board or policy context.",
            )}
          </p>
          <p className={`capx ${on(3, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t(
              "Practical, context-specific strategies, grounded in NEP 2020, whenever they are needed.",
            )}
          </p>
        </div>
      </article>
    </>
  );
}
