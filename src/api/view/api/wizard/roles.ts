import type { ParseKeys } from 'i18next';
import type { FieldRole } from './jsonFields';

export interface RoleInfo {
  role: FieldRole;
  /** i18n key of the label */
  label: ParseKeys;
  /** i18n key of the hint */
  hint: ParseKeys;
  required: boolean;
}

export const ROLES: RoleInfo[] = [
  { role: 'dataListField', label: 'wizard.roles.dataListField.label', hint: 'wizard.roles.dataListField.hint', required: true },
  { role: 'nameField', label: 'common.name', hint: 'wizard.roles.nameField.hint', required: true },
  { role: 'imageUrlField', label: 'wizard.roles.imageUrlField.label', hint: 'wizard.roles.imageUrlField.hint', required: true },
  { role: 'languageField', label: 'common.language', hint: 'wizard.roles.languageField.hint', required: false },
  { role: 'setField', label: 'common.set', hint: 'wizard.roles.setField.hint', required: false },
  { role: 'setNumberField', label: 'wizard.roles.setNumberField.label', hint: 'wizard.roles.setNumberField.hint', required: false },
];

export function roleClass(role: FieldRole): string {
  return 'wiz-role-' + role;
}
