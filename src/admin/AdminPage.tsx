import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CloseIcon from '@mui/icons-material/Close';
import ActionButton from '../container/inputs/ActionButton';
import AccountDialog from '../viewer/account/AccountDialog';
import '../viewer/account/AccountDialog.css';
import { handleLoginLink, refreshAuth, useAuth } from '../service/auth/auth';
import {
  AdminCache, AdminLoadResult, AdminSetting, AdminUsage, clearCache, formatBytes, loadAdmin, resetSetting, saveSetting,
  USAGE_METRICS,
} from '../service/admin/adminApi';
import './AdminPage.css';

/** Beschriftung und Einheit je Einstellung (Schlüssel wie im Backend). */
const SETTING_TEXTS = {
  'searchcache.retention-days': { label: 'admin.settings.searchcacheRetention', unit: 'days' },
  'searchcache.max-entry-kb': { label: 'admin.settings.searchcacheMaxEntry', unit: 'kb' },
  'pdf.retention-days': { label: 'admin.settings.pdfRetention', unit: 'days' },
  'upload.retention-days': { label: 'admin.settings.uploadRetention', unit: 'days' },
  'log.db.retention-days': { label: 'admin.settings.logRetention', unit: 'days' },
} as const satisfies Record<string, { label: string; unit: 'days' | 'kb' }>;

const CACHE_TEXTS = {
  searchCache: 'admin.caches.searchCache',
  pdfs: 'admin.caches.pdfs',
  uploads: 'admin.caches.uploads',
  images: 'admin.caches.images',
  memory: 'admin.caches.memory',
} as const;

interface SettingRowProps {
  setting: AdminSetting;
  onChanged: (setting: AdminSetting) => void;
}

function SettingRow({ setting, onChanged }: SettingRowProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(String(setting.value));
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const texts = (SETTING_TEXTS as Record<string, (typeof SETTING_TEXTS)[keyof typeof SETTING_TEXTS] | undefined>)[setting.key];
  const unit = texts ? t(`admin.units.${texts.unit}`) : '';

  const number = Number(draft);
  const valid = draft.trim() !== '' && Number.isInteger(number) && number >= setting.min && number <= setting.max;

  const run = async (action: () => ReturnType<typeof saveSetting>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      setDraft(String(result.value.value));
      onChanged(result.value);
      setMessage({ text: t('admin.saved'), error: false });
    } else {
      setMessage({ text: result.error, error: true });
    }
  };

  return (
    <tr>
      <th scope="row">
        {texts ? t(texts.label) : setting.key}
        <span className="admin-hint">{t('admin.defaultValue', { value: setting.defaultValue, unit })}</span>
      </th>
      <td>
        <div className="admin-setting-input">
          <input
            className="input is-small"
            type="number"
            min={setting.min}
            max={setting.max}
            step={1}
            value={draft}
            aria-label={texts ? t(texts.label) : setting.key}
            aria-invalid={!valid}
            onChange={e => { setDraft(e.target.value); setMessage(null); }}
          />
          <span>{unit}</span>
        </div>
        {!valid && <span className="admin-error">{t('admin.range', { min: setting.min, max: setting.max })}</span>}
        {message && <span className={message.error ? 'admin-error' : 'admin-ok'}>{message.text}</span>}
      </td>
      <td className="admin-buttons">
        <ActionButton icon={<SaveIcon />} disabled={busy || !valid || number === setting.value}
          onClick={() => run(() => saveSetting(setting.key, number, t('admin.saveFailed')))}>
          {t('common.save')}
        </ActionButton>
        {setting.overridden && (
          <ActionButton icon={<RestartAltIcon />} disabled={busy}
            onClick={() => run(() => resetSetting(setting.key, t('admin.saveFailed')))}>
            {t('admin.resetToDefault')}
          </ActionButton>
        )}
      </td>
    </tr>
  );
}

interface CacheRowProps {
  cache: AdminCache;
  settings: AdminSetting[];
  onCleared: () => void;
}

function CacheRow({ cache, settings, onCleared }: CacheRowProps) {
  const { t, i18n } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const nameKey = (CACHE_TEXTS as Record<string, (typeof CACHE_TEXTS)[keyof typeof CACHE_TEXTS] | undefined>)[cache.name];
  const name = nameKey ? t(nameKey) : cache.name;
  const setting = settings.find(s => s.key === cache.setting);
  const lifetime = setting
    ? t('admin.lifetime.days', { days: setting.value })
    : t(cache.name === 'memory' ? 'admin.lifetime.minutes' : 'admin.lifetime.unlimited');

  const clear = async () => {
    setBusy(true);
    const result = await clearCache(cache.name, t('admin.clearFailed'));
    setBusy(false);
    setConfirm(false);
    setMessage(result.ok
      ? { text: t('admin.cleared', { number: result.value.deleted }), error: false }
      : { text: result.error, error: true });
    if (result.ok) onCleared();
  };

  return (
    <tr>
      <th scope="row">{name}</th>
      <td className="admin-number">{cache.entries}</td>
      <td className="admin-number">{cache.bytes >= 0 ? formatBytes(cache.bytes) : '–'}</td>
      <td>{cache.oldest ? new Date(cache.oldest).toLocaleDateString(i18n.language) : '–'}</td>
      <td>{lifetime}</td>
      <td className="admin-buttons">
        {confirm ? (
          <>
            {cache.name === 'uploads' && <span className="admin-hint">{t('admin.uploadsWarning')}</span>}
            <ActionButton icon={<CloseIcon />} disabled={busy} onClick={() => setConfirm(false)}>{t('common.cancel')}</ActionButton>
            <ActionButton icon={<DeleteSweepIcon />} className="is-danger" disabled={busy} onClick={clear}>
              {t('admin.clearConfirm')}
            </ActionButton>
          </>
        ) : (
          <ActionButton icon={<DeleteSweepIcon />} onClick={() => { setConfirm(true); setMessage(null); }}>
            {t('admin.clearNow')}
          </ActionButton>
        )}
        {message && <span className={message.error ? 'admin-error' : 'admin-ok'}>{message.text}</span>}
      </td>
    </tr>
  );
}

function UsageTable({ usage }: { usage: AdminUsage }) {
  const { t, i18n } = useTranslation();
  const number = (value: number | undefined) => (value ?? 0).toLocaleString(i18n.language);
  // Tag als UTC lesen, sonst rutscht er westlich von Greenwich auf den Vortag
  const date = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(i18n.language, { timeZone: 'UTC' });
  return (
    <div className="admin-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin.usage.day')}</th>
            {USAGE_METRICS.map(m => <th key={m} className="admin-number">{t(`admin.usage.${m}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="admin-total">
            <th scope="row">{t('admin.usage.total')}</th>
            {USAGE_METRICS.map(m => <td key={m} className="admin-number">{number(usage.totals[m])}</td>)}
          </tr>
          {usage.days.map(d => (
            <tr key={d.day}>
              <th scope="row">{date(d.day)}</th>
              {USAGE_METRICS.map(m => <td key={m} className="admin-number">{number(d.counts[m])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [result, setResult] = useState<AdminLoadResult | null>(null);

  const reload = useCallback(async () => setResult(await loadAdmin()), []);

  useEffect(() => {
    (async () => {
      if (!(await handleLoginLink())) await refreshAuth();
    })();
  }, []);

  // Sobald der Login-Stand bekannt ist und nach Login oder Logout im eingebetteten Konto-Dialog neu laden
  useEffect(() => {
    if (auth.loaded) reload();
  }, [auth.email, auth.loaded, reload]);

  const updateSetting = (changed: AdminSetting) => setResult(current => current?.status === 'ok'
    ? { status: 'ok', data: { ...current.data, settings: current.data.settings.map(s => s.key === changed.key ? changed : s) } }
    : current);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>{t('admin.title')}</h1>
        <a href="/">{t('admin.backToApp')}</a>
      </header>

      {result === null && <p>{t('common.loading')}</p>}
      {result?.status === 'error' && <p className="admin-error">{t('admin.loadFailed')}</p>}
      {result?.status === 'login' && (
        <section className="admin-section">
          <p>{t('admin.loginNeeded')}</p>
          <div className="account-dialog"><AccountDialog onClose={reload} /></div>
        </section>
      )}
      {result?.status === 'forbidden' && (
        <section className="admin-section">
          <p className="admin-error">{t('admin.forbidden', { email: auth.email ?? '' })}</p>
          <div className="account-dialog"><AccountDialog onClose={reload} /></div>
        </section>
      )}
      {result?.status === 'ok' && (
        <>
          {result.data.usage && (
            <section className="admin-section">
              <div className="admin-section-head">
                <h2>{t('admin.usageTitle')}</h2>
                <ActionButton icon={<RefreshIcon />} onClick={reload}>{t('admin.refresh')}</ActionButton>
              </div>
              <p className="admin-hint">{t('admin.usageHint')}</p>
              <UsageTable usage={result.data.usage} />
            </section>
          )}
          <section className="admin-section">
            <h2>{t('admin.settingsTitle')}</h2>
            <p className="admin-hint">{t('admin.settingsHint')}</p>
            <table className="admin-table">
              <tbody>
                {result.data.settings.map(s => <SettingRow key={s.key} setting={s} onChanged={updateSetting} />)}
              </tbody>
            </table>
          </section>
          <section className="admin-section">
            <div className="admin-section-head">
              <h2>{t('admin.cachesTitle')}</h2>
              <ActionButton icon={<RefreshIcon />} onClick={reload}>{t('admin.refresh')}</ActionButton>
            </div>
            <div className="admin-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('admin.columns.cache')}</th>
                    <th>{t('admin.columns.entries')}</th>
                    <th>{t('admin.columns.size')}</th>
                    <th>{t('admin.columns.oldest')}</th>
                    <th>{t('admin.columns.lifetime')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result.data.caches.map(c => (
                    <CacheRow key={c.name} cache={c} settings={result.data.settings} onCleared={reload} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
