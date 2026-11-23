import React from 'react';
import './ReportButton.css'; 

const ReportButton = ({ onClick }) => {
  return (
    <button className="btn-reportar-custom" onClick={onClick}>
      Reportar el clima
    </button>
  );
};

export default ReportButton;