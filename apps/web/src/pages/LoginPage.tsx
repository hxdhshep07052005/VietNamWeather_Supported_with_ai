/**
 * Phase 9 Login Page
 */

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import styles from "./AuthPages.module.css";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("return") || "/map";
  
  const { login, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate(returnUrl);
    } catch {
      // Error is handled by store
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Đăng nhập</h1>
        <p className={styles.subtitle}>
          Chào mừng bạn quay trở lại
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <div className={styles.links}>
          <Link to="/forgot-password">Quên mật khẩu?</Link>
          <span className={styles.divider}>|</span>
          <Link to="/register">Đăng ký</Link>
        </div>
      </div>
    </div>
  );
}
