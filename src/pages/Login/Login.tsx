import { useLabels } from '../../store/languageStore';
import { useSiteStore } from '../../store/siteStore';
import { asRecord, normalizeError } from '../../types/api';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowRight,
  FiGitBranch,
  FiZap,
  FiCheck,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { SITE } from '../../config/site';
import apiClient from '../../services/api';
import './Login.css';

export default function Login() {
  const t = useLabels();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const registrationOpen = useSiteStore(state => state.config?.registerEnabled !== false);
  const [wantsRegister, setIsRegister] = useState(false);
  const isRegister = registrationOpen && wantsRegister;
  const [loading, setLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    mobile: '',
    password: '',
    nickname: '',
    code: '',
  });
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [event.target.name]: event.target.value });
    setError('');
  };

  const loadCaptcha = async () => {
    if (!/^1\d{10}$/.test(form.mobile)) {
      setError(t("请先输入正确的手机号", "Enter a valid phone number first"));
      return;
    }
    setCaptchaLoading(true);
    setError('');
    try {
      const response = await apiClient.post<unknown>('/api/aiWorkflow/account/getCode', {
        mobile: form.mobile,
      });
      const data = asRecord(response.data);
      if (data.code !== 200) throw new Error(typeof data.msg === 'string' ? data.msg : t("获取验证码失败", "Could not load the verification code"));
      const image =
        (typeof data.image === 'string' ? data.image : '') ||
        (typeof data.data === 'string'
          ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.data)}`
          : '');
      if (!image) throw new Error(t("未收到验证码图片，请重试", "Verification image missing. Try again."));
      setCaptcha(image);
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      setError(err.message || t("获取验证码失败", "Could not load the verification code"));
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await apiClient.post<unknown>(
        isRegister ? '/api/aiWorkflow/account/register' : '/api/aiWorkflow/account/login',
        {
          mobile: form.mobile,
          password: form.password,
          ...(isRegister
            ? { nickname: form.nickname, code: form.code.trim().toLowerCase() }
            : {}),
        }
      );
      const data = asRecord(response.data);
      if (data.code !== 200) throw new Error(typeof data.msg === 'string' ? data.msg : t("提交失败", "Could not submit"));
      if (isRegister) {
        setIsRegister(false);
        setCaptcha('');
        setMessage(t("注册成功，使用刚才的账号登录即可。", "Account created. Sign in with your new credentials."));
      } else {
        if (typeof data.token !== 'string' || !data.token) throw new Error(t("登录响应缺少凭据，请重试", "The response did not include a token. Try again."));
        login(data.data, data.token);
        const destination = location.state?.from;
        const returnPath = typeof destination === 'string' && destination.startsWith('/') && !destination.startsWith('//')
          ? destination : '/';
        navigate(returnPath, { state: location.state?.returnState });
      }
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      setError(
        err.response?.data?.msg || err.message || t("连接失败，请稍后重试", "Connection failed. Try again later.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story">
        <span className="login-story-label">
          <FiGitBranch /> {SITE.name} / {SITE.englishName.toUpperCase()}
        </span>
        <div>
          <span className="eyebrow">MAKE ROOM FOR YOUR NEXT IDEA</span>
          <h1>
            {t("连接灵感。", "Connect ideas.")}
            <br />
            {t("让创作", "Create")}<em>{t("自然发生。", "with AI.")}</em>
          </h1>
          <p>
            {t("从一个提示词开始，编排属于你的 AI 工作流。", "Start with a prompt and design your own AI workflow.")}
            <br />
            {t("文字、画面、短片，在同一张画布上发生。", "Create text, images and video on one canvas.")}
          </p>
          <div className="login-story-features">
            {[
              t("Flash 文本、图片与视频模型", "Flash text, image and video models"),
              t("可视化节点编排与变量引用", "Visual editor with variable references"),
              t("逐节点结果与执行记录", "Node results and run history"),
            ].map((text) => (
              <span key={text}>
                <FiCheck /> {text}
              </span>
            ))}
          </div>
        </div>
        <span className="login-story-footer">
          <FiZap /> BUILT FOR THE WAY YOU CREATE
        </span>
      </section>
      <section className="login-form-area">
        <div className="login-form-card">
          <span className="eyebrow">YOUR WORKSPACE AWAITS</span>
          <h2>{isRegister ? t("创建你的创作空间", "Create your workspace") : t("欢迎回来", "Welcome back")}</h2>
          <p className="login-form-subtitle">
            {isRegister
              ? t("使用博客账号体系，开启 AI 工作流创作。", "Create an account to start building AI workflows.")
              : t("登录博客账号，继续你的工作流创作。", "Sign in to continue building your workflows.")}
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="login-field">
                <label htmlFor="nickname">{t("昵称", "Display name")}</label>
                <input
                  id="nickname"
                  name="nickname"
                  autoComplete="nickname"
                  value={form.nickname}
                  onChange={handleChange}
                  placeholder={t("怎么称呼你", "Your display name")}
                  required
                  maxLength={40}
                />
              </div>
            )}
            <div className="login-field">
              <label htmlFor="mobile">{t("手机号", "Phone number")}</label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                autoComplete="username"
                pattern="1[0-9]{10}"
                maxLength={11}
                value={form.mobile}
                onChange={(event) => {
                  handleChange(event);
                  setCaptcha('');
                }}
                placeholder={t("请输入手机号", "Enter your phone number")}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="password">{t("密码", "Password")}</label>
              <div className="login-password">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    isRegister ? 'new-password' : 'current-password'
                  }
                  value={form.password}
                  onChange={handleChange}
                  placeholder={t("请输入密码", "Enter your password")}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? t("隐藏密码", "Hide password") : t("显示密码", "Show password")}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
            {isRegister && (
              <div className="login-field">
                <label htmlFor="code">{t("图形验证码", "Verification code")}</label>
                <div className="login-captcha">
                  <input
                    id="code"
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    placeholder={t("输入图中字符", "Enter the characters in the image")}
                    required
                    maxLength={6}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    disabled={captchaLoading}
                    aria-label={t("获取或刷新图形验证码", "Get or refresh verification image")}
                  >
                    {captcha ? (
                      <img src={captcha} alt={t("图形验证码，点击刷新", "Verification image, click to refresh")} />
                    ) : captchaLoading ? (
                      t("获取中", "Loading")
                    ) : (
                      t("获取验证码", "Get code")
                    )}
                  </button>
                </div>
              </div>
            )}
            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading}
            >
              {loading ? t("正在提交…", "Submitting…") : isRegister ? t("创建账号", "Create account") : t("登录工作台", "Sign in")}
              <FiArrowRight />
            </button>
          </form>
          <div className="login-switch">
            <span>{!registrationOpen ? t("本站暂未开放注册", "Registration is closed") : isRegister ? t("已经有账号了", "Already have an account?") : t("还没有账号", "New here?")}</span>
            <button hidden={!registrationOpen}
              disabled={loading || !registrationOpen}
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
                setMessage('');
                setCaptcha('');
              }}
            >
              {isRegister ? t("去登录", "Sign in") : t("立即注册", "Register")}
            </button>
          </div>
          <div className="login-guest">
            <span>{t("或者先看看", "Or explore first")}</span>
            <button
              className="btn btn-default"
              onClick={() => navigate('/workflows')}
            >
              {t("进入访客空间", "Continue as a guest")} <FiArrowRight />
            </button>
            <p>{t("访客可编排并保存本地草稿", "Guests can build and save drafts in this browser.")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
