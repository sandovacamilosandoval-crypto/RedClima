import React from 'react';
import { Button } from 'antd';
import './ClimateMenu.css';

import soleado from '../assets/soleado.png';
import nublado from '../assets/nublado.png';
import lluvia from '../assets/lluvia.png';
import tormenta from '../assets/tormenta.png';

const ClimateMenu = ({ onSelect, onCancel }) => {
  const options = [
    { id: 'soleado', label: 'Soleado', img: soleado },
    { id: 'nublado', label: 'Nublado', img: nublado },
    { id: 'lluvia', label: 'Lluvia', img: lluvia },
    { id: 'tormenta', label: 'Tormenta', img: tormenta },
  ];

  return (
    <div className="climate-menu-wrapper">
      <div className="climate-grid">
        {options.map((option) => (
          <div 
            key={option.id} 
            className={`climate-option ${option.id}`} 
            onClick={() => onSelect(option.label)}
          >
            <img src={option.img} alt={option.label} className="climate-icon" />
            <span className="climate-label">{option.label}</span>
          </div>
        ))}
      </div>
      
      <div className="climate-footer">
        <Button 
          type="primary" 
          className="btn-cerrar-clima" 
          onClick={onCancel}
        >
          Cerrar
        </Button>
      </div>
    </div>
  );
};

export default ClimateMenu;