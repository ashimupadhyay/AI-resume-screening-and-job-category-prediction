import { useState } from "react";
import { HomeSection } from "./landing.jsx";
const API_URL = "http://127.0.0.1:8000";

function App() {
  const [page, setPage] = useState("login"); // "login" | "signup" | "landing"
  const [user, setUser] = useState(null);

  // Login states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const clearMessages = () => {
    setMessage("");
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    clearMessages();

    if (!loginEmail || !loginPassword) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Login failed.");
        return;
      }

      // Save JWT token
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // CHANGED: go to the resume page after a successful login
      setUser(data.user);
      setLoginPassword("");
      setPage("landing");
    } catch (err) {
      setError("Cannot connect to server. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    clearMessages();

    if (
      !firstName ||
      !lastName ||
      !dob ||
      !signupEmail ||
      !signupPassword ||
      !confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (signupPassword.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          dob: dob,
          email: signupEmail,
          password: signupPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Signup failed.");
        return;
      }

      setMessage("Account created successfully! You can now login.");

      // Clear signup form
      setFirstName("");
      setLastName("");
      setDob("");
      setSignupEmail("");
      setSignupPassword("");
      setConfirmPassword("");

      // Switch to login
      setTimeout(() => {
        setPage("login");
        clearMessages();
      }, 1500);
    } catch (err) {
      setError("Cannot connect to server. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  // NEW: log out and return to the login screen
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setUser(null);
    clearMessages();
    setPage("login");
  };

  // NEW: after login, show the resume page with a small log out bar on top
  if (page === "landing") {
    return (
      <>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 24px",
            borderBottom: "1px solid #e2e8f0",
            background: "#fff",
            fontSize: "14px",
          }}
        >
          <span>Signed in as {user?.first_name || "user"}</span>
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 14px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
        <HomeSection />
      </>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Left Side */}
        <div className="auth-left">
          <div className="brand">
            <div className="brand-icon">A</div>
            <span>AuthSpace</span>
          </div>

          <div className="left-content">
            <h1>{page === "login" ? "Welcome back!" : "Create your account"}</h1>

            <p>
              {page === "login"
                ? "Login to continue to your account and access your dashboard."
                : "Join us today and create your account in just a few steps."}
            </p>

            <div className="feature-list">
              <div className="feature">
                <span>✓</span>
                <p>Simple and secure authentication</p>
              </div>

              <div className="feature">
                <span>✓</span>
                <p>Your data is safely protected</p>
              </div>

              <div className="feature">
                <span>✓</span>
                <p>Fast and easy account access</p>
              </div>
            </div>
          </div>

          <div className="left-footer">© 2026 AuthSpace</div>
        </div>

        {/* Right Side */}
        <div className="auth-right">
          <div className="form-container">
            {/* Tabs */}
            <div className="tabs">
              <button
                className={page === "login" ? "tab active" : "tab"}
                onClick={() => {
                  setPage("login");
                  clearMessages();
                }}
              >
                Login
              </button>

              <button
                className={page === "signup" ? "tab active" : "tab"}
                onClick={() => {
                  setPage("signup");
                  clearMessages();
                }}
              >
                Sign Up
              </button>
            </div>

            {/* Messages */}
            {error && <div className="message error">{error}</div>}

            {message && <div className="message success">{message}</div>}

            {/* LOGIN */}
            {page === "login" && (
              <form onSubmit={handleLogin}>
                <div className="form-heading">
                  <h2>Login to your account</h2>
                  <p>Enter your details below to continue.</p>
                </div>

                <div className="input-group">
                  <label>Email Address</label>

                  <div className="input-wrapper">
                    <span>✉</span>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Password</label>

                  <div className="input-wrapper">
                    <span>🔒</span>
                    <input
                      type="password"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-options">
                  <label className="remember">
                    <input type="checkbox" />
                    Remember me
                  </label>

                  <button type="button" className="forgot">
                    Forgot password?
                  </button>
                </div>

                <button className="submit-btn" type="submit" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </button>

                <p className="switch-text">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setPage("signup");
                      clearMessages();
                    }}
                  >
                    Create account
                  </button>
                </p>
              </form>
            )}

            {/* SIGNUP */}
            {page === "signup" && (
              <form onSubmit={handleSignup}>
                <div className="form-heading">
                  <h2>Create your account</h2>
                  <p>Fill in your information to get started.</p>
                </div>

                <div className="two-column">
                  <div className="input-group">
                    <label>First Name</label>

                    <input
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Last Name</label>

                    <input
                      type="text"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Date of Birth</label>

                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label>Email Address</label>

                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>

                <div className="two-column">
                  <div className="input-group">
                    <label>Password</label>

                    <input
                      type="password"
                      placeholder="Password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Confirm Password</label>

                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <label className="terms">
                  <input type="checkbox" required />
                  <span>I agree to the terms and conditions</span>
                </label>

                <button className="submit-btn" type="submit" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </button>

                <p className="switch-text">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setPage("login");
                      clearMessages();
                    }}
                  >
                    Login
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;