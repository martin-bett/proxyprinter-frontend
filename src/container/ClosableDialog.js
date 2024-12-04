import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';

const ClosableDialog = ({ 
  open, 
  onClose, 
  children, 
  maxWidth,
  ...props 
}) => {
  return (
    <Dialog 
      open={open}
      maxWidth = {maxWidth ? maxWidth : 'xl'}
      fullWidth
      onClose={(event, reason) => {
        if (reason === 'backdropClick') {
          if(onClose){
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