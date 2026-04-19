# KaamSetu 💼

**A scalable full-stack job marketplace platform** connecting talented professionals with top employers across India.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control: **User** (job seeker), **Employer**, **Admin**
- Secure password hashing with bcrypt

### 👤 User Roles
| Role     | Capabilities |
|----------|-------------|
| **User** | Browse jobs, apply, track application status, manage profile |
| **Employer** | Post jobs, view applicants, update application statuses |
| **Admin** | Full platform management: users, jobs, statistics |

### 🔗 REST API Endpoints
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| GET | `/api/jobs` | Public (filters: search, location, type, etc.) |
| GET | `/api/jobs/:id` | Public |
| POST | `/api/jobs` | Employer / Admin |
| PUT | `/api/jobs/:id` | Employer (own) / Admin |
| DELETE | `/api/jobs/:id` | Employer (own) / Admin |
| GET | `/api/jobs/my` | Employer |
| POST | `/api/applications/:jobId` | User |
| GET | `/api/applications/my` | User |
| GET | `/api/applications/job/:jobId` | Employer / Admin |
| PUT | `/api/applications/:id/status` | Employer / Admin |
| DELETE | `/api/applications/:id` | User (withdraw) |
| GET | `/api/admin/stats` | Admin |
| GET | `/api/admin/users` | Admin |
| PUT | `/api/admin/users/:id` | Admin |
| DELETE | `/api/admin/users/:id` | Admin |
| GET | `/api/admin/jobs` | Admin |
| PUT | `/api/admin/jobs/:id` | Admin |

### 🎨 Frontend (React)
- Responsive design (mobile, tablet, desktop)
- Home page with stats and features
- Job search with filters (type, location, experience, category)
- Job detail view with apply modal
- User dashboard: track applications & statuses
- Employer dashboard: manage jobs & review applicants
- Admin panel: platform statistics, user management, job management
- Profile management with password change

## Project Structure

```
kaamsetu/
├── backend/
│   ├── src/
│   │   ├── config/        # Database connection
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth & error handling
│   │   ├── models/        # Mongoose models (User, Job, Application)
│   │   ├── routes/        # Express routers
│   │   └── server.js      # App entry point
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/    # Navbar, JobCard, ProtectedRoute
    │   ├── context/       # AuthContext
    │   ├── pages/         # Home, Login, Register, JobList, JobDetail, ...
    │   └── utils/         # Axios API client
    ├── .env.example
    └── package.json
```

## Getting Started

### Prerequisites
- Node.js v16+
- MongoDB (local or Atlas)

### Installation

```bash
# Clone and install all dependencies
npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your values
```

### Running the App

```bash
# Start backend (development)
npm run dev:backend

# Start frontend (in another terminal)
npm run start:frontend
```

Backend runs on `http://localhost:5000`
Frontend runs on `http://localhost:3000`

### Running Tests

```bash
npm run test:backend
```

## Tech Stack

**Backend:** Node.js · Express · MongoDB (Mongoose) · JWT · bcryptjs  
**Frontend:** React · React Router · Axios · React Toastify
