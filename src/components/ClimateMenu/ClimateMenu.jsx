import React from 'react';
import { Button } from 'antd';
import { CLIMAS } from '../../constants/clima';
import './ClimateMenu.css';

const ClimateMenu = ({ onSelect, onCancel, disabled = false }) => {
  return (
    <div className="climate-menu-wrapper">
      <h2 className="climate-title" id="climate-title">¿Qué clima ves ahora?</h2>
      <div className="climate-grid" role="group" aria-labelledby="climate-title">
        {CLIMAS.map((option) => (
          <button
            type="button"
            key={option.id}
            className={`climate-option ${option.id}`}
            onClick={() => onSelect(option)}
            disabled={disabled}
          >
            <img src={option.img} alt="" className="climate-icon" />
            <span className="climate-label">{option.label}</span>
          </button>
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
