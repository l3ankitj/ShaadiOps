/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import Dashboard from './screens/Dashboard';
import GuestOps from './screens/GuestOps';
import GuestList from './screens/GuestList';
import HotelTracker from './screens/HotelTracker';
import TransportDesk from './screens/TransportDesk';
import VendorSOS from './screens/VendorSOS';
import Settings from './screens/Settings';
import PinGate from './components/PinGate';
import { AccessProvider } from './contexts/AccessContext';

function App() {
  return (
    <BrowserRouter>
      <PinGate>
        <AccessProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/guest-list" element={<GuestList />} />
              <Route path="/guest-ops" element={<GuestOps />} />
              <Route path="/hotel-tracker" element={<HotelTracker />} />
              <Route path="/transport-desk" element={<TransportDesk />} />
              <Route path="/vendor-sos" element={<VendorSOS />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AppLayout>
        </AccessProvider>
      </PinGate>
    </BrowserRouter>
  );
}

export default App;
