import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import AppLayout from '../layouts/AppLayout'
import AccountsPage from '../pages/AccountsPage'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/LoginPage'
import SalesPage from '../pages/SalesPage'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="accounts" element={<AccountsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
