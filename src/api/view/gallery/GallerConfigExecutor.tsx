import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Alert, LinearProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { GalleryConfig } from "../../../service/ApiFactory";
import ActionButton from '../../../container/inputs/ActionButton';
import './GalleryConfigExecutor.css';

type ParameterMapSection = Record<string, string>;

interface ParameterMapState {
    url: ParameterMapSection;
    request: ParameterMapSection;
}

export interface GalleryExecuteStatus {
    loading: boolean;
    error?: string;
}

interface GalleryConfigExecutorProps {
    config: GalleryConfig | null;
    handleExecute: (config: GalleryConfig) => void;
    status: GalleryExecuteStatus;
    onDismissError: () => void;
}

// Reiter "Run": Hinweis, Eingabefelder für alle $GALLERY_INPUT$-Einträge der parameterMap und Execute
const GalleryConfigExecutor: React.FC<GalleryConfigExecutorProps> = ({ config, handleExecute, status, onDismissError }) => {
    const { t } = useTranslation();
    const [initialInputs, setInitialInputs] = useState<string[]>([]);
    const [parameterMap, setParameterMap] = useState<ParameterMapState>({
        url: {},
        request: {},
    });

    // Aktualisiere den parameterMap-State, wenn config sich ändert
    useEffect(() => {
        const { url = {}, request = {} } = (config?.parameterMap ?? {}) as Partial<ParameterMapState>; // Fallback zu leeren Objekten

        setParameterMap({
            url: { ...url },
            request: { ...request },
        });

        // InitialInputs füllen
        const inputs = [
            ...Object.entries(url),
            ...Object.entries(request),
        ]
            .filter(([, value]) => value === "$GALLERY_INPUT$")
            .map(([key]) => key);

        setInitialInputs(inputs);
    }, [config]);

    if (!config) {
        return <p className="gallery-run-hint">{t('galleryConfig.executor.selectGallery')}</p>;
    }

    // Handle Änderungen in den Inputs
    const handleInputChange = (type: keyof ParameterMapState, key: string, value: string) => {
        setParameterMap((prev) => ({
            ...prev,
            [type]: {
                ...prev[type],
                [key]: value,
            },
        }));
    };

    // Submit die konfigurierte parameterMap
    const handleSubmit = () => {
        // Baue eine neue Config mit der aktualisierten parameterMap
        const updatedConfig = { ...config, parameterMap };
        handleExecute(updatedConfig); // Übergib die aktualisierte Config
    };

    const renderParameterInputs = (type: keyof ParameterMapState) =>
        // Nutze initialInputs, um die relevanten Felder zu rendern
        Object.keys(parameterMap[type])
            .filter((key) => initialInputs.includes(key))
            .map((key) => (
                <label key={`${type}-${key}`} className="gallery-run-field">
                    <span className="gallery-run-label">{key}</span>
                    <input
                        type="text"
                        className="gallery-run-input"
                        placeholder={key === "url" ? t('galleryConfig.executor.pasteLink') : undefined}
                        value={parameterMap[type][key] === "$GALLERY_INPUT$" ? "" : parameterMap[type][key] || ""}
                        onChange={(e) =>
                            handleInputChange(type, key, e.target.value)
                        }
                    />
                </label>
            ));

    return (
        <form className="gallery-run" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <p className="gallery-run-hint">
                {initialInputs.length > 0 ? t('galleryConfig.executor.hint') : t('galleryConfig.executor.hintNoInput')}
            </p>
            {renderParameterInputs("url")}
            {renderParameterInputs("request")}
            {status.loading && <LinearProgress />}
            {status.error && (
                <Alert severity="warning" onClose={onDismissError}>{status.error}</Alert>
            )}
            <ActionButton type="submit" className="is-primary" icon={<PlayArrowIcon />} disabled={status.loading}>
                {t('galleryConfig.executor.execute')}
            </ActionButton>
        </form>
    );
};

export default GalleryConfigExecutor;
