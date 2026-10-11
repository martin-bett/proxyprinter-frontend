import { configToFormValues } from './GalleryConfigWizard';
import { Config } from '../../../service/ApiFactory';

const asConfig = (value: object) => value as unknown as Config;

describe('configToFormValues', () => {
  it('macht fehlende Textwerte zu leeren Texten', () => {
    expect(configToFormValues(asConfig({ id: 4, credential: null, hint: undefined, name: 'x' })))
      .toEqual({ id: 4, credential: '', hint: '', name: 'x' });
  });

  it('lässt fehlende Übersetzungen weg statt sie als "" zu schicken (Backend lehnt "" für eine Map mit 400 ab)', () => {
    expect(configToFormValues(asConfig({ id: 4, hintTranslations: null })).hintTranslations).toBeUndefined();
    expect(JSON.stringify(configToFormValues(asConfig({ id: 4, hintTranslations: null })))).toBe('{"id":4}');
  });

  it('setzt das Objektfeld auch dann zurück, wenn die Config es gar nicht liefert (kein Rest der vorigen Config)', () => {
    const values = configToFormValues(asConfig({ id: 5 }));
    expect('hintTranslations' in values).toBe(true);
    expect({ hintTranslations: { de: 'alt' }, ...values }.hintTranslations).toBeUndefined();
  });

  it('behält vorhandene Übersetzungen', () => {
    expect(configToFormValues(asConfig({ id: 4, hintTranslations: { de: 'Hallo' } })))
      .toEqual({ id: 4, hintTranslations: { de: 'Hallo' } });
  });
});
