import React from 'react';
import { Button } from 'antd';
import './ConfirmReport.css';

const ConfirmReport = ({ climaLabel, zonaLabel, loading, onConfirm, onCancel }) => {
  const mismoClima = climaLabel === zonaLabel;
  return (
    <div className="confirm-report-container">
      <h2 className="confirm-title">Ya hay reportes aquí</h2>
      <p className="confirm-subtitle">
        La zona donde estás marca <strong>{zonaLabel}</strong>.{" "}
        {mismoClima
          ? "¿Confirmas que sigue así?"
          : <>¿Confirmas que ahora ves <strong>{climaLabel}</strong>?</>}
      </p>

      <div className="confirm-actions">
        <Button className="btn-confirm volver" onClick={onCancel}>
          Volver
        </Button>
        <Button className="btn-confirm actualizar" loading={loading} onClick={onConfirm}>
          {mismoClima ? "Confirmar" : "Actualizar"}
        </Button>
      </div>
    </div>
  );
};

export default ConfirmReport;
