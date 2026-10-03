import React from 'react';
import Dialog, { DialogProps } from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';

interface ClosableDialogProps extends Omit<DialogProps, 'open' | 'onClose' | 'maxWidth'> {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  maxWidth?: DialogProps['maxWidth'];
}

const ClosableDialog: React.FC<ClosableDialogProps> = ({
  open,
  onClose,
  children,
  maxWidth,
  ...props
}) => {
  return (
    <Dialog
      open={open}
      maxWidth={maxWidth ? maxWidth : 'xl'}
      fullWidth
      onClose={(event, reason) => {
        if (reason === 'backdropClick') {
          if (onClose) {
            onClose();
          }
        }
      }}
      {...props}
    >
      <DialogContent>
        {children}
      </DialogContent>
    </Dialog>
  );
};

export default ClosableDialog;
