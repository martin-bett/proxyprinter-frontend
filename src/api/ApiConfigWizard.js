// ApiConfigWizard.js

import React, { useState } from 'react';

const ApiConfigWizard = ({ onClose, onSave }) => {
  const [config, setConfig] = useState({
    name: '',
    method: 'GET',
    requestFormat: 'urlencoded',
    baseUrl: '',
    parameterMap: {},
    concurrentLimit: 1,
    dataFormat: 'json',
    dataListField: '',
    nameField: '',
    imageUrlField: '',
    setField: '',
    setNumberField: '',
    csrfTokenVariableName: '',
    requiresCsrfToken: false,
    useBackendProxy: false,
    followLinkField: '',
    followLinkDataListField: '',
    followLinkImageField: '',
    nestedLanguageDataListField: '',
    nestedLanguageImageUrlField: '',
    nestedLanguageLanguageField: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setConfig(prev => ({ ...prev, [name]: checked }));
  };

  const handleParameterMapChange = (e) => {
    try {
      const parameterMap = JSON.parse(e.target.value);
      setConfig(prev => ({ ...prev, parameterMap }));
    } catch (error) {
      console.error('Invalid JSON for parameterMap');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(config);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>New API Configuration</h2>
      
      <label>
        Name:
        <input type="text" name="name" value={config.name} onChange={handleInputChange} required />
      </label>

      <label>
        Method:
        <select name="method" value={config.method} onChange={handleInputChange}>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
      </label>

      <label>
        Request Format:
        <select name="requestFormat" value={config.requestFormat} onChange={handleInputChange}>
          <option value="urlencoded">URL Encoded</option>
          <option value="multipart">Multipart</option>
          <option value="json">JSON</option>
        </select>
      </label>

      <label>
        Base URL:
        <input type="url" name="baseUrl" value={config.baseUrl} onChange={handleInputChange} required />
      </label>

      <label>
        Parameter Map:
        <textarea 
          name="parameterMap" 
          value={JSON.stringify(config.parameterMap, null, 2)} 
          onChange={handleParameterMapChange}
        />
      </label>

      <label>
        Concurrent Limit:
        <input type="number" name="concurrentLimit" value={config.concurrentLimit} onChange={handleInputChange} required />
      </label>

      <label>
        Data Format:
        <select name="dataFormat" value={config.dataFormat} onChange={handleInputChange}>
          <option value="json">JSON</option>
          <option value="html">HTML</option>
        </select>
      </label>

      <label>
        Data List Field:
        <input type="text" name="dataListField" value={config.dataListField} onChange={handleInputChange} required />
      </label>

      <label>
        Name Field:
        <input type="text" name="nameField" value={config.nameField} onChange={handleInputChange} required />
      </label>

      <label>
        Image URL Field:
        <input type="text" name="imageUrlField" value={config.imageUrlField} onChange={handleInputChange} required />
      </label>

      <label>
        Set Field:
        <input type="text" name="setField" value={config.setField} onChange={handleInputChange} />
      </label>

      <label>
        Set Number Field:
        <input type="text" name="setNumberField" value={config.setNumberField} onChange={handleInputChange} />
      </label>

      <h3>Custom Request Options</h3>
      <label>
        <input type="checkbox" name="requiresCsrfToken" checked={config.requiresCsrfToken} onChange={handleCheckboxChange} />
        Requires CSRF Token
      </label>

      {config.requiresCsrfToken && (
        <label>
          CSRF Token Variable Name:
          <input type="text" name="csrfTokenVariableName" value={config.csrfTokenVariableName} onChange={handleInputChange} />
        </label>
      )}

      <label>
        <input type="checkbox" name="useBackendProxy" checked={config.useBackendProxy} onChange={handleCheckboxChange} />
        Use Backend Proxy
      </label>

      <h3>Extended Data Locator</h3>
      <label>
        Follow Link Field:
        <input type="text" name="followLinkField" value={config.followLinkField} onChange={handleInputChange} />
      </label>

      <label>
        Follow Link Data List Field:
        <input type="text" name="followLinkDataListField" value={config.followLinkDataListField} onChange={handleInputChange} />
      </label>

      <label>
        Follow Link Image Field:
        <input type="text" name="followLinkImageField" value={config.followLinkImageField} onChange={handleInputChange} />
      </label>

      <h3>Language Support</h3>
      <label>
        Nested Language Data List Field:
        <input type="text" name="nestedLanguageDataListField" value={config.nestedLanguageDataListField} onChange={handleInputChange} />
      </label>

      <label>
        Nested Language Image URL Field:
        <input type="text" name="nestedLanguageImageUrlField" value={config.nestedLanguageImageUrlField} onChange={handleInputChange} />
      </label>

      <label>
        Nested Language Language Field:
        <input type="text" name="nestedLanguageLanguageField" value={config.nestedLanguageLanguageField} onChange={handleInputChange} />
      </label>

      <button type="submit">Save Configuration</button>
      <button type="button" onClick={onClose}>Cancel</button>
    </form>
  );
};

export default ApiConfigWizard;