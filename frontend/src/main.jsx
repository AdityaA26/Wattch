import React from 'react';
import { createRoot } from 'react-dom/client';
import WattchApp from './app/WattchApp.jsx';
import HouseholdDataProvider from './state/householdData.jsx';
import ErrorBoundary from './app/ErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(<ErrorBoundary><HouseholdDataProvider><WattchApp /></HouseholdDataProvider></ErrorBoundary>);
