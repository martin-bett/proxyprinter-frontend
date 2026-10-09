import React, { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import ActionButton from '../../container/inputs/ActionButton';
import {
  deleteAccount, logout, logoutEverywhere, requestLogin, useAuth, verifyCode, RequestLoginResult,
} from '../../service/auth/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUEST_ERRORS: Record<Exclude<RequestLoginResult, 'sent'>, string> = {
  invalid: 'Please enter a valid email address.',
  'rate-limited': 'Too many login mails for this address, please try again later.',
  disabled: 'Login is not set up on this server.',
  error: 'The login mail could not be sent, please try again.',
};

interface AccountDialogProps {
  onClose: () => void;
  /** Der Login-Link war abgelaufen oder schon benutzt */
  linkFailed?: boolean;
}

export default function AccountDialog({ onClose, linkFailed = false }: AccountDialogProps) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(linkFailed ? 'This login link has expired or was already used. Request a new one.' : null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (auth.email) {
    return (
      <div className="account-dialog">
        <h2>Account</h2>
        <p>Logged in as <strong>{auth.email}</strong>.</p>
        <p className="account-help">You can have the finished PDF sent to this address.</p>
        <div className="account-actions">
          <ActionButton icon={<LogoutIcon />} onClick={async () => { await logout(); onClose(); }}>Log out</ActionButton>
          <ActionButton icon={<LogoutIcon />} onClick={async () => { await logoutEverywhere(); onClose(); }}>Log out everywhere</ActionButton>
          {confirmDelete ? (
            <>
              <p className="account-help">This deletes your account. Your decks and snapshots in this browser are not affected.</p>
              <ActionButton icon={<CloseIcon />} onClick={() => setConfirmDelete(false)}>Cancel</ActionButton>
              <ActionButton icon={<DeleteForeverIcon />} className="is-danger" onClick={async () => {
                if (await deleteAccount()) onClose(); else setError('The account could not be deleted, please try again.');
              }}>Delete account now</ActionButton>
            </>
          ) : (
            <ActionButton icon={<DeleteForeverIcon />} className="is-danger" onClick={() => setConfirmDelete(true)}>Delete account</ActionButton>
          )}
        </div>
        {error && <p className="account-error">{error}</p>}
        <p className="account-help"><a href="/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a></p>
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
      setError(REQUEST_ERRORS[answer.result]);
    }
  };

  const submitCode = async () => {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const ok = await verifyCode(sentTo, code);
    setBusy(false);
    if (ok) onClose(); else setError('The code is wrong or has expired.');
  };

  return (
    <div className="account-dialog">
      <h2>Log in</h2>
      {sentTo === null ? (
        <>
          <p className="account-help">
            No password needed. We send a login link and a code to your email address. This also confirms the address,
            so the finished PDF can be sent to it.
          </p>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={254}
            value={email}
            aria-label="Email address"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && EMAIL_PATTERN.test(email.trim())) sendLink(); }}
          />
          <div className="account-actions">
            <ActionButton icon={<MailOutlineIcon />} disabled={busy || !EMAIL_PATTERN.test(email.trim())} onClick={sendLink}>
              Send login link
            </ActionButton>
          </div>
          <p className="account-help">
            We store your address and the devices you log in on until you delete your account.{' '}
            <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a>
          </p>
        </>
      ) : (
        <>
          {devCode ? (
            <p>
              <strong>Test environment:</strong> no mail is sent here, the code is filled in for you. Press Log in.
            </p>
          ) : (
            <p>We sent a mail to <strong>{sentTo}</strong>. Open the link in it, or enter the 6-digit code here.</p>
          )}
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            aria-label="Login code"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) submitCode(); }}
          />
          <div className="account-actions">
            <ActionButton icon={<LogoutIcon />} disabled={busy || code.length !== 6} onClick={submitCode}>Log in</ActionButton>
            <ActionButton icon={<CloseIcon />} onClick={() => { setSentTo(null); setError(null); }}>Use another address</ActionButton>
          </div>
        </>
      )}
      {error && <p className="account-error">{error}</p>}
    </div>
  );
}
