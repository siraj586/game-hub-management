# GameHub Management - Frontend

Modern React frontend for the GameHub Management system, designed for small game centers that need a simple offline-friendly workflow for sessions, POS sales, inventory, analytics, staff permissions, and daily reporting.

The frontend is built with React, Vite, Tailwind CSS, and Axios. It connects to the Django REST API and keeps sensitive calculations, billing, and stock changes server-authoritative.

## Features

- Session dashboard for starting, monitoring, pausing, ending, and correcting game sessions.
- POS sale page with cafe item sales and integrated simple inventory management.
- Backend-calculated session totals, elapsed time, effective rate, final total, and billing values.
- Daily analytics with filters for today, yesterday, this week, this month, and custom ranges.
- Local currency support for USD plus optional SYP or LBP display and calculator.
- Basic receipts for sessions and sales.
- Owner and staff permission-aware UI.
- Settings page for devices, staff, permissions, expenses, and audit logs.
- Responsive layout for desktop and smaller screens.

## Tech Stack

- React 19
- Vite 8
- Tailwind CSS
- Axios
- Node.js built-in test runner
- ESLint

## Requirements

- Node.js
- npm
- Running GameHub backend API, usually at `http://127.0.0.1:8000/api`

## Project Structure

```text
src/
  components/        Shared UI and feature components
  components/layout/ Main application layout and navigation
  context/           App state, API calls, auth, and shared actions
  pages/             Main screens: sessions, sales, analytics, settings
  utils/             Currency, permissions, and helper utilities
```

## Setup

Install dependencies:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

Open the app:

```text
http://127.0.0.1:5173/
```

The frontend expects the backend API base URL to be configured in:

```text
src/context/AppContext.jsx
```

Default API URL:

```text
http://127.0.0.1:8000/api
```

## Available Scripts

Run the local development server:

```powershell
npm run dev
```

Create a production build:

```powershell
npm run build
```

Preview the production build:

```powershell
npm run preview
```

Run lint checks:

```powershell
npm run lint
```

Run frontend tests:

```powershell
npm test
```

## Main Screens

### Sessions

Used for daily hall operations:

- Start a session by selecting a device or station.
- Track active sessions.
- Add cafe orders to sessions.
- End sessions with backend-calculated totals.
- Correct sensitive completed session data when allowed by role.

### POS Sale

Used for direct cafe sales and inventory:

- Sell cafe products without an active session.
- Manage product name, quantity, cost, selling price, minimum stock level, and active status.
- Show low-stock indicators.
- Keep stock changes synchronized with backend sale and correction logic.

### Analytics

Used for reporting and business overview:

- Filter analytics by common periods or custom date range.
- Show revenue, net profit, monthly expenses, live gamers, and station usage.
- Configure local currency value for SYP or LBP.
- Use the currency calculator for USD/local conversions.

### Settings

Used for administration:

- Manage device groups and station status.
- Enable simple monthly expense categories.
- Manage staff and permissions.
- View audit logs.

## Permissions

The UI respects backend permissions and hides actions the current user should not perform. OWNER-level users can manage settings and sensitive financial corrections. STAFF users see only the workflows enabled for their account.

## Notes

- The frontend may show live previews, but final financial values should come from the backend.
- Payment is currently cash-only.
- Device status is intentionally simple: active/working or stopped/disabled.
- Inventory is intentionally simple and does not include suppliers or purchase orders.

## Troubleshooting

If login or API calls fail:

- Make sure the backend server is running.
- Confirm the API base URL in `src/context/AppContext.jsx`.
- Check browser console network errors.
- Confirm CORS is enabled in the backend local settings.

If styles look broken:

- Reinstall dependencies with `npm install`.
- Restart the Vite dev server.

If tests fail after changing permissions or currency logic:

- Run `npm run lint`.
- Run `npm test`.
- Check `src/utils/permissions.js` and `src/utils/currency.js`.

