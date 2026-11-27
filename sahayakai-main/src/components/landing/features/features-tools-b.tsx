"use client";

/* Generated from the founder-approved Claude Design source (Features.dc.html, 2026-11-27).
   Markup only; the switch state lives in features-page.tsx. */
import { useLanguage } from "@/context/language-context";
import { type CompareProps, useCompareView } from "./features-compare";

/** Messaging, library, teachers’ community and Video Storyteller. */
export function ToolCardsB({ sel, pick }: CompareProps) {
  const { t } = useLanguage();
  const { on, knob } = useCompareView(sel);
  return (
    <>
      <article className="card">
        <div>
          <h3 style={{ margin: "0", fontSize: "30px", lineHeight: 1.08 }}>
            {t("Messaging")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("Unified communication with parents and staff.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Messaging")}
        >
          <span className="knob" style={knob(8)} />
          <button
            type="button"
            aria-pressed={sel[8] === 0}
            onClick={() => pick(8, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[8] === 1}
            onClick={() => pick(8, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[8] === 2}
            onClick={() => pick(8, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(8, 0)}`}>
            <div className="fit">
              <div
                style={{ display: "flex", alignItems: "flex-end", gap: "16px" }}
              >
                <div className="rv t1" style={{}}>
                  <div
                    style={{
                      width: "100px",
                      height: "136px",
                      background:
                        "linear-gradient(160deg,var(--hp-saffron-47),var(--hp-saffron-33))",
                      borderRadius: "4px 10px 10px 4px",
                      borderLeft: "8px solid var(--hp-saffron-24)",
                      boxShadow: "0 14px 30px rgba(60,40,20,.2)",
                      transform: "rotate(-6deg)",
                      color: "var(--hp-saffron-94-2)",
                      padding: "12px",
                      boxSizing: "border-box",
                    }}
                    className="hw"
                  >
                    <div style={{ fontSize: "18px" }}>{t("Diary")}</div>
                  </div>
                </div>
                <div className="rv t2" style={{}}>
                  <div
                    className="paper"
                    style={{
                      width: "130px",
                      maxWidth: "100%",
                      transform: "rotate(3deg)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--hp-stone-21)",
                        marginBottom: "8px",
                      }}
                    >
                      {t("CIRCULAR")}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "7px",
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
                      <span
                        style={{
                          display: "block",
                          width: "90%",
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
                          width: "84%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-clay-86)",
                        }}
                      ></span>
                    </div>
                  </div>
                </div>
                <div className="rv t3" style={{}}>
                  <div
                    style={{
                      width: "120px",
                      height: "190px",
                      borderRadius: "20px",
                      background: "var(--hp-white)",
                      border: "6px solid var(--hp-stone-21)",
                      boxSizing: "border-box",
                      padding: "10px 8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "9999px",
                          background: "var(--hp-green-87)",
                        }}
                      ></span>
                      <span
                        style={{
                          flex: "1",
                          height: "5px",
                          borderRadius: "3px",
                          background: "var(--hp-stone-88)",
                        }}
                      ></span>
                      <span
                        style={{
                          fontSize: "9px",
                          color: "var(--hp-white)",
                          background: "var(--hp-green-42)",
                          borderRadius: "9999px",
                          padding: "0 5px",
                        }}
                      >
                        {"12"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "9999px",
                          background: "var(--hp-green-87)",
                        }}
                      ></span>
                      <span
                        style={{
                          flex: "1",
                          height: "5px",
                          borderRadius: "3px",
                          background: "var(--hp-stone-88)",
                        }}
                      ></span>
                      <span
                        style={{
                          fontSize: "9px",
                          color: "var(--hp-white)",
                          background: "var(--hp-green-42)",
                          borderRadius: "9999px",
                          padding: "0 5px",
                        }}
                      >
                        {"4"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "9999px",
                          background: "var(--hp-green-87)",
                        }}
                      ></span>
                      <span
                        style={{
                          flex: "1",
                          height: "5px",
                          borderRadius: "3px",
                          background: "var(--hp-stone-88)",
                        }}
                      ></span>
                      <span
                        style={{
                          fontSize: "9px",
                          color: "var(--hp-white)",
                          background: "var(--hp-green-42)",
                          borderRadius: "9999px",
                          padding: "0 5px",
                        }}
                      >
                        {"27"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "9999px",
                          background: "var(--hp-green-87)",
                        }}
                      ></span>
                      <span
                        style={{
                          flex: "1",
                          height: "5px",
                          borderRadius: "3px",
                          background: "var(--hp-stone-88)",
                        }}
                      ></span>
                      <span
                        style={{
                          fontSize: "9px",
                          color: "var(--hp-white)",
                          background: "var(--hp-green-42)",
                          borderRadius: "9999px",
                          padding: "0 5px",
                        }}
                      >
                        {"9"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "9999px",
                          background: "var(--hp-green-87)",
                        }}
                      ></span>
                      <span
                        style={{
                          flex: "1",
                          height: "5px",
                          borderRadius: "3px",
                          background: "var(--hp-stone-88)",
                        }}
                      ></span>
                      <span
                        style={{
                          fontSize: "9px",
                          color: "var(--hp-white)",
                          background: "var(--hp-green-42)",
                          borderRadius: "9999px",
                          padding: "0 5px",
                        }}
                      >
                        {"3"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "9999px",
                          background: "var(--hp-green-87)",
                        }}
                      ></span>
                      <span
                        style={{
                          flex: "1",
                          height: "5px",
                          borderRadius: "3px",
                          background: "var(--hp-stone-88)",
                        }}
                      ></span>
                      <span
                        style={{
                          fontSize: "9px",
                          color: "var(--hp-white)",
                          background: "var(--hp-green-42)",
                          borderRadius: "9999px",
                          padding: "0 5px",
                        }}
                      >
                        {"16"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(8, 1)}`}>
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
                    {t("Write a PTM notice")}
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
                        "Dear Parents, the Parent-Teacher Meeting will be held on Saturday…",
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
                          width: "62%",
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
                    <path d="M3 10l14-6-6 14-2-6z" />
                  </svg>
                  {t("Sent to: nobody yet")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(8, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-green-86), transparent 65%), var(--hp-stone-92)",
            }}
          >
            <div className="fit">
              <div
                className="mstack"
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  maxWidth: "470px",
                  justifyContent: "center",
                }}
              >
                <div className="aw rv t1" style={{ width: "200px" }}>
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
                      {t("New message")}
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
                        fontSize: "14px",
                        color: "var(--hp-ink)",
                        lineHeight: 1.45,
                      }}
                    >
                      {t(
                        "PTM on Saturday at 10 am. Please meet your child’s class teacher.",
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span
                        className="chip "
                        style={{
                          background: "var(--hp-saffron-91-2)",
                          color: "var(--hp-saffron-29)",
                        }}
                      >
                        {t("Voice")}
                      </span>
                      <span
                        className="chip "
                        style={{
                          background: "var(--hp-slate-94)",
                          color: "var(--hp-slate-33)",
                        }}
                      >
                        {t("Text")}
                      </span>
                    </div>
                  </div>
                </div>
                <svg
                  className="mhide"
                  aria-hidden="true"
                  width="70"
                  height="150"
                  viewBox="0 0 70 150"
                  style={{ flex: "none" }}
                >
                  <path
                    className="dash"
                    d="M0 75 C35 75 35 18 70 18"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray="5 6"
                    style={{ stroke: "var(--hp-saffron)" }}
                  />
                  <path
                    className="dash"
                    d="M0 75 C35 75 35 75 70 75"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray="5 6"
                    style={{ stroke: "var(--hp-saffron)" }}
                  />
                  <path
                    className="dash"
                    d="M0 75 C35 75 35 132 70 132"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray="5 6"
                    style={{ stroke: "var(--hp-saffron)" }}
                  />
                </svg>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "26px",
                  }}
                >
                  <div
                    className="rv t2"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "var(--hp-white)",
                      borderRadius: "9999px",
                      padding: "6px 12px 6px 6px",
                      boxShadow: "0 8px 20px rgba(122,60,10,.14)",
                      fontSize: "12px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: "22px",
                        height: "22px",
                        borderRadius: "9999px",
                        background: "var(--hp-green-91)",
                        color: "var(--hp-success)",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="12"
                        height="12"
                        viewBox="0 0 20 20"
                        fill="none"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ stroke: "var(--hp-success)" }}
                      >
                        <path d="M4 10.5l4 4 8-9" />
                      </svg>
                    </span>
                    {t("Class 7 parents")}
                  </div>
                  <div
                    className="rv t3"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "var(--hp-white)",
                      borderRadius: "9999px",
                      padding: "6px 12px 6px 6px",
                      boxShadow: "0 8px 20px rgba(122,60,10,.14)",
                      fontSize: "12px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: "22px",
                        height: "22px",
                        borderRadius: "9999px",
                        background: "var(--hp-green-91)",
                        color: "var(--hp-success)",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="12"
                        height="12"
                        viewBox="0 0 20 20"
                        fill="none"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ stroke: "var(--hp-success)" }}
                      >
                        <path d="M4 10.5l4 4 8-9" />
                      </svg>
                    </span>
                    {t("Class teachers")}
                  </div>
                  <div
                    className="rv t4"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "var(--hp-white)",
                      borderRadius: "9999px",
                      padding: "6px 12px 6px 6px",
                      boxShadow: "0 8px 20px rgba(122,60,10,.14)",
                      fontSize: "12px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: "22px",
                        height: "22px",
                        borderRadius: "9999px",
                        background: "var(--hp-green-91)",
                        color: "var(--hp-success)",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="12"
                        height="12"
                        viewBox="0 0 20 20"
                        fill="none"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ stroke: "var(--hp-success)" }}
                      >
                        <path d="M4 10.5l4 4 8-9" />
                      </svg>
                    </span>
                    {t("All staff")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(8, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "Notices travel through diaries, printed circulars and personal messaging groups.",
            )}
          </p>
          <p className={`capx ${on(8, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t("The notice can be drafted, but distribution remains manual.")}
          </p>
          <p className={`capx ${on(8, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t("A single message reaches every relevant group from one place.")}
          </p>
        </div>
      </article>
      <article className="card">
        <div>
          <h3 style={{ margin: "0", fontSize: "30px", lineHeight: 1.08 }}>
            {t("Library")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("A single, searchable repository of every resource prepared.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Library")}
        >
          <span className="knob" style={knob(9)} />
          <button
            type="button"
            aria-pressed={sel[9] === 0}
            onClick={() => pick(9, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[9] === 1}
            onClick={() => pick(9, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[9] === 2}
            onClick={() => pick(9, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(9, 0)}`}>
            <div className="fit">
              <div
                style={{
                  position: "relative",
                  width: "360px",
                  height: "230px",
                }}
              >
                <div
                  className="rv t1"
                  style={{ position: "absolute", left: "10px", top: "40px" }}
                >
                  <div
                    style={{
                      width: "140px",
                      height: "100px",
                      background:
                        "linear-gradient(160deg,var(--hp-saffron-65),var(--hp-saffron-54))",
                      borderRadius: "4px 14px 6px 6px",
                      boxShadow: "0 14px 26px rgba(60,40,20,.2)",
                      transform: "rotate(-8deg)",
                    }}
                  ></div>
                </div>
                <div
                  className="rv t2"
                  style={{ position: "absolute", left: "170px", top: "110px" }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "72px",
                      background:
                        "linear-gradient(160deg,var(--hp-indigo-72),var(--hp-indigo-55))",
                      borderRadius: "6px",
                      boxShadow: "0 10px 20px rgba(30,40,80,.25)",
                      transform: "rotate(18deg)",
                    }}
                  ></div>
                </div>
                <div
                  className="rv t3"
                  style={{ position: "absolute", right: "20px", top: "30px" }}
                >
                  <div
                    style={{
                      width: "80px",
                      height: "140px",
                      borderRadius: "14px",
                      border: "5px solid var(--hp-stone-21)",
                      background: "var(--hp-stone-89)",
                      transform: "rotate(10deg)",
                      boxShadow: "0 14px 26px rgba(60,40,20,.2)",
                    }}
                  ></div>
                </div>
                <div
                  className="rv t4"
                  style={{ position: "absolute", left: "0", bottom: "0" }}
                >
                  <div
                    className="hw"
                    style={{
                      fontSize: "20px",
                      color: "var(--hp-clay-36)",
                      transform: "rotate(-2deg)",
                    }}
                  >
                    {t("Where was last year’s worksheet?")}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(9, 1)}`}>
            <div className="fit">
              <div className="rv t1" style={{}}>
                <div
                  className="cw"
                  style={{ display: "flex", flexDirection: "column" }}
                >
                  <div
                    style={{
                      padding: "11px 14px",
                      borderBottom: "1px solid var(--hp-slate-94-2)",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--hp-slate-33)",
                    }}
                  >
                    {t("Recent chats")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--hp-slate-95)",
                      fontSize: "13px",
                      color: "var(--hp-indigo-20)",
                    }}
                  >
                    <span>{t("Fractions worksheet?")}</span>
                    <span
                      style={{ color: "var(--hp-slate-64)", fontSize: "12px" }}
                    >
                      {t("14 Nov")}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--hp-slate-95)",
                      fontSize: "13px",
                      color: "var(--hp-indigo-20)",
                    }}
                  >
                    <span>{t("Worksheet ideas")}</span>
                    <span
                      style={{ color: "var(--hp-slate-64)", fontSize: "12px" }}
                    >
                      {t("2 Oct")}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--hp-slate-95)",
                      fontSize: "13px",
                      color: "var(--hp-indigo-20)",
                    }}
                  >
                    <span>{t("Class 7 test")}</span>
                    <span
                      style={{ color: "var(--hp-slate-64)", fontSize: "12px" }}
                    >
                      {t("19 Aug")}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--hp-slate-95)",
                      fontSize: "13px",
                      color: "var(--hp-indigo-20)",
                    }}
                  >
                    <span>{t("Untitled")}</span>
                    <span
                      style={{ color: "var(--hp-slate-64)", fontSize: "12px" }}
                    >
                      {t("3 Jul")}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--hp-slate-95)",
                      fontSize: "13px",
                      color: "var(--hp-indigo-20)",
                    }}
                  >
                    <span>{t("New chat")}</span>
                    <span
                      style={{ color: "var(--hp-slate-64)", fontSize: "12px" }}
                    >
                      {t("1 Jul")}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 14px",
                      background: "var(--hp-slate-97-2)",
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
                    {t("Kept as conversations, not documents")}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(9, 2)}`}
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
                    {t("Library")}
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
                      alignItems: "center",
                      gap: "8px",
                      background: "rgba(23,19,16,.04)",
                      borderRadius: "9999px",
                      padding: "8px 12px",
                      fontSize: "13px",
                      color: "var(--hp-ink)",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-muted)" }}
                    >
                      <circle cx="9" cy="9" r="5" />
                      <path d="M13 13l4 4" />
                    </svg>
                    <span className="typed">{t("fractions")}</span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                      gap: "8px",
                    }}
                  >
                    <div
                      className="rv t2"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "9px",
                        padding: "9px",
                        borderRadius: "12px",
                        background: "var(--hp-white)",
                        border: "1px solid rgba(23,19,16,.07)",
                      }}
                    >
                      <span
                        style={{
                          flex: "none",
                          width: "30px",
                          height: "30px",
                          borderRadius: "8px",
                          background: "var(--hp-saffron-91-2)",
                          color: "var(--hp-accent-deep)",
                          fontSize: "11px",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {t("LP")}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          lineHeight: 1.25,
                          fontWeight: 500,
                        }}
                      >
                        {t("Fractions, lesson plan")}
                      </span>
                    </div>
                    <div
                      className="rv t3"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "9px",
                        padding: "9px",
                        borderRadius: "12px",
                        background: "var(--hp-white)",
                        border: "1px solid rgba(23,19,16,.07)",
                      }}
                    >
                      <span
                        style={{
                          flex: "none",
                          width: "30px",
                          height: "30px",
                          borderRadius: "8px",
                          background: "var(--hp-green-91)",
                          color: "var(--hp-success)",
                          fontSize: "11px",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {t("WS")}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          lineHeight: 1.25,
                          fontWeight: 500,
                        }}
                      >
                        {t("Fractions, worksheet")}
                      </span>
                    </div>
                    <div
                      className="rv t4"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "9px",
                        padding: "9px",
                        borderRadius: "12px",
                        background: "var(--hp-white)",
                        border: "1px solid rgba(23,19,16,.07)",
                      }}
                    >
                      <span
                        style={{
                          flex: "none",
                          width: "30px",
                          height: "30px",
                          borderRadius: "8px",
                          background: "var(--hp-indigo-94)",
                          color: "var(--hp-indigo-36)",
                          fontSize: "11px",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {t("QZ")}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          lineHeight: 1.25,
                          fontWeight: 500,
                        }}
                      >
                        {t("Fractions, quiz")}
                      </span>
                    </div>
                    <div
                      className="rv t5"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "9px",
                        padding: "9px",
                        borderRadius: "12px",
                        background: "var(--hp-white)",
                        border: "1px solid rgba(23,19,16,.07)",
                      }}
                    >
                      <span
                        style={{
                          flex: "none",
                          width: "30px",
                          height: "30px",
                          borderRadius: "8px",
                          background: "var(--hp-red-93)",
                          color: "var(--hp-red-32)",
                          fontSize: "11px",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {t("EP")}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          lineHeight: 1.25,
                          fontWeight: 500,
                        }}
                      >
                        {t("Unit test, Class 7")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(9, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "Resources are scattered across folders, storage devices and personal phones.",
            )}
          </p>
          <p className={`capx ${on(9, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t(
              "Material is stored as conversations rather than organised documents.",
            )}
          </p>
          <p className={`capx ${on(9, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t(
              "Every lesson plan, worksheet, quiz and paper is stored and searchable in one place.",
            )}
          </p>
        </div>
      </article>
      <article className="card">
        <div>
          <h3 style={{ margin: "0", fontSize: "30px", lineHeight: 1.08 }}>
            {t("Teachers’ community")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("A professional network for sharing practice across schools.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Teachers’ community")}
        >
          <span className="knob" style={knob(10)} />
          <button
            type="button"
            aria-pressed={sel[10] === 0}
            onClick={() => pick(10, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[10] === 1}
            onClick={() => pick(10, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[10] === 2}
            onClick={() => pick(10, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(10, 0)}`}>
            <div className="fit">
              <div className="rv t1" style={{}}>
                <div
                  style={{
                    position: "relative",
                    width: "210px",
                    height: "220px",
                    background:
                      "linear-gradient(160deg,var(--hp-clay-55),var(--hp-clay-40))",
                    borderRadius: "8px",
                    padding: "10px",
                    boxSizing: "border-box",
                    boxShadow: "0 20px 40px rgba(60,40,20,.25)",
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      background:
                        "linear-gradient(160deg,var(--hp-clay-61),var(--hp-clay-48))",
                      borderRadius: "4px",
                    }}
                  ></span>
                  <span
                    style={{
                      background:
                        "linear-gradient(160deg,var(--hp-clay-61),var(--hp-clay-48))",
                      borderRadius: "4px",
                    }}
                  ></span>
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%,-50%)",
                      background: "var(--hp-saffron-66)",
                      borderRadius: "6px",
                      padding: "6px",
                      color: "var(--hp-saffron-22)",
                      display: "flex",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-saffron-22)" }}
                    >
                      <rect x="4.5" y="9" width="11" height="8" rx="2" />
                      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
                    </svg>
                  </span>
                </div>
              </div>
              <div
                className="rv t2"
                style={{ position: "absolute", left: "12%", top: "14%" }}
              >
                <div
                  className="hw"
                  style={{
                    fontSize: "19px",
                    color: "var(--hp-clay-36)",
                    transform: "rotate(-3deg)",
                  }}
                >
                  {t("Staffroom cupboard")}
                </div>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(10, 1)}`}>
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
                    {t("Worksheet on fractions")}
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
                      {t("Here is a worksheet with ten questions…")}
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
                          width: "86%",
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
                      <span
                        style={{
                          display: "block",
                          width: "52%",
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
                    <rect x="4.5" y="9" width="11" height="8" rx="2" />
                    <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
                  </svg>
                  {t("Shared with: no one")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(10, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-red-91), transparent 65%), var(--hp-stone-96-2)",
            }}
          >
            <div className="fit">
              <div
                style={{
                  position: "relative",
                  width: "420px",
                  maxWidth: "100%",
                  height: "280px",
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 420 280"
                  width="100%"
                  height="100%"
                  style={{ position: "absolute", inset: "0" }}
                >
                  <path
                    className="dash"
                    d="M210 140 Q135.0 65.0 60 50"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray="5 6"
                    style={{ stroke: "var(--hp-saffron-67)" }}
                  />
                  <path
                    className="dash"
                    d="M210 140 Q290.0 70.0 370 60"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray="5 6"
                    style={{ stroke: "var(--hp-saffron-67)" }}
                  />
                  <path
                    className="dash"
                    d="M210 140 Q135.0 155.0 60 230"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray="5 6"
                    style={{ stroke: "var(--hp-saffron-67)" }}
                  />
                  <path
                    className="dash"
                    d="M210 140 Q290.0 155.0 370 230"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray="5 6"
                    style={{ stroke: "var(--hp-saffron-67)" }}
                  />
                </svg>
                <div
                  className="rv t1"
                  style={{
                    position: "absolute",
                    left: "calc(50% - 85px)",
                    top: "96px",
                  }}
                >
                  <div
                    className="aw"
                    style={{ width: "170px", padding: "14px" }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 700 }}>
                      {t("Fractions worksheet")}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--hp-muted)",
                        margin: "2px 0 8px",
                      }}
                    >
                      {t("Shared by a teacher in Siliguri")}
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
                          background: "var(--hp-saffron-88)",
                        }}
                      ></span>
                      <span
                        style={{
                          display: "block",
                          width: "70%",
                          height: "5px",
                          borderRadius: "4px",
                          background: "var(--hp-saffron-88)",
                        }}
                      ></span>
                    </div>
                  </div>
                </div>
                <div
                  className="rv t2"
                  style={{ position: "absolute", left: "4px", top: "30px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "var(--hp-white)",
                      borderRadius: "9999px",
                      padding: "5px 12px 5px 5px",
                      boxShadow: "0 8px 20px rgba(122,60,10,.16)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: "26px",
                        height: "26px",
                        borderRadius: "9999px",
                        background: "var(--hp-indigo-94)",
                        color: "var(--hp-indigo-36)",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {t("SK")}
                    </span>
                    {t("Kolkata")}
                  </div>
                </div>
                <div
                  className="rv t3"
                  style={{ position: "absolute", right: "0", top: "40px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "var(--hp-white)",
                      borderRadius: "9999px",
                      padding: "5px 12px 5px 5px",
                      boxShadow: "0 8px 20px rgba(122,60,10,.16)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: "26px",
                        height: "26px",
                        borderRadius: "9999px",
                        background: "var(--hp-green-91)",
                        color: "var(--hp-success)",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {t("MB")}
                    </span>
                    {t("Bengaluru")}
                  </div>
                </div>
                <div
                  className="rv t4"
                  style={{ position: "absolute", left: "4px", bottom: "30px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "var(--hp-white)",
                      borderRadius: "9999px",
                      padding: "5px 12px 5px 5px",
                      boxShadow: "0 8px 20px rgba(122,60,10,.16)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: "26px",
                        height: "26px",
                        borderRadius: "9999px",
                        background: "var(--hp-saffron-91-2)",
                        color: "var(--hp-accent-deep)",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {t("RD")}
                    </span>
                    {t("Guwahati")}
                  </div>
                </div>
                <div
                  className="rv t5"
                  style={{ position: "absolute", right: "0", bottom: "30px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "var(--hp-white)",
                      borderRadius: "9999px",
                      padding: "5px 12px 5px 5px",
                      boxShadow: "0 8px 20px rgba(122,60,10,.16)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: "26px",
                        height: "26px",
                        borderRadius: "9999px",
                        background: "var(--hp-red-93)",
                        color: "var(--hp-red-32)",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {t("AP")}
                    </span>
                    {t("Siliguri")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(10, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t("Good practice remains within one staffroom.")}
          </p>
          <p className={`capx ${on(10, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t(
              "Material produced by one teacher remains in her private history.",
            )}
          </p>
          <p className={`capx ${on(10, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t(
              "Teachers share and adapt each other’s work across schools and cities.",
            )}
          </p>
        </div>
      </article>
      <article className="card">
        <div>
          <h3 style={{ margin: "0", fontSize: "30px", lineHeight: 1.08 }}>
            {t("Video Storyteller")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "17px",
              color: "var(--hp-body)",
            }}
          >
            {t("Curated video resources matched to class and topic.")}
          </p>
        </div>
        <div
          className="seg"
          role="group"
          aria-label={t("Compare ways of working: Video Storyteller")}
        >
          <span className="knob" style={knob(11)} />
          <button
            type="button"
            aria-pressed={sel[11] === 0}
            onClick={() => pick(11, 0)}
          >
            {t("Conventional")}
          </button>
          <button
            type="button"
            aria-pressed={sel[11] === 1}
            onClick={() => pick(11, 1)}
          >
            {t("General AI")}
          </button>
          <button
            type="button"
            aria-pressed={sel[11] === 2}
            onClick={() => pick(11, 2)}
          >
            {t("SahayakAI")}
          </button>
        </div>
        <div className="stage">
          <div className={`scene bg-hand ${on(11, 0)}`}>
            <div className="fit">
              <div className="rv t1" style={{}}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 100px)",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "62px",
                      borderRadius: "8px",
                      background:
                        "linear-gradient(160deg,var(--hp-clay-82),var(--hp-clay-70))",
                      filter: "grayscale(.6)",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-red-41)" }}
                    >
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </span>
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "62px",
                      borderRadius: "8px",
                      background:
                        "linear-gradient(160deg,var(--hp-clay-82),var(--hp-clay-70))",
                      filter: "grayscale(.6)",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-red-41)" }}
                    >
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </span>
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "62px",
                      borderRadius: "8px",
                      background:
                        "linear-gradient(160deg,var(--hp-clay-82),var(--hp-clay-70))",
                      filter: "grayscale(.6)",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-red-41)" }}
                    >
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </span>
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "62px",
                      borderRadius: "8px",
                      background:
                        "linear-gradient(160deg,var(--hp-clay-82),var(--hp-clay-70))",
                      filter: "grayscale(.6)",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-red-41)" }}
                    >
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </span>
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "62px",
                      borderRadius: "8px",
                      background:
                        "linear-gradient(160deg,var(--hp-clay-82),var(--hp-clay-70))",
                      filter: "grayscale(.6)",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-red-41)" }}
                    >
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </span>
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "62px",
                      borderRadius: "8px",
                      background:
                        "linear-gradient(160deg,var(--hp-green-86),var(--hp-green-66))",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-success)" }}
                    >
                      <path d="M4 10.5l4 4 8-9" />
                    </svg>
                  </span>
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "62px",
                      borderRadius: "8px",
                      background:
                        "linear-gradient(160deg,var(--hp-clay-82),var(--hp-clay-70))",
                      filter: "grayscale(.6)",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-red-41)" }}
                    >
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </span>
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "62px",
                      borderRadius: "8px",
                      background:
                        "linear-gradient(160deg,var(--hp-clay-82),var(--hp-clay-70))",
                      filter: "grayscale(.6)",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-red-41)" }}
                    >
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </span>
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "62px",
                      borderRadius: "8px",
                      background:
                        "linear-gradient(160deg,var(--hp-clay-82),var(--hp-clay-70))",
                      filter: "grayscale(.6)",
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 20 20"
                      fill="none"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: "var(--hp-red-41)" }}
                    >
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </span>
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
                    <circle cx="10" cy="10" r="7" />
                    <path d="M10 6v4l3 2" />
                  </svg>
                  {t("Previewing, one by one")}
                </span>
              </div>
            </div>
          </div>
          <div className={`scene bg-bot ${on(11, 1)}`}>
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
                    {t("Videos on the water cycle")}
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
                        fontSize: "12px",
                        color: "var(--hp-indigo-20)",
                        borderBottom: "1px solid var(--hp-slate-94-2)",
                        paddingBottom: "5px",
                      }}
                    >
                      {t("Water cycle for kids")}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--hp-indigo-20)",
                        borderBottom: "1px solid var(--hp-slate-94-2)",
                        paddingBottom: "5px",
                      }}
                    >
                      {t("The water cycle explained")}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--hp-indigo-20)",
                        borderBottom: "1px solid var(--hp-slate-94-2)",
                        paddingBottom: "5px",
                      }}
                    >
                      {t("Evaporation basics")}
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
                  {t("Not checked for your class")}
                </div>
              </div>
            </div>
          </div>
          <div
            className={`scene ${on(11, 2)}`}
            style={{
              background:
                "radial-gradient(70% 80% at 88% 0%, rgba(255,139,43,.30), transparent 60%), radial-gradient(60% 70% at 0% 100%, var(--hp-red-91), transparent 65%), var(--hp-stone-96-2)",
            }}
          >
            <div className="fit">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  className="rv t1"
                  style={{
                    width: "130px",
                    borderRadius: "16px",
                    overflow: "hidden",
                    background: "var(--hp-white)",
                    boxShadow: "0 14px 30px rgba(30,40,80,.14)",
                  }}
                >
                  <div
                    style={{
                      height: "80px",
                      background:
                        "linear-gradient(160deg,var(--hp-saffron-84),var(--hp-saffron-70))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "9999px",
                        background: "rgba(255,255,255,.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="18"
                        height="18"
                        viewBox="0 0 20 20"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          fill: "var(--hp-ink)",
                          stroke: "var(--hp-ink)",
                        }}
                      >
                        <path d="M7 5l8 5-8 5z" />
                      </svg>
                    </span>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        lineHeight: 1.25,
                      }}
                    >
                      {t("Evaporation, explained")}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--hp-muted)",
                        marginTop: "3px",
                      }}
                    >
                      {t("Class 6, Science")}
                    </div>
                  </div>
                </div>
                <div
                  className="rv t2"
                  style={{
                    width: "170px",
                    borderRadius: "16px",
                    overflow: "hidden",
                    background: "var(--hp-white)",
                    boxShadow:
                      "0 0 0 3px var(--hp-saffron), 0 26px 50px -12px rgba(122,60,10,.4)",
                  }}
                >
                  <div
                    style={{
                      height: "110px",
                      background:
                        "linear-gradient(160deg,var(--hp-indigo-87),var(--hp-indigo-55))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "9999px",
                        background: "rgba(255,255,255,.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="18"
                        height="18"
                        viewBox="0 0 20 20"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          fill: "var(--hp-ink)",
                          stroke: "var(--hp-ink)",
                        }}
                      >
                        <path d="M7 5l8 5-8 5z" />
                      </svg>
                    </span>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        lineHeight: 1.25,
                      }}
                    >
                      {t("The water cycle")}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--hp-muted)",
                        marginTop: "3px",
                      }}
                    >
                      {t("Class 6, Science")}
                    </div>
                  </div>
                </div>
                <div
                  className="rv t3"
                  style={{
                    width: "130px",
                    borderRadius: "16px",
                    overflow: "hidden",
                    background: "var(--hp-white)",
                    boxShadow: "0 14px 30px rgba(30,40,80,.14)",
                  }}
                >
                  <div
                    style={{
                      height: "80px",
                      background:
                        "linear-gradient(160deg,var(--hp-green-86),var(--hp-green-55))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "9999px",
                        background: "rgba(255,255,255,.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="18"
                        height="18"
                        viewBox="0 0 20 20"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          fill: "var(--hp-ink)",
                          stroke: "var(--hp-ink)",
                        }}
                      >
                        <path d="M7 5l8 5-8 5z" />
                      </svg>
                    </span>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        lineHeight: 1.25,
                      }}
                    >
                      {t("Clouds and rain")}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--hp-muted)",
                        marginTop: "3px",
                      }}
                    >
                      {t("Class 6, Science")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="caps">
          <p className={`capx ${on(11, 0)}`}>
            <b style={{ color: "var(--hp-clay-36)" }}>{t("Conventional.")}</b>{" "}
            {t(
              "Suitable videos are found only after previewing many unsuitable ones.",
            )}
          </p>
          <p className={`capx ${on(11, 1)}`}>
            <b style={{ color: "var(--hp-slate-33)" }}>{t("General AI.")}</b>{" "}
            {t("Titles are suggested but not reviewed for the class or topic.")}
          </p>
          <p className={`capx ${on(11, 2)}`}>
            <b style={{ color: "var(--hp-accent-deep)" }}>{t("SahayakAI.")}</b>{" "}
            {t("Videos selected for the class and topic, ready to present.")}
          </p>
        </div>
      </article>
    </>
  );
}
