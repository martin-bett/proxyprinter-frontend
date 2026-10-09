import React from 'react';
import { HandHeart } from 'lucide-react';
import ActionLink from '../../container/inputs/ActionLink';
import { useTranslation } from 'react-i18next';

// Direkter Link auf die PayPal-Spendenseite statt des PayPal-SDK-Bildbuttons,
// damit der Button wie alle anderen aussieht
const PayPalDonateButton: React.FC = () => {
  const { t } = useTranslation();
  return (
  <ActionLink href="https://www.paypal.com/donate/?hosted_button_id=MRVMDLBTPFMRA" icon={<HandHeart />}>
    {t('info.donate')}
  </ActionLink>
  );
};

export default PayPalDonateButton;
