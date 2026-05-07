import { createContext, useContext, useEffect, useReducer } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

const initialState = {
  user: JSON.parse(localStorage.getItem('adhikarloop_user') || 'null'),
  token: localStorage.getItem('adhikarloop_token'),
  loading: true
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH':
      return { ...state, user: action.user, token: action.token, loading: false };
    case 'SET_USER':
      return { ...state, user: action.user, loading: false };
    case 'LOGOUT':
      return { user: null, token: null, loading: false };
    case 'READY':
      return { ...state, loading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    async function loadMe() {
      if (!state.token) {
        dispatch({ type: 'READY' });
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        localStorage.setItem('adhikarloop_user', JSON.stringify(data.user));
        dispatch({ type: 'SET_USER', user: data.user });
      } catch (_error) {
        localStorage.removeItem('adhikarloop_token');
        localStorage.removeItem('adhikarloop_user');
        dispatch({ type: 'LOGOUT' });
      }
    }

    loadMe();
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('adhikarloop_token', data.token);
    localStorage.setItem('adhikarloop_user', JSON.stringify(data.user));
    dispatch({ type: 'SET_AUTH', user: data.user, token: data.token });
    return data.user;
  }

  function logout() {
    localStorage.removeItem('adhikarloop_token');
    localStorage.removeItem('adhikarloop_user');
    dispatch({ type: 'LOGOUT' });
  }

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

