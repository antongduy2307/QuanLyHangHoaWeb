import { env, isAuthBypassEnabled } from "../config/env";
import { useAuth } from "../auth/useAuth";

export function TopBar() {
  const { user, logout } = useAuth();

  return (
    <header className="top-bar">
      <div>
        <p className="eyebrow">Moi truong quan tri</p>
        <h1>Quan ly van hanh</h1>
      </div>
      <div className="top-actions">
        <div className="top-meta" aria-label="Nguoi dung hien tai">
          {user?.display_name || "Nguoi dung"} · {user?.role || "unknown"}
        </div>
        <div className="top-meta" aria-label="Cau hinh API">
          API: {env.apiBaseUrl}
        </div>
        {isAuthBypassEnabled() ? null : (
          <button className="secondary-button" type="button" onClick={() => void logout()}>
            Dang xuat
          </button>
        )}
      </div>
    </header>
  );
}
