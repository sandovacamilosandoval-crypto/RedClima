import React from 'react';
import { Button } from 'antd';
import './ConfirmReport.css';

const ConfirmReport = ({ climaLabel, onConfirm, onCancel }) => {
  return (
    <div className="confirm-report-container">
      <h2 className="confirm-title">Hiciste un reporte cerca</h2>
      <p className="confirm-subtitle">
        ¿Quieres actualizarlo a <strong>{climaLabel}</strong>?
      </p>
      
      <div className="confirm-actions">
        <Button className="btn-confirm volver" onClick={onCancel}>
          Volver
        </Button>
        <Button className="btn-confirm actualizar" onClick={onConfirm}>
          Actualizar
        </Button>
      </div>
    </div>
  );
};

export default ConfirmReport;