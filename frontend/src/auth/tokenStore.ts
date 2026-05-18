const refreshTokenKey = "qlhh.refreshToken";

let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getRefreshToken() {
  return window.sessionStorage.getItem(refreshTokenKey);
}

export function setRefreshToken(token: string | null) {
  if (token) {
    window.sessionStorage.setItem(refreshTokenKey, token);
    return;
  }
  window.sessionStorage.removeItem(refreshTokenKey);
}

export function clearStoredTokens() {
  setAccessToken(null);
  setRefreshToken(null);
}
