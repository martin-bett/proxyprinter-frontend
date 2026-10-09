import React, { useEffect, useState } from 'react';
import PersonIcon from '@mui/icons-material/Person';
import { handleLoginLink, refreshAuth, useAuth } from '../../service/auth/auth';
import ClosableDialog from '../../container/ClosableDialog';
import AccountDialog from './AccountDialog';
import './AccountDialog.css';

/** Bubble für Login und Konto-Menü. Löst beim Start auch einen Login-Link (?login=) ein. */
export default function AccountButton() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const hadLink = new URLSearchParams(window.location.search).has('login');
      const ok = await handleLoginLink();
      if (hadLink && !ok) setLinkFailed(true);
      if (!ok) await refreshAuth();
      if (hadLink) setOpen(true);
    })();
  }, []);

  if (!auth.loaded) return null;

  const letter = auth.email ? auth.email.charAt(0).toUpperCase() : null;
  const title = auth.email
    ? `Logged in as ${auth.email}`
    : auth.loginEnabled ? 'Log in' : 'Login is not set up on this server';

  return (
    <>
      <button
        className="memory-button"
        title={title}
        disabled={!auth.email && !auth.loginEnabled}
        onClick={() => { setLinkFailed(false); setOpen(true); }}
      >
        {letter ? <span className="account-letter">{letter}</span> : <PersonIcon />}
      </button>
      <ClosableDialog open={open} onClose={() => setOpen(false)} maxWidth="xs">
        <AccountDialog onClose={() => setOpen(false)} linkFailed={linkFailed} />
      </ClosableDialog>
    </>
  );
}
