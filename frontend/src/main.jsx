import React from 'react';
import ReactDOM from 'react-dom/client';
import { LocationProvider } from '@reach/router';
import App from './App';

// Fix for @reach/router in React 18: ensure unmounted flag is reset if re-mounted
if (LocationProvider && LocationProvider.prototype) {
  const originalMount = LocationProvider.prototype.componentDidMount;
  LocationProvider.prototype.componentDidMount = function () {
    this.unmounted = false;
    if (originalMount) {
      originalMount.apply(this, arguments);
    }
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
