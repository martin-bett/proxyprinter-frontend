import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import ActionButton from '../../container/inputs/ActionButton';
import {
  deleteAccount, logout, logoutEverywhere, requestLogin, useAuth, verifyCode, RequestLoginResult,
} from '../../service/auth/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUEST_ERRORS = {
  invalid: 'account.errors.invalid',
  'rate-limited': 'account.errors.rateLimited',
  disabled: 'account.errors.disabled',
  error: 'account.errors.sendFailed',
} as const satisfies Record<Exclude<RequestLoginResult, 'sent'>, string>;

interface AccountDialogProps {
  onClose: () => void;
  /** Der Login-Link war abgelaufen oder schon benutzt */
  linkFailed?: boolean;
}

export default function AccountDialog({ onClose, linkFailed = false }: AccountDialogProps) {
  const { t } = useTranslation();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(linkFailed ? t('account.errors.linkExpired') : null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (auth.email) {
    return (
      <div className="account-dialog">
        <h2>{t('account.title')}</h2>
        <p><Trans i18nKey="account.loggedInAsBold" values={{ email: auth.email }} components={{ 1: <strong /> }} /></p>
        <p className="account-help">{t('account.pdfHint')}</p>
        <div className="account-actions">
          <ActionButton icon={<LogoutIcon />} onClick={async () => { await logout(); onClose(); }}>{t('account.logOut')}</ActionButton>
          <ActionButton icon={<LogoutIcon />} onClick={async () => { await logoutEverywhere(); onClose(); }}>{t('account.logOutEverywhere')}</ActionButton>
          {confirmDelete ? (
            <>
              <p className="account-help">{t('account.deleteWarning')}</p>
              <ActionButton icon={<CloseIcon />} onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</ActionButton>
              <ActionButton icon={<DeleteForeverIcon />} className="is-danger" onClick={async () => {
                if (await deleteAccount()) onClose(); else setError(t('account.errors.deleteFailed'));
              }}>{t('account.deleteNow')}</ActionButton>
            </>
          ) : (
            <ActionButton icon={<DeleteForeverIcon />} className="is-danger" onClick={() => setConfirmDelete(true)}>{t('account.delete')}</ActionButton>
          )}
        </div>
        {error && <p className="account-error">{error}</p>}
        <p className="account-help"><a href="/privacy.html" target="_blank" rel="noreferrer">{t('account.privacyPolicy')}</a></p>
      </div>
    );
  }

  const sendLink = async () => {
    setBusy(true);
    setError(null);
    const answer = await requestLogin(email);
    setBusy(false);
    if (answer.result === 'sent') {
      setSentTo(email.trim());
      setDevCode(answer.devCode ?? null);
      setCode(answer.devCode ?? '');
    } else {
      setError(t(REQUEST_ERRORS[answer.result]));
    }
  };

  const submitCode = async () => {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const ok = await verifyCode(sentTo, code);
    setBusy(false);
    if (ok) onClose(); else setError(t('account.errors.wrongCode'));
  };

  return (
    <div className="account-dialog">
      <h2>{t('account.logIn')}</h2>
      {sentTo === null ? (
        <>
          <p className="account-help">
            {t('account.intro')}
          </p>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder={t('account.emailPlaceholder')}
            maxLength={254}
            value={email}
            aria-label={t('account.emailAriaLabel')}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && EMAIL_PATTERN.test(email.trim())) sendLink(); }}
          />
          <div className="account-actions">
            <ActionButton icon={<MailOutlineIcon />} disabled={busy || !EMAIL_PATTERN.test(email.trim())} onClick={sendLink}>
              {t('account.sendLink')}
            </ActionButton>
          </div>
          <p className="account-help">
            {t('account.storageNotice')}{' '}
            <a href="/privacy.html" target="_blank" rel="noreferrer">{t('account.privacyPolicy')}</a>
          </p>
        </>
      ) : (
        <>
          {devCode ? (
            <p>
              <Trans i18nKey="account.testEnvironment" components={{ 1: <strong /> }} />
            </p>
          ) : (
            <p><Trans i18nKey="account.sentMail" values={{ email: sentTo }} components={{ 1: <strong /> }} /></p>
          )}
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('account.codePlaceholder')}
            maxLength={6}
            value={code}
            aria-label={t('account.codeAriaLabel')}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) submitCode(); }}
          />
          <div className="account-actions">
            <ActionButton icon={<LogoutIcon />} disabled={busy || code.length !== 6} onClick={submitCode}>{t('account.logIn')}</ActionButton>
            <ActionButton icon={<CloseIcon />} onClick={() => { setSentTo(null); setError(null); }}>{t('account.useAnotherAddress')}</ActionButton>
          </div>
        </>
      )}
      {error && <p className="account-error">{error}</p>}
    </div>
  );
}
