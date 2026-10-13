import React from 'react';

export default function StatCard({ icon, label, value, color = 'var(--hc-primary)', bg = 'var(--hc-primary-subtle)' }) {
  return (
    <div className="hc-stat-card">
      <div className="hc-stat-icon" style={{ background: bg, color }}>
        <i className={`bi ${icon}`}></i>
      </div>
      <div>
        <div className="hc-stat-value">{value}</div>
        <div className="hc-stat-label">{label}</div>
      </div>
    </div>
  );
}
