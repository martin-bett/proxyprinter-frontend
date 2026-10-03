import React from 'react';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'; // Oder PayPal-Icon

const PAYPAL_URL = "https://www.paypal.com/donate/?hosted_button_id=MRVMDLBTPFMRA";

const PayPalDonateButton = () => (
  <button
    className="button"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5em",
      fontSize: "1rem",
      cursor: "pointer"
    }}
    onClick={() => window.open(PAYPAL_URL, "_blank", "noopener,noreferrer")}
    type="button"
  >
    <AccountBalanceWalletIcon style={{ color: "#5a3577" }} />
    <span className="font-semibold">Donate PayPal</span>
  </button>
);

export default PayPalDonateButton;