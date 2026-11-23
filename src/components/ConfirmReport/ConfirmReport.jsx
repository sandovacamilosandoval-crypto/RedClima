import React from 'react';
import { Button } from 'antd';
import Hoja from '../Hoja/Hoja';

const ConfirmReport = ({ climaLabel, zonaLabel, loading, onConfirm, onCancel }) => {
  const mismoClima = climaLabel === zonaLabel;
  return (
    <Hoja
      titulo={mismoClima ? `¿Sigue ${zonaLabel.toLowerCase()}?` : `¿Ahora ves ${climaLabel.toLowerCase()}?`}
      subtitulo={`Tus vecinos reportan ${zonaLabel.toLowerCase()} en esta zona.`}
      onCerrar={onCancel}
      pie={
        <Button type="primary" className="btn-principal" loading={loading} onClick={onConfirm}>
          {mismoClima ? 'Sí, confirmar' : `Sí, reportar ${climaLabel.toLowerCase()}`}
        </Button>
      }
    />
  );
};

export default ConfirmReport;
