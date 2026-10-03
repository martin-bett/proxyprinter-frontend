import React, { useEffect, useRef } from 'react';

interface PayPalDonationButtonConfig {
  env: string;
  hosted_button_id: string;
  image: {
    src: string;
    alt: string;
    title: string;
  };
}

interface PayPalDonationButtonInstance {
  render: (selector: string) => void;
}

declare global {
  interface Window {
    PayPal?: {
      Donation: {
        Button: (config: PayPalDonationButtonConfig) => PayPalDonationButtonInstance;
      };
    };
  }
}

const PayPalDonateButton: React.FC = () => {
  const scriptLoaded = useRef(false);
  const buttonRendered = useRef(false);

  useEffect(() => {
    // Prüfen ob das Script bereits geladen wurde
    if (document.querySelector('script[src="https://www.paypalobjects.com/donate/sdk/donate-sdk.js"]')) {
      scriptLoaded.current = true;
    }

    const renderButton = () => {
      if (!buttonRendered.current && window.PayPal && document.getElementById('donate-button')) {
        try {
          window.PayPal.Donation.Button({
            env: 'production',
            hosted_button_id: 'MRVMDLBTPFMRA',
            image: {
              src: 'https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif',
              alt: 'Donate with PayPal button',
              title: 'PayPal - The safer, easier way to pay online!',
            }
          }).render('#donate-button');
          buttonRendered.current = true;
        } catch (error) {
          console.error('PayPal button render error:', error);
        }
      }
    };

    if (!scriptLoaded.current) {
      const script = document.createElement('script');
      script.src = 'https://www.paypalobjects.com/donate/sdk/donate-sdk.js';
      script.charset = 'UTF-8';

      script.addEventListener('load', () => {
        scriptLoaded.current = true;
        renderButton();
      });

      document.body.appendChild(script);
    } else {
      // Wenn das Script bereits geladen ist, Button direkt rendern
      renderButton();
    }

    // Cleanup
    return () => {
      buttonRendered.current = false;
      const donateButton = document.querySelector('#donate-button');
      if (donateButton) {
        donateButton.innerHTML = '';
      }
    };
  }, []);

  return (
    <div id="donate-button-container">
      <div id="donate-button"></div>
    </div>
  );
};

export default PayPalDonateButton;
