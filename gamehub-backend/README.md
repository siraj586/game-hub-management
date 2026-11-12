# GameHub Management - Backend

Django REST backend for the GameHub Management system. It provides the server-authoritative business logic for game center sessions, POS sales, inventory, analytics, daily reports, users, permissions, audit logs, and currency conversion.

The system is currently designed for one game center, with simple workflows suitable for small halls and offline desktop packaging later.

## Features

- Token-based authentication for owner and staff users.
- First-time owner bootstrap flow.
- Role and permission-aware API access.
- Game resource types and station/unit management.
- Simple device status: active/working or stopped/disabled.
- Session lifecycle management with server-calculated billing.
- Session pause/resume support.
- Session correction endpoint with audit logging.
- Cafe orders attached to sessions.
- Cash-only direct POS sales.
- Simple inventory with product quantity, cost, selling price, minimum stock level, and active status.
- Stock decrease on sale and stock recovery on cancellation/correction flows.
- Daily reports based on one selected date.
- Analytics filters for today, yesterday, this week, this month, and custom ranges.
- Optional monthly expense categories deducted from monthly net profit.
- USD base currency with optional SYP or LBP conversion support.
- Audit logs for sensitive actions.
- Business day with a configurable start hour, so late-night sessions stay on the same day.
- Harvest Day with a cash count, a warning about running sessions, and report updates that keep earlier figures.
- Daily report history with Excel export.
- Automatic daily database backups, plus manual backup, download and restore for the owner.
- OpenAPI schema and Swagger/Redoc documentation.

## Tech Stack

- Python
- Django 5.2
- Django REST Framework
- DRF Spectacular
- SQLite for local development
- django-cors-headers
- Token authentication

## Requirements

- Python 3.11 or compatible Python 3 version
- pip
- Virtual environment

## Project Structure

```text
api/
  models/        Domain models for users, resources, sessions, sales, inventory, reports
  serializers/   API serializers
  views/         API views and viewsets
  tests/         Backend test suite
  migrations/    Database migrations
gamehub_project/
  settings.py    Django settings
  urls.py        Root URL routes and API documentation routes
manage.py
requirements.txt
```

## Setup

Create and activate a virtual environment:

```powershell
python -m venv venv
.\venv\Scripts\activate
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Create your local settings file:

```powershell
copy .env.example .env
```

Apply migrations:

```powershell
python manage.py migrate
```

Start the development server:

```powershell
python manage.py runserver
```

Default API root:

```text
http://127.0.0.1:8000/api/
```

Admin panel:

```text
http://127.0.0.1:8000/admin/
```

## First-Time Setup Flow

The backend supports a bootstrap flow for creating the first owner account:

- `GET /api/auth/bootstrap/status/`
- `POST /api/auth/bootstrap/register/`

After the owner is created, the frontend setup wizard can configure:

- Center name
- Device/resource types
- Resource units/stations
- Currency settings
- Optional monthly expense categories

## Authentication

Login endpoint:

```text
POST /api/auth/login/
```

Current user profile:

```text
GET /api/auth/me/
```

Authenticated requests use DRF token authentication:

```text
Authorization: Token <token>
```

## Important API Routes

| Endpoint | Purpose |
| --- | --- |
| `/api/auth/login/` | User login |
| `/api/auth/bootstrap/status/` | Check whether first owner setup is needed |
| `/api/auth/bootstrap/register/` | Create first owner account |
| `/api/auth/me/` | Current authenticated user profile |
| `/api/setup/bulk/` | Bulk setup for resources and initial settings |
| `/api/resource-types/` | Manage device/resource categories |
| `/api/resource-units/` | Manage individual stations/units |
| `/api/sessions/` | Session lifecycle |
| `/api/sales/` | Direct cash POS sales |
| `/api/inventory-items/` | Simple inventory items |
| `/api/inventory-categories/` | Inventory categories |
| `/api/daily-reports/` | Daily reports |
| `/api/analytics/` | Analytics and date filters |
| `/api/currency-settings/` | Currency settings |
| `/api/currency-settings/convert/` | Currency conversion |
| `/api/monthly-expense-settings/` | Enabled expense categories |
| `/api/monthly-expenses/` | Monthly expense values |
| `/api/users/` | Staff and user management |
| `/api/audit-logs/` | Audit log records |

## API Documentation

OpenAPI schema:

```text
http://127.0.0.1:8000/api/schema/
```

Swagger UI:

```text
http://127.0.0.1:8000/api/schema/swagger-ui/
```

Redoc:

```text
http://127.0.0.1:8000/api/schema/redoc/
```

## Tests

Run backend tests:

```powershell
python manage.py test
```

On this project, the existing local virtual environment is usually:

```powershell
.\venv\Scripts\python.exe manage.py test
```

Run Django system checks:

```powershell
python manage.py check
```

## Development Notes

- Branches are intentionally not part of the current system.
- Shift reports are intentionally not part of the current system; reporting is daily-date based.
- Payment is cash-only.
- Inventory is intentionally simple and does not include suppliers, purchase orders, warehouses, or complex accounting.
- The backend is the source of truth for financial totals and session billing.
- Production packaging, deployment, hosting, and desktop-offline distribution will be handled later.

## Local Configuration Notes

The current local development settings use:

- SQLite database
- `DEBUG=True` from a local `.env` file (copy `.env.example` to `.env`)
- CORS allowed for local frontend development
- Token authentication
- Login and first-time setup limited to 10 attempts per minute per IP address

Without a `.env` file the server refuses to start: `DEBUG` is off by default and `SECRET_KEY` is then required.

Before production or desktop packaging, review:

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- CORS settings
- database location
- static files strategy
- backup and restore workflow

## Troubleshooting

If migrations fail:

- Confirm the virtual environment is active.
- Run `python manage.py showmigrations`.
- Run `python manage.py migrate`.

If tests cannot start:

- Confirm dependencies are installed from `requirements.txt`.
- Use the correct virtual environment path.
- Confirm the database migrations are valid.

If frontend requests fail:

- Confirm the backend is running on `http://127.0.0.1:8000/`.
- Confirm frontend Axios base URL points to `/api`.
- Check CORS settings in `gamehub_project/settings.py`.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEBUG` | `False` | Set to `True` for local development only. |
| `SECRET_KEY` | none | Required when `DEBUG` is `False`. |
| `GAMEHUB_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated hosts the backend answers for. Add the shop PC's LAN IP or your domain. |
| `GAMEHUB_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated frontend origins allowed to call the API. |
| `GAMEHUB_HTTPS` | `False` | Set to `True` when served over HTTPS: secure cookies, HTTPS redirect, HSTS. |
| `GAMEHUB_LOGIN_RATE` | `10/min` | Login attempts allowed per IP address. |
| `GAMEHUB_TIME_ZONE` | `Asia/Beirut` | Time zone used for dates and the business day. |
| `GAMEHUB_BACKUP_DIR` | `backups/` | Backup folder. Point it at a USB or cloud-synced folder so a copy survives a disk failure. |
| `GAMEHUB_AUTO_BACKUP` | `True` | Set to `False` to turn off the automatic daily backup. |

To recover on a new PC, copy a backup file into the backup folder, then choose Restore under Settings > Day & Backups.
