/**
 * Phase 9 Register Page
 */

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import styles from "./AuthPages.module.css";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan");
  
  const { register, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(email, password, name || undefined);
      navigate("/map");
    } catch {
      // Error is handled by store
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Tạo tài khoản</h1>
        <p className={styles.subtitle}>
          Đăng ký miễn phí để bắt đầu
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="name" className={styles.label}>
              Tên (tùy chọn)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              autoComplete="name"
            />
          </div>

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
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>

        <div className={styles.links}>
          <span>Đã có tài khoản?</span>
          <Link to="/login">Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
