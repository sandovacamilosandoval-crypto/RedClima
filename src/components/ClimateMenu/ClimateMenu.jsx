import React from 'react';
import { Button } from 'antd';
import { CLIMAS } from '../../constants/clima';
import './ClimateMenu.css';

const ClimateMenu = ({ onSelect, onCancel }) => {
  return (
    <div className="climate-menu-wrapper">
      <div className="climate-grid">
        {CLIMAS.map((option) => (
          <div
            key={option.id}
            className={`climate-option ${option.id}`}
            onClick={() => onSelect(option)}
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
