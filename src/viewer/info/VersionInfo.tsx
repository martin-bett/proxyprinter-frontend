import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Beim Build gesetzt (scripts/react-scripts.js), UTC yyyyMMdd-HHmm
const FRONTEND_BUILD = process.env.REACT_APP_BUILD_NUMBER;

const VersionInfo: React.FC = () => {
    const { t } = useTranslation();
    const [backendBuild, setBackendBuild] = useState<string>();

    useEffect(() => {
        fetch('/api/version')
            .then(r => (r.ok ? r.json() : undefined))
            .then(v => { if (typeof v?.build === 'string') setBackendBuild(v.build); })
            .catch(() => undefined);
    }, []);

    return (
        <div className="version-info">
            <div>v0.3</div>
            {FRONTEND_BUILD && <div className="version-build">{t('version.build', { number: FRONTEND_BUILD })}</div>}
            {backendBuild && <div className="version-build">{t('version.backendBuild', { number: backendBuild })}</div>}
        </div>
    );
}
export default VersionInfo;
