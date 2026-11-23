import React from 'react';
import { Button } from 'antd';
import { CLIMAS } from '../../constants/clima';
import Icono from '../Icono';
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
            className="climate-option"
            style={{ '--clima': option.color }}
            onClick={() => onSelect(option)}
            disabled={disabled}
          >
            <span className="climate-icon">
              <Icono nodo={option.icono} tamano={26} color={option.color} />
            </span>
            <span className="climate-label">{option.label}</span>
          </button>
        ))}
      </div>

      <div className="climate-footer">
        <Button type="primary" className="btn-cerrar-clima" onClick={onCancel}>
          Cerrar
        </Button>
      </div>
    </div>
  );
};

export default ClimateMenu;
