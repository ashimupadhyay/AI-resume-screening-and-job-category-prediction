import { useState } from "react";
import { Search, Menu, X, Sparkles, Upload, Zap, Wrench, AlertCircle, FileText, Briefcase, Send, Percent } from "lucide-react";

// FastAPI endpoint: expects one form field called "resume"
const API_URL = "http://127.0.0.1:8000/screen";
const MAX_FILE_MB = 5;

export default function App() {
  const [active, setActive] = useState("Home");
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = ["Home", "About", "Searching"];

  return (
    <div className="min-h-screen bg-white">
      {/* ---------- NAVBAR ---------- */}
      <nav className="w-full bg-white border-b border-blue-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">
              Resume<span className="text-blue-600">AI</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link}
                onClick={() => setActive(link)}
                className={`text-sm font-medium transition-colors ${
                  active === link ? "text-blue-600" : "text-slate-600 hover:text-blue-600"
                }`}
              >
                {link}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button className="p-2 text-slate-500 hover:text-blue-600 transition-colors">
              <Search size={18} />
            </button>
            <button
              title="Settings"
              className="p-2 text-slate-500 hover:text-blue-600 transition-colors"
            >
              <Wrench size={18} />
            </button>
            <button className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Log In
            </button>
            <button className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              Sign Up
            </button>
          </div>

          <button className="md:hidden text-slate-700" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden flex flex-col gap-2 px-6 pb-4">
            {navLinks.map((link) => (
              <button
                key={link}
                onClick={() => {
                  setActive(link);
                  setMobileOpen(false);
                }}
                className={`text-left text-sm font-medium py-2 ${
                  active === link ? "text-blue-600" : "text-slate-600"
                }`}
              >
                {link}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* ---------- BODY CONTENT (swaps by active tab) ---------- */}
      {active === "Home" && <HomeSection />}
      {active === "About" && <AboutSection />}
      {active === "Searching" && <SearchingSection />}
    </div>
  );
}

/* ---------- helpers ---------- */

// Turns the model score (0-100) into a plain label for the user
function strengthLabel(conf) {
  if (conf >= 60) return "Strong match";
  if (conf >= 35) return "Likely match";
  return "Low confidence";
}

// Builds the report text from the real prediction (no made-up content)
function buildDescription(category, conf, top) {
  const others = top
    .slice(1, 3)
    .map((t) => `${t.title} (${t.match}%)`)
    .join(" and ");
  let text = `${strengthLabel(conf)}: this resume fits ${category} best, with a score of ${conf}%.`;
  if (others) text += ` Other close fields: ${others}.`;
  if (conf < 35) {
    text += " The score is low, so the resume may not fit these fields well, or it may be too short or unusual for the model to judge.";
  }
  return text;
}

/* ---------- HOME ---------- */
export function HomeSection() {
  const [fileName, setFileName] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Sends the resume file to the FastAPI backend and stores the live prediction
  const predictResume = async (file) => {
    setFileName(file.name);
    setResult(null);
    setError(null);

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_FILE_MB}MB. Upload a smaller resume.`);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("resume", file); // field name must match the backend

      const res = await fetch(API_URL, { method: "POST", body: formData });

      if (!res.ok) {
        let detail = `Server responded with ${res.status}`;
        try {
          const body = await res.json();
          if (body?.detail) detail = body.detail;
        } catch (_) {
          /* response was not JSON */
        }
        throw new Error(detail);
      }

      const data = await res.json();

      // Backend returns scores between 0 and 1. The UI shows percentages.
      const top = (data.top_predictions || []).map((p) => ({
        title: p.job_field,
        match: Math.round(p.confidence * 1000) / 10,
      }));
      const conf = Math.round(data.confidence * 1000) / 10;

      setResult({
        category: data.predicted_job_field,
        confidence: conf,
        top,
        description: buildDescription(data.predicted_job_field, conf, top),
      });
    } catch (err) {
      const unreachable = err instanceof TypeError; // fetch fails this way when the server is off
      setError(
        unreachable
          ? `Could not reach the server at ${API_URL}. Check that FastAPI is running (uvicorn main:app --reload).`
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) predictResume(file);
    e.target.value = ""; // lets the same file be uploaded again
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) predictResume(e.dataTransfer.files[0]);
  };

  return (
    <section className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto text-center px-6 pt-24 pb-20">
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight">
          Predict your resume's{" "}
          <span className="bg-yellow-100 px-2 rounded">best-fit job category</span>
        </h1>
        <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
          Upload a resume and let the classifier tell you which job category it matches —
          powered by TF-IDF and a scikit-learn classifier, served through a FastAPI backend.
        </p>

        {/* Upload control */}
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="mt-10 mx-auto max-w-lg flex flex-col items-center gap-3 px-8 py-12 border-2 border-dashed border-blue-200 rounded-2xl bg-white hover:border-blue-400 cursor-pointer transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Upload size={22} />
          </div>
          <span className="font-semibold text-slate-800">
            {fileName ? fileName : "Drag & drop your resume, or click to upload"}
          </span>
          <span className="text-xs text-slate-400">PDF, DOCX or TXT, up to {MAX_FILE_MB}MB</span>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        {/* Action tabs — Match Report / Job Match / Apply */}
        <ActionTabsSection result={result} />

        {/* Report — the live, backend-driven output */}
        {(loading || result || error) && (
          <div className="mt-10 max-w-lg mx-auto text-left rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Zap size={16} />
              </div>
              <h3 className="font-semibold text-slate-900">Report</h3>
            </div>

            <div className="px-6 py-5 max-h-72 overflow-y-auto report-scroll">
              {loading && <p className="text-sm text-slate-500">Analyzing resume…</p>}

              {!loading && error && (
                <div className="flex items-start gap-2 text-sm text-red-600">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && result && (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                      Job Match
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {result.confidence}% match · {strengthLabel(result.confidence)}
                    </span>
                  </div>
                  <div className="mt-3 text-xl font-bold text-slate-900">{result.category}</div>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    {result.description}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Visible custom scrollbar for the report content area */}
        <style>{`
          .report-scroll::-webkit-scrollbar {
            width: 8px;
          }
          .report-scroll::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 8px;
          }
          .report-scroll::-webkit-scrollbar-thumb {
            background: #93c5fd;
            border-radius: 8px;
          }
          .report-scroll::-webkit-scrollbar-thumb:hover {
            background: #60a5fa;
          }
          .report-scroll {
            scrollbar-width: thin;
            scrollbar-color: #93c5fd #f1f5f9;
          }
        `}</style>
      </div>
    </section>
  );
}

/* ---------- ACTION TABS (Match Report / Job Match / Apply) ---------- */
function ActionTabsSection({ result }) {
  const [tab, setTab] = useState("Match Report");

  const tabs = [
    { key: "Match Report", icon: FileText },
    { key: "Job Match", icon: Briefcase },
    { key: "Apply", icon: Send, label: "Job available to apply" },
  ];

  // Sample listings for the Apply tab. Replace with a real jobs source later.
  const sampleJobs = [
    { title: "Data Scientist", company: "Netflix" },
    { title: "ML Engineer", company: "Fewa Digital" },
    { title: "Data Analyst", company: "Cotiviti" },
  ];

  return (
    <div className="mt-10 mx-auto max-w-lg">
      {/* Pill tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              tab === key
                ? "border-blue-300 bg-blue-50 text-blue-600"
                : "border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600"
            }`}
          >
            <Icon size={15} />
            {label || key}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="mt-5 rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden text-left">
        {tab === "Match Report" && (
          <div className="px-6 py-5">
            <span className="text-xs text-slate-400">Resume scan results</span>
            <div className="flex items-center gap-2 mt-1">
              <h4 className="font-bold text-slate-900">
                {result?.category ? `Best match: ${result.category}` : "No resume scanned yet"}
              </h4>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Percent size={16} />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900">
                  {result?.confidence != null ? `${result.confidence}%` : "—"}
                </div>
                <div className="text-xs text-slate-400 uppercase tracking-wide">Match score</div>
              </div>
            </div>
          </div>
        )}

        {tab === "Job Match" && (
          <div className="px-6 py-5">
            <span className="text-xs text-slate-400">Closest job categories</span>
            {result?.top?.length ? (
              <div className="mt-3 flex flex-col gap-2">
                {result.top.map((job) => (
                  <div
                    key={job.title}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50/60"
                  >
                    <span className="text-sm font-semibold text-slate-800">{job.title}</span>
                    <span className="text-xs font-semibold text-blue-600">{job.match}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Upload a resume to see its closest job categories.</p>
            )}
          </div>
        )}

        {tab === "Apply" && (
          <div className="px-6 py-5">
            <span className="text-xs text-slate-400">Sample listings (demo data)</span>
            <div className="mt-3 flex flex-col gap-3">
              {sampleJobs.map((job) => (
                <div key={job.title} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{job.title}</div>
                    <div className="text-xs text-slate-400">{job.company}</div>
                  </div>
                  <button className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- ABOUT ---------- */
function AboutSection() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-20">
      <h2 className="text-4xl font-bold text-slate-900">About the project</h2>
      <p className="mt-4 text-slate-600 leading-relaxed">
        This system screens resumes and predicts the most relevant job category using a
        machine learning pipeline built with scikit-learn. Text is cleaned, vectorized with
        TF-IDF, and classified into one of 25 job fields. The model returns a score for
        each field, and the app shows the best match and the closest alternatives.
      </p>
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard label="Model" value="TF-IDF + Classifier" />
        <StatCard label="Backend" value="FastAPI" />
        <StatCard label="Frontend" value="React" />
      </div>
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="p-5 rounded-xl bg-blue-50 text-center">
      <div className="text-lg font-bold text-blue-700">{value}</div>
      <div className="text-xs text-slate-500 mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
}

/* ---------- SEARCHING ---------- */
function SearchingSection() {
  const [query, setQuery] = useState("");

  return (
    <section className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h2 className="text-4xl font-bold text-slate-900">Search job categories</h2>
      <p className="mt-3 text-slate-600">Type a role to see how the model would classify it.</p>

      <div className="mt-8 flex items-center gap-2 max-w-md mx-auto">
        <div className="flex-1 flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-lg focus-within:border-blue-500 transition-colors">
          <Search size={18} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Data Analyst"
            className="w-full outline-none text-sm text-slate-700"
          />
        </div>
        <button className="px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Upload size={16} /> Go
        </button>
      </div>

      {query && (
        <p className="mt-6 text-sm text-slate-500">
          Showing mock results for <span className="font-semibold text-blue-600">"{query}"</span>
        </p>
      )}
    </section>
  );
}