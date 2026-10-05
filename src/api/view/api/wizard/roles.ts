import type { FieldRole } from './jsonFields';

export interface RoleInfo {
  role: FieldRole;
  label: string;
  hint: string;
  required: boolean;
}

export const ROLES: RoleInfo[] = [
  { role: 'dataListField', label: 'Result list', hint: 'The list that holds one entry per card', required: true },
  { role: 'nameField', label: 'Name', hint: 'Card name, must match the searched name', required: true },
  { role: 'imageUrlField', label: 'Image', hint: 'URL of the card image', required: true },
  { role: 'languageField', label: 'Language', hint: 'Language of the card (optional)', required: false },
  { role: 'setField', label: 'Set', hint: 'Set / edition (optional)', required: false },
  { role: 'setNumberField', label: 'Set number', hint: 'Collector number (optional)', required: false },
];

export function roleClass(role: FieldRole): string {
  return 'wiz-role-' + role;
}
