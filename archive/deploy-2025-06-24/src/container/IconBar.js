import React, { useState, useEffect } from 'react';
import './IconBar.css';
import VisibilityIcon from '@mui/icons-material/Visibility';

const IconBar = ({ 
  onSelectionChange, 
  elements, 
  initialSelection = [] 
}) => {
  const [selectedItems, setSelectedItems] = useState(initialSelection);

  // Update parent component when selection changes
  useEffect(() => {
    onSelectionChange(selectedItems);
  }, [selectedItems, onSelectionChange]);

  // Toggle item selection
  const handleItemClick = (key) => {
    setSelectedItems(prev => 
      prev.includes(key) 
        ? prev.filter(item => item !== key)
        : [...prev, key]
    );
  };

  return (
    <div className="flex items-center icon-bar space-x-2">
      <div title="View Filtering"><VisibilityIcon title="hallo" alt="hallo" className='info-icon'/></div>
      {elements.map((element) => (
        <div 
          key={element.key}
          onClick={() => handleItemClick(element.key)}
          className={`
            bar-icon
            ${element.defaultClass}
            ${selectedItems.includes(element.key) 
              ? (element.selectedClass) + ' selected'
              : ''
            }
          `}
        >
          {element.content}
        </div>
      ))}
    </div>
  );
};

export default IconBar;