import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall, getPrimaryRole } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './operations-redesign.css';

const roleLabel = (value) => String(value || '').replace(/^ROLE_/, '').replaceAll('_', ' ');

export default function ProfilePage() {
  const { user: cachedUser } = useAuth();
  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiCall('/api/auth/me', { silentError: true })
      .then((result) => {
        if (!active) return;
        if (result?.success && result.data) setUser(result.data);
        else setError('Unable to refresh profile details.');
      })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load profile.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const role = getPrimaryRole(user);
  const portalHref = role === 'ROLE_CUSTOMER'
    ? '/guest'
    : ['ROLE_ADMIN', 'ROLE_MANAGER'].includes(role) ? '/admin/overview' : '/staff';
  const initials = (user?.fullName || user?.username || 'U').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const fields = [
    ['Username', user?.username],
    ['Email', user?.email],
    ['Phone', user?.phone],
    ['Role', roleLabel(role)],
    ['Account status', user?.status],
    ['Member since', user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'],
  ];

  return (
    <main className="ops-page profile-page">
      <div className="profile-topline">
        <div><span className="ops-kicker">ACCOUNT</span><h1>My profile</h1><p>Your account information and current access.</p></div>
        <Link className="ops-button ops-button-quiet" to={portalHref}><i className="bi bi-arrow-left" /> Back to portal</Link>
      </div>
      {error && <div className="ops-inline-error" role="alert">{error}</div>}
      {loading ? <div className="ops-loading"><span className="ops-spinner" />Loading profile…</div> : (
        <section className="profile-card">
          <div className="profile-hero">
            <div className="profile-avatar">{initials}</div>
            <div><span className="ops-kicker">SIGNED IN AS {roleLabel(role)}</span><h2>{user?.fullName || user?.username}</h2><p>{user?.email || 'No email address on file'}</p></div>
          </div>
          <div className="profile-fields">{fields.map(([label, value]) => <div className="profile-field" key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}</div>
          <p className="profile-note"><i className="bi bi-info-circle" /> To change account details, contact a system administrator.</p>
        </section>
      )}
    </main>
  );
}
