import { useState } from "react";
import axios from "axios";

const BASE_URL = "https://notegeniusai-mern-proj.onrender.com";

const points = [
  "Save your summaries and outputs",
  "Use PDF-based question answering",
  "Access voice-enabled tools",
];

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      alert("Please fill all fields");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${BASE_URL}/api/auth/signup`, {
        name,
        email,
        password,
      });

      alert("Signup successful");
      window.location.href = "/?page=login";
    } catch (err) {
      console.log(err);
      alert("Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-screen px-6 py-10 flex items-center">
      <div className="auth-bg-orb auth-bg-orb-one" />
      <div className="auth-bg-orb auth-bg-orb-two" />

      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <section className="animate-[authFade_.6s_ease]">
            <div className="inline-flex items-center gap-4 rounded-3xl border border-emerald-100 bg-white/70 px-5 py-4 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-xl font-bold shadow-lg">
                N
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Smart AI Workspace
                </p>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                  NoteGenius AI
                </h1>
              </div>
            </div>

            <h2 className="mt-8 max-w-2xl text-4xl md:text-5xl font-bold tracking-tight leading-tight text-slate-900">
              Create your account and start using your AI tools in one workspace.
            </h2>

            <p className="mt-5 max-w-2xl text-[17px] leading-8 text-slate-600">
              Organize summaries, chat with documents, improve writing, translate content,
              and use voice input from a single, simple interface.
            </p>

            <div className="mt-8 grid gap-3 max-w-xl">
              {points.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-600 shadow-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[36px] border border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.08)] overflow-hidden animate-[authFade_.7s_ease]">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-8 py-7 border-b border-slate-200/70">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-emerald-700">
                Sign Up
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Create account
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Set up your account and start building your AI-powered workflow.
              </p>
            </div>

            <div className="px-8 py-8">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Full name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    className="auth-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create your password"
                      className="auth-input pr-16"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500 hover:text-slate-800"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignup}
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-3.5 text-white font-semibold shadow-lg transition duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Creating account..." : "Create Account"}
                </button>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-sm text-slate-400">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-slate-700 font-medium shadow-sm transition hover:bg-slate-50 flex items-center justify-center gap-3"
                >
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4.5 24 4.5 12.9 4.5 4 13.4 4 24.5S12.9 44.5 24 44.5 44 35.6 44 24.5c0-1.3-.1-2.7-.4-4z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4.5 24 4.5c-7.7 0-14.3 4.3-17.7 10.2z"/>
                    <path fill="#4CAF50" d="M24 44.5c5.1 0 9.7-2 13.1-5.2l-6-5.1C29 35.7 26.6 36.7 24 36.7c-5.1 0-9.5-3.3-11-7.9l-6.6 5.1C9.7 40.2 16.4 44.5 24 44.5z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.4 5.8-6.3 7.2l6 5.1c3.5-3.2 5.6-8 5.6-13.8 0-1.3-.1-2.7-.4-4z"/>
                  </svg>
                  Continue with Google
                </button>
              </div>

              <div className="mt-7 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <span
                  className="cursor-pointer font-semibold text-emerald-600 hover:text-emerald-700"
                  onClick={() => (window.location.href = "/")}
                >
                  Sign in
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}