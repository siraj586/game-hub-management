import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';

const copy = {
  ar: {
    brand: 'GameHub Pro',
    tagline: 'نظام إدارة مركز الألعاب',
    login: 'تسجيل الدخول',
    setup: 'إعداد المحل',
    setupSubtitle: 'أول مرة؟ أنشئ حساب المالك واضبط بيانات المحل',
    loginSubtitle: 'سجّل الدخول للمتابعة أو التبديل بين الحسابات',
    shopName: 'اسم المحل',
    shopPlaceholder: 'مثال: GameZone Damascus',
    username: 'اسم المستخدم',
    email: 'البريد (اختياري)',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    loginBtn: 'دخول',
    setupBtn: 'إنشاء الحساب والمتابعة',
    authenticating: 'جاري التحقق...',
    creating: 'جاري الإنشاء...',
    invalidCreds: 'بيانات الدخول غير صحيحة',
    passwordMismatch: 'كلمتا المرور غير متطابقتين',
    passwordShort: 'كلمة المرور 6 أحرف على الأقل',
    shopRequired: 'اسم المحل مطلوب',
    userRequired: 'اسم المستخدم مطلوب',
    recentAccounts: 'حسابات سجّلت مؤخراً',
    switchHint: 'لتبديل الحساب: سجّل الخروج ثم ادخل من هنا',
    firstTimeNote: 'لا يوجد مالك بعد — ابدأ بإعداد المحل',
    lang: 'English',
  },
  en: {
    brand: 'GameHub Pro',
    tagline: 'Gaming center management system',
    login: 'Sign in',
    setup: 'Shop setup',
    setupSubtitle: 'First time? Create the owner account and shop profile',
    loginSubtitle: 'Sign in to continue or switch between accounts',
    shopName: 'Shop name',
    shopPlaceholder: 'e.g. GameZone Center',
    username: 'Username',
    email: 'Email (optional)',
    password: 'Password',
    confirmPassword: 'Confirm password',
    loginBtn: 'Sign in',
    setupBtn: 'Create account & continue',
    authenticating: 'Signing in...',
    creating: 'Creating account...',
    invalidCreds: 'Invalid credentials',
    passwordMismatch: 'Passwords do not match',
    passwordShort: 'Password must be at least 6 characters',
    shopRequired: 'Shop name is required',
    userRequired: 'Username is required',
    recentAccounts: 'Recent accounts',
    switchHint: 'To switch accounts: sign out, then sign in here',
    firstTimeNote: 'No owner account yet — start with shop setup',
    lang: 'عربي',
  },
};

const LoginPage = () => {
  const {
    login,
    bootstrapOwner,
    bootstrapStatus,
    fetchBootstrapStatus,
    language,
    toggleLanguage,
    darkMode,
    toggleDarkMode,
  } = useApp();

  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopNameTouched, setShopNameTouched] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const t = useMemo(() => copy[language] || copy.en, [language]);

  const recentUsers = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('gamehub_recent_users') || '[]');
    } catch {
      return [];
    }
  }, []);

  const effectiveMode = bootstrapStatus.needs_setup ? 'setup' : mode;
  const effectiveShopName = shopNameTouched ? shopName : (shopName || bootstrapStatus.shop_name || '');

  useEffect(() => {
    fetchBootstrapStatus();
  }, [fetchBootstrapStatus]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (!result.success) {
      setError(result.message || t.invalidCreds);
      setPassword('');
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');
    if (!effectiveShopName.trim()) {
      setError(t.shopRequired);
      return;
    }
    if (!username.trim()) {
      setError(t.userRequired);
      return;
    }
    if (password.length < 6) {
      setError(t.passwordShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    setLoading(true);
    const result = await bootstrapOwner({
      username: username.trim(),
      password,
      email: email.trim(),
      shop_name: effectiveShopName.trim(),
    });
    setLoading(false);
    if (!result.success) {
      setError(result.message);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl border-2 focus:ring-4 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition dark:bg-gray-700/80 bg-gray-50 dark:text-white text-gray-900 dark:border-gray-600 border-gray-300';

  return (
    <div className="min-h-screen flex flex-col dark:bg-gradient-to-br dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 bg-gradient-to-br from-slate-100 via-white to-indigo-50">
      {/* Top bar */}
      <div className="flex justify-end gap-2 p-4">
        <button
          type="button"
          onClick={toggleLanguage}
          className="px-3 py-2 rounded-xl text-sm font-bold dark:bg-gray-800 bg-white border dark:border-gray-600 border-gray-300 dark:text-blue-400 text-blue-600 shadow-sm"
        >
          <i className="fas fa-globe mr-1" />
          {t.lang}
        </button>
        <button
          type="button"
          onClick={toggleDarkMode}
          className="px-3 py-2 rounded-xl text-sm font-bold dark:bg-gray-800 bg-white border dark:border-gray-600 border-gray-300 dark:text-yellow-300 text-gray-600 shadow-sm"
        >
          <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-8">
        <div className="w-full max-w-lg">
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-indigo-600 shadow-lg shadow-rose-500/30 mb-4">
              <i className="fas fa-gamepad text-3xl text-white" />
            </div>
            <h1 className="text-3xl font-black dark:text-white text-gray-900 tracking-tight">
              {t.brand}
            </h1>
            <p className="text-sm dark:text-gray-400 text-gray-500 mt-1 font-medium">{t.tagline}</p>
          </div>

          <div className="rounded-3xl shadow-2xl dark:bg-gray-800/95 bg-white/95 border dark:border-gray-700 border-gray-200 overflow-hidden backdrop-blur-sm">
            {/* Tabs */}
            <div className="flex border-b dark:border-gray-700 border-gray-200">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-4 text-sm font-bold transition ${
                  effectiveMode === 'login'
                    ? 'text-indigo-500 border-b-4 border-indigo-500 bg-indigo-500/5'
                    : 'dark:text-gray-500 text-gray-400 hover:dark:text-gray-300'
                }`}
              >
                <i className="fas fa-sign-in-alt mr-2" />
                {t.login}
              </button>
              {bootstrapStatus.needs_setup && (
                <button
                  type="button"
                  onClick={() => { setMode('setup'); setError(''); }}
                  className={`flex-1 py-4 text-sm font-bold transition ${
                    effectiveMode === 'setup'
                      ? 'text-rose-500 border-b-4 border-rose-500 bg-rose-500/5'
                      : 'dark:text-gray-500 text-gray-400 hover:dark:text-gray-300'
                  }`}
                >
                  <i className="fas fa-store mr-2" />
                  {t.setup}
                </button>
              )}
            </div>

            <div className="p-8">
              {bootstrapStatus.needs_setup && effectiveMode === 'setup' && (
                <p className="text-xs text-center mb-6 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <i className="fas fa-info-circle mr-1" />
                  {t.firstTimeNote}
                </p>
              )}

              <p className="text-sm text-center dark:text-gray-400 text-gray-500 mb-6">
                {effectiveMode === 'setup' ? t.setupSubtitle : t.loginSubtitle}
              </p>

              {effectiveMode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 mb-1.5">
                      {t.username}
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      className={inputClass}
                      placeholder="owner"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 mb-1.5">
                      {t.password}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className={`${inputClass} ${error ? 'border-red-500' : ''}`}
                    />
                  </div>

                  {recentUsers.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest dark:text-gray-500 text-gray-400 mb-2">
                        {t.recentAccounts}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recentUsers.map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setUsername(u)}
                            className="text-xs px-3 py-1.5 rounded-full dark:bg-gray-700 bg-gray-100 dark:text-gray-300 text-gray-600 border dark:border-gray-600 border-gray-200 hover:border-indigo-500 transition"
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-center dark:text-gray-500 text-gray-400">
                    <i className="fas fa-exchange-alt mr-1 opacity-60" />
                    {t.switchHint}
                  </p>

                  <button
                    type="submit"
                    disabled={loading || bootstrapStatus.loading}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:shadow-lg transition disabled:opacity-60"
                  >
                    <i className={loading ? 'fas fa-spinner fa-spin' : 'fas fa-unlock-alt'} />
                    {loading ? t.authenticating : t.loginBtn}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSetup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 mb-1.5">
                      {t.shopName}
                    </label>
                    <input
                      type="text"
                      value={effectiveShopName}
                      onChange={(e) => {
                        setShopNameTouched(true);
                        setShopName(e.target.value);
                      }}
                      required
                      className={inputClass}
                      placeholder={t.shopPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 mb-1.5">
                      {t.username}
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 mb-1.5">
                      {t.email}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 mb-1.5">
                        {t.password}
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 mb-1.5">
                        {t.confirmPassword}
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:shadow-lg transition disabled:opacity-60"
                  >
                    <i className={loading ? 'fas fa-spinner fa-spin' : 'fas fa-rocket'} />
                    {loading ? t.creating : t.setupBtn}
                  </button>
                </form>
              )}

              {error && (
                <p className="mt-4 text-sm text-center text-red-500 dark:text-red-400 font-medium animate-pulse">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="py-6 text-center opacity-70">
        <p className="text-sm dark:text-gray-400 text-gray-500 font-medium">
          &copy; {new Date().getFullYear()} GameHub Pro
          <span className="mx-2 opacity-30">|</span>
          <span className="text-indigo-500 text-xs font-bold">Siraj Masoud</span>
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;
