import React from 'react';
import { HandHeart } from 'lucide-react';
import ActionLink from '../../container/inputs/ActionLink';

// Direkter Link auf die PayPal-Spendenseite statt des PayPal-SDK-Bildbuttons,
// damit der Button wie alle anderen aussieht
const PayPalDonateButton: React.FC = () => (
  <ActionLink href="https://www.paypal.com/donate/?hosted_button_id=MRVMDLBTPFMRA" icon={<HandHeart />}>
    Donate
  </ActionLink>
);

export default PayPalDonateButton;
