import React from 'react';
import { createRoot } from 'react-dom/client';
import PartnerApp from './PartnerApp';

const root = document.getElementById('app');
if (root) createRoot(root).render(<PartnerApp />);
