import { HuaqingLoginForm, type LoginCredentials } from "./HuaqingLoginForm";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Icon } from "../Icon";
import "./hq-auth.css";
import "./browser-session.css";

type Session = { enabled: boolean; authenticated: boolean };
const SessionContext = createContext<{
  enabled: boolean;
  logout: () => Promise<void>;
  busy: boolean;
  error: string;
}>({ enabled: false, logout: async () => {}, busy: false, error: "" });

async function request(path: string, body?: unknown) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "请求失败，请重试");
  return result;
}

export function BrowserLogoutButton() {
  const { enabled, logout, busy, error } = useContext(SessionContext);
  if (!enabled) return null;
  return (
    <div className="hq-browser-logout">
      <button
        className="entry-nav-rail__btn"
        type="button"
        aria-label="退出登录"
        title="退出登录"
        disabled={busy}
        onClick={() => void logout()}
      >
        <span className="entry-nav-rail__btn-icon" aria-hidden>
          <Icon name="log-out" size={16} />
        </span>
        <span className="entry-nav-rail__btn-label">{busy ? "正在退出…" : "退出登录"}</span>
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function BrowserSessionBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState(0);
  useEffect(() => {
    let active = true;
    request("session")
      .then((value) => {
        if (active) {
          setSession(value);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("无法连接服务，请重试");
      });
    return () => {
      active = false;
    };
  }, [check]);
  // Recheck when returning to a tab after expiry or logout in another tab.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible") setCheck((value) => value + 1);
    };
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, []);
  const logout = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request("logout", {});
      // Destroy application state and its in-memory caches on logout.
      window.location.replace("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "退出失败，请重试");
      setBusy(false);
    }
  };
  async function login({ username, password }: LoginCredentials) {
    await request("login", { username, password });
    setSession({ enabled: true, authenticated: true });
  }
  if (session?.authenticated)
    return (
      <SessionContext.Provider value={{ enabled: session.enabled, logout, busy, error }}>
        {children}
      </SessionContext.Provider>
    );
  return (
    <main className="hq-auth">
      <div className="hq-auth-layout">
        <header className="hq-auth-heading">
          <img src="/hqzyai-logomark.svg" alt="" width="26" height="22" />
          <span>华清智言 · Huaqing Design</span>
        </header>
        <section className="hq-auth-card" aria-labelledby="hq-auth-title">
          <h1 id="hq-auth-title">登录</h1>
          {!session ? (
            <div aria-live="polite">
              {error || "正在确认登录状态…"}
              {error && (
                <button
                  type="button"
                  className="hq-auth-submit"
                  onClick={() => setCheck((value) => value + 1)}
                >
                  重试
                </button>
              )}
            </div>
          ) : (
            <HuaqingLoginForm
              onLogin={login}
              eye={<Icon name="eye" size={18} />}
              eyeOff={<Icon name="eye-off" size={18} />}
            />
          )}
        </section>
      </div>
    </main>
  );
}
