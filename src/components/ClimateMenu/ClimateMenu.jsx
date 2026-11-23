import React from 'react';
import { CLIMAS } from '../../constants/clima';
import Icono from '../Icono';
import Hoja from '../Hoja/Hoja';
import './ClimateMenu.css';

const ClimateMenu = ({ onSelect, onCancel, disabled = false }) => {
  return (
    <Hoja titulo="¿Qué clima ves ahora?" onCerrar={onCancel}>
      <div className="climate-grid" role="group" aria-label="Tipo de clima">
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
              <Icono nodo={option.icono} tamano={22} color={option.color} />
            </span>
            <span className="climate-label">{option.label}</span>
          </button>
        ))}
      </div>
    </Hoja>
  );
};

export default ClimateMenu;
