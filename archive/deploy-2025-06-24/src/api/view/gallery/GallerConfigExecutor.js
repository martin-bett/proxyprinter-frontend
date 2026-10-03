import React, { useState,useEffect } from "react";

const GalleryConfigExecutor = ({ config, handleExecute }) => {
    const [initialInputs, setInitialInputs] = useState([]);
    const [parameterMap, setParameterMap] = useState({
        url: {},
        request: {},
    });

    // Aktualisiere den parameterMap-State, wenn config sich ändert
    useEffect(() => {
        if (config?.parameterMap) {
            const { url = {}, request = {} } = config.parameterMap; // Fallback zu leeren Objekten

            setParameterMap({
                url: { ...url },
                request: { ...request },
            });

            // InitialInputs füllen
            const inputs = [
                ...Object.entries(url),
                ...Object.entries(request),
            ]
                .filter(([_, value]) => value === "$GALLERY_INPUT$")
                .map(([key]) => key);

            setInitialInputs(inputs);
        }
    }, [config]);


    if (!config || !config.parameterMap) return null;
    // Handle Änderungen in den Inputs
    const handleInputChange = (type, key, value) => {
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

    const renderParameterInputs = (type, entries) => {
        // Nutze initialInputs, um die relevanten Felder zu rendern
        const filteredEntries = entries.filter(([key]) => initialInputs.includes(key));

        return (
            <div>
                <ul>
                    {filteredEntries.map(([key, value]) => (
                        <li key={key}>
                            <label>
                                <strong>{key}:</strong>
                                <input
                                    type="text"
                                    value={parameterMap[type][key] || ""}
                                    onChange={(e) =>
                                        handleInputChange(type, key, e.target.value)
                                    }
                                />
                            </label>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };
    
    return (
        <div>
            {renderParameterInputs("url", Object.entries(parameterMap.url))}
            {renderParameterInputs("request", Object.entries(parameterMap.request))}
            <button onClick={handleSubmit}>Execute</button>
        </div>
    );
};

export default GalleryConfigExecutor;
