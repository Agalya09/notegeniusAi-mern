import React, { useState } from "react";
import axios from "axios";

const BASE_URL = "https://notegenius-ai-t75e.onrender.com";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e) {
  e.preventDefault();

  if (!name.trim() || !email.trim() || !password.trim()) {
    alert("Enter name, email and password");
    return;
  }

  setLoading(true);

  try {
    const res = await axios.post(`${BASE_URL}/api/auth/signup`, {
      name,
      email,
      password,
    });

    const userData = res.data.user || res.data.data || res.data;

    localStorage.setItem("user", JSON.stringify(userData));
    if (res.data.token) {
      localStorage.setItem("token", res.data.token);
    }

    window.location.href = "/";
  } catch (err) {
    alert(err.response?.data?.message || "Signup failed");
  } finally {
    setLoading(false);
  }
}

  return (
    <div className="min-h-screen bg-[#f6f3ec] flex items-center justify-center px-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 rounded-[32px] overflow-hidden shadow-xl border border-slate-200 bg-white">
        <div className="hidden lg:flex bg-slate-900 text-white p-10 flex-col justify-between">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-white text-slate-900 flex items-center justify-center text-xl font-bold mb-6">
              N
            </div>
            <h1 className="text-4xl font-bold leading-tight">Create your NoteGenius AI account</h1>
            <p className="mt-4 text-slate-300 leading-7">
              Register once and access your personal workspace, saved summaries, PDF insights, and translation history.
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            <p>• Secure account creation</p>
            <p>• Real database storage</p>
            <p>• Personalized history and document workflow</p>
          </div>
        </div>

        <div className="p-8 md:p-12">
          <div className="max-w-md mx-auto">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.25em]">Sign Up</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Create your account</h2>
            <p className="mt-2 text-slate-500">
              Register with your details to continue.
            </p>

            <form onSubmit={handleSignup} className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <input
                  type="password"
                  placeholder="Create a password"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 transition disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Sign Up"}
              </button>
            </form>

            <p className="text-sm text-slate-600 mt-6 text-center">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => (window.location.href = "/?page=login")}
                className="text-blue-600 font-medium"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}