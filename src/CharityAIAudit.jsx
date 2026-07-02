import { useState, useEffect, useRef } from "react";
import { Clock, ArrowRight, ArrowLeft, Sparkles, Loader2, RotateCcw, Send } from "lucide-react";

const FONT_LINK_ID = "caa-fonts";

const CATEGORIES = [
  {
    key: "volunteers",
    eyebrow: "Volunteer management",
    prompt: "When someone expresses interest in volunteering, what happens between that and them showing up to help?",
    placeholder: "e.g. Emails land in a shared inbox, we reply manually, send a form by email, then someone adds them to the rota in a spreadsheet...",
  },
  {
    key: "donors",
    eyebrow: "Donor & fundraising comms",
    prompt: "What repetitive donor communications does someone have to write or send manually?",
    placeholder: "e.g. Thank you letters after donations, Gift Aid confirmations, lapsed donor re-engagement emails, campaign updates to supporters...",
  },
  {
    key: "grants",
    eyebrow: "Grant applications & reporting",
    prompt: "How much time goes into applying for grants and reporting back to funders?",
    placeholder: "e.g. Researching funds, tailoring applications, tracking deadlines in a spreadsheet, pulling together impact data for reports...",
  },
  {
    key: "admin",
    eyebrow: "Admin & data entry",
    prompt: "What information gets typed manually into more than one place — spreadsheet, CRM, database?",
    placeholder: "e.g. Beneficiary records updated in a spreadsheet and separately in the CRM, event attendance logged by hand, expenses tracked in Excel...",
  },
  {
    key: "compliance",
    eyebrow: "Compliance & reporting",
    prompt: "What reports or returns do you produce regularly that take time to pull together by hand?",
    placeholder: "e.g. Trustee board reports, Charity Commission annual return, impact reports for funders, monthly KPI summaries...",
  },
];

const FREQ_OPTIONS = [
  { value: "daily",   label: "Daily",   perWeek: 5 },
  { value: "weekly",  label: "Weekly",  perWeek: 1 },
  { value: "monthly", label: "Monthly", perWeek: 0.23 },
];

const PAIN_LABELS = ["Mild annoyance", "Noticeable drag", "Real friction", "Significant pain", "Constant fire"];

const blankAnswer = () => ({ description: "", frequency: "", minutes: "", pain: 3 });

function hoursPerWeek(answer) {
  const freq = FREQ_OPTIONS.find((f) => f.value === answer.frequency);
  const minutes = parseFloat(answer.minutes);
  if (!freq || !minutes || minutes <= 0) return 0;
  return (minutes / 60) * freq.perWeek;
}

function isFilled(answer) {
  return answer.description.trim().length > 0 && answer.frequency && parseFloat(answer.minutes) > 0;
}

export default function CharityAIAudit() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => {
    const init = {};
    CATEGORIES.forEach((c) => (init[c.key] = blankAnswer()));
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [contact, setContact] = useState({ name: "", organisation: "", email: "" });
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState("");
  const [displayedTotal, setDisplayedTotal] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  const totalHours = CATEGORIES.reduce((sum, c) => sum + hoursPerWeek(answers[c.key]), 0);

  useEffect(() => {
    const start = displayedTotal;
    const end = totalHours;
    const duration = 400;
    const startTime = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - startTime) / duration);
      setDisplayedTotal(start + (end - start) * t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalHours]);

  const colors = {
    bg:         "#161A1D",
    surface:    "#1E2326",
    surfaceAlt: "#252B2F",
    ink:        "#ECE8DE",
    muted:      "#8B9298",
    border:     "#2D3338",
    brass:      "#C99A4A",
    clay:       "#B8654F",
    teal:       "#5C9C93",
  };

  const fontDisplay = { fontFamily: "'Fraunces', Georgia, serif" };
  const fontBody    = { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" };
  const fontMono    = { fontFamily: "'IBM Plex Mono', ui-monospace, monospace" };

  function updateAnswer(key, field, value) {
    setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function goNext() {
    if (step < CATEGORIES.length - 1) setStep(step + 1);
    else setStep(CATEGORIES.length);
  }
  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  async function generateMap() {
    setLoading(true);
    setErrorMsg("");

    const items = CATEGORIES.map((c) => {
      const a = answers[c.key];
      const hrs = hoursPerWeek(a);
      return {
        key: c.key,
        category: c.eyebrow,
        description: a.description.trim(),
        hoursPerWeek: Math.round(hrs * 10) / 10,
        pain: a.pain,
        filled: isFilled(a),
      };
    }).filter((i) => i.filled);

    if (items.length === 0) {
      setErrorMsg("Fill in at least one workflow before generating the map.");
      setLoading(false);
      return;
    }

    const localRanked = [...items].sort(
      (a, b) => b.hoursPerWeek * b.pain - a.hoursPerWeek * a.pain
    );

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: localRanked }),
      });

      const data = await response.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      if (!textBlock) throw new Error("No text in response");
      const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const merged = localRanked.map((item) => {
        const aiMatch = parsed.items?.find((p) => p.key === item.key);
        return { ...item, automationIdea: aiMatch?.automationIdea || "" };
      });

      setResult({
        items: merged,
        summary: parsed.summary || "",
        firstBuildKey: parsed.firstBuildKey || merged[0]?.key,
      });
    } catch {
      setErrorMsg("Couldn't reach the AI summary — showing the raw ranking instead.");
      setResult({ items: localRanked, summary: "", firstBuildKey: localRanked[0]?.key });
    } finally {
      setLoading(false);
      setStep(CATEGORIES.length);
    }
  }

  async function submitContact(e) {
    e.preventDefault();
    if (!contact.name || !contact.email) return;
    setContactSending(true);
    setContactError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contact,
          summary: result?.summary || "",
          items: result?.items || [],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setContactSent(true);
    } catch {
      setContactError("Something went wrong — please email us directly.");
    } finally {
      setContactSending(false);
    }
  }

  function reset() {
    const init = {};
    CATEGORIES.forEach((c) => (init[c.key] = blankAnswer()));
    setAnswers(init);
    setResult(null);
    setErrorMsg("");
    setStep(0);
  }

  const onResultsStep = step === CATEGORIES.length;
  const current = CATEGORIES[step];
  const currentAnswer = current ? answers[current.key] : null;

  return (
    <div style={{ background: colors.bg, color: colors.ink, minHeight: "100vh", ...fontBody }}>
      <div className="max-w-2xl mx-auto px-6 pt-10 pb-28">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span style={{ ...fontMono, color: colors.teal, letterSpacing: "0.08em" }} className="text-xs uppercase">
              Glade Tech
            </span>
            {!onResultsStep && (
              <span style={{ ...fontMono, color: colors.muted }} className="text-xs">
                {String(step + 1).padStart(2, "0")} / {String(CATEGORIES.length).padStart(2, "0")}
              </span>
            )}
          </div>
          <h1 style={{ ...fontDisplay, fontSize: "1.9rem", lineHeight: 1.15 }} className="font-medium">
            Charity AI Audit
          </h1>
          <p style={{ color: colors.muted }} className="text-sm mt-2 max-w-md">
            Five quick questions about where your team's time goes. We'll identify what's worth automating first.
          </p>
        </header>

        {!onResultsStep && (
          <div
            key={current.key}
            style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
            className="rounded-xl p-6"
          >
            <span style={{ ...fontMono, color: colors.teal }} className="text-xs uppercase tracking-wide">
              {current.eyebrow}
            </span>
            <h2 style={{ ...fontDisplay }} className="text-lg mt-2 mb-4 leading-snug">
              {current.prompt}
            </h2>

            <textarea
              value={currentAnswer.description}
              onChange={(e) => updateAnswer(current.key, "description", e.target.value)}
              placeholder={current.placeholder}
              rows={3}
              style={{
                background: colors.surfaceAlt,
                border: `1px solid ${colors.border}`,
                color: colors.ink,
              }}
              className="w-full rounded-lg p-3 text-sm placeholder:opacity-50 outline-none focus:ring-2 resize-none mb-4"
            />

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={{ color: colors.muted }} className="text-xs block mb-1.5">
                  How often?
                </label>
                <div className="flex gap-2">
                  {FREQ_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => updateAnswer(current.key, "frequency", f.value)}
                      style={{
                        background: currentAnswer.frequency === f.value ? colors.brass : colors.surfaceAlt,
                        color: currentAnswer.frequency === f.value ? colors.bg : colors.muted,
                        border: `1px solid ${colors.border}`,
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-md transition-colors"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ color: colors.muted }} className="text-xs block mb-1.5">
                  Minutes each time
                </label>
                <input
                  type="number"
                  min="0"
                  value={currentAnswer.minutes}
                  onChange={(e) => updateAnswer(current.key, "minutes", e.target.value)}
                  placeholder="e.g. 15"
                  style={{
                    background: colors.surfaceAlt,
                    border: `1px solid ${colors.border}`,
                    color: colors.ink,
                  }}
                  className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none focus:ring-2"
                />
              </div>
            </div>

            <div className="mb-2">
              <label style={{ color: colors.muted }} className="text-xs block mb-1.5">
                How much does it drain the team?
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={currentAnswer.pain}
                onChange={(e) => updateAnswer(current.key, "pain", Number(e.target.value))}
                className="w-full"
                style={{ accentColor: colors.clay }}
              />
              <div style={{ ...fontMono, color: colors.clay }} className="text-xs mt-1">
                {PAIN_LABELS[currentAnswer.pain - 1]}
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <button
                onClick={goBack}
                disabled={step === 0}
                style={{ color: step === 0 ? colors.border : colors.muted }}
                className="flex items-center gap-1.5 text-sm disabled:cursor-not-allowed"
              >
                <ArrowLeft size={14} /> Back
              </button>
              {step < CATEGORIES.length - 1 ? (
                <button
                  onClick={goNext}
                  style={{ background: colors.brass, color: colors.bg }}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg"
                >
                  Next <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={generateMap}
                  disabled={loading}
                  style={{ background: colors.brass, color: colors.bg }}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 size={14} className="animate-spin" /> Generating…</>
                  ) : (
                    <><Sparkles size={14} /> Generate opportunity map</>
                  )}
                </button>
              )}
            </div>
            {errorMsg && !onResultsStep && (
              <p style={{ color: colors.clay }} className="text-xs mt-3">{errorMsg}</p>
            )}
          </div>
        )}

        {onResultsStep && (
          <div>
            {!result && !loading && (
              <div
                style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
                className="rounded-xl p-6 text-center"
              >
                <p style={{ color: colors.muted }} className="text-sm mb-4">Ready when you are.</p>
                <button
                  onClick={generateMap}
                  style={{ background: colors.brass, color: colors.bg }}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg"
                >
                  <Sparkles size={14} /> Generate opportunity map
                </button>
                {errorMsg && (
                  <p style={{ color: colors.clay }} className="text-xs mt-3">{errorMsg}</p>
                )}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 justify-center py-12" style={{ color: colors.muted }}>
                <Loader2 size={18} className="animate-spin" /> Reading your answers…
              </div>
            )}

            {result && !loading && (
              <div className="space-y-4">
                {result.summary && (
                  <div
                    style={{ background: colors.surfaceAlt, border: `1px solid ${colors.border}` }}
                    className="rounded-xl p-5"
                  >
                    <span style={{ ...fontMono, color: colors.teal }} className="text-xs uppercase tracking-wide">
                      Summary
                    </span>
                    <p style={{ ...fontDisplay }} className="text-base mt-2 leading-relaxed">
                      {result.summary}
                    </p>
                  </div>
                )}

                {errorMsg && (
                  <p style={{ color: colors.clay }} className="text-xs">{errorMsg}</p>
                )}

                <div className="space-y-3">
                  {result.items.map((item) => {
                    const isFirst = item.key === result.firstBuildKey;
                    return (
                      <div
                        key={item.key}
                        style={{
                          background: colors.surface,
                          border: `1px solid ${isFirst ? colors.brass : colors.border}`,
                        }}
                        className="rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <span style={{ ...fontMono, color: colors.teal }} className="text-xs uppercase tracking-wide">
                            {item.category}
                          </span>
                          {isFirst && (
                            <span
                              style={{ background: colors.brass, color: colors.bg, ...fontMono }}
                              className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap"
                            >
                              Address first
                            </span>
                          )}
                        </div>
                        <p style={{ color: colors.ink }} className="text-sm mb-2">{item.description}</p>
                        {item.automationIdea && (
                          <p style={{ color: colors.muted }} className="text-sm mb-2 italic">
                            {item.automationIdea}
                          </p>
                        )}
                        <div style={{ ...fontMono, color: colors.brass }} className="text-xs flex gap-4">
                          <span>{item.hoursPerWeek} hrs/week</span>
                          <span>pain {item.pain}/5</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CTA */}
                <div
                  style={{ background: colors.surfaceAlt, border: `1px solid ${colors.brass}` }}
                  className="rounded-xl p-6 mt-2"
                >
                  {contactSent ? (
                    <div className="text-center py-2">
                      <p style={{ ...fontDisplay, color: colors.ink }} className="text-base mb-1">
                        Thanks — we'll be in touch shortly.
                      </p>
                      <p style={{ color: colors.muted }} className="text-xs">
                        We'll put together a practical plan based on your audit.
                      </p>
                    </div>
                  ) : (
                    <>
                      <span style={{ ...fontMono, color: colors.brass }} className="text-xs uppercase tracking-wide">
                        Want us to build this for you?
                      </span>
                      <p style={{ ...fontDisplay }} className="text-lg mt-1 mb-4 leading-snug">
                        Get a free automation roadmap for your charity.
                      </p>
                      <p style={{ color: colors.muted }} className="text-sm mb-5">
                        Leave your details and we'll put together a concrete plan — what to build, what it costs, and what it saves.
                      </p>
                      <form onSubmit={submitContact} className="space-y-3">
                        <input
                          type="text"
                          required
                          placeholder="Your name"
                          value={contact.name}
                          onChange={e => setContact(p => ({ ...p, name: e.target.value }))}
                          style={{ background: colors.surface, border: `1px solid ${colors.border}`, color: colors.ink }}
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none placeholder:opacity-40"
                        />
                        <input
                          type="text"
                          placeholder="Organisation name"
                          value={contact.organisation}
                          onChange={e => setContact(p => ({ ...p, organisation: e.target.value }))}
                          style={{ background: colors.surface, border: `1px solid ${colors.border}`, color: colors.ink }}
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none placeholder:opacity-40"
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email address"
                          value={contact.email}
                          onChange={e => setContact(p => ({ ...p, email: e.target.value }))}
                          style={{ background: colors.surface, border: `1px solid ${colors.border}`, color: colors.ink }}
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none placeholder:opacity-40"
                        />
                        {contactError && (
                          <p style={{ color: colors.clay }} className="text-xs">{contactError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={contactSending}
                          style={{ background: colors.brass, color: colors.bg }}
                          className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg disabled:opacity-60"
                        >
                          {contactSending
                            ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                            : <><Send size={14} /> Get my free roadmap</>
                          }
                        </button>
                      </form>
                    </>
                  )}
                </div>

                <button
                  onClick={reset}
                  style={{ color: colors.muted, border: `1px solid ${colors.border}` }}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg mt-2"
                >
                  <RotateCcw size={12} /> Start over
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!onResultsStep && (
        <div
          style={{ background: colors.surface, borderTop: `1px solid ${colors.border}` }}
          className="fixed bottom-0 left-0 right-0"
        >
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center gap-2">
            <Clock size={14} style={{ color: colors.brass }} />
            <span style={{ color: colors.muted }} className="text-xs">Time lost so far</span>
            <span style={{ ...fontMono, color: colors.brass }} className="text-lg ml-auto">
              {displayedTotal.toFixed(1)} hrs/week
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
