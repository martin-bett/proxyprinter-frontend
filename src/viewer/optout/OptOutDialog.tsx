import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@mui/material';
import ClosableDialog from '../../container/ClosableDialog';
import { fetchOptOutInfo, OptOutInfo, OptOutResult, requestOptOut, verifyOptOut } from '../../service/optout/optOut';
import './OptOutDialog.css';

interface OptOutDialogProps {
  open: boolean;
  onClose: () => void;
  /** Token aus dem Mail-Link: wird beim Öffnen sofort eingelöst. */
  linkToken?: string | null;
}

/** Öffentliche Maske, mit der Betreiber ihre Domain oder IP als Quelle sperren (Nachweis per Mail-Link oder DNS/Datei). */
const OptOutDialog: React.FC<OptOutDialogProps> = ({ open, onClose, linkToken }) => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<OptOutInfo>({ mail: false, mailboxes: [] });
  const [host, setHost] = useState('');
  const [chosenMethod, setMethod] = useState<'mail' | 'challenge'>('mail');
  const [mailbox, setMailbox] = useState('admin');
  const [result, setResult] = useState<OptOutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchOptOutInfo().then(i => {
      setInfo(i);
      if (i.mailboxes.length > 0) setMailbox(m => (i.mailboxes.includes(m) ? m : i.mailboxes[0]));
    });
  }, [open]);

  const run = async (action: () => Promise<OptOutResult>) => {
    setBusy(true);
    setError(null);
    try {
      setResult(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open && linkToken) run(() => verifyOptOut(linkToken));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linkToken]);

  // Ohne Mailversand bleibt nur DNS/Datei
  const method = info.mail ? chosenMethod : 'challenge';
  const domain = host.trim().toLowerCase().replace(/^[a-z]+:\/\//i, '').replace(/[/?#:].*$/, '') || 'example.com';
  const reset = () => { setResult(null); setError(null); };

  const renderForm = () => (
    <form onSubmit={e => { e.preventDefault(); run(() => requestOptOut(host, method, method === 'mail' ? mailbox : undefined)); }}>
      <p className="optout-help">{t('optOut.intro')}</p>
      <label className="label" htmlFor="optout-host">{t('optOut.host')}</label>
      <input id="optout-host" className="input" type="text" value={host} placeholder="example.com" autoFocus
        onChange={e => setHost(e.target.value)} />
      <p className="optout-hint">{t('optOut.subdomains')}</p>

      <div className="optout-methods">
        <label className={'optout-method' + (info.mail ? '' : ' is-disabled')}>
          <input type="radio" name="optout-method" checked={method === 'mail'} disabled={!info.mail}
            onChange={() => setMethod('mail')} />
          <span>
            <strong>{t('optOut.methodMail')}</strong>
            <span className="optout-hint">{info.mail ? t('optOut.methodMailHint') : t('optOut.mailUnavailable')}</span>
          </span>
        </label>
        {method === 'mail' && info.mail && (
          <div className="optout-mailbox">
            <select className="optout-select" value={mailbox} onChange={e => setMailbox(e.target.value)} aria-label={t('optOut.mailbox')}>
              {info.mailboxes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span>{'@' + domain}</span>
          </div>
        )}
        <label className="optout-method">
          <input type="radio" name="optout-method" checked={method === 'challenge'} onChange={() => setMethod('challenge')} />
          <span>
            <strong>{t('optOut.methodChallenge')}</strong>
            <span className="optout-hint">{t('optOut.methodChallengeHint')}</span>
          </span>
        </label>
      </div>

      <div className="optout-actions">
        <button type="button" className="button" onClick={onClose}>{t('common.close')}</button>
        <button type="submit" className="button is-primary" disabled={busy || !host.trim()}>
          {method === 'mail' ? t('optOut.sendMail') : t('optOut.getToken')}
        </button>
      </div>
    </form>
  );

  const renderChallenge = (r: OptOutResult) => (
    <div>
      <p className="optout-help">{t('optOut.challengeIntro', { host: r.host })}</p>
      {r.dnsName && (
        <>
          <h3 className="optout-subtitle">{t('optOut.dnsTitle')}</h3>
          <table className="optout-table">
            <tbody>
              <tr><th>{t('optOut.dnsName')}</th><td><code>{r.dnsName}</code></td></tr>
              <tr><th>{t('optOut.dnsType')}</th><td><code>TXT</code></td></tr>
              <tr><th>{t('optOut.dnsValue')}</th><td><code>{r.dnsValue}</code></td></tr>
            </tbody>
          </table>
        </>
      )}
      <h3 className="optout-subtitle">{r.dnsName ? t('optOut.fileTitleOr') : t('optOut.fileTitle')}</h3>
      <table className="optout-table">
        <tbody>
          <tr><th>{t('optOut.fileUrl')}</th><td><code>{r.fileUrl}</code></td></tr>
          <tr><th>{t('optOut.fileContent')}</th><td><code>{r.token}</code></td></tr>
        </tbody>
      </table>
      <p className="optout-hint">{t('optOut.challengeValidity')}</p>
      <div className="optout-actions">
        <button type="button" className="button" onClick={reset}>{t('optOut.back')}</button>
        <button type="button" className="button is-primary" disabled={busy}
          onClick={() => run(() => verifyOptOut(r.token as string))}>
          {t('optOut.check')}
        </button>
      </div>
    </div>
  );

  const renderDone = (r: OptOutResult) => (
    <div>
      {r.status === 'sent'
        ? <Alert severity="info">{t('optOut.mailSent', { email: r.email, host: r.host })}</Alert>
        : <Alert severity="success">{t('optOut.blocked', { host: r.host })}</Alert>}
      <div className="optout-actions">
        <button type="button" className="button" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );

  return (
    <ClosableDialog open={open} onClose={onClose} maxWidth="sm">
      <div className="optout-dialog">
        <h2 className="optout-title">{t('optOut.title')}</h2>
        {error && <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}
        {busy && !result && linkToken ? <p>{t('optOut.checking')}</p>
          : !result ? renderForm()
          : result.status === 'challenge' ? renderChallenge(result)
          : renderDone(result)}
      </div>
    </ClosableDialog>
  );
};

export default OptOutDialog;
