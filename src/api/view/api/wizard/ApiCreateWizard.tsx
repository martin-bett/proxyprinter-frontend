import React, { useEffect, useMemo, useState } from 'react';
import { HTMLElement } from 'node-html-parser';
import ApiFactory, { ApiConfig, SearchResult } from '../../../../service/ApiFactory';
import DefaultLanguageSelect from '../../DefaultLanguageSelect';
import { buildTemplate, isTemplateError, validateRequest, WizardRequest } from './requestTemplate';
import { DataFormat, detectFormat, imageNeedsProxy, runTestRequest, TestResult } from './testRequest';
import { FieldAssignment, FieldRole, guessJsonFields, guessPaginationLink, JsonPath, pathForRole } from './jsonFields';
import { guessHtmlFields, htmlFieldForRole, parseHtml } from './htmlFields';
import { ROLES, roleClass } from './roles';
import JsonTreeView from './JsonTreeView';
import HtmlTreeView from './HtmlTreeView';
import './ApiCreateWizard.css';

interface Props {
  fingerprint: string | null;
  existingNames: string[];
  onCancel: () => void;
  /** Leere Config ohne Wizard anlegen (Expertenmodus) */
  onCreateEmpty: () => void;
  onCreated: (configId: number) => void;
}

const STEPS = ['Request', 'Search term', 'Test', 'Fields', 'Save'];
const PREVIEW_ROWS = 8;

interface Meta {
  name: string;
  category: string;
  officialWebsite: string;
  defaultLanguage: string;
  proxyImages: boolean;
  nameSplitCharacter: string;
  usePagination: boolean;
}

/** Schritt-für-Schritt-Anlage einer API-Config aus einer echten Beispielabfrage. */
const ApiCreateWizard: React.FC<Props> = ({ fingerprint, existingNames, onCancel, onCreateEmpty, onCreated }) => {
  const [step, setStep] = useState(0);
  const [req, setReq] = useState<WizardRequest>({ url: '', method: 'GET', body: '', requestFormat: 'json' });
  const [searchName, setSearchName] = useState('');
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');
  const [format, setFormat] = useState<DataFormat>('json');
  const [fields, setFields] = useState<FieldAssignment>({});
  const [activeRole, setActiveRole] = useState<FieldRole>('dataListField');
  const [pickError, setPickError] = useState('');
  const [preview, setPreview] = useState<{ all: SearchResult[]; matching: SearchResult[] } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [imageCheck, setImageCheck] = useState<'idle' | 'checking' | 'direct' | 'proxy'>('idle');
  const [meta, setMeta] = useState<Meta>({
    name: '', category: 'MTG', officialWebsite: '', defaultLanguage: '', proxyImages: false, nameSplitCharacter: '', usePagination: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Neue Abfrage oder anderer Suchname: altes Testergebnis gilt nicht mehr
  useEffect(() => { setTest(null); setTestError(''); }, [req, searchName]);

  const requestError = validateRequest(req);
  const template = useMemo(() => buildTemplate(req, searchName), [req, searchName]);
  const templateError = isTemplateError(template) ? template.error : '';

  // Antwort einmal parsen
  const parsed = useMemo<{ json?: unknown; html?: HTMLElement; error?: string }>(() => {
    if (!test) return {};
    try {
      return format === 'json' ? { json: JSON.parse(test.body) } : { html: parseHtml(test.body) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [test, format]);

  const paginationLink = useMemo(() => (parsed.json !== undefined ? guessPaginationLink(parsed.json) : undefined), [parsed]);

  const draft: ApiConfig | null = useMemo(() => {
    if (isTemplateError(template) || !test) return null;
    return {
      id: 0,
      type: 'api',
      name: meta.name.trim() || 'new api',
      category: meta.category,
      officialWebsite: meta.officialWebsite,
      customArts: false,
      method: req.method,
      baseUrl: template.baseUrl,
      requestFormat: req.method === 'POST' ? req.requestFormat : 'urlencoded',
      parameterMap: template.parameterMap,
      useBackendProxy: test.via === 'proxy',
      proxyImages: meta.proxyImages,
      dataFormat: format,
      dataListField: fields.dataListField ?? '',
      nameField: fields.nameField ?? '',
      imageUrlField: fields.imageUrlField ?? '',
      languageField: fields.languageField ?? '',
      setField: fields.setField ?? '',
      setNumberField: fields.setNumberField ?? '',
      nameSplitCharacter: meta.nameSplitCharacter,
      paginationLinkField: meta.usePagination && paginationLink ? paginationLink : '',
      defaultLanguage: meta.defaultLanguage,
      concurrentLimit: 2,
    };
  }, [template, test, meta, req, format, fields, paginationLink]);

  // Mini-Vorschau mit der echten Auswertung aus ApiFactory
  useEffect(() => {
    if (!draft || !test || fields.dataListField === undefined) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    new ApiFactory({})
      .previewResponse(draft, test.body, searchName.trim())
      .then(p => { if (!cancelled) { setPreview(p); setPreviewError(''); } })
      .catch(e => { if (!cancelled) { setPreview(null); setPreviewError(e instanceof Error ? e.message : String(e)); } });
    return () => { cancelled = true; };
  }, [draft, test, searchName, fields.dataListField]);

  const firstImage = preview?.all.find(r => r.imageUrl)?.imageUrl;

  // Prüfen, ob die Bilder ohne Backend geladen werden können
  useEffect(() => {
    if (step !== 4 || !firstImage) return;
    let cancelled = false;
    setImageCheck('checking');
    imageNeedsProxy(firstImage).then(needs => {
      if (cancelled) return;
      setImageCheck(needs ? 'proxy' : 'direct');
      setMeta(m => ({ ...m, proxyImages: needs }));
    });
    return () => { cancelled = true; };
  }, [step, firstImage]);

  const applyGuess = (fmt: DataFormat, result: TestResult) => {
    try {
      const guess = fmt === 'json'
        ? guessJsonFields(JSON.parse(result.body), searchName)
        : guessHtmlFields(parseHtml(result.body), searchName);
      setFields(guess);
      const missing = ROLES.find(r => r.required && guess[r.role] === undefined);
      setActiveRole(missing ? missing.role : 'nameField');
    } catch {
      setFields({});
    }
  };

  const handleRunTest = async () => {
    setTesting(true);
    setTestError('');
    setTest(null);
    try {
      const result = await runTestRequest(req);
      const fmt = detectFormat(result.contentType, result.body);
      setTest(result);
      setFormat(fmt);
      applyGuess(fmt, result);
      setMeta(m => {
        const origin = new URL(req.url.trim()).origin;
        const host = new URL(req.url.trim()).hostname.replace(/^(www|api)\./, '').split('.')[0];
        return { ...m, officialWebsite: m.officialWebsite || origin, name: m.name || host };
      });
    } catch (e) {
      setTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const assign = (result: { path: string } | { error: string }) => {
    if ('error' in result) {
      setPickError(result.error);
      return;
    }
    setPickError('');
    const next = { ...fields, [activeRole]: result.path };
    setFields(next);
    // weiter zum nächsten fehlenden Pflichtfeld
    const missing = ROLES.find(r => r.role !== activeRole && r.required && next[r.role] === undefined);
    if (missing) setActiveRole(missing.role);
  };

  const handleJsonSelect = (path: JsonPath) => assign(pathForRole(parsed.json, path, activeRole, fields.dataListField));
  const handleHtmlSelect = (el: HTMLElement) => assign(htmlFieldForRole(parsed.html as HTMLElement, el, activeRole, fields.dataListField));

  const setField = (role: FieldRole, value: string) => {
    setFields(prev => {
      const next = { ...prev };
      if (value === '' && role !== 'dataListField') delete next[role];
      else next[role] = value;
      return next;
    });
  };

  const nameTaken = existingNames.some(n => n.toLowerCase() === meta.name.trim().toLowerCase());
  const testOk = !!test && test.status >= 200 && test.status < 300 && !parsed.error;
  const fieldsOk = !!preview && preview.all.some(r => r.name && r.imageUrl);

  const canNext = [
    !requestError,
    !templateError,
    testOk,
    fieldsOk,
    false,
  ][step];

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError('');
    const headers = { 'Content-Type': 'application/json', 'X-Fingerprint': fingerprint || '' };
    try {
      const created = await fetch('/api/configs/create', { method: 'GET', headers });
      if (!created.ok) throw new Error(`create failed (HTTP ${created.status})`);
      const id = Number(await created.text());
      if (!id) throw new Error('create returned no id');
      const config: Partial<ApiConfig> = { ...draft };
      delete config.type;
      const edited = await fetch('/api/configs/edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...config, id, name: meta.name.trim(), published: false }),
      });
      if (!edited.ok) throw new Error(`save failed (HTTP ${edited.status})`);
      onCreated(id);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const renderRequest = () => (
    <div className="wiz-panel">
      <p className="wiz-help">Paste a search request that already returns results, e.g. <code>https://api.scryfall.com/cards/search?q=Lightning+Bolt</code>.</p>
      <div className="wiz-grid">
        <label>Method</label>
        <div className="wiz-segment">
          {(['GET', 'POST'] as const).map(m => (
            <button key={m} type="button" className={'button is-small' + (req.method === m ? ' is-active' : '')} onClick={() => setReq({ ...req, method: m })}>{m}</button>
          ))}
        </div>
        <label>REST URL</label>
        <input className="input" type="text" value={req.url} placeholder="https://…" onChange={e => setReq({ ...req, url: e.target.value })} />
        {req.method === 'POST' && (
          <>
            <label>Body format</label>
            <select className="wiz-select" value={req.requestFormat} onChange={e => setReq({ ...req, requestFormat: e.target.value as WizardRequest['requestFormat'] })}>
              <option value="json">JSON</option>
              <option value="urlencoded">Form (a=1&amp;b=2)</option>
            </select>
            <label>Body</label>
            <textarea className="textarea" rows={6} value={req.body}
              placeholder={req.requestFormat === 'json' ? '{"search": "Lightning Bolt"}' : 'search=Lightning+Bolt&type=card'}
              onChange={e => setReq({ ...req, body: e.target.value })} />
          </>
        )}
      </div>
      {req.url && requestError && <p className="wiz-error">{requestError}</p>}
      <p className="wiz-help wiz-expert">
        Source needs follow links, CSRF tokens or nested languages?{' '}
        <button type="button" className="wiz-link" onClick={onCreateEmpty}>Create an empty config and fill it in by hand</button>
      </p>
    </div>
  );

  const renderSearchTerm = () => (
    <div className="wiz-panel">
      <p className="wiz-help">Which card name did you search for in this request? It gets replaced by <code>{'{cardname}'}</code>, so every search fills in the card from the decklist.</p>
      <div className="wiz-grid">
        <label>Card name</label>
        <input className="input" type="text" value={searchName} placeholder="Lightning Bolt" onChange={e => setSearchName(e.target.value)} autoFocus />
      </div>
      {searchName && templateError && <p className="wiz-error">{templateError}</p>}
      {!isTemplateError(template) && (
        <div className="wiz-summary">
          <div><span className="wiz-muted">Base URL</span> <code>{template.baseUrl}</code></div>
          {Object.entries(template.parameterMap.request).map(([k, v]) => (
            <div key={k} className={template.nameParams.includes(k) ? 'wiz-param-hit' : ''}>
              <span className="wiz-muted">{req.method === 'GET' ? 'Query' : 'Body'}</span> <code>{k}</code> = <code>{v}</code>
            </div>
          ))}
          {template.warnings.map(w => <p key={w} className="wiz-warning">{w}</p>)}
        </div>
      )}
    </div>
  );

  const renderTest = () => (
    <div className="wiz-panel">
      <p className="wiz-help">The request runs directly in your browser first. If the source blocks that (CORS), it runs through our backend and the config is set to use the backend proxy.</p>
      <button type="button" className="button is-primary" onClick={handleRunTest} disabled={testing}>
        {testing ? 'Running…' : test ? 'Run again' : 'Run test request'}
      </button>
      {testError && <p className="wiz-error">{testError}</p>}
      {test && (
        <div className="wiz-summary">
          <div><span className="wiz-muted">Status</span> <span className={testOk ? 'wiz-ok' : 'wiz-error-text'}>HTTP {test.status}</span></div>
          <div>
            <span className="wiz-muted">Route</span>{' '}
            {test.via === 'direct' ? 'direct from the browser' : <>via backend proxy <span className="wiz-tag">Use Backend Proxy</span></>}
            {test.directError && <span className="wiz-muted"> (direct call failed: {test.directError})</span>}
          </div>
          <div>
            <span className="wiz-muted">Format</span>{' '}
            <div className="wiz-segment is-inline">
              {(['json', 'html'] as const).map(f => (
                <button key={f} type="button" className={'button is-small' + (format === f ? ' is-active' : '')}
                  onClick={() => { setFormat(f); if (test) applyGuess(f, test); }}>{f.toUpperCase()}</button>
              ))}
            </div>
            <span className="wiz-muted"> detected from the answer ({test.contentType || 'no content type'})</span>
          </div>
          {test.truncated && <p className="wiz-warning">The answer was cut off at 3 MB.</p>}
          {parsed.error && <p className="wiz-error">Could not read the answer as {format.toUpperCase()}: {parsed.error}</p>}
          {!testOk && !parsed.error && <pre className="wiz-raw">{test.body.slice(0, 2000)}</pre>}
        </div>
      )}
    </div>
  );

  const renderPreview = () => (
    <div className="wiz-preview">
      <h3 className="wiz-subtitle">
        Preview
        {preview && <span className="wiz-muted"> {preview.all.length} results, {preview.matching.length} match "{searchName.trim()}"</span>}
      </h3>
      {previewError && <p className="wiz-error">{previewError}</p>}
      {!preview && !previewError && <p className="wiz-muted">Choose the result list to see results.</p>}
      {preview && preview.all.length > 0 && (
        <table className="table is-narrow is-fullwidth wiz-table">
          <thead><tr><th>Name</th><th>Image</th><th>Lang</th><th>Set</th><th>Nr</th></tr></thead>
          <tbody>
            {preview.all.slice(0, PREVIEW_ROWS).map((r, i) => (
              <tr key={i} className={preview.matching.includes(r) ? 'wiz-match' : ''}>
                <td>{r.name || <span className="wiz-error-text">–</span>}</td>
                <td className="wiz-url">{r.imageUrl ? <a href={r.imageUrl} target="_blank" rel="noreferrer">{r.imageUrl}</a> : <span className="wiz-error-text">–</span>}</td>
                <td>{r.languageCode || ''}</td>
                <td>{r.set || ''}</td>
                <td>{r.setNumber || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {preview && preview.all.length > PREVIEW_ROWS && <p className="wiz-muted">… and {preview.all.length - PREVIEW_ROWS} more</p>}
      {preview && preview.all.length > 0 && preview.matching.length === 0 && (
        <p className="wiz-warning">No result has exactly the name "{searchName.trim()}". Searches only keep exact name matches, so check the name field or set a split character (e.g. <code>{'//'}</code> for double-faced names).</p>
      )}
    </div>
  );

  const renderFields = () => (
    <div className="wiz-fields">
      <div className="wiz-fields-side">
        <p className="wiz-help">Pick a field, then click the matching value in the raw data. {format === 'json' ? 'Fields are read relative to one list entry.' : 'Values use the syntax "css-selector | innerText" or "css-selector | attr:src".'}</p>
        {ROLES.map(r => (
          <div key={r.role} className={'wiz-role' + (activeRole === r.role ? ' is-active' : '')} onClick={() => setActiveRole(r.role)} title={r.hint}>
            <span className={'wiz-swatch ' + roleClass(r.role)} />
            <span className="wiz-role-label">{r.label}{r.required ? ' *' : ''}</span>
            <input className="input is-small" type="text" value={fields[r.role] ?? ''}
              placeholder={r.role === 'dataListField' && format === 'json' ? '(whole answer)' : ''}
              onFocus={() => setActiveRole(r.role)}
              onChange={e => setField(r.role, e.target.value)} />
          </div>
        ))}
        <div className="wiz-role">
          <span className="wiz-swatch" />
          <span className="wiz-role-label" title="Character between the names of multi-part cards, e.g. // at Scryfall">Split char</span>
          <input className="input is-small" type="text" value={meta.nameSplitCharacter} placeholder="e.g. //"
            onChange={e => setMeta({ ...meta, nameSplitCharacter: e.target.value })} />
        </div>
        {paginationLink && (
          <label className="wiz-check">
            <input type="checkbox" checked={meta.usePagination} onChange={e => setMeta({ ...meta, usePagination: e.target.checked })} />
            Follow next pages via <code>{paginationLink}</code>
          </label>
        )}
        <button type="button" className="button is-small" onClick={() => test && applyGuess(format, test)}>Guess fields again</button>
        {pickError && <p className="wiz-error">{pickError}</p>}
        {renderPreview()}
      </div>
      <div className="wiz-fields-raw">
        {parsed.json !== undefined && <JsonTreeView data={parsed.json} fields={fields} onSelect={handleJsonSelect} />}
        {parsed.html && <HtmlTreeView root={parsed.html} fields={fields} onSelect={handleHtmlSelect} />}
      </div>
    </div>
  );

  const renderSave = () => (
    <div className="wiz-panel">
      <div className="wiz-grid">
        <label>Name *</label>
        <input className="input" type="text" value={meta.name} onChange={e => setMeta({ ...meta, name: e.target.value })} />
        <label>Category</label>
        <select className="wiz-select" value={meta.category} onChange={e => setMeta({ ...meta, category: e.target.value })}>
          <option value="MTG">MTG</option>
          <option value="POKE">Poke</option>
          <option value="YUGIOH">Yugi</option>
          <option value="MISC">Misc</option>
        </select>
        <label>Official Website</label>
        <input className="input" type="text" value={meta.officialWebsite} onChange={e => setMeta({ ...meta, officialWebsite: e.target.value })} />
        <DefaultLanguageSelect value={meta.defaultLanguage} onChange={e => setMeta({ ...meta, defaultLanguage: e.target.value })} />
        <label>Proxy Images</label>
        <label className="wiz-check">
          <input type="checkbox" checked={meta.proxyImages} onChange={e => setMeta({ ...meta, proxyImages: e.target.checked })} />
          {imageCheck === 'checking' && 'checking whether images load directly…'}
          {imageCheck === 'direct' && 'images load directly, no proxy needed'}
          {imageCheck === 'proxy' && 'images block direct loading, load them through the backend'}
          {imageCheck === 'idle' && 'load images through the backend'}
        </label>
      </div>
      {meta.name.trim() && nameTaken && <p className="wiz-error">A config with this name already exists.</p>}
      <details className="wiz-details">
        <summary>Config that will be saved</summary>
        <pre className="wiz-raw">{JSON.stringify(draft && { ...draft, name: meta.name.trim() }, null, 2)}</pre>
      </details>
      {saveError && <p className="wiz-error">{saveError}</p>}
      <p className="wiz-help">The config is saved as private. Pagination, follow links and the other expert fields can be edited afterwards in the config settings.</p>
    </div>
  );

  return (
    <div className="api-create-wizard">
      <div className="wiz-header">
        <h2 className="title is-4">Create API</h2>
        <ol className="wiz-steps">
          {STEPS.map((s, i) => (
            <li key={s} className={(i === step ? 'is-current' : '') + (i < step ? ' is-done' : '')}
              onClick={() => i < step && setStep(i)}>
              <span className="wiz-step-nr">{i + 1}</span>{s}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && renderRequest()}
      {step === 1 && renderSearchTerm()}
      {step === 2 && renderTest()}
      {step === 3 && renderFields()}
      {step === 4 && renderSave()}

      <div className="wiz-actions">
        <button type="button" className="button" onClick={onCancel}>Cancel</button>
        <span className="wiz-spacer" />
        {step > 0 && <button type="button" className="button" onClick={() => setStep(step - 1)}>Back</button>}
        {step < STEPS.length - 1 && (
          <button type="button" className="button is-primary" disabled={!canNext}
            onClick={() => { if (step === 1 && !test) handleRunTest(); setStep(step + 1); }}>Next</button>
        )}
        {step === STEPS.length - 1 && (
          <button type="button" className="button is-primary" disabled={saving || !meta.name.trim() || nameTaken || !draft} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save config'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ApiCreateWizard;
