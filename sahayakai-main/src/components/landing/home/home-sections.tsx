"use client";

/*
 * Homepage sections with no state: the pincode quote, the four looping
 * capability scenes and the NEP 2020 alignment. Generated from the
 * founder-approved design (Claude Design, Homepage v1, 2026-11-27) and kept
 * as plain markup so it stays faithful to it. Colours are the page palette in
 * home.css (var(--hp-*)); every visible string goes through t().
 */

import { useLanguage } from "@/context/language-context";

/**
 * The quote is translated as ONE sentence so every language keeps its own word
 * order. [word] marks the highlighted word and {word} the saffron one; the
 * translations carry the same markers around their own words.
 */
function QuoteLine({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]|\{[^}]+\})/);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[") ? (
          <span key={i} className="hl">
            {p.slice(1, -1)}
          </span>
        ) : p.startsWith("{") ? (
          <span key={i} style={{ color: "var(--hp-accent)" }}>
            {p.slice(1, -1)}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function HomeQuote() {
  const { t } = useLanguage();
  return (
    <section
      className="wrap"
      style={{ paddingTop: "16px", paddingBottom: "104px" }}
    >
      <figure
        className="quote"
        style={{
          position: "relative",
          overflow: "hidden",
          margin: "0",
          borderRadius: "36px",
          padding: "64px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "40px",
          background:
            "radial-gradient(50% 70% at 85% 50%, rgba(255,139,43,.42), transparent 62%), radial-gradient(45% 60% at 0% 100%, var(--hp-indigo-92), transparent 62%), radial-gradient(40% 60% at 0% 0%, var(--hp-saffron-96), transparent 70%), var(--hp-saffron-93)",
          boxShadow:
            "inset 0 0 0 1px rgba(23,19,16,.05), 0 50px 90px -40px rgba(200,100,20,.45)",
        }}
      >
        <span
          aria-hidden="true"
          className="d"
          style={{
            position: "absolute",
            left: "30px",
            top: "-40px",
            fontSize: "280px",
            lineHeight: 1,
            color: "rgba(194,86,15,.12)",
          }}
        >
          {"“"}
        </span>
        <div
          style={{
            position: "relative",
            flex: "1.4 1 480px",
            minWidth: "0",
            display: "flex",
            flexDirection: "column",
            gap: "26px",
          }}
        >
          <blockquote
            style={{
              margin: "0",
              fontSize: "clamp(34px, 4.8vw, 66px)",
              lineHeight: 1.05,
            }}
          >
            <QuoteLine
              text={t(
                "A child's [future] shouldn't be decided by its {pincode}.",
              )}
            />
          </blockquote>
          <figcaption
            style={{ display: "flex", alignItems: "center", gap: "14px" }}
          >
            <span
              style={{
                width: "34px",
                height: "2px",
                background: "var(--hp-accent)",
              }}
            ></span>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "var(--hp-ink)",
                }}
              >
                {t("Abhishek Gupta")}
              </span>
              <span style={{ fontSize: "15px", color: "var(--hp-body)" }}>
                {t(
                  "Founder and CEO, SARGVISION. SahayakAI is a SARGVISION product.",
                )}
              </span>
            </span>
          </figcaption>
        </div>
        <div
          className="qvis"
          aria-hidden="true"
          style={{
            position: "relative",
            flex: "1 1 340px",
            minWidth: "0",
            height: "320px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "relative",
              flex: "none",
              display: "inline-block",
              width: "120px",
              height: "120px",
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
          <div
            className="qpin qp1 aw"
            style={{
              position: "absolute",
              left: "4%",
              top: "6%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "16px",
              animationDelay: "0s",
            }}
          >
            <div>
              <div className="num" style={{ fontSize: "20px", lineHeight: 1 }}>
                {"734001"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--hp-muted)" }}>
                {t("Siliguri")}
              </div>
            </div>
            <span
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "9999px",
                background: "var(--hp-success)",
                color: "var(--hp-white)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                aria-hidden="true"
                width="13"
                height="13"
                viewBox="0 0 20 20"
                fill="none"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: "var(--hp-white)" }}
              >
                <path d="M4 10.5l4 4 8-9" />
              </svg>
            </span>
          </div>
          <div
            className="qpin qp2 aw"
            style={{
              position: "absolute",
              right: "2%",
              top: "14%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "16px",
              animationDelay: "-2s",
            }}
          >
            <div>
              <div className="num" style={{ fontSize: "20px", lineHeight: 1 }}>
                {"560001"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--hp-muted)" }}>
                {t("Bengaluru")}
              </div>
            </div>
            <span
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "9999px",
                background: "var(--hp-success)",
                color: "var(--hp-white)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                aria-hidden="true"
                width="13"
                height="13"
                viewBox="0 0 20 20"
                fill="none"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: "var(--hp-white)" }}
              >
                <path d="M4 10.5l4 4 8-9" />
              </svg>
            </span>
          </div>
          <div
            className="qpin qp3 aw"
            style={{
              position: "absolute",
              left: "10%",
              bottom: "8%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "16px",
              animationDelay: "-4s",
            }}
          >
            <div>
              <div className="num" style={{ fontSize: "20px", lineHeight: 1 }}>
                {"781001"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--hp-muted)" }}>
                {t("Guwahati")}
              </div>
            </div>
            <span
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "9999px",
                background: "var(--hp-success)",
                color: "var(--hp-white)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                aria-hidden="true"
                width="13"
                height="13"
                viewBox="0 0 20 20"
                fill="none"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: "var(--hp-white)" }}
              >
                <path d="M4 10.5l4 4 8-9" />
              </svg>
            </span>
          </div>
          <div
            className="qpin qp4 aw"
            style={{
              position: "absolute",
              right: "8%",
              bottom: "4%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "16px",
              animationDelay: "-1s",
            }}
          >
            <div>
              <div className="num" style={{ fontSize: "20px", lineHeight: 1 }}>
                {"700001"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--hp-muted)" }}>
                {t("Kolkata")}
              </div>
            </div>
            <span
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "9999px",
                background: "var(--hp-success)",
                color: "var(--hp-white)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                aria-hidden="true"
                width="13"
                height="13"
                viewBox="0 0 20 20"
                fill="none"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: "var(--hp-white)" }}
              >
                <path d="M4 10.5l4 4 8-9" />
              </svg>
            </span>
          </div>
        </div>
      </figure>
    </section>
  );
}

export function HomeCapabilities() {
  const { t } = useLanguage();
  return (
    <section id="features" className="wrap" style={{ paddingBottom: "96px" }}>
      <h2
        style={{
          margin: "0 0 14px",
          fontSize: "clamp(32px, 4.2vw, 56px)",
          lineHeight: 1.05,
          maxWidth: "860px",
          marginBottom: "10px",
        }}
      >
        {t("One team for every child.")}
      </h2>
      <p
        style={{
          margin: "0 0 40px",
          fontSize: "20px",
          color: "var(--hp-body)",
        }}
      >
        {t("School, teachers, parents: in step.")}
      </p>
      <div className="grid2">
        <article className="card">
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
              {t(
                "Dialled by AI, not your staff. In each parent's own language.",
              )}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginTop: "12px",
              }}
            >
              <span
                className="chip"
                style={{
                  background: "var(--hp-green-91)",
                  color: "var(--hp-success-deep)",
                }}
              >
                {t("Attendance")}
              </span>
              <span
                className="chip"
                style={{
                  background: "var(--hp-green-91)",
                  color: "var(--hp-success-deep)",
                }}
              >
                {t("PTMs and events")}
              </span>
              <span
                className="chip"
                style={{
                  background: "var(--hp-green-91)",
                  color: "var(--hp-success-deep)",
                }}
              >
                {t("Progress")}
              </span>
              <span
                className="chip"
                style={{
                  background: "var(--hp-green-91)",
                  color: "var(--hp-success-deep)",
                }}
              >
                {t("Good news")}
              </span>
              <span
                className="chip"
                style={{
                  background: "var(--hp-green-91)",
                  color: "var(--hp-success-deep)",
                }}
              >
                {t("Fees and forms")}
              </span>
              <span
                className="chip"
                style={{
                  background: "var(--hp-green-91)",
                  color: "var(--hp-success-deep)",
                }}
              >
                {t("Notices")}
              </span>
            </div>
          </div>
          <div className="stage">
            <div
              className="scene loop"
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
        </article>
        <article className="card">
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
              {t(
                "Just speak, and it's done. No menus, no typing, no training.",
              )}
            </p>
          </div>
          <div className="stage">
            <div
              className="scene loop"
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
        </article>
        <article className="card">
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
          <div className="stage">
            <div
              className="scene loop"
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
        </article>
        <article className="card">
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
          <div className="stage">
            <div
              className="scene loop"
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
        </article>
        <article
          className="card"
          style={{
            gridColumn: "1 / -1",
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "14px 32px",
          }}
        >
          <div style={{ flex: "1 1 420px", minWidth: "0" }}>
            <h3
              style={{ margin: "0 0 6px", fontSize: "30px", lineHeight: 1.1 }}
            >
              {t("And the tools of every school day")}
            </h3>
            <p
              style={{ margin: "0", fontSize: "17px", color: "var(--hp-body)" }}
            >
              {t(
                "Lesson plans, quizzes, scanning, field trips, messaging, library and more.",
              )}
            </p>
          </div>
          <a
            href="/features"
            style={{
              background: "var(--hp-ink)",
              color: "var(--hp-white)",
              textDecoration: "none",
              fontWeight: 600,
              padding: "14px 26px",
              borderRadius: "9999px",
            }}
          >
            {t("Explore all capabilities")}
          </a>
        </article>
      </div>
    </section>
  );
}

export function HomeNep() {
  const { t } = useLanguage();
  return (
    <section id="nep" style={{ background: "var(--hp-stone-96)" }}>
      <div
        className="wrap"
        style={{ paddingTop: "92px", paddingBottom: "92px" }}
      >
        <h2
          style={{
            margin: "0 0 36px",
            fontSize: "clamp(32px, 4.2vw, 56px)",
            lineHeight: 1.05,
            maxWidth: "820px",
          }}
        >
          {t("Aligned with NEP 2020.")}
        </h2>
        <div className="nepg">
          <div className="nept">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--hp-muted)",
                }}
              >
                {t("Para")}
              </span>
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
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
                  <path d="M4 3h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a1 1 0 0 1-1 1A14 14 0 0 1 3 4a1 1 0 0 1 1-1z" />
                </svg>
              </span>
            </div>
            <div
              className="d num"
              style={{
                fontSize: "52px",
                lineHeight: 1,
                color: "var(--hp-success)",
              }}
            >
              {"4.35"}
            </div>
            <div style={{ fontSize: "17px", fontWeight: 600 }}>
              {t("Calls to parents")}
            </div>
            <div
              style={{
                fontSize: "14px",
                lineHeight: 1.45,
                color: "var(--hp-body)",
              }}
            >
              {t(
                "A working link between home and school that actively involves parents.",
              )}
            </div>
          </div>
          <div className="nept">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--hp-muted)",
                }}
              >
                {t("Para")}
              </span>
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
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
                  <circle cx="10" cy="10" r="7" />
                  <path d="M10 9v4M10 6.5v.01" />
                </svg>
              </span>
            </div>
            <div
              className="d num"
              style={{
                fontSize: "52px",
                lineHeight: 1,
                color: "var(--hp-accent-deep)",
              }}
            >
              {"4.11"}
            </div>
            <div style={{ fontSize: "17px", fontWeight: 600 }}>
              {t("VIDYA")}
            </div>
            <div
              style={{
                fontSize: "14px",
                lineHeight: 1.45,
                color: "var(--hp-body)",
              }}
            >
              {t(
                "Teaching and learning in the home language wherever possible.",
              )}
            </div>
          </div>
          <div className="nept">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--hp-muted)",
                }}
              >
                {t("Para")}
              </span>
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
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
                  <path d="M10 3l8 14H2z" />
                  <path d="M10 8v4M10 14.5v.01" />
                </svg>
              </span>
            </div>
            <div
              className="d num"
              style={{
                fontSize: "52px",
                lineHeight: 1,
                color: "var(--hp-indigo-36)",
              }}
            >
              {"4.34"}
            </div>
            <div style={{ fontSize: "17px", fontWeight: 600 }}>
              {t("Exam papers")}
            </div>
            <div
              style={{
                fontSize: "14px",
                lineHeight: 1.45,
                color: "var(--hp-body)",
              }}
            >
              {t("Assessment that tests competencies, not rote memory.")}
            </div>
          </div>
          <div className="nept">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--hp-muted)",
                }}
              >
                {t("Para")}
              </span>
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
                  background: "var(--hp-red-93)",
                  color: "var(--hp-red-32)",
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
            </div>
            <div
              className="d num"
              style={{
                fontSize: "52px",
                lineHeight: 1,
                color: "var(--hp-red-32)",
              }}
            >
              {"5.15"}
            </div>
            <div style={{ fontSize: "17px", fontWeight: 600 }}>
              {t("AI Mentor")}
            </div>
            <div
              style={{
                fontSize: "14px",
                lineHeight: 1.45,
                color: "var(--hp-body)",
              }}
            >
              {t(
                "50 hours of continuous professional development for every teacher, every year.",
              )}
            </div>
          </div>
          <div className="nept">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--hp-muted)",
                }}
              >
                {t("Para")}
              </span>
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
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
                  <rect x="3" y="4" width="14" height="12" rx="2" />
                  <path d="M3 13l4-4 4 4 2-2 4 4" />
                </svg>
              </span>
            </div>
            <div
              className="d num"
              style={{
                fontSize: "52px",
                lineHeight: 1,
                color: "var(--hp-success)",
              }}
            >
              {"4.6"}
            </div>
            <div style={{ fontSize: "17px", fontWeight: 600 }}>
              {t("Virtual field trips")}
            </div>
            <div
              style={{
                fontSize: "14px",
                lineHeight: 1.45,
                color: "var(--hp-body)",
              }}
            >
              {t(
                "Experiential learning as standard pedagogy in every subject.",
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
