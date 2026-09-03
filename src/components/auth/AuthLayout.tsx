"use client";

import type { ReactNode } from "react";
import { Building2, Users, Wallet } from "lucide-react";
import "./auth-screen.css";

type AuthLayoutProps = {
  kicker?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthLayout({ kicker = "Woontegra", title, description, children }: AuthLayoutProps) {
  return (
    <div className="auth-screen">
      <div className="auth-grid">
        <AuthBrandPanel />
        <section className="auth-form-col">
          <div className="auth-card">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">{kicker}</p>
            <h1 className="mt-2 text-[1.65rem] font-semibold leading-snug text-ink">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
            <div className="mt-6">{children}</div>
            <p className="mt-8 text-center text-[12px] text-muted">
              Woontegra Teknoloji tarafından geliştirilmiştir.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function AuthBrandPanel() {
  return (
    <aside className="auth-brand flex flex-col justify-between">
      <span className="auth-orb auth-orb-a auth-motion" aria-hidden />
      <span className="auth-orb auth-orb-b auth-motion" aria-hidden />
      <span className="auth-grid-texture" aria-hidden />
      <Skyline />

      <div className="auth-copy max-w-[34rem]">
        <p className="auth-kicker">
          <span>Woontegra</span>
          Site Yönetimi
        </p>
        <h2 className="auth-headline">
          Site yönetiminin
          <br />
          <em>yeni standardı.</em>
        </h2>
        <p className="auth-lead">
          Aidat, tahsilat, giderler ve site sakinleri.
          <br />
          Tüm süreçler tek, sakin bir panelde.
        </p>
      </div>

      <div className="auth-chips" aria-hidden>
        <article className="auth-chip auth-chip-a auth-motion">
          <span className="auth-chip-icon">
            <Building2 className="size-4" />
          </span>
          <span className="auth-chip-text">
            <strong>Aidat</strong>
            Dönemsel takip
          </span>
        </article>
        <article className="auth-chip auth-chip-b auth-motion">
          <span className="auth-chip-icon">
            <Wallet className="size-4" />
          </span>
          <span className="auth-chip-text">
            <strong>Tahsilat</strong>
            Güncel durum
          </span>
        </article>
        <article className="auth-chip auth-chip-c auth-motion">
          <span className="auth-chip-icon">
            <Users className="size-4" />
          </span>
          <span className="auth-chip-text">
            <strong>Sakinler</strong>
            Daire kayıtları
          </span>
        </article>
      </div>
    </aside>
  );
}

function Skyline() {
  return (
    <svg className="auth-skyline" viewBox="0 0 800 420" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="auth-build" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e3d44" />
          <stop offset="100%" stopColor="#071c24" />
        </linearGradient>
      </defs>
      <rect x="40" y="160" width="90" height="260" rx="4" fill="url(#auth-build)" />
      <rect x="150" y="90" width="120" height="330" rx="4" fill="url(#auth-build)" />
      <rect x="290" y="140" width="80" height="280" rx="4" fill="url(#auth-build)" />
      <rect x="390" y="50" width="150" height="370" rx="5" fill="url(#auth-build)" />
      <rect x="560" y="120" width="110" height="300" rx="4" fill="url(#auth-build)" />
      <rect x="690" y="170" width="90" height="250" rx="4" fill="url(#auth-build)" />
      <g className="auth-motion">
        {windows(58, 178, 4, 8, 0.1)}
        {windows(168, 108, 5, 10, 0.35)}
        {windows(308, 158, 3, 8, 0.2)}
        {windows(412, 68, 6, 12, 0.45)}
        {windows(578, 138, 4, 9, 0.15)}
        {windows(708, 188, 3, 7, 0.55)}
      </g>
      <rect x="0" y="400" width="800" height="20" fill="#04161c" />
    </svg>
  );
}

function windows(x: number, y: number, cols: number, rows: number, delay: number) {
  const nodes = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      nodes.push(
        <rect
          key={`${x}-${row}-${col}`}
          className="auth-window"
          x={x + col * 18}
          y={y + row * 22}
          width="8"
          height="12"
          rx="1"
          style={{ animationDelay: `${delay + row * 0.12 + col * 0.08}s` }}
        />,
      );
    }
  }
  return nodes;
}
